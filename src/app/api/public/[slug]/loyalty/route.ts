import { NextResponse } from "next/server"
import { getTenantBySlug } from "@/lib/tenant"
import { getLoyaltyStatus } from "@/lib/loyalty"

/**
 * Status de fidelidade do cliente (por telefone) para exibir no agendamento.
 * GET /api/public/[slug]/loyalty?phone=...
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const phone = new URL(req.url).searchParams.get("phone") ?? ""
    const tenant = await getTenantBySlug(slug)
    const status = await getLoyaltyStatus(tenant.id, phone)
    return NextResponse.json(status)
  } catch {
    return NextResponse.json(
      { enabled: false, available: false },
      { status: 200 }
    )
  }
}
