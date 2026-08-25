import express from 'express'
import { ensureSupabaseConfigured } from '../config/supabase.js'

const router = express.Router()
const requiredFields = ['id_tipo_rifa', 'id_area', 'nivel_premio', 'saldo_ganado', 'valor_premio', 'digitos']
const optionsCache = new Map()

const clearOptionsCache = () => {
  optionsCache.clear()
}

const validateOption = (payload, partial = false) => {
  for (const field of requiredFields) {
    if (!partial && (payload[field] === undefined || payload[field] === null || payload[field] === '')) {
      throw new Error(`${field} es obligatorio`)
    }
  }

  for (const field of ['id_tipo_rifa', 'id_area', 'nivel_premio', 'digitos']) {
    if (payload[field] !== undefined && (!Number.isInteger(Number(payload[field])) || Number(payload[field]) < 1)) {
      throw new Error(`${field} debe ser un numero entero mayor que cero`)
    }
  }

  if (payload.nivel_premio !== undefined && Number(payload.nivel_premio) > 10) {
    throw new Error('nivel_premio debe estar entre 1 y 10')
  }

  if (payload.digitos !== undefined && (Number(payload.digitos) < 2 || Number(payload.digitos) > 5)) {
    throw new Error('digitos debe estar entre 2 y 5')
  }

  for (const field of ['saldo_ganado', 'valor_premio']) {
    if (payload[field] !== undefined && (!Number.isFinite(Number(payload[field])) || Number(payload[field]) <= 0)) {
      throw new Error(`${field} debe ser un numero mayor a cero`)
    }
  }
}

const toPayload = (payload) => {
  const result = {}
  for (const field of ['id_tipo_rifa', 'id_area', 'nivel_premio', 'digitos']) {
    if (payload[field] !== undefined) result[field] = Number(payload[field])
  }
  if (payload.saldo_ganado !== undefined) result.saldo_ganado = Number(payload.saldo_ganado)
  if (payload.valor_premio !== undefined) result.valor_premio = Number(payload.valor_premio)
  if (payload.descripcion !== undefined) result.descripcion = payload.descripcion || null
  return result
}

const isDuplicateOptionError = (error) => error?.message?.includes('opciones_premios_id_tipo_rifa_id_area_nivel_digitos_saldo_key')

const getPositiveNumber = (value) => {
  if (value === undefined || value === null || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : null
}

const applyOptionFilters = (query, filters) => {
  if (filters.raffleTypeId) query = query.eq('id_tipo_rifa', filters.raffleTypeId)
  if (filters.areaId) query = query.eq('id_area', filters.areaId)
  if (filters.levelId) query = query.eq('nivel_premio', filters.levelId)
  if (filters.digits) query = query.eq('digitos', filters.digits)
  if (filters.minimumBalance) query = query.gte('saldo_ganado', filters.minimumBalance)
  if (filters.maximumBalance) query = query.lte('saldo_ganado', filters.maximumBalance)
  return query
}

const fetchOptionPage = async (supabase, filters, from, to) => {
  const query = applyOptionFilters(supabase.from('opciones_premios').select('*'), filters)
    .order('id_tipo_rifa')
    .order('id_area')
    .order('saldo_ganado')
    .order('nivel_premio')
    .range(from, to)

  return query
}

router.get('/', async (req, res) => {
  try {
    const supabase = ensureSupabaseConfigured()
    const { id_tipo_rifa, id_area, digitos, saldoMinimo, saldoMaximo } = req.query
    const filters = {
      raffleTypeId: getPositiveNumber(id_tipo_rifa),
      areaId: getPositiveNumber(id_area),
      digits: getPositiveNumber(digitos),
      minimumBalance: getPositiveNumber(saldoMinimo),
      maximumBalance: getPositiveNumber(saldoMaximo),
    }
    const cacheKey = JSON.stringify(filters)
    if (optionsCache.has(cacheKey)) return res.json(optionsCache.get(cacheKey))

    const pageSize = 1000
    const maxRows = 10000
    const rows = []

    for (let from = 0; from < maxRows; from += pageSize) {
      const { data, error } = await fetchOptionPage(supabase, filters, from, from + pageSize - 1)
      if (error) throw new Error(error.message)
      rows.push(...(data || []))
      if (!data || data.length < pageSize) break
    }

    optionsCache.set(cacheKey, rows)
    return res.json(rows)
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
})

router.post('/', async (req, res) => {
  try {
    const payload = req.body || {}
    validateOption(payload)
    const supabase = ensureSupabaseConfigured()
    const { data, error } = await supabase.from('opciones_premios').insert(toPayload(payload)).select().single()

    if (error) throw new Error(error.message)
    clearOptionsCache()
    return res.status(201).json(data)
  } catch (error) {
    if (isDuplicateOptionError(error)) {
      return res.status(409).json({ message: 'Ya existe una opcion para ese tipo, area, nivel, digitos y saldo ganado' })
    }
    return res.status(400).json({ message: error.message })
  }
})

router.post('/generate-proportional', async (req, res) => {
  try {
    const { id_tipo_rifa, id_area, nivel_premio, digitos, saldo_inicial, saldo_final, incremento, premio_por_incremento, descripcion = null } = req.body || {}
    const basePayload = { id_tipo_rifa, id_area, nivel_premio, digitos, saldo_ganado: saldo_inicial, valor_premio: premio_por_incremento }
    validateOption(basePayload)

    const start = Number(saldo_inicial)
    const end = Number(saldo_final)
    const step = Number(incremento)
    const prizeStep = Number(premio_por_incremento)
    if (!Number.isFinite(end) || end < start || !Number.isFinite(step) || step <= 0) {
      throw new Error('saldo_final debe ser mayor o igual a saldo_inicial e incremento debe ser mayor a cero')
    }

    const count = Math.floor((end - start) / step + 0.000001) + 1
    if (count > 1000) throw new Error('La generacion no puede superar 1000 opciones')

    const rows = Array.from({ length: count }, (_, index) => ({
      id_tipo_rifa: Number(id_tipo_rifa),
      id_area: Number(id_area),
      nivel_premio: Number(nivel_premio),
      digitos: Number(digitos),
      saldo_ganado: Number((start + step * index).toFixed(2)),
      valor_premio: Number((prizeStep * (index + 1)).toFixed(2)),
      descripcion: descripcion || null,
    }))

    const supabase = ensureSupabaseConfigured()
    const { data, error } = await supabase
      .from('opciones_premios')
      .upsert(rows, { onConflict: 'id_tipo_rifa,id_area,nivel_premio,digitos,saldo_ganado' })
      .select()

    if (error) throw new Error(error.message)
    clearOptionsCache()
    return res.status(201).json(data)
  } catch (error) {
    return res.status(400).json({ message: error.message })
  }
})

router.post('/bulk-delete', async (req, res) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number) : []
    if (ids.length === 0 || ids.some((id) => !Number.isInteger(id) || id < 1)) {
      return res.status(400).json({ message: 'ids debe contener al menos un ID valido' })
    }

    const supabase = ensureSupabaseConfigured()
    const { data, error } = await supabase.from('opciones_premios').delete().in('id', ids).select('id')

    if (error) throw new Error(error.message)
    clearOptionsCache()
    return res.json({ ok: true, deleted: data?.length || 0 })
  } catch (error) {
    return res.status(400).json({ message: error.message })
  }
})

