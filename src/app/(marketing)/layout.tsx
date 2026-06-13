import Link from "next/link"
import { Logo } from "@/components/logo"

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <header className="fixed top-0 inset-x-0 z-50 border-b border-zinc-800/50 backdrop-blur-sm bg-zinc-950/80">
        <div className="max-w-6xl mx-auto px-6 h-24 flex items-center justify-between">
          <Logo href="/" size="lg" />

          <nav className="hidden md:flex items-center gap-8">
            <Link href="#funcionalidades" className="text-zinc-400 hover:text-white text-sm transition-colors">
              Funcionalidades
            </Link>
            <Link href="#precos" className="text-zinc-400 hover:text-white text-sm transition-colors">
              Preços
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-zinc-400 hover:text-white text-sm font-medium transition-colors px-3 py-2"
            >
              Entrar
            </Link>
            <Link
              href="/register"
              className="bg-amber-500 hover:bg-amber-400 text-black text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              Começar grátis
            </Link>
          </div>
        </div>
      </header>

      <main className="pt-24">{children}</main>

      <footer className="border-t border-zinc-800/50 py-10">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <Logo size="md" />
          <p className="text-zinc-600 text-sm">
            © {new Date().getFullYear()} Barbanaregua. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  )
}
