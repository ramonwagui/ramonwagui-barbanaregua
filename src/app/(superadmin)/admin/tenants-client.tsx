"use client"

import { useState, useTransition } from "react"
import { format, addDays, addMonths } from "date-fns"
import { ptBR } from "date-fns/locale"
import { CheckCircle2, XCircle, ExternalLink, Scissors, CreditCard, X, Trash2, AlertTriangle } from "lucide-react"

type Tenant = {
  id: string
  name: string
  slug: string
  isActive: boolean
  createdAt: string
  primaryColor: string
  ownerName: string | null
  ownerEmail: string | null
  plan: string | null
  subscriptionStatus: string | null
  periodEnd: string | null
  barberCount: number
  appointmentCount: number
}

type PlanModalState = {
  tenantId: string
  tenantName: string
  plan: string
  status: string
  periodEnd: string
  trialEndsAt: string
}

const PLAN_LABELS: Record<string, string> = { BASIC: "Basic — R$ 99/mês", PRO: "Pro — R$ 199/mês", PREMIUM: "Premium — R$ 399/mês" }
const PLAN_BADGE: Record<string, string> = { BASIC: "Basic", PRO: "Pro", PREMIUM: "Premium" }
const PLAN_COLORS: Record<string, string> = { BASIC: "#60a5fa", PRO: "#f59e0b", PREMIUM: "#c084fc" }

const SUB_STATUS_LABELS: Record<string, string> = {
  TRIALING: "Trial", ACTIVE: "Ativo", PAST_DUE: "Vencido", CANCELLED: "Cancelado",
}
const SUB_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  TRIALING: { bg: "#1e3a5f20", text: "#60a5fa" },
  ACTIVE: { bg: "#14532d20", text: "#4ade80" },
  PAST_DUE: { bg: "#78350f20", text: "#fbbf24" },
  CANCELLED: { bg: "#7f1d1d20", text: "#f87171" },
}

function toInputDate(date: string | null | undefined): string {
  if (!date) return format(addMonths(new Date(), 1), "yyyy-MM-dd")
  return format(new Date(date), "yyyy-MM-dd")
}

