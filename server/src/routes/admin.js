import express from 'express'
import { ensureSupabaseConfigured } from '../config/supabase.js'

const router = express.Router()
const dashboardCacheTtl = 30 * 1000
const dashboardCache = new Map()

const getDateValue = (value, fallback) => /^\d{4}-\d{2}-\d{2}$/.test(value || '') ? value : fallback

const getDefaultDateRange = () => {
  const today = new Date()
  const to = today.toISOString().slice(0, 10)
  const fromDate = new Date(today)
  fromDate.setDate(fromDate.getDate() - 29)
  return { from: fromDate.toISOString().slice(0, 10), to }
}

router.get('/dashboard', async (req, res) => {
  const requestId = req.requestId || '-'
  const startedAt = Date.now()
  try {
    const supabase = ensureSupabaseConfigured()
    const defaults = getDefaultDateRange()
    const from = getDateValue(req.query.dateFrom, defaults.from)
    const to = getDateValue(req.query.dateTo, defaults.to)
    const userId = Number.isInteger(Number(req.query.userId)) && Number(req.query.userId) > 0 ? Number(req.query.userId) : null
    const cacheKey = `${from}:${to}:${userId || 'todos'}`
    const cached = dashboardCache.get(cacheKey)
    if (cached && cached.expiresAt > Date.now()) return res.json(cached.data)

    const queryStartedAt = Date.now()
    let statsQuery = supabase
      .from('estadisticas_diarias')
      .select('fecha, id_usuario, ventas_monto, ventas_cantidad, premios_totales, premios_pagados, premios_pendientes, ventas_hoy, pagos_hoy')
      .gte('fecha', from)
      .lte('fecha', to)
    if (userId) statsQuery = statsQuery.eq('id_usuario', userId)
    const { data, error } = await statsQuery

    console.log(`[DASHBOARD ${requestId}] Estadisticas diarias ${Date.now() - queryStartedAt}ms - ${data?.length || 0} filas`)
    if (error) throw new Error(error.message)

    const rows = data || []
    const totals = rows.reduce((summary, row) => ({
      ventas_periodo: summary.ventas_periodo + Number(row.ventas_monto || 0),
      ventas_cantidad: summary.ventas_cantidad + Number(row.ventas_cantidad || 0),
      premios_periodo: summary.premios_periodo + Number(row.premios_totales || 0),
      premios_pagados: summary.premios_pagados + Number(row.premios_pagados || 0),
      premios_pendientes: summary.premios_pendientes + Number(row.premios_pendientes || 0),
      ventas_hoy: summary.ventas_hoy + Number(row.ventas_hoy || 0),
      pagos_hoy: summary.pagos_hoy + Number(row.pagos_hoy || 0),
    }), { ventas_periodo: 0, ventas_cantidad: 0, premios_periodo: 0, premios_pagados: 0, premios_pendientes: 0, ventas_hoy: 0, pagos_hoy: 0 })

    const userIds = [...new Set(rows.map((row) => row.id_usuario))]
    const usersResult = userIds.length > 0
      ? await supabase.from('usuario').select('id, nombre').in('id', userIds)
      : { data: [], error: null }
    if (usersResult.error) throw new Error(usersResult.error.message)
    const usersById = new Map((usersResult.data || []).map((user) => [user.id, user.nombre]))
    const users = new Map()
    const days = new Map()
    for (const row of rows) {
      const user = users.get(row.id_usuario) || { id_usuario: row.id_usuario, nombre: usersById.get(row.id_usuario) || `Usuario ${row.id_usuario}`, ventas_monto: 0, ventas_cantidad: 0 }
      user.ventas_monto += Number(row.ventas_monto || 0)
      user.ventas_cantidad += Number(row.ventas_cantidad || 0)
      users.set(row.id_usuario, user)

      const day = days.get(row.fecha) || { fecha: row.fecha, ventas_monto: 0, premios_totales: 0, premios_pagados: 0, premios_pendientes: 0 }
      day.ventas_monto += Number(row.ventas_monto || 0)
      day.premios_totales += Number(row.premios_totales || 0)
      day.premios_pagados += Number(row.premios_pagados || 0)
      day.premios_pendientes += Number(row.premios_pendientes || 0)
      days.set(row.fecha, day)
    }

    const daily = [...days.values()].sort((first, second) => first.fecha.localeCompare(second.fecha))

    const response = {
      period: { from, to },
      stats: { ...totals, utilidad_neta: totals.ventas_periodo - totals.premios_pagados, vendedores: users.size, dias_con_actividad: days.size },
      ranking: [...users.values()].sort((first, second) => second.ventas_monto - first.ventas_monto).slice(0, 6),
      daily,
    }
    dashboardCache.set(cacheKey, { data: response, expiresAt: Date.now() + dashboardCacheTtl })

    return res.json(response)
  } catch (error) {
    console.error(`[DASHBOARD ${requestId}] Error: ${error.message}`)
    return res.status(500).json({ message: error.message })
  }
})

export default router