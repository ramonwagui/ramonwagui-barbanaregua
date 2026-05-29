"use client"

import { useState, useTransition, useRef } from "react"
import { useRouter } from "next/navigation"
import { updateTenantSettings } from "@/lib/actions"
import { Check, Upload, Trash2, ImageIcon } from "lucide-react"

type TenantData = {
  name: string
  phone: string
  address: string
  city: string
  state: string
  primaryColor: string
  slug: string
  logoUrl: string | null
}

const COLORS = ["#f59e0b", "#ef4444", "#3b82f6", "#8b5cf6", "#10b981", "#f97316", "#ec4899", "#1a1a2e"]

export default function ConfiguracoesClient({
  tenant: initial,
  isOwner,
}: {
  tenant: TenantData
  isOwner: boolean
}) {
  const router = useRouter()
  const [form, setForm] = useState(initial)
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)
  const [logoUrl, setLogoUrl] = useState<string | null>(initial.logoUrl)
  const [logoLoading, setLogoLoading] = useState(false)
  const [logoError, setLogoError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      await updateTenantSettings(form)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
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
      const res = await fetch("/api/dashboard/tenant/logo", {
        method: "POST",
        body: formData,
      })
      const data = await res.json()
      if (res.ok) {
        setLogoUrl(data.logoUrl)
        // Recarrega a página para atualizar o logo em todos os lugares
        router.refresh()
      } else {
        setLogoError(data.error ?? "Erro ao enviar imagem")
      }
    } catch {
      setLogoError("Erro de conexão")
    } finally {
      setLogoLoading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  async function handleLogoRemove() {
    setLogoLoading(true)
    setLogoError(null)
    try {
      const res = await fetch("/api/dashboard/tenant/logo", { method: "DELETE" })
      if (res.ok) setLogoUrl(null)
    } finally {
      setLogoLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Logo upload */}
      {isOwner && (
        <div
          className="rounded-2xl border border-zinc-800/60 overflow-hidden"
          style={{ backgroundColor: "#111111" }}
        >
          <div className="px-5 py-4 border-b border-zinc-800/60">
            <h2
              className="text-white font-semibold"
              style={{ fontFamily: "var(--font-cormorant)", fontSize: "1.1rem" }}
            >
              Logo da Barbearia
            </h2>
            <p className="text-zinc-600 text-xs mt-0.5">
              Aparece na página pública de agendamento. JPG, PNG ou WEBP, máx. 2 MB.
            </p>
          </div>

          <div className="px-5 py-5 flex items-center gap-6">
            {/* Preview */}
            <div
              className="w-24 h-24 rounded-2xl border-2 border-dashed flex items-center justify-center overflow-hidden shrink-0 transition-all"
              style={{ borderColor: logoUrl ? "#3f3f46" : "#27272a", backgroundColor: "#18181b" }}
            >
              {logoLoading ? (
                <div className="w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
              ) : logoUrl ? (
                <img
                  src={logoUrl}
                  alt="Logo"
                  className="w-full h-full object-contain p-1"
                />
              ) : (
                <ImageIcon className="w-8 h-8 text-zinc-700" />
              )}
            </div>

            {/* Actions */}
            <div className="flex-1">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={handleLogoUpload}
              />
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={logoLoading}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl border border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-500 text-sm font-medium transition-all disabled:opacity-50"
                >
                  <Upload className="w-4 h-4" />
                  {logoUrl ? "Trocar logo" : "Enviar logo"}
                </button>
                {logoUrl && (
                  <button
                    type="button"
                    onClick={handleLogoRemove}
                    disabled={logoLoading}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl border border-red-900/40 text-red-400 hover:bg-red-900/20 text-sm font-medium transition-all disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4" />
                    Remover
                  </button>
                )}
              </div>
              {logoError && (
                <p className="text-red-400 text-xs mt-2">{logoError}</p>
              )}
              {!logoError && !logoUrl && (
                <p className="text-zinc-600 text-xs mt-2">
                  Sem logo, será exibido o ícone padrão de tesoura.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Dados da barbearia */}
      <div
        className="rounded-2xl border border-zinc-800/60 overflow-hidden"
        style={{ backgroundColor: "#111111" }}
      >
        <div className="px-5 py-4 border-b border-zinc-800/60">
          <h2
            className="text-white font-semibold"
            style={{ fontFamily: "var(--font-cormorant)", fontSize: "1.1rem" }}
          >
            Dados da Barbearia
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">
              Nome da barbearia
            </label>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              disabled={!isOwner}
              className="w-full bg-zinc-900 border border-zinc-800 text-white placeholder:text-zinc-600 rounded-xl px-4 py-3 text-sm outline-none focus:border-amber-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">
                Telefone
              </label>
              <input
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                disabled={!isOwner}
                placeholder="(11) 99999-9999"
                className="w-full bg-zinc-900 border border-zinc-800 text-white placeholder:text-zinc-600 rounded-xl px-4 py-3 text-sm outline-none focus:border-amber-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">
                Endereço
              </label>
              <input
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                disabled={!isOwner}
                placeholder="Rua das Flores, 123"
                className="w-full bg-zinc-900 border border-zinc-800 text-white placeholder:text-zinc-600 rounded-xl px-4 py-3 text-sm outline-none focus:border-amber-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">
                Cidade
              </label>
              <input
                value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                disabled={!isOwner}
                placeholder="São Paulo"
                className="w-full bg-zinc-900 border border-zinc-800 text-white placeholder:text-zinc-600 rounded-xl px-4 py-3 text-sm outline-none focus:border-amber-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">
                Estado
              </label>
              <input
                value={form.state}
                onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
                disabled={!isOwner}
                placeholder="SP"
                maxLength={2}
                className="w-full bg-zinc-900 border border-zinc-800 text-white placeholder:text-zinc-600 rounded-xl px-4 py-3 text-sm outline-none focus:border-amber-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          {isOwner && (
            <div>
              <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">
                Cor principal (botões do site de agendamento)
              </label>
              <div className="flex items-center gap-3 flex-wrap">
                {COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, primaryColor: color }))}
                    className="w-8 h-8 rounded-full border-2 transition-all flex items-center justify-center"
                    style={{
                      backgroundColor: color,
                      borderColor: form.primaryColor === color ? "#fff" : "transparent",
                      transform: form.primaryColor === color ? "scale(1.2)" : "scale(1)",
                    }}
                  >
                    {form.primaryColor === color && (
                      <Check className="w-4 h-4 text-white drop-shadow" />
                    )}
                  </button>
                ))}
                <input
                  type="color"
                  value={form.primaryColor}
                  onChange={(e) => setForm((f) => ({ ...f, primaryColor: e.target.value }))}
                  className="w-8 h-8 rounded-full cursor-pointer border-2 border-zinc-600"
                  title="Cor personalizada"
                />
              </div>
            </div>
          )}

          {isOwner && (
            <div className="pt-2 flex items-center gap-3">
              <button
                type="submit"
                disabled={isPending}
                className="bg-amber-500 hover:bg-amber-400 text-black font-semibold px-6 py-2.5 rounded-xl text-sm transition-all disabled:opacity-60"
              >
                {isPending ? "Salvando..." : "Salvar alterações"}
              </button>
              {saved && (
                <div className="flex items-center gap-1.5 text-green-400 text-sm">
                  <Check className="w-4 h-4" />
                  Salvo!
                </div>
              )}
            </div>
          )}
        </form>
      </div>
    </div>
  )
}
