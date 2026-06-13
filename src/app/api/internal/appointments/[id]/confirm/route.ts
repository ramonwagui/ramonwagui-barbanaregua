import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { publishEvent } from "@/lib/events"
import { toAppointmentPayload } from "@/lib/event-mappers"

const INTERNAL_KEY = process.env.INTERNAL_API_KEY ?? ""

/**
 * Chamado pelo Payment Service após um depósito PIX ser aprovado.
 * Confirma o agendamento e publica appointment.confirmed para o
 * Notification Service enviar a confirmação por WhatsApp.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (INTERNAL_KEY && req.headers.get("x-internal-key") !== INTERNAL_KEY) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  const { id: appointmentId } = await params

  const updated = await prisma.appointment.updateMany({
    where: { id: appointmentId, status: "PENDING" },
    data: { status: "CONFIRMED", paymentExpiresAt: null },
  })

  // Nada atualizado — já estava CONFIRMED ou não existe
  if (updated.count === 0) {
    return NextResponse.json({ confirmed: false, reason: "already_confirmed_or_not_found" })
  }

  const appt = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      services: { include: { service: true } },
      barber: { include: { user: { select: { name: true, phone: true } } } },
      tenant: true,
    },
  })

  if (appt) {
    publishEvent({ type: "appointment.confirmed", payload: toAppointmentPayload(appt) })
  }

  return NextResponse.json({ confirmed: true })
}
