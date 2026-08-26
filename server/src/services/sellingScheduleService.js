import { ensureSupabaseConfigured } from '../config/supabase.js'

const formatTimePart = (val) => String(val || '00').padStart(2, '0')

const normalizeTimeStr = (timeValue, defaultStr) => {
  if (!timeValue) return defaultStr
  const str = String(timeValue).trim()
  const parts = str.split(':')
  const h = formatTimePart(parts[0])
  const m = formatTimePart(parts[1])
  const s = formatTimePart(parts[2])
  return `${h}:${m}:${s}`
}

export const checkVendorSellingSchedule = async (userId) => {
  const numericId = Number(userId)
  if (!Number.isInteger(numericId) || numericId < 1) return

  const supabase = ensureSupabaseConfigured()

  const { data: user, error: userError } = await supabase
    .from('usuario')
    .select('id, rol, id_area')
    .eq('id', numericId)
    .maybeSingle()

  if (userError || !user) return
  if (user.rol !== 'vendedor' || !user.id_area) return

  const { data: area, error: areaError } = await supabase
    .from('area')
    .select('id, nombre, hora_inicio_venta, hora_fin_venta, horario_activo')
    .eq('id', user.id_area)
    .maybeSingle()

  if (areaError || !area || !area.horario_activo) return

  const startTime = normalizeTimeStr(area.hora_inicio_venta, '07:00:00')
  const endTime = normalizeTimeStr(area.hora_fin_venta, '17:00:00')

  let currentTime
  try {
    const parts = new Date().toLocaleTimeString('es-CO', { timeZone: 'America/Bogota', hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }).split(':')
    currentTime = `${formatTimePart(parts[0])}:${formatTimePart(parts[1])}:${formatTimePart(parts[2])}`
  } catch {
    const now = new Date()
    currentTime = `${formatTimePart(now.getHours())}:${formatTimePart(now.getMinutes())}:${formatTimePart(now.getSeconds())}`
  }

  let isAllowed = false
  if (startTime <= endTime) {
    isAllowed = currentTime >= startTime && currentTime <= endTime
  } else {
    isAllowed = currentTime >= startTime || currentTime <= endTime
  }

  if (!isAllowed) {
    const displayStart = startTime.slice(0, 5)
    const displayEnd = endTime.slice(0, 5)
    throw new Error(`Venta no permitida fuera de horario. El horario de venta configurado para tu area (${area.nombre}) es de ${displayStart} a ${displayEnd}.`)
  }
}
