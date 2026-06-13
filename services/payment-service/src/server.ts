import Fastify from "fastify"
import { createHmac, timingSafeEqual } from "crypto"
import { z } from "zod"
import { prisma } from "./lib/prisma"
import { reconcilePayment, refundDepositForCancellation } from "./lib/reconcile"
import {
  saveConnectionFromCode,
  getConnectionInfo,
  disconnect,
  getTenantMpToken,
} from "./lib/mp-account"
import {
  createPixPayment,
  isMercadoPagoConfigured,
  getAuthorizationUrl,
} from "./lib/mercadopago"

const PORT = Number(process.env.PORT ?? 3005)
const INTERNAL_KEY = process.env.INTERNAL_API_KEY ?? ""

const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? "info" } })

// ── Auth middleware ───────────────────────────────────────────────────────────

function requireInternalKey(req: { headers: Record<string, unknown> }): boolean {
  return INTERNAL_KEY ? req.headers["x-internal-key"] === INTERNAL_KEY : true
}

// ── Health ────────────────────────────────────────────────────────────────────

app.get("/health", async () => {
  let db = "connected"
  try {
    await prisma.$queryRaw`SELECT 1`
  } catch {
    db = "error"
  }
  const status = db === "connected" ? "healthy" : "degraded"
  return {
    status,
    db,
    service: "payment-service",
    uptime: Math.floor(process.uptime()),
    ts: new Date().toISOString(),
  }
})

// ── Create PIX payment ────────────────────────────────────────────────────────

const createPaymentSchema = z.object({
  tenantId: z.string(),
  appointmentId: z.string().optional(),
  packageId: z.string().optional(),
  amount: z.number().positive(),
  payerEmail: z.string().email(),
  description: z.string(),
  expiresAt: z.string().datetime(),
  notificationUrl: z.string().url(),
  kind: z.enum(["appointment", "package"]).default("appointment"),
})

app.post("/payments", async (req, reply) => {
  if (!requireInternalKey(req)) return reply.status(401).send({ error: "Não autorizado" })

  const data = createPaymentSchema.parse(req.body)

  const mpToken = await getTenantMpToken(data.tenantId)

  const payment = await prisma.payment.create({
    data: {
      tenantId: data.tenantId,
      appointmentId: data.appointmentId ?? null,
      packageId: data.packageId ?? null,
      amount: data.amount,
      status: "PENDING",
      provider: "MERCADO_PAGO",
      metadata: { kind: data.kind },
    },
  })

  try {
    const pix = await createPixPayment(
      {
        amount: data.amount,
        description: data.description,
        payerEmail: data.payerEmail,
        externalReference: payment.id,
        expiresAt: new Date(data.expiresAt),
        notificationUrl: data.notificationUrl,
      },
      mpToken
    )

    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        providerPaymentId: pix.id,
        pixCode: pix.qrCode,
        pixQrCode: pix.qrCodeBase64,
        status: "PROCESSING",
      },
    })

    return reply.status(201).send({
      paymentId: payment.id,
      pixCode: pix.qrCode,
      pixQrCode: pix.qrCodeBase64,
    })
  } catch (err) {
    await prisma.payment.delete({ where: { id: payment.id } }).catch(() => null)
    req.log.error(err, "createPixPayment falhou")
    return reply.status(502).send({ error: "Falha ao gerar PIX no Mercado Pago" })
  }
})

// ── Payment status (polling — reconcilia e retorna dados do pagamento) ────────

app.get<{ Params: { id: string } }>("/payments/:id/status", async (req, reply) => {
  const status = await reconcilePayment(req.params.id)
  if (status === "NOT_FOUND") return reply.status(404).send({ error: "Pagamento não encontrado" })

  const payment = await prisma.payment.findUnique({
    where: { id: req.params.id },
    select: { pixCode: true, pixQrCode: true, amount: true, metadata: true },
  })

  return {
    status,
    pixCode: payment?.pixCode ?? null,
    pixQrCode: payment?.pixQrCode ?? null,
    amount: payment ? Number(payment.amount) : null,
    kind: (payment?.metadata as Record<string, unknown> | null)?.kind ?? "appointment",
  }
})

// ── Refund by payment ID ──────────────────────────────────────────────────────

const refundByPaymentSchema = z.object({
  appointmentId: z.string(),
  scheduledAt: z.string().datetime(),
  cancelRefundHours: z.number().int().min(0),
})

app.post<{ Params: { id: string } }>("/payments/:id/refund", async (req, reply) => {
  if (!requireInternalKey(req)) return reply.status(401).send({ error: "Não autorizado" })

  const data = refundByPaymentSchema.parse(req.body)
  const result = await refundDepositForCancellation(
    data.appointmentId,
    new Date(data.scheduledAt),
    data.cancelRefundHours
  )
  return { result }
})

