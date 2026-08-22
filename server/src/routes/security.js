import express from 'express'
import { ensureSupabaseConfigured } from '../config/supabase.js'

const router = express.Router()

const getActor = async (req) => {
  const token = String(req.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!token) throw new Error('Sesion requerida')
  const supabase = ensureSupabaseConfigured()
  const { data: session, error } = await supabase.from('session').select('id_usuario, estado').eq('token_sesion', token).eq('estado', 'activa').maybeSingle()
  if (error) throw new Error(error.message)
  if (!session) throw new Error('Sesion invalida o cerrada')
  const { data: actor, error: actorError } = await supabase.from('usuario').select('id, rol').eq('id', session.id_usuario).maybeSingle()
  if (actorError) throw new Error(actorError.message)
  if (!actor || !['administrador', 'supervisor'].includes(actor.rol)) throw new Error('No autorizado')
  return actor
}

const canManageUser = async (supabase, actor, userId) => {
  if (actor.rol === 'administrador') return true
  const { data, error } = await supabase.from('supervisor_vendedor').select('id_vendedor').eq('id_supervisor', actor.id).eq('id_vendedor', userId).maybeSingle()
  if (error) throw new Error(error.message)
  return Boolean(data)
}

router.get('/sessions', async (req, res) => {
  try {
    const actor = await getActor(req)
    const supabase = ensureSupabaseConfigured()
    let userIds = null
    if (actor.rol === 'supervisor') {
      const { data: links, error } = await supabase.from('supervisor_vendedor').select('id_vendedor').eq('id_supervisor', actor.id)
      if (error) throw new Error(error.message)
      userIds = (links || []).map((link) => link.id_vendedor)
    }
    let query = supabase.from('session').select('id, id_usuario, ip, user_agent, navegador, sistema_operativo, fecha_inicio, ultimo_acceso, fecha_cierre, estado, duracion_minutos').order('ultimo_acceso', { ascending: false })
    if (userIds) query = userIds.length ? query.in('id_usuario', userIds) : null
    const sessionsResult = query ? await query : { data: [], error: null }
    if (sessionsResult.error) throw new Error(sessionsResult.error.message)
    const sessions = sessionsResult.data || []
    const ids = [...new Set(sessions.map((session) => session.id_usuario))]
    const usersResult = ids.length ? await supabase.from('usuario').select('id, nombre, correo, rol, activo, bloqueado_hasta').in('id', ids) : { data: [], error: null }
    if (usersResult.error) throw new Error(usersResult.error.message)
    const users = new Map((usersResult.data || []).map((user) => [user.id, user]))
    return res.json(sessions.map((session) => ({ ...session, usuario: users.get(session.id_usuario) || null })))
  } catch (error) {
    return res.status(error.message.includes('autorizado') || error.message.includes('Sesion') ? 401 : 500).json({ message: error.message })
  }
})

router.post('/users/:id/sessions/revoke', async (req, res) => {
  try {
    const actor = await getActor(req)
    const userId = Number(req.params.id)
    const supabase = ensureSupabaseConfigured()
    if (!await canManageUser(supabase, actor, userId)) return res.status(403).json({ message: 'No puedes administrar este usuario' })
    const { error } = await supabase.from('session').update({ estado: 'cerrada', fecha_cierre: new Date().toISOString() }).eq('id_usuario', userId).eq('estado', 'activa')
    if (error) throw new Error(error.message)
    return res.json({ ok: true })
  } catch (error) {
    return res.status(error.message.includes('autorizado') || error.message.includes('Sesion') ? 401 : 400).json({ message: error.message })
  }
})

router.post('/users/:id/block', async (req, res) => {
  try {
    const actor = await getActor(req)
    const userId = Number(req.params.id)
    const minutes = Math.min(43200, Math.max(1, Number(req.body?.minutes) || 60))
    const supabase = ensureSupabaseConfigured()
    if (!await canManageUser(supabase, actor, userId)) return res.status(403).json({ message: 'No puedes administrar este usuario' })
    const blockedUntil = new Date(Date.now() + minutes * 60000).toISOString()
    const { data, error } = await supabase.from('usuario').update({ bloqueado_hasta: blockedUntil }).eq('id', userId).select('id, nombre, bloqueado_hasta').single()
    if (error) throw new Error(error.message)
    await supabase.from('session').update({ estado: 'cerrada', fecha_cierre: new Date().toISOString() }).eq('id_usuario', userId).eq('estado', 'activa')
    return res.json(data)
  } catch (error) {
    return res.status(error.message.includes('autorizado') || error.message.includes('Sesion') ? 401 : 400).json({ message: error.message })
  }
})

export default router