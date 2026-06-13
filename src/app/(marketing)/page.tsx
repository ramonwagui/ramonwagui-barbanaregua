export const dynamic = "force-dynamic"

import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { PLAN_PRICES, PLAN_LIMITS } from "@/lib/plans"

const FEATURES = [
  {
    icon: "✂",
    title: "Agendamento online",
    desc: "Seus clientes agendam 24h por dia pelo celular, sem precisar ligar ou enviar mensagem.",
  },
  {
    icon: "📅",
    title: "Gestão de agenda",
    desc: "Visualize todos os horários do dia, por barbeiro. Confirme, cancele ou remarque com um clique.",
  },
  {
    icon: "💬",
    title: "Lembretes no WhatsApp",
    desc: "Confirmações e lembretes automáticos via WhatsApp. Reduza faltas em até 60%.",
  },
  {
    icon: "💳",
    title: "Pagamento online com PIX",
    desc: "Aceite sinal e pagamentos via PIX direto na plataforma. Receba antes do cliente chegar.",
  },
  {
    icon: "👥",
    title: "Multi-barbeiros",
    desc: "Cada barbeiro com sua própria agenda, horários e serviços. Gerencie de 2 até ilimitados profissionais conforme seu plano.",
  },
  {
    icon: "🎯",
    title: "Programa de fidelidade",
    desc: "Fidelize clientes com sistema de pontos e recompensas. Exclusivo no plano Premium.",
  },
]

function planFeatures(tier: "BASIC" | "PRO" | "PREMIUM"): string[] {
  const l = PLAN_LIMITS[tier]
  const out: string[] = []
  out.push(l.maxBarbers === null ? "Barbeiros ilimitados" : `Até ${l.maxBarbers} barbeiros`)
  out.push(
    l.maxAppointmentsPerMonth === null
      ? "Agendamentos ilimitados"
      : `${l.maxAppointmentsPerMonth} agendamentos/mês`
  )
  if (l.whatsappNotifications) out.push("Notificações por WhatsApp")
  if (l.onlinePayments) out.push("Pagamento online (PIX + sinal)")
  if (l.loyaltyProgram) out.push("Programa de fidelidade")
  if (l.customDomain) out.push("Domínio próprio")
  if (l.apiAccess) out.push("Acesso à API")
  out.push(
    l.analyticsHistoryDays === null
      ? "Relatórios completos e ilimitados"
      : `Relatórios (${l.analyticsHistoryDays === 30 ? "30 dias" : "6 meses"})`
  )
  return out
}

function formatPrice(cents: number): string {
  return `R$ ${(cents / 100).toLocaleString("pt-BR")}`
}