export default function AdminTenantsClient({ tenants: initial }: { tenants: Tenant[] }) {
  const [tenants, setTenants] = useState(initial)
  const [isPending, startTransition] = useTransition()
  const [search, setSearch] = useState("")
  const [planModal, setPlanModal] = useState<PlanModalState | null>(null)
  const [planError, setPlanError] = useState<string | null>(null)
  const [deleteModal, setDeleteModal] = useState<{ id: string; name: string } | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState("")
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const filtered = tenants.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.slug.toLowerCase().includes(search.toLowerCase()) ||
      (t.ownerEmail ?? "").toLowerCase().includes(search.toLowerCase())
  )

  function openPlanModal(tenant: Tenant) {
    setPlanError(null)
    setPlanModal({
      tenantId: tenant.id,
      tenantName: tenant.name,
      plan: tenant.plan ?? "BASIC",
      status: tenant.subscriptionStatus ?? "TRIALING",
      periodEnd: toInputDate(tenant.periodEnd),
      trialEndsAt: toInputDate(tenant.periodEnd),
    })
  }

  function toggleActive(tenant: Tenant) {
    startTransition(async () => {
      const res = await fetch(`/api/admin/tenants/${tenant.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !tenant.isActive }),
      })
      if (res.ok) {
        setTenants((prev) =>
          prev.map((t) => t.id === tenant.id ? { ...t, isActive: !t.isActive } : t)
        )
      }
    })
  }

  function openDeleteModal(tenant: Tenant) {
    setDeleteConfirm("")
    setDeleteError(null)
    setDeleteModal({ id: tenant.id, name: tenant.name })
  }

  async function deleteTenant() {
    if (!deleteModal || deleteConfirm !== deleteModal.name) return
    setIsDeleting(true)
    setDeleteError(null)
    try {
      const res = await fetch(`/api/admin/tenants/${deleteModal.id}`, { method: "DELETE" })
      const data = await res.json()
      if (res.ok) {
        setTenants((prev) => prev.filter((t) => t.id !== deleteModal.id))
        setDeleteModal(null)
      } else {
        setDeleteError(data.error ?? "Erro ao excluir")
      }
    } catch {
      setDeleteError("Falha de conexão")
    } finally {
      setIsDeleting(false)
    }
  }

  function savePlan() {
    if (!planModal) return
    setPlanError(null)
    startTransition(async () => {
      const body: Record<string, unknown> = {
        plan: planModal.plan,
        status: planModal.status,
        currentPeriodEnd: planModal.periodEnd,
      }
      if (planModal.status === "TRIALING") {
        body.trialEndsAt = planModal.trialEndsAt
      }

      const res = await fetch(`/api/admin/tenants/${planModal.tenantId}/subscription`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (res.ok) {
        setTenants((prev) =>
          prev.map((t) =>
            t.id === planModal.tenantId
              ? {
                  ...t,
                  plan: data.subscription.plan,
                  subscriptionStatus: data.subscription.status,
                  periodEnd: data.subscription.currentPeriodEnd,
                }
              : t
          )
        )
        setPlanModal(null)
      } else {
        setPlanError(data.error ?? "Erro ao salvar")
      }
    })
  }

  return (
    <>
      <div className="rounded-2xl border border-zinc-800/60 overflow-hidden" style={{ backgroundColor: "#111111" }}>
        {/* Header */}
        <div className="px-6 py-5 border-b border-zinc-800/60 flex items-center justify-between gap-4 flex-wrap">
          <h2 className="text-white font-semibold" style={{ fontFamily: "var(--font-cormorant)", fontSize: "1.15rem" }}>
            Todas as Barbearias
          </h2>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, slug ou email..."
            className="bg-zinc-900 border border-zinc-800 text-white placeholder:text-zinc-600 rounded-lg px-3 py-2 text-xs outline-none focus:border-amber-500 transition-all w-64"
          />
        </div>

        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Scissors className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
            <p className="text-zinc-600 text-sm">Nenhuma barbearia encontrada</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-800/40">
                  {["Barbearia", "Dono", "Plano", "Barbeiros", "Agendamentos", "Cadastro", "Status", ""].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-widest whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/40">
                {filtered.map((tenant) => {
                  const subStyle = tenant.subscriptionStatus
                    ? SUB_STATUS_COLORS[tenant.subscriptionStatus] ?? SUB_STATUS_COLORS.CANCELLED
                    : null

                  return (
                    <tr key={tenant.id} className="hover:bg-zinc-800/20 transition-colors" style={{ opacity: tenant.isActive ? 1 : 0.5 }}>
                      {/* Nome + slug */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${tenant.primaryColor}25` }}>
                            <span className="text-xs font-bold" style={{ color: tenant.primaryColor }}>{tenant.name[0].toUpperCase()}</span>
                          </div>
                          <div>
                            <p className="text-white text-sm font-medium">{tenant.name}</p>
                            <div className="flex items-center gap-1 mt-0.5">
                              <p className="text-zinc-600 text-xs">/b/{tenant.slug}</p>
                              <a href={`/b/${tenant.slug}`} target="_blank" className="text-zinc-700 hover:text-amber-400 transition-colors">
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Dono */}
                      <td className="px-5 py-4">
                        <p className="text-zinc-300 text-sm">{tenant.ownerName ?? "—"}</p>
                        <p className="text-zinc-600 text-xs mt-0.5">{tenant.ownerEmail ?? "—"}</p>
                      </td>

                      {/* Plano */}
                      <td className="px-5 py-4">
                        {tenant.plan ? (
                          <span className="text-xs px-2 py-1 rounded-full font-semibold" style={{ backgroundColor: `${PLAN_COLORS[tenant.plan]}15`, color: PLAN_COLORS[tenant.plan] }}>
                            {PLAN_BADGE[tenant.plan]}
                          </span>
                        ) : (
                          <span className="text-zinc-700 text-xs">Sem plano</span>
                        )}
                        {subStyle && tenant.subscriptionStatus && (
                          <p className="mt-1">
                            <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: subStyle.bg, color: subStyle.text }}>
                              {SUB_STATUS_LABELS[tenant.subscriptionStatus]}
                            </span>
                          </p>
                        )}
                        {tenant.periodEnd && (
                          <p className="text-zinc-700 text-xs mt-1">
                            até {format(new Date(tenant.periodEnd), "dd/MM/yyyy")}
                          </p>
                        )}
                      </td>

                      {/* Barbeiros */}
                      <td className="px-5 py-4">
                        <p className="text-zinc-300 text-sm text-center">{tenant.barberCount}</p>
                      </td>

                      {/* Agendamentos */}
                      <td className="px-5 py-4">
                        <p className="text-zinc-300 text-sm text-center">{tenant.appointmentCount}</p>
                      </td>

                      {/* Cadastro */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <p className="text-zinc-500 text-xs">{format(new Date(tenant.createdAt), "dd/MM/yyyy", { locale: ptBR })}</p>
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5">
                          {tenant.isActive ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <XCircle className="w-4 h-4 text-red-500" />}
                          <span className={`text-xs font-medium ${tenant.isActive ? "text-emerald-400" : "text-red-400"}`}>
                            {tenant.isActive ? "Ativa" : "Inativa"}
                          </span>
                        </div>
                      </td>

                      {/* Ações */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openPlanModal(tenant)}
                            disabled={isPending}
                            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 transition-all disabled:opacity-50 whitespace-nowrap"
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                            Plano
                          </button>
                          <button
                            onClick={() => toggleActive(tenant)}
                            disabled={isPending}
                            className="text-xs px-3 py-1.5 rounded-lg border transition-all disabled:opacity-50 whitespace-nowrap"
                            style={{
                              borderColor: tenant.isActive ? "#7f1d1d60" : "#14532d60",
                              color: tenant.isActive ? "#f87171" : "#4ade80",
                              backgroundColor: tenant.isActive ? "#7f1d1d10" : "#14532d10",
                            }}
                          >
                            {tenant.isActive ? "Desativar" : "Ativar"}
                          </button>
                          <button
                            onClick={() => openDeleteModal(tenant)}
                            disabled={isPending}
                            className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-red-900/40 text-red-500 hover:bg-red-950/30 transition-all disabled:opacity-50"
                            title="Excluir salão permanentemente"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="px-6 py-3 border-t border-zinc-800/40">
          <p className="text-zinc-600 text-xs">
            {filtered.length} barbearia{filtered.length !== 1 ? "s" : ""}{search ? " encontradas" : " cadastradas"}
          </p>
        </div>
      </div>

      {/* Delete confirmation modal */}
      {deleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.8)" }}>
          <div className="rounded-2xl border border-red-900/50 w-full max-w-md" style={{ backgroundColor: "#111111" }}>
            <div className="flex items-center gap-3 px-6 py-4 border-b border-red-900/30">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "#7f1d1d30" }}>
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold" style={{ fontFamily: "var(--font-cormorant)", fontSize: "1.15rem" }}>
                  Excluir salão permanentemente
                </h3>
                <p className="text-red-400 text-xs mt-0.5">Esta ação não pode ser desfeita</p>
              </div>
              <button onClick={() => setDeleteModal(null)} className="ml-auto text-zinc-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <p className="text-zinc-400 text-sm">
                Todos os dados do salão <span className="text-white font-semibold">{deleteModal.name}</span> serão excluídos permanentemente:
                agendamentos, barbeiros, serviços, assinatura e usuários vinculados.
              </p>
              <div>
                <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">
                  Digite o nome do salão para confirmar
                </label>
                <input
                  value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                  placeholder={deleteModal.name}
                  className="w-full bg-zinc-900 border border-red-900/40 text-white placeholder:text-zinc-700 rounded-xl px-4 py-3 text-sm outline-none focus:border-red-500 transition-all"
                />
              </div>
              {deleteError && <p className="text-red-400 text-xs">{deleteError}</p>}
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-red-900/20">
              <button
                onClick={() => setDeleteModal(null)}
                className="px-4 py-2 rounded-xl border border-zinc-700 text-zinc-400 hover:text-white text-sm transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={deleteTenant}
                disabled={deleteConfirm !== deleteModal.name || isDeleting}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-red-700 hover:bg-red-600 text-white font-semibold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-4 h-4" />
                {isDeleting ? "Excluindo..." : "Excluir permanentemente"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Plan modal */}
      {planModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.7)" }}>
          <div className="rounded-2xl border border-zinc-800 w-full max-w-md" style={{ backgroundColor: "#111111" }}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
              <div>
                <h3 className="text-white font-semibold" style={{ fontFamily: "var(--font-cormorant)", fontSize: "1.15rem" }}>
                  Gerenciar Plano
                </h3>
                <p className="text-zinc-500 text-xs mt-0.5">{planModal.tenantName}</p>
              </div>
              <button onClick={() => setPlanModal(null)} className="text-zinc-500 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <div className="px-6 py-5 space-y-4">
              {/* Plan */}
              <div>
                <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">
                  Plano
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(["BASIC", "PRO", "PREMIUM"] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPlanModal((m) => m ? { ...m, plan: p } : m)}
                      className="py-3 rounded-xl border-2 text-sm font-semibold transition-all"
                      style={{
                        borderColor: planModal.plan === p ? PLAN_COLORS[p] : "#27272a",
                        backgroundColor: planModal.plan === p ? `${PLAN_COLORS[p]}15` : "#18181b",
                        color: planModal.plan === p ? PLAN_COLORS[p] : "#71717a",
                      }}
                    >
                      {PLAN_BADGE[p]}
                    </button>
                  ))}
                </div>
                <p className="text-zinc-600 text-xs mt-2">{PLAN_LABELS[planModal.plan]}</p>
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">
                  Status
                </label>
                <select
                  value={planModal.status}
                  onChange={(e) => setPlanModal((m) => m ? { ...m, status: e.target.value } : m)}
                  className="w-full bg-zinc-900 border border-zinc-800 text-white rounded-xl px-4 py-3 text-sm outline-none focus:border-amber-500 transition-all"
                >
                  <option value="TRIALING">Trial gratuito</option>
                  <option value="ACTIVE">Ativo (pago)</option>
                  <option value="PAST_DUE">Vencido</option>
                  <option value="CANCELLED">Cancelado</option>
                </select>
              </div>

              {/* Trial end (only for TRIALING) */}
              {planModal.status === "TRIALING" && (
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">
                    Trial termina em
                  </label>
                  <input
                    type="date"
                    value={planModal.trialEndsAt}
                    onChange={(e) => setPlanModal((m) => m ? { ...m, trialEndsAt: e.target.value, periodEnd: e.target.value } : m)}
                    className="w-full bg-zinc-900 border border-zinc-800 text-white rounded-xl px-4 py-3 text-sm outline-none focus:border-amber-500 transition-all"
                  />
                </div>
              )}

              {/* Period end */}
              <div>
                <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">
                  {planModal.status === "TRIALING" ? "Vencimento do período" : "Próximo vencimento"}
                </label>
                <input
                  type="date"
                  value={planModal.periodEnd}
                  onChange={(e) => setPlanModal((m) => m ? { ...m, periodEnd: e.target.value } : m)}
                  className="w-full bg-zinc-900 border border-zinc-800 text-white rounded-xl px-4 py-3 text-sm outline-none focus:border-amber-500 transition-all"
                />
              </div>

              {/* Quick presets */}
              <div className="flex gap-2 flex-wrap">
                <p className="text-xs text-zinc-600 w-full">Atalhos:</p>
                {[
                  { label: "+1 mês", days: 30 },
                  { label: "+3 meses", days: 90 },
                  { label: "+1 ano", days: 365 },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      const d = format(addDays(new Date(), preset.days), "yyyy-MM-dd")
                      setPlanModal((m) => m ? { ...m, periodEnd: d, trialEndsAt: d } : m)
                    }}
                    className="text-xs px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 transition-all"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {planError && <p className="text-red-400 text-xs">{planError}</p>}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-zinc-800">
              <button
                onClick={() => setPlanModal(null)}
                className="px-4 py-2 rounded-xl border border-zinc-700 text-zinc-400 hover:text-white text-sm transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={savePlan}
                disabled={isPending}
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold text-sm transition-all disabled:opacity-60"
              >
                {isPending ? "Salvando..." : "Salvar plano"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
