import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const schema = z.object({
  plan: z.enum(["BASIC", "PRO", "PREMIUM"]),
  status: z.enum(["TRIALING", "ACTIVE", "PAST_DUE", "CANCELLED"]),
  currentPeriodEnd: z.coerce.date(),
  trialEndsAt: z.coerce.date().nullable().optional(),
})

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (session?.user?.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 })
  }

  const { id: tenantId } = await params

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } })
  if (!tenant) {
    return NextResponse.json({ error: "Barbearia não encontrada" }, { status: 404 })
  }

  const body = await req.json()
  const data = schema.parse(body)

  const subscription = await prisma.subscription.upsert({
    where: { tenantId },
    update: {
      plan: data.plan,
      status: data.status,
      currentPeriodEnd: data.currentPeriodEnd,
      trialEndsAt: data.trialEndsAt ?? null,
      currentPeriodStart: new Date(),
    },
    create: {
      tenantId,
      plan: data.plan,
      status: data.status,
      currentPeriodStart: new Date(),
      currentPeriodEnd: data.currentPeriodEnd,
      trialEndsAt: data.trialEndsAt ?? null,
    },
  })

  return NextResponse.json({ subscription })
}
