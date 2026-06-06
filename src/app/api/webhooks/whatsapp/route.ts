import { NextResponse } from "next/server"
import { createHmac, timingSafeEqual } from "crypto"
import { prisma } from "@/lib/prisma"
import { NotifStatus } from "@prisma/client"

/**
 * Webhook do WhatsApp Cloud API (Meta).
 *
 * GET  → verificação do webhook (hub.challenge), validando WHATSAPP_VERIFY_TOKEN.
 * POST → eventos. Tratamos os "statuses" (sent/delivered/read/failed) e
 *        atualizamos a Notification correspondente (casada pelo wamid em
 *        providerMsgId), gravando o motivo quando falha. Assim o motivo da
 *        não entrega fica visível no log de notificações.
 */

export async function GET(req: Request) {
  const url = new URL(req.url)
  const mode = url.searchParams.get("hub.mode")
  const token = url.searchParams.get("hub.verify_token")
  const challenge = url.searchParams.get("hub.challenge")

  if (mode === "subscribe" && token && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(challenge ?? "", { status: 200 })
  }
  return new Response("Forbidden", { status: 403 })
}

export async function POST(req: Request) {
  const raw = await req.text()

  if (!verifySignature(req, raw)) {
    return NextResponse.json({ error: "Assinatura inválida" }, { status: 401 })
  }

  let body: unknown
  try {
    body = JSON.parse(raw)
  } catch {
    return NextResponse.json({ ignored: true }, { status: 200 })
  }

  try {
    const statuses = extractStatuses(body)
    for (const s of statuses) {
      const failed = s.status === "failed"
      const delivered = s.status === "delivered" || s.status === "read"
      if (!failed && !delivered) continue // "sent" já é o estado inicial

      const errMsg = failed
        ? (s.errors?.[0]
            ? `${s.errors[0].code} ${s.errors[0].title}${s.errors[0].message ? " — " + s.errors[0].message : ""}`
            : "Falha na entrega")
        : undefined

      await prisma.notification.updateMany({
        where: { providerMsgId: s.id },
        data: {
          status: failed ? NotifStatus.FAILED : NotifStatus.DELIVERED,
          errorMsg: errMsg,
        },
      })

      if (failed) console.error("[WA status] FALHOU", s.id, "→", errMsg)
    }
  } catch (err) {
    console.error("[WA webhook]", err)
  }

  // Sempre 200 para a Meta não reenviar em loop.
  return NextResponse.json({ received: true }, { status: 200 })
}

function verifySignature(req: Request, raw: string): boolean {
  const secret = process.env.WHATSAPP_APP_SECRET
  if (!secret) return true // sem secret → pula (não recomendado em produção)
  const header = req.headers.get("x-hub-signature-256")
  if (!header) return false
  const expected = "sha256=" + createHmac("sha256", secret).update(raw).digest("hex")
  try {
    const a = Buffer.from(header)
    const b = Buffer.from(expected)
    return a.length === b.length && timingSafeEqual(a, b)
  } catch {
    return false
  }
}

interface WaStatus {
  id: string
  status: string
  errors?: Array<{ code: number; title: string; message?: string }>
}

function extractStatuses(body: unknown): WaStatus[] {
  const out: WaStatus[] = []
  const entries = (body as { entry?: unknown[] })?.entry
  if (!Array.isArray(entries)) return out
  for (const entry of entries) {
    const changes = (entry as { changes?: unknown[] })?.changes
    if (!Array.isArray(changes)) continue
    for (const change of changes) {
      const value = (change as { value?: { statuses?: WaStatus[] } })?.value
      if (value?.statuses && Array.isArray(value.statuses)) out.push(...value.statuses)
    }
  }
  return out
}
