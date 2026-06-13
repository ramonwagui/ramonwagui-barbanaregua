import { prisma } from "./prisma"
import { getPayment, refundPayment } from "./mercadopago"
import { getTenantMpToken, MpNotConnectedError } from "./mp-account"
import { publishEvent } from "./events"

const MONOLITH_URL = (process.env.MONOLITH_URL ?? "http://localhost:3000").replace(/\/$/, "")
const INTERNAL_KEY = process.env.INTERNAL_API_KEY ?? ""

// Notifica o monolito para confirmar o agendamento e emitir appointment.confirmed.
async function notifyAppointmentConfirmed(appointmentId: string): Promise<void> {
  const res = await fetch(`${MONOLITH_URL}/api/internal/appointments/${appointmentId}/confirm`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-key": INTERNAL_KEY,
    },
  })
  if (!res.ok) {
    console.error(
      `[reconcile] notifyAppointmentConfirmed ${appointmentId} HTTP ${res.status}`
    )
  }
}

// Notifica o monolito para ativar os créditos de um pacote.
async function notifyPackageActivate(paymentId: string): Promise<void> {
  const res = await fetch(`${MONOLITH_URL}/api/internal/packages/payments/${paymentId}/activate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-key": INTERNAL_KEY,
    },
  })
  if (!res.ok) {
    console.error(`[reconcile] notifyPackageActivate ${paymentId} HTTP ${res.status}`)
  }
}

/**
 * Reconcilia o Payment com o status real no Mercado Pago.
 * Idempotente — seguro chamar a partir do webhook e do polling.
 */
export async function reconcilePayment(
  paymentId: string
): Promise<"PENDING" | "PAID" | "FAILED" | "NOT_FOUND"> {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } })
  if (!payment) return "NOT_FOUND"
  if (payment.status === "PAID") return "PAID"
  if (payment.status === "FAILED") return "FAILED"
  if (!payment.providerPaymentId) return "PENDING"

  let mpStatus: string
  try {
    const token = await getTenantMpToken(payment.tenantId)
    const mp = await getPayment(payment.providerPaymentId, token)
    mpStatus = mp.status
  } catch (err) {
    if (err instanceof MpNotConnectedError) {
      console.error(`[reconcile] tenant ${payment.tenantId} sem conexão MP`)
    } else {
      console.error("[reconcile] getPayment falhou:", err)
    }
    return "PENDING"
  }

  if (mpStatus === "approved") {
    return markPaid(payment.id, payment.tenantId, payment.appointmentId, payment.packageId)
  }

  if (["rejected", "cancelled", "refunded"].includes(mpStatus)) {
    await prisma.payment.update({ where: { id: paymentId }, data: { status: "FAILED" } })
    publishEvent({ type: "payment.failed", payload: { paymentId, tenantId: payment.tenantId } })
    return "FAILED"
  }

  return "PENDING"
}

async function markPaid(
  paymentId: string,
  tenantId: string,
  appointmentId: string | null,
  packageId: string | null
): Promise<"PAID"> {
  const updated = await prisma.payment.updateMany({
    where: { id: paymentId, status: { not: "PAID" } },
    data: { status: "PAID", paidAt: new Date() },
  })

  if (updated.count === 0) return "PAID" // já estava PAID (idempotência)

  const metadata = (await prisma.payment.findUnique({
    where: { id: paymentId },
    select: { metadata: true, amount: true },
  }))!

  const amount = Number(metadata.amount)
  const kind = (
    (metadata.metadata as Record<string, unknown> | null)?.kind === "package"
      ? "package"
      : "appointment"
  ) as "appointment" | "package"

  publishEvent({
    type: "payment.paid",
    payload: {
      paymentId,
      tenantId,
      amount,
      kind,
      appointmentId: appointmentId ?? undefined,
      packageId: packageId ?? undefined,
    },
  })

  if (kind === "appointment" && appointmentId) {
    notifyAppointmentConfirmed(appointmentId).catch(console.error)
  } else if (kind === "package") {
    notifyPackageActivate(paymentId).catch(console.error)
  }

  return "PAID"
}

/**
 * Avalia a política de estorno e, se aplicável, executa o reembolso.
 * Chamado quando o monolito cancela um agendamento.
 */
export async function refundDepositForCancellation(
  appointmentId: string,
  scheduledAt: Date,
  cancelRefundHours: number
): Promise<"REFUNDED" | "KEPT" | "NONE"> {
  const payment = await prisma.payment.findUnique({
    where: { appointmentId },
    select: { id: true, status: true, providerPaymentId: true, tenantId: true, amount: true },
  })
  if (!payment || payment.status !== "PAID") return "NONE"

  const hoursUntil = (scheduledAt.getTime() - Date.now()) / (1000 * 60 * 60)
  if (hoursUntil < cancelRefundHours) return "KEPT"

  if (payment.providerPaymentId) {
    const token = await getTenantMpToken(payment.tenantId)
    await refundPayment(payment.providerPaymentId, token)
  }

  await prisma.payment.update({
    where: { id: payment.id },
    data: { status: "REFUNDED", refundedAt: new Date(), refundAmount: payment.amount },
  })

  publishEvent({
    type: "payment.refunded",
    payload: {
      paymentId: payment.id,
      tenantId: payment.tenantId,
      amount: Number(payment.amount),
    },
  })

  return "REFUNDED"
}
