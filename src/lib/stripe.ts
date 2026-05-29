import Stripe from "stripe"

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  typescript: true,
})

export const STRIPE_PRICE_IDS: Record<string, string> = {
  BASIC: process.env.STRIPE_PRICE_BASIC ?? "",
  PRO: process.env.STRIPE_PRICE_PRO ?? "",
  PREMIUM: process.env.STRIPE_PRICE_PREMIUM ?? "",
}
