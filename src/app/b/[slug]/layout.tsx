import { getTenantBySlug } from "@/lib/tenant"
import { notFound } from "next/navigation"

export default async function BookingLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  try {
    await getTenantBySlug(slug)
  } catch {
    notFound()
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      {children}
    </div>
  )
}
