import express from 'express'
import { ensureSupabaseConfigured } from '../config/supabase.js'
import { getCachedUnavailableNumbers, getUnavailableNumbers, initializeRaffleQuotaCache } from '../services/localSaleService.js'
import { getWinnerCache, refreshWinnerCache } from '../services/winnerCache.js'
import { adjuntarEstadoPremios, marcarVentasComoPagadas } from '../services/invoicePrizeStatus.js'

const router = express.Router()
const vendorStatsCache = new Map()
const vendorHistoryCache = new Map()
const vendorStatsLoading = new Map()
const vendorHistoryLoading = new Map()
const vendorCacheTtl = 60 * 1000
let posRafflesCache = null
let posRafflesExpiresAt = 0
let posRafflesLoading = null

router.get('/:userId/prize-payments', async (req, res) => {
  try {
    const userId = Number(req.params.userId)
    const invoiceNumber = String(req.query.invoice || '').trim().toUpperCase()
    if (!Number.isInteger(userId) || userId < 1 || !invoiceNumber) return res.status(400).json({ message: 'userId e invoice son obligatorios' })

    const winners = await getWinnerCache()
    const filtered = winners.filter((winner) => winner.id_usuario === userId && winner.factura?.numero_factura === invoiceNumber)
    return res.json({ data: filtered, cachedFor: '4h' })
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
})

router.post('/:userId/prize-payments/:winnerId/pay', async (req, res) => {
  try {
    const userId = Number(req.params.userId)
    const winnerId = Number(req.params.winnerId)
    if (!Number.isInteger(userId) || !Number.isInteger(winnerId) || userId < 1 || winnerId < 1) return res.status(400).json({ message: 'IDs invalidos' })
    const supabase = ensureSupabaseConfigured()
    const { data, error } = await supabase
      .from('ganadores')
      .update({ pagada: true, fecha_hora_pago: new Date().toISOString() })
      .eq('id', winnerId)
      .eq('id_usuario', userId)
      .eq('pagada', false)
      .select('id, id_factura, numerol, pagada, fecha_hora_pago, saldo_premio')
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!data) return res.status(409).json({ message: 'El premio ya fue pagado o no pertenece al vendedor' })
    await marcarVentasComoPagadas(supabase, userId, [data])
    void refreshWinnerCache().catch(() => {})
    return res.json(data)
  } catch (error) {
    return res.status(400).json({ message: error.message })
  }
})

router.post('/:userId/prize-payments/pay-all', async (req, res) => {
  try {
    const userId = Number(req.params.userId)
    const invoiceNumber = String(req.body.invoice || '').trim().toUpperCase()
    if (!Number.isInteger(userId) || userId < 1 || !invoiceNumber) return res.status(400).json({ message: 'userId e invoice son obligatorios' })

    const supabase = ensureSupabaseConfigured()
    const { data: invoiceRow, error: invoiceError } = await supabase
      .from('factura')
      .select('id')
      .eq('id_usuario', userId)
      .eq('numero_factura', invoiceNumber)
      .maybeSingle()
    if (invoiceError) throw new Error(invoiceError.message)
    if (!invoiceRow) return res.status(404).json({ message: 'Factura no encontrada' })

    const { data, error } = await supabase
      .from('ganadores')
      .update({ pagada: true, fecha_hora_pago: new Date().toISOString() })
      .eq('id_usuario', userId)
      .eq('id_factura', invoiceRow.id)
      .eq('pagada', false)
      .select('id, id_factura, numerol, pagada, fecha_hora_pago, saldo_premio')
    if (error) throw new Error(error.message)
    await marcarVentasComoPagadas(supabase, userId, data)
    void refreshWinnerCache().catch(() => {})
    return res.json({ data: data || [] })
  } catch (error) {
    return res.status(400).json({ message: error.message })
  }
})

router.post('/:userId/prize-payments/pay-many', async (req, res) => {
  try {
    const userId = Number(req.params.userId)
    const ids = Array.isArray(req.body.ids) ? req.body.ids.map(Number).filter((id) => Number.isInteger(id) && id > 0) : []
    if (!Number.isInteger(userId) || userId < 1 || ids.length === 0) return res.status(400).json({ message: 'userId e ids son obligatorios' })

    const supabase = ensureSupabaseConfigured()
    const { data, error } = await supabase
      .from('ganadores')
      .update({ pagada: true, fecha_hora_pago: new Date().toISOString() })
      .eq('id_usuario', userId)
      .in('id', ids)
      .eq('pagada', false)
      .select('id, id_factura, numerol, pagada, fecha_hora_pago, saldo_premio')
    if (error) throw new Error(error.message)
    await marcarVentasComoPagadas(supabase, userId, data)
    void refreshWinnerCache().catch(() => {})
    return res.json({ data: data || [] })
  } catch (error) {
    return res.status(400).json({ message: error.message })
  }
})

