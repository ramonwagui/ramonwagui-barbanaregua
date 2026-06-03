import { prisma } from "@/lib/prisma"
import { getPayment, refundPayment } from "@/lib/mercadopago"
import { sendBookingConfirmation } from "@/lib/notifications"

/**
 * Reconcilia um Payment local com o status real no Mercado Pago e, quando o
 * sinal é aprovado, confirma o agendamento. Idempotente: seguro chamar a
 * partir do webhook E do polling da página de pagamento.
 *
 * Retorna o status final do Payment (após reconciliar).
 */
export async function reconcilePayment(
  paymentId: string
): Promise<"PENDING" | "PAID" | "FAILED" | "NOT_FOUND"> {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
  })
  if (!payment) return "NOT_FOUND"

  // Já resolvido — nada a fazer.
  if (payment.status === "PAID") return "PAID"
  if (payment.status === "FAILED") return "FAILED"

  if (!payment.providerPaymentId) return "PENDING"

  let mp
  try {
    mp = await getPayment(payment.providerPaymentId)
  } catch (err) {
    console.error("[reconcilePayment] getPayment falhou:", err)
    return "PENDING"
  }

  if (mp.status === "approved") {
    return markPaid(paymentId)
  }

  if (
    mp.status === "rejected" ||
    mp.status === "cancelled" ||
    mp.status === "refunded"
  ) {
    await prisma.payment.update({
      where: { id: paymentId },
      data: { status: "FAILED" },
    })
    return "FAILED"
  }

  return "PENDING"
}

/**
 * Marca o Payment como PAID e confirma o Appointment numa transação.
 * Idempotente via guarda de status. Dispara a confirmação de WhatsApp.
 */
export async function markPaid(
  paymentId: string
): Promise<"PAID"> {
  const appointmentId = await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({
      where: { id: paymentId },
      select: { id: true, status: true, appointmentId: true },
    })
    if (!payment || payment.status === "PAID") return null

    await tx.payment.update({
      where: { id: paymentId },
      data: { status: "PAID", paidAt: new Date() },
    })

    // Confirma o agendamento se ainda estiver aguardando o sinal.
    await tx.appointment.updateMany({
      where: { id: payment.appointmentId, status: "PENDING" },
      data: { status: "CONFIRMED", paymentExpiresAt: null },
    })

    return payment.appointmentId
  })

  // Confirmação de WhatsApp (fora da transação, fire-and-forget).
  if (appointmentId) {
    const appt = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        services: { include: { service: true } },
        barber: { include: { user: true } },
        tenant: true,
      },
    })
    if (appt) sendBookingConfirmation(appt).catch(console.error)
  }

  return "PAID"
}

/**
 * Aplica a política de estorno do sinal ao cancelar um agendamento.
 * Estorna apenas se houver Payment PAID e o cancelamento ocorrer com pelo
 * menos `cancelRefundHours` de antecedência do horário marcado. Caso
 * contrário o sinal é retido (no-show / cancelamento em cima da hora).
 *
 * Retorna "REFUNDED", "KEPT" (sem antecedência) ou "NONE" (sem sinal pago).
 */
export async function refundDepositForCancellation(
  appointmentId: string
): Promise<"REFUNDED" | "KEPT" | "NONE"> {
  const appt = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    select: {
      scheduledAt: true,
      tenant: { select: { cancelRefundHours: true } },
      payment: { select: { id: true, status: true, providerPaymentId: true } },
    },
  })

  const payment = appt?.payment
  if (!appt || !payment || payment.status !== "PAID") return "NONE"

  const hoursUntil =
    (appt.scheduledAt.getTime() - Date.now()) / (1000 * 60 * 60)
  if (hoursUntil < appt.tenant.cancelRefundHours) return "KEPT"

  if (payment.providerPaymentId) {
    await refundPayment(payment.providerPaymentId)
  }
  await prisma.payment.update({
    where: { id: payment.id },
    data: { status: "REFUNDED", refundedAt: new Date() },
  })
  return "REFUNDED"
}
