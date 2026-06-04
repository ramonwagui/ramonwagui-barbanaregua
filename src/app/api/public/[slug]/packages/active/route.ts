import { NextResponse } from "next/server"
import { getTenantBySlug } from "@/lib/tenant"
import { getClientCredits } from "@/lib/packages"

/** Créditos de pacote ativos do cliente (por telefone). */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const phone = new URL(req.url).searchParams.get("phone") ?? ""
    const tenant = await getTenantBySlug(slug)
    const credits = await getClientCredits(tenant.id, phone)
    return NextResponse.json({ credits })
  } catch {
    return NextResponse.json({ credits: [] }, { status: 200 })
  }
}
