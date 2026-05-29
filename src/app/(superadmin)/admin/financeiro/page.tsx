export const dynamic = 'force-dynamic'

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { format, addDays, startOfMonth, endOfMonth, subMonths } from "date-fns"
import { ptBR } from "date-fns/locale"
import { DollarSign, TrendingUp, AlertTriangle, CheckCircle2, Clock, XCircle } from "lucide-react"

const PLAN_PRICE: Record<string, number> = { BASIC: 99, PRO: 199, PREMIUM: 399 }
const PLAN_COLORS: Record<string, string> = { BASIC: "#60a5fa", PRO: "#f59e0b", PREMIUM: "#c084fc" }
const PLAN_LABELS: Record<string, string> = { BASIC: "Basic", PRO: "Pro", PREMIUM: "Premium" }

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  TRIALING: { bg: "#1e3a5f20", text: "#60a5fa" },
  ACTIVE: { bg: "#14532d20", text: "#4ade80" },
  PAST_DUE: { bg: "#78350f20", text: "#fbbf24" },
  CANCELLED: { bg: "#7f1d1d20", text: "#f87171" },
}
const STATUS_LABELS: Record<string, string> = {
  TRIALING: "Trial", ACTIVE: "Ativo", PAST_DUE: "Vencido", CANCELLED: "Cancelado",
}

