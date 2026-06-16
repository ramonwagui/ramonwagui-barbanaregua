export const dynamic = "force-dynamic"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import Link from "next/link"
import { PlanTier } from "@prisma/client"
import { PLAN_PRICES, PLAN_LIMITS, PLAN_LABELS } from "@/lib/plans"
import { hasActiveSubscription, syncStripeSubscription, isBillingConfigured } from "@/lib/billing"
import { stripe } from "@/lib/stripe"
import AssinaturaClient from "./assinatura-client"
import { Logo } from "@/components/logo"

const ORDER: PlanTier[] = ["BASIC", "PRO", "PREMIUM"]

/** Dias restantes de trial (fora do render: usa o horário atual). */
function trialDaysLeft(trialEndsAt: Date): number {
  return Math.ceil((trialEndsAt.getTime() - Date.now()) / 86400000)
}

function planFeatures(tier: PlanTier): string[] {
  const l = PLAN_LIMITS[tier]
  const out: string[] = []
  out.push(l.maxBarbers === null ? "Barbeiros ilimitados" : `Até ${l.maxBarbers} barbeiros`)
  out.push(
    l.maxAppointmentsPerMonth === null
      ? "Agendamentos ilimitados"
      : `${l.maxAppointmentsPerMonth} agendamentos/mês`
  )
  if (l.whatsappNotifications) out.push("Notificações por WhatsApp")
  if (l.onlinePayments) out.push("Sinal/pagamento online (PIX)")
  if (l.loyaltyProgram) out.push("Programa de fidelidade")
  if (l.customDomain) out.push("Domínio próprio")
  out.push(
    l.analyticsHistoryDays === null
      ? "Relatórios completos"
      : `Relatórios (${l.analyticsHistoryDays} dias)`
  )
  return out
}

export default async function AssinaturaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const sessionId = typeof sp.session_id === "string" ? sp.session_id : undefined

  const session = await auth()
  if (!session?.user) redirect("/login")
  if (session.user.role === "SUPER_ADMIN") redirect("/admin")
  if (!session.user.tenantId) redirect("/onboarding")

  // Retorno do Stripe Checkout: sincroniza antes de consultar o banco para
  // evitar a condição de corrida com o webhook assíncrono do Stripe.
  if (sp.status === "success" && isBillingConfigured()) {
    try {
      if (sessionId) {
        // Caminho ideal: session_id na URL (checkout feito após o deploy atual)
        const cs = await stripe.checkout.sessions.retrieve(sessionId)
        if (cs.subscription) {
          const subId = typeof cs.subscription === "string" ? cs.subscription : cs.subscription.id
          await syncStripeSubscription(await stripe.subscriptions.retrieve(subId))
        }
      } else {
        // Fallback: checkout antigo (sem session_id). Tenta pelo subscriptionId ou customerId do banco.
        const existing = await prisma.subscription.findUnique({
          where: { tenantId: session.user.tenantId! },
          select: { stripeSubscriptionId: true, stripeCustomerId: true },
        })
        if (existing?.stripeSubscriptionId) {
          const stripeSub = await stripe.subscriptions.retrieve(existing.stripeSubscriptionId)
          await syncStripeSubscription(stripeSub)
        } else if (existing?.stripeCustomerId) {
          const list = await stripe.subscriptions.list({
            customer: existing.stripeCustomerId,
            status: "active",
            limit: 1,
          })
          if (list.data[0]) await syncStripeSubscription(list.data[0])
        }
      }
    } catch (e) {
      console.error("[assinatura] Falha ao sincronizar após checkout:", e)
    }
  }

  const isOwner = session.user.role !== "BARBER"
  const [sub, config] = await Promise.all([
    prisma.subscription.findUnique({
      where: { tenantId: session.user.tenantId },
      select: { plan: true, status: true, trialEndsAt: true, currentPeriodEnd: true, stripeCustomerId: true },
    }),
    prisma.globalConfig.findUnique({
      where: { id: "singleton" },
      select: { planPriceBasic: true, planPricePro: true, planPricePremium: true },
    }),
  ])
  const active = hasActiveSubscription(sub)

  const dbPrices: Record<PlanTier, number> = {
    BASIC:   config?.planPriceBasic   ?? PLAN_PRICES.BASIC,
    PRO:     config?.planPricePro     ?? PLAN_PRICES.PRO,
    PREMIUM: config?.planPricePremium ?? PLAN_PRICES.PREMIUM,
  }

  let statusLine = "Sem assinatura."
  if (sub) {
    if (sub.status === "TRIALING" && sub.trialEndsAt) {
      const days = trialDaysLeft(sub.trialEndsAt)
      statusLine = days > 0
        ? `Período de teste: ${days} dia${days !== 1 ? "s" : ""} restante${days !== 1 ? "s" : ""}.`
        : "Seu período de teste terminou. Escolha um plano para continuar."
    } else if (sub.status === "ACTIVE") {
      statusLine = `Plano ${PLAN_LABELS[sub.plan]} ativo.`
    } else if (sub.status === "PAST_DUE" || sub.status === "UNPAID") {
      statusLine = "Pagamento pendente. Regularize para reativar o painel."
    } else if (sub.status === "CANCELLED") {
      statusLine = "Assinatura cancelada. Escolha um plano para reativar."
    }
  }

  const plans = ORDER.map((tier) => ({
    tier,
    label: PLAN_LABELS[tier],
    price: dbPrices[tier] / 100,
    features: planFeatures(tier),
  }))

  return (
    <div className="min-h-screen bg-zinc-950 p-5">
      <div className="max-w-4xl mx-auto py-8">
        <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
          <Logo size="sm" />
          {active && (
            <Link href="/dashboard" className="text-sm text-zinc-400 hover:text-white underline underline-offset-4">
              ← Voltar ao painel
            </Link>
          )}
        </div>

        <h1 className="text-white font-bold mb-1" style={{ fontFamily: "var(--font-cormorant)", fontSize: "2.2rem" }}>
          {active ? "Sua assinatura" : "Escolha seu plano"}
        </h1>
        <p className="text-zinc-500 text-sm mb-8">{statusLine}</p>

        <AssinaturaClient
          plans={plans}
          isOwner={isOwner}
          currentPlan={sub?.plan ?? null}
          isActive={active}
          hasCustomer={!!sub?.stripeCustomerId}
        />
      </div>
    </div>
  )
}
