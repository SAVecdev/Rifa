import express from 'express'
import { ensureSupabaseConfigured } from '../config/supabase.js'

const router = express.Router()

router.get('/', async (req, res) => {
  try {
    const supabase = ensureSupabaseConfigured()
    const { data, error } = await supabase.from('session').select('*').order('created_at', { ascending: false })

    if (error) throw new Error(error.message)
    return res.json(data)
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
})

router.post('/logout', async (req, res) => {
  try {
    const { token } = req.body || {}
    const supabase = ensureSupabaseConfigured()

    if (!token) {
      return res.status(400).json({ message: 'Token requerido' })
    }

    const { error } = await supabase
      .from('session')
      .update({
        estado: 'cerrada',
        fecha_cierre: new Date().toISOString(),
      })
      .eq('token_sesion', token)

    if (error) throw new Error(error.message)

    return res.json({ ok: true, message: 'Sesión cerrada' })
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
})

router.patch('/:id', async (req, res) => {
  try {
    const { estado, ultimo_acceso, fecha_cierre, duracion_minutos, ip, user_agent, navegador, sistema_operativo } = req.body || {}
    const payload = {}

    if (estado !== undefined) payload.estado = estado
    if (ultimo_acceso !== undefined) payload.ultimo_acceso = ultimo_acceso
    if (fecha_cierre !== undefined) payload.fecha_cierre = fecha_cierre
    if (duracion_minutos !== undefined) payload.duracion_minutos = duracion_minutos
    if (ip !== undefined) payload.ip = ip
    if (user_agent !== undefined) payload.user_agent = user_agent
    if (navegador !== undefined) payload.navegador = navegador
    if (sistema_operativo !== undefined) payload.sistema_operativo = sistema_operativo
    if (Object.keys(payload).length === 0) {
      return res.status(400).json({ message: 'Envia al menos un campo para actualizar' })
    }

    const supabase = ensureSupabaseConfigured()
    const { data, error } = await supabase.from('session').update(payload).eq('id', req.params.id).select().maybeSingle()

    if (error) throw new Error(error.message)
    if (!data) return res.status(404).json({ message: 'Sesion no encontrada' })
    return res.json(data)
  } catch (error) {
    return res.status(400).json({ message: error.message })
  }
})

export default router
