import { Logo } from "@/components/logo"

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-zinc-950 flex">
      {/* Left decorative panel */}
      <div className="hidden lg:flex lg:w-[45%] flex-col relative overflow-hidden bg-[#0a0a0a]">
        {/* Diagonal amber stripe */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "linear-gradient(135deg, transparent 0%, transparent 55%, #f59e0b08 55%, #f59e0b08 60%, transparent 60%)",
          }}
        />
        {/* Grain overlay */}
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          }}
        />

        {/* Content */}
        <div className="relative z-10 flex flex-col h-full px-12 py-16">
          {/* Logo */}
          <div className="mb-auto">
            <Logo size="md" />
          </div>

          {/* Big headline */}
          <div className="mb-auto">
            <p className="text-zinc-600 text-xs uppercase tracking-[0.3em] mb-6 font-medium">
              Sistema de agendamento
            </p>
            <h2
              className="text-white leading-none mb-6"
              style={{
                fontFamily: "var(--font-cormorant)",
                fontSize: "clamp(3rem, 5vw, 5.5rem)",
                fontWeight: 700,
                fontStyle: "italic",
              }}
            >
              Sua barbearia,
              <br />
              <span className="text-amber-400">profissional.</span>
            </h2>
            <p className="text-zinc-500 text-base leading-relaxed max-w-xs">
              Agendamento online, gestão de barbeiros e controle financeiro — tudo em um só lugar.
            </p>
          </div>

          {/* Bottom testimonial */}
          <div className="border-l-2 border-amber-400/30 pl-5">
            <p className="text-zinc-400 text-sm italic leading-relaxed">
              &ldquo;Triplicamos os agendamentos no primeiro mês. A barbearia nunca foi tão organizada.&rdquo;
            </p>
            <p className="text-zinc-600 text-xs mt-3 font-medium tracking-wide uppercase">
              — Rafael Costa, Barbearia Norte
            </p>
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex justify-center mb-10 lg:hidden">
            <Logo size="md" />
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}