export default async function AdminFinanceiroPage() {
  const session = await auth()
  if (session?.user?.role !== "SUPER_ADMIN") redirect("/login")

  const today = new Date()
  const in30Days = addDays(today, 30)
  const in7Days = addDays(today, 7)
  const thisMonthStart = startOfMonth(today)
  const thisMonthEnd = endOfMonth(today)
  const lastMonthStart = startOfMonth(subMonths(today, 1))
  const lastMonthEnd = endOfMonth(subMonths(today, 1))

  const [subscriptions, expiringTenants, problemTenants, newTenantsThisMonth, newTenantsLastMonth] =
    await Promise.all([
      // Todas as subscriptions com dados do tenant
      prisma.subscription.findMany({
        include: {
          tenant: {
            select: { id: true, name: true, slug: true, isActive: true, owner: { select: { email: true } } },
          },
        },
        orderBy: { currentPeriodEnd: "asc" },
      }),

      // Vencendo nos próximos 30 dias (somente ativas ou em trial)
      prisma.subscription.findMany({
        where: {
          status: { in: ["ACTIVE", "TRIALING"] },
          currentPeriodEnd: { gte: today, lte: in30Days },
        },
        include: {
          tenant: { select: { name: true, slug: true, owner: { select: { email: true } } } },
        },
        orderBy: { currentPeriodEnd: "asc" },
      }),

      // Contas problemáticas (PAST_DUE ou CANCELLED)
      prisma.subscription.findMany({
        where: { status: { in: ["PAST_DUE", "CANCELLED"] } },
        include: {
          tenant: { select: { name: true, slug: true, isActive: true, owner: { select: { email: true } } } },
        },
        orderBy: { updatedAt: "desc" },
      }),

      // Novos tenants este mês
      prisma.tenant.count({ where: { createdAt: { gte: thisMonthStart, lte: thisMonthEnd } } }),
      prisma.tenant.count({ where: { createdAt: { gte: lastMonthStart, lte: lastMonthEnd } } }),
    ])

  // ── Cálculos de MRR ────────────────────────────────────────────────────────

  const activeSubscriptions = subscriptions.filter((s) => s.status === "ACTIVE")
  const trialingSubscriptions = subscriptions.filter((s) => s.status === "TRIALING")

  const mrr = activeSubscriptions.reduce((sum, s) => sum + (PLAN_PRICE[s.plan] ?? 0), 0)
  const potentialMrr = trialingSubscriptions.reduce((sum, s) => sum + (PLAN_PRICE[s.plan] ?? 0), 0)

  // MRR por plano
  const mrrByPlan = ["BASIC", "PRO", "PREMIUM"].map((plan) => {
    const count = activeSubscriptions.filter((s) => s.plan === plan).length
    const revenue = count * (PLAN_PRICE[plan] ?? 0)
    return { plan, count, revenue }
  })
  const maxPlanRevenue = Math.max(...mrrByPlan.map((p) => p.revenue), 1)

  // Distribuição de status
  const statusCount: Record<string, number> = {}
  for (const s of subscriptions) {
    statusCount[s.status] = (statusCount[s.status] ?? 0) + 1
  }

  const newTenantGrowth = newTenantsLastMonth === 0
    ? null
    : Math.round(((newTenantsThisMonth - newTenantsLastMonth) / newTenantsLastMonth) * 100)

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-white leading-tight" style={{ fontFamily: "var(--font-cormorant)", fontSize: "2rem", fontWeight: 700 }}>
          Financeiro
        </h1>
        <p className="text-zinc-600 text-sm mt-1 capitalize">
          {format(today, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          {
            label: "MRR (receita mensal)",
            value: `R$ ${mrr.toLocaleString("pt-BR")}`,
            sub: `${activeSubscriptions.length} assinaturas ativas`,
            icon: DollarSign,
            color: "#4ade80",
          },
          {
            label: "MRR potencial (trials)",
            value: `R$ ${potentialMrr.toLocaleString("pt-BR")}`,
            sub: `${trialingSubscriptions.length} em trial`,
            icon: TrendingUp,
            color: "#60a5fa",
          },
          {
            label: "Novos tenants este mês",
            value: newTenantsThisMonth.toString(),
            sub: newTenantGrowth === null ? "sem comparativo" : `${newTenantGrowth >= 0 ? "+" : ""}${newTenantGrowth}% vs mês anterior`,
            icon: CheckCircle2,
            color: "#c084fc",
          },
          {
            label: "Contas problemáticas",
            value: problemTenants.length.toString(),
            sub: "vencido ou cancelado",
            icon: AlertTriangle,
            color: problemTenants.length > 0 ? "#f87171" : "#4ade80",
          },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-2xl border border-zinc-800/60 p-5 flex flex-col gap-4" style={{ backgroundColor: "#111111" }}>
            <div className="flex items-center justify-between">
              <p className="text-zinc-500 text-xs font-semibold uppercase tracking-widest">{kpi.label}</p>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${kpi.color}15` }}>
                <kpi.icon className="w-4 h-4" style={{ color: kpi.color }} />
              </div>
            </div>
            <div>
              <p className="text-white font-bold" style={{ fontFamily: "var(--font-cormorant)", fontSize: "2rem", lineHeight: 1 }}>
                {kpi.value}
              </p>
              <p className="text-zinc-600 text-xs mt-1">{kpi.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Grid: MRR por plano + Status */}
      <div className="grid xl:grid-cols-2 gap-4">
        {/* MRR por plano */}
        <div className="rounded-2xl border border-zinc-800/60 overflow-hidden" style={{ backgroundColor: "#111111" }}>
          <div className="px-5 py-4 border-b border-zinc-800/60">
            <h2 className="text-white font-semibold" style={{ fontFamily: "var(--font-cormorant)", fontSize: "1.1rem" }}>
              Receita por Plano
            </h2>
          </div>
          <div className="px-5 py-5 space-y-5">
            {mrrByPlan.map(({ plan, count, revenue }) => (
              <div key={plan}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: `${PLAN_COLORS[plan]}15`, color: PLAN_COLORS[plan] }}>
                      {PLAN_LABELS[plan]}
                    </span>
                    <span className="text-zinc-500 text-xs">
                      {count} tenant{count !== 1 ? "s" : ""} × R$ {PLAN_PRICE[plan]}/mês
                    </span>
                  </div>
                  <span className="text-white text-sm font-bold" style={{ fontFamily: "var(--font-cormorant)" }}>
                    R$ {revenue.toLocaleString("pt-BR")}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-zinc-800">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${(revenue / maxPlanRevenue) * 100}%`, backgroundColor: PLAN_COLORS[plan] }}
                  />
                </div>
              </div>
            ))}
            <div className="pt-3 border-t border-zinc-800/40 flex items-center justify-between">
              <span className="text-zinc-500 text-sm">Total MRR</span>
              <span className="text-amber-400 font-bold" style={{ fontFamily: "var(--font-cormorant)", fontSize: "1.3rem" }}>
                R$ {mrr.toLocaleString("pt-BR")}
              </span>
            </div>
          </div>
        </div>

        {/* Distribuição de status */}
        <div className="rounded-2xl border border-zinc-800/60 overflow-hidden" style={{ backgroundColor: "#111111" }}>
          <div className="px-5 py-4 border-b border-zinc-800/60">
            <h2 className="text-white font-semibold" style={{ fontFamily: "var(--font-cormorant)", fontSize: "1.1rem" }}>
              Distribuição de Status
            </h2>
          </div>
          <div className="px-5 py-5 space-y-3">
            {(["ACTIVE", "TRIALING", "PAST_DUE", "CANCELLED"] as const).map((status) => {
              const count = statusCount[status] ?? 0
              const total = subscriptions.length || 1
              const pct = Math.round((count / total) * 100)
              const style = STATUS_COLORS[status]
              const Icon = status === "ACTIVE" ? CheckCircle2 : status === "TRIALING" ? Clock : status === "PAST_DUE" ? AlertTriangle : XCircle
              return (
                <div key={status} className="flex items-center gap-3">
                  <Icon className="w-4 h-4 shrink-0" style={{ color: style.text }} />
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-zinc-400 text-xs">{STATUS_LABELS[status]}</span>
                      <span className="text-zinc-300 text-xs font-medium">{count} ({pct}%)</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-zinc-800">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: style.text }} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Vencimentos próximos */}
      {expiringTenants.length > 0 && (
        <div className="rounded-2xl border border-zinc-800/60 overflow-hidden" style={{ backgroundColor: "#111111" }}>
          <div className="px-5 py-4 border-b border-zinc-800/60 flex items-center justify-between">
            <h2 className="text-white font-semibold" style={{ fontFamily: "var(--font-cormorant)", fontSize: "1.1rem" }}>
              Vencimentos nos Próximos 30 Dias
            </h2>
            <span className="text-zinc-600 text-xs">{expiringTenants.length} assinatura{expiringTenants.length !== 1 ? "s" : ""}</span>
          </div>
          <div className="divide-y divide-zinc-800/40">
            {expiringTenants.map((sub) => {
              const daysLeft = Math.ceil((sub.currentPeriodEnd.getTime() - today.getTime()) / 86400000)
              const isUrgent = daysLeft <= 7
              return (
                <div key={sub.id} className="px-5 py-4 flex items-center justify-between hover:bg-zinc-800/20 transition-colors">
                  <div>
                    <p className="text-white text-sm font-medium">{sub.tenant.name}</p>
                    <p className="text-zinc-500 text-xs mt-0.5">{sub.tenant.owner?.email ?? "—"}</p>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: `${PLAN_COLORS[sub.plan]}15`, color: PLAN_COLORS[sub.plan] }}>
                      {PLAN_LABELS[sub.plan]}
                    </span>
                    <div className="text-right">
                      <p className="text-xs font-semibold" style={{ color: isUrgent ? "#f87171" : "#fbbf24" }}>
                        {daysLeft === 0 ? "Hoje" : `${daysLeft} dia${daysLeft !== 1 ? "s" : ""}`}
                      </p>
                      <p className="text-zinc-600 text-xs">{format(sub.currentPeriodEnd, "dd/MM/yyyy")}</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Contas problemáticas */}
      {problemTenants.length > 0 && (
        <div className="rounded-2xl border border-red-900/30 overflow-hidden" style={{ backgroundColor: "#111111" }}>
          <div className="px-5 py-4 border-b border-red-900/30 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <h2 className="text-red-400 font-semibold" style={{ fontFamily: "var(--font-cormorant)", fontSize: "1.1rem" }}>
              Contas Problemáticas
            </h2>
          </div>
          <div className="divide-y divide-zinc-800/40">
            {problemTenants.map((sub) => {
              const style = STATUS_COLORS[sub.status]
              return (
                <div key={sub.id} className="px-5 py-4 flex items-center justify-between hover:bg-zinc-800/20 transition-colors">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-white text-sm font-medium">{sub.tenant.name}</p>
                      {!sub.tenant.isActive && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500">Inativa</span>
                      )}
                    </div>
                    <p className="text-zinc-500 text-xs mt-0.5">{sub.tenant.owner?.email ?? "—"} · /b/{sub.tenant.slug}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: `${PLAN_COLORS[sub.plan]}15`, color: PLAN_COLORS[sub.plan] }}>
                      {PLAN_LABELS[sub.plan]}
                    </span>
                    <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ backgroundColor: style.bg, color: style.text }}>
                      {STATUS_LABELS[sub.status]}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

