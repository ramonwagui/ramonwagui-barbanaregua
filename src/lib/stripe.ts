import Stripe from "stripe"

// Fallback não-vazio evita que o construtor estoure no carregamento do módulo
// quando STRIPE_SECRET_KEY não está setada (ambientes sem cobrança). As chamadas
// reais são protegidas por isBillingConfigured() em src/lib/billing.ts.
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "sk_placeholder_unconfigured", {
  typescript: true,
})

export const STRIPE_PRICE_IDS: Record<string, string> = {
  BASIC: process.env.STRIPE_PRICE_BASIC ?? "",
  PRO: process.env.STRIPE_PRICE_PRO ?? "",
  PREMIUM: process.env.STRIPE_PRICE_PREMIUM ?? "",
}