export default async function LandingPage() {
  const config = await prisma.globalConfig.findUnique({
    where: { id: "singleton" },
    select: { planPriceBasic: true, planPricePro: true, planPricePremium: true },
  })

  const prices = {
    BASIC:   config?.planPriceBasic   ?? PLAN_PRICES.BASIC,
    PRO:     config?.planPricePro     ?? PLAN_PRICES.PRO,
    PREMIUM: config?.planPricePremium ?? PLAN_PRICES.PREMIUM,
  }

  const PLANS = [
    {
      tier: "BASIC" as const,
      name: "Basic",
      price: formatPrice(prices.BASIC),
      period: "/mês",
      desc: "Para barbearias que estão começando",
      features: planFeatures("BASIC"),
      cta: "Começar grátis",
      highlighted: false,
    },
    {
      tier: "PRO" as const,
      name: "Pro",
      price: formatPrice(prices.PRO),
      period: "/mês",
      desc: "Para barbearias em crescimento",
      features: planFeatures("PRO"),
      cta: "Começar grátis",
      highlighted: true,
    },
    {
      tier: "PREMIUM" as const,
      name: "Premium",
      price: formatPrice(prices.PREMIUM),
      period: "/mês",
      desc: "Para redes e grandes barbearias",
      features: planFeatures("PREMIUM"),
      cta: "Começar grátis",
      highlighted: false,
    },
  ]

  return (
    <>
      {/* Hero */}
      <section className="relative min-h-[90vh] flex items-center overflow-hidden">
        {/* Background elements */}
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute top-0 right-0 w-[60%] h-full opacity-5"
            style={{
              background:
                "radial-gradient(ellipse at top right, #f59e0b 0%, transparent 70%)",
            }}
          />
          <div
            className="absolute bottom-0 left-0 w-[40%] h-[50%] opacity-5"
            style={{
              background:
                "radial-gradient(ellipse at bottom left, #f59e0b 0%, transparent 70%)",
            }}
          />
          {/* Vertical lines */}
          <div className="absolute inset-0 opacity-[0.015]"
            style={{
              backgroundImage: "repeating-linear-gradient(90deg, #fff 0px, #fff 1px, transparent 1px, transparent 80px)",
            }}
          />
        </div>

        <div className="relative max-w-6xl mx-auto px-6 py-32">
          <div className="max-w-4xl">
            <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-full px-4 py-1.5 mb-10">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-amber-400 text-xs font-semibold tracking-widest uppercase">
                14 dias grátis · Sem cartão
              </span>
            </div>

            <h1
              className="text-white leading-none mb-8"
              style={{
                fontFamily: "var(--font-cormorant)",
                fontSize: "clamp(3.5rem, 8vw, 7rem)",
                fontWeight: 700,
              }}
            >
              Sua barbearia,
              <br />
              <span
                className="text-amber-400"
                style={{ fontStyle: "italic" }}
              >
                profissional.
              </span>
            </h1>

            <p className="text-zinc-400 text-lg md:text-xl leading-relaxed mb-12 max-w-2xl">
              Sistema completo de agendamento para barbearias brasileiras. Clientes agendam online, barbeiros gerenciam pelo celular, você recebe via PIX e acompanha tudo em tempo real.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href="/register"
                className="inline-flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-black font-bold px-8 py-4 rounded-xl text-base transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-amber-500/20"
              >
                Começar gratuitamente →
              </Link>
              <Link
                href="/b/barbearia-demo"
                className="inline-flex items-center justify-center gap-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-white font-medium px-8 py-4 rounded-xl text-base transition-all duration-200"
              >
                Ver demonstração
              </Link>
            </div>

            <p className="text-zinc-600 text-sm mt-6">
              Mais de 500 barbearias já usam o Barbanaregua
            </p>
          </div>
        </div>
      </section>

      {/* Social proof bar */}
      <div className="border-y border-zinc-800/50 bg-zinc-900/30 py-5">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-4 text-zinc-500 text-sm">
            {[
              "✂ Agendamento 24/7",
              "💬 Lembretes WhatsApp",
              "💳 PIX integrado",
              "📊 Relatórios em tempo real",
              "🎯 Programa de fidelidade",
              "⚡ Setup em 5 minutos",
            ].map((item) => (
              <span key={item} className="tracking-wide">{item}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Features */}
      <section id="funcionalidades" className="py-32">
        <div className="max-w-6xl mx-auto px-6">
          <div className="max-w-xl mb-20">
            <p className="text-amber-400 text-xs font-semibold tracking-widest uppercase mb-4">
              Funcionalidades
            </p>
            <h2
              className="text-white leading-tight"
              style={{
                fontFamily: "var(--font-cormorant)",
                fontSize: "clamp(2rem, 4vw, 3.5rem)",
                fontWeight: 700,
              }}
            >
              Tudo que uma barbearia precisa, em um lugar só.
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-zinc-800/50 rounded-2xl overflow-hidden">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="bg-zinc-950 p-8 hover:bg-zinc-900/80 transition-colors group"
              >
                <div className="text-3xl mb-5 group-hover:scale-110 transition-transform inline-block">
                  {feature.icon}
                </div>
                <h3
                  className="text-white font-semibold mb-3 text-lg"
                  style={{ fontFamily: "var(--font-cormorant)", fontSize: "1.3rem" }}
                >
                  {feature.title}
                </h3>
                <p className="text-zinc-500 text-sm leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="precos" className="py-32 border-t border-zinc-800/50">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-20">
            <p className="text-amber-400 text-xs font-semibold tracking-widest uppercase mb-4">
              Planos
            </p>
            <h2
              className="text-white"
              style={{
                fontFamily: "var(--font-cormorant)",
                fontSize: "clamp(2rem, 4vw, 3.5rem)",
                fontWeight: 700,
              }}
            >
              Simples, transparente, sem surpresa.
            </h2>
            <p className="text-zinc-500 mt-4 text-base">
              14 dias grátis em qualquer plano. Cancele quando quiser.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-4 max-w-5xl mx-auto">
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className={`relative rounded-2xl p-8 flex flex-col ${
                  plan.highlighted
                    ? "bg-amber-500 text-black"
                    : "bg-zinc-900 border border-zinc-800 text-white"
                }`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-zinc-950 text-amber-400 text-xs font-bold tracking-widest uppercase px-4 py-1.5 rounded-full border border-amber-500/30">
                      Mais popular
                    </span>
                  </div>
                )}

                <div className="mb-6">
                  <p
                    className={`text-sm font-semibold uppercase tracking-widest mb-1 ${
                      plan.highlighted ? "text-black/60" : "text-zinc-500"
                    }`}
                  >
                    {plan.name}
                  </p>
                  <div className="flex items-baseline gap-1 mb-2">
                    <span
                      className="font-bold"
                      style={{
                        fontFamily: "var(--font-cormorant)",
                        fontSize: "3rem",
                        lineHeight: 1,
                      }}
                    >
                      {plan.price}
                    </span>
                    <span className={`text-sm ${plan.highlighted ? "text-black/60" : "text-zinc-500"}`}>
                      {plan.period}
                    </span>
                  </div>
                  <p className={`text-sm ${plan.highlighted ? "text-black/70" : "text-zinc-500"}`}>
                    {plan.desc}
                  </p>
                </div>

                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5 text-sm">
                      <span className={`mt-0.5 text-xs ${plan.highlighted ? "text-black" : "text-amber-400"}`}>
                        ✓
                      </span>
                      <span className={plan.highlighted ? "text-black/80" : "text-zinc-400"}>
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>

                <Link
                  href="/register"
                  className={`w-full text-center font-semibold py-3 rounded-xl text-sm tracking-wide transition-all duration-200 ${
                    plan.highlighted
                      ? "bg-black text-amber-400 hover:bg-zinc-900"
                      : "bg-zinc-800 text-white hover:bg-zinc-700 border border-zinc-700"
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="py-32 border-t border-zinc-800/50">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2
            className="text-white mb-6"
            style={{
              fontFamily: "var(--font-cormorant)",
              fontSize: "clamp(2.5rem, 5vw, 4.5rem)",
              fontWeight: 700,
              fontStyle: "italic",
            }}
          >
            Pronto para profissionalizar sua barbearia?
          </h2>
          <p className="text-zinc-400 text-lg mb-10">
            Configure em 5 minutos. Sem cartão, sem burocracia.
          </p>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-black font-bold px-10 py-5 rounded-xl text-base transition-all duration-200 hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-amber-500/20"
          >
            Começar gratuitamente →
          </Link>
        </div>
      </section>
    </>
  )
}
