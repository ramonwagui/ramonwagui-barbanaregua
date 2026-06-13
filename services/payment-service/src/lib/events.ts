import amqplib from "amqplib"
import { EXCHANGES } from "../../../shared/events"

type AmqpConnection = Awaited<ReturnType<typeof amqplib.connect>>

let conn: AmqpConnection | null = null

async function getConnection(): Promise<AmqpConnection | null> {
  const url = process.env.AMQP_URL
  if (!url) return null
  if (conn) return conn
  try {
    conn = await amqplib.connect(url)
    conn.on("error", () => { conn = null })
    conn.on("close", () => { conn = null })
    return conn
  } catch {
    return null
  }
}

export interface PaymentPaidEvent {
  type: "payment.paid"
  payload: {
    paymentId: string
    tenantId: string
    appointmentId?: string
    packageId?: string
    amount: number
    kind: "appointment" | "package"
  }
}

export interface PaymentFailedEvent {
  type: "payment.failed"
  payload: { paymentId: string; tenantId: string }
}

export interface PaymentRefundedEvent {
  type: "payment.refunded"
  payload: { paymentId: string; tenantId: string; amount: number }
}

type PaymentEvent = PaymentPaidEvent | PaymentFailedEvent | PaymentRefundedEvent

export async function publishEvent(event: PaymentEvent): Promise<void> {
  const connection = await getConnection()
  if (!connection) return
  try {
    const ch = await connection.createChannel()
    const exchange = EXCHANGES.payments
    await ch.assertExchange(exchange, "topic", { durable: true })
    ch.publish(exchange, event.type, Buffer.from(JSON.stringify(event.payload)), {
      persistent: true,
      contentType: "application/json",
    })
    await ch.close()
  } catch (err) {
    console.error("[events] publishEvent falhou:", err)
  }
}
