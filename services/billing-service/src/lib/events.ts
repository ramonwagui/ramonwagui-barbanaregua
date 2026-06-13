import amqplib from "amqplib"
import type { DomainEvent } from "../../../shared/events"
import { exchangeFor, routingKeyFor } from "../../../shared/events"

type AmqpConnection = Awaited<ReturnType<typeof amqplib.connect>>
type AmqpChannel = Awaited<ReturnType<AmqpConnection["createChannel"]>>

let connection: AmqpConnection | null = null
let channel: AmqpChannel | null = null

const AMQP_URL = process.env.AMQP_URL

export async function initEventPublisher(): Promise<void> {
  if (!AMQP_URL) return
  try {
    connection = await amqplib.connect(AMQP_URL)
    channel = await connection.createChannel()
    for (const exchange of ["barbanaregua.appointments", "barbanaregua.payments", "barbanaregua.subscriptions"]) {
      await channel.assertExchange(exchange, "topic", { durable: true })
    }
    console.info("[billing-events] publisher RabbitMQ conectado")
  } catch (err) {
    console.warn("[billing-events] RabbitMQ indisponível, eventos descartados:", (err as Error).message)
  }
}

export function publishEvent(event: DomainEvent): void {
  try {
    if (!channel) {
      console.warn(`[billing-events] sem canal, evento descartado: ${event.type}`)
      return
    }
    const exchange = exchangeFor(event.type)
    const routingKey = routingKeyFor(event.type)
    channel.publish(
      exchange,
      routingKey,
      Buffer.from(JSON.stringify(event)),
      { persistent: true, contentType: "application/json" }
    )
  } catch (err) {
    console.error(`[billing-events] falha ao publicar ${event.type}:`, err)
  }
}

export async function closeEventPublisher(): Promise<void> {
  try {
    await channel?.close()
    await connection?.close()
  } catch {
    // ignore
  }
}
