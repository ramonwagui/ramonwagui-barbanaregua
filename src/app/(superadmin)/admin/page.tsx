export const dynamic = 'force-dynamic'

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { format, startOfMonth } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Store, Users, CheckCircle2, XCircle } from "lucide-react"
import AdminTenantsClient from "./tenants-client"

export default async function AdminPage() {
  const session = await auth()
  if (session?.user?.role !== "SUPER_ADMIN") redirect("/login")

  const monthStart = startOfMonth(new Date())

  const [tenants, totalUsers, monthAppointments, config] = await Promise.all([
    prisma.tenant.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        owner: { select: { name: true, email: true } },
        subscription: { select: { plan: true, status: true, currentPeriodEnd: true } },
        _count: {
          select: {
            barbers: true,
            appointments: true,
          },
        },
      },
    }),
    prisma.user.count({ where: { role: { in: ["TENANT_OWNER", "BARBER"] } } }),
    prisma.appointment.count({
      where: { scheduledAt: { gte: monthStart }, status: "COMPLETED" },
    }),
    prisma.globalConfig.findUnique({
      where: { id: "singleton" },
      select: { planPriceBasic: true, planPricePro: true, planPricePremium: true },
    }),
  ])

  // Preços (em centavos) exibidos no modal de plano — DB tem prioridade sobre o padrão.
  const planPrices = {
    BASIC: config?.planPriceBasic ?? 9900,
    PRO: config?.planPricePro ?? 19900,
    PREMIUM: config?.planPricePremium ?? 39900,
  }

  const active = tenants.filter((t) => t.isActive).length
  const inactive = tenants.length - active

  const STATS = [
    { label: "Barbearias cadastradas", value: tenants.length, icon: Store, color: "#60a5fa" },
    { label: "Ativas", value: active, icon: CheckCircle2, color: "#4ade80" },
    { label: "Inativas", value: inactive, icon: XCircle, color: "#f87171" },
    { label: "Usuários no sistema", value: totalUsers, icon: Users, color: "#c084fc" },
  ]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1
          className="text-white leading-tight"
          style={{ fontFamily: "var(--font-cormorant)", fontSize: "2rem", fontWeight: 700 }}
        >
          Painel Administrativo
        </h1>
        <p className="text-zinc-600 text-sm mt-1 capitalize">
          {format(new Date(), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {STATS.map((s) => (
          <div
            key={s.label}
            className="rounded-2xl border border-zinc-800/60 p-5 flex flex-col gap-4"
            style={{ backgroundColor: "#111111" }}
          >
            <div className="flex items-center justify-between">
              <p className="text-zinc-500 text-xs font-semibold uppercase tracking-widest">
                {s.label}
              </p>
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${s.color}15` }}
              >
                <s.icon className="w-4 h-4" style={{ color: s.color }} />
              </div>
            </div>
            <p
              className="text-white font-bold"
              style={{ fontFamily: "var(--font-cormorant)", fontSize: "2rem", lineHeight: 1 }}
            >
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {/* Tenant table */}
      <AdminTenantsClient
        planPrices={planPrices}
        tenants={tenants.map((t) => ({
          id: t.id,
          name: t.name,
          slug: t.slug,
          isActive: t.isActive,
          createdAt: t.createdAt.toISOString(),
          primaryColor: t.primaryColor,
          ownerName: t.owner?.name ?? null,
          ownerEmail: t.owner?.email ?? null,
          plan: t.subscription?.plan ?? null,
          subscriptionStatus: t.subscription?.status ?? null,
          periodEnd: t.subscription?.currentPeriodEnd?.toISOString() ?? null,
          barberCount: t._count.barbers,
          appointmentCount: t._count.appointments,
        }))}
      />
    </div>
  )
}

