import { getChannel } from "./connection"
import { EXCHANGES, type DomainEvent } from "../../../shared/events"
import { handleAppointmentEvent } from "../handlers/appointment"

const QUEUE_NAME = "notification-service"
const DLQ_NAME = "notification-service.dlq"
const MAX_RETRIES = 3
const RETRY_DELAY_MS = 60_000 // 60s entre retentativas

/** Roteia o evento para o handler correto. */
async function dispatchEvent(event: DomainEvent): Promise<void> {
  switch (event.type) {
    case "appointment.confirmed":
    case "appointment.cancelled":
    case "appointment.completed":
    case "appointment.reminder_due":
      await handleAppointmentEvent(event)
      return
    default:
      console.warn("[consumer] evento sem handler:", (event as { type: string }).type)
  }
}

export async function startConsumer(): Promise<void> {
  const ch = await getChannel()

  // Fila principal com Dead Letter Exchange configurado
  await ch.assertQueue(QUEUE_NAME, {
    durable: true,
    arguments: {
      "x-dead-letter-exchange": "barbanaregua.dlx",
      "x-dead-letter-routing-key": "dlq.notification",
    },
  })

  // Dead Letter Queue — mensagens que falharam após MAX_RETRIES
  await ch.assertQueue(DLQ_NAME, { durable: true })
  await ch.bindQueue(DLQ_NAME, "barbanaregua.dlx", "dlq.notification")

  // Binding: escuta todos os eventos de appointment e payment.paid
  for (const exchange of Object.values(EXCHANGES)) {
    await ch.bindQueue(QUEUE_NAME, exchange, "appointment.#")
    await ch.bindQueue(QUEUE_NAME, exchange, "payment.paid")
    await ch.bindQueue(QUEUE_NAME, exchange, "subscription.past_due")
  }

  console.info("[consumer] aguardando eventos na fila:", QUEUE_NAME)

  await ch.consume(QUEUE_NAME, async (msg) => {
    if (!msg) return

    let event: DomainEvent
    try {
      event = JSON.parse(msg.content.toString()) as DomainEvent
    } catch {
      console.error("[consumer] mensagem inválida (não é JSON), descartando")
      ch.nack(msg, false, false) // requeue=false → vai para DLQ
      return
    }

    const retryCount = (msg.properties.headers?.["x-retry-count"] as number) ?? 0

    try {
      console.info(`[consumer] processando: ${event.type} (tentativa ${retryCount + 1})`)
      await dispatchEvent(event)
      ch.ack(msg)
      console.info(`[consumer] processado: ${event.type}`)
    } catch (err) {
      console.error(`[consumer] falhou ao processar ${event.type}:`, err)

      if (retryCount < MAX_RETRIES) {
        // Republica na fila com delay e contador de retentativas
        setTimeout(() => {
          try {
            const exchange = event.type.split(".")[0]
            ch.publish(
              `barbanaregua.${exchange}s`,
              event.type,
              msg.content,
              {
                persistent: true,
                headers: { "x-retry-count": retryCount + 1 },
              }
            )
            ch.ack(msg)
          } catch (publishErr) {
            console.error("[consumer] falhou ao republir para retry:", publishErr)
            ch.nack(msg, false, false)
          }
        }, RETRY_DELAY_MS)
      } else {
        console.error(`[consumer] max retries (${MAX_RETRIES}) atingido para ${event.type}, enviando para DLQ`)
        ch.nack(msg, false, false)
      }
    }
  })
}
