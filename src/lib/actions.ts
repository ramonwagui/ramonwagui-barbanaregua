"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { AppointmentStatus } from "@prisma/client"
import { refundDepositForCancellation } from "@/lib/payment-reconcile"
import { disconnect as disconnectMp } from "@/lib/mp-account"
import { recordCompletedVisit } from "@/lib/loyalty"
import { sendBarberCancellation } from "@/lib/notifications"

async function requireTenantOwner() {
  const session = await auth()
  if (!session?.user?.tenantId) throw new Error("Não autorizado")
  if (session.user.role === "BARBER") throw new Error("Permissão insuficiente")
  return session
}

async function requireAuth() {
  const session = await auth()
  if (!session?.user?.tenantId) throw new Error("Não autorizado")
  return session
}

// ─── Appointments ────────────────────────────────────────────

export async function updateAppointmentStatus(appointmentId: string, status: AppointmentStatus) {
  const session = await requireAuth()

  // Barbeiro só pode alterar seus próprios agendamentos
  let barberIdFilter: string | undefined
  if (session.user.role === "BARBER") {
    const barber = await prisma.barber.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    })
    if (!barber) throw new Error("Barbeiro não encontrado")
    barberIdFilter = barber.id
  }

  // Lê o estado anterior (respeitando os filtros) p/ detectar a transição.
  const prev = await prisma.appointment.findFirst({
    where: {
      id: appointmentId,
      tenantId: session.user.tenantId!,
      ...(barberIdFilter ? { barberId: barberIdFilter } : {}),
    },
    select: { status: true, guestPhone: true, guestName: true },
  })
  if (!prev) throw new Error("Agendamento não encontrado")

  await prisma.appointment.update({
    where: {
      id: appointmentId,
      tenantId: session.user.tenantId!,
      ...(barberIdFilter ? { barberId: barberIdFilter } : {}),
    },
    data: {
      status,
      ...(status === "CANCELLED"
        ? { cancelledAt: new Date() }
        : {}),
    },
  })

  // Política de sinal: ao cancelar, estorna o sinal se houver antecedência
  // suficiente; NO_SHOW nunca estorna (barbeiro fica com o sinal).
  if (status === "CANCELLED") {
    await refundDepositForCancellation(appointmentId).catch(console.error)

    // Avisa o barbeiro quando quem cancela é o dono (o barbeiro que cancela
    // o próprio horário já sabe).
    if (session.user.role !== "BARBER") {
      const appt = await prisma.appointment.findUnique({
        where: { id: appointmentId },
        include: {
          barber: { include: { user: { select: { name: true, phone: true } } } },
          services: { include: { service: true } },
          tenant: true,
        },
      })
      if (appt) sendBarberCancellation(appt).catch(console.error)
    }
  }

  // Fidelidade: contabiliza ao concluir (apenas na transição p/ COMPLETED).
  if (status === "COMPLETED" && prev.status !== "COMPLETED" && prev.guestPhone) {
    await recordCompletedVisit(
      session.user.tenantId!,
      prev.guestPhone,
      prev.guestName
    ).catch(console.error)
  }

  revalidatePath("/agenda")
  revalidatePath("/dashboard")
}

// ─── Configuração de sinal (depósito) ────────────────────────

export async function updateDepositSettings(data: {
  requireDeposit: boolean
  depositPercent: number
  depositExpiryMinutes: number
  cancelRefundHours: number
}) {
  const session = await requireTenantOwner()
  await prisma.tenant.update({
    where: { id: session.user.tenantId! },
    data: {
      requireDeposit: data.requireDeposit,
      depositPercent: Math.min(100, Math.max(1, Math.round(data.depositPercent))),
      depositExpiryMinutes: Math.min(120, Math.max(5, Math.round(data.depositExpiryMinutes))),
      cancelRefundHours: Math.max(0, Math.round(data.cancelRefundHours)),
    },
  })
  revalidatePath("/configuracoes")
}

/** Desconecta a conta do Mercado Pago do salão (remove os tokens). */
export async function disconnectMercadoPago() {
  const session = await requireTenantOwner()
  await disconnectMp(session.user.tenantId!)
  revalidatePath("/configuracoes")
}

/** Liga/desliga o cancelamento self-service pelo cliente. */
export async function updateClientCancellation(enabled: boolean) {
  const session = await requireTenantOwner()
  await prisma.tenant.update({
    where: { id: session.user.tenantId! },
    data: { allowClientCancellation: enabled },
  })
  revalidatePath("/configuracoes")
}

// ─── Pacotes pré-pagos ───────────────────────────────────────

export async function createServicePackage(data: {
  serviceId: string
  name: string
  credits: number
  price: number
  validityDays: number
}) {
  const session = await requireTenantOwner()
  // Garante que o serviço é do salão.
  const svc = await prisma.service.findFirst({
    where: { id: data.serviceId, tenantId: session.user.tenantId! },
    select: { id: true },
  })
  if (!svc) throw new Error("Serviço inválido")
  await prisma.servicePackage.create({
    data: {
      tenantId: session.user.tenantId!,
      serviceId: data.serviceId,
      name: data.name,
      credits: Math.max(1, Math.round(data.credits)),
      price: Math.max(0, data.price),
      validityDays: Math.max(1, Math.round(data.validityDays)),
    },
  })
  revalidatePath("/pacotes")
}