router.get('/:userId/invoice-history', async (req, res) => {
  try {
    const userId = Number(req.params.userId)
    if (!Number.isInteger(userId) || userId < 1) return res.status(400).json({ message: 'userId debe ser un ID valido' })
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1)
    const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 10))
    const search = String(req.query.search || '').trim().toUpperCase()
    const cacheKey = `${userId}:${page}:${limit}:${search}`
    const cached = vendorHistoryCache.get(cacheKey)
    if (cached && cached.expiresAt > Date.now()) return res.json(cached.data)
    if (vendorHistoryLoading.has(cacheKey)) return res.json(await vendorHistoryLoading.get(cacheKey))

    const supabase = ensureSupabaseConfigured()
    const query = (async () => {
      const startedAt = Date.now()
      const { data, error } = await supabase
        .from('factura')
        .select('id, numero_factura, created_at, eliminada')
        .eq('id_usuario', userId)
        .ilike('numero_factura', search ? `%${search}%` : '%')
        .order('created_at', { ascending: false })
        .range((page - 1) * limit, page * limit + 1)
      if (error) throw new Error(error.message)
      const rows = data || []
      const hasNext = rows.length > limit
      const result = { data: rows.slice(0, limit), pagination: { page, limit, total: null, totalPages: hasNext ? page + 1 : page, hasNext } }
      console.log(`[VENDOR-HISTORY] Supabase ${Date.now() - startedAt}ms - ${result.data.length} facturas`)
      vendorHistoryCache.set(cacheKey, { data: result, expiresAt: Date.now() + vendorCacheTtl })
      return result
    })()
    vendorHistoryLoading.set(cacheKey, query)
    try { return res.json(await query) } finally { vendorHistoryLoading.delete(cacheKey) }
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
})

