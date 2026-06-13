/**
 * Proxy para o Payment Service. Encaminha os webhooks do Mercado Pago com todos
 * os headers necessários para a validação HMAC no Payment Service.
 * Após atualizar a URL de notificação no painel do MP para apontar diretamente
 * ao Payment Service (:3005/webhooks/mercadopago), este arquivo pode ser removido.
 */

import { NextResponse } from "next/server"

const PAYMENT_URL = (process.env.PAYMENT_SERVICE_URL ?? "http://localhost:3005").replace(/\/$/, "")

export async function POST(req: Request) {
  const url = new URL(req.url)
  const raw = await req.text()

  try {
    const forwardUrl = `${PAYMENT_URL}/webhooks/mercadopago${url.search}`
    const res = await fetch(forwardUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-signature": req.headers.get("x-signature") ?? "",
        "x-request-id": req.headers.get("x-request-id") ?? "",
      },
      body: raw,
    })
    const body = await res.json().catch(() => ({ received: true }))
    return NextResponse.json(body, { status: res.status })
  } catch (err) {
    console.error("[mp-webhook proxy] Payment Service indisponível:", err)
    // Retorna 200 para o MP não re-enviar infinitamente
    return NextResponse.json({ received: true }, { status: 200 })
  }
}
