import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { reconcilePayment } from "@/lib/payment-reconcile"

/**
 * Consultado em polling pela página de pagamento PIX. Reconcilia com o
 * Mercado Pago (fallback ao webhook) e devolve o status atual.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string; paymentId: string }> }
) {
  const { paymentId } = await params

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { appointment: { select: { id: true, status: true } } },
  })

  if (!payment) {
    return NextResponse.json({ error: "Pagamento não encontrado" }, { status: 404 })
  }

  // Slot já liberado por expiração (cron ou booking) → não tente reconciliar.
  if (payment.appointment.status === "CANCELLED") {
    return NextResponse.json({ status: "EXPIRED", appointmentId: payment.appointmentId })
  }

  const status = await reconcilePayment(paymentId)

  return NextResponse.json({
    status, // PENDING | PAID | FAILED
    appointmentId: payment.appointmentId,
  })
}
