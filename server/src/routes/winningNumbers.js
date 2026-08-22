import express from 'express'
import { ensureSupabaseConfigured } from '../config/supabase.js'

const router = express.Router()

const validateWinningNumber = (payload, requireRaffle = true) => {
  const fields = ['nivel_premio', 'numero_ganador', 'sorteo']
  if (requireRaffle) fields.unshift('id_rifa')

  for (const field of fields) {
    if (payload[field] === undefined || payload[field] === null || payload[field] === '') {
      throw new Error(`${field} es obligatorio`)
    }
  }

  for (const field of ['id_rifa', 'nivel_premio', 'sorteo']) {
    if (payload[field] !== undefined && (!Number.isInteger(Number(payload[field])) || Number(payload[field]) < 1)) {
      throw new Error(`${field} debe ser un numero entero mayor que cero`)
    }
  }

  if (payload.nivel_premio !== undefined && Number(payload.nivel_premio) > 10) {
    throw new Error('nivel_premio debe estar entre 1 y 10')
  }
}

router.get('/', async (req, res) => {
  try {
    const supabase = ensureSupabaseConfigured()
    let query = supabase.from('numero_ganadores').select('*').order('created_at', { ascending: false })

    if (req.query.id_rifa) query = query.eq('id_rifa', req.query.id_rifa)

    const { data, error } = await query
    if (error) throw new Error(error.message)
    return res.json(data)
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
})

router.post('/', async (req, res) => {
  try {
    const payload = req.body || {}
    validateWinningNumber(payload)

    const supabase = ensureSupabaseConfigured()
    const { data, error } = await supabase
      .from('numero_ganadores')
      .insert({
        id_rifa: Number(payload.id_rifa),
        nivel_premio: Number(payload.nivel_premio),
        numero_ganador: String(payload.numero_ganador),
        sorteo: Number(payload.sorteo),
      })
      .select()
      .single()

    if (error) throw new Error(error.message)
    return res.status(201).json(data)
  } catch (error) {
    return res.status(400).json({ message: error.message })
  }
})

router.patch('/:id', async (req, res) => {
  try {
    const payload = req.body || {}
    const updates = {}

    for (const field of ['nivel_premio', 'numero_ganador', 'sorteo']) {
      if (payload[field] !== undefined) updates[field] = payload[field]
    }
    validateWinningNumber(updates, false)

    updates.nivel_premio = Number(updates.nivel_premio)
    updates.sorteo = Number(updates.sorteo)
    updates.numero_ganador = String(updates.numero_ganador)

    const supabase = ensureSupabaseConfigured()
    const { data, error } = await supabase.from('numero_ganadores').update(updates).eq('id', req.params.id).select().maybeSingle()

    if (error) throw new Error(error.message)
    if (!data) return res.status(404).json({ message: 'Premio no encontrado' })
    return res.json(data)
  } catch (error) {
    return res.status(400).json({ message: error.message })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    const supabase = ensureSupabaseConfigured()
    const { data, error } = await supabase.from('numero_ganadores').delete().eq('id', req.params.id).select().maybeSingle()

    if (error) throw new Error(error.message)
    if (!data) return res.status(404).json({ message: 'Premio no encontrado' })
    return res.json({ ok: true, winningNumber: data })
  } catch (error) {
    return res.status(400).json({ message: error.message })
  }
})

export default router