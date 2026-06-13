import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { publishEvent } from "@/lib/events"
import { toAppointmentPayload } from "@/lib/event-mappers"

/**
 * Cron (Railway): envia o lembrete de agendamento (template barbearia_lembrete)
 * para agendamentos CONFIRMADOS que acontecem nas próximas 24h e que ainda não
 * receberam lembrete (reminderSent=false). Marca reminderSent=true para não
 * repetir, independentemente da frequência do cron.
 *
 * Proteção: header `Authorization: Bearer <CRON_SECRET>` ou `?secret=<CRON_SECRET>`.
 */
export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  const now = new Date()
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000)

  const due = await prisma.appointment.findMany({
    where: {
      status: "CONFIRMED",
      reminderSent: false,
      scheduledAt: { gte: now, lte: in24h },
    },
    include: {
      barber: { include: { user: { select: { name: true, phone: true } } } },
      services: { include: { service: true } },
      tenant: true,
    },
  })

  let sent = 0
  for (const appt of due) {
    try {
      // Publica o evento: o Notification Service consome e envia o lembrete.
      // Marca reminderSent=true imediatamente para não reenviar em loop.
      publishEvent({ type: "appointment.reminder_due", payload: toAppointmentPayload(appt) })
      await prisma.appointment.update({
        where: { id: appt.id },
        data: { reminderSent: true },
      })
      sent++
    } catch (err) {
      console.error("[send-reminders] falha no agendamento", appt.id, err)
    }
  }

  return NextResponse.json({ found: due.length, sent })
}

function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false

  const auth = req.headers.get("authorization")
  if (auth === `Bearer ${secret}`) return true

  const url = new URL(req.url)
  return url.searchParams.get("secret") === secret
}
