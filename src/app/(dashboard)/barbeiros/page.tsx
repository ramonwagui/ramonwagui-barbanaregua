export const dynamic = 'force-dynamic'

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { startOfDayInTz, startOfNextDayInTz, DEFAULT_TZ } from "@/lib/timezone"
import BarbeirosClient from "./barbeiros-client"

export default async function BarbeirosPage() {
  const session = await auth()
  if (!session?.user?.tenantId) redirect("/onboarding")

  const tenantId = session.user.tenantId
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { timezone: true },
  })
  const tzName = tenant?.timezone ?? DEFAULT_TZ
  const now = new Date()
  const todayStart = startOfDayInTz(now, tzName)
  const todayEnd = startOfNextDayInTz(now, tzName)

  const barbers = await prisma.barber.findMany({
    where: { tenantId },
    include: {
      user: { select: { name: true, email: true, phone: true } },
      workSchedules: { orderBy: { dayOfWeek: "asc" } },
      _count: {
        select: {
          appointments: {
            where: {
              scheduledAt: { gte: todayStart, lt: todayEnd },
              status: { notIn: ["CANCELLED", "NO_SHOW"] },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  })

  return (
    <BarbeirosClient
      barbers={barbers.map((b) => ({
        id: b.id,
        isActive: b.isActive,
        bio: b.bio ?? "",
        avatarUrl: b.avatarUrl ?? null,
        todayCount: b._count.appointments,
        user: { name: b.user.name ?? "—", email: b.user.email ?? "—", phone: b.user.phone ?? null },
        workSchedules: b.workSchedules.map((s) => ({
          dayOfWeek: s.dayOfWeek,
          startTime: s.startTime,
          endTime: s.endTime,
          isActive: s.isActive,
        })),
      }))}
      isOwner={session.user.role !== "BARBER"}
    />
  )
}

