import express from 'express'
import { ensureSupabaseConfigured } from '../config/supabase.js'

const router = express.Router()
const cacheTtl = 5 * 60 * 1000
let areasCache = null
let areasCacheExpiresAt = 0

const clearAreasCache = () => {
  areasCache = null
  areasCacheExpiresAt = 0
}

router.get('/', async (req, res) => {
  try {
    if (areasCache && areasCacheExpiresAt > Date.now()) return res.json(areasCache)

    const supabase = ensureSupabaseConfigured()
    const { data, error } = await supabase.from('area').select('*').order('id', { ascending: true })

    if (error) throw new Error(error.message)
    areasCache = data || []
    areasCacheExpiresAt = Date.now() + cacheTtl
    return res.json(data)
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
})

router.post('/', async (req, res) => {
  try {
    const { nombre, descripcion } = req.body || {}
    const supabase = ensureSupabaseConfigured()

    const { data, error } = await supabase
      .from('area')
      .insert({ nombre, descripcion, activo: true })
      .select()
      .single()

    if (error) throw new Error(error.message)
    clearAreasCache()
    return res.status(201).json(data)
  } catch (error) {
    return res.status(400).json({ message: error.message })
  }
})

router.patch('/:id', async (req, res) => {
  try {
    const { nombre, descripcion, activo } = req.body || {}
    const payload = {}

    if (nombre !== undefined) payload.nombre = nombre
    if (descripcion !== undefined) payload.descripcion = descripcion
    if (activo !== undefined) payload.activo = activo
    if (Object.keys(payload).length === 0) {
      return res.status(400).json({ message: 'Envia al menos un campo para actualizar' })
    }

    const supabase = ensureSupabaseConfigured()
    const { data, error } = await supabase.from('area').update(payload).eq('id', req.params.id).select().maybeSingle()

    if (error) throw new Error(error.message)
    if (!data) return res.status(404).json({ message: 'Area no encontrada' })
    clearAreasCache()
    return res.json(data)
  } catch (error) {
    return res.status(400).json({ message: error.message })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    const supabase = ensureSupabaseConfigured()
    const { data, error } = await supabase.from('area').delete().eq('id', req.params.id).select().maybeSingle()

    if (error) throw new Error(error.message)
    if (!data) return res.status(404).json({ message: 'Area no encontrada' })

    clearAreasCache()
    return res.json({ ok: true, area: data })
  } catch (error) {
    return res.status(400).json({ message: error.message })
  }
})

export default router
