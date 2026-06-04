import { NextResponse } from "next/server"
import { jwtVerify } from "jose"
import { auth } from "@/lib/auth"
import { exchangeCodeForToken, getAccountInfo } from "@/lib/mercadopago"
import { saveConnection } from "@/lib/mp-account"

/**
 * Callback do OAuth do Mercado Pago. Valida o `state` assinado, garante que o
 * dono logado é o mesmo do `state`, troca o `code` por tokens do salão e salva
 * a conexão (tokens criptografados). Redireciona de volta para Configurações.
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

  // Valida o state (CSRF) e extrai o tenantId.
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

  // Confere que quem está concluindo é o dono do mesmo salão do state.
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
    const tokens = await exchangeCodeForToken(code)
    let nickname: string | null = null
    try {
      nickname = (await getAccountInfo(tokens.accessToken)).nickname
    } catch {
      // nickname é só cosmético; segue mesmo se falhar.
    }
    await saveConnection(tenantId, tokens, nickname)
    settings.searchParams.set("mp", "connected")
  } catch (err) {
    console.error("[MP callback] falha ao conectar:", err)
    settings.searchParams.set("mp", "error")
  }

  return NextResponse.redirect(settings)
}
