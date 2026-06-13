import type {
  AppointmentConfirmedEvent,
  AppointmentCancelledEvent,
  AppointmentCompletedEvent,
  AppointmentReminderDueEvent,
} from "../../../../shared/events"
import {
  sendBookingConfirmation,
  sendBookingCancellation,
  sendBookingReminder,
  sendBarberNewBooking,
  sendBarberCancellation,
} from "../lib/notifications"

type AppointmentEvent =
  | AppointmentConfirmedEvent
  | AppointmentCancelledEvent
  | AppointmentCompletedEvent
  | AppointmentReminderDueEvent

export async function handleAppointmentEvent(event: AppointmentEvent): Promise<void> {
  const { payload } = event

  switch (event.type) {
    case "appointment.confirmed":
      await Promise.all([
        sendBookingConfirmation(payload),
        sendBarberNewBooking(payload),
      ])
      break

    case "appointment.cancelled":
      await Promise.all([
        sendBookingCancellation(payload),
        sendBarberCancellation(payload),
      ])
      break

    case "appointment.reminder_due":
      await sendBookingReminder(payload)
      break

    case "appointment.completed":
      // completed não gera notificação por padrão; reservado para expansão futura
      break

    default: {
      const _exhaustive: never = event
      console.warn("[appointment-handler] evento desconhecido:", (_exhaustive as { type: string }).type)
    }
  }
}
