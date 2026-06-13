import { NextResponse } from "next/server"
import { getPaymentStatus } from "@/lib/payment-client"

/**
 * Polling de status do PIX de depósito. Proxy para o Payment Service.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string; paymentId: string }> }
) {
  const { paymentId } = await params

  const result = await getPaymentStatus(paymentId)

  if (result.status === "NOT_FOUND") {
    return NextResponse.json({ error: "Pagamento não encontrado" }, { status: 404 })
  }

  return NextResponse.json({ status: result.status })
}
