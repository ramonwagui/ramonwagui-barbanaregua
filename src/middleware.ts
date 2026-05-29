import NextAuth from "next-auth"
import { authConfig } from "@/lib/auth.config"
import { NextResponse } from "next/server"

const { auth } = NextAuth(authConfig)

const DASHBOARD_PATHS = [
  "/dashboard",
  "/agenda",
  "/clientes",
  "/servicos",
  "/barbeiros",
  "/financeiro",
  "/configuracoes",
  "/onboarding",
]

const OWNER_ONLY_PATHS = ["/financeiro", "/configuracoes/assinatura"]
const ADMIN_PATHS = ["/admin"]

export default auth(function middleware(req) {
  const url = req.nextUrl.clone()
  const path = url.pathname
  const session = req.auth

  const isAdminRoute = ADMIN_PATHS.some((p) => path.startsWith(p))
  const isDashboardRoute = DASHBOARD_PATHS.some((p) => path.startsWith(p))

  if (!isAdminRoute && !isDashboardRoute) return NextResponse.next()

  // Não autenticado → login
  if (!session?.user) {
    url.pathname = "/login"
    url.searchParams.set("callbackUrl", path)
    return NextResponse.redirect(url)
  }

  // Super admin só acessa /admin
  if (session.user.role === "SUPER_ADMIN") {
    if (isDashboardRoute) {
      url.pathname = "/admin"
      return NextResponse.redirect(url)
    }
    return NextResponse.next()
  }

  // Usuários comuns não acessam /admin
  if (isAdminRoute) {
    url.pathname = "/dashboard"
    return NextResponse.redirect(url)
  }

  // Barbeiro não acessa rotas exclusivas do dono
  const isOwnerOnly = OWNER_ONLY_PATHS.some((p) => path.startsWith(p))
  if (isOwnerOnly && session.user.role === "BARBER") {
    url.pathname = "/dashboard"
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/auth|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
