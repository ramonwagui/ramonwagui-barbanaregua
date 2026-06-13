import { NextResponse } from "next/server"
import { jwtVerify } from "jose"
import { auth } from "@/lib/auth"
import { saveMpConnection } from "@/lib/payment-client"

/**
 * Callback do OAuth do Mercado Pago. Valida o `state` assinado (CSRF), garante
 * que o dono logado é o mesmo do `state`, delega o exchange de código e
 * armazenamento de tokens ao Payment Service.
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? url.origin).replace(/\/$/, "")
  const settings = new URL(`${base}/configuracoes`)

  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state")

  if (!code || !state) {
    settings.searchParams.set("mp", "error")
    return NextResponse.redirect(settings)
  }

  let tenantId: string
  try {
    const secret = new TextEncoder().encode(process.env.AUTH_SECRET)
    const { payload } = await jwtVerify(state, secret)
    tenantId = String(payload.tenantId)
    if (!tenantId) throw new Error("state sem tenantId")
  } catch {
    settings.searchParams.set("mp", "error")
    return NextResponse.redirect(settings)
  }

  const session = await auth()
  if (
    !session?.user?.tenantId ||
    session.user.tenantId !== tenantId ||
    session.user.role === "BARBER"
  ) {
    settings.searchParams.set("mp", "forbidden")
    return NextResponse.redirect(settings)
  }

  try {
    await saveMpConnection(tenantId, code)
    settings.searchParams.set("mp", "connected")
  } catch (err) {
    console.error("[MP callback] falha ao conectar via Payment Service:", err)
    settings.searchParams.set("mp", "error")
  }

  return NextResponse.redirect(settings)
}
