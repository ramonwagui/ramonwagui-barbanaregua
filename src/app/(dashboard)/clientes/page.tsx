export const dynamic = 'force-dynamic'

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Users, Phone } from "lucide-react"

export default async function ClientesPage() {
  const session = await auth()
  if (!session?.user?.tenantId) redirect("/onboarding")

  const tenantId = session.user.tenantId

  const appointments = await prisma.appointment.findMany({
    where: {
      tenantId,
      guestPhone: { not: null },
      status: { notIn: ["CANCELLED", "NO_SHOW"] },
    },
    orderBy: { scheduledAt: "desc" },
    select: {
      id: true,
      guestName: true,
      guestPhone: true,
      scheduledAt: true,
      totalPrice: true,
      status: true,
    },
  })

  // Group by phone
  const clientMap = new Map<
    string,
    {
      name: string
      phone: string
      visits: number
      totalSpent: number
      firstVisit: Date
      lastVisit: Date
    }
  >()

  for (const appt of appointments) {
    const phone = appt.guestPhone!
    const existing = clientMap.get(phone)
    if (existing) {
      existing.visits++
      existing.totalSpent += Number(appt.totalPrice)
      if (appt.scheduledAt < existing.firstVisit) existing.firstVisit = appt.scheduledAt
      if (appt.scheduledAt > existing.lastVisit) existing.lastVisit = appt.scheduledAt
      if (appt.guestName && !existing.name) existing.name = appt.guestName
    } else {
      clientMap.set(phone, {
        name: appt.guestName ?? "—",
        phone,
        visits: 1,
        totalSpent: Number(appt.totalPrice),
        firstVisit: appt.scheduledAt,
        lastVisit: appt.scheduledAt,
      })
    }
  }

  const clients = Array.from(clientMap.values()).sort(
    (a, b) => b.lastVisit.getTime() - a.lastVisit.getTime()
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-white font-bold"
            style={{ fontFamily: "var(--font-cormorant)", fontSize: "2rem" }}
          >
            Clientes
          </h1>
          <p className="text-zinc-500 text-sm mt-0.5">
            {clients.length} cliente{clients.length !== 1 ? "s" : ""} únicos
          </p>
        </div>
      </div>

      {clients.length === 0 ? (
        <div
          className="rounded-2xl border border-zinc-800/60 py-20 text-center"
          style={{ backgroundColor: "#111111" }}
        >
          <Users className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
          <p className="text-zinc-600 text-sm">Nenhum cliente ainda</p>
        </div>
      ) : (
        <div
          className="rounded-2xl border border-zinc-800/60 overflow-hidden"
          style={{ backgroundColor: "#111111" }}
        >
          {/* Table header */}
          <div className="px-5 py-3 border-b border-zinc-800/60 grid grid-cols-12 gap-4">
            <p className="col-span-4 text-xs font-semibold text-zinc-500 uppercase tracking-widest">Cliente</p>
            <p className="col-span-2 text-xs font-semibold text-zinc-500 uppercase tracking-widest text-center">Visitas</p>
            <p className="col-span-3 text-xs font-semibold text-zinc-500 uppercase tracking-widest text-right">Total gasto</p>
            <p className="col-span-3 text-xs font-semibold text-zinc-500 uppercase tracking-widest text-right">Última visita</p>
          </div>

          <div className="divide-y divide-zinc-800/40">
            {clients.map((client) => (
              <div
                key={client.phone}
                className="px-5 py-4 grid grid-cols-12 gap-4 items-center hover:bg-zinc-800/20 transition-colors"
              >
                <div className="col-span-4 flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-zinc-800 flex items-center justify-center shrink-0">
                    <span className="text-zinc-400 text-xs font-bold">
                      {(client.name !== "—" ? client.name : "?")[0].toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-white text-sm font-medium truncate">{client.name}</p>
                    <p className="text-zinc-600 text-xs flex items-center gap-1 mt-0.5">
                      <Phone className="w-3 h-3" />
                      {client.phone}
                    </p>
                  </div>
                </div>

                <div className="col-span-2 text-center">
                  <span className="text-zinc-300 text-sm font-medium">{client.visits}</span>
                </div>

                <div className="col-span-3 text-right">
                  <p
                    className="text-amber-400 font-bold"
                    style={{ fontFamily: "var(--font-cormorant)", fontSize: "1.05rem" }}
                  >
                    R$ {client.totalSpent.toFixed(2).replace(".", ",")}
                  </p>
                </div>

                <div className="col-span-3 text-right">
                  <p className="text-zinc-400 text-sm">
                    {format(client.lastVisit, "dd/MM/yyyy", { locale: ptBR })}
                  </p>
                  <p className="text-zinc-600 text-xs mt-0.5">
                    1ª: {format(client.firstVisit, "dd/MM/yy")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

