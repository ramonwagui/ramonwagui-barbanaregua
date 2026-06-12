import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { hasActiveSubscription, isBillingConfigured } from "@/lib/billing"
import DashboardNav from "./dashboard-nav"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session?.user) redirect("/login")
  if (!session.user.tenantId && session.user.role !== "SUPER_ADMIN") {
    redirect("/onboarding")
  }

  // Bloqueio por assinatura: sem assinatura ativa (trial expirado/inadimplente),
  // o painel redireciona para /assinatura. Só aplica se o Stripe estiver
  // configurado (evita travar ambientes sem cobrança).
  if (session.user.tenantId && isBillingConfigured()) {
    const sub = await prisma.subscription.findUnique({
      where: { tenantId: session.user.tenantId },
      select: { status: true, trialEndsAt: true },
    })
    if (!hasActiveSubscription(sub)) redirect("/assinatura")
  }

  const isBarber = session.user.role === "BARBER"

  const tenant = session.user.tenantId
    ? await prisma.tenant.findUnique({
        where: { id: session.user.tenantId },
        select: { name: true, logoUrl: true, primaryColor: true },
      })
    : null

  const accent = tenant?.primaryColor ?? "#f59e0b"

  const userInitials = (session.user.name ?? session.user.email ?? "U")
    .split(" ")
    .slice(0, 2)
    .map((w: string) => w[0])
    .join("")
    .toUpperCase()

  return (
    <div className="flex min-h-screen bg-[#0d0d0d]">
      {/* PWA meta tags */}
      <head>
        <link rel="manifest" href="/api/dashboard/manifest" />
        <meta name="theme-color" content={accent} />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        {tenant?.logoUrl && <link rel="apple-touch-icon" href={tenant.logoUrl} />}
      </head>

      <DashboardNav
        isBarber={isBarber}
        userInitials={userInitials}
        userEmail={session.user.email ?? ""}
        logoUrl={tenant?.logoUrl ?? null}
        tenantName={tenant?.name ?? "Dashboard"}
        accent={accent}
      />

      {/* Main content — mt-[60px] em mobile para não esconder atrás do header */}
      <main className="flex-1 min-h-screen mt-[60px] lg:mt-0 lg:ml-60">
        <div className="px-4 py-5 lg:px-8 lg:py-8">{children}</div>
      </main>
    </div>
  )
}
