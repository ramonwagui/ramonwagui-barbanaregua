import { NextResponse } from "next/server"
import { activateClientPackage } from "@/lib/packages"

const INTERNAL_KEY = process.env.INTERNAL_API_KEY ?? ""

/**
 * Chamado pelo Payment Service após pagamento de pacote pré-pago aprovado.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ paymentId: string }> }
) {
  if (INTERNAL_KEY && req.headers.get("x-internal-key") !== INTERNAL_KEY) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  const { paymentId } = await params
  const result = await activateClientPackage(paymentId)
  return NextResponse.json({ result })
}
