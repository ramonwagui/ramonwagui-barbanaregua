import { NextResponse } from "next/server"
import { getTenantBySlug } from "@/lib/tenant"
import { listActivePackages } from "@/lib/packages"

/** Lista os pacotes pré-pagos ativos do salão. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const tenant = await getTenantBySlug(slug)
    const packages = await listActivePackages(tenant.id)
    return NextResponse.json({ tenant: { name: tenant.name, slug: tenant.slug }, packages })
  } catch {
    return NextResponse.json({ error: "Barbearia não encontrada" }, { status: 404 })
  }
}
