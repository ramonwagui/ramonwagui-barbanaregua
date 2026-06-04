"use client"

import { useState, useTransition } from "react"
import { createService, updateService, toggleServiceActive, deleteService } from "@/lib/actions"
import { Clock, Plus, Pencil, Trash2, Scissors } from "lucide-react"

type Service = {
  id: string
  name: string
  description: string
  durationMinutes: number
  price: number
  isActive: boolean
  isUpsellSuggestion: boolean
}

type FormData = {
  name: string
  description: string
  durationMinutes: number
  price: number
  isUpsellSuggestion: boolean
}

const EMPTY_FORM: FormData = {
  name: "",
  description: "",
  durationMinutes: 30,
  price: 0,
  isUpsellSuggestion: false,
}

export default function ServicosClient({
  services: initial,
  isOwner,
}: {
  services: Service[]
  isOwner: boolean
}) {
  const [services, setServices] = useState(initial)
  const [isPending, startTransition] = useTransition()
  const [modal, setModal] = useState<{ type: "add" } | { type: "edit"; service: Service } | null>(null)
  const [form, setForm] = useState<FormData>(EMPTY_FORM)
  const [error, setError] = useState<string | null>(null)

  function openAdd() {
    setForm(EMPTY_FORM)
    setError(null)
    setModal({ type: "add" })
  }

  function openEdit(service: Service) {
    setForm({
      name: service.name,
      description: service.description,
      durationMinutes: service.durationMinutes,
      price: service.price,
      isUpsellSuggestion: service.isUpsellSuggestion,
    })
    setError(null)
    setModal({ type: "edit", service })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { setError("Nome obrigatório"); return }
    if (form.price < 0) { setError("Preço inválido"); return }
    setError(null)

    startTransition(async () => {
      if (modal?.type === "add") {
        await createService(form)
        setServices((prev) => [...prev, {
          id: Date.now().toString(), isActive: true, ...form
        }])
      } else if (modal?.type === "edit") {
        await updateService(modal.service.id, form)
        setServices((prev) =>
          prev.map((s) => s.id === modal.service.id ? { ...s, ...form } : s)
        )
      }
      setModal(null)
    })
  }

  function handleToggle(service: Service) {
    startTransition(async () => {
      await toggleServiceActive(service.id)
      setServices((prev) =>
        prev.map((s) => s.id === service.id ? { ...s, isActive: !s.isActive } : s)
      )
    })
  }

  function handleDelete(service: Service) {
    if (!confirm(`Excluir "${service.name}"? Esta ação não pode ser desfeita.`)) return
    startTransition(async () => {
      await deleteService(service.id)
      setServices((prev) => prev.filter((s) => s.id !== service.id))
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-white font-bold"
            style={{ fontFamily: "var(--font-cormorant)", fontSize: "2rem" }}
          >
            Serviços
          </h1>
          <p className="text-zinc-500 text-sm mt-0.5">
            {services.length} serviço{services.length !== 1 ? "s" : ""} cadastrados
          </p>
        </div>
        {isOwner && (
          <button
            onClick={openAdd}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-black font-semibold px-4 py-2.5 rounded-xl text-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            Novo serviço
          </button>
        )}
      </div>

      {/* List */}
      {services.length === 0 ? (
        <div
          className="rounded-2xl border border-zinc-800/60 py-20 text-center"
          style={{ backgroundColor: "#111111" }}
        >
          <Scissors className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
          <p className="text-zinc-600 text-sm mb-4">Nenhum serviço cadastrado</p>
          {isOwner && (
            <button
              onClick={openAdd}
              className="bg-amber-500 hover:bg-amber-400 text-black font-semibold px-4 py-2 rounded-xl text-sm transition-all"
            >
              Adicionar primeiro serviço
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {services.map((service) => (
            <div
              key={service.id}
              className="rounded-2xl border border-zinc-800/60 px-5 py-4 flex items-center gap-4 hover:border-zinc-700 transition-colors"
              style={{
                backgroundColor: "#111111",
                opacity: service.isActive ? 1 : 0.5,
              }}
            >
              <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center shrink-0">
                <Scissors className="w-4 h-4 text-zinc-400" />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-white font-medium text-sm">
                  {service.name}
                  {!service.isActive && (
                    <span className="ml-2 text-xs text-zinc-600 font-normal">(inativo)</span>
                  )}
                </p>
                {service.description && (
                  <p className="text-zinc-500 text-xs mt-0.5 truncate">{service.description}</p>
                )}
                <p className="text-zinc-600 text-xs mt-1 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {service.durationMinutes} min
                </p>
              </div>

              <p
                className="text-amber-400 font-bold shrink-0"
                style={{ fontFamily: "var(--font-cormorant)", fontSize: "1.1rem" }}
              >
                R$ {service.price.toFixed(2).replace(".", ",")}
              </p>

              {isOwner && (
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleToggle(service)}
                    disabled={isPending}
                    className="w-8 h-8 rounded-lg hover:bg-zinc-700 text-zinc-500 hover:text-zinc-300 flex items-center justify-center transition-all text-xs disabled:opacity-50"
                    title={service.isActive ? "Desativar" : "Ativar"}
                  >
                    {service.isActive ? "●" : "○"}
                  </button>
                  <button
                    onClick={() => openEdit(service)}
                    disabled={isPending}
                    className="w-8 h-8 rounded-lg hover:bg-zinc-700 text-zinc-500 hover:text-zinc-300 flex items-center justify-center transition-all disabled:opacity-50"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(service)}
                    disabled={isPending}
                    className="w-8 h-8 rounded-lg hover:bg-red-900/40 text-zinc-600 hover:text-red-400 flex items-center justify-center transition-all disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setModal(null)}
          />
          <div
            className="relative w-full max-w-md rounded-2xl border border-zinc-700 p-6 z-10"
            style={{ backgroundColor: "#111111" }}
          >
            <h2
              className="text-white font-bold mb-6"
              style={{ fontFamily: "var(--font-cormorant)", fontSize: "1.5rem" }}
            >
              {modal.type === "add" ? "Novo Serviço" : "Editar Serviço"}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">
                  Nome *
                </label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Corte masculino"
                  className="w-full bg-zinc-900 border border-zinc-800 text-white placeholder:text-zinc-600 rounded-xl px-4 py-3 text-sm outline-none focus:border-amber-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">
                  Descrição
                </label>
                <input
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Descrição opcional"
                  className="w-full bg-zinc-900 border border-zinc-800 text-white placeholder:text-zinc-600 rounded-xl px-4 py-3 text-sm outline-none focus:border-amber-500 transition-all"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">
                    Duração (min) *
                  </label>
                  <input
                    type="number"
                    min={5}
                    step={5}
                    value={form.durationMinutes}
                    onChange={(e) => setForm((f) => ({ ...f, durationMinutes: Number(e.target.value) }))}
                    className="w-full bg-zinc-900 border border-zinc-800 text-white rounded-xl px-4 py-3 text-sm outline-none focus:border-amber-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">
                    Preço (R$) *
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    value={form.price}
                    onChange={(e) => setForm((f) => ({ ...f, price: Number(e.target.value) }))}
                    className="w-full bg-zinc-900 border border-zinc-800 text-white rounded-xl px-4 py-3 text-sm outline-none focus:border-amber-500 transition-all"
                  />
                </div>
              </div>

              <label className="flex items-center justify-between gap-3 cursor-pointer rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
                <div>
                  <p className="text-white text-sm font-medium">Sugerir como add-on</p>
                  <p className="text-zinc-600 text-xs mt-0.5">
                    Aparece como sugestão no bloco Adicione também do agendamento.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={form.isUpsellSuggestion}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, isUpsellSuggestion: e.target.checked }))
                  }
                  className="w-5 h-5 accent-amber-500 shrink-0"
                />
              </label>

              {error && (
                <p className="text-red-400 text-sm bg-red-950/30 border border-red-800/50 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModal(null)}
                  className="flex-1 py-3 rounded-xl border border-zinc-700 text-zinc-400 hover:text-white text-sm font-medium transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold text-sm transition-all disabled:opacity-60"
                >
                  {isPending ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
