import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.tenantId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const { id } = await params

  // Barbers can edit their own schedule; owners can edit any
  const barber = await prisma.barber.findUnique({ where: { id } })
  if (!barber || barber.tenantId !== session.user.tenantId)
    return NextResponse.json({ error: "Não encontrado" }, { status: 404 })

  if (session.user.role === "BARBER") {
    const ownBarber = await prisma.barber.findUnique({ where: { userId: session.user.id } })
    if (ownBarber?.id !== id)
      return NextResponse.json({ error: "Permissão insuficiente" }, { status: 403 })
  }

  const { schedules } = await req.json() as {
    schedules: {
      dayOfWeek: number
      isActive: boolean
      startTime: string
      endTime: string
      breakStart?: string
      breakEnd?: string
    }[]
  }

  await prisma.$transaction(
    schedules.map((s) =>
      prisma.barberSchedule.upsert({
        where: { barberId_dayOfWeek: { barberId: id, dayOfWeek: s.dayOfWeek } },
        create: {
          barberId: id,
          dayOfWeek: s.dayOfWeek,
          isActive: s.isActive,
          startTime: s.startTime,
          endTime: s.endTime,
          breakStart: s.breakStart || null,
          breakEnd: s.breakEnd || null,
        },
        update: {
          isActive: s.isActive,
          startTime: s.startTime,
          endTime: s.endTime,
          breakStart: s.breakStart || null,
          breakEnd: s.breakEnd || null,
        },
      })
    )
  )

  return NextResponse.json({ ok: true })
}
