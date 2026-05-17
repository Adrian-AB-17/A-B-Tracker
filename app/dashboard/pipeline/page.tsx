import { createClient } from '@/lib/supabase/server'
import { STAGES } from '@/lib/types'

export default async function PipelinePage() {
  const supabase = createClient()
  const { data: wos } = await supabase.from('work_orders').select('stage, est_cost, add_cost')

  const byStage: Record<string, { count: number; value: number }> = {}
  STAGES.forEach(s => byStage[s.id] = { count: 0, value: 0 })
  ;(wos || []).forEach(wo => {
    if (!byStage[wo.stage]) return
    byStage[wo.stage].count++
    byStage[wo.stage].value += (wo.est_cost || 0) + (wo.add_cost || 0)
  })

  const totalCount = (wos || []).length
  const totalValue = Object.values(byStage).reduce((sum, s) => sum + s.value, 0)

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Pipeline Health</h1>
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <div className="text-sm text-gray-500">Total Work Orders</div>
          <div className="text-3xl font-bold mt-1">{totalCount}</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <div className="text-sm text-gray-500">Total Pipeline Value</div>
          <div className="text-3xl font-bold mt-1">${totalValue.toLocaleString()}</div>
        </div>
      </div>
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-900 mb-4">By Stage</h2>
        <div className="space-y-3">
          {STAGES.map(s => {
            const data = byStage[s.id]
            const pct = totalCount ? (data.count / totalCount) * 100 : 0
            return (
              <div key={s.id}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                    <span className="font-medium">{s.label}</span>
                  </div>
                  <span className="text-gray-500">{data.count} · ${data.value.toLocaleString()}</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: s.color }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