export async function updateServicePackage(
  packageId: string,
  data: { serviceId: string; name: string; credits: number; price: number; validityDays: number }
) {
  const session = await requireTenantOwner()
  const svc = await prisma.service.findFirst({
    where: { id: data.serviceId, tenantId: session.user.tenantId! },
    select: { id: true },
  })
  if (!svc) throw new Error("Serviço inválido")
  await prisma.servicePackage.update({
    where: { id: packageId, tenantId: session.user.tenantId! },
    data: {
      serviceId: data.serviceId,
      name: data.name,
      credits: Math.max(1, Math.round(data.credits)),
      price: Math.max(0, data.price),
      validityDays: Math.max(1, Math.round(data.validityDays)),
    },
  })
  revalidatePath("/pacotes")
}

export async function toggleServicePackage(packageId: string) {
  const session = await requireTenantOwner()
  const pkg = await prisma.servicePackage.findFirst({
    where: { id: packageId, tenantId: session.user.tenantId! },
    select: { isActive: true },
  })
  if (!pkg) throw new Error("Pacote não encontrado")
  await prisma.servicePackage.update({
    where: { id: packageId },
    data: { isActive: !pkg.isActive },
  })
  revalidatePath("/pacotes")
}

export async function deleteServicePackage(packageId: string) {
  const session = await requireTenantOwner()
  await prisma.servicePackage.delete({
    where: { id: packageId, tenantId: session.user.tenantId! },
  })
  revalidatePath("/pacotes")
}

// ─── Services ────────────────────────────────────────────────

export async function createService(data: {
  name: string
  description: string
  durationMinutes: number
  price: number
  isUpsellSuggestion?: boolean
}) {
  const session = await requireTenantOwner()
  await prisma.service.create({
    data: {
      tenantId: session.user.tenantId!,
      name: data.name,
      description: data.description || null,
      durationMinutes: data.durationMinutes,
      price: data.price,
      isUpsellSuggestion: data.isUpsellSuggestion ?? false,
    },
  })
  revalidatePath("/servicos")
}

export async function updateService(
  serviceId: string,
  data: {
    name: string
    description: string
    durationMinutes: number
    price: number
    isUpsellSuggestion?: boolean
  }
) {
  const session = await requireTenantOwner()
  await prisma.service.update({
    where: { id: serviceId, tenantId: session.user.tenantId! },
    data: {
      name: data.name,
      description: data.description || null,
      durationMinutes: data.durationMinutes,
      price: data.price,
      ...(data.isUpsellSuggestion !== undefined
        ? { isUpsellSuggestion: data.isUpsellSuggestion }
        : {}),
    },
  })
  revalidatePath("/servicos")
}

/** Liga/desliga as sugestões de upsell (add-ons) no agendamento. */
export async function updateUpsellEnabled(enabled: boolean) {
  const session = await requireTenantOwner()
  await prisma.tenant.update({
    where: { id: session.user.tenantId! },
    data: { upsellEnabled: enabled },
  })
  revalidatePath("/configuracoes")
}

/** Liga/desliga os avisos por WhatsApp ao barbeiro. */
export async function updateNotifyBarber(enabled: boolean) {
  const session = await requireTenantOwner()
  await prisma.tenant.update({
    where: { id: session.user.tenantId! },
    data: { notifyBarberEnabled: enabled },
  })
  revalidatePath("/configuracoes")
}

/** Configura o programa de fidelidade (cartão de carimbo). */
export async function updateLoyaltySettings(data: {
  enabled: boolean
  threshold: number
  rewardServiceId: string | null
}) {
  const session = await requireTenantOwner()
  await prisma.tenant.update({
    where: { id: session.user.tenantId! },
    data: {
      loyaltyEnabled: data.enabled,
      loyaltyThreshold: Math.max(1, Math.round(data.threshold)),
      loyaltyRewardServiceId: data.rewardServiceId || null,
    },
  })
  revalidatePath("/configuracoes")
}

export async function toggleServiceActive(serviceId: string) {
  const session = await requireTenantOwner()
  const service = await prisma.service.findUnique({
    where: { id: serviceId, tenantId: session.user.tenantId! },
  })
  if (!service) throw new Error("Serviço não encontrado")
  await prisma.service.update({
    where: { id: serviceId },
    data: { isActive: !service.isActive },
  })
  revalidatePath("/servicos")
}

export async function deleteService(serviceId: string) {
  const session = await requireTenantOwner()
  await prisma.service.delete({
    where: { id: serviceId, tenantId: session.user.tenantId! },
  })
  revalidatePath("/servicos")
}

// ─── Barbers ─────────────────────────────────────────────────

export async function toggleBarberActive(barberId: string) {
  const session = await requireTenantOwner()
  const barber = await prisma.barber.findUnique({
    where: { id: barberId, tenantId: session.user.tenantId! },
  })
  if (!barber) throw new Error("Barbeiro não encontrado")
  await prisma.barber.update({
    where: { id: barberId },
    data: { isActive: !barber.isActive },
  })
  revalidatePath("/barbeiros")
}

// ─── Tenant Settings ─────────────────────────────────────────

export async function updateTenantSettings(data: {
  name: string
  phone: string
  address: string
  city: string
  state: string
  primaryColor: string
}) {
  const session = await requireTenantOwner()
  await prisma.tenant.update({
    where: { id: session.user.tenantId! },
    data: {
      name: data.name,
      phone: data.phone || null,
      address: data.address || null,
      city: data.city || null,
      state: data.state || null,
      primaryColor: data.primaryColor,
    },
  })
  revalidatePath("/configuracoes")
  revalidatePath("/dashboard")
}
