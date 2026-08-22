import express from 'express'
import { ensureSupabaseConfigured } from '../config/supabase.js'

const router = express.Router()

router.get('/', async (req, res) => {
  try {
    const supabase = ensureSupabaseConfigured()
    const startedAt = Date.now()
    const { data, error } = await supabase
      .from('cupos_area_rifa')
      .select('id, id_area, id_tipo_rifa, c_2digitos, c_3digitos, c_4digitos, c_5digitos')
      .order('id_area', { ascending: true })
      .order('id_tipo_rifa', { ascending: true })

    if (error) throw new Error(error.message)
    console.log(`[QUOTAS] Consulta Supabase ${Date.now() - startedAt}ms - ${data?.length || 0} registros`)
    return res.json(data)
  } catch (error) {
    console.error(`[QUOTAS] Error: ${error.message}`)
    return res.status(500).json({ message: error.message })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const supabase = ensureSupabaseConfigured()
    const { data, error } = await supabase.from('cupos_area_rifa').select('*').eq('id', req.params.id).maybeSingle()

    if (error && error.code !== 'PGRST116') throw new Error(error.message)
    if (!data) return res.status(404).json({ message: 'Cupo de area y tipo de rifa no encontrado' })

    return res.json(data)
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
})

router.post('/', async (req, res) => {
  try {
    const { id_tipo_rifa, id_area, id_areas, sharedAcrossAreas = false, c_2digitos = 0, c_3digitos = 0, c_4digitos = 0, c_5digitos = 0 } = req.body || {}

    if (!id_tipo_rifa) {
      return res.status(400).json({ message: 'id_tipo_rifa es obligatorio' })
    }

    const normalizedAreas = Array.isArray(id_areas)
      ? id_areas
      : id_area !== undefined && id_area !== null && id_area !== ''
        ? [id_area]
        : []

    const sanitizedAreas = [...new Set(normalizedAreas.filter((value) => value !== null && value !== undefined && value !== '').map((value) => Number(value)).filter((value) => Number.isFinite(value) && value > 0))]

    const rows = []
    if (sharedAcrossAreas || sanitizedAreas.length === 0) {
      rows.push({
        id_area: null,
        id_tipo_rifa: Number(id_tipo_rifa),
        c_2digitos: Number(c_2digitos),
        c_3digitos: Number(c_3digitos),
        c_4digitos: Number(c_4digitos),
        c_5digitos: Number(c_5digitos),
      })
    } else {
      for (const areaId of sanitizedAreas) {
        rows.push({
          id_area: areaId,
          id_tipo_rifa: Number(id_tipo_rifa),
          c_2digitos: Number(c_2digitos),
          c_3digitos: Number(c_3digitos),
          c_4digitos: Number(c_4digitos),
          c_5digitos: Number(c_5digitos),
        })
      }
    }

    const supabase = ensureSupabaseConfigured()
    const { data, error } = await supabase
      .from('cupos_area_rifa')
      .upsert(rows, { onConflict: 'id_tipo_rifa,id_area' })
      .select()

    if (error) throw new Error(error.message)
    return res.status(201).json(Array.isArray(data) ? data : [data])
  } catch (error) {
    return res.status(400).json({ message: error.message })
  }
})

router.patch('/:id', async (req, res) => {
  try {
    const { id_area, id_tipo_rifa, c_2digitos, c_3digitos, c_4digitos, c_5digitos } = req.body || {}
    const payload = {}

    if (id_area !== undefined) payload.id_area = id_area
    if (id_tipo_rifa !== undefined) payload.id_tipo_rifa = id_tipo_rifa
    if (c_2digitos !== undefined) payload.c_2digitos = c_2digitos
    if (c_3digitos !== undefined) payload.c_3digitos = c_3digitos
    if (c_4digitos !== undefined) payload.c_4digitos = c_4digitos
    if (c_5digitos !== undefined) payload.c_5digitos = c_5digitos
    if (Object.keys(payload).length === 0) {
      return res.status(400).json({ message: 'Envia al menos un campo para actualizar' })
    }

    const supabase = ensureSupabaseConfigured()
    const { data, error } = await supabase.from('cupos_area_rifa').update(payload).eq('id', req.params.id).select().maybeSingle()

    if (error) throw new Error(error.message)
    if (!data) return res.status(404).json({ message: 'Cupo de area y tipo de rifa no encontrado' })
    return res.json(data)
  } catch (error) {
    return res.status(400).json({ message: error.message })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    const supabase = ensureSupabaseConfigured()
    const { data, error } = await supabase.from('cupos_area_rifa').delete().eq('id', req.params.id).select().maybeSingle()

    if (error) throw new Error(error.message)
    if (!data) return res.status(404).json({ message: 'Cupo de area y tipo de rifa no encontrado' })

    return res.json({ ok: true, quota: data })
  } catch (error) {
    return res.status(400).json({ message: error.message })
  }
})

export default router