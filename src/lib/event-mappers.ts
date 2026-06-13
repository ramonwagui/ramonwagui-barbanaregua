/**
 * Mappers de entidades Prisma para payloads de eventos de domínio.
 * Centraliza a serialização para evitar repetição nos call sites.
 */

import type { AppointmentPayload } from "../../services/shared/events"

interface AppointmentForEvent {
  id: string
  tenantId: string
  guestName?: string | null
  guestPhone?: string | null
  scheduledAt: Date
  endsAt: Date
  totalPrice: { toString(): string }
  depositAmount?: { toString(): string } | null
  cancellationReason?: string | null
  cancelledAt?: Date | null
  barber: {
    id: string
    user: { name?: string | null; phone?: string | null }
  }
  services: Array<{ service: { name: string } }>
  tenant: {
    name: string
    slug: string
    timezone?: string | null
    allowClientCancellation?: boolean | null
    notifyBarberEnabled?: boolean | null
  }
}

export function toAppointmentPayload(appt: AppointmentForEvent): AppointmentPayload {
  return {
    appointmentId: appt.id,
    tenantId: appt.tenantId,
    tenant: {
      name: appt.tenant.name,
      slug: appt.tenant.slug,
      timezone: appt.tenant.timezone ?? "America/Sao_Paulo",
      allowClientCancellation: appt.tenant.allowClientCancellation ?? false,
      notifyBarberEnabled: appt.tenant.notifyBarberEnabled ?? false,
    },
    guestName: appt.guestName ?? null,
    guestPhone: appt.guestPhone ?? null,
    scheduledAt: appt.scheduledAt.toISOString(),
    endsAt: appt.endsAt.toISOString(),
    totalPrice: appt.totalPrice.toString(),
    depositAmount: appt.depositAmount?.toString() ?? null,
    barber: {
      id: appt.barber.id,
      name: appt.barber.user.name ?? null,
      phone: appt.barber.user.phone ?? null,
    },
    services: appt.services.map((s) => ({ name: s.service.name })),
  }
}
