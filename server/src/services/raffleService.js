import { ensureSupabaseConfigured } from '../config/supabase.js'
import { addPendingSales } from './localSaleService.js'

const getClient = () => ensureSupabaseConfigured()

export const getRaffles = async () => {
  const supabase = getClient()

  const { data, error } = await supabase.from('rifa').select('*').order('created_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return data
}

export const createRaffle = async (raffle) => {
  const supabase = getClient()

  const payload = {
    nombre: raffle.nombre || raffle.name,
    sorteos: Number(raffle.sorteos || raffle.totalNumbers || raffle.total_numbers || 1),
    id_imagen: raffle.id_imagen || null,
    id_tipo: raffle.id_tipo || null,
    fecha_hora_juego: raffle.fecha_hora_juego || new Date().toISOString(),
  }

  const { data, error } = await supabase.from('rifa').insert(payload).select().single()

  if (error) {
    throw new Error(error.message)
  }

  return data
}

export const getRaffleById = async (id) => {
  const supabase = getClient()

  const { data, error } = await supabase.from('rifa').select('*').eq('id', id).single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null
    }
    throw new Error(error.message)
  }

  return data
}

export const updateRaffle = async (id, raffle) => {
  const supabase = getClient()
  const payload = {}

  if (raffle.nombre !== undefined) payload.nombre = raffle.nombre
  else if (raffle.name !== undefined) payload.nombre = raffle.name

  if (raffle.sorteos !== undefined) payload.sorteos = Number(raffle.sorteos)
  else if (raffle.totalNumbers !== undefined) payload.sorteos = Number(raffle.totalNumbers)
  else if (raffle.total_numbers !== undefined) payload.sorteos = Number(raffle.total_numbers)

  if (raffle.id_imagen !== undefined) payload.id_imagen = raffle.id_imagen
  if (raffle.id_tipo !== undefined) payload.id_tipo = raffle.id_tipo
  if (raffle.fecha_hora_juego !== undefined) payload.fecha_hora_juego = raffle.fecha_hora_juego

  if (Object.keys(payload).length === 0) {
    throw new Error('Envia al menos un campo para actualizar')
  }

  const { data, error } = await supabase.from('rifa').update(payload).eq('id', id).select().maybeSingle()

  if (error) throw new Error(error.message)
  return data || null
}

export const deleteRaffle = async (id) => {
  const supabase = getClient()
  const { data, error } = await supabase.from('rifa').delete().eq('id', id).select().maybeSingle()

  if (error) throw new Error(error.message)
  return data || null
}

export const createSale = ({ raffleId, userId, invoiceNumber, numbers, value, quantity }) => {
  return addPendingSales({
    raffleId: Number(raffleId),
    userId: Number(userId),
    invoiceNumber,
    numbers,
    value: Number(value),
    quantity: Number(quantity) || 1,
  })
}
