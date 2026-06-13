import { PlanTier } from "@prisma/client"

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
