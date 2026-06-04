"use client"

import { useState, useTransition } from "react"
import {
  createServicePackage,
  updateServicePackage,
  toggleServicePackage,
  deleteServicePackage,
} from "@/lib/actions"
import { Plus, Pencil, Trash2, Package } from "lucide-react"

type Pkg = {
  id: string
  name: string
  serviceId: string
  serviceName: string
  credits: number
  price: number
  validityDays: number
  isActive: boolean
}
type ServiceOpt = { id: string; name: string }
type FormData = {
  name: string
  serviceId: string
  credits: number
  price: number
  validityDays: number
}

export default function PacotesClient({
  packages: initial,
  services,
}: {
  packages: Pkg[]
  services: ServiceOpt[]
}) {
  const [packages, setPackages] = useState(initial)
  const [isPending, startTransition] = useTransition()
  const [modal, setModal] = useState<{ type: "add" } | { type: "edit"; pkg: Pkg } | null>(null)
  const emptyForm: FormData = {
    name: "",
    serviceId: services[0]?.id ?? "",
    credits: 4,
    price: 0,
    validityDays: 90,
  }
  const [form, setForm] = useState<FormData>(emptyForm)
  const [error, setError] = useState<string | null>(null)

  function openAdd() {
    setForm(emptyForm)
    setError(null)
    setModal({ type: "add" })
  }
  function openEdit(pkg: Pkg) {
    setForm({
      name: pkg.name,
      serviceId: pkg.serviceId,
      credits: pkg.credits,
      price: pkg.price,
      validityDays: pkg.validityDays,
    })
    setError(null)
    setModal({ type: "edit", pkg })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return setError("Nome obrigatório")
    if (!form.serviceId) return setError("Selecione o serviço")
    if (form.credits < 1) return setError("Créditos inválidos")
    if (form.price < 0) return setError("Preço inválido")
    setError(null)

    const serviceName = services.find((s) => s.id === form.serviceId)?.name ?? ""
    startTransition(async () => {
      if (modal?.type === "add") {
        await createServicePackage(form)
        setPackages((prev) => [
          { id: Date.now().toString(), isActive: true, serviceName, ...form },
          ...prev,
        ])
      } else if (modal?.type === "edit") {
        await updateServicePackage(modal.pkg.id, form)
        setPackages((prev) =>
          prev.map((p) => (p.id === modal.pkg.id ? { ...p, serviceName, ...form } : p))
        )
      }
      setModal(null)
    })
  }

  function handleToggle(pkg: Pkg) {
    startTransition(async () => {
      await toggleServicePackage(pkg.id)
      setPackages((prev) =>
        prev.map((p) => (p.id === pkg.id ? { ...p, isActive: !p.isActive } : p))
      )
    })
  }
  function handleDelete(pkg: Pkg) {
    if (!confirm(`Excluir "${pkg.name}"?`)) return
    startTransition(async () => {
      await deleteServicePackage(pkg.id)
      setPackages((prev) => prev.filter((p) => p.id !== pkg.id))
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-white font-bold"
            style={{ fontFamily: "var(--font-cormorant)", fontSize: "2rem" }}
          >
            Pacotes
          </h1>
          <p className="text-zinc-500 text-sm mt-0.5">
            Venda créditos pré-pagos para os clientes usarem nos agendamentos.
          </p>
        </div>
        <button
          onClick={openAdd}
          disabled={services.length === 0}
          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-black font-semibold px-4 py-2.5 rounded-xl text-sm transition-all disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          Novo pacote
        </button>
      </div>

      {services.length === 0 && (
        <p className="text-amber-400 text-sm">
          Cadastre ao menos um serviço ativo antes de criar pacotes.
        </p>
      )}

      {packages.length === 0 ? (
        <div
          className="rounded-2xl border border-zinc-800/60 py-20 text-center"
          style={{ backgroundColor: "#111111" }}
        >
          <Package className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
          <p className="text-zinc-600 text-sm">Nenhum pacote cadastrado</p>
        </div>
      ) : (
        <div className="space-y-2">
          {packages.map((pkg) => (
            <div
              key={pkg.id}
              className="rounded-2xl border border-zinc-800/60 px-5 py-4 flex items-center gap-4"
              style={{ backgroundColor: "#111111", opacity: pkg.isActive ? 1 : 0.5 }}
            >
              <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center shrink-0">
                <Package className="w-4 h-4 text-zinc-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium text-sm">
                  {pkg.name}
                  {!pkg.isActive && (
                    <span className="ml-2 text-xs text-zinc-600 font-normal">(inativo)</span>
                  )}
                </p>
                <p className="text-zinc-500 text-xs mt-0.5">
                  {pkg.credits}× {pkg.serviceName} · validade {pkg.validityDays} dias
                </p>
              </div>
              <p
                className="text-amber-400 font-bold shrink-0"
                style={{ fontFamily: "var(--font-cormorant)", fontSize: "1.1rem" }}
              >
                R$ {pkg.price.toFixed(2).replace(".", ",")}
              </p>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => handleToggle(pkg)}
                  disabled={isPending}
                  className="w-8 h-8 rounded-lg hover:bg-zinc-700 text-zinc-500 hover:text-zinc-300 flex items-center justify-center transition-all text-xs disabled:opacity-50"
                  title={pkg.isActive ? "Desativar" : "Ativar"}
                >
                  {pkg.isActive ? "●" : "○"}
                </button>
                <button
                  onClick={() => openEdit(pkg)}
                  disabled={isPending}
                  className="w-8 h-8 rounded-lg hover:bg-zinc-700 text-zinc-500 hover:text-zinc-300 flex items-center justify-center transition-all disabled:opacity-50"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(pkg)}
                  disabled={isPending}
                  className="w-8 h-8 rounded-lg hover:bg-red-900/40 text-zinc-600 hover:text-red-400 flex items-center justify-center transition-all disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setModal(null)} />
          <div
            className="relative w-full max-w-md rounded-2xl border border-zinc-700 p-6 z-10"
            style={{ backgroundColor: "#111111" }}
          >
            <h2
              className="text-white font-bold mb-6"
              style={{ fontFamily: "var(--font-cormorant)", fontSize: "1.5rem" }}
            >
              {modal.type === "add" ? "Novo Pacote" : "Editar Pacote"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">
                  Nome *
                </label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Pacote 4 Cortes"
                  className="w-full bg-zinc-900 border border-zinc-800 text-white placeholder:text-zinc-600 rounded-xl px-4 py-3 text-sm outline-none focus:border-amber-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">
                  Serviço *
                </label>
                <select
                  value={form.serviceId}
                  onChange={(e) => setForm((f) => ({ ...f, serviceId: e.target.value }))}
                  className="w-full bg-zinc-900 border border-zinc-800 text-white rounded-xl px-4 py-3 text-sm outline-none focus:border-amber-500 transition-all"
                >
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">
                    Créditos *
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={form.credits}
                    onChange={(e) => setForm((f) => ({ ...f, credits: Number(e.target.value) }))}
                    className="w-full bg-zinc-900 border border-zinc-800 text-white rounded-xl px-3 py-3 text-sm outline-none focus:border-amber-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">
                    Preço *
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    value={form.price}
                    onChange={(e) => setForm((f) => ({ ...f, price: Number(e.target.value) }))}
                    className="w-full bg-zinc-900 border border-zinc-800 text-white rounded-xl px-3 py-3 text-sm outline-none focus:border-amber-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">
                    Validade (d)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={form.validityDays}
                    onChange={(e) => setForm((f) => ({ ...f, validityDays: Number(e.target.value) }))}
                    className="w-full bg-zinc-900 border border-zinc-800 text-white rounded-xl px-3 py-3 text-sm outline-none focus:border-amber-500 transition-all"
                  />
                </div>
              </div>

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
