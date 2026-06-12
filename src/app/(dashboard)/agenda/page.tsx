export const dynamic = 'force-dynamic'

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import {
  fmtWeekdayShort,
  dayKey,
  addDays,
  startOfDayInTz,
  startOfNextDayInTz,
  DEFAULT_TZ,
} from "@/lib/timezone"
import AgendaClient from "./agenda-client"

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>
}) {
  const session = await auth()
  if (!session?.user?.tenantId) redirect("/onboarding")

  const tenantId = session.user.tenantId
  const isBarber = session.user.role === "BARBER"

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { timezone: true },
  })
  const tzName = tenant?.timezone ?? DEFAULT_TZ

  const { date: dateParam } = await searchParams
  // Ancorar ao meio-dia UTC mantém o dia-calendário correto em fusos BR.
  const date = dateParam ? new Date(`${dateParam}T12:00:00Z`) : new Date()
  const dayStart = startOfDayInTz(date, tzName)
  const dayEnd = startOfNextDayInTz(date, tzName)

  // Se for barbeiro, buscar o seu próprio registro para filtrar os agendamentos
  let barberIdFilter: string | undefined
  if (isBarber) {
    const barberRecord = await prisma.barber.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    })
    if (!barberRecord) redirect("/dashboard")
    barberIdFilter = barberRecord.id
  }

  const [appointments, barbers] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        tenantId,
        scheduledAt: { gte: dayStart, lt: dayEnd },
        ...(barberIdFilter ? { barberId: barberIdFilter } : {}),
      },
      orderBy: { scheduledAt: "asc" },
      include: {
        barber: { include: { user: { select: { name: true } } } },
        services: { include: { service: { select: { name: true } } } },
      },
    }),
    isBarber
      ? Promise.resolve([])
      : prisma.barber.findMany({
          where: { tenantId, isActive: true },
          include: { user: { select: { name: true } } },
        }),
  ])

  const dateStr = dayKey(date, tzName)
  const prevDate = dayKey(addDays(date, -1), tzName)
  const nextDate = dayKey(addDays(date, 1), tzName)
  const dateLabel =
    dateStr === dayKey(new Date(), tzName) ? "Hoje" : fmtWeekdayShort(date, tzName)

  return (
    <AgendaClient
      appointments={appointments.map((a) => ({
        ...a,
        scheduledAt: a.scheduledAt.toISOString(),
        endsAt: a.endsAt.toISOString(),
        totalPrice: Number(a.totalPrice),
        depositAmount: a.depositAmount ? Number(a.depositAmount) : null,
        services: a.services.map((s) => ({ name: s.service.name })),
        barberName: a.barber.user.name ?? "—",
        clientConfirmed: !!a.clientConfirmedAt,
      }))}
      barbers={barbers.map((b) => ({ id: b.id, name: b.user.name ?? "—" }))}
      dateLabel={dateLabel}
      dateStr={dateStr}
      prevDate={prevDate}
      nextDate={nextDate}
      isBarber={isBarber}
    />
  )
}

