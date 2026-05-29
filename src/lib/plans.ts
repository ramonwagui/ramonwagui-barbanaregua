import { PlanTier, SubscriptionStatus } from "@prisma/client"
import { TenantWithSubscription } from "@/lib/tenant"

export interface PlanLimits {
  maxBarbers: number | null
  maxAppointmentsPerMonth: number | null
  whatsappNotifications: boolean
  smsNotifications: boolean
  onlinePayments: boolean
  customDomain: boolean
  analyticsHistoryDays: number | null
  loyaltyProgram: boolean
  apiAccess: boolean
}

export const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  BASIC: {
    maxBarbers: 2,
    maxAppointmentsPerMonth: 200,
    whatsappNotifications: true,
    smsNotifications: false,
    onlinePayments: false,
    customDomain: false,
    analyticsHistoryDays: 30,
    loyaltyProgram: false,
    apiAccess: false,
  },
  PRO: {
    maxBarbers: 5,
    maxAppointmentsPerMonth: null,
    whatsappNotifications: true,
    smsNotifications: true,
    onlinePayments: true,
    customDomain: false,
    analyticsHistoryDays: 180,
    loyaltyProgram: false,
    apiAccess: false,
  },
  PREMIUM: {
    maxBarbers: null,
    maxAppointmentsPerMonth: null,
    whatsappNotifications: true,
    smsNotifications: true,
    onlinePayments: true,
    customDomain: true,
    analyticsHistoryDays: null,
    loyaltyProgram: true,
    apiAccess: true,
  },
}

export const PLAN_PRICES: Record<PlanTier, number> = {
  BASIC: 9900,
  PRO: 19900,
  PREMIUM: 39900,
}

export const PLAN_LABELS: Record<PlanTier, string> = {
  BASIC: "Basic",
  PRO: "Pro",
  PREMIUM: "Premium",
}

const PLAN_ORDER: Record<PlanTier, number> = { BASIC: 0, PRO: 1, PREMIUM: 2 }

export class PlanUpgradeRequiredError extends Error {
  constructor(requiredPlan: PlanTier) {
    super(`Plano ${PLAN_LABELS[requiredPlan]} ou superior necessário`)
    this.name = "PlanUpgradeRequiredError"
  }
}

export function requirePlan(
  tenant: TenantWithSubscription,
  minPlan: PlanTier
): void {
  const sub = tenant.subscription
  if (!sub || sub.status === SubscriptionStatus.CANCELLED) {
    throw new PlanUpgradeRequiredError(minPlan)
  }
  if (PLAN_ORDER[sub.plan] < PLAN_ORDER[minPlan]) {
    throw new PlanUpgradeRequiredError(minPlan)
  }
}

export function getPlanLimits(tenant: TenantWithSubscription): PlanLimits {
  const plan = tenant.subscription?.plan ?? PlanTier.BASIC
  return PLAN_LIMITS[plan]
}

export function isTrialing(tenant: TenantWithSubscription): boolean {
  return tenant.subscription?.status === SubscriptionStatus.TRIALING
}

export function isActive(tenant: TenantWithSubscription): boolean {
  const status = tenant.subscription?.status
  return status === SubscriptionStatus.ACTIVE || status === SubscriptionStatus.TRIALING
}
