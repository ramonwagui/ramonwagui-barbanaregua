export const dynamic = "force-dynamic"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import Link from "next/link"
import { DollarSign, CheckCircle2, TrendingUp, UserX, Repeat } from "lucide-react"
import { startOfMonthInTz, startOfDayInTz, startOfNextDayInTz, DEFAULT_TZ } from "@/lib/timezone"
import { getTenantById } from "@/lib/tenant"
import { getPlanLimits } from "@/lib/plans"

const RANGES = [
  { key: "this_month", label: "Este mês" },
  { key: "last_month", label: "Mês passado" },
  { key: "7d", label: "7 dias" },
  { key: "30d", label: "30 dias" },
] as const

function getPeriod(range: string, now: Date, tz: string): { start: Date; end: Date } {
  if (range === "last_month") {
    const ms = startOfMonthInTz(now, tz)
    return { start: startOfMonthInTz(new Date(ms.getTime() - 86400000), tz), end: ms }
  }
  if (range === "7d")
    return { start: startOfDayInTz(new Date(now.getTime() - 6 * 86400000), tz), end: startOfNextDayInTz(now, tz) }
  if (range === "30d")
    return { start: startOfDayInTz(new Date(now.getTime() - 29 * 86400000), tz), end: startOfNextDayInTz(now, tz) }
  return { start: startOfMonthInTz(now, tz), end: startOfNextDayInTz(now, tz) } // this_month (até hoje)
}

function hourInTz(d: Date, tz: string): number {
  return parseInt(
    new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", hour12: false }).format(d),
    10
  )
}
const WD_MAP: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
const WD_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]
function weekdayInTz(d: Date, tz: string): number {
  return WD_MAP[new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(d)] ?? 0
}
const money = (n: number) => `R$ ${n.toFixed(2).replace(".", ",")}`

