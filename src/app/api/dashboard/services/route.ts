import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.tenantId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  if (session.user.role === "BARBER") return NextResponse.json({ error: "Permissão insuficiente" }, { status: 403 })

  const body = await req.json()
  const { name, description, durationMinutes, price } = body

  if (!name?.trim()) return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 })

  const service = await prisma.service.create({
    data: {
      tenantId: session.user.tenantId,
      name,
      description: description || null,
      durationMinutes: Number(durationMinutes) || 30,
      price: Number(price) || 0,
    },
  })

  return NextResponse.json({ service })
}
