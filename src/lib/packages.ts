import { prisma } from "@/lib/prisma"
import { normalizeLoyaltyPhone } from "@/lib/loyalty"

/**
 * Pacotes pré-pagos: o salão define pacotes (ex.: "4 Cortes"); o cliente compra
 * à vista via PIX e usa os créditos nos próximos agendamentos. Identidade do
 * cliente = telefone normalizado (apenas dígitos).
 */

export const normalizePackagePhone = normalizeLoyaltyPhone

/** Pacotes ativos do salão (com nome/duração do serviço) para venda. */
export async function listActivePackages(tenantId: string) {
  const packages = await prisma.servicePackage.findMany({
    where: { tenantId, isActive: true, service: { isActive: true } },
    orderBy: [{ price: "asc" }],
    select: {
      id: true,
      name: true,
      credits: true,
      price: true,
      validityDays: true,
      service: { select: { id: true, name: true, durationMinutes: true } },
    },
  })
  return packages.map((p) => ({
    id: p.id,
    name: p.name,
    credits: p.credits,
    price: Number(p.price),
    validityDays: p.validityDays,
    serviceId: p.service.id,
    serviceName: p.service.name,
    durationMinutes: p.service.durationMinutes,
  }))
}

export interface ClientCredit {
  serviceId: string
  serviceName: string
  creditsLeft: number
  expiresAt: string | null
}

/** Créditos ativos do cliente (status ACTIVE, não expirados, com saldo). */
export async function getClientCredits(
  tenantId: string,
  phoneRaw: string
): Promise<ClientCredit[]> {
  const phone = normalizePackagePhone(phoneRaw)
  if (!phone) return []

  const items = await prisma.clientPackage.findMany({
    where: {
      tenantId,
      clientPhone: phone,
      status: "ACTIVE",
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    include: { package: { select: { service: { select: { name: true } } } } },
  })

  return items
    .filter((c) => c.creditsUsed < c.creditsTotal)
    .map((c) => ({
      serviceId: c.serviceId,
      serviceName: c.package.service.name,
      creditsLeft: c.creditsTotal - c.creditsUsed,
      expiresAt: c.expiresAt ? c.expiresAt.toISOString() : null,
    }))
}

/**
 * Encontra um crédito utilizável (ACTIVE, não expirado, com saldo) que cubra o
 * serviço, e o consome (incrementa creditsUsed). Retorna o id do ClientPackage
 * consumido, ou null. Idealmente chamado após criar o agendamento.
 */
export async function consumeCreditForService(
  tenantId: string,
  phoneRaw: string,
  serviceId: string
): Promise<string | null> {
  const phone = normalizePackagePhone(phoneRaw)
  if (!phone) return null

  const credit = await prisma.clientPackage.findFirst({
    where: {
      tenantId,
      clientPhone: phone,
      serviceId,
      status: "ACTIVE",
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    orderBy: [{ expiresAt: "asc" }], // usa o que expira antes
  })
  if (!credit || credit.creditsUsed >= credit.creditsTotal) return null

  await prisma.clientPackage.update({
    where: { id: credit.id },
    data: { creditsUsed: { increment: 1 } },
  })
  return credit.id
}

/** Há crédito utilizável para o serviço? (sem consumir) */
export async function hasUsableCredit(
  tenantId: string,
  phoneRaw: string,
  serviceId: string
): Promise<boolean> {
  const phone = normalizePackagePhone(phoneRaw)
  if (!phone) return false
  const credit = await prisma.clientPackage.findFirst({
    where: {
      tenantId,
      clientPhone: phone,
      serviceId,
      status: "ACTIVE",
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    select: { creditsTotal: true, creditsUsed: true },
  })
  return !!credit && credit.creditsUsed < credit.creditsTotal
}

/**
 * Ativa a compra de pacote quando o PIX é aprovado (idempotente). Define
 * status ACTIVE + expiresAt = now + validityDays e marca o Payment como PAID.
 */
export async function activateClientPackage(
  paymentId: string
): Promise<"PAID"> {
  await prisma.$transaction(async (tx) => {
    const cp = await tx.clientPackage.findUnique({
      where: { paymentId },
      include: { package: { select: { validityDays: true } } },
    })
    if (!cp || cp.status === "ACTIVE") return

    const expiresAt = new Date(
      Date.now() + cp.package.validityDays * 24 * 60 * 60 * 1000
    )
    await tx.clientPackage.update({
      where: { id: cp.id },
      data: { status: "ACTIVE", expiresAt },
    })
    await tx.payment.update({
      where: { id: paymentId },
      data: { status: "PAID", paidAt: new Date() },
    })
  })
  return "PAID"
}
