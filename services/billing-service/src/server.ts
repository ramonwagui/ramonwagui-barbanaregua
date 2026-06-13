import Fastify from "fastify"
import cors from "@fastify/cors"
import { prisma } from "./lib/prisma"
import { isBillingConfigured } from "./lib/stripe"
import { initEventPublisher, closeEventPublisher, publishEvent } from "./lib/events"
import {
  createCheckoutSession,
  createPortalSession,
  syncStripeSubscription,
  markPastDueBySubscriptionId,
} from "./lib/billing"
import { PLAN_LIMITS } from "./lib/plans"
import { PlanTier, SubscriptionStatus } from "@prisma/client"
import { addDays } from "date-fns"
import { z } from "zod"
import Stripe from "stripe"
import { stripe } from "./lib/stripe"

const PORT = Number(process.env.PORT ?? 3006)
const HOST = process.env.HOST ?? "0.0.0.0"
const INTERNAL_KEY = process.env.INTERNAL_API_KEY ?? ""

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL ?? "info",
    transport:
      process.env.NODE_ENV === "development"
        ? { target: "pino-pretty", options: { colorize: true } }
        : undefined,
  },
})

await app.register(cors, { origin: false })

// ─────────────────────────────────────────────
// Guard para chamadas internas (monolito → billing service)
// ─────────────────────────────────────────────

function requireInternalKey(req: Parameters<typeof app.get>[1] extends (...args: infer A) => unknown ? A[0] : never): boolean {
  return req.headers["x-internal-key"] === INTERNAL_KEY
}

// ─────────────────────────────────────────────
// Health Check
// ─────────────────────────────────────────────

app.get("/health", async (_, reply) => {
  let dbOk = false
  try {
    await prisma.$queryRaw`SELECT 1`
    dbOk = true
  } catch {
    // db indisponível
  }
  const healthy = dbOk
  return reply.status(healthy ? 200 : 503).send({
    status: healthy ? "healthy" : "degraded",
    service: "billing-service",
    version: process.env.npm_package_version ?? "1.0.0",
    checks: { db: dbOk ? "connected" : "disconnected", stripe: isBillingConfigured() ? "configured" : "not configured" },
    uptime: process.uptime(),
  })
})

// ─────────────────────────────────────────────
// Subscriptions CRUD (chamado pelo monolito internamente)
// ─────────────────────────────────────────────

/** Cria trial de 14 dias ao registrar novo tenant. */
app.post<{ Body: { tenantId: string; email?: string } }>(
  "/subscriptions",
  async (req, reply) => {
    if (!requireInternalKey(req)) return reply.status(401).send({ error: "Unauthorized" })

    const { tenantId } = req.body
    if (!tenantId) return reply.status(400).send({ error: "tenantId obrigatório" })

    const existing = await prisma.subscription.findUnique({ where: { tenantId } })
    if (existing) return reply.status(200).send(serialize(existing))

    const trialEndsAt = addDays(new Date(), 14)
    const sub = await prisma.subscription.create({
      data: {
        tenantId,
        plan: "BASIC",
        status: "TRIALING",
        currentPeriodStart: new Date(),
        currentPeriodEnd: trialEndsAt,
        trialEndsAt,
      },
    })
    return reply.status(201).send(serialize(sub))
  }
)

/** Retorna status da assinatura de um tenant. Usado pelo monolito para gating. */
app.get<{ Params: { tenantId: string } }>(
  "/subscriptions/:tenantId",
  async (req, reply) => {
    if (!requireInternalKey(req)) return reply.status(401).send({ error: "Unauthorized" })

    const sub = await prisma.subscription.findUnique({
      where: { tenantId: req.params.tenantId },
    })
    if (!sub) return reply.status(404).send({ error: "Subscription não encontrada" })
    return reply.send(serialize(sub))
  }
)

