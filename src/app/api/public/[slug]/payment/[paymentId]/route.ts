import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/**
 * Detalhe do pagamento do sinal — carregado uma vez pela página de PIX para
 * exibir QR Code, código copia-e-cola e valor. O status em si é acompanhado
 * pela rota `/status` (polling leve com reconciliação).
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string; paymentId: string }> }
) {
  const { paymentId } = await params

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { appointment: { select: { id: true, status: true, paymentExpiresAt: true } } },
  })

  if (!payment || !payment.appointment) {
    return NextResponse.json({ error: "Pagamento não encontrado" }, { status: 404 })
  }

  return NextResponse.json({
    paymentId: payment.id,
    pixCode: payment.pixCode,
    pixQrCode: payment.pixQrCode,
    depositAmount: Number(payment.amount),
    status: payment.status, // PENDING | PROCESSING | PAID | FAILED ...
    appointmentId: payment.appointmentId,
    appointmentStatus: payment.appointment.status,
    expiresAt: payment.appointment.paymentExpiresAt,
  })
}
