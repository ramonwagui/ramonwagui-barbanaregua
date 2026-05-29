import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (session?.user?.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json()
  const { isActive } = body

  if (typeof isActive !== "boolean") {
    return NextResponse.json({ error: "Campo isActive inválido" }, { status: 400 })
  }

  const tenant = await prisma.tenant.update({
    where: { id },
    data: { isActive },
    select: { id: true, name: true, isActive: true },
  })

  return NextResponse.json({ tenant })
}
