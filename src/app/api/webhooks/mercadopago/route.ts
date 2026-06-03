import { NextResponse } from "next/server"
import { createHmac, timingSafeEqual } from "crypto"
import { getPayment } from "@/lib/mercadopago"
import { reconcilePayment } from "@/lib/payment-reconcile"
import { prisma } from "@/lib/prisma"

/**
 * Webhook de notificações do Mercado Pago (eventos de pagamento).
 *
 * Validação da assinatura conforme docs do MP: HMAC-SHA256 sobre o template
 * `id:<data.id>;request-id:<x-request-id>;ts:<ts>;` usando MERCADOPAGO_WEBHOOK_SECRET.
 * Se o secret não estiver configurado, a validação é pulada (degrada gracioso),
 * mas isso não é recomendado em produção.
 */
export async function POST(req: Request) {
  try {
    const url = new URL(req.url)
    const body = await req.json().catch(() => ({}))

    // O id do pagamento pode vir em data.id (body) ou ?data.id / ?id (query).
    const dataId =
      body?.data?.id?.toString() ??
      url.searchParams.get("data.id") ??
      url.searchParams.get("id")

    const topic =
      body?.type ?? body?.topic ?? url.searchParams.get("type") ?? url.searchParams.get("topic")

    if (!dataId) {
      return NextResponse.json({ ignored: true }, { status: 200 })
    }

    // Só nos interessam eventos de pagamento.
    if (topic && !String(topic).includes("payment")) {
      return NextResponse.json({ ignored: true }, { status: 200 })
    }

    if (!verifySignature(req, dataId)) {
      return NextResponse.json({ error: "Assinatura inválida" }, { status: 401 })
    }

    // dataId é o id do pagamento NO Mercado Pago. Mapeia p/ nosso Payment via
    // external_reference (que é o id do nosso Payment).
    const mp = await getPayment(dataId)
    if (!mp.externalReference) {
      return NextResponse.json({ ignored: true }, { status: 200 })
    }

    const exists = await prisma.payment.findUnique({
      where: { id: mp.externalReference },
      select: { id: true },
    })
    if (!exists) {
      return NextResponse.json({ ignored: true }, { status: 200 })
    }

    await reconcilePayment(mp.externalReference)

    return NextResponse.json({ received: true }, { status: 200 })
  } catch (err) {
    console.error("[MP webhook]", err)
    // Responder 200 evita retries infinitos por erro transitório nosso;
    // o polling/cron reconcilia de qualquer forma.
    return NextResponse.json({ received: true }, { status: 200 })
  }
}

function verifySignature(req: Request, dataId: string): boolean {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET
  if (!secret) return true // sem secret configurado → pula validação

  const signatureHeader = req.headers.get("x-signature")
  const requestId = req.headers.get("x-request-id") ?? ""
  if (!signatureHeader) return false

  // x-signature: "ts=<timestamp>,v1=<hash>"
  const parts = Object.fromEntries(
    signatureHeader.split(",").map((kv) => {
      const [k, v] = kv.split("=")
      return [k.trim(), v?.trim() ?? ""]
    })
  )
  const ts = parts["ts"]
  const v1 = parts["v1"]
  if (!ts || !v1) return false

  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`
  const expected = createHmac("sha256", secret).update(manifest).digest("hex")

  try {
    const a = Buffer.from(expected, "hex")
    const b = Buffer.from(v1, "hex")
    return a.length === b.length && timingSafeEqual(a, b)
  } catch {
    return false
  }
}
