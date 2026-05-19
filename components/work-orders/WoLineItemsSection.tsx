'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { WoLineItem } from '@/lib/types'

type Draft = {
  description: string
  qty: number
  unit_price: number
}

export default function WoLineItemsSection({
  workOrderId,
  onTotalChange,
}: {
  workOrderId: string
  /** Called whenever the sum of line item totals changes. Lets the parent
   *  show an up-to-date grand total without re-fetching. */
  onTotalChange?: (sum: number) => void
}) {
  const supabase = createClient()
  const [items, setItems] = useState<WoLineItem[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState<Draft>({ description: '', qty: 1, unit_price: 0 })

  // Load on mount + whenever WO changes
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    supabase
      .from('wo_line_items')
      .select('*')
      .eq('work_order_id', workOrderId)
      .order('sort_order', { ascending: true })
      .then(({ data }) => {
        if (cancelled) return
        setItems((data || []) as WoLineItem[])
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [workOrderId, supabase])

  // Bubble total up whenever items change
  const subtotal = useMemo(
    () => items.reduce((sum, i) => sum + (Number(i.total) || 0), 0),
    [items]
  )
  useEffect(() => {
    onTotalChange?.(subtotal)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtotal])

  async function addLineItem() {
    const desc = draft.description.trim()
    if (!desc) return
    setAdding(true)
    const nextSort = items.length > 0 ? Math.max(...items.map(i => i.sort_order)) + 1 : 0
    const { data, error } = await supabase
      .from('wo_line_items')
      .insert({
        work_order_id: workOrderId,
        description: desc,
        qty: draft.qty || 1,
        unit_price: draft.unit_price || 0,
        sort_order: nextSort,
      })
      .select()
      .single()
    setAdding(false)
    if (error) {
      alert('Failed to add line item: ' + error.message)
      return
    }
    setItems(prev => [...prev, data as WoLineItem])
    setDraft({ description: '', qty: 1, unit_price: 0 })
  }

  async function patchLineItem(id: string, patch: Partial<Pick<WoLineItem, 'description' | 'qty' | 'unit_price'>>) {
    // Optimistic update. The `total` column is generated server-side from
    // qty * unit_price, so we mirror that math locally for instant feedback.
    setItems(prev =>
      prev.map(i => {
        if (i.id !== id) return i
        const nextQty = patch.qty != null ? patch.qty : i.qty
        const nextUnit = patch.unit_price != null ? patch.unit_price : i.unit_price
        return {
          ...i,
          ...patch,
          total: (nextQty || 0) * (nextUnit || 0),
        }
      })
    )
    const { error } = await supabase.from('wo_line_items').update(patch).eq('id', id)
    if (error) {
      alert('Failed to update line item: ' + error.message)
      // Reload to recover
      const { data } = await supabase
        .from('wo_line_items')
        .select('*')
        .eq('work_order_id', workOrderId)
        .order('sort_order', { ascending: true })
      setItems((data || []) as WoLineItem[])
    }
  }

  async function deleteLineItem(id: string) {
    if (!confirm('Delete this line item?')) return
    setItems(prev => prev.filter(i => i.id !== id))
    const { error } = await supabase.from('wo_line_items').delete().eq('id', id)
    if (error) alert('Failed to delete line item: ' + error.message)
  }

  if (loading) {
    return (
      <div className="text-xs text-gray-400 italic">Loading line items…</div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
          Line Items {items.length > 0 && (
            <span className="ml-1 normal-case text-gray-400 font-normal">({items.length})</span>
          )}
        </div>
        {subtotal > 0 && (
          <div className="text-xs font-mono tabular-nums text-gray-600">
            Subtotal <span className="font-semibold text-gray-900">${subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        )}
      </div>

      {items.length === 0 && (
        <div className="text-xs text-gray-400 italic px-1 py-1">
          No line items yet. Add mailers, miscellaneous orders, or other per-WO costs below.
        </div>
      )}

      {items.length > 0 && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          {/* Header row */}
          <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-gray-50 border-b border-gray-200 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
            <div className="col-span-6">Description</div>
            <div className="col-span-1 text-right">Qty</div>
            <div className="col-span-2 text-right">Unit $</div>
            <div className="col-span-2 text-right">Total</div>
            <div className="col-span-1"></div>
          </div>
          {/* Data rows */}
          <div className="divide-y divide-gray-100">
            {items.map(item => (
              <LineItemRow
                key={item.id}
                item={item}
                onPatch={patch => patchLineItem(item.id, patch)}
                onDelete={() => deleteLineItem(item.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Add new line item */}
      <div className="grid grid-cols-12 gap-2 items-center pt-1">
        <input
          type="text"
          value={draft.description}
          onChange={e => setDraft({ ...draft, description: e.target.value })}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addLineItem() } }}
          placeholder="+ Add line item — description"
          className="col-span-6 text-sm px-2 py-1.5 border border-dashed border-gray-300 rounded focus:border-blue-500 focus:border-solid focus:outline-none"
        />
        <input
          type="number"
          value={draft.qty || ''}
          onChange={e => setDraft({ ...draft, qty: parseFloat(e.target.value) || 0 })}
          placeholder="1"
          className="col-span-1 text-sm px-2 py-1.5 border border-gray-200 rounded font-mono text-right focus:border-blue-500 focus:outline-none"
          step="any"
          min="0"
        />
        <div className="col-span-2 relative">
          <span className="absolute left-2 top-1.5 text-xs text-gray-400">$</span>
          <input
            type="number"
            value={draft.unit_price || ''}
            onChange={e => setDraft({ ...draft, unit_price: parseFloat(e.target.value) || 0 })}
            placeholder="0.00"
            className="w-full text-sm pl-5 pr-2 py-1.5 border border-gray-200 rounded font-mono text-right focus:border-blue-500 focus:outline-none"
            step="any"
            min="0"
          />
        </div>
        <div className="col-span-2 text-right text-sm font-mono tabular-nums text-gray-500">
          ${((draft.qty || 0) * (draft.unit_price || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        <div className="col-span-1 text-right">
          {draft.description.trim() && (
            <button
              onClick={addLineItem}
              disabled={adding}
              className="px-2 py-1 rounded text-[11px] font-semibold text-white disabled:opacity-40"
              style={{ background: '#1a2b4a' }}
              title="Add line item"
            >
              {adding ? '…' : 'Add'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function LineItemRow({
  item,
  onPatch,
  onDelete,
}: {
  item: WoLineItem
  onPatch: (patch: Partial<Pick<WoLineItem, 'description' | 'qty' | 'unit_price'>>) => void
  onDelete: () => void
}) {
  return (
    <div className="grid grid-cols-12 gap-2 px-3 py-2 items-center hover:bg-gray-50/60 transition-colors">
      <input
        type="text"
        defaultValue={item.description}
        onBlur={e => {
          const v = e.target.value.trim()
          if (v && v !== item.description) onPatch({ description: v })
          else if (!v) e.target.value = item.description
        }}
        className="col-span-6 text-sm bg-transparent border-0 px-1 py-0.5 focus:outline-none focus:bg-white focus:border focus:border-blue-500 focus:rounded"
      />
      <input
        type="number"
        defaultValue={item.qty}
        onBlur={e => {
          const v = parseFloat(e.target.value)
          if (!isNaN(v) && v !== item.qty) onPatch({ qty: v })
        }}
        className="col-span-1 text-sm bg-transparent border-0 px-1 py-0.5 font-mono tabular-nums text-right focus:outline-none focus:bg-white focus:border focus:border-blue-500 focus:rounded"
        step="any"
        min="0"
      />
      <div className="col-span-2 relative">
        <span className="absolute left-1 top-0.5 text-xs text-gray-400">$</span>
        <input
          type="number"
          defaultValue={item.unit_price}
          onBlur={e => {
            const v = parseFloat(e.target.value)
            if (!isNaN(v) && v !== item.unit_price) onPatch({ unit_price: v })
          }}
          className="w-full text-sm bg-transparent border-0 pl-4 pr-1 py-0.5 font-mono tabular-nums text-right focus:outline-none focus:bg-white focus:border focus:border-blue-500 focus:rounded"
          step="any"
          min="0"
        />
      </div>
      <div className="col-span-2 text-right text-sm font-mono tabular-nums font-semibold text-gray-900">
        ${(Number(item.total) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </div>
      <div className="col-span-1 text-right">
        <button
          onClick={onDelete}
          className="text-gray-300 hover:text-red-500 text-sm leading-none px-1"
          title="Delete line item"
        >
          ×
        </button>
      </div>
    </div>
  )
}
