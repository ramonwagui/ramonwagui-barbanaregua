import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { getTenantById } from "@/lib/tenant"
import { getPlanLimits } from "@/lib/plans"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.tenantId)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  if (session.user.role === "BARBER")
    return NextResponse.json({ error: "Permissão insuficiente" }, { status: 403 })

  // Verificar limite de barbeiros do plano
  const tenant = await getTenantById(session.user.tenantId)
  const limits = getPlanLimits(tenant)
  if (limits.maxBarbers !== null) {
    const count = await prisma.barber.count({
      where: { tenantId: session.user.tenantId, isActive: true },
    })
    if (count >= limits.maxBarbers) {
      return NextResponse.json(
        { error: `Seu plano permite no máximo ${limits.maxBarbers} barbeiro(s). Faça upgrade para adicionar mais.` },
        { status: 403 }
      )
    }
  }

  const { name, email, password, bio, phone, commissionPercent } = await req.json()

  if (!name?.trim()) return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 })
  if (!email?.trim()) return NextResponse.json({ error: "Email obrigatório" }, { status: 400 })
  if (!password || password.length < 6)
    return NextResponse.json({ error: "Senha deve ter pelo menos 6 caracteres" }, { status: 400 })

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) return NextResponse.json({ error: "Email já cadastrado" }, { status: 409 })

  const passwordHash = await bcrypt.hash(password, 12)

  const barber = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name,
        email,
        phone: phone ? String(phone).replace(/\D/g, "") : null,
        passwordHash,
        role: "BARBER",
        isActive: true,
        tenantId: session.user.tenantId,
      },
    })

    const barber = await tx.barber.create({
      data: {
        userId: user.id,
        tenantId: session.user.tenantId!,
        bio: bio || null,
        isActive: true,
        commissionPercent: Math.min(100, Math.max(0, Math.round(Number(commissionPercent) || 0))),
      },
    })

    // Default Mon–Sat schedule 09:00–18:00 with lunch 12:00–13:00
    const workDays = [1, 2, 3, 4, 5, 6]
    await tx.barberSchedule.createMany({
      data: workDays.map((day) => ({
        barberId: barber.id,
        dayOfWeek: day,
        startTime: "09:00",
        endTime: "18:00",
        breakStart: "12:00",
        breakEnd: "13:00",
        isActive: true,
      })),
    })

    return { ...barber, user }
  })

  return NextResponse.json({ barber }, { status: 201 })
}
