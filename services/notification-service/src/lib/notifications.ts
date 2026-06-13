/**
 * Core de envio de notificações — migrado de src/lib/notifications.ts do monolito.
 *
 * Provider principal: WhatsApp Cloud API (Meta), número central da plataforma.
 * Fallback: Z-API por tenant (texto livre), lido de WebhookSetting no DB próprio.
 *
 * Circuit breakers em circuit-breaker.ts protegem ambas as integrações externas.
 */

import { NotifChannel, NotifStatus, NotifType } from "@prisma/client"
import { prisma } from "./prisma"
import { whatsAppCloudBreaker, zapiBreaker } from "./circuit-breaker"
import type { AppointmentPayload } from "../../../shared/events"

const DEFAULT_TZ = "America/Sao_Paulo"

// ─────────────────────────────────────────────
// Formatadores de data/hora no fuso do salão
// ─────────────────────────────────────────────

function fmtDate(scheduledAt: Date, timezone: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: timezone || DEFAULT_TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(scheduledAt)
}

function fmtTime(scheduledAt: Date, timezone: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: timezone || DEFAULT_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(scheduledAt)
}

function fmtDateTime(scheduledAt: Date, timezone: string): string {
  return `${fmtDate(scheduledAt, timezone)} às ${fmtTime(scheduledAt, timezone)}`
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function buildCancelUrl(slug: string, appointmentId: string): string {
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "")
  return `${base}/b/${slug}/cancelar?id=${appointmentId}`
}

function buildBookingUrl(slug: string): string {
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "")
  return `${base}/b/${slug}`
}

function formatPrice(price: string): string {
  return `R$ ${Number(price).toFixed(2).replace(".", ",")}`
}

function toWhatsAppNumber(raw: string): string {
  let d = raw.replace(/\D/g, "")
  if (d.length <= 11) d = `55${d}`
  return d
}

// ─────────────────────────────────────────────
// Mensagens de texto livre (fallback Z-API e log)
// ─────────────────────────────────────────────

function buildConfirmationText(payload: AppointmentPayload): string {
  const dt = fmtDateTime(new Date(payload.scheduledAt), payload.tenant.timezone)
  const services = payload.services.map((s) => s.name).join(" + ")
  const base =
    `Olá ${payload.guestName ?? "Cliente"}! ✂️ Seu agendamento foi confirmado na ${payload.tenant.name}.\n` +
    `📅 ${dt}\n` +
    `✂️ ${services} com ${payload.barber.name ?? "Barbeiro"}\n` +
    `💰 ${formatPrice(payload.totalPrice)}`
  if (payload.tenant.allowClientCancellation) {
    return `${base}\n\nPara cancelar: ${buildCancelUrl(payload.tenant.slug, payload.appointmentId)}`
  }
  return base
}

function buildReminderText(payload: AppointmentPayload): string {
  const dt = fmtDateTime(new Date(payload.scheduledAt), payload.tenant.timezone)
  const services = payload.services.map((s) => s.name).join(" + ")
  const base =
    `Lembrete! ✂️ Você tem agendamento na ${payload.tenant.name}.\n` +
    `📅 ${dt}\n` +
    `✂️ ${services} com ${payload.barber.name ?? "Barbeiro"}`
  if (payload.tenant.allowClientCancellation) {
    return `${base}\n\nPara cancelar: ${buildCancelUrl(payload.tenant.slug, payload.appointmentId)}`
  }
  return base
}

function buildCancellationText(payload: AppointmentPayload): string {
  const dt = fmtDateTime(new Date(payload.scheduledAt), payload.tenant.timezone)
  return (
    `Olá ${payload.guestName ?? "Cliente"}, seu agendamento em ${payload.tenant.name} foi cancelado.\n` +
    `📅 ${dt}\n\n` +
    `Para reagendar: ${buildBookingUrl(payload.tenant.slug)}`
  )
}

function buildBarberBookingText(payload: AppointmentPayload): string {
  const dt = fmtDateTime(new Date(payload.scheduledAt), payload.tenant.timezone)
  const services = payload.services.map((s) => s.name).join(" + ")
  return (
    `📅 Novo agendamento na sua agenda!\n` +
    `Cliente: ${payload.guestName ?? "Cliente"}\n` +
    `${dt}\n` +
    `Serviço: ${services}`
  )
}

