import { ensureSupabaseConfigured } from '../config/supabase.js'

// Valida que el token enviado corresponda a una sesion activa (no cerrada por un admin/supervisor ni expirada).
export const requireSession = async (req, res, next) => {
  try {
    const token = String(req.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
    if (!token) return res.status(401).json({ message: 'Sesion requerida. Vuelve a iniciar sesion.' })

    const supabase = ensureSupabaseConfigured()
    const { data: session, error } = await supabase
      .from('session')
      .select('id, id_usuario, estado')
      .eq('token_sesion', token)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!session || session.estado !== 'activa') {
      return res.status(401).json({ message: 'Tu sesion fue cerrada. Vuelve a iniciar sesion.' })
    }

    req.sessionId = session.id
    req.sessionUserId = session.id_usuario
    void supabase.from('session').update({ ultimo_acceso: new Date().toISOString() }).eq('id', session.id).then(() => {}, () => {})
    return next()
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
}

// Ademas de validar la sesion, exige que el usuario autenticado sea el mismo que aparece en la ruta/cuerpo.
export const requireSessionOwner = (extractUserId) => [requireSession, (req, res, next) => {
  const targetUserId = Number(extractUserId(req))
  if (Number.isInteger(targetUserId) && targetUserId !== req.sessionUserId) {
    return res.status(403).json({ message: 'No puedes operar sobre la sesion de otro usuario' })
  }
  return next()
}]
