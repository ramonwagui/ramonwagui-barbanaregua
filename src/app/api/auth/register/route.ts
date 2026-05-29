import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { slugify } from "@/lib/tenant"
import { registerSchema } from "@/lib/validations/auth"
import { addDays } from "date-fns"

type TxClient = Omit<
  typeof prisma,
  "$connect" | "$disconnect" | "$on" | "$use" | "$extends"
>

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const data = registerSchema.parse(body)

    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    })
    if (existingUser) {
      return NextResponse.json(
        { error: "Email já cadastrado" },
        { status: 409 }
      )
    }

    let slug = slugify(data.shopName)
    const slugExists = await prisma.tenant.findUnique({ where: { slug } })
    if (slugExists) {
      slug = `${slug}-${Date.now().toString(36)}`
    }

    const passwordHash = await bcrypt.hash(data.password, 12)

    const result = await prisma.$transaction(async (tx: TxClient) => {
      const user = await tx.user.create({
        data: {
          name: data.name,
          email: data.email,
          passwordHash,
          role: "TENANT_OWNER",
        },
      })

      const tenant = await tx.tenant.create({
        data: {
          name: data.shopName,
          slug,
          ownerId: user.id,
          users: { connect: { id: user.id } },
        },
      })

      await tx.user.update({
        where: { id: user.id },
        data: { tenantId: tenant.id },
      })

      const trialEndsAt = addDays(new Date(), 14)
      await tx.subscription.create({
        data: {
          tenantId: tenant.id,
          plan: "BASIC",
          status: "TRIALING",
          currentPeriodStart: new Date(),
          currentPeriodEnd: trialEndsAt,
          trialEndsAt,
        },
      })

      const defaultHours = [1, 2, 3, 4, 5, 6].map((day) => ({
        tenantId: tenant.id,
        dayOfWeek: day,
        openTime: "09:00",
        closeTime: "19:00",
        isOpen: true,
      }))
      defaultHours.push({
        tenantId: tenant.id,
        dayOfWeek: 0,
        openTime: "09:00",
        closeTime: "19:00",
        isOpen: false,
      })
      await tx.businessHour.createMany({ data: defaultHours })

      return { userId: user.id, tenantId: tenant.id, slug }
    })

    return NextResponse.json({ success: true, ...result }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 })
    }
    console.error("[REGISTER]", error)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
