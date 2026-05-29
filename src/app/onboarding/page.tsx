"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2, ChevronRight, Scissors } from "lucide-react"
import { Logo } from "@/components/logo"

const STEPS = ["Sua barbearia", "Primeiro serviço", "Pronto!"]

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [isPending, startTransition] = useTransition()

  // Step 0: shop info
  const [shopName, setShopName] = useState("")
  const [phone, setPhone] = useState("")
  const [city, setCity] = useState("")
  const [shopError, setShopError] = useState("")

  // Step 1: first service
  const [serviceName, setServiceName] = useState("")
  const [serviceDuration, setServiceDuration] = useState(30)
  const [servicePrice, setServicePrice] = useState(50)
  const [serviceError, setServiceError] = useState("")

  async function handleStep0() {
    if (!shopName.trim()) { setShopError("Nome da barbearia obrigatório"); return }
    setShopError("")

    startTransition(async () => {
      const res = await fetch("/api/dashboard/tenant", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: shopName, phone, city }),
      })
      if (res.ok) setStep(1)
    })
  }

  async function handleStep1() {
    if (!serviceName.trim()) { setServiceError("Nome do serviço obrigatório"); return }
    setServiceError("")

    startTransition(async () => {
      const res = await fetch("/api/dashboard/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: serviceName,
          description: "",
          durationMinutes: serviceDuration,
          price: servicePrice,
        }),
      })
      if (res.ok) setStep(2)
    })
  }

  function handleFinish() {
    router.push("/dashboard")
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-5">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <Logo size="md" />
          <p className="text-zinc-500 text-sm mt-3">Configure sua barbearia em 2 passos</p>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2 mb-10">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center gap-2 flex-1">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all"
                style={{
                  backgroundColor: i < step ? "#f59e0b" : i === step ? "#f59e0b15" : "#18181b",
                  border: `2px solid ${i <= step ? "#f59e0b" : "#27272a"}`,
                  color: i < step ? "#000" : i === step ? "#f59e0b" : "#3f3f46",
                }}
              >
                {i < step ? "✓" : i + 1}
              </div>
              <p className={`text-xs font-medium hidden sm:block ${i === step ? "text-white" : "text-zinc-600"}`}>
                {label}
              </p>
              {i < STEPS.length - 1 && (
                <div
                  className="flex-1 h-px ml-2"
                  style={{ backgroundColor: i < step ? "#f59e0b40" : "#27272a" }}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step 0 — Shop info */}
        {step === 0 && (
          <div
            className="rounded-2xl border border-zinc-800/60 overflow-hidden"
            style={{ backgroundColor: "#111111" }}
          >
            <div className="px-6 py-5 border-b border-zinc-800/60">
              <h2
                className="text-white font-bold"
                style={{ fontFamily: "var(--font-cormorant)", fontSize: "1.6rem" }}
              >
                Sobre sua barbearia
              </h2>
              <p className="text-zinc-500 text-sm mt-1">Essas informações aparecem no seu site de agendamento.</p>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">
                  Nome da barbearia *
                </label>
                <input
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  placeholder="Barbearia do João"
                  className="w-full bg-zinc-900 border border-zinc-800 text-white placeholder:text-zinc-600 rounded-xl px-4 py-3 text-sm outline-none focus:border-amber-500 transition-all"
                />
                {shopError && <p className="text-red-400 text-xs mt-1.5">{shopError}</p>}
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">
                    Telefone (WhatsApp)
                  </label>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="11999999999"
                    type="tel"
                    className="w-full bg-zinc-900 border border-zinc-800 text-white placeholder:text-zinc-600 rounded-xl px-4 py-3 text-sm outline-none focus:border-amber-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">
                    Cidade
                  </label>
                  <input
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="São Paulo"
                    className="w-full bg-zinc-900 border border-zinc-800 text-white placeholder:text-zinc-600 rounded-xl px-4 py-3 text-sm outline-none focus:border-amber-500 transition-all"
                  />
                </div>
              </div>
              <button
                onClick={handleStep0}
                disabled={isPending}
                className="w-full bg-amber-500 hover:bg-amber-400 text-black font-semibold py-3 rounded-xl text-sm transition-all disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {isPending ? "Salvando..." : <>Próximo <ChevronRight className="w-4 h-4" /></>}
              </button>
            </div>
          </div>
        )}

        {/* Step 1 — First service */}
        {step === 1 && (
          <div
            className="rounded-2xl border border-zinc-800/60 overflow-hidden"
            style={{ backgroundColor: "#111111" }}
          >
            <div className="px-6 py-5 border-b border-zinc-800/60">
              <h2
                className="text-white font-bold"
                style={{ fontFamily: "var(--font-cormorant)", fontSize: "1.6rem" }}
              >
                Seu primeiro serviço
              </h2>
              <p className="text-zinc-500 text-sm mt-1">Você pode adicionar mais depois em Serviços.</p>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">
                  Nome do serviço *
                </label>
                <input
                  value={serviceName}
                  onChange={(e) => setServiceName(e.target.value)}
                  placeholder="Corte masculino"
                  className="w-full bg-zinc-900 border border-zinc-800 text-white placeholder:text-zinc-600 rounded-xl px-4 py-3 text-sm outline-none focus:border-amber-500 transition-all"
                />
                {serviceError && <p className="text-red-400 text-xs mt-1.5">{serviceError}</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">
                    Duração (min)
                  </label>
                  <input
                    type="number"
                    min={5}
                    step={5}
                    value={serviceDuration}
                    onChange={(e) => setServiceDuration(Number(e.target.value))}
                    className="w-full bg-zinc-900 border border-zinc-800 text-white rounded-xl px-4 py-3 text-sm outline-none focus:border-amber-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">
                    Preço (R$)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={servicePrice}
                    onChange={(e) => setServicePrice(Number(e.target.value))}
                    className="w-full bg-zinc-900 border border-zinc-800 text-white rounded-xl px-4 py-3 text-sm outline-none focus:border-amber-500 transition-all"
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setStep(2)}
                  className="flex-1 py-3 rounded-xl border border-zinc-700 text-zinc-400 hover:text-white text-sm font-medium transition-all"
                >
                  Pular
                </button>
                <button
                  onClick={handleStep1}
                  disabled={isPending}
                  className="flex-1 bg-amber-500 hover:bg-amber-400 text-black font-semibold py-3 rounded-xl text-sm transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {isPending ? "Salvando..." : <>Próximo <ChevronRight className="w-4 h-4" /></>}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 2 — Done */}
        {step === 2 && (
          <div
            className="rounded-2xl border border-zinc-800/60 overflow-hidden text-center"
            style={{ backgroundColor: "#111111" }}
          >
            <div className="px-6 py-10">
              <div className="relative inline-flex items-center justify-center mb-6">
                <div className="w-20 h-20 rounded-full bg-amber-500/10 flex items-center justify-center">
                  <CheckCircle2 className="w-10 h-10 text-amber-400" />
                </div>
              </div>
              <h2
                className="text-white font-bold mb-3"
                style={{ fontFamily: "var(--font-cormorant)", fontSize: "2rem" }}
              >
                Tudo pronto!
              </h2>
              <p className="text-zinc-500 text-sm mb-8 max-w-xs mx-auto leading-relaxed">
                Sua barbearia está configurada. Você já pode receber agendamentos e gerenciar tudo pelo painel.
              </p>
              <button
                onClick={handleFinish}
                className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold py-3.5 rounded-xl text-sm transition-all flex items-center justify-center gap-2"
              >
                <Scissors className="w-4 h-4" />
                Ir para o painel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
