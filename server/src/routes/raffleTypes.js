import express from 'express'
import { ensureSupabaseConfigured } from '../config/supabase.js'

const router = express.Router()
const cacheTtl = 5 * 60 * 1000
let raffleTypesCache = null
let raffleTypesCacheExpiresAt = 0

const clearRaffleTypesCache = () => {
  raffleTypesCache = null
  raffleTypesCacheExpiresAt = 0
}

router.get('/', async (req, res) => {
  try {
    if (raffleTypesCache && raffleTypesCacheExpiresAt > Date.now()) return res.json(raffleTypesCache)

    const supabase = ensureSupabaseConfigured()
    const { data, error } = await supabase.from('tipo_rifa').select('*').order('id', { ascending: true })

    if (error) throw new Error(error.message)
    raffleTypesCache = data || []
    raffleTypesCacheExpiresAt = Date.now() + cacheTtl
    return res.json(data)
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const supabase = ensureSupabaseConfigured()
    const { data, error } = await supabase.from('tipo_rifa').select('*').eq('id', req.params.id).maybeSingle()

    if (error && error.code !== 'PGRST116') throw new Error(error.message)
    if (!data) return res.status(404).json({ message: 'Tipo de rifa no encontrado' })

    return res.json(data)
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
})

router.post('/', async (req, res) => {
  try {
    const { nombre, descripcion = null, color_primario, color_secundario } = req.body || {}

    if (!nombre) {
      return res.status(400).json({ message: 'nombre es obligatorio' })
    }

    const supabase = ensureSupabaseConfigured()
    const payload = { nombre, descripcion }

    if (color_primario !== undefined) payload.color_primario = color_primario
    if (color_secundario !== undefined) payload.color_secundario = color_secundario

    const { data, error } = await supabase.from('tipo_rifa').insert(payload).select().single()

    if (error) throw new Error(error.message)
    clearRaffleTypesCache()
    return res.status(201).json(data)
  } catch (error) {
    return res.status(400).json({ message: error.message })
  }
})

router.patch('/:id', async (req, res) => {
  try {
    const { nombre, descripcion, color_primario, color_secundario } = req.body || {}
    const payload = {}

    if (nombre !== undefined) payload.nombre = nombre
    if (descripcion !== undefined) payload.descripcion = descripcion
    if (color_primario !== undefined) payload.color_primario = color_primario
    if (color_secundario !== undefined) payload.color_secundario = color_secundario

    if (Object.keys(payload).length === 0) {
      return res.status(400).json({ message: 'Envia al menos un campo para actualizar' })
    }

    const supabase = ensureSupabaseConfigured()
    const { data, error } = await supabase.from('tipo_rifa').update(payload).eq('id', req.params.id).select().maybeSingle()

    if (error) throw new Error(error.message)
    if (!data) return res.status(404).json({ message: 'Tipo de rifa no encontrado' })

    clearRaffleTypesCache()
    return res.json(data)
  } catch (error) {
    return res.status(400).json({ message: error.message })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    const supabase = ensureSupabaseConfigured()
    const { data, error } = await supabase.from('tipo_rifa').delete().eq('id', req.params.id).select().maybeSingle()

    if (error) throw new Error(error.message)
    if (!data) return res.status(404).json({ message: 'Tipo de rifa no encontrado' })

    clearRaffleTypesCache()
    return res.json({ ok: true, raffleType: data })
  } catch (error) {
    return res.status(400).json({ message: error.message })
  }
})

export default router