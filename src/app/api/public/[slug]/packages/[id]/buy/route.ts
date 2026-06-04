import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getTenantBySlug, TenantNotFoundError } from "@/lib/tenant"
import { getTenantMpToken, MpNotConnectedError } from "@/lib/mp-account"
import { createPixPayment } from "@/lib/mercadopago"
import { normalizePackagePhone } from "@/lib/packages"
import { checkRateLimit, getClientIp } from "@/lib/rate-limit"
import { addMinutes } from "date-fns"
import { Prisma } from "@prisma/client"

const PIX_EXPIRY_MINUTES = 30
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Compra de pacote pré-pago via PIX (cai na conta do salão). */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const { success } = await checkRateLimit("book", getClientIp(req))
    if (!success) {
      return NextResponse.json(
        { error: "Muitas tentativas. Aguarde um momento." },
        { status: 429 }
      )
    }

    const { slug, id } = await params
    const body = await req.json()
    const guestName = String(body?.guestName ?? "").trim()
    const phone = normalizePackagePhone(String(body?.guestPhone ?? ""))
    const guestEmail = String(body?.guestEmail ?? "").trim()

    if (guestName.length < 1 || phone.length < 10 || !emailRe.test(guestEmail)) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 })
    }

    const tenant = await getTenantBySlug(slug)

    const pkg = await prisma.servicePackage.findFirst({
      where: { id, tenantId: tenant.id, isActive: true },
      include: { service: { select: { name: true } } },
    })
    if (!pkg) {
      return NextResponse.json({ error: "Pacote não encontrado" }, { status: 404 })
    }

    // Token do salão (dinheiro cai na conta dele).
    let token: string
    try {
      token = await getTenantMpToken(tenant.id)
    } catch (err) {
      if (err instanceof MpNotConnectedError) {
        return NextResponse.json(
          { error: "Compra indisponível: a barbearia ainda não conectou o Mercado Pago." },
          { status: 503 }
        )
      }
      console.error("[PKG buy] token MP:", err)
      return NextResponse.json({ error: "Indisponível no momento." }, { status: 503 })
    }

    const expiresAt = addMinutes(new Date(), PIX_EXPIRY_MINUTES)

    // Cria a compra (PENDING) + Payment.
    const clientPackage = await prisma.clientPackage.create({
      data: {
        tenantId: tenant.id,
        packageId: pkg.id,
        serviceId: pkg.serviceId,
        clientPhone: phone,
        clientName: guestName,
        creditsTotal: pkg.credits,
        status: "PENDING",
      },
    })

    try {
      const payment = await prisma.payment.create({
        data: {
          tenantId: tenant.id,
          amount: new Prisma.Decimal(pkg.price),
          status: "PENDING",
          provider: "MERCADO_PAGO",
          metadata: { kind: "PACKAGE", packageId: pkg.id, clientPackageId: clientPackage.id },
        },
      })

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
      const pix = await createPixPayment(
        {
          amount: Number(pkg.price),
          description: `Pacote ${pkg.name} — ${tenant.name}`,
          payerEmail: guestEmail,
          externalReference: payment.id,
          expiresAt,
          notificationUrl: `${baseUrl.replace(/\/$/, "")}/api/webhooks/mercadopago`,
        },
        token
      )

      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          providerPaymentId: pix.id,
          pixCode: pix.qrCode,
          pixQrCode: pix.qrCodeBase64,
          status: "PROCESSING",
        },
      })
      await prisma.clientPackage.update({
        where: { id: clientPackage.id },
        data: { paymentId: payment.id },
      })

      return NextResponse.json(
        {
          success: true,
          paymentId: payment.id,
          pixCode: pix.qrCode,
          pixQrCode: pix.qrCodeBase64,
          amount: Number(pkg.price),
          expiresAt: expiresAt.toISOString(),
        },
        { status: 201 }
      )
    } catch (err) {
      console.error("[PKG buy] PIX:", err)
      await prisma.clientPackage
        .update({ where: { id: clientPackage.id }, data: { status: "CANCELLED" } })
        .catch(console.error)
      return NextResponse.json(
        { error: "Não foi possível gerar o pagamento. Tente novamente." },
        { status: 502 }
      )
    }
  } catch (error) {
    if (error instanceof TenantNotFoundError) {
      return NextResponse.json({ error: "Barbearia não encontrada" }, { status: 404 })
    }
    console.error("[PKG buy]", error)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
