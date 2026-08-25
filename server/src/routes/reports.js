import express from 'express'
import { ensureSupabaseConfigured } from '../config/supabase.js'

const router = express.Router()

const isDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value || '')

const getDefaultDateRange = () => {
  const today = new Date()
  const to = today.toISOString().slice(0, 10)
  const fromDate = new Date(today)
  fromDate.setDate(fromDate.getDate() - 29)
  return { from: fromDate.toISOString().slice(0, 10), to }
}

const parseFilters = (query) => {
  const defaults = getDefaultDateRange()
  return {
    from: isDate(query.dateFrom) ? query.dateFrom : defaults.from,
    to: isDate(query.dateTo) ? query.dateTo : defaults.to,
    userId: Number.isInteger(Number(query.userId)) && Number(query.userId) > 0 ? Number(query.userId) : null,
    raffleTypeId: Number.isInteger(Number(query.raffleTypeId)) && Number(query.raffleTypeId) > 0 ? Number(query.raffleTypeId) : null,
  }
}

const parsePagination = (query) => {
  if (String(query.all).toLowerCase() === 'true') return { page: 1, limit: null, from: 0, to: null, all: true }
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1)
  const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit, 10) || 20))
  return { page, limit, from: (page - 1) * limit, to: page * limit - 1, all: false }
}

const applyRange = (query, pagination) => pagination.all ? query : query.range(pagination.from, pagination.to)

const buildPagination = (page, limit, total) => ({ page, limit, total, totalPages: total === 0 ? 0 : Math.ceil(total / limit) })

const attachVendorNames = async (supabase, rows, key = 'id_usuario') => {
  const userIds = [...new Set(rows.map((row) => row[key]).filter(Boolean))]
  if (userIds.length === 0) return rows
  const { data, error } = await supabase.from('usuario').select('id, nombre, correo').in('id', userIds)
  if (error) throw new Error(error.message)
  const usersById = new Map((data || []).map((user) => [user.id, user]))
  return rows.map((row) => ({ ...row, vendedor: usersById.get(row[key])?.nombre || `Usuario ${row[key]}`, vendedor_correo: usersById.get(row[key])?.correo || '' }))
}

