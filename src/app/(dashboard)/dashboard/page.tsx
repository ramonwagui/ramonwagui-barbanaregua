export const dynamic = 'force-dynamic'

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { format, startOfDay, endOfDay, startOfMonth, addDays } from "date-fns"
import { ptBR } from "date-fns/locale"
import { CalendarDays, DollarSign, Users, Clock } from "lucide-react"
import BarberDashboard from "./barber-dashboard"
import BookingLinkCard from "@/components/booking-link-card"

const STATUS_LABELS: Record<string, string> = {
  CONFIRMED: "Confirmado",
  PENDING: "Pendente",
  IN_PROGRESS: "Em andamento",
  COMPLETED: "Concluído",
  CANCELLED: "Cancelado",
  NO_SHOW: "Não compareceu",
}

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  CONFIRMED: { bg: "#1e3a5f20", text: "#60a5fa" },
  PENDING: { bg: "#78350f20", text: "#fbbf24" },
  IN_PROGRESS: { bg: "#7c2d1220", text: "#fb923c" },
  COMPLETED: { bg: "#14532d20", text: "#4ade80" },
  CANCELLED: { bg: "#7f1d1d20", text: "#f87171" },
  NO_SHOW: { bg: "#27272a30", text: "#71717a" },
}

// ─── BARBER DASHBOARD ─────────────────────────────────────────────────────────

