export const dynamic = 'force-dynamic'

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { format, startOfMonth, endOfMonth, startOfDay, subMonths } from "date-fns"
import { ptBR } from "date-fns/locale"
import { DollarSign, TrendingUp, CheckCircle2, XCircle } from "lucide-react"

export default async function FinanceiroPage() {
  const session = await auth()
  if (!session?.user?.tenantId) redirect("/onboarding")
  if (session.user.role === "BARBER") redirect("/dashboard")

  const tenantId = session.user.tenantId
  const now = new Date()
  const monthStart = startOfMonth(now)
  const monthEnd = endOfMonth(now)
  const lastMonthStart = startOfMonth(subMonths(now, 1))
  const lastMonthEnd = endOfMonth(subMonths(now, 1))

  const [currentMonth, lastMonth, byBarber, recent] = await Promise.all([
    prisma.appointment.aggregate({
      where: {
        tenantId,
        status: "COMPLETED",
        scheduledAt: { gte: monthStart, lte: monthEnd },
      },
      _sum: { totalPrice: true },
      _count: true,
    }),
    prisma.appointment.aggregate({
      where: {
        tenantId,
        status: "COMPLETED",
        scheduledAt: { gte: lastMonthStart, lte: lastMonthEnd },
      },
      _sum: { totalPrice: true },
      _count: true,
    }),
    prisma.appointment.groupBy({
      by: ["barberId"],
      where: {
        tenantId,
        status: "COMPLETED",
        scheduledAt: { gte: monthStart, lte: monthEnd },
      },
      _sum: { totalPrice: true },
      _count: true,
    }),
    prisma.appointment.findMany({
      where: {
        tenantId,
        status: "COMPLETED",
        scheduledAt: { gte: monthStart },
      },
      orderBy: { scheduledAt: "desc" },
      take: 20,
      include: {
        barber: { include: { user: { select: { name: true } } } },
        services: { include: { service: { select: { name: true } } } },
      },
    }),
  ])

  // Barber name lookup
  const barberIds = byBarber.map((b) => b.barberId)
  const barbersData = await prisma.barber.findMany({
    where: { id: { in: barberIds } },
    include: { user: { select: { name: true } } },
  })
  const barberMap = Object.fromEntries(barbersData.map((b) => [b.id, b.user.name ?? "—"]))

  const currentRevenue = Number(currentMonth._sum.totalPrice ?? 0)
  const lastRevenue = Number(lastMonth._sum.totalPrice ?? 0)
  const growthPct = lastRevenue > 0
    ? (((currentRevenue - lastRevenue) / lastRevenue) * 100).toFixed(1)
    : null
  const avgTicket = currentMonth._count > 0
    ? (currentRevenue / currentMonth._count).toFixed(2)
    : "0,00"

  return (
    <div className="space-y-6">
      <div>
        <h1
          className="text-white font-bold"
          style={{ fontFamily: "var(--font-cormorant)", fontSize: "2rem" }}
        >
          Financeiro
        </h1>
        <p className="text-zinc-500 text-sm mt-0.5 capitalize">
          {format(now, "MMMM 'de' yyyy", { locale: ptBR })}
        </p>
      </div>

      {/* KPIs */}
      <div className="grid sm:grid-cols-3 gap-4">
        {[
          {
            label: "Receita do mês",
            value: `R$ ${currentRevenue.toFixed(2).replace(".", ",")}`,
            icon: DollarSign,
            color: "#4ade80",
            sub: growthPct
              ? `${Number(growthPct) >= 0 ? "+" : ""}${growthPct}% vs mês anterior`
              : "Primeiro mês",
          },
          {
            label: "Atendimentos",
            value: currentMonth._count.toString(),
            icon: CheckCircle2,
            color: "#60a5fa",
            sub: `${lastMonth._count} no mês anterior`,
          },
          {
            label: "Ticket médio",
            value: `R$ ${avgTicket.replace(".", ",")}`,
            icon: TrendingUp,
            color: "#f59e0b",
            sub: "Por atendimento concluído",
          },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-2xl border border-zinc-800/60 p-5"
            style={{ backgroundColor: "#111111" }}
          >
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">{kpi.label}</p>
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: `${kpi.color}15` }}
              >
                <kpi.icon className="w-4 h-4" style={{ color: kpi.color }} />
              </div>
            </div>
            <p
              className="text-white font-bold mb-1"
              style={{ fontFamily: "var(--font-cormorant)", fontSize: "1.8rem", lineHeight: 1 }}
            >
              {kpi.value}
            </p>
            <p className="text-zinc-600 text-xs">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* By barber */}
      {byBarber.length > 0 && (
        <div
          className="rounded-2xl border border-zinc-800/60 overflow-hidden"
          style={{ backgroundColor: "#111111" }}
        >
          <div className="px-5 py-4 border-b border-zinc-800/60">
            <h2
              className="text-white font-semibold"
              style={{ fontFamily: "var(--font-cormorant)", fontSize: "1.1rem" }}
            >
              Por barbeiro — {format(now, "MMMM", { locale: ptBR })}
            </h2>
          </div>
          <div className="divide-y divide-zinc-800/40">
            {byBarber
              .sort((a, b) => Number(b._sum.totalPrice ?? 0) - Number(a._sum.totalPrice ?? 0))
              .map((row) => {
                const revenue = Number(row._sum.totalPrice ?? 0)
                const share = currentRevenue > 0 ? (revenue / currentRevenue) * 100 : 0
                return (
                  <div key={row.barberId} className="px-5 py-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-white text-sm font-medium">{barberMap[row.barberId]}</p>
                      <div className="text-right">
                        <p className="text-amber-400 font-bold" style={{ fontFamily: "var(--font-cormorant)", fontSize: "1.05rem" }}>
                          R$ {revenue.toFixed(2).replace(".", ",")}
                        </p>
                        <p className="text-zinc-600 text-xs">{row._count} atend.</p>
                      </div>
                    </div>
                    <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-500 rounded-full transition-all"
                        style={{ width: `${share}%` }}
                      />
                    </div>
                    <p className="text-zinc-600 text-xs mt-1">{share.toFixed(1)}% da receita</p>
                  </div>
                )
              })}
          </div>
        </div>
      )}

      {/* Recent completed */}
      <div
        className="rounded-2xl border border-zinc-800/60 overflow-hidden"
        style={{ backgroundColor: "#111111" }}
      >
        <div className="px-5 py-4 border-b border-zinc-800/60">
          <h2
            className="text-white font-semibold"
            style={{ fontFamily: "var(--font-cormorant)", fontSize: "1.1rem" }}
          >
            Atendimentos concluídos
          </h2>
        </div>

        {recent.length === 0 ? (
          <div className="py-12 text-center">
            <XCircle className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
            <p className="text-zinc-600 text-sm">Nenhum atendimento concluído este mês</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800/40">
            {recent.map((appt) => (
              <div key={appt.id} className="px-5 py-3.5 flex items-center justify-between hover:bg-zinc-800/20 transition-colors">
                <div>
                  <p className="text-white text-sm font-medium">{appt.guestName ?? "Cliente"}</p>
                  <p className="text-zinc-500 text-xs mt-0.5">
                    {appt.services.map((s: { service: { name: string } }) => s.service.name).join(", ")} · {appt.barber.user.name}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-amber-400 font-bold" style={{ fontFamily: "var(--font-cormorant)", fontSize: "1.05rem" }}>
                    R$ {Number(appt.totalPrice).toFixed(2).replace(".", ",")}
                  </p>
                  <p className="text-zinc-600 text-xs">
                    {format(appt.scheduledAt, "dd/MM HH:mm")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

