import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

export async function PATCH(req: Request) {
  const session = await auth()
  if (session?.user?.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 })
  }

  const { name, email, password } = await req.json()

  // Checar unicidade do email
  if (email && email !== session.user.email) {
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ error: "Este email já está em uso" }, { status: 409 })
    }
  }

  const data: Record<string, unknown> = {}
  if (name) data.name = name
  if (email) data.email = email
  if (password) data.passwordHash = await bcrypt.hash(password, 12)

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data,
    select: { name: true, email: true },
  })

  return NextResponse.json({ user })
}
