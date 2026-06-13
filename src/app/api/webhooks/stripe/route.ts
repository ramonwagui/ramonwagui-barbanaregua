/**
 * Compatibilidade retroativa: encaminha eventos Stripe para o Billing Service.
 * Após atualizar o endpoint no dashboard do Stripe para apontar diretamente ao
 * Billing Service (:3006/webhooks/stripe), este arquivo pode ser removido.
 */

import { NextResponse } from "next/server"

const BILLING_URL = (process.env.BILLING_SERVICE_URL ?? "http://localhost:3006").replace(/\/$/, "")
const INTERNAL_KEY = process.env.INTERNAL_API_KEY ?? ""

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature") ?? ""
  const raw = await req.text()

  try {
    const res = await fetch(`${BILLING_URL}/webhooks/stripe`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "stripe-signature": sig,
        "x-internal-key": INTERNAL_KEY,
      },
      body: raw,
    })

    const body = await res.json().catch(() => ({ received: true }))
    return NextResponse.json(body, { status: res.status })
  } catch (err) {
    console.error("[stripe proxy] Billing Service indisponível:", err)
    // Retorna 200 para o Stripe não re-enviar — o evento será reprocessado
    // quando o Billing Service voltar (fila de retentativa do Stripe é 72h)
    return NextResponse.json({ received: true }, { status: 200 })
  }
}
