import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createCheckoutSession } from "@/lib/billing-client"
import { PlanTier } from "@prisma/client"

/** Proxy para o Billing Service — cria sessão de Checkout do Stripe. */
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }
  if (session.user.role === "BARBER") {
    return NextResponse.json({ error: "Apenas o dono pode assinar" }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const plan = body?.plan as PlanTier
  if (!["BASIC", "PRO", "PREMIUM"].includes(plan)) {
    return NextResponse.json({ error: "Plano inválido" }, { status: 400 })
  }

  // Price ID do banco (super admin pode sobrescrever via GlobalConfig)
  const config = await prisma.globalConfig.findUnique({
    where: { id: "singleton" },
    select: { stripePriceBasic: true, stripePricePro: true, stripePricePremium: true },
  })
  const dbPriceIds: Record<string, string | null | undefined> = {
    BASIC: config?.stripePriceBasic,
    PRO: config?.stripePricePro,
    PREMIUM: config?.stripePricePremium,
  }

  const result = await createCheckoutSession({
    tenantId: session.user.tenantId,
    plan,
    email: session.user.email ?? "",
    priceIdOverride: dbPriceIds[plan] ?? null,
  })

  if (!result) {
    return NextResponse.json({ error: "Não foi possível iniciar o pagamento." }, { status: 503 })
  }
  return NextResponse.json({ url: result.url })
}