// ── Refund by appointment ID (para cancelamentos no monolito) ─────────────────

const refundByAppointmentSchema = z.object({
  scheduledAt: z.string().datetime(),
  cancelRefundHours: z.number().int().min(0),
})

app.post<{ Params: { appointmentId: string } }>(
  "/appointments/:appointmentId/refund",
  async (req, reply) => {
    if (!requireInternalKey(req)) return reply.status(401).send({ error: "Não autorizado" })
    const data = refundByAppointmentSchema.parse(req.body)
    const result = await refundDepositForCancellation(
      req.params.appointmentId,
      new Date(data.scheduledAt),
      data.cancelRefundHours
    )
    return { result }
  }
)

// ── MP Webhook ────────────────────────────────────────────────────────────────

app.post("/webhooks/mercadopago", async (req, reply) => {
  try {
    const url = new URL(`http://localhost${req.url}`)
    const body = req.body as Record<string, unknown>

    const dataId =
      (body?.data as Record<string, unknown>)?.id?.toString() ??
      url.searchParams.get("data.id") ??
      url.searchParams.get("id")

    const topic =
      body?.type ?? body?.topic ?? url.searchParams.get("type") ?? url.searchParams.get("topic")

    if (!dataId) return { ignored: true }
    if (topic && !String(topic).includes("payment")) return { ignored: true }

    if (!verifyMpSignature(req.headers as Record<string, string>, dataId)) {
      return reply.status(401).send({ error: "Assinatura inválida" })
    }

    const payment = await prisma.payment.findFirst({
      where: { providerPaymentId: dataId },
      select: { id: true },
    })
    if (!payment) return { ignored: true }

    await reconcilePayment(payment.id)
    return { received: true }
  } catch (err) {
    req.log.error(err, "MP webhook error")
    return { received: true }
  }
})

function verifyMpSignature(
  headers: Record<string, string>,
  dataId: string
): boolean {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET
  if (!secret) return true
  const signatureHeader = headers["x-signature"]
  const requestId = headers["x-request-id"] ?? ""
  if (!signatureHeader) return false
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

// ── MP OAuth — save tokens after monolith callback ───────────────────────────

app.post<{ Params: { tenantId: string } }>(
  "/tenants/:tenantId/mp/callback",
  async (req, reply) => {
    if (!requireInternalKey(req)) return reply.status(401).send({ error: "Não autorizado" })
    const { code } = z.object({ code: z.string() }).parse(req.body)
    const { tenantId } = req.params
    const { nickname } = await saveConnectionFromCode(tenantId, code)
    return { connected: true, nickname }
  }
)

// ── MP Connection info ────────────────────────────────────────────────────────

app.get<{ Params: { tenantId: string } }>(
  "/tenants/:tenantId/mp/connection",
  async (req, reply) => {
    if (!requireInternalKey(req)) return reply.status(401).send({ error: "Não autorizado" })
    const info = await getConnectionInfo(req.params.tenantId)
    if (!info) return reply.status(404).send({ connected: false })
    return info
  }
)

// ── MP Disconnect ─────────────────────────────────────────────────────────────

app.delete<{ Params: { tenantId: string } }>(
  "/tenants/:tenantId/mp",
  async (req, reply) => {
    if (!requireInternalKey(req)) return reply.status(401).send({ error: "Não autorizado" })
    await disconnect(req.params.tenantId)
    return { disconnected: true }
  }
)

// ── MP OAuth URL (para o monolito redirecionar) ───────────────────────────────

app.get<{ Params: { tenantId: string }; Querystring: { state: string } }>(
  "/tenants/:tenantId/mp/oauth-url",
  async (req, reply) => {
    if (!requireInternalKey(req)) return reply.status(401).send({ error: "Não autorizado" })
    if (!isMercadoPagoConfigured()) {
      return reply.status(503).send({ error: "Mercado Pago não configurado" })
    }
    return { url: getAuthorizationUrl(req.query.state) }
  }
)

// ── MP token (para chamadas internas do monolito) ─────────────────────────────

app.get<{ Params: { tenantId: string } }>(
  "/tenants/:tenantId/mp/token",
  async (req, reply) => {
    if (!requireInternalKey(req)) return reply.status(401).send({ error: "Não autorizado" })
    try {
      const token = await getTenantMpToken(req.params.tenantId)
      return { token }
    } catch {
      return reply.status(404).send({ error: "Não conectado" })
    }
  }
)

// ── Boot ──────────────────────────────────────────────────────────────────────

app.listen({ port: PORT, host: "0.0.0.0" }, (err) => {
  if (err) {
    app.log.error(err)
    process.exit(1)
  }
  app.log.info(`payment-service escutando na porta ${PORT}`)
})
