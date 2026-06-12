import type Stripe from "stripe"
import { stripe, STRIPE_PRICE_IDS } from "@/lib/stripe"
import { prisma } from "@/lib/prisma"
import { PlanTier, SubscriptionStatus } from "@prisma/client"

/**
 * Cobrança B2B da plataforma (assinatura do salão) via Stripe — Checkout +
 * Customer Portal hospedados. NÃO confundir com o Mercado Pago do sinal
 * (cliente → salão).
 */

/** Plataforma tem Stripe configurado? */
export function isBillingConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY
}

/**
 * Assinatura dá acesso ao painel? ACTIVE, ou TRIALING com trial ainda válido.
 * (Cobre o caso de trial expirado que segue como TRIALING no banco.)
 */
export function hasActiveSubscription(
  sub: { status: SubscriptionStatus; trialEndsAt: Date | null } | null | undefined
): boolean {
  if (!sub) return false
  if (sub.status === "ACTIVE") return true
  if (sub.status === "TRIALING") return !sub.trialEndsAt || sub.trialEndsAt.getTime() > Date.now()
  return false
}

export function priceIdForPlan(plan: PlanTier): string | null {
  return STRIPE_PRICE_IDS[plan] || null
}

export function planForPriceId(priceId: string | null | undefined): PlanTier | null {
  if (!priceId) return null
  const entry = Object.entries(STRIPE_PRICE_IDS).find(([, id]) => id && id === priceId)
  return (entry?.[0] as PlanTier) ?? null
}

function mapStatus(s: string): SubscriptionStatus {
  switch (s) {
    case "active":
      return SubscriptionStatus.ACTIVE
    case "trialing":
      return SubscriptionStatus.TRIALING
    case "past_due":
      return SubscriptionStatus.PAST_DUE
    case "canceled":
      return SubscriptionStatus.CANCELLED
    case "unpaid":
      return SubscriptionStatus.UNPAID
    default:
      return SubscriptionStatus.PAST_DUE
  }
}

function baseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "")
}

export async function createCheckoutSession(opts: {
  tenantId: string
  plan: PlanTier
  email: string
  customerId?: string | null
}): Promise<Stripe.Checkout.Session> {
  const price = priceIdForPlan(opts.plan)
  if (!price) throw new Error(`Plano ${opts.plan} sem Price do Stripe configurado`)
  return stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price, quantity: 1 }],
    success_url: `${baseUrl()}/assinatura?status=success`,
    cancel_url: `${baseUrl()}/assinatura?status=cancel`,
    ...(opts.customerId
      ? { customer: opts.customerId }
      : { customer_email: opts.email }),
    client_reference_id: opts.tenantId,
    metadata: { tenantId: opts.tenantId },
    subscription_data: { metadata: { tenantId: opts.tenantId } },
    allow_promotion_codes: true,
  })
}

export async function createPortalSession(customerId: string): Promise<Stripe.BillingPortal.Session> {
  return stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${baseUrl()}/assinatura`,
  })
}

/** Sincroniza a Subscription local a partir de um objeto Stripe.Subscription. */
export async function syncStripeSubscription(sub: Stripe.Subscription): Promise<void> {
  const tenantId = sub.metadata?.tenantId
  const priceId = sub.items.data[0]?.price?.id ?? null
  const plan = planForPriceId(priceId)
  const periodEnd = (sub as unknown as { current_period_end?: number }).current_period_end

  const data = {
    status: mapStatus(sub.status),
    stripeCustomerId: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
    stripeSubscriptionId: sub.id,
    stripePriceId: priceId,
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    ...(periodEnd ? { currentPeriodEnd: new Date(periodEnd * 1000) } : {}),
    ...(plan ? { plan } : {}),
  }

  const where = tenantId ? { tenantId } : { stripeSubscriptionId: sub.id }
  await prisma.subscription.updateMany({ where, data })
}

/** Marca PAST_DUE quando uma fatura falha. */
export async function markPastDueBySubscriptionId(stripeSubscriptionId: string): Promise<void> {
  await prisma.subscription.updateMany({
    where: { stripeSubscriptionId },
    data: { status: SubscriptionStatus.PAST_DUE },
  })
}