function buildBarberCancellationText(payload: AppointmentPayload): string {
  const dt = fmtDateTime(new Date(payload.scheduledAt), payload.tenant.timezone)
  return (
    `❌ Agendamento cancelado.\n` +
    `Cliente: ${payload.guestName ?? "Cliente"}\n` +
    `Era: ${dt} — horário liberado.`
  )
}

// ─────────────────────────────────────────────
// WhatsApp Cloud API (oficial Meta)
// ─────────────────────────────────────────────

const TEMPLATES = {
  confirmation: process.env.WHATSAPP_TEMPLATE_CONFIRMATION ?? "barbearia_confirmacao",
  reminder: process.env.WHATSAPP_TEMPLATE_REMINDER ?? "barbearia_lembrete_botoes",
  cancellation: process.env.WHATSAPP_TEMPLATE_CANCELLATION ?? "barbearia_cancelamento",
  barberBooking: process.env.WHATSAPP_TEMPLATE_BARBER_BOOKING ?? "barbearia_barbeiro_agendamento",
  barberCancellation: process.env.WHATSAPP_TEMPLATE_BARBER_CANCELLATION ?? "barbearia_barbeiro_cancelamento",
}
const TEMPLATE_LANG = process.env.WHATSAPP_TEMPLATE_LANG ?? "pt_BR"
const GRAPH_VERSION = "v21.0"

function isCloudApiConfigured(): boolean {
  return !!process.env.WHATSAPP_ACCESS_TOKEN && !!process.env.WHATSAPP_PHONE_NUMBER_ID
}

interface TemplateButton {
  index: number
  payload: string
}

function templateNameFor(type: NotifType): string | null {
  switch (type) {
    case NotifType.BOOKING_CONFIRMATION: return TEMPLATES.confirmation
    case NotifType.BOOKING_REMINDER_24H: return TEMPLATES.reminder
    case NotifType.BOOKING_CANCELLED: return TEMPLATES.cancellation
    case NotifType.BARBER_NEW_BOOKING: return TEMPLATES.barberBooking
    case NotifType.BARBER_CANCELLATION: return TEMPLATES.barberCancellation
    default: return null
  }
}

function templateParamsFor(type: NotifType, payload: AppointmentPayload): string[] {
  const scheduledAt = new Date(payload.scheduledAt)
  const tz = payload.tenant.timezone
  const date = fmtDate(scheduledAt, tz)
  const time = fmtTime(scheduledAt, tz)
  const services = payload.services.map((s) => s.name).join(" + ")
  const clientName = payload.guestName ?? "Cliente"
  const barberName = payload.barber.name ?? "Barbeiro"
  const tenantName = payload.tenant.name

  switch (type) {
    case NotifType.BOOKING_CONFIRMATION:
    case NotifType.BOOKING_REMINDER_24H:
      return [clientName, tenantName, date, time, services, barberName]
    case NotifType.BOOKING_CANCELLED:
      return [clientName, tenantName, date, time]
    case NotifType.BARBER_NEW_BOOKING:
      return [clientName, date, time, services]
    case NotifType.BARBER_CANCELLATION:
      return [clientName, date, time]
    default:
      return []
  }
}

function templateButtonsFor(type: NotifType, appointmentId: string): TemplateButton[] | undefined {
  if (type === NotifType.BOOKING_REMINDER_24H) {
    return [
      { index: 0, payload: `CONFIRMAR:${appointmentId}` },
      { index: 1, payload: `CANCELAR:${appointmentId}` },
    ]
  }
  return undefined
}

async function sendViaCloudApi(
  phone: string,
  templateName: string,
  params: string[],
  buttons?: TemplateButton[]
): Promise<string | null> {
  const components: unknown[] = []
  if (params.length) {
    components.push({
      type: "body",
      parameters: params.map((text) => ({ type: "text", text })),
    })
  }
  if (buttons?.length) {
    for (const b of buttons) {
      components.push({
        type: "button",
        sub_type: "quick_reply",
        index: String(b.index),
        parameters: [{ type: "payload", payload: b.payload }],
      })
    }
  }

  const res = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: toWhatsAppNumber(phone),
        type: "template",
        template: {
          name: templateName,
          language: { code: TEMPLATE_LANG },
          components,
        },
      }),
    }
  )

  const text = await res.text().catch(() => "")
  if (!res.ok) {
    throw new Error(`WhatsApp Cloud API error ${res.status}: ${text.slice(0, 300)}`)
  }

  try {
    const data = JSON.parse(text)
    return data?.messages?.[0]?.id ?? null
  } catch {
    return null
  }
}