/** Override manual de assinatura (super admin). */
const overrideSchema = z.object({
  plan: z.enum(["BASIC", "PRO", "PREMIUM"]),
  status: z.enum(["TRIALING", "ACTIVE", "PAST_DUE", "CANCELLED"]),
  currentPeriodEnd: z.coerce.date(),
  trialEndsAt: z.coerce.date().nullable().optional(),
})

app.patch<{ Params: { tenantId: string }; Body: unknown }>(
  "/subscriptions/:tenantId",
  async (req, reply) => {
    if (!requireInternalKey(req)) return reply.status(401).send({ error: "Unauthorized" })

    const data = overrideSchema.parse(req.body)
    const sub = await prisma.subscription.upsert({
      where: { tenantId: req.params.tenantId },
      update: { ...data, trialEndsAt: data.trialEndsAt ?? null, currentPeriodStart: new Date() },
      create: {
        tenantId: req.params.tenantId,
        ...data,
        trialEndsAt: data.trialEndsAt ?? null,
        currentPeriodStart: new Date(),
      },
    })
    return reply.send(serialize(sub))
  }
)

/** Retorna os limites do plano (evita duplicar PLAN_LIMITS no monolito). */
app.get<{ Params: { tenantId: string } }>(
  "/subscriptions/:tenantId/limits",
  async (req, reply) => {
    if (!requireInternalKey(req)) return reply.status(401).send({ error: "Unauthorized" })

    const sub = await prisma.subscription.findUnique({
      where: { tenantId: req.params.tenantId },
      select: { plan: true },
    })
    const plan = sub?.plan ?? PlanTier.BASIC
    return reply.send(PLAN_LIMITS[plan])
  }
)

// ─────────────────────────────────────────────
// Checkout & Portal (proxy autenticado pelo monolito, passa tenantId via header)
// ─────────────────────────────────────────────

app.post<{ Body: { plan: string; email: string; priceIdOverride?: string | null } }>(
  "/checkout",
  async (req, reply) => {
    if (!requireInternalKey(req)) return reply.status(401).send({ error: "Unauthorized" })

    const tenantId = req.headers["x-tenant-id"] as string
    if (!tenantId) return reply.status(400).send({ error: "x-tenant-id header obrigatório" })
    if (!isBillingConfigured()) return reply.status(503).send({ error: "Billing não configurado" })

    const plan = req.body.plan as PlanTier
    if (!["BASIC", "PRO", "PREMIUM"].includes(plan)) {
      return reply.status(400).send({ error: "Plano inválido" })
    }

    const sub = await prisma.subscription.findUnique({
      where: { tenantId },
      select: { stripeCustomerId: true },
    })

    try {
      const session = await createCheckoutSession({
        tenantId,
        plan,
        email: req.body.email,
        customerId: sub?.stripeCustomerId,
        priceIdOverride: req.body.priceIdOverride ?? null,
      })
      return reply.send({ url: session.url })
    } catch (err) {
      app.log.error(err)
      return reply.status(500).send({ error: "Não foi possível iniciar o pagamento" })
    }
  }
)

app.post("/portal", async (req, reply) => {
  if (!requireInternalKey(req)) return reply.status(401).send({ error: "Unauthorized" })

  const tenantId = req.headers["x-tenant-id"] as string
  if (!tenantId) return reply.status(400).send({ error: "x-tenant-id header obrigatório" })
  if (!isBillingConfigured()) return reply.status(503).send({ error: "Billing não configurado" })

  const sub = await prisma.subscription.findUnique({
    where: { tenantId },
    select: { stripeCustomerId: true },
  })
  if (!sub?.stripeCustomerId) {
    return reply.status(400).send({ error: "Nenhuma assinatura com Stripe vinculada" })
  }

  try {
    const portal = await createPortalSession(sub.stripeCustomerId)
    return reply.send({ url: portal.url })
  } catch (err) {
    app.log.error(err)
    return reply.status(500).send({ error: "Não foi possível abrir o portal" })
  }
})

// ─────────────────────────────────────────────
// Stripe Webhook (recebe eventos diretamente do Stripe)
// ─────────────────────────────────────────────

