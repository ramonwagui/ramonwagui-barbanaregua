import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/**
 * Cron (Railway): cancela agendamentos PENDING cujo prazo de pagamento do
 * sinal (paymentExpiresAt) expirou, liberando o horário, e marca o Payment
 * pendente como FAILED.
 *
 * Proteção: header `Authorization: Bearer <CRON_SECRET>` ou `?secret=<CRON_SECRET>`.
 */
export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  const now = new Date()

  const expired = await prisma.appointment.findMany({
    where: {
      status: "PENDING",
      paymentExpiresAt: { lt: now },
    },
    select: { id: true },
  })

  if (expired.length === 0) {
    return NextResponse.json({ expired: 0 })
  }

  const ids = expired.map((a) => a.id)

  await prisma.$transaction([
    prisma.appointment.updateMany({
      where: { id: { in: ids } },
      data: {
        status: "CANCELLED",
        cancelledAt: now,
        cancellationReason: "Sinal não pago",
      },
    }),
    prisma.payment.updateMany({
      where: {
        appointmentId: { in: ids },
        status: { in: ["PENDING", "PROCESSING"] },
      },
      data: { status: "FAILED" },
    }),
  ])

  return NextResponse.json({ expired: ids.length })
}

function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false

  const auth = req.headers.get("authorization")
  if (auth === `Bearer ${secret}`) return true

  const url = new URL(req.url)
  return url.searchParams.get("secret") === secret
}
