import crypto from 'crypto'
import { ensureSupabaseConfigured } from '../config/supabase.js'

const DEMO_USERS = {
  'javier.garcia@sav.com': {
    id: 1,
    nombre: 'Javier García',
    correo: 'javier.garcia@sav.com',
    password: 'sav1993',
    rol: 'vendedor',
    activo: true,
    id_area: 1,
  },
  'admin@rifa.com': {
    id: 2,
    nombre: 'Administrador',
    correo: 'admin@rifa.com',
    password: 'admin123',
    rol: 'administrador',
    activo: true,
    id_area: 1,
  },
  'supervisor@rifa.com': {
    id: 3,
    nombre: 'Supervisor',
    correo: 'supervisor@rifa.com',
    password: 'supervisor123',
    rol: 'supervisor',
    activo: true,
    id_area: 1,
  },
}

export const hashPassword = (value) => {
  return crypto.createHash('sha256').update(String(value)).digest('hex')
}

const getClient = () => ensureSupabaseConfigured()

const getClientDetails = (userAgent = '') => {
  const value = String(userAgent)
  const navegador = value.includes('Edg/')
    ? 'Microsoft Edge'
    : value.includes('OPR/')
      ? 'Opera'
      : value.includes('Firefox/')
        ? 'Firefox'
        : value.includes('Chrome/')
          ? 'Google Chrome'
          : value.includes('Safari/')
            ? 'Safari'
            : value.includes('MSIE') || value.includes('Trident/')
              ? 'Internet Explorer'
              : 'Navegador desconocido'
  const sistemaOperativo = value.includes('Android')
    ? 'Android'
    : value.includes('iPhone') || value.includes('iPad') || value.includes('iPod')
      ? 'iOS'
      : value.includes('Windows')
        ? 'Windows'
        : value.includes('Mac OS X')
          ? 'macOS'
          : value.includes('Linux')
            ? 'Linux'
            : 'Sistema desconocido'
  return { navegador, sistemaOperativo }
}

const toPublicUser = (user) => {
  if (!user) return null
  const { password_hash, ...publicUser } = user
  return publicUser
}

export const findUserByEmail = async (email) => {
  const supabase = getClient()

  const { data, error } = await supabase
    .from('usuario')
    .select('*')
    .ilike('correo', email.trim())
    .maybeSingle()

  if (error && error.code !== 'PGRST116') {
    throw new Error(error.message)
  }

  return data || null
}

export const loginUser = async ({ email, password }) => {
  if (!email || !password) {
    throw new Error('Email y contraseña son obligatorios')
  }

  const normalizedEmail = String(email).trim().toLowerCase()
  const normalizedPassword = String(password).trim()

  const userFromDb = await findUserByEmail(normalizedEmail)

  if (userFromDb) {
    if (!userFromDb.activo || (userFromDb.bloqueado_hasta && new Date(userFromDb.bloqueado_hasta).getTime() > Date.now())) {
      throw new Error('Usuario bloqueado temporalmente')
    }
    const storedHash = userFromDb.password_hash || ''
    if (storedHash !== hashPassword(normalizedPassword)) {
      throw new Error('Credenciales inválidas')
    }

    return {
      id: userFromDb.id,
      nombre: userFromDb.nombre,
      correo: userFromDb.correo,
      rol: userFromDb.rol,
      activo: userFromDb.activo,
      bloqueado_hasta: userFromDb.bloqueado_hasta,
    }
  }

  const demoUser = DEMO_USERS[normalizedEmail]
  if (!demoUser || demoUser.password !== normalizedPassword) {
    throw new Error('Credenciales inválidas')
  }

  return {
    id: demoUser.id,
    nombre: demoUser.nombre,
    correo: demoUser.correo,
    rol: demoUser.rol,
    activo: demoUser.activo,
  }
}

export const createSession = async ({ userId, token, ip, userAgent }) => {
  const supabase = getClient()

  const now = new Date().toISOString()
  const { navegador, sistemaOperativo } = getClientDetails(userAgent)

  const { data, error } = await supabase
    .from('session')
    .insert({
      id_usuario: userId,
      token_sesion: token,
      estado: 'activa',
      fecha_inicio: now,
      ultimo_acceso: now,
      duracion_minutos: 60,
      ip: ip || null,
      user_agent: userAgent || null,
      navegador,
      sistema_operativo: sistemaOperativo,
    })
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data
}

export const getUserById = async (id) => {
  const supabase = getClient()

  const { data, error } = await supabase.from('usuario').select('*').eq('id', id).maybeSingle()

  if (error && error.code !== 'PGRST116') {
    throw new Error(error.message)
  }

  return toPublicUser(data)
}

export const getUsers = async () => {
  const supabase = getClient()

  const { data, error } = await supabase.from('usuario').select('*').order('created_at', { ascending: false })

  if (error) throw new Error(error.message)

  return (data || []).map(toPublicUser)
}

export const createUser = async ({ nombre, correo, password, rol = 'cliente', direccion = '', telefono = '', id_area = null }) => {
  const supabase = getClient()

  const email = String(correo).trim().toLowerCase()
  const passwordHash = hashPassword(password)

  const { data, error } = await supabase
    .from('usuario')
    .insert({
      nombre,
      correo: email,
      password_hash: passwordHash,
      direccion,
      rol,
      telefono,
      id_area,
      saldo: 0,
      activo: true,
    })
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return toPublicUser(data)
}

export const updateUser = async (id, user) => {
  const supabase = getClient()
  const payload = {}
  const allowedFields = ['nombre', 'direccion', 'rol', 'telefono', 'id_area', 'activo', 'foto_perfil', 'saldo']

  for (const field of allowedFields) {
    if (user[field] !== undefined) payload[field] = user[field]
  }

  if (user.correo !== undefined) payload.correo = String(user.correo).trim().toLowerCase()
  if (user.password !== undefined) payload.password_hash = hashPassword(user.password)

  if (Object.keys(payload).length === 0) {
    throw new Error('Envia al menos un campo para actualizar')
  }

  const { data, error } = await supabase.from('usuario').update(payload).eq('id', id).select().maybeSingle()

  if (error) throw new Error(error.message)
  return toPublicUser(data)
}

export const deleteUser = async (id) => {
  const supabase = getClient()
  const { data, error } = await supabase.from('usuario').delete().eq('id', id).select().maybeSingle()

  if (error) throw new Error(error.message)
  return toPublicUser(data)
}