router.get('/ventas', async (req, res) => {
  try {
    const supabase = ensureSupabaseConfigured()
    const { from, to, userId } = parseFilters(req.query)
    const pagination = parsePagination(req.query)

    let query = supabase
      .from('venta')
      .select('id, id_usuario, id_factura, id_rifa, numero, cantidad, valor, total, pagada, eliminada, fecha, rifa(nombre)', { count: 'exact' })
      .eq('eliminada', false)
      .gte('fecha', `${from}T00:00:00.000Z`)
      .lte('fecha', `${to}T23:59:59.999Z`)
      .order('fecha', { ascending: false })
    query = applyRange(query, pagination)
    if (userId) query = query.eq('id_usuario', userId)

    let totalsQuery = supabase.from('venta').select('total').eq('eliminada', false).gte('fecha', `${from}T00:00:00.000Z`).lte('fecha', `${to}T23:59:59.999Z`)
    if (userId) totalsQuery = totalsQuery.eq('id_usuario', userId)

    const [{ data, error, count }, { data: totalsData, error: totalsError }] = await Promise.all([query, totalsQuery])
    if (error) throw new Error(error.message)
    if (totalsError) throw new Error(totalsError.message)

    const rows = await attachVendorNames(supabase, data || [])
    const total = (totalsData || []).reduce((sum, row) => sum + Number(row.total || 0), 0)
    return res.json({ period: { from, to }, data: rows, total, pagination: buildPagination(pagination.page, pagination.limit || rows.length, count || 0) })
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
})

router.get('/premios', async (req, res) => {
  try {
    const supabase = ensureSupabaseConfigured()
    const { from, to, userId, raffleTypeId } = parseFilters(req.query)
    const pagination = parsePagination(req.query)

    let winnerIds = null
    if (raffleTypeId) {
      const { data: raffles, error: rafflesError } = await supabase.from('rifa').select('id').eq('id_tipo', raffleTypeId)
      if (rafflesError) throw new Error(rafflesError.message)
      const raffleIds = (raffles || []).map((raffle) => raffle.id)
      if (raffleIds.length === 0) winnerIds = []
      else {
        const { data: winningNumbers, error: winningNumbersError } = await supabase.from('numero_ganadores').select('id').in('id_rifa', raffleIds)
        if (winningNumbersError) throw new Error(winningNumbersError.message)
        winnerIds = (winningNumbers || []).map((winningNumber) => winningNumber.id)
      }
    }

    let query = supabase
      .from('ganadores')
      .select('id, id_usuario, id_factura, numerol, nivel_premio, saldo_premio, pagada, fecha_hora_pago, fecha, factura(numero_factura)', { count: 'exact' })
      .gte('fecha', from)
      .lte('fecha', to)
      .order('fecha', { ascending: false })
    query = applyRange(query, pagination)
    if (userId) query = query.eq('id_usuario', userId)
    if (winnerIds) query = winnerIds.length > 0 ? query.in('id_numero_ganador', winnerIds) : query.eq('id_numero_ganador', -1)

    let totalsQuery = supabase.from('ganadores').select('saldo_premio, pagada').gte('fecha', from).lte('fecha', to)
    if (userId) totalsQuery = totalsQuery.eq('id_usuario', userId)
    if (winnerIds) totalsQuery = winnerIds.length > 0 ? totalsQuery.in('id_numero_ganador', winnerIds) : totalsQuery.eq('id_numero_ganador', -1)

    const [{ data, error, count }, { data: totalsData, error: totalsError }] = await Promise.all([query, totalsQuery])
    if (error) throw new Error(error.message)
    if (totalsError) throw new Error(totalsError.message)

    const rows = await attachVendorNames(supabase, data || [])
    const pendientes = (totalsData || []).filter((row) => !row.pagada).reduce((sum, row) => sum + Number(row.saldo_premio || 0), 0)
    const pagados = (totalsData || []).filter((row) => row.pagada).reduce((sum, row) => sum + Number(row.saldo_premio || 0), 0)
    return res.json({ period: { from, to }, data: rows, totals: { pendientes, pagados, total: pendientes + pagados }, pagination: buildPagination(pagination.page, pagination.limit || rows.length, count || 0) })
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
})

router.get('/transacciones', async (req, res) => {
  try {
    const supabase = ensureSupabaseConfigured()
    const { from, to, userId } = parseFilters(req.query)
    const pagination = parsePagination(req.query)

    let query = supabase
      .from('transacciones')
      .select('id, id_usuario, tipo, monto, fecha, estado, descripcion', { count: 'exact' })
      .gte('fecha', `${from}T00:00:00.000Z`)
      .lte('fecha', `${to}T23:59:59.999Z`)
      .order('fecha', { ascending: false })
    query = applyRange(query, pagination)
    if (userId) query = query.eq('id_usuario', userId)

    const { data, error, count } = await query
    if (error) throw new Error(error.message)
    const rows = await attachVendorNames(supabase, data || [])
    return res.json({ period: { from, to }, data: rows, pagination: buildPagination(pagination.page, pagination.limit || rows.length, count || 0) })
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
})

router.get('/estadisticas-diarias', async (req, res) => {
  try {
    const supabase = ensureSupabaseConfigured()
    const { from, to, userId } = parseFilters(req.query)
    const pagination = parsePagination(req.query)

    let query = supabase
      .from('estadisticas_diarias')
      .select('fecha, id_usuario, ventas_monto, ventas_cantidad, ventas_hoy, premios_totales, premios_pagados, premios_pendientes, pagos_hoy, recargas, retiros', { count: 'exact' })
      .gte('fecha', from)
      .lte('fecha', to)
      .order('fecha', { ascending: false })
    query = applyRange(query, pagination)
    if (userId) query = query.eq('id_usuario', userId)

    const { data, error, count } = await query
    if (error) throw new Error(error.message)
    const rows = (await attachVendorNames(supabase, data || [])).map((row) => ({
      ...row,
      ganancia_neta: Number(row.ventas_monto || 0) - Number(row.premios_pagados || 0),
    }))
    return res.json({ period: { from, to }, data: rows, pagination: buildPagination(pagination.page, pagination.limit || rows.length, count || 0) })
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
})

export default router
