import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createPortalSession, isBillingConfigured } from "@/lib/billing"

export async function POST() {
  const session = await auth()
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }
  if (session.user.role === "BARBER") {
    return NextResponse.json({ error: "Apenas o dono pode gerenciar a assinatura" }, { status: 403 })
  }
  if (!isBillingConfigured()) {
    return NextResponse.json({ error: "Cobrança indisponível no momento." }, { status: 503 })
  }

  const sub = await prisma.subscription.findUnique({
    where: { tenantId: session.user.tenantId },
    select: { stripeCustomerId: true },
  })

  if (!sub?.stripeCustomerId) {
    return NextResponse.json({ error: "Sem customer Stripe vinculado." }, { status: 400 })
  }

  try {
    const portalSession = await createPortalSession(sub.stripeCustomerId)
    return NextResponse.json({ url: portalSession.url })
  } catch (err) {
    console.error("[billing/portal]", err)
    return NextResponse.json({ error: "Não foi possível abrir o portal." }, { status: 500 })
  }
}
