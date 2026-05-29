"use client"

import { useState, useTransition } from "react"
import { toggleBarberActive } from "@/lib/actions"
import { UserCog, Plus, Scissors, Eye, EyeOff, Pencil, Trash2, Clock } from "lucide-react"

const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]

type Schedule = { dayOfWeek: number; startTime: string; endTime: string; breakStart?: string; breakEnd?: string; isActive: boolean }
type Barber = {
  id: string; isActive: boolean; bio: string; avatarUrl: string | null; todayCount: number
  user: { name: string; email: string }; workSchedules: Schedule[]
}
type Modal =
  | { type: "add" }
  | { type: "edit"; barber: Barber }
  | { type: "delete"; barber: Barber }
  | { type: "schedule"; barber: Barber }

const DEFAULT_SCHEDULE: Schedule[] = DAYS.map((_, i) => ({
  dayOfWeek: i,
  isActive: i >= 1 && i <= 6,
  startTime: "09:00",
  endTime: "18:00",
  breakStart: "12:00",
  breakEnd: "13:00",
}))

export default function BarbeirosClient({ barbers: initial, isOwner }: { barbers: Barber[]; isOwner: boolean }) {
  const [barbers, setBarbers] = useState(initial)
  const [modal, setModal] = useState<Modal | null>(null)
  const [isPending, startTransition] = useTransition()
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Add form
  const [addName, setAddName] = useState(""); const [addEmail, setAddEmail] = useState("")
  const [addPassword, setAddPassword] = useState(""); const [addBio, setAddBio] = useState("")
  const [showPwd, setShowPwd] = useState(false)

  // Edit form
  const [editName, setEditName] = useState("")
  const [editEmail, setEditEmail] = useState("")
  const [editBio, setEditBio] = useState("")
  const [editPassword, setEditPassword] = useState("")
  const [showEditPwd, setShowEditPwd] = useState(false)

  // Schedule form
  const [scheduleRows, setScheduleRows] = useState<Schedule[]>(DEFAULT_SCHEDULE)

  function openAdd() {
    setAddName(""); setAddEmail(""); setAddPassword(""); setAddBio(""); setShowPwd(false)
    setFormError(null); setModal({ type: "add" })
  }

  function openEdit(barber: Barber) {
    setEditName(barber.user.name)
    setEditEmail(barber.user.email)
    setEditBio(barber.bio)
    setEditPassword("")
    setShowEditPwd(false)
    setFormError(null)
    setModal({ type: "edit", barber })
  }

  function openSchedule(barber: Barber) {
    const rows = DAYS.map((_, i) => {
      const existing = barber.workSchedules.find((s) => s.dayOfWeek === i)
      return existing ?? { dayOfWeek: i, isActive: false, startTime: "09:00", endTime: "18:00", breakStart: "", breakEnd: "" }
    })
    setScheduleRows(rows); setFormError(null); setModal({ type: "schedule", barber })
  }

  function updateRow(dayOfWeek: number, patch: Partial<Schedule>) {
    setScheduleRows((prev) => prev.map((r) => r.dayOfWeek === dayOfWeek ? { ...r, ...patch } : r))
  }

  function handleToggle(barber: Barber) {
    startTransition(async () => {
      await toggleBarberActive(barber.id)
      setBarbers((prev) => prev.map((b) => b.id === barber.id ? { ...b, isActive: !b.isActive } : b))
    })
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault(); setFormError(null); setSubmitting(true)
    try {
      const res = await fetch("/api/dashboard/barbers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: addName, email: addEmail, password: addPassword, bio: addBio }),
      })
      const data = await res.json()
      if (!res.ok) { setFormError(data.error ?? "Erro ao cadastrar"); return }
      setBarbers((prev) => [...prev, {
        id: data.barber.id, isActive: true, bio: addBio, avatarUrl: null, todayCount: 0,
        user: { name: addName, email: addEmail },
        workSchedules: [1,2,3,4,5,6].map((d) => ({ dayOfWeek: d, startTime: "09:00", endTime: "18:00", breakStart: "12:00", breakEnd: "13:00", isActive: true })),
      }])
      setModal(null)
    } finally { setSubmitting(false) }
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    if (modal?.type !== "edit") return
    setFormError(null); setSubmitting(true)
    try {
      const res = await fetch(`/api/dashboard/barbers/${modal.barber.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName,
          email: editEmail,
          bio: editBio,
          password: editPassword || undefined,
        }),
      })
      if (!res.ok) { const d = await res.json(); setFormError(d.error ?? "Erro ao salvar"); return }
      setBarbers((prev) => prev.map((b) => b.id === modal.barber.id
        ? { ...b, bio: editBio, user: { name: editName, email: editEmail } } : b))
      setModal(null)
    } finally { setSubmitting(false) }
  }

  async function handleDelete() {
    if (modal?.type !== "delete") return
    setFormError(null); setSubmitting(true)
    try {
      const res = await fetch(`/api/dashboard/barbers/${modal.barber.id}`, { method: "DELETE" })
      if (!res.ok) { const d = await res.json(); setFormError(d.error ?? "Erro ao excluir"); return }
      setBarbers((prev) => prev.filter((b) => b.id !== modal.barber.id))
      setModal(null)
    } finally { setSubmitting(false) }
  }

  async function handleSchedule(e: React.FormEvent) {
    e.preventDefault()
    if (modal?.type !== "schedule") return
    setFormError(null); setSubmitting(true)
    try {
      const res = await fetch(`/api/dashboard/barbers/${modal.barber.id}/schedule`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schedules: scheduleRows }),
      })
      if (!res.ok) { const d = await res.json(); setFormError(d.error ?? "Erro ao salvar"); return }
      setBarbers((prev) => prev.map((b) => b.id === modal.barber.id
        ? { ...b, workSchedules: scheduleRows } : b))
      setModal(null)
    } finally { setSubmitting(false) }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white font-bold" style={{ fontFamily: "var(--font-cormorant)", fontSize: "2rem" }}>
            Barbeiros
          </h1>
          <p className="text-zinc-500 text-sm mt-0.5">{barbers.length} barbeiro{barbers.length !== 1 ? "s" : ""} cadastrados</p>
        </div>
        {isOwner && (
          <button onClick={openAdd} className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-black font-semibold px-4 py-2.5 rounded-xl text-sm transition-all">
            <Plus className="w-4 h-4" /> Adicionar barbeiro
          </button>
        )}
      </div>

      {barbers.length === 0 ? (
        <div className="rounded-2xl border border-zinc-800/60 py-20 text-center" style={{ backgroundColor: "#111111" }}>
          <UserCog className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
          <p className="text-zinc-600 text-sm mb-4">Nenhum barbeiro cadastrado</p>
          {isOwner && (
            <button onClick={openAdd} className="bg-amber-500 hover:bg-amber-400 text-black font-semibold px-4 py-2 rounded-xl text-sm transition-all">
              Adicionar primeiro barbeiro
            </button>
          )}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {barbers.map((barber) => (
            <div key={barber.id} className="rounded-2xl border border-zinc-800/60 overflow-hidden transition-opacity"
              style={{ backgroundColor: "#111111", opacity: barber.isActive ? 1 : 0.55 }}
            >
              {/* Header */}
              <div className="px-5 py-4 border-b border-zinc-800/60 flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-zinc-800 flex items-center justify-center shrink-0 border border-zinc-700">
                  {barber.avatarUrl
                    ? <img src={barber.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
                    : <span className="text-zinc-400 text-sm font-bold">{barber.user.name[0].toUpperCase()}</span>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-white font-medium text-sm truncate">{barber.user.name}</p>
                    <span className="text-xs px-2 py-0.5 rounded-full shrink-0"
                      style={{ backgroundColor: barber.isActive ? "#14532d20" : "#27272a30", color: barber.isActive ? "#4ade80" : "#71717a" }}
                    >
                      {barber.isActive ? "Ativo" : "Inativo"}
                    </span>
                  </div>
                  <p className="text-zinc-500 text-xs truncate">{barber.user.email}</p>
                </div>
                {/* Action buttons */}
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => openSchedule(barber)} title="Horários"
                    className="w-8 h-8 rounded-lg hover:bg-zinc-700 text-zinc-500 hover:text-amber-400 flex items-center justify-center transition-all"
                  >
                    <Clock className="w-3.5 h-3.5" />
                  </button>
                  {isOwner && (
                    <>
                      <button onClick={() => openEdit(barber)} title="Editar"
                        className="w-8 h-8 rounded-lg hover:bg-zinc-700 text-zinc-500 hover:text-zinc-300 flex items-center justify-center transition-all"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => { setFormError(null); setModal({ type: "delete", barber }) }} title="Excluir"
                        className="w-8 h-8 rounded-lg hover:bg-red-900/40 text-zinc-600 hover:text-red-400 flex items-center justify-center transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleToggle(barber)} disabled={isPending}
                        className="text-xs px-2.5 py-1.5 rounded-lg border border-zinc-700 hover:border-zinc-500 text-zinc-500 hover:text-zinc-300 transition-all disabled:opacity-50"
                      >
                        {barber.isActive ? "Desativar" : "Ativar"}
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 divide-x divide-zinc-800/60 border-b border-zinc-800/60">
                <div className="px-4 py-3 text-center">
                  <p className="text-amber-400 font-bold" style={{ fontFamily: "var(--font-cormorant)", fontSize: "1.4rem" }}>{barber.todayCount}</p>
                  <p className="text-zinc-600 text-xs">Hoje</p>
                </div>
                <div className="px-4 py-3 text-center">
                  <p className="text-white font-bold" style={{ fontFamily: "var(--font-cormorant)", fontSize: "1.4rem" }}>
                    {barber.workSchedules.filter((s) => s.isActive).length}
                  </p>
                  <p className="text-zinc-600 text-xs">Dias/semana</p>
                </div>
              </div>

              {/* Schedule preview */}
              <div className="px-5 py-4">
                <div className="flex gap-1 flex-wrap mb-2">
                  {DAYS.map((day, i) => {
                    const s = barber.workSchedules.find((ws) => ws.dayOfWeek === i && ws.isActive)
                    return (
                      <div key={day} className="text-center px-2 py-1 rounded-lg"
                        style={{ backgroundColor: s ? "#f59e0b15" : "#18181b", border: `1px solid ${s ? "#f59e0b30" : "#27272a"}` }}
                      >
                        <p className="text-xs font-medium" style={{ color: s ? "#fbbf24" : "#3f3f46" }}>{day}</p>
                        {s && <p className="text-zinc-500" style={{ fontSize: "0.6rem" }}>{s.startTime}</p>}
                      </div>
                    )
                  })}
                </div>
                {barber.bio && <p className="text-zinc-500 text-xs italic">"{barber.bio}"</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── ADD MODAL ── */}
      {modal?.type === "add" && (
        <Overlay onClose={() => setModal(null)}>
          <ModalHeader title="Adicionar Barbeiro" sub="O barbeiro fará login com o email e senha cadastrados." />
          <form onSubmit={handleAdd} className="px-6 py-5 space-y-4">
            <Field label="Nome completo *">
              <input value={addName} onChange={(e) => setAddName(e.target.value)} placeholder="Pedro Santos" autoFocus className={INPUT} />
            </Field>
            <Field label="Email *">
              <input type="email" value={addEmail} onChange={(e) => setAddEmail(e.target.value)} placeholder="pedro@barbearia.com" className={INPUT} />
            </Field>
            <Field label="Senha provisória *">
              <div className="relative">
                <input type={showPwd ? "text" : "password"} value={addPassword} onChange={(e) => setAddPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres" className={INPUT + " pr-10"} />
                <button type="button" onClick={() => setShowPwd((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-zinc-600 text-xs mt-1">Compartilhe com o barbeiro para o primeiro acesso.</p>
            </Field>
            <Field label="Bio (opcional)">
              <input value={addBio} onChange={(e) => setAddBio(e.target.value)} placeholder="Especialista em cortes clássicos" className={INPUT} />
            </Field>
            <div className="flex items-start gap-2 bg-zinc-900/60 border border-zinc-800 rounded-xl px-3 py-2.5">
              <Scissors className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-zinc-500 text-xs">Horário padrão: Seg–Sáb 09:00–18:00 com pausa 12:00–13:00. Ajuste depois em "Horários".</p>
            </div>
            <FormError error={formError} />
            <ModalActions onCancel={() => setModal(null)} loading={submitting} submitLabel="Cadastrar" />
          </form>
        </Overlay>
      )}

      {/* ── EDIT MODAL ── */}
      {modal?.type === "edit" && (
        <Overlay onClose={() => setModal(null)}>
          <ModalHeader title="Editar Barbeiro" />
          <form onSubmit={handleEdit} className="px-6 py-5 space-y-4">
            <Field label="Nome completo *">
              <input value={editName} onChange={(e) => setEditName(e.target.value)} autoFocus className={INPUT} />
            </Field>
            <Field label="Email *">
              <input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} className={INPUT} />
            </Field>
            <Field label="Bio">
              <input value={editBio} onChange={(e) => setEditBio(e.target.value)} placeholder="Especialista em cortes clássicos" className={INPUT} />
            </Field>
            <Field label="Nova senha (deixe em branco para não alterar)">
              <div className="relative">
                <input
                  type={showEditPwd ? "text" : "password"}
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className={INPUT + " pr-10"}
                />
                <button type="button" onClick={() => setShowEditPwd((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  {showEditPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </Field>
            <FormError error={formError} />
            <ModalActions onCancel={() => setModal(null)} loading={submitting} submitLabel="Salvar" />
          </form>
        </Overlay>
      )}

      {/* ── DELETE MODAL ── */}
      {modal?.type === "delete" && (
        <Overlay onClose={() => setModal(null)}>
          <div className="px-6 py-6 text-center">
            <div className="w-14 h-14 rounded-full bg-red-900/20 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-7 h-7 text-red-400" />
            </div>
            <h2 className="text-white font-bold mb-2" style={{ fontFamily: "var(--font-cormorant)", fontSize: "1.4rem" }}>
              Excluir barbeiro?
            </h2>
            <p className="text-zinc-500 text-sm mb-1">
              Você está prestes a excluir <span className="text-white font-medium">{modal.barber.user.name}</span>.
            </p>
            <p className="text-zinc-600 text-xs mb-6">
              Se houver agendamentos futuros, você precisará desativá-lo em vez de excluir.
            </p>
            <FormError error={formError} />
            <div className="flex gap-3 mt-4">
              <button onClick={() => setModal(null)}
                className="flex-1 py-3 rounded-xl border border-zinc-700 text-zinc-400 hover:text-white text-sm font-medium transition-all"
              >
                Cancelar
              </button>
              <button onClick={handleDelete} disabled={submitting}
                className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-sm transition-all disabled:opacity-60"
              >
                {submitting ? "Excluindo..." : "Excluir"}
              </button>
            </div>
          </div>
        </Overlay>
      )}

      {/* ── SCHEDULE MODAL ── */}
      {modal?.type === "schedule" && (
        <Overlay onClose={() => setModal(null)} wide>
          <ModalHeader title={`Horários — ${modal.barber.user.name}`} sub="Configure os dias e horários de atendimento." />
          <form onSubmit={handleSchedule} className="px-6 py-4 space-y-2">
            {scheduleRows.map((row) => (
              <div key={row.dayOfWeek} className="flex items-center gap-3 py-2.5 border-b border-zinc-800/40 last:border-0">
                {/* Toggle + Day */}
                <button
                  type="button"
                  onClick={() => updateRow(row.dayOfWeek, { isActive: !row.isActive })}
                  className="w-11 h-6 rounded-full transition-all shrink-0 relative"
                  style={{ backgroundColor: row.isActive ? "#f59e0b" : "#27272a" }}
                >
                  <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all"
                    style={{ left: row.isActive ? "calc(100% - 1.375rem)" : "0.125rem" }}
                  />
                </button>
                <span className="w-8 text-sm font-medium shrink-0" style={{ color: row.isActive ? "#fff" : "#52525b" }}>
                  {DAYS[row.dayOfWeek]}
                </span>

                {row.isActive ? (
                  <div className="flex items-center gap-2 flex-wrap flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-zinc-600 text-xs">Início</span>
                      <input type="time" value={row.startTime} onChange={(e) => updateRow(row.dayOfWeek, { startTime: e.target.value })}
                        className="bg-zinc-900 border border-zinc-800 text-white rounded-lg px-2 py-1.5 text-xs outline-none focus:border-amber-500 transition-all"
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-zinc-600 text-xs">Fim</span>
                      <input type="time" value={row.endTime} onChange={(e) => updateRow(row.dayOfWeek, { endTime: e.target.value })}
                        className="bg-zinc-900 border border-zinc-800 text-white rounded-lg px-2 py-1.5 text-xs outline-none focus:border-amber-500 transition-all"
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-zinc-600 text-xs">Pausa</span>
                      <input type="time" value={row.breakStart ?? ""} onChange={(e) => updateRow(row.dayOfWeek, { breakStart: e.target.value })}
                        className="bg-zinc-900 border border-zinc-800 text-white rounded-lg px-2 py-1.5 text-xs outline-none focus:border-amber-500 transition-all"
                      />
                      <span className="text-zinc-700 text-xs">–</span>
                      <input type="time" value={row.breakEnd ?? ""} onChange={(e) => updateRow(row.dayOfWeek, { breakEnd: e.target.value })}
                        className="bg-zinc-900 border border-zinc-800 text-white rounded-lg px-2 py-1.5 text-xs outline-none focus:border-amber-500 transition-all"
                      />
                    </div>
                  </div>
                ) : (
                  <span className="text-zinc-600 text-xs">Folga</span>
                )}
              </div>
            ))}
            <FormError error={formError} />
            <div className="pt-3">
              <ModalActions onCancel={() => setModal(null)} loading={submitting} submitLabel="Salvar horários" />
            </div>
          </form>
        </Overlay>
      )}
    </div>
  )
}

// ── Shared UI helpers ──────────────────────────────────────

const INPUT = "w-full bg-zinc-900 border border-zinc-800 text-white placeholder:text-zinc-600 rounded-xl px-4 py-3 text-sm outline-none focus:border-amber-500 transition-all"

function Overlay({ children, onClose, wide }: { children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-full ${wide ? "max-w-2xl" : "max-w-md"} rounded-2xl border border-zinc-700 overflow-hidden z-10 max-h-[90vh] overflow-y-auto`}
        style={{ backgroundColor: "#111111" }}
      >
        {children}
      </div>
    </div>
  )
}

function ModalHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="px-6 py-5 border-b border-zinc-800/60">
      <h2 className="text-white font-bold" style={{ fontFamily: "var(--font-cormorant)", fontSize: "1.5rem" }}>{title}</h2>
      {sub && <p className="text-zinc-500 text-xs mt-1">{sub}</p>}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">{label}</label>
      {children}
    </div>
  )
}

function FormError({ error }: { error: string | null }) {
  if (!error) return null
  return <p className="text-red-400 text-sm bg-red-950/30 border border-red-800/50 rounded-xl px-3 py-2">{error}</p>
}

function ModalActions({ onCancel, loading, submitLabel }: { onCancel: () => void; loading: boolean; submitLabel: string }) {
  return (
    <div className="flex gap-3">
      <button type="button" onClick={onCancel} className="flex-1 py-3 rounded-xl border border-zinc-700 text-zinc-400 hover:text-white text-sm font-medium transition-all">
        Cancelar
      </button>
      <button type="submit" disabled={loading} className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold text-sm transition-all disabled:opacity-60">
        {loading ? "Salvando..." : submitLabel}
      </button>
    </div>
  )
}
