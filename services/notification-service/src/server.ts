import Fastify from "fastify"
import cors from "@fastify/cors"
import { startConsumer } from "./queue/consumer"
import { closeConnection, getChannel } from "./queue/connection"
import { prisma } from "./lib/prisma"

const PORT = Number(process.env.PORT ?? 3007)
const HOST = process.env.HOST ?? "0.0.0.0"

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
// Health check — liveness + readiness
// ─────────────────────────────────────────────

app.get("/health", async (_, reply) => {
  let dbOk = false
  let queueOk = false

  try {
    await prisma.$queryRaw`SELECT 1`
    dbOk = true
  } catch {
    // db indisponível
  }

  try {
    await getChannel()
    queueOk = true
  } catch {
    // queue indisponível
  }

  const healthy = dbOk && queueOk
  const status = healthy ? 200 : 503

  return reply.status(status).send({
    status: healthy ? "healthy" : "degraded",
    service: "notification-service",
    version: process.env.npm_package_version ?? "1.0.0",
    checks: {
      db: dbOk ? "connected" : "disconnected",
      queue: queueOk ? "connected" : "disconnected",
    },
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  })
})

// ─────────────────────────────────────────────
// API interna — sincronização de WebhookSettings
// ─────────────────────────────────────────────

/** Sincroniza configurações Z-API de um tenant (chamado pelo monolito ao atualizar). */
app.put<{
  Params: { tenantId: string }
  Body: {
    zapiToken?: string | null
    zapiInstance?: string | null
    twilioSid?: string | null
    twilioToken?: string | null
    resendApiKey?: string | null
  }
}>("/internal/tenants/:tenantId/webhook-settings", async (request, reply) => {
  const internalKey = request.headers["x-internal-key"]
  if (internalKey !== process.env.INTERNAL_API_KEY) {
    return reply.status(401).send({ error: "Unauthorized" })
  }

  const { tenantId } = request.params
  const data = request.body

  await prisma.webhookSetting.upsert({
    where: { tenantId },
    create: { tenantId, ...data },
    update: data,
  })

  return reply.status(204).send()
})

// ─────────────────────────────────────────────
// Startup
// ─────────────────────────────────────────────

async function start() {
  try {
    await app.listen({ port: PORT, host: HOST })
    app.log.info(`notification-service rodando em http://${HOST}:${PORT}`)

    await startConsumer()
    app.log.info("consumer RabbitMQ iniciado")
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

// Graceful shutdown
process.on("SIGTERM", async () => {
  app.log.info("SIGTERM recebido, encerrando...")
  await app.close()
  await closeConnection()
  await prisma.$disconnect()
  process.exit(0)
})

process.on("SIGINT", async () => {
  await app.close()
  await closeConnection()
  await prisma.$disconnect()
  process.exit(0)
})

start()
