import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function PATCH(req: Request) {
  const session = await auth()
  if (!session?.user?.tenantId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const body = await req.json()
  const { name, phone, city, state, address, primaryColor } = body

  await prisma.tenant.update({
    where: { id: session.user.tenantId },
    data: {
      ...(name && { name }),
      ...(phone !== undefined && { phone: phone || null }),
      ...(city !== undefined && { city: city || null }),
      ...(state !== undefined && { state: state || null }),
      ...(address !== undefined && { address: address || null }),
      ...(primaryColor && { primaryColor }),
    },
  })

  return NextResponse.json({ ok: true })
}