export default async function RelatoriosPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>
}) {
  const session = await auth()
  if (!session?.user?.tenantId) redirect("/onboarding")
  if (session.user.role === "BARBER") redirect("/dashboard")

  const tenantId = session.user.tenantId
  const { range = "this_month" } = await searchParams
  const tenant = await getTenantById(tenantId)
  const tzName = tenant.timezone ?? DEFAULT_TZ
  const limits = getPlanLimits(tenant)
  const maxHistoryDays = limits.analyticsHistoryDays

  const now = new Date()

  // Cortar o período pelo limite do plano (ex: Basic = 30 dias)
  function cappedPeriod(range: string): { start: Date; end: Date } {
    const period = getPeriod(range, now, tzName)
    if (maxHistoryDays === null) return period
    const earliest = new Date(now.getTime() - maxHistoryDays * 86400000)
    return { start: period.start < earliest ? earliest : period.start, end: period.end }
  }

  const { start, end } = cappedPeriod(range)
  const inPeriod = { gte: start, lt: end }

  const [
    completed,
    totalCount,
    noShowCount,
    cancelledCount,
    byBarber,
    byService,
    activeAppts,
    peakAppts,
  ] = await Promise.all([
    prisma.appointment.aggregate({
      where: { tenantId, status: "COMPLETED", scheduledAt: inPeriod },
      _sum: { totalPrice: true },
      _count: true,
    }),
    prisma.appointment.count({ where: { tenantId, scheduledAt: inPeriod } }),
    prisma.appointment.count({ where: { tenantId, status: "NO_SHOW", scheduledAt: inPeriod } }),
    prisma.appointment.count({ where: { tenantId, status: "CANCELLED", scheduledAt: inPeriod } }),
    prisma.appointment.groupBy({
      by: ["barberId"],
      where: { tenantId, status: "COMPLETED", scheduledAt: inPeriod },
      _sum: { totalPrice: true },
      _count: true,
    }),
    prisma.appointmentService.groupBy({
      by: ["serviceId"],
      where: { appointment: { tenantId, status: "COMPLETED", scheduledAt: inPeriod } },
      _sum: { price: true },
      _count: true,
    }),
    prisma.appointment.findMany({
      where: {
        tenantId,
        guestPhone: { not: null },
        status: { notIn: ["CANCELLED", "NO_SHOW"] },
        scheduledAt: inPeriod,
      },
      select: { guestPhone: true },
    }),
    prisma.appointment.findMany({
      where: { tenantId, status: { notIn: ["CANCELLED", "NO_SHOW"] }, scheduledAt: inPeriod },
      select: { scheduledAt: true },
    }),
  ])

  const revenue = Number(completed._sum.totalPrice ?? 0)
  const avgTicket = completed._count > 0 ? revenue / completed._count : 0
  const noShowRate = totalCount > 0 ? (noShowCount / totalCount) * 100 : 0
  const cancelRate = totalCount > 0 ? (cancelledCount / totalCount) * 100 : 0

  // Nomes + comissão dos barbeiros
  const barberIds = byBarber.map((b) => b.barberId)
  const barbersData = await prisma.barber.findMany({
    where: { id: { in: barberIds } },
    select: { id: true, commissionPercent: true, user: { select: { name: true } } },
  })
  const barberMap = Object.fromEntries(
    barbersData.map((b) => [b.id, { name: b.user.name ?? "—", commission: b.commissionPercent }])
  )
  const barberRows = byBarber
    .map((r) => {
      const info = barberMap[r.barberId]
      const rev = Number(r._sum.totalPrice ?? 0)
      return {
        id: r.barberId,
        name: info?.name ?? "—",
        revenue: rev,
        count: r._count,
        commissionPct: info?.commission ?? 0,
        commissionValue: (rev * (info?.commission ?? 0)) / 100,
      }
    })
    .sort((a, b) => b.revenue - a.revenue)
  const totalCommission = barberRows.reduce((s, r) => s + r.commissionValue, 0)

  // Nomes dos serviços
  const serviceIds = byService.map((s) => s.serviceId)
  const servicesData = await prisma.service.findMany({
    where: { id: { in: serviceIds } },
    select: { id: true, name: true },
  })
  const serviceNameMap = Object.fromEntries(servicesData.map((s) => [s.id, s.name]))
  const serviceRows = byService
    .map((r) => ({
      id: r.serviceId,
      name: serviceNameMap[r.serviceId] ?? "—",
      revenue: Number(r._sum.price ?? 0),
      count: r._count,
    }))
    .sort((a, b) => b.revenue - a.revenue)
  const serviceMax = Math.max(1, ...serviceRows.map((r) => r.revenue))

  // Novos vs recorrentes
  const activePhones = Array.from(new Set(activeAppts.map((a) => a.guestPhone!).filter(Boolean)))
  let novos = 0
  let recorrentes = 0
  if (activePhones.length) {
    const firstVisits = await prisma.appointment.groupBy({
      by: ["guestPhone"],
      where: { tenantId, guestPhone: { in: activePhones }, status: { notIn: ["CANCELLED", "NO_SHOW"] } },
      _min: { scheduledAt: true },
    })
    for (const fv of firstVisits) {
      const first = fv._min.scheduledAt
      if (first && first >= start) novos++
      else recorrentes++
    }
  }
  const totalClients = novos + recorrentes

  // Picos por hora e dia da semana
  const byHour = new Array(24).fill(0)
  const byWeekday = new Array(7).fill(0)
  for (const a of peakAppts) {
    byHour[hourInTz(a.scheduledAt, tzName)]++
    byWeekday[weekdayInTz(a.scheduledAt, tzName)]++
  }
  const hoursWithData = byHour
    .map((count, hour) => ({ hour, count }))
    .filter((h) => h.count > 0)
  const hourMax = Math.max(1, ...byHour)
  const weekdayMax = Math.max(1, ...byWeekday)

  const KPIS = [
    { label: "Faturamento", value: money(revenue), icon: DollarSign, color: "#4ade80" },
    { label: "Atendimentos", value: String(completed._count), icon: CheckCircle2, color: "#60a5fa" },
    { label: "Ticket médio", value: money(avgTicket), icon: TrendingUp, color: "#f59e0b" },
    { label: "No-show", value: `${noShowRate.toFixed(0)}%`, icon: UserX, color: "#f87171", sub: `${noShowCount} faltas` },
    { label: "Cancelamentos", value: `${cancelRate.toFixed(0)}%`, icon: UserX, color: "#fb923c", sub: `${cancelledCount} no período` },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-white font-bold" style={{ fontFamily: "var(--font-cormorant)", fontSize: "2rem" }}>
            Relatórios
          </h1>
          <p className="text-zinc-500 text-sm mt-0.5">Visão do seu negócio no período.</p>
        </div>
        {/* Seletor de período */}
        <div className="flex gap-1.5 flex-wrap">
          {RANGES.map((r) => {
            const active = r.key === range || (!RANGES.some((x) => x.key === range) && r.key === "this_month")
            return (
              <Link
                key={r.key}
                href={`/relatorios?range=${r.key}`}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-all"
                style={{
                  backgroundColor: active ? "#f59e0b" : "transparent",
                  color: active ? "#000" : "#a1a1aa",
                  borderColor: active ? "#f59e0b" : "#3f3f46",
                }}
              >
                {r.label}
              </Link>
            )
          })}
        </div>
      </div>

      {/* Aviso de limite do plano */}
      {maxHistoryDays !== null && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-amber-300 text-sm">
          Seu plano exibe até <strong>{maxHistoryDays} dias</strong> de histórico.{" "}
          <Link href="/assinatura" className="underline underline-offset-4 hover:text-amber-200">
            Faça upgrade
          </Link>{" "}
          para relatórios completos.
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {KPIS.map((k) => (
          <div key={k.label} className="rounded-2xl border border-zinc-800/60 p-4" style={{ backgroundColor: "#111111" }}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">{k.label}</p>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${k.color}15` }}>
                <k.icon className="w-3.5 h-3.5" style={{ color: k.color }} />
              </div>
            </div>
            <p className="text-white font-bold" style={{ fontFamily: "var(--font-cormorant)", fontSize: "1.5rem", lineHeight: 1 }}>
              {k.value}
            </p>
            {k.sub && <p className="text-zinc-600 text-[11px] mt-1">{k.sub}</p>}
          </div>
        ))}
      </div>

      {/* Por barbeiro + comissão */}
      <Section title="Por barbeiro (receita e comissão)">
        {barberRows.length === 0 ? (
          <Empty text="Nenhum atendimento concluído no período" />
        ) : (
          <div className="divide-y divide-zinc-800/40">
            {barberRows.map((b) => (
              <div key={b.id} className="px-5 py-3.5 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-white text-sm font-medium truncate">{b.name}</p>
                  <p className="text-zinc-600 text-xs mt-0.5">{b.count} atend. · comissão {b.commissionPct}%</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-amber-400 font-bold" style={{ fontFamily: "var(--font-cormorant)", fontSize: "1.05rem" }}>
                    {money(b.revenue)}
                  </p>
                  <p className="text-emerald-400 text-xs mt-0.5">comissão: {money(b.commissionValue)}</p>
                </div>
              </div>
            ))}
            <div className="px-5 py-3 flex items-center justify-between bg-zinc-800/20">
              <p className="text-zinc-400 text-xs uppercase tracking-widest font-semibold">Total a pagar (comissão)</p>
              <p className="text-emerald-400 font-bold">{money(totalCommission)}</p>
            </div>
          </div>
        )}
      </Section>

      {/* Por serviço */}
      <Section title="Receita por serviço">
        {serviceRows.length === 0 ? (
          <Empty text="Sem dados no período" />
        ) : (
          <div className="px-5 py-4 space-y-3">
            {serviceRows.map((s) => (
              <div key={s.id}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-white text-sm">{s.name}</p>
                  <p className="text-zinc-400 text-sm">{money(s.revenue)} <span className="text-zinc-600 text-xs">· {s.count}x</span></p>
                </div>
                <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500 rounded-full" style={{ width: `${(s.revenue / serviceMax) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Novos vs recorrentes */}
      <Section title="Clientes (novos vs recorrentes)">
        <div className="px-5 py-5">
          <div className="flex gap-6 mb-3">
            <div className="flex items-center gap-2">
              <Repeat className="w-4 h-4 text-emerald-400" />
              <div>
                <p className="text-white font-bold text-lg leading-none">{recorrentes}</p>
                <p className="text-zinc-600 text-xs">recorrentes</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Repeat className="w-4 h-4 text-amber-400" />
              <div>
                <p className="text-white font-bold text-lg leading-none">{novos}</p>
                <p className="text-zinc-600 text-xs">novos</p>
              </div>
            </div>
          </div>
          {totalClients > 0 && (
            <div className="h-2 bg-zinc-800 rounded-full overflow-hidden flex">
              <div className="h-full bg-emerald-500" style={{ width: `${(recorrentes / totalClients) * 100}%` }} />
              <div className="h-full bg-amber-500" style={{ width: `${(novos / totalClients) * 100}%` }} />
            </div>
          )}
          <p className="text-zinc-600 text-xs mt-2">
            {totalClients} cliente{totalClients !== 1 ? "s" : ""} no período ·{" "}
            {totalClients > 0 ? `${((recorrentes / totalClients) * 100).toFixed(0)}% de retorno` : "—"}
          </p>
        </div>
      </Section>

      {/* Picos */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Section title="Horários de pico">
          {hoursWithData.length === 0 ? (
            <Empty text="Sem dados no período" />
          ) : (
            <div className="px-5 py-4 space-y-2">
              {hoursWithData.map((h) => (
                <div key={h.hour} className="flex items-center gap-3">
                  <span className="text-zinc-500 text-xs w-10 shrink-0">{String(h.hour).padStart(2, "0")}h</span>
                  <div className="flex-1 h-3 bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-500 rounded-full" style={{ width: `${(h.count / hourMax) * 100}%` }} />
                  </div>
                  <span className="text-zinc-400 text-xs w-6 text-right shrink-0">{h.count}</span>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title="Dias da semana">
          <div className="px-5 py-4 space-y-2">
            {WD_LABELS.map((label, i) => (
              <div key={label} className="flex items-center gap-3">
                <span className="text-zinc-500 text-xs w-8 shrink-0">{label}</span>
                <div className="flex-1 h-3 bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500 rounded-full" style={{ width: `${(byWeekday[i] / weekdayMax) * 100}%` }} />
                </div>
                <span className="text-zinc-400 text-xs w-6 text-right shrink-0">{byWeekday[i]}</span>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-zinc-800/60 overflow-hidden" style={{ backgroundColor: "#111111" }}>
      <div className="px-5 py-4 border-b border-zinc-800/60">
        <h2 className="text-white font-semibold" style={{ fontFamily: "var(--font-cormorant)", fontSize: "1.1rem" }}>
          {title}
        </h2>
      </div>
      {children}
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <div className="py-10 text-center text-zinc-600 text-sm">{text}</div>
}
