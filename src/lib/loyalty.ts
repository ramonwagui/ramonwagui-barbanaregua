import { prisma } from "@/lib/prisma"

/**
 * Fidelidade (cartão de carimbo): a cada N atendimentos COMPLETED de um mesmo
 * cliente (identificado pelo telefone), ele ganha 1 recompensa = serviço grátis
 * configurado pelo salão. Resgatável num próximo agendamento.
 */

/** Telefone como chave de identidade do cliente (apenas dígitos). */
export function normalizeLoyaltyPhone(raw: string): string {
  return raw.replace(/\D/g, "")
}

/**
 * Contabiliza um atendimento concluído no cartão do cliente e recalcula as
 * recompensas ganhas (floor(concluídos / N)). Só age se a fidelidade estiver
 * ligada no salão. Idempotência fica a cargo do chamador (acionar só na
 * transição para COMPLETED).
 */
export async function recordCompletedVisit(
  tenantId: string,
  phoneRaw: string,
  name?: string | null
): Promise<void> {
  const phone = normalizeLoyaltyPhone(phoneRaw)
  if (!phone) return

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { loyaltyEnabled: true, loyaltyThreshold: true },
  })
  if (!tenant?.loyaltyEnabled) return

  const threshold = Math.max(1, tenant.loyaltyThreshold)

  const card = await prisma.loyaltyCard.upsert({
    where: { tenantId_clientPhone: { tenantId, clientPhone: phone } },
    update: { completedCount: { increment: 1 }, ...(name ? { clientName: name } : {}) },
    create: {
      tenantId,
      clientPhone: phone,
      clientName: name ?? null,
      completedCount: 1,
    },
  })

  const earned = Math.floor(card.completedCount / threshold)
  if (earned !== card.rewardsEarned) {
    await prisma.loyaltyCard.update({
      where: { id: card.id },
      data: { rewardsEarned: earned },
    })
  }
}

export interface LoyaltyStatus {
  enabled: boolean
  /** Cliente tem recompensa disponível para resgatar? */
  available: boolean
  rewardServiceId: string | null
  rewardServiceName: string | null
  completedCount: number
  threshold: number
}

/** Status de fidelidade do cliente (para exibir no agendamento). */
export async function getLoyaltyStatus(
  tenantId: string,
  phoneRaw: string
): Promise<LoyaltyStatus> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      loyaltyEnabled: true,
      loyaltyThreshold: true,
      loyaltyRewardServiceId: true,
    },
  })

  const disabled: LoyaltyStatus = {
    enabled: false,
    available: false,
    rewardServiceId: null,
    rewardServiceName: null,
    completedCount: 0,
    threshold: 0,
  }
  if (!tenant?.loyaltyEnabled || !tenant.loyaltyRewardServiceId) return disabled

  const phone = normalizeLoyaltyPhone(phoneRaw)
  const [card, rewardService] = await Promise.all([
    phone
      ? prisma.loyaltyCard.findUnique({
          where: { tenantId_clientPhone: { tenantId, clientPhone: phone } },
        })
      : Promise.resolve(null),
    prisma.service.findFirst({
      where: { id: tenant.loyaltyRewardServiceId, tenantId, isActive: true },
      select: { id: true, name: true },
    }),
  ])

  if (!rewardService) return disabled

  const available =
    !!card && card.rewardsEarned - card.rewardsRedeemed > 0

  return {
    enabled: true,
    available,
    rewardServiceId: rewardService.id,
    rewardServiceName: rewardService.name,
    completedCount: card?.completedCount ?? 0,
    threshold: Math.max(1, tenant.loyaltyThreshold),
  }
}

/**
 * Valida e resgata 1 recompensa (incrementa rewardsRedeemed). Retorna o
 * serviceId da recompensa se o resgate for válido, senão null. Deve ser
 * chamado dentro da transação do agendamento, e o chamador zera o preço
 * desse serviço.
 */
export async function redeemRewardIfValid(
  tenantId: string,
  phoneRaw: string,
  selectedServiceIds: string[]
): Promise<string | null> {
  const status = await getLoyaltyStatus(tenantId, phoneRaw)
  if (!status.enabled || !status.available || !status.rewardServiceId) return null
  if (!selectedServiceIds.includes(status.rewardServiceId)) return null

  const phone = normalizeLoyaltyPhone(phoneRaw)
  await prisma.loyaltyCard.update({
    where: { tenantId_clientPhone: { tenantId, clientPhone: phone } },
    data: { rewardsRedeemed: { increment: 1 } },
  })
  return status.rewardServiceId
}
