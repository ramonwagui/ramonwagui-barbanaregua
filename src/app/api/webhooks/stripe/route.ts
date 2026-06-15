import { NextResponse } from "next/server"
import type Stripe from "stripe"
import { stripe } from "@/lib/stripe"
import { syncStripeSubscription, markPastDueBySubscriptionId } from "@/lib/billing"

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  const sig = req.headers.get("stripe-signature")
  const raw = await req.text()

  if (!secret || !sig) {
    return NextResponse.json({ error: "Webhook não configurado" }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(raw, sig, secret)
  } catch (err) {
    console.error("[stripe webhook] assinatura inválida:", err)
    return NextResponse.json({ error: "Assinatura inválida" }, { status: 400 })
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.data.object as Stripe.Checkout.Session
        if (s.subscription) {
          const subId = typeof s.subscription === "string" ? s.subscription : s.subscription.id
          const sub = await stripe.subscriptions.retrieve(subId)
          await syncStripeSubscription(sub)
        }
        break
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        await syncStripeSubscription(event.data.object as Stripe.Subscription)
        break
      }
      case "invoice.payment_failed": {
        const inv = event.data.object as unknown as { subscription?: string | { id: string } }
        const subId =
          typeof inv.subscription === "string" ? inv.subscription : inv.subscription?.id
        if (subId) await markPastDueBySubscriptionId(subId)
        break
      }
      default:
        break
    }
  } catch (err) {
    console.error("[stripe webhook] erro ao processar", event.type, err)
  }

  return NextResponse.json({ received: true }, { status: 200 })
}
