import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getPaymentStatus } from "@/lib/payment-client"

/**
 * Detalhe + status do pagamento de um pacote. Reconcilia via Payment Service
 * e retorna QR + status. paymentId é o ID do Payment Service.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string; paymentId: string }> }
) {
  const { paymentId } = await params

  // Lookup do ClientPackage pelo paymentId (gravado na compra).
  const clientPackage = await prisma.clientPackage.findUnique({
    where: { paymentId },
    select: { status: true, creditsTotal: true },
  })

  // Reconcilia com o Payment Service (retorna QR e status).
  const result = await getPaymentStatus(paymentId)

  if (result.status === "NOT_FOUND") {
    return NextResponse.json({ error: "Pagamento não encontrado" }, { status: 404 })
  }

  // Se o ClientPackage já estiver ACTIVE, o pagamento está confirmado.
  const status =
    clientPackage?.status === "ACTIVE"
      ? "PAID"
      : clientPackage?.status === "CANCELLED"
        ? "FAILED"
        : result.status === "NOT_FOUND"
          ? "PENDING"
          : result.status

  return NextResponse.json({
    status,
    pixCode: result.pixCode ?? null,
    pixQrCode: result.pixQrCode ?? null,
    amount: result.amount ?? null,
    credits: clientPackage?.creditsTotal ?? null,
  })
}