app.addContentTypeParser("application/json", { parseAs: "buffer" }, (_req, body, done) => {
  done(null, body)
})

app.post<{ Body: Buffer }>("/webhooks/stripe", async (req, reply) => {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  const sig = req.headers["stripe-signature"] as string

  if (!secret || !sig) {
    return reply.status(400).send({ error: "Webhook não configurado" })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, secret)
  } catch (err) {
    app.log.error("[stripe webhook] assinatura inválida:", err)
    return reply.status(400).send({ error: "Assinatura inválida" })
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.data.object as Stripe.Checkout.Session
        if (s.subscription) {
          const subId = typeof s.subscription === "string" ? s.subscription : s.subscription.id
          const sub = await stripe.subscriptions.retrieve(subId)
          await syncStripeSubscription(sub)
          if (s.metadata?.tenantId) {
            publishEvent({ type: "subscription.activated", payload: { tenantId: s.metadata.tenantId, plan: (sub.metadata?.plan as "BASIC" | "PRO" | "PREMIUM") ?? "BASIC" } })
          }
        }
        break
      }
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription
        await syncStripeSubscription(sub)
        if (sub.status === "active" && sub.metadata?.tenantId) {
          publishEvent({ type: "subscription.activated", payload: { tenantId: sub.metadata.tenantId, plan: (sub.metadata.plan as "BASIC" | "PRO" | "PREMIUM") ?? "BASIC" } })
        }
        break
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription
        await syncStripeSubscription(sub)
        if (sub.metadata?.tenantId) {
          publishEvent({ type: "subscription.cancelled", payload: { tenantId: sub.metadata.tenantId } })
        }
        break
      }
      case "invoice.payment_failed": {
        const inv = event.data.object as unknown as { subscription?: string | { id: string }; metadata?: { tenantId?: string } }
        const subId = typeof inv.subscription === "string" ? inv.subscription : inv.subscription?.id
        if (subId) {
          await markPastDueBySubscriptionId(subId)
          if (inv.metadata?.tenantId) {
            publishEvent({ type: "subscription.past_due", payload: { tenantId: inv.metadata.tenantId } })
          }
        }
        break
      }
      default:
        break
    }
  } catch (err) {
    app.log.error("[stripe webhook] erro ao processar", event.type, err)
  }

  return reply.send({ received: true })
})

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function serialize(sub: {
  id: string
  tenantId: string
  plan: PlanTier
  status: SubscriptionStatus
  stripeCustomerId?: string | null
  stripeSubscriptionId?: string | null
  currentPeriodStart: Date
  currentPeriodEnd: Date
  cancelAtPeriodEnd: boolean
  trialEndsAt?: Date | null
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: sub.id,
    tenantId: sub.tenantId,
    plan: sub.plan,
    status: sub.status,
    stripeCustomerId: sub.stripeCustomerId ?? null,
    stripeSubscriptionId: sub.stripeSubscriptionId ?? null,
    currentPeriodStart: sub.currentPeriodStart.toISOString(),
    currentPeriodEnd: sub.currentPeriodEnd.toISOString(),
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    trialEndsAt: sub.trialEndsAt?.toISOString() ?? null,
    createdAt: sub.createdAt.toISOString(),
    updatedAt: sub.updatedAt.toISOString(),
  }
}

// ─────────────────────────────────────────────
// Startup & Shutdown
// ─────────────────────────────────────────────

async function start() {
  try {
    await initEventPublisher()
    await app.listen({ port: PORT, host: HOST })
    app.log.info(`billing-service rodando em http://${HOST}:${PORT}`)
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

process.on("SIGTERM", async () => {
  await app.close()
  await closeEventPublisher()
  await prisma.$disconnect()
  process.exit(0)
})

process.on("SIGINT", async () => {
  await app.close()
  await closeEventPublisher()
  await prisma.$disconnect()
  process.exit(0)
})

start()
