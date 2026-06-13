import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { createPortalSession } from "@/lib/billing-client"

/** Proxy para o Billing Service — abre Customer Portal do Stripe. */
export async function POST() {
  const session = await auth()
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }
  if (session.user.role === "BARBER") {
    return NextResponse.json({ error: "Apenas o dono pode gerenciar a assinatura" }, { status: 403 })
  }

  const result = await createPortalSession(session.user.tenantId)

  if (!result) {
    return NextResponse.json({ error: "Não foi possível abrir o portal." }, { status: 503 })
  }
  return NextResponse.json({ url: result.url })
}
