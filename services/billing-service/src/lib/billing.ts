/**
 * Lógica central de billing — migrado de src/lib/billing.ts do monolito.
 * Gerencia assinaturas Stripe, checkout, portal e sincronização de status.
 */

import type Stripe from "stripe"
import { stripe, STRIPE_PRICE_IDS } from "./stripe"
import { prisma } from "./prisma"
import { PlanTier, SubscriptionStatus } from "@prisma/client"

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
    case "active": return SubscriptionStatus.ACTIVE
    case "trialing": return SubscriptionStatus.TRIALING
    case "past_due": return SubscriptionStatus.PAST_DUE
    case "canceled": return SubscriptionStatus.CANCELLED
    case "unpaid": return SubscriptionStatus.UNPAID
    default: return SubscriptionStatus.PAST_DUE
  }
}

function baseUrl(): string {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "")
}

export async function createCheckoutSession(opts: {
  tenantId: string
  plan: PlanTier
  email: string
  customerId?: string | null
  priceIdOverride?: string | null
}): Promise<Stripe.Checkout.Session> {
  const price = opts.priceIdOverride || priceIdForPlan(opts.plan)
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

/** Sincroniza Subscription local com dados do Stripe. Idempotente. */
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

export async function markPastDueBySubscriptionId(stripeSubscriptionId: string): Promise<void> {
  await prisma.subscription.updateMany({
    where: { stripeSubscriptionId },
    data: { status: SubscriptionStatus.PAST_DUE },
  })
}
