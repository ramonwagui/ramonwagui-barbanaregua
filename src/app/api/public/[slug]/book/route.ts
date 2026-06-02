import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getTenantBySlug, canAcceptBookings, TenantNotFoundError } from "@/lib/tenant"
import { createAppointmentSchema } from "@/lib/validations/appointment"
import { sendBookingConfirmation } from "@/lib/notifications"
import { isSlotAvailable } from "@/lib/availability"
import { checkRateLimit, getClientIp } from "@/lib/rate-limit"
import { addMinutes } from "date-fns"
import { Prisma, Service } from "@prisma/client"
import { ZodError } from "zod"

export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { success } = await checkRateLimit("book", getClientIp(req))
    if (!success) {
      return NextResponse.json(
        { error: "Muitas tentativas. Aguarde um momento e tente novamente." },
        { status: 429 }
      )
    }

    const { slug } = await params
    const body = await req.json()
    const data = createAppointmentSchema.parse(body)

    const tenant = await getTenantBySlug(slug)

    if (!canAcceptBookings(tenant)) {
      return NextResponse.json(
        { error: "Esta barbearia não está aceitando agendamentos no momento." },
        { status: 403 }
      )
    }

    const services: Service[] = await prisma.service.findMany({
      where: {
        id: { in: data.serviceIds },
        tenantId: tenant.id,
        isActive: true,
      },
    })

    if (services.length !== data.serviceIds.length) {
      return NextResponse.json({ error: "Serviços inválidos" }, { status: 400 })
    }

    const totalDuration = services.reduce((sum, s) => sum + s.durationMinutes, 0)
    const totalPrice = services.reduce(
      (sum, s) => sum.plus(s.price),
      new Prisma.Decimal(0)
    )
    const scheduledAt = new Date(data.scheduledAt)
    const endsAt = addMinutes(scheduledAt, totalDuration)

    const barber = await prisma.barber.findFirst({
      where: { id: data.barberId, tenantId: tenant.id, isActive: true },
    })
    if (!barber) {
      return NextResponse.json({ error: "Barbeiro não encontrado" }, { status: 404 })
    }

    // Revalida no servidor que o horário é realmente um slot válido
    // (expediente, pausa, dia fechado, bloqueio, passado). Não confiar
    // apenas no front, pois esta é uma API pública.
    const slotOk = await isSlotAvailable({
      tenantId: tenant.id,
      barberId: data.barberId,
      date: scheduledAt,
      serviceDurationMinutes: totalDuration,
      requestedStart: scheduledAt,
    })
    if (!slotOk) {
      return NextResponse.json(
        { error: "Horário não disponível. Escolha outro horário." },
        { status: 409 }
      )
    }

    const appointment = await prisma.$transaction(
      async (
        tx: Omit<
          typeof prisma,
          "$connect" | "$disconnect" | "$on" | "$use" | "$extends"
        >
      ) => {
        await tx.$executeRaw`
          SELECT pg_advisory_xact_lock(
            hashtext(${data.barberId}::text || ${scheduledAt.toISOString()}::text)
          )
        `

        const conflict = await tx.appointment.findFirst({
          where: {
            barberId: data.barberId,
            status: { notIn: ["CANCELLED", "NO_SHOW"] },
            AND: [
              { scheduledAt: { lt: endsAt } },
              { endsAt: { gt: scheduledAt } },
            ],
          },
        })

        if (conflict) throw new Error("SLOT_UNAVAILABLE")

        return tx.appointment.create({
          data: {
            tenantId: tenant.id,
            barberId: data.barberId,
            guestName: data.guestName,
            guestPhone: data.guestPhone,
            guestEmail: data.guestEmail || null,
            notes: data.notes || null,
            scheduledAt,
            endsAt,
            totalPrice,
            status: "CONFIRMED",
            services: {
              create: services.map((s) => ({
                serviceId: s.id,
                price: s.price,
                durationMinutes: s.durationMinutes,
              })),
            },
          },
          include: {
            services: { include: { service: true } },
            barber: { include: { user: true } },
            tenant: true,
          },
        })
      }
    )

    sendBookingConfirmation(appointment).catch(console.error)

    return NextResponse.json(
      {
        success: true,
        appointment: {
          id: appointment.id,
          scheduledAt: appointment.scheduledAt,
          endsAt: appointment.endsAt,
          guestName: appointment.guestName,
          barberName: appointment.barber.user.name,
          services: appointment.services.map(
            (s: { service: { name: string } }) => s.service.name
          ),
          totalPrice: appointment.totalPrice,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof Error && error.message === "SLOT_UNAVAILABLE") {
      return NextResponse.json(
        { error: "Horário não disponível. Escolha outro horário." },
        { status: 409 }
      )
    }
    if (error instanceof TenantNotFoundError) {
      return NextResponse.json({ error: "Barbearia não encontrada" }, { status: 404 })
    }
    if (error instanceof ZodError) {
      console.error("[BOOK] Validation error:", error.issues)
      return NextResponse.json(
        { error: "Dados inválidos", details: error.issues.map((e) => e.message) },
        { status: 400 }
      )
    }
    console.error("[BOOK]", error)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
