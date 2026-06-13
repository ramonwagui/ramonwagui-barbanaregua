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

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (session?.user?.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 })
  }

  const { id } = await params

  // Coletar IDs dos usuários vinculados (dono + barbeiros) antes de deletar
  const [barbers, tenant] = await Promise.all([
    prisma.barber.findMany({ where: { tenantId: id }, select: { userId: true } }),
    prisma.tenant.findUnique({ where: { id }, select: { ownerId: true, name: true } }),
  ])
  if (!tenant) return NextResponse.json({ error: "Salão não encontrado" }, { status: 404 })

  const userIds = [...new Set([tenant.ownerId, ...barbers.map((b) => b.userId)])]

  await prisma.$transaction(async (tx) => {
    // 1. Quebrar FK circular: User.tenantId → Tenant
    await tx.user.updateMany({ where: { tenantId: id }, data: { tenantId: null } })

    // 2. Registros filhos do agendamento
    await tx.notification.deleteMany({ where: { tenantId: id } })
    await tx.appointmentService.deleteMany({ where: { appointment: { tenantId: id } } })
    await tx.payment.deleteMany({ where: { tenantId: id } })
    await tx.appointment.deleteMany({ where: { tenantId: id } })

    // 3. Registros filhos do barbeiro (cascade cuida de schedule/timeblock/barberservice,
    //    mas deleteMany explícito é mais seguro)
    await tx.barberSchedule.deleteMany({ where: { barber: { tenantId: id } } })
    await tx.timeBlock.deleteMany({ where: { barber: { tenantId: id } } })
    await tx.barberService.deleteMany({ where: { barber: { tenantId: id } } })
    await tx.barber.deleteMany({ where: { tenantId: id } })

    // 4. Serviços e horários do salão
    await tx.service.deleteMany({ where: { tenantId: id } })
    await tx.businessHour.deleteMany({ where: { tenantId: id } })
    await tx.closedDay.deleteMany({ where: { tenantId: id } })

    // 5. Configurações e recursos do salão
    await tx.notifTemplate.deleteMany({ where: { tenantId: id } })
    await tx.webhookSetting.deleteMany({ where: { tenantId: id } })
    await tx.banner.deleteMany({ where: { tenantId: id } })
    await tx.mercadoPagoConnection.deleteMany({ where: { tenantId: id } })
    await tx.loyaltyCard.deleteMany({ where: { tenantId: id } })
    await tx.clientPackage.deleteMany({ where: { tenantId: id } })
    await tx.servicePackage.deleteMany({ where: { tenantId: id } })
    await tx.subscription.deleteMany({ where: { tenantId: id } })

    // 6. Deletar o tenant
    await tx.tenant.delete({ where: { id } })

    // 7. Deletar os usuários (dono + barbeiros)
    await tx.user.deleteMany({ where: { id: { in: userIds } } })
  }, { timeout: 30000 })

  return NextResponse.json({ success: true, deleted: tenant.name })
}
