"use client"

import { useState, useRef, useTransition } from "react"
import { Upload, Trash2, ImageIcon, Check, Eye, EyeOff } from "lucide-react"

type Props = {
  platformLogoUrl: string | null
  adminName: string
  adminEmail: string
  adminId: string
}

export default function AdminConfigClient({ platformLogoUrl: initialLogo, adminName, adminEmail, adminId }: Props) {
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
    </div>
  )
}
