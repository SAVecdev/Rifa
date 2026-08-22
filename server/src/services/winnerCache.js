import { ensureSupabaseConfigured } from '../config/supabase.js'

const cacheTtl = 4 * 60 * 60 * 1000
let winnersCache = null
let expiresAt = 0
let loading = null

export const getWinnerCache = async () => {
  if (winnersCache && expiresAt > Date.now()) return winnersCache
  if (loading) return loading

  loading = (async () => {
    const startedAt = Date.now()
    const supabase = ensureSupabaseConfigured()
    const { data, error } = await supabase
      .from('ganadores')
      .select('id, id_usuario, id_factura, id_numero_ganador, numerol, fecha, saldo_premio, nivel_premio, id_area, pagada, fecha_hora_pago, created_at, factura(numero_factura)')
      .order('fecha', { ascending: false })

    if (error) throw new Error(error.message)
    winnersCache = data || []
    expiresAt = Date.now() + cacheTtl
    console.log(`[WINNERS-CACHE] Supabase ${Date.now() - startedAt}ms - ${winnersCache.length} ganadores, TTL 4h`)
    return winnersCache
  })().finally(() => { loading = null })

  return loading
}

export const refreshWinnerCache = async () => {
  winnersCache = null
  expiresAt = 0
  return getWinnerCache()
}