async function BarberDashboardPage({ userId, tenantId, userName }: { userId: string; tenantId: string; userName: string }) {
  const today = new Date()
  const todayStart = startOfDay(today)
  const todayEnd = endOfDay(today)
  const weekStart = startOfDay(addDays(today, 1))
  const weekEnd = endOfDay(addDays(today, 7))

  const barber = await prisma.barber.findUnique({ where: { userId } })
  if (!barber) redirect("/dashboard")

  const [todayAppts, weekAppts] = await Promise.all([
    prisma.appointment.findMany({
      where: { barberId: barber.id, tenantId, scheduledAt: { gte: todayStart, lte: todayEnd } },
      orderBy: { scheduledAt: "asc" },
      include: { services: { include: { service: { select: { name: true } } } } },
    }),
    prisma.appointment.findMany({
      where: {
        barberId: barber.id,
        tenantId,
        scheduledAt: { gte: weekStart, lte: weekEnd },
        status: { notIn: ["CANCELLED", "NO_SHOW"] },
      },
      select: { scheduledAt: true },
    }),
  ])

  // Build next 7 days preview
  const nextDays = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(today, i + 1)
    const dateStr = format(d, "yyyy-MM-dd")
    const count = weekAppts.filter(
      (a) => format(a.scheduledAt, "yyyy-MM-dd") === dateStr
    ).length
    return {
      label: format(d, "EEEE, dd/MM", { locale: ptBR }),
      count,
      dateStr,
    }
  })

  const todayStats = {
    total: todayAppts.filter((a) => !["CANCELLED", "NO_SHOW"].includes(a.status)).length,
    completed: todayAppts.filter((a) => a.status === "COMPLETED").length,
    pending: todayAppts.filter((a) => ["PENDING", "CONFIRMED"].includes(a.status)).length,
  }

  return (
    <BarberDashboard
      barberName={userName}
      todayAppointments={todayAppts.map((a) => ({
        id: a.id,
        guestName: a.guestName,
        guestPhone: a.guestPhone,
        scheduledAt: a.scheduledAt.toISOString(),
        endsAt: a.endsAt.toISOString(),
        totalPrice: Number(a.totalPrice),
        status: a.status as "PENDING" | "CONFIRMED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "NO_SHOW",
        services: a.services.map((s) => ({ name: s.service.name })),
      }))}
      todayStats={todayStats}
      nextDays={nextDays}
      weekTotal={weekAppts.length}
      dateLabel={format(today, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
    />
  )
}

// ─── OWNER DASHBOARD ──────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user?.tenantId) redirect("/onboarding")

  const tenantId = session.user.tenantId

  // Render barber-specific view
  if (session.user.role === "BARBER") {
    return (
      <BarberDashboardPage
        userId={session.user.id}
        tenantId={tenantId}
        userName={session.user.name ?? "Barbeiro"}
      />
    )
  }

  // Owner/admin view
  const today = new Date()
  const todayStart = startOfDay(today)
  const todayEnd = endOfDay(today)
  const monthStart = startOfMonth(today)

  const [tenant, subscription, todayAppointments, monthRevenue, totalClients, upcomingAppointments] =
    await Promise.all([
      prisma.tenant.findUnique({ where: { id: tenantId }, select: { slug: true } }),
      prisma.subscription.findUnique({ where: { tenantId }, select: { plan: true, status: true, currentPeriodEnd: true, trialEndsAt: true } }),
      prisma.appointment.count({
        where: {
          tenantId,
          scheduledAt: { gte: todayStart, lte: todayEnd },
          status: { notIn: ["CANCELLED", "NO_SHOW"] },
        },
      }),
      prisma.appointment.aggregate({
        where: { tenantId, status: "COMPLETED", scheduledAt: { gte: monthStart } },
        _sum: { totalPrice: true },
      }),
      prisma.appointment
        .groupBy({
          by: ["guestPhone"],
          where: { tenantId, guestPhone: { not: null } },
          _count: true,
        })
        .then((r: unknown[]) => r.length),
      prisma.appointment.findMany({
        where: {
          tenantId,
          scheduledAt: { gte: today },
          status: { in: ["CONFIRMED", "PENDING"] },
        },
        orderBy: { scheduledAt: "asc" },
        take: 10,
        include: {
          barber: { include: { user: { select: { name: true } } } },
          services: { include: { service: { select: { name: true } } } },
        },
      }),
    ])

  const monthRevenueValue = Number(monthRevenue._sum.totalPrice ?? 0)

  // Calcular alerta de assinatura
  const subAlert = (() => {
    if (!subscription) return null
    if (subscription.status === "CANCELLED") {
      return { type: "error", msg: "Sua assinatura foi cancelada. Entre em contato com o suporte." }
    }
    if (subscription.status === "PAST_DUE") {
      return { type: "error", msg: "Sua assinatura está vencida. Entre em contato para regularizar." }
    }
    if (subscription.status === "TRIALING" && subscription.trialEndsAt) {
      const daysLeft = Math.ceil((subscription.trialEndsAt.getTime() - today.getTime()) / 86400000)
      if (daysLeft <= 7) {
        return { type: "warning", msg: `Seu período de trial termina em ${daysLeft} dia${daysLeft !== 1 ? "s" : ""}. Contrate um plano para continuar.` }
      }
    }
    return null
  })()

  const KPI_CARDS = [
    { label: "Agendamentos hoje", value: todayAppointments.toString(), icon: CalendarDays, color: "#60a5fa" },
    { label: "Receita do mês", value: `R$ ${monthRevenueValue.toFixed(2).replace(".", ",")}`, icon: DollarSign, color: "#4ade80" },
    { label: "Clientes únicos", value: totalClients.toString(), icon: Users, color: "#c084fc" },
    { label: "Próximos horários", value: upcomingAppointments.length.toString(), icon: Clock, color: "#f59e0b" },
  ]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1
            className="text-white leading-tight"
            style={{ fontFamily: "var(--font-cormorant)", fontSize: "2rem", fontWeight: 700 }}
          >
            Bom dia, {session.user.name?.split(" ")[0] ?? "chefe"}.
          </h1>
          <p className="text-zinc-600 text-sm mt-1 capitalize">
            {format(today, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-full px-3 py-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-amber-400 text-xs font-semibold">Ao vivo</span>
        </div>
      </div>

      {/* Subscription alert */}
      {subAlert && (
        <div
          className="rounded-xl px-5 py-3.5 flex items-center gap-3"
          style={{
            backgroundColor: subAlert.type === "error" ? "#7f1d1d20" : "#78350f20",
            border: `1px solid ${subAlert.type === "error" ? "#7f1d1d60" : "#78350f60"}`,
          }}
        >
          <span className="text-lg">{subAlert.type === "error" ? "🚨" : "⚠️"}</span>
          <p className="text-sm" style={{ color: subAlert.type === "error" ? "#f87171" : "#fbbf24" }}>
            {subAlert.msg}
          </p>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {KPI_CARDS.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-zinc-800/60 p-5 flex flex-col gap-4"
            style={{ backgroundColor: "#111111" }}
          >
            <div className="flex items-center justify-between">
              <p className="text-zinc-500 text-xs font-semibold uppercase tracking-widest">{card.label}</p>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${card.color}15` }}>
                <card.icon className="w-4 h-4" style={{ color: card.color }} />
              </div>
            </div>
            <p
              className="text-white font-bold"
              style={{ fontFamily: "var(--font-cormorant)", fontSize: "1.9rem", lineHeight: 1 }}
            >
              {card.value}
            </p>
          </div>
        ))}
      </div>

      {/* Booking link */}
      {tenant?.slug && <BookingLinkCard slug={tenant.slug} />}

      {/* Upcoming appointments */}
      <div className="rounded-2xl border border-zinc-800/60 overflow-hidden" style={{ backgroundColor: "#111111" }}>
        <div className="px-6 py-5 border-b border-zinc-800/60 flex items-center justify-between">
          <h2
            className="text-white font-semibold"
            style={{ fontFamily: "var(--font-cormorant)", fontSize: "1.15rem" }}
          >
            Próximos Agendamentos
          </h2>
          {upcomingAppointments.length > 0 && (
            <span className="text-zinc-600 text-xs">
              {upcomingAppointments.length} agendamento{upcomingAppointments.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {upcomingAppointments.length === 0 ? (
          <div className="py-16 text-center">
            <CalendarDays className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
            <p className="text-zinc-600 text-sm">Nenhum agendamento futuro</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800/40">
            {upcomingAppointments.map((appt) => {
              const style = STATUS_STYLES[appt.status] ?? STATUS_STYLES.PENDING
              return (
                <div key={appt.id} className="px-6 py-4 flex items-center justify-between hover:bg-zinc-800/20 transition-colors">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0">
                      <span className="text-zinc-400 text-xs font-bold">
                        {format(appt.scheduledAt, "HH:mm")}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-white text-sm font-medium truncate">{appt.guestName ?? "Cliente"}</p>
                      <p className="text-zinc-500 text-xs truncate mt-0.5">
                        {appt.services.map((s: { service: { name: string } }) => s.service.name).join(", ")} · {appt.barber.user.name}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0 ml-4">
                    <div className="text-right hidden sm:block">
                      <p className="text-zinc-300 text-sm font-medium">{format(appt.scheduledAt, "dd/MM")}</p>
                      <p className="text-zinc-600 text-xs">R$ {Number(appt.totalPrice).toFixed(2).replace(".", ",")}</p>
                    </div>
                    <span
                      className="text-xs px-2.5 py-1 rounded-full font-medium whitespace-nowrap"
                      style={{ backgroundColor: style.bg, color: style.text }}
                    >
                      {STATUS_LABELS[appt.status]}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

