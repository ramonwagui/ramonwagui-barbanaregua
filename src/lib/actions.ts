"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { AppointmentStatus } from "@prisma/client"

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

  await prisma.appointment.update({
    where: {
      id: appointmentId,
      tenantId: session.user.tenantId!,
      ...(barberIdFilter ? { barberId: barberIdFilter } : {}),
    },
    data: { status },
  })
  revalidatePath("/agenda")
  revalidatePath("/dashboard")
}

// ─── Services ────────────────────────────────────────────────

export async function createService(data: {
  name: string
  description: string
  durationMinutes: number
  price: number
}) {
  const session = await requireTenantOwner()
  await prisma.service.create({
    data: {
      tenantId: session.user.tenantId!,
      name: data.name,
      description: data.description || null,
      durationMinutes: data.durationMinutes,
      price: data.price,
    },
  })
  revalidatePath("/servicos")
}

export async function updateService(
  serviceId: string,
  data: { name: string; description: string; durationMinutes: number; price: number }
) {
  const session = await requireTenantOwner()
  await prisma.service.update({
    where: { id: serviceId, tenantId: session.user.tenantId! },
    data: {
      name: data.name,
      description: data.description || null,
      durationMinutes: data.durationMinutes,
      price: data.price,
    },
  })
  revalidatePath("/servicos")
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
