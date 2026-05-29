export const dynamic = 'force-dynamic'

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { format, startOfDay, endOfDay, addDays, subDays, parseISO, isToday } from "date-fns"
import { ptBR } from "date-fns/locale"
import AgendaClient from "./agenda-client"

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>
}) {
  const session = await auth()
  if (!session?.user?.tenantId) redirect("/onboarding")

  const { date: dateParam } = await searchParams
  const date = dateParam ? parseISO(dateParam) : new Date()
  const dayStart = startOfDay(date)
  const dayEnd = endOfDay(date)

  const tenantId = session.user.tenantId
  const isBarber = session.user.role === "BARBER"

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
        scheduledAt: { gte: dayStart, lte: dayEnd },
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

  const dateStr = format(date, "yyyy-MM-dd")
  const prevDate = format(subDays(date, 1), "yyyy-MM-dd")
  const nextDate = format(addDays(date, 1), "yyyy-MM-dd")
  const dateLabel = isToday(date)
    ? "Hoje"
    : format(date, "EEEE, dd 'de' MMMM", { locale: ptBR })

  return (
    <AgendaClient
      appointments={appointments.map((a) => ({
        ...a,
        scheduledAt: a.scheduledAt.toISOString(),
        endsAt: a.endsAt.toISOString(),
        totalPrice: Number(a.totalPrice),
        services: a.services.map((s) => ({ name: s.service.name })),
        barberName: a.barber.user.name ?? "—",
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

