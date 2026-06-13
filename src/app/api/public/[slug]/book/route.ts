import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getTenantBySlug, canAcceptBookings, TenantNotFoundError } from "@/lib/tenant"
import {
  createAppointmentSchema,
  depositEmailSchema,
} from "@/lib/validations/appointment"
import { publishEvent } from "@/lib/events"
import { toAppointmentPayload } from "@/lib/event-mappers"
import { isSlotAvailable } from "@/lib/availability"
import { checkRateLimit, getClientIp } from "@/lib/rate-limit"
import { createDepositPix, isMpConnected } from "@/lib/payment-client"
import { getLoyaltyStatus, normalizeLoyaltyPhone } from "@/lib/loyalty"
import { hasUsableCredit, consumeCreditForService } from "@/lib/packages"
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

    // Verificar limite de agendamentos mensais do plano
    const { getPlanLimits } = await import("@/lib/plans")
    const limits = getPlanLimits(tenant)
    if (limits.maxAppointmentsPerMonth !== null) {
      const monthStart = new Date()
      monthStart.setUTCDate(1)
      monthStart.setUTCHours(0, 0, 0, 0)
      const count = await prisma.appointment.count({
        where: {
          tenantId: tenant.id,
          scheduledAt: { gte: monthStart },
          status: { notIn: ["CANCELLED"] },
        },
      })
      if (count >= limits.maxAppointmentsPerMonth) {
        return NextResponse.json(
          { error: "Esta barbearia atingiu o limite de agendamentos do mês." },
          { status: 403 }
        )
      }
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
    let totalPrice = services.reduce(
      (sum, s) => sum.plus(s.price),
      new Prisma.Decimal(0)
    )

    // ── Fidelidade: resgate de serviço grátis (revalidado no servidor) ──
    let loyaltyRewardServiceId: string | null = null
    if (body?.redeemLoyalty === true && data.guestPhone) {
      const status = await getLoyaltyStatus(tenant.id, data.guestPhone)
      if (
        status.enabled &&
        status.available &&
        status.rewardServiceId &&
        data.serviceIds.includes(status.rewardServiceId)
      ) {
        loyaltyRewardServiceId = status.rewardServiceId
        const rewardSvc = services.find((s) => s.id === loyaltyRewardServiceId)
        if (rewardSvc) totalPrice = totalPrice.minus(rewardSvc.price)
      }
    }

    // ── Pacote pré-pago: usa 1 crédito para um dos serviços (revalidado) ──
    let packageServiceId: string | null = null
    if (body?.usePackage === true && data.guestPhone) {
      for (const sid of data.serviceIds) {
        if (sid === loyaltyRewardServiceId) continue // já está grátis
        if (await hasUsableCredit(tenant.id, data.guestPhone, sid)) {
          packageServiceId = sid
          const svc = services.find((s) => s.id === sid)
          if (svc) totalPrice = totalPrice.minus(svc.price)
          break
        }
      }
    }

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

    // ── Configuração de sinal (depósito) da barbearia ──
    // Se a fidelidade zerou o total (só o serviço grátis), não cobra sinal.
    const requireDeposit = tenant.requireDeposit && totalPrice.gt(0)
    let payerEmail = ""
    let depositAmount: Prisma.Decimal | null = null
    let paymentExpiresAt: Date | null = null

    if (requireDeposit) {
      // Verifica se o salão tem Mercado Pago conectado antes de criar a reserva.
      const connected = await isMpConnected(tenant.id).catch(() => false)
      if (!connected) {
        return NextResponse.json(
          { error: "Pagamento indisponível: a barbearia ainda não conectou o Mercado Pago." },
          { status: 503 }
        )
      }
      // E-mail é obrigatório para gerar o PIX (pagador do Mercado Pago)
      payerEmail = depositEmailSchema.parse(data.guestEmail)

      const percent = Math.min(100, Math.max(1, tenant.depositPercent))
      depositAmount = totalPrice.mul(percent).div(100)
      paymentExpiresAt = addMinutes(new Date(), tenant.depositExpiryMinutes)
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

        // Ignora reservas PENDING cujo sinal expirou (slot já liberado, mesmo
        // que o cron ainda não as tenha cancelado).
        const conflict = await tx.appointment.findFirst({
          where: {
            barberId: data.barberId,
            status: { notIn: ["CANCELLED", "NO_SHOW"] },
            NOT: {
              status: "PENDING",
              paymentExpiresAt: { lt: new Date() },
            },
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
            depositAmount,
            paymentExpiresAt,
            status: requireDeposit ? "PENDING" : "CONFIRMED",
            services: {
              create: services.map((s) => ({
                serviceId: s.id,
                // serviço grátis por fidelidade OU pago por crédito de pacote → 0
                price:
                  s.id === loyaltyRewardServiceId || s.id === packageServiceId
                    ? new Prisma.Decimal(0)
                    : s.price,
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

    // ── Pacote: consome 1 crédito após criar o agendamento ──
    if (packageServiceId && data.guestPhone) {
      await consumeCreditForService(tenant.id, data.guestPhone, packageServiceId).catch(
        console.error
      )
    }

    // ── Fidelidade: consome 1 recompensa após criar o agendamento ──
    if (loyaltyRewardServiceId && data.guestPhone) {
      await prisma.loyaltyCard
        .update({
          where: {
            tenantId_clientPhone: {
              tenantId: tenant.id,
              clientPhone: normalizeLoyaltyPhone(data.guestPhone),
            },
          },
          data: { rewardsRedeemed: { increment: 1 } },
        })
        .catch(console.error)
    }

    // ── Sem sinal: fluxo original (confirma na hora) ──
    if (!requireDeposit) {
      publishEvent({ type: "appointment.confirmed", payload: toAppointmentPayload(appointment) })

      return NextResponse.json(
        {
          success: true,
          requiresPayment: false,
          appointment: serializeAppointment(appointment),
        },
        { status: 201 }
      )
    }

    // ── Com sinal: chama o Payment Service para criar PIX ────────────────────
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
    try {
      const pix = await createDepositPix({
        tenantId: tenant.id,
        appointmentId: appointment.id,
        amount: Number(depositAmount!),
        description: `Sinal — ${tenant.name}`,
        payerEmail,
        expiresAt: paymentExpiresAt!,
        notificationUrl: `${baseUrl}/api/webhooks/mercadopago`,
      })

      return NextResponse.json(
        {
          success: true,
          requiresPayment: true,
          paymentId: pix.paymentId,
          pixCode: pix.pixCode,
          pixQrCode: pix.pixQrCode,
          depositAmount: Number(depositAmount!),
          expiresAt: paymentExpiresAt!.toISOString(),
          appointment: serializeAppointment(appointment),
        },
        { status: 201 }
      )
    } catch (err) {
      // Falha ao gerar o PIX: libera o slot cancelando a reserva PENDING.
      console.error("[BOOK] Falha ao gerar PIX via Payment Service:", err)
      await prisma.appointment
        .update({
          where: { id: appointment.id },
          data: {
            status: "CANCELLED",
            cancelledAt: new Date(),
            cancellationReason: "Falha ao gerar pagamento do sinal",
          },
        })
        .catch(console.error)

      return NextResponse.json(
        { error: "Não foi possível gerar o pagamento do sinal. Tente novamente." },
        { status: 502 }
      )
    }
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

function serializeAppointment(appointment: {
  id: string
  scheduledAt: Date
  endsAt: Date
  guestName: string | null
  barber: { user: { name: string | null } }
  services: Array<{ service: { name: string } }>
  totalPrice: unknown
}) {
  return {
    id: appointment.id,
    scheduledAt: appointment.scheduledAt,
    endsAt: appointment.endsAt,
    guestName: appointment.guestName,
    barberName: appointment.barber.user.name,
    services: appointment.services.map((s) => s.service.name),
    totalPrice: appointment.totalPrice,
  }
}
