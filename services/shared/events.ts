/**
 * Definições canônicas de todos os eventos publicados no Message Queue.
 * Importe daqui tanto no monolito (publisher) quanto nos microservices (consumers).
 *
 * Naming convention: <dominio>.<acao> em snake_case.
 * O payload é sempre self-contained — o consumer não precisa fazer lookup adicional.
 */

// ─────────────────────────────────────────────
// Appointment Events
// ─────────────────────────────────────────────

/** Dados do appointment incluídos em todos os eventos de agendamento. */
export interface AppointmentPayload {
  appointmentId: string
  tenantId: string
  tenant: {
    name: string
    slug: string
    timezone: string
    allowClientCancellation: boolean
    notifyBarberEnabled: boolean
  }
  guestName: string | null
  guestPhone: string | null
  scheduledAt: string // ISO 8601
  endsAt: string // ISO 8601
  totalPrice: string // Decimal serializado como string
  depositAmount: string | null
  barber: {
    id: string
    name: string | null
    phone: string | null
  }
  services: Array<{ name: string }>
}

export interface AppointmentCreatedEvent {
  type: "appointment.created"
  payload: AppointmentPayload & {
    depositRequired: boolean
    paymentExpiresAt: string | null
  }
}

export interface AppointmentConfirmedEvent {
  type: "appointment.confirmed"
  payload: AppointmentPayload
}

export interface AppointmentCompletedEvent {
  type: "appointment.completed"
  payload: AppointmentPayload
}

export interface AppointmentCancelledEvent {
  type: "appointment.cancelled"
  payload: AppointmentPayload & {
    cancellationReason: string | null
    cancelledAt: string // ISO 8601
  }
}

export interface AppointmentReminderDueEvent {
  type: "appointment.reminder_due"
  payload: AppointmentPayload
}

// ─────────────────────────────────────────────
// Payment Events
// ─────────────────────────────────────────────

export interface PaymentPaidEvent {
  type: "payment.paid"
  payload: {
    paymentId: string
    tenantId: string
    /** Tipo do pagamento: depósito de agendamento ou compra de pacote. */
    referenceType: "appointment" | "package"
    referenceId: string
    amount: string
    paidAt: string
  }
}

export interface PaymentFailedEvent {
  type: "payment.failed"
  payload: {
    paymentId: string
    tenantId: string
    referenceType: "appointment" | "package"
    referenceId: string
  }
}

export interface PaymentRefundedEvent {
  type: "payment.refunded"
  payload: {
    paymentId: string
    tenantId: string
    referenceType: "appointment" | "package"
    referenceId: string
    refundAmount: string
  }
}

// ─────────────────────────────────────────────
// Subscription Events
// ─────────────────────────────────────────────

export interface SubscriptionActivatedEvent {
  type: "subscription.activated"
  payload: {
    tenantId: string
    plan: "BASIC" | "PRO" | "PREMIUM"
  }
}

export interface SubscriptionCancelledEvent {
  type: "subscription.cancelled"
  payload: { tenantId: string }
}

export interface SubscriptionPastDueEvent {
  type: "subscription.past_due"
  payload: { tenantId: string }
}

// ─────────────────────────────────────────────
// Union type — use para type guards no consumer
// ─────────────────────────────────────────────

export type DomainEvent =
  | AppointmentCreatedEvent
  | AppointmentConfirmedEvent
  | AppointmentCompletedEvent
  | AppointmentCancelledEvent
  | AppointmentReminderDueEvent
  | PaymentPaidEvent
  | PaymentFailedEvent
  | PaymentRefundedEvent
  | SubscriptionActivatedEvent
  | SubscriptionCancelledEvent
  | SubscriptionPastDueEvent

export type EventType = DomainEvent["type"]

// ─────────────────────────────────────────────
// Exchange e routing key constants
// ─────────────────────────────────────────────

export const EXCHANGES = {
  appointments: "barbanaregua.appointments",
  payments: "barbanaregua.payments",
  subscriptions: "barbanaregua.subscriptions",
} as const

export function routingKeyFor(eventType: EventType): string {
  // Remove o prefixo de domínio para obter o routing key limpo
  // ex: "appointment.confirmed" → "appointment.confirmed"
  return eventType
}

export function exchangeFor(eventType: EventType): string {
  if (eventType.startsWith("appointment.")) return EXCHANGES.appointments
  if (eventType.startsWith("payment.")) return EXCHANGES.payments
  if (eventType.startsWith("subscription.")) return EXCHANGES.subscriptions
  throw new Error(`No exchange configured for event type: ${eventType}`)
}
