import express from 'express'
import { ensureSupabaseConfigured } from '../config/supabase.js'

const router = express.Router()
const settingsCacheTtl = 2 * 60 * 60 * 1000
const settingsCache = new Map()
const settingsLoading = new Map()

const allowedFields = [
  'nombre_empresa',
  'identificacion_empresa',
  'telefono_empresa',
  'direccion_empresa',
  'mensaje_encabezado',
  'mensaje_pie',
  'tipo_letra',
  'tamano_letra',
  'color_primario',
  'color_secundario',
  'modelo_factura',
  'mostrar_logo',
  'mostrar_premios',
  'orden_premios',
]

const toPayload = (body) => {
  const payload = {}

  for (const field of allowedFields) {
    if (body[field] !== undefined) payload[field] = body[field]
  }

  if (payload.tamano_letra !== undefined) {
    const fontSize = Number(payload.tamano_letra)
    if (!Number.isInteger(fontSize) || fontSize < 8 || fontSize > 36) {
      throw new Error('tamano_letra debe estar entre 8 y 36')
    }
    payload.tamano_letra = fontSize
  }

  if (payload.modelo_factura !== undefined && !['clasica', 'compacta', 'resumen', 'agrupada'].includes(payload.modelo_factura)) {
    throw new Error('modelo_factura no es valido')
  }

  if (payload.orden_premios !== undefined) {
    if (!Array.isArray(payload.orden_premios) || payload.orden_premios.some((level) => !Number.isInteger(Number(level)) || Number(level) < 1 || Number(level) > 10)) {
      throw new Error('orden_premios debe ser una lista de niveles entre 1 y 10')
    }
    payload.orden_premios = payload.orden_premios.map(Number)
  }

  return payload
}

router.get('/:userId', async (req, res) => {
  try {
    const userId = Number(req.params.userId)
    if (!Number.isInteger(userId) || userId < 1) return res.status(400).json({ message: 'userId debe ser un ID valido' })

    const cached = settingsCache.get(userId)
    if (cached && cached.expiresAt > Date.now()) return res.json(cached.data)

    if (!settingsLoading.has(userId)) {
      settingsLoading.set(userId, (async () => {
        const supabase = ensureSupabaseConfigured()
        const startedAt = Date.now()
        const { data, error } = await supabase.from('configuracion_factura').select('*').eq('id_usuario', userId).maybeSingle()
        if (error && error.code !== 'PGRST116') throw new Error(error.message)
        const value = data || null
        settingsCache.set(userId, { data: value, expiresAt: Date.now() + settingsCacheTtl })
        console.log(`[INVOICE-SETTINGS] Consulta Supabase usuario ${userId} ${Date.now() - startedAt}ms`)
        return value
      })().finally(() => settingsLoading.delete(userId)))
    }

    return res.json(await settingsLoading.get(userId))
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
})

router.put('/:userId', async (req, res) => {
  try {
    const userId = Number(req.params.userId)
    if (!Number.isInteger(userId) || userId < 1) return res.status(400).json({ message: 'userId debe ser un ID valido' })

    const payload = toPayload(req.body || {})
    const supabase = ensureSupabaseConfigured()
    const { data, error } = await supabase
      .from('configuracion_factura')
      .upsert({ id_usuario: userId, ...payload }, { onConflict: 'id_usuario' })
      .select()
      .single()

    if (error) throw new Error(error.message)
    settingsCache.set(userId, { data, expiresAt: Date.now() + settingsCacheTtl })
    return res.json(data)
  } catch (error) {
    return res.status(400).json({ message: error.message })
  }
})

export default router