'use client'
import { useState, useMemo } from 'react'
import { STAGES, type WorkOrder, type WoStage } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'bg-red-100 text-red-700',
  high:   'bg-orange-100 text-orange-700',
  medium: 'bg-blue-100 text-blue-700',
  low:    'bg-slate-100 text-slate-600',
}

const BOARD_STAGES: WoStage[] = [
  'submitted','not-started','in-progress','deliverables-completed',
  'sent-for-approval','revisions-received','approved',
  'deliverables-executed','invoiced','paid','on-hold'
]

export default function BoardClient({ initialWorkOrders, clients, services, team }: {
  initialWorkOrders: WorkOrder[]; clients: any[]; services: any[]; team: any[]
}) {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>(initialWorkOrders)
  const [search, setSearch] = useState('')
  const [filterClient, setFilterClient] = useState('')
  const [filterService, setFilterService] = useState('')
  const supabase = createClient()

  const filtered = useMemo(() => {
    return workOrders.filter(wo => {
      if (search && !wo.title.toLowerCase().includes(search.toLowerCase())) return false
      if (filterClient && wo.client_id !== filterClient) return false
      if (filterService && wo.service_id !== filterService) return false
      return true
    })
  }, [workOrders, search, filterClient, filterService])

  async function moveStage(woId: string, newStage: WoStage) {
    setWorkOrders(prev => prev.map(w => w.id === woId ? { ...w, stage: newStage } : w))
    await supabase.from('work_orders').update({ stage: newStage }).eq('id', woId)
  }

  const grouped = useMemo(() => {
    const out: Record<string, WorkOrder[]> = {}
    BOARD_STAGES.forEach(s => out[s] = [])
    filtered.forEach(wo => { if (out[wo.stage]) out[wo.stage].push(wo) })
    return out
  }, [filtered])

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-4 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-900">Work Order Board</h1>
          <div className="text-sm text-gray-500">{filtered.length} of {workOrders.length}</div>
        </div>
        <div className="flex gap-3">
          <input type="text" placeholder="Search work orders..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          <select value={filterClient} onChange={e => setFilterClient(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
            <option value="">All clients</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={filterService} onChange={e => setFilterService(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
            <option value="">All services</option>
            {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto px-6 py-4">
        <div className="flex gap-4 min-w-max">
          {BOARD_STAGES.map(stageId => {
            const stage = STAGES.find(s => s.id === stageId)!
            const cards = grouped[stageId] || []
            return (
              <div key={stageId} className="w-72 flex-shrink-0">
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: stage.color }} />
                    <span className="text-sm font-semibold text-gray-700">{stage.label}</span>
                  </div>
                  <span className="text-xs text-gray-400 font-mono">{cards.length}</span>
                </div>
                <div className="space-y-2">
                  {cards.map(wo => (
                    <div key={wo.id} className="bg-white rounded-lg border border-gray-200 p-3 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="text-sm font-medium text-gray-900 line-clamp-2">{wo.title}</div>
                        {wo.priority && (
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${PRIORITY_COLORS[wo.priority]}`}>
                            {wo.priority.slice(0,1).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 space-y-1">
                        {wo.clients?.name && <div>🏢 {wo.clients.name}</div>}
                        {wo.services?.name && <div>⚙️ {wo.services.name}</div>}
                        {wo.team_members?.name && <div>👤 {wo.team_members.name}</div>}
                        {wo.due_date && <div>📅 {new Date(wo.due_date).toLocaleDateString()}</div>}
                      </div>
                      <select value={wo.stage}
                        onChange={e => moveStage(wo.id, e.target.value as WoStage)}
                        className="mt-2 w-full text-xs px-2 py-1 border border-gray-200 rounded">
                        {STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