// ─────────────────────────────────────────────
// Z-API (fallback por tenant)
// ─────────────────────────────────────────────

async function sendViaZApi(
  phone: string,
  message: string,
  instanceId: string,
  token: string,
  clientToken: string
): Promise<void> {
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
  if (!res.ok) {
    throw new Error(`Z-API error ${res.status}`)
  }
}

// ─────────────────────────────────────────────
// Dispatcher principal
// ─────────────────────────────────────────────

interface DispatchOptions {
  payload: AppointmentPayload
  type: NotifType
  body: string
  phone?: string | null
}

export async function dispatchNotification(opts: DispatchOptions): Promise<void> {
  const { payload, type, body } = opts
  const phone = opts.phone !== undefined ? opts.phone : payload.guestPhone

  let sent = false
  let providerMsgId: string | undefined
  let errorMsg: string | undefined

  const templateName = templateNameFor(type)

  // 1) WhatsApp Cloud API com circuit breaker
  if (phone && templateName && isCloudApiConfigured()) {
    try {
      const wamid = await whatsAppCloudBreaker.fire(async () =>
        sendViaCloudApi(
          phone,
          templateName,
          templateParamsFor(type, payload),
          templateButtonsFor(type, payload.appointmentId)
        )
      ) as string | null

      if (wamid) {
        sent = true
        providerMsgId = wamid
      }
    } catch (err) {
      console.error("[notifications] Cloud API falhou:", err)
      errorMsg = String(err)
    }
  }

  // 2) Fallback: Z-API do próprio salão
  if (!sent && phone) {
    const settings = await prisma.webhookSetting.findUnique({
      where: { tenantId: payload.tenantId },
    })
    if (settings?.zapiInstance && settings.zapiToken) {
      const clientToken = process.env.ZAPI_CLIENT_TOKEN ?? settings.zapiToken
      try {
        await zapiBreaker.fire(async () =>
          sendViaZApi(phone, body, settings.zapiInstance!, settings.zapiToken!, clientToken)
        )
        sent = true
        errorMsg = undefined
      } catch (err) {
        console.error("[notifications] Z-API falhou:", err)
        errorMsg = `Z-API: ${String(err)}`
      }
    }
  }

  await prisma.notification.create({
    data: {
      tenantId: payload.tenantId,
      appointmentId: payload.appointmentId,
      channel: NotifChannel.WHATSAPP,
      type,
      recipientPhone: phone ?? undefined,
      body,
      providerMsgId,
      status: sent ? NotifStatus.SENT : NotifStatus.FAILED,
      sentAt: sent ? new Date() : undefined,
      errorMsg: sent ? undefined : (errorMsg ?? "WhatsApp não enviado"),
    },
  })

  if (!sent) {
    throw new Error(`Notificação falhou para appointment ${payload.appointmentId}: ${errorMsg}`)
  }
}

// ─────────────────────────────────────────────
// Funções públicas por tipo de evento
// ─────────────────────────────────────────────

export async function sendBookingConfirmation(payload: AppointmentPayload): Promise<void> {
  await dispatchNotification({
    payload,
    type: NotifType.BOOKING_CONFIRMATION,
    body: buildConfirmationText(payload),
  })
}

export async function sendBookingReminder(payload: AppointmentPayload): Promise<void> {
  await dispatchNotification({
    payload,
    type: NotifType.BOOKING_REMINDER_24H,
    body: buildReminderText(payload),
  })
}

export async function sendBookingCancellation(payload: AppointmentPayload): Promise<void> {
  await dispatchNotification({
    payload,
    type: NotifType.BOOKING_CANCELLED,
    body: buildCancellationText(payload),
  })
}

export async function sendBarberNewBooking(payload: AppointmentPayload): Promise<void> {
  if (!payload.tenant.notifyBarberEnabled) return
  const barberPhone = payload.barber.phone
  if (!barberPhone) return
  await dispatchNotification({
    payload,
    type: NotifType.BARBER_NEW_BOOKING,
    body: buildBarberBookingText(payload),
    phone: barberPhone,
  })
}

export async function sendBarberCancellation(payload: AppointmentPayload): Promise<void> {
  if (!payload.tenant.notifyBarberEnabled) return
  const barberPhone = payload.barber.phone
  if (!barberPhone) return
  await dispatchNotification({
    payload,
    type: NotifType.BARBER_CANCELLATION,
    body: buildBarberCancellationText(payload),
    phone: barberPhone,
  })
}
