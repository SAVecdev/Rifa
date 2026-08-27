import { ensureSupabaseConfigured } from '../config/supabase.js'

const formatTwoDigits = (val) => String(val || '00').padStart(2, '0')

export const syncAutoRaffles = async () => {
  try {
    const supabase = ensureSupabaseConfigured()

    const { data: activeTypes, error: fetchError } = await supabase
      .from('tipo_rifa')
      .select('*')
      .eq('auto_creacion_activa', true)

    if (fetchError || !activeTypes || activeTypes.length === 0) {
      return { createdCount: 0, createdRaffles: [] }
    }

    const createdRaffles = []
    const now = new Date()
    const LOOK_AHEAD_DAYS = 14

    for (const tipo of activeTypes) {
      let days = []
      if (Array.isArray(tipo.dias_creacion_auto)) {
        days = tipo.dias_creacion_auto.map(Number)
      } else if (typeof tipo.dias_creacion_auto === 'string') {
        try {
          days = JSON.parse(tipo.dias_creacion_auto).map(Number)
        } catch {
          days = []
        }
      }

      if (days.length === 0) continue

      const timeStr = tipo.hora_juego_auto ? String(tipo.hora_juego_auto).slice(0, 8) : '18:00:00'
      const timeParts = timeStr.split(':')
      const hh = formatTwoDigits(timeParts[0] || '18')
      const mm = formatTwoDigits(timeParts[1] || '00')
      const ss = formatTwoDigits(timeParts[2] || '00')
      const formattedTime = `${hh}:${mm}:${ss}`

      for (let dayOffset = 0; dayOffset < LOOK_AHEAD_DAYS; dayOffset++) {
        const targetDate = new Date(now.valueOf())
        targetDate.setDate(targetDate.getDate() + dayOffset)

        const dayOfWeek = targetDate.getDay() // 0 = Domingo, 1 = Lunes, ..., 6 = Sabado
        if (!days.includes(dayOfWeek)) continue

        const year = targetDate.getFullYear()
        const month = formatTwoDigits(targetDate.getMonth() + 1)
        const dateDay = formatTwoDigits(targetDate.getDate())

        const dateIsoStart = `${year}-${month}-${dateDay}T00:00:00`
        const dateIsoEnd = `${year}-${month}-${dateDay}T23:59:59`
        const targetGameTime = `${year}-${month}-${dateDay}T${formattedTime}`

        const { data: existing, error: checkError } = await supabase
          .from('rifa')
          .select('id')
          .eq('id_tipo', tipo.id)
          .gte('fecha_hora_juego', dateIsoStart)
          .lte('fecha_hora_juego', dateIsoEnd)

        if (checkError) {
          console.error(`[AUTO-RAFFLE] Error verificando rifa para tipo ${tipo.id}: ${checkError.message}`)
          continue
        }

        if (existing && existing.length > 0) {
          continue
        }

        const raffleName = `${tipo.nombre} - ${dateDay}/${month}/${year}`
        const payload = {
          nombre: raffleName,
          sorteos: Number(tipo.sorteos_auto) || 1,
          id_tipo: tipo.id,
          fecha_hora_juego: targetGameTime,
        }

        const { data: newRaffle, error: createError } = await supabase
          .from('rifa')
          .insert(payload)
          .select()
          .single()

        if (createError) {
          console.error(`[AUTO-RAFFLE] Error creando rifa automatica (${raffleName}): ${createError.message}`)
        } else if (newRaffle) {
          console.log(`[AUTO-RAFFLE] Rifa automatica creada: ${newRaffle.nombre} (#${newRaffle.id}) para ${targetGameTime}`)
          createdRaffles.push(newRaffle)
        }
      }
    }

    return { createdCount: createdRaffles.length, createdRaffles }
  } catch (err) {
    console.error(`[AUTO-RAFFLE] Error general en syncAutoRaffles: ${err.message}`)
    return { createdCount: 0, createdRaffles: [], error: err.message }
  }
}

export const startAutoRaffleScheduler = () => {
  console.log('[AUTO-RAFFLE] Programador de creacion automatica de rifas inicializado.')
  void syncAutoRaffles()
  setInterval(() => {
    void syncAutoRaffles()
  }, 30 * 60 * 1000).unref()
}
