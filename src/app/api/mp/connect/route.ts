import { NextResponse } from "next/server"
import { SignJWT } from "jose"
import { auth } from "@/lib/auth"
import { getAuthorizationUrl, isMercadoPagoConfigured } from "@/lib/mercadopago"

/**
 * Inicia o OAuth do Mercado Pago para o salão logado. Gera um `state` assinado
 * (JWT HS256 com AUTH_SECRET, expira em 10 min) vinculado ao tenantId — protege
 * contra CSRF e dispensa armazenar estado no servidor. Redireciona o dono para
 * a tela de autorização do Mercado Pago.
 */
export async function GET(req: Request) {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin).replace(
    /\/$/,
    ""
  )

  const session = await auth()
  if (!session?.user?.tenantId) {
    return NextResponse.redirect(`${base}/login`)
  }
  if (session.user.role === "BARBER") {
    return NextResponse.redirect(`${base}/configuracoes?mp=forbidden`)
  }
  if (!isMercadoPagoConfigured()) {
    return NextResponse.redirect(`${base}/configuracoes?mp=unconfigured`)
  }

  const secret = new TextEncoder().encode(process.env.AUTH_SECRET)
  const state = await new SignJWT({ tenantId: session.user.tenantId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(secret)

  return NextResponse.redirect(getAuthorizationUrl(state))
}
