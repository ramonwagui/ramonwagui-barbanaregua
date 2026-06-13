import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { overrideSubscription, invalidateSubscriptionCache } from "@/lib/billing-client"
import { z } from "zod"

const schema = z.object({
  plan: z.enum(["BASIC", "PRO", "PREMIUM"]),
  status: z.enum(["TRIALING", "ACTIVE", "PAST_DUE", "CANCELLED"]),
  currentPeriodEnd: z.coerce.date(),
  trialEndsAt: z.coerce.date().nullable().optional(),
})

/** Proxy para o Billing Service — override manual de assinatura (super admin). */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (session?.user?.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 })
  }

  const { id: tenantId } = await params
  const body = await req.json()
  const data = schema.parse(body)

  const subscription = await overrideSubscription(tenantId, {
    plan: data.plan,
    status: data.status,
    currentPeriodEnd: data.currentPeriodEnd.toISOString(),
    trialEndsAt: data.trialEndsAt?.toISOString() ?? null,
  })

  if (!subscription) {
    return NextResponse.json({ error: "Billing Service indisponível" }, { status: 503 })
  }

  await invalidateSubscriptionCache(tenantId)
  return NextResponse.json({ subscription })
}
