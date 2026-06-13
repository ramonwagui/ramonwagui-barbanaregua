import amqplib, { type Connection, type Channel } from "amqplib"
import { EXCHANGES } from "../../../shared/events"

let connection: Connection | null = null
let channel: Channel | null = null

const AMQP_URL = process.env.AMQP_URL ?? "amqp://guest:guest@localhost:5672"

/** Tenta conectar ao RabbitMQ com backoff exponencial. */
async function connect(attempt = 1): Promise<{ connection: Connection; channel: Channel }> {
  try {
    connection = await amqplib.connect(AMQP_URL)
    channel = await connection.createChannel()

    // Prefetch 1: processa uma mensagem por vez antes de ACK
    await channel.prefetch(1)

    // Declarar exchanges como "topic" e duráveis
    for (const exchange of Object.values(EXCHANGES)) {
      await channel.assertExchange(exchange, "topic", { durable: true })
    }

    // Dead Letter Exchange para reprocessamento
    await channel.assertExchange("barbanaregua.dlx", "topic", { durable: true })

    connection.on("error", (err) => {
      console.error("[AMQP] connection error:", err.message)
      connection = null
      channel = null
      reconnect()
    })

    connection.on("close", () => {
      console.warn("[AMQP] connection closed, reconnecting...")
      connection = null
      channel = null
      reconnect()
    })

    console.info("[AMQP] connected to RabbitMQ")
    return { connection, channel }
  } catch (err) {
    const delay = Math.min(1000 * 2 ** attempt, 30_000) // max 30s
    console.error(`[AMQP] connection failed (attempt ${attempt}), retrying in ${delay}ms...`)
    await new Promise((r) => setTimeout(r, delay))
    return connect(attempt + 1)
  }
}

function reconnect() {
  setTimeout(() => connect(), 5_000)
}

export async function getChannel(): Promise<Channel> {
  if (channel) return channel
  const result = await connect()
  return result.channel
}

export async function closeConnection(): Promise<void> {
  try {
    await channel?.close()
    await connection?.close()
  } catch {
    // ignore errors on shutdown
  }
}
