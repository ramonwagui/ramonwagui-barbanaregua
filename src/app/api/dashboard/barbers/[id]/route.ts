import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"

async function requireOwner() {
  const session = await auth()
  if (!session?.user?.tenantId) return null
  if (session.user.role === "BARBER") return null
  return session
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireOwner()
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const { id } = await params
  const { name, bio, email, password, phone } = await req.json()

  const barber = await prisma.barber.findUnique({
    where: { id, tenantId: session.user.tenantId! },
    include: { user: true },
  })
  if (!barber) return NextResponse.json({ error: "Barbeiro não encontrado" }, { status: 404 })

  // Check email uniqueness if changing
  if (email && email !== barber.user.email) {
    const taken = await prisma.user.findUnique({ where: { email } })
    if (taken) return NextResponse.json({ error: "Este email já está em uso" }, { status: 409 })
  }

  const userUpdate: Record<string, unknown> = {}
  if (name) userUpdate.name = name
  if (email) userUpdate.email = email
  if (phone !== undefined) userUpdate.phone = phone ? String(phone).replace(/\D/g, "") : null
  if (password) {
    if (password.length < 6)
      return NextResponse.json({ error: "Senha deve ter pelo menos 6 caracteres" }, { status: 400 })
    userUpdate.passwordHash = await bcrypt.hash(password, 12)
  }

  await prisma.$transaction([
    prisma.user.update({ where: { id: barber.userId }, data: userUpdate }),
    prisma.barber.update({ where: { id }, data: { bio: bio ?? barber.bio } }),
  ])

  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireOwner()
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const { id } = await params

  const barber = await prisma.barber.findUnique({
    where: { id, tenantId: session.user.tenantId! },
    include: {
      _count: {
        select: {
          appointments: {
            where: {
              scheduledAt: { gte: new Date() },
              status: { notIn: ["CANCELLED", "NO_SHOW"] },
            },
          },
        },
      },
    },
  })
  if (!barber) return NextResponse.json({ error: "Barbeiro não encontrado" }, { status: 404 })

  if (barber._count.appointments > 0) {
    return NextResponse.json(
      { error: `Este barbeiro tem ${barber._count.appointments} agendamento(s) futuro(s). Desative-o em vez de excluir.` },
      { status: 409 }
    )
  }

  await prisma.user.delete({ where: { id: barber.userId } })

  return NextResponse.json({ ok: true })
}
