"use client"

import { useState, useRef, useTransition } from "react"
import { Upload, Trash2, ImageIcon, Check, Eye, EyeOff } from "lucide-react"

type PlanPrices = { basic: number; pro: number; premium: number }
type StripePriceIds = { basic: string; pro: string; premium: string }

type Props = {
  platformLogoUrl: string | null
  adminName: string
  adminEmail: string
  adminId: string
  planPrices: PlanPrices
  stripePriceIds: StripePriceIds
}

export default function AdminConfigClient({ platformLogoUrl: initialLogo, adminName, adminEmail, adminId, planPrices, stripePriceIds }: Props) {
  const [logoUrl, setLogoUrl] = useState<string | null>(initialLogo)
  const [logoLoading, setLogoLoading] = useState(false)
  const [logoError, setLogoError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [name, setName] = useState(adminName)
  const [email, setEmail] = useState(adminEmail)
  const [password, setPassword] = useState("")
  const [showPass, setShowPass] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [profileSaved, setProfileSaved] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)

  // Planos / preços
  const [priceBasic,   setPriceBasic]   = useState(String(planPrices.basic / 100))
  const [pricePro,     setPricePro]     = useState(String(planPrices.pro / 100))
  const [pricePremium, setPricePremium] = useState(String(planPrices.premium / 100))
  const [stripeBasic,   setStripeBasic]   = useState(stripePriceIds.basic)
  const [stripePro,     setStripePro]     = useState(stripePriceIds.pro)
  const [stripePremium, setStripePremium] = useState(stripePriceIds.premium)
  const [plansSaved, setPlansSaved] = useState(false)
  const [plansError, setPlansError] = useState<string | null>(null)
  const [plansPending, startPlanTransition] = useTransition()

  function savePlans() {
    setPlansError(null)
    startPlanTransition(async () => {
      const toСents = (v: string) => Math.round(parseFloat(v.replace(",", ".")) * 100)
      const res = await fetch("/api/admin/config/planos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planPriceBasic:   toСents(priceBasic),
          planPricePro:     toСents(pricePro),
          planPricePremium: toСents(pricePremium),
          stripePriceBasic:   stripeBasic.trim(),
          stripePricePro:     stripePro.trim(),
          stripePricePremium: stripePremium.trim(),
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setPlansSaved(true)
        setTimeout(() => setPlansSaved(false), 3000)
      } else {
        setPlansError(data.error ?? "Erro ao salvar")
      }
    })
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoError(null)
    setLogoLoading(true)
    const formData = new FormData()
    formData.append("file", file)
    try {
      const res = await fetch("/api/admin/config/logo", { method: "POST", body: formData })
      const data = await res.json()
      if (res.ok) setLogoUrl(data.platformLogoUrl + "?t=" + Date.now())
      else setLogoError(data.error ?? "Erro ao enviar")
    } catch { setLogoError("Erro de conexão") }
    finally {
      setLogoLoading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  async function handleLogoRemove() {
    setLogoLoading(true)
    try {
      const res = await fetch("/api/admin/config/logo", { method: "DELETE" })
      if (res.ok) setLogoUrl(null)
    } finally { setLogoLoading(false) }
  }

  function saveProfile() {
    setProfileError(null)
    startTransition(async () => {
      const body: Record<string, string> = { name, email }
      if (password) body.password = password
      const res = await fetch(`/api/admin/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (res.ok) {
        setProfileSaved(true)
        setPassword("")
        setTimeout(() => setProfileSaved(false), 3000)
      } else {
        setProfileError(data.error ?? "Erro ao salvar")
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Logo da plataforma */}
      <div className="rounded-2xl border border-zinc-800/60 overflow-hidden" style={{ backgroundColor: "#111111" }}>
        <div className="px-5 py-4 border-b border-zinc-800/60">
          <h2 className="text-white font-semibold" style={{ fontFamily: "var(--font-cormorant)", fontSize: "1.1rem" }}>
            Logo da Plataforma
          </h2>
          <p className="text-zinc-600 text-xs mt-0.5">Exibida na sidebar do painel. JPG, PNG ou WEBP, máx. 2 MB.</p>
        </div>

        <div className="px-5 py-5 flex items-center gap-6">
          {/* Preview */}
          <div
            className="w-24 h-24 rounded-2xl border-2 border-dashed flex items-center justify-center overflow-hidden shrink-0"
            style={{ borderColor: logoUrl ? "#3f3f46" : "#27272a", backgroundColor: "#18181b" }}
          >
            {logoLoading ? (
              <div className="w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
            ) : logoUrl ? (
              <img src={logoUrl} alt="Logo" className="w-full h-full object-contain p-1" />
            ) : (
              <ImageIcon className="w-8 h-8 text-zinc-700" />
            )}
          </div>

          {/* Actions */}
          <div className="flex-1">
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={handleLogoUpload} />
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={logoLoading}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-500 text-sm font-medium transition-all disabled:opacity-50"
              >
                <Upload className="w-4 h-4" />
                {logoUrl ? "Trocar logo" : "Enviar logo"}
              </button>
              {logoUrl && (
                <button
                  onClick={handleLogoRemove}
                  disabled={logoLoading}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl border border-red-900/40 text-red-400 hover:bg-red-900/20 text-sm font-medium transition-all disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                  Remover
                </button>
              )}
            </div>
            {logoError && <p className="text-red-400 text-xs mt-2">{logoError}</p>}
            {!logoUrl && !logoError && (
              <p className="text-zinc-600 text-xs mt-2">Sem logo personalizada — exibindo logo padrão do sistema.</p>
            )}
          </div>
        </div>
      </div>

      {/* Perfil do admin */}
      <div className="rounded-2xl border border-zinc-800/60 overflow-hidden" style={{ backgroundColor: "#111111" }}>
        <div className="px-5 py-4 border-b border-zinc-800/60">
          <h2 className="text-white font-semibold" style={{ fontFamily: "var(--font-cormorant)", fontSize: "1.1rem" }}>
            Meu Perfil
          </h2>
        </div>

        <div className="px-5 py-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">Nome</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 text-white rounded-xl px-4 py-3 text-sm outline-none focus:border-amber-500 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 text-white rounded-xl px-4 py-3 text-sm outline-none focus:border-amber-500 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">Nova senha (deixe vazio para não alterar)</label>
            <div className="relative">
              <input
                type={showPass ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-zinc-900 border border-zinc-800 text-white placeholder:text-zinc-600 rounded-xl px-4 py-3 pr-10 text-sm outline-none focus:border-amber-500 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPass((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
              >
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {profileError && <p className="text-red-400 text-xs">{profileError}</p>}

          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={saveProfile}
              disabled={isPending}
              className="bg-amber-500 hover:bg-amber-400 text-black font-semibold px-6 py-2.5 rounded-xl text-sm transition-all disabled:opacity-60"
            >
              {isPending ? "Salvando..." : "Salvar perfil"}
            </button>
            {profileSaved && (
              <div className="flex items-center gap-1.5 text-green-400 text-sm">
                <Check className="w-4 h-4" /> Salvo!
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Planos e preços */}
      <div className="rounded-2xl border border-zinc-800/60 overflow-hidden" style={{ backgroundColor: "#111111" }}>
        <div className="px-5 py-4 border-b border-zinc-800/60">
          <h2 className="text-white font-semibold" style={{ fontFamily: "var(--font-cormorant)", fontSize: "1.1rem" }}>
            Planos e Preços
          </h2>
          <p className="text-zinc-600 text-xs mt-0.5">
            Preços em R$ exibidos na página de assinatura. Price IDs do Stripe sobrescrevem as variáveis de ambiente.
          </p>
        </div>

        <div className="px-5 py-5 space-y-6">
          {(["Basic", "Pro", "Premium"] as const).map((label) => {
            const key = label.toLowerCase() as "basic" | "pro" | "premium"
            const priceState   = { basic: priceBasic,   pro: pricePro,   premium: pricePremium   }
            const priceSet     = { basic: setPriceBasic, pro: setPricePro, premium: setPricePremium }
            const stripeState  = { basic: stripeBasic,  pro: stripePro,  premium: stripePremium  }
            const stripeSet    = { basic: setStripeBasic, pro: setStripePro, premium: setStripePremium }
            return (
              <div key={key}>
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">{label}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-zinc-600 mb-1">Preço (R$)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">R$</span>
                      <input
                        value={priceState[key]}
                        onChange={(e) => priceSet[key](e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 text-white rounded-xl pl-9 pr-4 py-2.5 text-sm outline-none focus:border-amber-500 transition-all"
                        placeholder="99"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-600 mb-1">Price ID Stripe</label>
                    <input
                      value={stripeState[key]}
                      onChange={(e) => stripeSet[key](e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 text-white rounded-xl px-4 py-2.5 text-sm outline-none focus:border-amber-500 transition-all font-mono"
                      placeholder="price_..."
                    />
                  </div>
                </div>
              </div>
            )
          })}

          {plansError && <p className="text-red-400 text-xs">{plansError}</p>}

          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={savePlans}
              disabled={plansPending}
              className="bg-amber-500 hover:bg-amber-400 text-black font-semibold px-6 py-2.5 rounded-xl text-sm transition-all disabled:opacity-60"
            >
              {plansPending ? "Salvando..." : "Salvar planos"}
            </button>
            {plansSaved && (
              <div className="flex items-center gap-1.5 text-green-400 text-sm">
                <Check className="w-4 h-4" /> Salvo!
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
