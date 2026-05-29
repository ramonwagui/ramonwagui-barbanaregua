import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Logo } from "@/components/logo"
import type { Metadata, Viewport } from "next"
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  Scissors,
  UserCog,
  DollarSign,
  Settings,
  LogOut,
} from "lucide-react"

const NAV_ITEMS = [
  { href: "/dashboard", label: "Visão Geral", icon: LayoutDashboard },
  { href: "/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/servicos", label: "Serviços", icon: Scissors },
  { href: "/barbeiros", label: "Barbeiros", icon: UserCog },
  { href: "/financeiro", label: "Financeiro", icon: DollarSign, ownerOnly: true },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
]

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

  const isBarber = session.user.role === "BARBER"

  // Buscar logo e cor do tenant para o PWA
  const tenant = session.user.tenantId
    ? await prisma.tenant.findUnique({
        where: { id: session.user.tenantId },
        select: { logoUrl: true, primaryColor: true, name: true },
      })
    : null

  const accent = tenant?.primaryColor ?? "#f59e0b"
  const logoUrl = tenant?.logoUrl ?? null

  const userInitials = (session.user.name ?? session.user.email ?? "U")
    .split(" ")
    .slice(0, 2)
    .map((w: string) => w[0])
    .join("")
    .toUpperCase()

  return (
    <div className="flex min-h-screen bg-[#0d0d0d]">
      {/* PWA meta tags dinâmicos por tenant */}
      <head>
        <link rel="manifest" href="/api/dashboard/manifest" />
        <meta name="theme-color" content={accent} />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        {logoUrl && <link rel="apple-touch-icon" href={logoUrl} />}
      </head>

      {/* Sidebar */}
      <aside className="w-60 flex flex-col fixed inset-y-0 z-20 border-r border-zinc-800/60"
        style={{ backgroundColor: "#0a0a0a" }}
      >
        {/* Logo */}
        <div className="px-4 py-3 border-b border-zinc-800/60">
          {logoUrl ? (
            <Link href="/dashboard" className="block w-full">
              <div className="relative w-full" style={{ paddingBottom: "100%" }}>
                <img
                  src={logoUrl}
                  alt={tenant?.name ?? "Logo"}
                  className="absolute inset-0 w-full h-full object-contain"
                />
              </div>
            </Link>
          ) : (
            <Logo href="/dashboard" size="fill" />
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.filter((item) => !(item.ownerOnly && isBarber)).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group flex items-center gap-3 px-3 py-2.5 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800/60 transition-all text-sm font-medium relative"
            >
              <item.icon className="w-4 h-4 shrink-0 group-hover:text-amber-400 transition-colors" />
              {item.label}
            </Link>
          ))}
        </nav>

        {/* User section */}
        <div className="px-3 py-4 border-t border-zinc-800/60">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1">
            <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${accent}30` }}>
              <span className="text-xs font-bold" style={{ color: accent }}>{userInitials}</span>
            </div>
            <p className="text-xs text-zinc-500 font-medium truncate flex-1">{session.user.email}</p>
          </div>
          <Link
            href="/api/auth/signout"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-zinc-600 hover:text-white hover:bg-zinc-800/60 transition-all text-sm font-medium"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <main className="ml-60 flex-1 min-h-screen">
        <div className="px-8 py-8">{children}</div>
      </main>
    </div>
  )
}
