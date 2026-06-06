import { prisma } from "@/lib/prisma"
import { NotifChannel, NotifType, NotifStatus } from "@prisma/client"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"

/**
 * Envio de notificações por WhatsApp.
 *
 * Provider principal: WhatsApp Cloud API (oficial da Meta), usando um número
 * CENTRAL da plataforma e TEMPLATES aprovados (obrigatório para mensagens
 * proativas). Cada notificação mapeia para um template e a ordem das variáveis.
 *
 * Fallback: Z-API por salão (texto livre), caso o salão tenha o próprio número
 * configurado em WebhookSetting e a Cloud API não esteja disponível.
 */

interface AppointmentNotifData {
  id: string
  tenantId: string
  guestName?: string | null
  guestPhone?: string | null
  scheduledAt: Date
  barber: { user: { name: string | null; phone?: string | null } }
  tenant: {
    name: string
    slug: string
    allowClientCancellation?: boolean
    notifyBarberEnabled?: boolean
  }
  services: Array<{ service: { name: string } }>
  totalPrice: unknown
}

// ─────────────────────────────────────────────
// Helpers de formatação
// ─────────────────────────────────────────────

function buildCancelUrl(slug: string, appointmentId: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(
    /\/$/,
    ""
  )
  return `${base}/b/${slug}/cancelar?id=${appointmentId}`
}

function formatPrice(price: unknown): string {
  return `R$ ${Number(price).toFixed(2).replace(".", ",")}`
}

function buildBookingUrl(slug: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(
    /\/$/,
    ""
  )
  return `${base}/b/${slug}`
}

function clientName(appt: AppointmentNotifData): string {
  return appt.guestName ?? "Cliente"
}
function barberName(appt: AppointmentNotifData): string {
  return appt.barber.user.name ?? "Barbeiro"
}
function serviceNames(appt: AppointmentNotifData): string {
  return appt.services.map((s) => s.service.name).join(" + ")
}

// ─────────────────────────────────────────────
// Texto livre (fallback Z-API e log legível)
// ─────────────────────────────────────────────

