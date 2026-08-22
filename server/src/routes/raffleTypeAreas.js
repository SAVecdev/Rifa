import express from 'express'
import { ensureSupabaseConfigured } from '../config/supabase.js'

const router = express.Router()

const normalizeAreaIds = (value) => {
  const list = Array.isArray(value) ? value : [value]
  return [...new Set(list
    .filter((item) => item !== null && item !== undefined && item !== '')
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item) && item > 0))]
}

router.get('/', async (req, res) => {
  try {
    const supabase = ensureSupabaseConfigured()
    const { data, error } = await supabase
      .from('tipo_rifa_area')
      .select('*')
      .order('id_tipo_rifa', { ascending: true })
      .order('id_area', { ascending: true })

    if (error) throw new Error(error.message)
    return res.json(data || [])
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
})

router.get('/by-type/:idTipoRifa', async (req, res) => {
  try {
    const supabase = ensureSupabaseConfigured()
    const { data, error } = await supabase
      .from('tipo_rifa_area')
      .select('*')
      .eq('id_tipo_rifa', Number(req.params.idTipoRifa))
      .order('id_area', { ascending: true })

    if (error) throw new Error(error.message)
    return res.json(data || [])
  } catch (error) {
    return res.status(400).json({ message: error.message })
  }
})

router.post('/', async (req, res) => {
  try {
    const { id_tipo_rifa, id_areas } = req.body || {}

    if (!id_tipo_rifa) {
      return res.status(400).json({ message: 'id_tipo_rifa es obligatorio' })
    }

    const areaIds = normalizeAreaIds(id_areas)
    if (areaIds.length === 0) {
      return res.status(400).json({ message: 'Debe seleccionar al menos un area' })
    }

    const supabase = ensureSupabaseConfigured()
    const rows = areaIds.map((id_area) => ({ id_tipo_rifa: Number(id_tipo_rifa), id_area }))
    const { data, error } = await supabase
      .from('tipo_rifa_area')
      .upsert(rows, { onConflict: 'id_tipo_rifa,id_area' })
      .select()

    if (error) throw new Error(error.message)
    return res.status(201).json(Array.isArray(data) ? data : [data])
  } catch (error) {
    return res.status(400).json({ message: error.message })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    const supabase = ensureSupabaseConfigured()
    const { data, error } = await supabase
      .from('tipo_rifa_area')
      .delete()
      .eq('id', req.params.id)
      .select()
      .maybeSingle()

    if (error) throw new Error(error.message)
    if (!data) return res.status(404).json({ message: 'Relacion tipo-area no encontrada' })
    return res.json({ ok: true, relation: data })
  } catch (error) {
    return res.status(400).json({ message: error.message })
  }
})

export default router
