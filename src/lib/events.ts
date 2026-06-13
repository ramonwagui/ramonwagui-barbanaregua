/**
 * Publisher de eventos de domínio para o RabbitMQ.
 *
 * Strangler Fig Pattern — Fase 1:
 * O monolito publica eventos em vez de chamar microservices diretamente.
 * O Notification Service (e futuros microservices) consomem esses eventos.
 *
 * Se o AMQP_URL não estiver configurado (dev sem Docker), os eventos são
 * descartados com um log de aviso — nunca bloqueia o fluxo principal.
 */

import amqplib from "amqplib"
import type { DomainEvent } from "../../services/shared/events"
import { exchangeFor, routingKeyFor } from "../../services/shared/events"

// amqplib v0.10: connect() retorna ChannelModel (não Connection diretamente)
type AmqpConnection = Awaited<ReturnType<typeof amqplib.connect>>
type AmqpChannel = Awaited<ReturnType<AmqpConnection["createChannel"]>>

let connection: AmqpConnection | null = null
let channel: AmqpChannel | null = null
let connecting = false

const AMQP_URL = process.env.AMQP_URL

async function getChannel(): Promise<AmqpChannel | null> {
  if (!AMQP_URL) return null
  if (channel) return channel
  if (connecting) return null

  try {
    connecting = true
    connection = await amqplib.connect(AMQP_URL)
    channel = await connection.createChannel()

    // Declara os exchanges para garantir que existam
    for (const exchange of ["barbanaregua.appointments", "barbanaregua.payments", "barbanaregua.subscriptions"]) {
      await channel.assertExchange(exchange, "topic", { durable: true })
    }

    connection.on("error", () => {
      connection = null
      channel = null
      connecting = false
    })

    connection.on("close", () => {
      connection = null
      channel = null
      connecting = false
    })

    connecting = false
    return channel
  } catch (err) {
    console.warn("[events] RabbitMQ indisponível — eventos serão descartados:", (err as Error).message)
    connection = null
    channel = null
    connecting = false
    return null
  }
}

/**
 * Publica um evento de domínio no exchange correto.
 * Fire-and-forget: nunca lança exceção para o caller.
 */
export async function publishEvent(event: DomainEvent): Promise<void> {
  try {
    const ch = await getChannel()
    if (!ch) {
      console.warn(`[events] sem canal AMQP, evento descartado: ${event.type}`)
      return
    }

    const exchange = exchangeFor(event.type)
    const routingKey = routingKeyFor(event.type)
    const content = Buffer.from(JSON.stringify(event))

    ch.publish(exchange, routingKey, content, {
      persistent: true,
      contentType: "application/json",
      timestamp: Date.now(),
    })
  } catch (err) {
    // Nunca propagar — falha do event bus não deve quebrar a operação principal
    console.error(`[events] falha ao publicar ${event.type}:`, err)
  }
}

/**
 * Fecha a conexão AMQP ao encerrar o processo (SIGTERM/SIGINT).
 */
export async function closeEventBus(): Promise<void> {
  try {
    await channel?.close()
    await connection?.close()
  } catch {
    // ignore
  }
}
