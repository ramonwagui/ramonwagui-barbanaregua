import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { refundDepositForCancellation } from "@/lib/payment-client"
import { publishEvent } from "@/lib/events"
import { toAppointmentPayload } from "@/lib/event-mappers"

/**
 * Cancelamento self-service pelo cliente. Só funciona se o salão tiver
 * habilitado `allowClientCancellation`. Aplica a mesma política de estorno do
 * cancelamento pelo painel (refundDepositForCancellation): estorna o sinal se
 * pago e com antecedência >= cancelRefundHours; caso contrário o salão retém.
 *
 * O id do agendamento (cuid) funciona como handle não-enumerável, no mesmo
 * modelo da página pública de confirmação.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ slug: string; appointmentId: string }> }
) {
  const { slug, appointmentId } = await params

  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      barber: { include: { user: { select: { name: true, phone: true } } } },
      services: { include: { service: true } },
      tenant: true,
    },
  })

  if (!appointment || appointment.tenant.slug !== slug) {
    return NextResponse.json({ error: "Agendamento não encontrado" }, { status: 404 })
  }

  if (!appointment.tenant.allowClientCancellation) {
    return NextResponse.json(
      { error: "Esta barbearia não permite cancelamento pelo cliente." },
      { status: 403 }
    )
  }

  // Já cancelado → idempotente.
  if (appointment.status === "CANCELLED") {
    return NextResponse.json({ success: true, alreadyCancelled: true, refund: "NONE" })
  }

  // Só dá para cancelar agendamentos ativos e ainda no futuro.
  const cancellable = ["PENDING", "CONFIRMED"].includes(appointment.status)
  if (!cancellable || appointment.scheduledAt.getTime() <= Date.now()) {
    return NextResponse.json(
      { error: "Este agendamento não pode mais ser cancelado." },
      { status: 409 }
    )
  }

  await prisma.appointment.update({
    where: { id: appointmentId },
    data: {
      status: "CANCELLED",
      cancelledAt: new Date(),
      cancellationReason: "Cancelado pelo cliente",
    },
  })

  // Política de estorno (estorna na conta do salão via Payment Service).
  const refund = await refundDepositForCancellation({
    appointmentId,
    scheduledAt: appointment.scheduledAt,
    cancelRefundHours: appointment.tenant.cancelRefundHours,
  }).catch((err) => {
    console.error("[public cancel] estorno falhou:", err)
    return "NONE" as const
  })

  publishEvent({
    type: "appointment.cancelled",
    payload: {
      ...toAppointmentPayload(appointment),
      cancellationReason: "Cancelado pelo cliente",
      cancelledAt: new Date().toISOString(),
    },
  })

  return NextResponse.json({ success: true, refund })
}
