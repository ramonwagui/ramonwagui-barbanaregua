import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { reconcilePayment } from "@/lib/payment-reconcile"

/**
 * Detalhe + status do pagamento de um pacote (consultado em polling pela página
 * de pagamento). Reconcilia com o Mercado Pago (fallback ao webhook) e devolve
 * o QR e o status atual.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string; paymentId: string }> }
) {
  const { paymentId } = await params

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    select: {
      pixCode: true,
      pixQrCode: true,
      amount: true,
      status: true,
      clientPackage: { select: { status: true, creditsTotal: true } },
    },
  })

  if (!payment || !payment.clientPackage) {
    return NextResponse.json({ error: "Pagamento não encontrado" }, { status: 404 })
  }

  let status: "PENDING" | "PAID" | "FAILED" = "PENDING"
  if (payment.status === "PAID" || payment.clientPackage.status === "ACTIVE") {
    status = "PAID"
  } else if (payment.clientPackage.status === "CANCELLED") {
    status = "FAILED"
  } else {
    status = await reconcilePayment(paymentId)
      .then((s) => (s === "NOT_FOUND" ? "PENDING" : s))
      .catch(() => "PENDING")
  }

  return NextResponse.json({
    status,
    pixCode: payment.pixCode,
    pixQrCode: payment.pixQrCode,
    amount: Number(payment.amount),
    credits: payment.clientPackage.creditsTotal,
  })
}