function buildConfirmationMessage(appt: AppointmentNotifData): string {
  const dateStr = format(appt.scheduledAt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
  const base =
    `Olá ${clientName(appt)}! ✂️ Seu agendamento foi confirmado na ${appt.tenant.name}.\n` +
    `📅 ${dateStr}\n` +
    `✂️ ${serviceNames(appt)} com ${barberName(appt)}\n` +
    `💰 ${formatPrice(appt.totalPrice)}`

  if (appt.tenant.allowClientCancellation) {
    return `${base}\n\nPara cancelar: ${buildCancelUrl(appt.tenant.slug, appt.id)}`
  }
  return base
}

function buildReminderMessage(appt: AppointmentNotifData): string {
  const dateStr = format(appt.scheduledAt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
  const base =
    `Lembrete! ✂️ Você tem agendamento na ${appt.tenant.name}.\n` +
    `📅 ${dateStr}\n` +
    `✂️ ${serviceNames(appt)} com ${barberName(appt)}`

  if (appt.tenant.allowClientCancellation) {
    return `${base}\n\nPara cancelar: ${buildCancelUrl(appt.tenant.slug, appt.id)}`
  }
  return base
}

function buildCancellationMessage(appt: AppointmentNotifData): string {
  const dateStr = format(appt.scheduledAt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
  return (
    `Olá ${clientName(appt)}, seu agendamento em ${appt.tenant.name} foi cancelado.\n` +
    `📅 ${dateStr}\n\n` +
    `Para reagendar: ${buildBookingUrl(appt.tenant.slug)}`
  )
}

// ─────────────────────────────────────────────
// WhatsApp Cloud API (oficial, número central)
// ─────────────────────────────────────────────

const TEMPLATES = {
  confirmation: process.env.WHATSAPP_TEMPLATE_CONFIRMATION ?? "barbearia_confirmacao",
  reminder: process.env.WHATSAPP_TEMPLATE_REMINDER ?? "barbearia_lembrete",
  cancellation: process.env.WHATSAPP_TEMPLATE_CANCELLATION ?? "barbearia_cancelamento",
  barberBooking:
    process.env.WHATSAPP_TEMPLATE_BARBER_BOOKING ?? "barbearia_barbeiro_agendamento",
  barberCancellation:
    process.env.WHATSAPP_TEMPLATE_BARBER_CANCELLATION ?? "barbearia_barbeiro_cancelamento",
}
const TEMPLATE_LANG = process.env.WHATSAPP_TEMPLATE_LANG ?? "pt_BR"
const GRAPH_VERSION = "v21.0"

function isCloudApiConfigured(): boolean {
  return (
    !!process.env.WHATSAPP_ACCESS_TOKEN && !!process.env.WHATSAPP_PHONE_NUMBER_ID
  )
}

/**
 * Normaliza o telefone para o formato esperado pela Meta (DDI+DDD+número, só
 * dígitos). Números locais brasileiros (10–11 dígitos) recebem o DDI 55.
 */
function toWhatsAppNumber(raw: string): string {
  let d = raw.replace(/\D/g, "")
  if (d.length <= 11) d = `55${d}`
  return d
}

/** Variáveis de cada template, na ordem exata em que foram aprovados. */
function templateParams(
  appt: AppointmentNotifData,
  type: NotifType
): string[] {
  const dateStr = format(appt.scheduledAt, "dd/MM/yyyy", { locale: ptBR })
  const timeStr = format(appt.scheduledAt, "HH:mm")
  switch (type) {
    case NotifType.BOOKING_CONFIRMATION:
      // {{1}} cliente, {{2}} salão, {{3}} data, {{4}} hora, {{5}} serviço, {{6}} barbeiro
      return [
        clientName(appt),
        appt.tenant.name,
        dateStr,
        timeStr,
        serviceNames(appt),
        barberName(appt),
      ]
    case NotifType.BOOKING_REMINDER_24H:
      return [
        clientName(appt),
        appt.tenant.name,
        dateStr,
        timeStr,
        serviceNames(appt),
        barberName(appt),
      ]
    case NotifType.BOOKING_CANCELLED:
      // {{1}} cliente, {{2}} salão, {{3}} data, {{4}} hora
      return [clientName(appt), appt.tenant.name, dateStr, timeStr]
    case NotifType.BARBER_NEW_BOOKING:
      // {{1}} cliente, {{2}} data, {{3}} hora, {{4}} serviços
      return [clientName(appt), dateStr, timeStr, serviceNames(appt)]
    case NotifType.BARBER_CANCELLATION:
      // {{1}} cliente, {{2}} data, {{3}} hora
      return [clientName(appt), dateStr, timeStr]
    default:
      return []
  }
}

function templateNameFor(type: NotifType): string | null {
  switch (type) {
    case NotifType.BOOKING_CONFIRMATION:
      return TEMPLATES.confirmation
    case NotifType.BOOKING_REMINDER_24H:
      return TEMPLATES.reminder
    case NotifType.BOOKING_CANCELLED:
      return TEMPLATES.cancellation
    case NotifType.BARBER_NEW_BOOKING:
      return TEMPLATES.barberBooking
    case NotifType.BARBER_CANCELLATION:
      return TEMPLATES.barberCancellation
    default:
      return null
  }
}

/** Envia via Cloud API. Retorna o wamid (id da mensagem) ou null em falha. */
async function sendViaCloudApi(
  phone: string,
  templateName: string,
  params: string[]
): Promise<string | null> {
  try {
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
            components: params.length
              ? [
                  {
                    type: "body",
                    parameters: params.map((text) => ({ type: "text", text })),
                  },
                ]
              : [],
          },
        }),
      }
    )
    const text = await res.text().catch(() => "")
    if (!res.ok) {
      console.error("[CloudAPI] envio falhou:", res.status, text.slice(0, 300))
      return null
    }
    try {
      const data = JSON.parse(text)
      return data?.messages?.[0]?.id ?? null
    } catch {
      return null
    }
  } catch (err) {
    console.error("[CloudAPI] erro:", err)
    return null
  }
}

// ─────────────────────────────────────────────
// Z-API (fallback por salão)
// ─────────────────────────────────────────────

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

// ─────────────────────────────────────────────
// Dispatch
// ─────────────────────────────────────────────

