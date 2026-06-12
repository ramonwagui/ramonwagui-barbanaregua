import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createCheckoutSession, isBillingConfigured } from "@/lib/billing"
import { PlanTier } from "@prisma/client"

/** Cria a sessão de Checkout do Stripe para o dono assinar um plano. */
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }
  if (session.user.role === "BARBER") {
    return NextResponse.json({ error: "Apenas o dono pode assinar" }, { status: 403 })
  }
  if (!isBillingConfigured()) {
    return NextResponse.json({ error: "Cobrança indisponível no momento." }, { status: 503 })
  }

  const body = await req.json().catch(() => ({}))
  const plan = body?.plan as PlanTier
  if (!["BASIC", "PRO", "PREMIUM"].includes(plan)) {
    return NextResponse.json({ error: "Plano inválido" }, { status: 400 })
  }

  const sub = await prisma.subscription.findUnique({
    where: { tenantId: session.user.tenantId },
    select: { stripeCustomerId: true },
  })

  try {
    const checkout = await createCheckoutSession({
      tenantId: session.user.tenantId,
      plan,
      email: session.user.email ?? "",
      customerId: sub?.stripeCustomerId,
    })
    return NextResponse.json({ url: checkout.url })
  } catch (err) {
    console.error("[billing/checkout]", err)
    return NextResponse.json({ error: "Não foi possível iniciar o pagamento." }, { status: 500 })
  }
}
