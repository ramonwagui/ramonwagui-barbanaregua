import { prisma } from "@/lib/prisma"
import { NotifChannel, NotifType, NotifStatus } from "@prisma/client"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"

interface AppointmentNotifData {
  id: string
  tenantId: string
  guestName?: string | null
  guestPhone?: string | null
  scheduledAt: Date
  barber: { user: { name: string | null } }
  tenant: { name: string; slug: string }
  services: Array<{ service: { name: string } }>
  totalPrice: unknown
}

function buildCancelUrl(appointmentId: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  return `${base}/api/appointments/${appointmentId}/cancel`
}

function formatPrice(price: unknown): string {
  return `R$ ${Number(price).toFixed(2).replace(".", ",")}`
}

function buildBookingUrl(slug: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  return `${base}/b/${slug}`
}

function buildConfirmationMessage(appt: AppointmentNotifData): string {
  const clientName = appt.guestName ?? "Cliente"
  const barberName = appt.barber.user.name ?? "Barbeiro"
  const serviceNames = appt.services.map((s) => s.service.name).join(" + ")
  const dateStr = format(appt.scheduledAt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
  const price = formatPrice(appt.totalPrice)
  const cancelUrl = buildCancelUrl(appt.id)

  return (
    `Olá ${clientName}! ✂️ Seu agendamento foi confirmado na ${appt.tenant.name}.\n` +
    `📅 ${dateStr}\n` +
    `✂️ ${serviceNames} com ${barberName}\n` +
    `💰 ${price}\n\n` +
    `Para cancelar: ${cancelUrl}`
  )
}

function buildReminderMessage(appt: AppointmentNotifData): string {
  const clientName = appt.guestName ?? "Cliente"
  const barberName = appt.barber.user.name ?? "Barbeiro"
  const serviceNames = appt.services.map((s) => s.service.name).join(" + ")
  const dateStr = format(appt.scheduledAt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
  const cancelUrl = buildCancelUrl(appt.id)

  return (
    `Lembrete! ✂️ Amanhã você tem agendamento na ${appt.tenant.name}.\n` +
    `📅 ${dateStr}\n` +
    `✂️ ${serviceNames} com ${barberName}\n\n` +
    `Para cancelar: ${cancelUrl}`
  )
}

function buildCancellationMessage(appt: AppointmentNotifData): string {
  const clientName = appt.guestName ?? "Cliente"
  const dateStr = format(appt.scheduledAt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
  const bookingUrl = buildBookingUrl(appt.tenant.slug)

  return (
    `Olá ${clientName}, seu agendamento em ${appt.tenant.name} foi cancelado.\n` +
    `📅 ${dateStr}\n\n` +
    `Para reagendar: ${bookingUrl}`
  )
}

async function getWebhookSettings(tenantId: string) {
  return prisma.webhookSetting.findUnique({ where: { tenantId } })
}

async function sendViaZApi(
  phone: string,
  message: string,
  instanceId: string,
  token: string,
  clientToken: string
): Promise<boolean> {
  try {
    const cleanPhone = phone.replace(/\D/g, "")
    const res = await fetch(
      `https://api.z-api.io/instances/${instanceId}/token/${token}/send-text`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "client-token": clientToken,
        },
        body: JSON.stringify({ phone: cleanPhone, message }),
      }
    )
    return res.ok
  } catch {
    return false
  }
}

async function dispatchNotification(opts: {
  tenantId: string
  appointmentId: string
  phone: string | null | undefined
  body: string
  type: NotifType
}) {
  const settings = await getWebhookSettings(opts.tenantId)

  let sent = false
  let channel: NotifChannel = NotifChannel.WHATSAPP
  let errorMsg: string | undefined

  if (opts.phone && settings?.zapiInstance && settings.zapiToken) {
    const clientToken = process.env.ZAPI_CLIENT_TOKEN ?? settings.zapiToken
    sent = await sendViaZApi(
      opts.phone,
      opts.body,
      settings.zapiInstance,
      settings.zapiToken,
      clientToken
    )
  }

  await prisma.notification.create({
    data: {
      tenantId: opts.tenantId,
      appointmentId: opts.appointmentId,
      channel,
      type: opts.type,
      recipientPhone: opts.phone ?? undefined,
      body: opts.body,
      status: sent ? NotifStatus.SENT : NotifStatus.FAILED,
      sentAt: sent ? new Date() : undefined,
      errorMsg: sent ? undefined : "WhatsApp não configurado ou falhou",
    },
  })
}

export async function sendBookingConfirmation(appt: AppointmentNotifData) {
  const message = buildConfirmationMessage(appt)
  const phone = appt.guestPhone

  // Fire and forget — não bloqueia a criação do agendamento
  dispatchNotification({
    tenantId: appt.tenantId,
    appointmentId: appt.id,
    phone,
    body: message,
    type: NotifType.BOOKING_CONFIRMATION,
  }).catch(console.error)
}

export async function sendBookingReminder(appt: AppointmentNotifData) {
  const message = buildReminderMessage(appt)
  const phone = appt.guestPhone

  await dispatchNotification({
    tenantId: appt.tenantId,
    appointmentId: appt.id,
    phone,
    body: message,
    type: NotifType.BOOKING_REMINDER_24H,
  })
}

export async function sendBookingCancellation(appt: AppointmentNotifData) {
  const message = buildCancellationMessage(appt)
  const phone = appt.guestPhone

  dispatchNotification({
    tenantId: appt.tenantId,
    appointmentId: appt.id,
    phone,
    body: message,
    type: NotifType.BOOKING_CANCELLED,
  }).catch(console.error)
}