router.post('/bulk-update', async (req, res) => {
  try {
    const { id_tipo_rifa, id_area, nivel_premio, digitos, saldoMinimo, saldoMaximo, multiplicador } = req.body || {}
    const factor = Number(multiplicador)
    if (!Number.isFinite(factor) || factor <= 0) throw new Error('multiplicador debe ser un numero mayor a cero')

    const filters = {
      raffleTypeId: getPositiveNumber(id_tipo_rifa),
      areaId: getPositiveNumber(id_area),
      levelId: getPositiveNumber(nivel_premio),
      digits: getPositiveNumber(digitos),
      minimumBalance: getPositiveNumber(saldoMinimo),
      maximumBalance: getPositiveNumber(saldoMaximo),
    }
    if (!filters.raffleTypeId && !filters.areaId && !filters.levelId && !filters.digits) {
      throw new Error('Selecciona al menos un filtro (tipo, area, nivel o digitos) para la actualizacion masiva')
    }

    const supabase = ensureSupabaseConfigured()
    const { data: matches, error: fetchError } = await applyOptionFilters(
      supabase.from('opciones_premios').select('id, saldo_ganado'),
      filters,
    )
    if (fetchError) throw new Error(fetchError.message)
    if (!matches || matches.length === 0) return res.json({ ok: true, updated: 0 })

    const results = await Promise.all(matches.map((row) => supabase
      .from('opciones_premios')
      .update({ valor_premio: Number((Number(row.saldo_ganado) * factor).toFixed(2)) })
      .eq('id', row.id)))

    const failed = results.find((result) => result.error)
    if (failed) throw new Error(failed.error.message)

    clearOptionsCache()
    return res.json({ ok: true, updated: matches.length })
  } catch (error) {
    return res.status(400).json({ message: error.message })
  }
})

router.patch('/:id', async (req, res) => {
  try {
    const payload = req.body || {}
    validateOption(payload, true)
    const updates = toPayload(payload)
    if (Object.keys(updates).length === 0) return res.status(400).json({ message: 'Envia al menos un campo para actualizar' })

    const supabase = ensureSupabaseConfigured()
    const { data, error } = await supabase.from('opciones_premios').update(updates).eq('id', req.params.id).select().maybeSingle()

    if (error) throw new Error(error.message)
    if (!data) return res.status(404).json({ message: 'Opcion de premio no encontrada' })
    clearOptionsCache()
    return res.json(data)
  } catch (error) {
    if (isDuplicateOptionError(error)) {
      return res.status(409).json({ message: 'Ya existe una opcion para ese tipo, area, nivel, digitos y saldo ganado' })
    }
    return res.status(400).json({ message: error.message })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    const supabase = ensureSupabaseConfigured()
    const { data, error } = await supabase.from('opciones_premios').delete().eq('id', req.params.id).select().maybeSingle()

    if (error) throw new Error(error.message)
    if (!data) return res.status(404).json({ message: 'Opcion de premio no encontrada' })
    clearOptionsCache()
    return res.json({ ok: true, prizeOption: data })
  } catch (error) {
    return res.status(400).json({ message: error.message })
  }
})

export default router