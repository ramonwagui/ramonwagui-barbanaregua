import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function PATCH(req: Request) {
  const session = await auth()
  if (session?.user?.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))

  const planPriceBasic = Number(body.planPriceBasic)
  const planPricePro = Number(body.planPricePro)
  const planPricePremium = Number(body.planPricePremium)

  if (
    !Number.isInteger(planPriceBasic) || planPriceBasic < 100 ||
    !Number.isInteger(planPricePro)   || planPricePro   < 100 ||
    !Number.isInteger(planPricePremium) || planPricePremium < 100
  ) {
    return NextResponse.json({ error: "Valores inválidos (mínimo R$1,00)" }, { status: 400 })
  }

  const stripePriceBasic   = typeof body.stripePriceBasic   === "string" ? body.stripePriceBasic.trim()   || null : undefined
  const stripePricePro     = typeof body.stripePricePro     === "string" ? body.stripePricePro.trim()     || null : undefined
  const stripePricePremium = typeof body.stripePricePremium === "string" ? body.stripePricePremium.trim() || null : undefined

  await prisma.globalConfig.upsert({
    where: { id: "singleton" },
    update: {
      planPriceBasic,
      planPricePro,
      planPricePremium,
      ...(stripePriceBasic   !== undefined && { stripePriceBasic }),
      ...(stripePricePro     !== undefined && { stripePricePro }),
      ...(stripePricePremium !== undefined && { stripePricePremium }),
    },
    create: {
      id: "singleton",
      planPriceBasic,
      planPricePro,
      planPricePremium,
      ...(stripePriceBasic   !== undefined && { stripePriceBasic }),
      ...(stripePricePro     !== undefined && { stripePricePro }),
      ...(stripePricePremium !== undefined && { stripePricePremium }),
    },
  })

  return NextResponse.json({ success: true })
}
