#!/bin/bash
# ab-tracker — clickable Clients page with WO detail panel
set -e
cd ~/ab-tracker

echo "→ Splitting Clients page: server fetches data, client component handles interaction..."

mkdir -p components/clients

cat > components/clients/ClientsClient.tsx << 'EOF'
'use client'
import { useState, useMemo } from 'react'
import { STAGES } from '@/lib/types'

type Client = { id: string; name: string; status: string; account_lead?: string }
type WO = { id: string; title: string; stage: string; client_id: string; est_cost?: number; add_cost?: number; due_date?: string; priority?: string; services?: { name: string }; team_members?: { name: string } }

export default function ClientsClient({ clients, workOrders }: { clients: Client[]; workOrders: WO[] }) {
  const [selected, setSelected] = useState<Client | null>(null)
  const [search, setSearch] = useState('')

  const stats = useMemo(() => {
    const map: Record<string, { count: number; active: number; pipeline: number; revenue: number }> = {}
    workOrders.forEach(wo => {
      if (!map[wo.client_id]) map[wo.client_id] = { count: 0, active: 0, pipeline: 0, revenue: 0 }
      const m = map[wo.client_id]
      m.count++
      const v = (wo.est_cost || 0) + (wo.add_cost || 0)
      if (['paid','archived'].includes(wo.stage)) m.revenue += v
      else { m.pipeline += v; m.active++ }
    })
    return map
  }, [workOrders])

  const filteredClients = useMemo(() => {
    if (!search.trim()) return clients
    return clients.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
  }, [clients, search])

  const selectedWOs = useMemo(() => {
    if (!selected) return []
    return workOrders
      .filter(wo => wo.client_id === selected.id)
      .sort((a, b) => {
        // Active first, then by stage order, then by due date
        const aArchived = ['paid','archived'].includes(a.stage)
        const bArchived = ['paid','archived'].includes(b.stage)
        if (aArchived !== bArchived) return aArchived ? 1 : -1
        return 0
      })
  }, [selected, workOrders])

  const woByStage = useMemo(() => {
    const map: Record<string, WO[]> = {}
    selectedWOs.forEach(wo => {
      if (!map[wo.stage]) map[wo.stage] = []
      map[wo.stage].push(wo)
    })
    return map
  }, [selectedWOs])

  const selectedStats = selected ? stats[selected.id] || { count: 0, active: 0, pipeline: 0, revenue: 0 } : null

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
        <p className="text-sm text-gray-500 mt-1">Click any client to view their work orders</p>
      </div>

      <div className="mb-4">
        <input type="text" placeholder="🔍 Search clients..."
          value={search} onChange={e => setSearch(e.target.value)}
          className="w-full max-w-md px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left text-xs text-gray-500 uppercase tracking-wider">
              <th className="px-4 md:px-6 py-3">Name</th>
              <th className="px-4 md:px-6 py-3 hidden sm:table-cell">Status</th>
              <th className="px-4 md:px-6 py-3 hidden md:table-cell">Account Lead</th>
              <th className="px-4 md:px-6 py-3 text-right">WOs</th>
              <th className="px-4 md:px-6 py-3 text-right hidden sm:table-cell">Active</th>
              <th className="px-4 md:px-6 py-3 text-right">Pipeline</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filteredClients.map(c => {
              const s = stats[c.id] || { count: 0, active: 0, pipeline: 0, revenue: 0 }
              return (
                <tr key={c.id} onClick={() => setSelected(c)}
                    className="hover:bg-blue-50 cursor-pointer transition-colors">
                  <td className="px-4 md:px-6 py-3 font-medium text-gray-900">{c.name}</td>
                  <td className="px-4 md:px-6 py-3 hidden sm:table-cell">
                    <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700">{c.status || 'active'}</span>
                  </td>
                  <td className="px-4 md:px-6 py-3 text-gray-600 hidden md:table-cell">{c.account_lead || '—'}</td>
                  <td className="px-4 md:px-6 py-3 text-right font-mono text-gray-700">{s.count}</td>
                  <td className="px-4 md:px-6 py-3 text-right font-mono text-gray-700 hidden sm:table-cell">{s.active}</td>
                  <td className="px-4 md:px-6 py-3 text-right font-mono font-semibold text-gray-900">
                    ${s.pipeline.toLocaleString()}
                  </td>
                </tr>
              )
            })}
            {filteredClients.length === 0 && (
              <tr><td colSpan={6} className="text-center text-gray-400 py-12 text-sm">No clients match your search</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Side panel */}
      {selected && selectedStats && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setSelected(null)} />
          <div className="fixed top-0 right-0 bottom-0 left-0 md:left-auto md:w-full md:max-w-lg bg-white shadow-2xl z-50 overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-4 md:px-6 py-4 flex items-center justify-between z-10">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{selected.name}</h2>
                <p className="text-xs text-gray-500">{selectedStats.count} work orders · {selectedStats.active} active</p>
              </div>
              <button onClick={() => setSelected(null)}
                className="text-gray-400 hover:text-gray-700 text-2xl leading-none w-10 h-10 flex items-center justify-center rounded hover:bg-gray-100">×</button>
            </div>

            <div className="px-4 md:px-6 py-5 space-y-5">
              {/* Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-lg p-3 border-l-4 border-l-blue-500">
                  <div className="text-xs text-gray-500 uppercase tracking-wide">Pipeline</div>
                  <div className="text-xl font-bold mt-0.5 font-mono">${selectedStats.pipeline.toLocaleString()}</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 border-l-4 border-l-green-500">
                  <div className="text-xs text-gray-500 uppercase tracking-wide">Revenue</div>
                  <div className="text-xl font-bold mt-0.5 font-mono text-green-600">${selectedStats.revenue.toLocaleString()}</div>
                </div>
              </div>

              {selected.account_lead && (
                <div className="text-sm">
                  <span className="text-xs font-semibold text-gray-500 uppercase">Account Lead: </span>
                  <span className="text-gray-900 font-medium">{selected.account_lead}</span>
                </div>
              )}

              {/* WO list by stage */}
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">Work Orders</h3>
                {selectedWOs.length === 0 ? (
                  <div className="text-sm text-gray-400 italic py-4 text-center">No work orders yet</div>
                ) : (
                  <div className="space-y-4">
                    {STAGES.map(stage => {
                      const wos = woByStage[stage.id] || []
                      if (wos.length === 0) return null
                      const total = wos.reduce((s, w) => s + (w.est_cost || 0) + (w.add_cost || 0), 0)
                      return (
                        <div key={stage.id}>
                          <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-gray-100">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full" style={{ background: stage.color }} />
                              <span className="text-xs font-semibold text-gray-700">{stage.label}</span>
                              <span className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded font-mono">{wos.length}</span>
                            </div>
                            {total > 0 && <span className="text-xs text-gray-500 font-mono">${total.toLocaleString()}</span>}
                          </div>
                          <div className="space-y-1.5">
                            {wos.map(wo => (
                              <a key={wo.id} href={`/dashboard?wo=${wo.id}`}
                                className="block bg-gray-50 hover:bg-gray-100 rounded-lg p-2.5 transition-colors">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium text-gray-900 truncate">{wo.title}</div>
                                    <div className="text-xs text-gray-500 mt-0.5 flex flex-wrap gap-x-3">
                                      {wo.services?.name && <span>⚙️ {wo.services.name}</span>}
                                      {wo.team_members?.name && <span>👤 {wo.team_members.name}</span>}
                                      {wo.due_date && <span>📅 {new Date(wo.due_date).toLocaleDateString()}</span>}
                                    </div>
                                  </div>
                                  {((wo.est_cost || 0) + (wo.add_cost || 0) > 0) && (
                                    <div className="text-xs font-mono font-semibold text-gray-700 whitespace-nowrap">
                                      ${((wo.est_cost || 0) + (wo.add_cost || 0)).toLocaleString()}
                                    </div>
                                  )}
                                </div>
                              </a>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
EOF

cat > app/dashboard/clients/page.tsx << 'EOF'
import { createClient } from '@/lib/supabase/server'
import ClientsClient from '@/components/clients/ClientsClient'

export default async function ClientsPage() {
  const supabase = createClient()
  const { data: clients } = await supabase.from('clients').select('*').order('name')
  const { data: workOrders } = await supabase
    .from('work_orders')
    .select(`id, title, stage, client_id, est_cost, add_cost, due_date, priority,
             services!work_orders_service_id_fkey(name),
             team_members!work_orders_owner_id_fkey(name)`)
    .limit(2000)

  return <ClientsClient clients={clients || []} workOrders={workOrders || []} />
}
EOF

echo ""
echo "✅ Clients page updated!"
echo ""
echo "Next: build + push"
echo "  cd ~/ab-tracker && npm run build && git add -A && git commit -m 'Feature: clickable Clients with WO detail panel' && git push"
echo ""