async function dispatchNotification(opts: {
  appt: AppointmentNotifData
  type: NotifType
  /** Texto legível: usado como fallback Z-API e gravado no log. */
  body: string
  /** Destinatário. Default: o cliente (guestPhone). Barbeiro: passar o dele. */
  phone?: string | null
}) {
  const { appt, type, body } = opts
  const phone = opts.phone !== undefined ? opts.phone : appt.guestPhone
  let sent = false
  let providerMsgId: string | undefined

  // 1) Cloud API (oficial, número central) — via template aprovado.
  const templateName = templateNameFor(type)
  if (phone && templateName && isCloudApiConfigured()) {
    const wamid = await sendViaCloudApi(phone, templateName, templateParams(appt, type))
    if (wamid) {
      sent = true
      providerMsgId = wamid
    }
  }

  // 2) Fallback: Z-API do próprio salão (texto livre).
  if (!sent && phone) {
    const settings = await getWebhookSettings(appt.tenantId)
    if (settings?.zapiInstance && settings.zapiToken) {
      const clientToken = process.env.ZAPI_CLIENT_TOKEN ?? settings.zapiToken
      sent = await sendViaZApi(
        phone,
        body,
        settings.zapiInstance,
        settings.zapiToken,
        clientToken
      )
    }
  }

  await prisma.notification.create({
    data: {
      tenantId: appt.tenantId,
      appointmentId: appt.id,
      channel: NotifChannel.WHATSAPP,
      type,
      recipientPhone: phone ?? undefined,
      body,
      providerMsgId,
      status: sent ? NotifStatus.SENT : NotifStatus.FAILED,
      sentAt: sent ? new Date() : undefined,
      errorMsg: sent ? undefined : "WhatsApp não enviado (Cloud API/Z-API)",
    },
  })
}

export async function sendBookingConfirmation(appt: AppointmentNotifData) {
  // Fire and forget — não bloqueia a criação do agendamento
  dispatchNotification({
    appt,
    type: NotifType.BOOKING_CONFIRMATION,
    body: buildConfirmationMessage(appt),
  }).catch(console.error)
}

export async function sendBookingReminder(appt: AppointmentNotifData) {
  await dispatchNotification({
    appt,
    type: NotifType.BOOKING_REMINDER_24H,
    body: buildReminderMessage(appt),
  })
}

export async function sendBookingCancellation(appt: AppointmentNotifData) {
  dispatchNotification({
    appt,
    type: NotifType.BOOKING_CANCELLED,
    body: buildCancellationMessage(appt),
  }).catch(console.error)
}

// ─────────────────────────────────────────────
// Avisos ao BARBEIRO (opt-in por salão)
// ─────────────────────────────────────────────

function buildBarberBookingMessage(appt: AppointmentNotifData): string {
  const dateStr = format(appt.scheduledAt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
  return (
    `📅 Novo agendamento na sua agenda!\n` +
    `Cliente: ${clientName(appt)}\n` +
    `${dateStr}\n` +
    `Serviço: ${serviceNames(appt)}`
  )
}

function buildBarberCancellationMessage(appt: AppointmentNotifData): string {
  const dateStr = format(appt.scheduledAt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
  return (
    `❌ Agendamento cancelado.\n` +
    `Cliente: ${clientName(appt)}\n` +
    `Era: ${dateStr} — horário liberado.`
  )
}

export async function sendBarberNewBooking(appt: AppointmentNotifData) {
  if (!appt.tenant.notifyBarberEnabled) return
  const phone = appt.barber.user.phone
  if (!phone) return
  dispatchNotification({
    appt,
    type: NotifType.BARBER_NEW_BOOKING,
    body: buildBarberBookingMessage(appt),
    phone,
  }).catch(console.error)
}

export async function sendBarberCancellation(appt: AppointmentNotifData) {
  if (!appt.tenant.notifyBarberEnabled) return
  const phone = appt.barber.user.phone
  if (!phone) return
  dispatchNotification({
    appt,
    type: NotifType.BARBER_CANCELLATION,
    body: buildBarberCancellationMessage(appt),
    phone,
  }).catch(console.error)
}