router.get('/:userId/invoice-history/:invoiceId', async (req, res) => {
  try {
    const userId = Number(req.params.userId)
    const invoiceId = Number(req.params.invoiceId)
    if (!Number.isInteger(userId) || !Number.isInteger(invoiceId) || userId < 1 || invoiceId < 1) return res.status(400).json({ message: 'IDs invalidos' })

    const supabase = ensureSupabaseConfigured()
    const [invoiceResult, salesResult, winnersResult] = await Promise.all([
      supabase.from('factura').select('id, numero_factura, id_usuario, created_at, eliminada, usuario(nombre)').eq('id', invoiceId).eq('id_usuario', userId).maybeSingle(),
      supabase.from('venta').select('id, id_factura, id_rifa, numero, cantidad, valor, total, premio_01, premio_02, premio_03, premio_04, premio_05, premio_06, premio_07, premio_08, premio_09, premio_10, pagada, eliminada, fecha, rifa(nombre, fecha_hora_juego, tipo_rifa(nombre))').eq('id_factura', invoiceId).order('id', { ascending: true }),
      supabase.from('ganadores').select('id, id_factura, numerol, saldo_premio, pagada, nivel_premio').eq('id_factura', invoiceId),
    ])

    if (invoiceResult.error) throw new Error(invoiceResult.error.message)
    if (salesResult.error) throw new Error(salesResult.error.message)
    if (winnersResult.error) throw new Error(winnersResult.error.message)
    if (!invoiceResult.data) return res.status(404).json({ message: 'Factura no encontrada' })
    const sales = adjuntarEstadoPremios(salesResult.data || [], winnersResult.data || [])
    return res.json({ ...invoiceResult.data, ventas: sales, total: sales.reduce((sum, sale) => sum + Number(sale.total || 0), 0) })
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
})

router.get('/:userId/dashboard-stats', async (req, res) => {
  try {
    const userId = Number(req.params.userId)
    if (!Number.isInteger(userId) || userId < 1) return res.status(400).json({ message: 'userId debe ser un ID valido' })

    const today = new Date()
    const to = today.toISOString().slice(0, 10)
    const fromDate = new Date(today)
    fromDate.setDate(fromDate.getDate() - 7)
    const from = fromDate.toISOString().slice(0, 10)
    const cacheKey = `${userId}:${from}:${to}`
    const cached = vendorStatsCache.get(cacheKey)
    if (cached && cached.expiresAt > Date.now()) return res.json(cached.data)
    if (vendorStatsLoading.has(cacheKey)) return res.json(await vendorStatsLoading.get(cacheKey))
    const supabase = ensureSupabaseConfigured()
    const query = (async () => {
      const startedAt = Date.now()
      const { data, error } = await supabase
        .from('estadisticas_diarias')
        .select('fecha, ventas_monto, ventas_cantidad, premios_totales, premios_pagados, premios_pendientes, recargas, retiros, ventas_hoy, pagos_hoy')
        .eq('id_usuario', userId)
        .gte('fecha', from)
        .lte('fecha', to)
        .order('fecha', { ascending: false })
      if (error) throw new Error(error.message)
      const result = { daily: data || [] }
      console.log(`[VENDOR-STATS] Supabase ${Date.now() - startedAt}ms - ${result.daily.length} dias`)
      vendorStatsCache.set(cacheKey, { data: result, expiresAt: Date.now() + vendorCacheTtl })
      return result
    })()
    vendorStatsLoading.set(cacheKey, query)
    try { return res.json(await query) } finally { vendorStatsLoading.delete(cacheKey) }
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
})

router.get('/:userId/recent-sales', async (req, res) => {
  try {
    const userId = Number(req.params.userId)
    if (!Number.isInteger(userId) || userId < 1) return res.status(400).json({ message: 'userId debe ser un ID valido' })

    const supabase = ensureSupabaseConfigured()
    const { data, error } = await supabase
      .from('venta')
      .select('id, id_rifa, numero, total, fecha, rifa(nombre)')
      .eq('id_usuario', userId)
      .eq('pagada', true)
      .eq('eliminada', false)
      .order('fecha', { ascending: false })
      .range(0, 4)

    if (error) throw new Error(error.message)
    return res.json({ recentSales: data || [] })
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
})

router.get('/:userId/pos-overview', async (req, res) => {
  try {
    const userId = Number(req.params.userId)
    if (!Number.isInteger(userId) || userId < 1) return res.status(400).json({ message: 'userId debe ser un ID valido' })

    if (posRafflesCache && posRafflesExpiresAt > Date.now()) return res.json({ raffles: posRafflesCache })
    if (!posRafflesLoading) {
      posRafflesLoading = (async () => {
        const startedAt = Date.now()
        const supabase = ensureSupabaseConfigured()
        const { data, error } = await supabase
          .from('rifa')
          .select('id, nombre, sorteos, id_tipo, fecha_hora_juego, fecha_hora_finalizacion')
          .is('fecha_hora_finalizacion', null)
          .order('fecha_hora_juego', { ascending: true })
        if (error) throw new Error(error.message)
        posRafflesCache = data || []
        posRafflesExpiresAt = Date.now() + vendorCacheTtl
        console.log(`[POS-OVERVIEW] Supabase ${Date.now() - startedAt}ms - ${posRafflesCache.length} rifas`)
        return posRafflesCache
      })().finally(() => { posRafflesLoading = null })
    }
    return res.json({ raffles: await posRafflesLoading })
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
})

router.get('/:userId/overview', async (req, res) => {
  try {
    const userId = Number(req.params.userId)
    if (!Number.isInteger(userId) || userId < 1) {
      return res.status(400).json({ message: 'userId debe ser un ID valido' })
    }

    const supabase = ensureSupabaseConfigured()
    const [userResult, rafflesResult, salesResult, winnersResult] = await Promise.all([
      supabase.from('usuario').select('id, nombre, rol, activo, id_area').eq('id', userId).maybeSingle(),
      supabase.from('rifa').select('*').order('created_at', { ascending: false }),
      supabase
        .from('venta')
        .select('id, id_rifa, numero, cantidad, total, fecha, pagada, eliminada')
        .eq('id_usuario', userId)
        .eq('eliminada', false)
        .order('fecha', { ascending: false }),
      supabase.from('ganadores').select('id').eq('id_usuario', userId),
    ])

    for (const result of [userResult, rafflesResult, salesResult, winnersResult]) {
      if (result.error) throw new Error(result.error.message)
    }

    if (!userResult.data) return res.status(404).json({ message: 'Usuario no encontrado' })

    const sales = salesResult.data || []
    const raffles = rafflesResult.data || []
    const raffleById = new Map(raffles.map((raffle) => [raffle.id, raffle]))
    const salesByRaffle = new Map()

    for (const sale of sales) {
      salesByRaffle.set(sale.id_rifa, (salesByRaffle.get(sale.id_rifa) || 0) + 1)
    }

    const availableRaffles = raffles
      .filter((raffle) => !raffle.fecha_hora_finalizacion)
      .map((raffle) => ({ ...raffle, ventas_registradas: salesByRaffle.get(raffle.id) || 0 }))

    const recentSales = sales.slice(0, 8).map((sale) => ({
      ...sale,
      rifa: raffleById.get(sale.id_rifa) || null,
      usuario: { nombre: userResult.data.nombre },
    }))

    return res.json({
      user: userResult.data,
      stats: {
        total_recaudado: sales.reduce((sum, sale) => sum + Number(sale.total || 0), 0),
        boletos_vendidos: sales.reduce((sum, sale) => sum + Number(sale.cantidad || 0), 0),
        rifas_disponibles: availableRaffles.length,
        premios_ganados: (winnersResult.data || []).length,
      },
      raffles: availableRaffles,
      sales: recentSales,
    })
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
})

router.post('/:userId/raffles/:raffleId/prepare-quota-cache', async (req, res) => {
  try {
    const userId = Number(req.params.userId)
    const raffleId = Number(req.params.raffleId)
    if (!Number.isInteger(userId) || !Number.isInteger(raffleId) || userId < 1 || raffleId < 1) {
      return res.status(400).json({ message: 'userId y raffleId deben ser IDs validos' })
    }

    const cachedUnavailableNumbers = getCachedUnavailableNumbers(raffleId)
    if (cachedUnavailableNumbers) return res.json({ unavailableNumbers: cachedUnavailableNumbers, cached: true })

    const supabase = ensureSupabaseConfigured()
    const [userResult, raffleResult, salesResult] = await Promise.all([
      supabase.from('usuario').select('id_area').eq('id', userId).maybeSingle(),
      supabase.from('rifa').select('id, id_tipo, fecha_hora_juego').eq('id', raffleId).maybeSingle(),
      supabase.from('venta').select('numero, total').eq('id_rifa', raffleId).eq('eliminada', false),
    ])

    for (const result of [userResult, raffleResult, salesResult]) {
      if (result.error) throw new Error(result.error.message)
    }
    if (!userResult.data?.id_area) return res.status(400).json({ message: 'El vendedor no tiene un area asignada' })
    if (!raffleResult.data?.id_tipo) return res.status(400).json({ message: 'La rifa no tiene un tipo asignado' })

    const { data: quotaRows, error: quotaError } = await supabase
      .from('cupos_area_rifa')
      .select('id_area, c_2digitos, c_3digitos, c_4digitos, c_5digitos')
      .eq('id_tipo_rifa', raffleResult.data.id_tipo)
      .or(`id_area.is.null,id_area.eq.${userResult.data.id_area}`)

    if (quotaError) throw new Error(quotaError.message)

    const quota = (quotaRows || []).find((row) => row.id_area === null) || (quotaRows || []).find((row) => row.id_area === userResult.data.id_area) || null

    if (!quota) return res.status(400).json({ message: 'No hay cupos configurados para el tipo de esta rifa' })

    const totalsByNumber = new Map()
    for (const sale of salesResult.data || []) {
      totalsByNumber.set(sale.numero, (totalsByNumber.get(sale.numero) || 0) + Number(sale.total || 0))
    }
    const confirmedSales = [...totalsByNumber].map(([numero, total]) => ({ numero, total }))
    const unavailableNumbers = initializeRaffleQuotaCache({
      raffleId,
      areaId: userResult.data.id_area,
      raffleTypeId: raffleResult.data.id_tipo,
      gameTime: raffleResult.data.fecha_hora_juego,
      quotas: quota,
      confirmedSales,
    })

    return res.json({ unavailableNumbers })
  } catch (error) {
    return res.status(400).json({ message: error.message })
  }
})

router.get('/:userId/raffles/:raffleId/unavailable-numbers', (req, res) => {
  try {
    return res.json(getUnavailableNumbers(req.params.raffleId))
  } catch (error) {
    return res.status(400).json({ message: error.message })
  }
})

export default router