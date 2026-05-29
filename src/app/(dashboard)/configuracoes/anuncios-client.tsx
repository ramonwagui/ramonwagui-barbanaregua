"use client"

import { useState, useRef, useTransition } from "react"
import { Upload, Trash2, ExternalLink, ImageIcon, ToggleLeft, ToggleRight } from "lucide-react"

type Banner = {
  id: string
  imageUrl: string
  clickUrl: string | null
  position: "LEFT" | "RIGHT" | "BOTH"
  isActive: boolean
  sortOrder: number
}

const POSITION_LABELS: Record<string, string> = {
  LEFT: "Esquerda",
  RIGHT: "Direita",
  BOTH: "Ambos lados",
}

const POSITION_COLORS: Record<string, string> = {
  LEFT: "#60a5fa",
  RIGHT: "#c084fc",
  BOTH: "#f59e0b",
}

const MAX_BANNERS = 6

export default function AnunciosClient({ initialBanners }: { initialBanners: Banner[] }) {
  const [banners, setBanners] = useState<Banner[]>(initialBanners)
  const [isPending, startTransition] = useTransition()
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [newClickUrl, setNewClickUrl] = useState("")
  const [newPosition, setNewPosition] = useState<"LEFT" | "RIGHT" | "BOTH">("BOTH")
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setError(null)
    setUploading(true)

    const formData = new FormData()
    formData.append("file", file)
    formData.append("position", newPosition)
    if (newClickUrl.trim()) formData.append("clickUrl", newClickUrl.trim())

    try {
      const res = await fetch("/api/dashboard/tenant/banners", {
        method: "POST",
        body: formData,
      })
      const data = await res.json()
      if (res.ok) {
        setBanners((prev) => [...prev, data.banner])
        setNewClickUrl("")
        setNewPosition("BOTH")
      } else {
        setError(data.error ?? "Erro ao enviar banner")
      }
    } catch {
      setError("Erro de conexão")
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  function toggleActive(banner: Banner) {
    startTransition(async () => {
      const res = await fetch(`/api/dashboard/tenant/banners/${banner.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !banner.isActive }),
      })
      if (res.ok) {
        setBanners((prev) =>
          prev.map((b) => b.id === banner.id ? { ...b, isActive: !b.isActive } : b)
        )
      }
    })
  }

  function deleteBanner(banner: Banner) {
    startTransition(async () => {
      const res = await fetch(`/api/dashboard/tenant/banners/${banner.id}`, {
        method: "DELETE",
      })
      if (res.ok) {
        setBanners((prev) => prev.filter((b) => b.id !== banner.id))
      }
    })
  }

  function updatePosition(banner: Banner, position: "LEFT" | "RIGHT" | "BOTH") {
    startTransition(async () => {
      const res = await fetch(`/api/dashboard/tenant/banners/${banner.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ position }),
      })
      if (res.ok) {
        setBanners((prev) =>
          prev.map((b) => b.id === banner.id ? { ...b, position } : b)
        )
      }
    })
  }

  const canUpload = banners.length < MAX_BANNERS

  return (
    <div className="rounded-2xl border border-zinc-800/60 overflow-hidden" style={{ backgroundColor: "#111111" }}>
      <div className="px-5 py-4 border-b border-zinc-800/60">
        <h2 className="text-white font-semibold" style={{ fontFamily: "var(--font-cormorant)", fontSize: "1.1rem" }}>
          Anúncios na Página de Agendamento
        </h2>
        <p className="text-zinc-600 text-xs mt-0.5">
          Aparecem nas laterais da sua página pública em telas grandes. Máx. {MAX_BANNERS} banners.
        </p>
      </div>

      {/* Lista de banners */}
      {banners.length > 0 ? (
        <div className="divide-y divide-zinc-800/40">
          {banners.map((banner) => (
            <div key={banner.id} className="px-5 py-4 flex items-center gap-4" style={{ opacity: banner.isActive ? 1 : 0.5 }}>
              {/* Preview */}
              <div className="w-16 h-16 rounded-lg overflow-hidden border border-zinc-800 shrink-0 bg-zinc-900 flex items-center justify-center">
                <img src={banner.imageUrl} alt="Banner" className="w-full h-full object-cover" />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                {/* Position selector */}
                <div className="flex gap-1 mb-2">
                  {(["LEFT", "RIGHT", "BOTH"] as const).map((pos) => (
                    <button
                      key={pos}
                      onClick={() => updatePosition(banner, pos)}
                      disabled={isPending}
                      className="text-xs px-2 py-1 rounded-lg transition-all disabled:opacity-50"
                      style={{
                        backgroundColor: banner.position === pos ? `${POSITION_COLORS[pos]}20` : "#18181b",
                        color: banner.position === pos ? POSITION_COLORS[pos] : "#52525b",
                        border: `1px solid ${banner.position === pos ? POSITION_COLORS[pos] + "50" : "#27272a"}`,
                      }}
                    >
                      {POSITION_LABELS[pos]}
                    </button>
                  ))}
                </div>

                {/* Link */}
                {banner.clickUrl ? (
                  <div className="flex items-center gap-1">
                    <a
                      href={banner.clickUrl}
                      target="_blank"
                      className="text-xs text-amber-400 hover:text-amber-300 truncate flex items-center gap-1 max-w-[200px]"
                    >
                      <ExternalLink className="w-3 h-3 shrink-0" />
                      {banner.clickUrl}
                    </a>
                  </div>
                ) : (
                  <p className="text-zinc-700 text-xs">Sem link</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => toggleActive(banner)}
                  disabled={isPending}
                  title={banner.isActive ? "Desativar" : "Ativar"}
                  className="transition-colors disabled:opacity-50"
                >
                  {banner.isActive ? (
                    <ToggleRight className="w-6 h-6 text-amber-400" />
                  ) : (
                    <ToggleLeft className="w-6 h-6 text-zinc-600" />
                  )}
                </button>
                <button
                  onClick={() => deleteBanner(banner)}
                  disabled={isPending}
                  className="text-zinc-600 hover:text-red-400 transition-colors disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-10 text-center">
          <ImageIcon className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
          <p className="text-zinc-600 text-sm">Nenhum banner cadastrado</p>
          <p className="text-zinc-700 text-xs mt-1">Adicione banners de anunciantes da sua cidade</p>
        </div>
      )}

      {/* Formulário de upload */}
      {canUpload && (
        <div className="px-5 py-5 border-t border-zinc-800/60 space-y-4">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">
            Adicionar banner ({banners.length}/{MAX_BANNERS})
          </p>

          {/* Position selector */}
          <div>
            <p className="text-xs text-zinc-600 mb-2">Posição na página</p>
            <div className="flex gap-2">
              {(["LEFT", "RIGHT", "BOTH"] as const).map((pos) => (
                <button
                  key={pos}
                  type="button"
                  onClick={() => setNewPosition(pos)}
                  className="text-xs px-3 py-2 rounded-xl transition-all"
                  style={{
                    backgroundColor: newPosition === pos ? `${POSITION_COLORS[pos]}20` : "#18181b",
                    color: newPosition === pos ? POSITION_COLORS[pos] : "#71717a",
                    border: `2px solid ${newPosition === pos ? POSITION_COLORS[pos] : "#27272a"}`,
                  }}
                >
                  {POSITION_LABELS[pos]}
                </button>
              ))}
            </div>
          </div>

          {/* Click URL */}
          <div>
            <p className="text-xs text-zinc-600 mb-2">Link ao clicar no banner (opcional)</p>
            <input
              type="url"
              value={newClickUrl}
              onChange={(e) => setNewClickUrl(e.target.value)}
              placeholder="https://anunciante.com.br"
              className="w-full bg-zinc-900 border border-zinc-800 text-white placeholder:text-zinc-600 rounded-xl px-4 py-3 text-sm outline-none focus:border-amber-500 transition-all"
            />
          </div>

          {/* Upload button */}
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleUpload}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
              style={{ backgroundColor: "#f59e0b", color: "#000" }}
            >
              {uploading ? (
                <>
                  <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Selecionar imagem e enviar
                </>
              )}
            </button>
            <p className="text-zinc-700 text-xs mt-2">JPG, PNG ou WEBP · máx. 2 MB</p>
          </div>

          {error && <p className="text-red-400 text-xs">{error}</p>}
        </div>
      )}

      {!canUpload && (
        <div className="px-5 py-4 border-t border-zinc-800/60">
          <p className="text-zinc-500 text-xs">Limite de {MAX_BANNERS} banners atingido. Exclua um para adicionar outro.</p>
        </div>
      )}
    </div>
  )
}
