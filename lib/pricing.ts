import type { ClientRate } from '@/lib/types'

/**
 * Minimal service shape needed by priceFor. Real services from the DB
 * have more fields; pricing only cares about id + base_price + client scope.
 */
export interface PricedService {
  id: string
  base_price: number
  /** Client this service is scoped to. '*' means available to all clients. */
  client?: string | null
  [key: string]: any
}

/**
 * Resolve the effective price for a (client, service) pair.
 *
 * Logic (mirrors prototype):
 *  - If the service exists but isn't applicable to this client → null
 *    (a service scoped to 'rbs' returns null for any other client)
 *  - If a client-specific override exists → return that price + override flag
 *  - Otherwise → return the service's base_price
 *
 * Returns null when the service doesn't apply to the client or doesn't exist.
 *
 * @param clientId  The client we're pricing for
 * @param serviceId The service whose price we want
 * @param services  All services (the caller already has these loaded)
 * @param rates     All client_rates rows (the caller already has these loaded)
 */
export function priceFor(
  clientId: string | null | undefined,
  serviceId: string | null | undefined,
  services: PricedService[],
  rates: ClientRate[]
): {
  price: number
  isOverride: boolean
  basePrice: number
  overrideNote: string | null
} | null {
  if (!clientId || !serviceId) return null
  const svc = services.find(s => s.id === serviceId)
  if (!svc) return null

  // Service must apply to this client (or be unrestricted with '*')
  if (svc.client && svc.client !== '*' && svc.client !== clientId) return null

  const basePrice = svc.base_price || 0
  const override = clientRateFor(clientId, serviceId, rates)

  if (override) {
    return {
      price: override.price,
      isOverride: true,
      basePrice,
      overrideNote: override.notes || null,
    }
  }

  return {
    price: basePrice,
    isOverride: false,
    basePrice,
    overrideNote: null,
  }
}

/**
 * Find the ClientRate row (if any) for a (client, service) pair.
 * Returns the full row so callers can also see the note and effective_from.
 */
export function clientRateFor(
  clientId: string,
  serviceId: string,
  rates: ClientRate[]
): ClientRate | null {
  return rates.find(r => r.client_id === clientId && r.service_id === serviceId) || null
}

/**
 * Group all rates by service_id. Useful for the Services admin modal
 * which shows "this service has overrides for clients X, Y, Z".
 */
export function ratesByService(rates: ClientRate[]): Record<string, ClientRate[]> {
  const out: Record<string, ClientRate[]> = {}
  rates.forEach(r => {
    if (!out[r.service_id]) out[r.service_id] = []
    out[r.service_id].push(r)
  })
  return out
}

/**
 * Group all rates by client_id. Useful for the Clients drilldown
 * which shows the rate card for a single client.
 */
export function ratesByClient(rates: ClientRate[]): Record<string, ClientRate[]> {
  const out: Record<string, ClientRate[]> = {}
  rates.forEach(r => {
    if (!out[r.client_id]) out[r.client_id] = []
    out[r.client_id].push(r)
  })
  return out
}

/**
 * Format the diff between an override price and the service's base price.
 * Used in the Services modal to show "+$250 (+29%)" or "-$150 (-18%)".
 *
 * Returns { delta, deltaPct, direction } where direction is 'up' | 'down' | 'same'.
 * Callers handle the styling.
 */
export function priceDiff(overridePrice: number, basePrice: number): {
  delta: number
  deltaPct: number
  direction: 'up' | 'down' | 'same'
} {
  const delta = overridePrice - basePrice
  if (delta === 0 || basePrice === 0) {
    return { delta: 0, deltaPct: 0, direction: 'same' }
  }
  const deltaPct = (delta / basePrice) * 100
  return {
    delta,
    deltaPct,
    direction: delta > 0 ? 'up' : 'down',
  }
}
