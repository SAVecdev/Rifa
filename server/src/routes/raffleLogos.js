import express from 'express'
import { ensureSupabaseConfigured } from '../config/supabase.js'

const router = express.Router()
const cacheTtl = 30 * 1000
let logosCache = null
let logosCacheExpiresAt = 0
let logosLoading = null

const requiredFields = ['id_tipo_rifa', 'id_area', 'id_imagen', 'id_usuario']

const validateIds = (payload, partial = false) => {
  for (const field of requiredFields) {
    if (!partial && !payload[field]) throw new Error(`${field} es obligatorio`)
    if (payload[field] !== undefined && (!Number.isInteger(Number(payload[field])) || Number(payload[field]) < 1)) {
      throw new Error(`${field} debe ser un ID valido`)
    }
  }
}

router.get('/', async (req, res) => {
  try {
    if (logosCache && logosCacheExpiresAt > Date.now()) return res.json(logosCache)
    if (!logosLoading) {
      logosLoading = (async () => {
        const supabase = ensureSupabaseConfigured()
        const startedAt = Date.now()
        const { data, error } = await supabase.from('logo_rifa').select('id, id_tipo_rifa, id_area, id_imagen, id_usuario, created_at').order('created_at', { ascending: false })
        if (error) throw new Error(error.message)
        logosCache = data || []
        logosCacheExpiresAt = Date.now() + cacheTtl
        console.log(`[RAFFLE-LOGOS] Consulta Supabase ${Date.now() - startedAt}ms - ${logosCache.length} registros`)
        return logosCache
      })().finally(() => { logosLoading = null })
    }
    return res.json(await logosLoading)
  } catch (error) {
    console.error(`[RAFFLE-LOGOS] Error: ${error.message}`)
    return res.status(500).json({ message: error.message })
  }
})

router.post('/', async (req, res) => {
  try {
    const payload = req.body || {}
    validateIds(payload)

    const supabase = ensureSupabaseConfigured()
    const { data, error } = await supabase
      .from('logo_rifa')
      .insert({
        id_tipo_rifa: Number(payload.id_tipo_rifa),
        id_area: Number(payload.id_area),
        id_imagen: Number(payload.id_imagen),
        id_usuario: Number(payload.id_usuario),
      })
      .select()
      .single()

    if (error) throw new Error(error.message)
    logosCache = null
    logosCacheExpiresAt = 0
    return res.status(201).json(data)
  } catch (error) {
    return res.status(400).json({ message: error.message })
  }
})

router.patch('/:id', async (req, res) => {
  try {
    const payload = req.body || {}
    validateIds(payload, true)
    const updates = {}

    for (const field of requiredFields) {
      if (payload[field] !== undefined) updates[field] = Number(payload[field])
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: 'Envia al menos un campo para actualizar' })
    }

    const supabase = ensureSupabaseConfigured()
    const { data, error } = await supabase.from('logo_rifa').update(updates).eq('id', req.params.id).select().maybeSingle()

    if (error) throw new Error(error.message)
    if (!data) return res.status(404).json({ message: 'Logo no encontrado' })
    logosCache = null
    logosCacheExpiresAt = 0
    return res.json(data)
  } catch (error) {
    return res.status(400).json({ message: error.message })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    const supabase = ensureSupabaseConfigured()
    const { data, error } = await supabase.from('logo_rifa').delete().eq('id', req.params.id).select().maybeSingle()

    if (error) throw new Error(error.message)
    if (!data) return res.status(404).json({ message: 'Logo no encontrado' })
    logosCache = null
    logosCacheExpiresAt = 0

    return res.json({ ok: true, logo: data })
  } catch (error) {
    return res.status(400).json({ message: error.message })
  }
})

export default router