import { ensureSupabaseConfigured } from '../config/supabase.js'

const getClient = () => ensureSupabaseConfigured()

export const getSupervisors = async () => {
  const supabase = getClient()
  const { data, error } = await supabase.from('usuario').select('id, nombre, correo, activo').eq('rol', 'supervisor').order('nombre')
  if (error) throw new Error(error.message)
  return data || []
}

export const getAssignedVendors = async (supervisorId) => {
  const supabase = getClient()
  const { data: links, error: linksError } = await supabase.from('supervisor_vendedor').select('id_vendedor').eq('id_supervisor', supervisorId)
  if (linksError) throw new Error(linksError.message)

  const vendorIds = (links || []).map((link) => link.id_vendedor)
  if (vendorIds.length === 0) return []

  const { data, error } = await supabase.from('usuario').select('id, nombre, correo, id_area, activo').in('id', vendorIds).order('nombre')
  if (error) throw new Error(error.message)
  return data || []
}

// Todas las asignaciones, usada para contar cuantos vendedores tiene cada supervisor.
export const getAllAssignments = async () => {
  const supabase = getClient()
  const { data, error } = await supabase.from('supervisor_vendedor').select('id_supervisor, id_vendedor')
  if (error) throw new Error(error.message)
  return data || []
}

const getDateRange = (dateFrom, dateTo) => {
  const today = new Date()
  const to = /^\d{4}-\d{2}-\d{2}$/.test(dateTo || '') ? dateTo : today.toISOString().slice(0, 10)
  const fromDate = new Date(`${to}T00:00:00`)
  fromDate.setDate(fromDate.getDate() - 29)
  const from = /^\d{4}-\d{2}-\d{2}$/.test(dateFrom || '') ? dateFrom : fromDate.toISOString().slice(0, 10)
  return { from, to }
}

export const getSupervisorDashboard = async (supervisorId, dateFrom, dateTo) => {
  const supabase = getClient()
  const { from, to } = getDateRange(dateFrom, dateTo)
  const { data: links, error: linksError } = await supabase.from('supervisor_vendedor').select('id_vendedor').eq('id_supervisor', supervisorId)
  if (linksError) throw new Error(linksError.message)

  const vendorIds = [...new Set((links || []).map((link) => link.id_vendedor))]
  const usersResult = vendorIds.length > 0
    ? await supabase.from('usuario').select('id, nombre, correo, activo').in('id', vendorIds).eq('rol', 'vendedor').order('nombre')
    : { data: [], error: null }
  if (usersResult.error) throw new Error(usersResult.error.message)

  const statsResult = vendorIds.length > 0
    ? await supabase.from('estadisticas_diarias').select('fecha, id_usuario, ventas_monto, ventas_cantidad, premios_totales, premios_pagados, premios_pendientes, ventas_hoy, pagos_hoy').in('id_usuario', vendorIds).gte('fecha', from).lte('fecha', to)
    : { data: [], error: null }
  if (statsResult.error) throw new Error(statsResult.error.message)

  const usersById = new Map((usersResult.data || []).map((user) => [user.id, user]))
  const vendorStats = new Map((usersResult.data || []).map((user) => [user.id, {
    id_usuario: user.id,
    nombre: user.nombre,
    correo: user.correo,
    activo: user.activo,
    ventas_monto: 0,
    ventas_cantidad: 0,
    premios_totales: 0,
    premios_pagados: 0,
    premios_pendientes: 0,
  }]))
  const dailyStats = new Map()
  const totals = { ventas_periodo: 0, ventas_cantidad: 0, premios_periodo: 0, premios_pagados: 0, premios_pendientes: 0, ventas_hoy: 0, pagos_hoy: 0 }

  for (const row of statsResult.data || []) {
    const values = ['ventas_monto', 'ventas_cantidad', 'premios_totales', 'premios_pagados', 'premios_pendientes', 'ventas_hoy', 'pagos_hoy']
    for (const field of values) totals[field === 'premios_totales' ? 'premios_periodo' : field] += Number(row[field] || 0)
    const vendor = vendorStats.get(row.id_usuario)
    if (vendor) {
      vendor.ventas_monto += Number(row.ventas_monto || 0)
      vendor.ventas_cantidad += Number(row.ventas_cantidad || 0)
      vendor.premios_totales += Number(row.premios_totales || 0)
      vendor.premios_pagados += Number(row.premios_pagados || 0)
      vendor.premios_pendientes += Number(row.premios_pendientes || 0)
    }
    const day = dailyStats.get(row.fecha) || { fecha: row.fecha, ventas_monto: 0, premios_totales: 0, premios_pagados: 0, premios_pendientes: 0 }
    day.ventas_monto += Number(row.ventas_monto || 0)
    day.premios_totales += Number(row.premios_totales || 0)
    day.premios_pagados += Number(row.premios_pagados || 0)
    day.premios_pendientes += Number(row.premios_pendientes || 0)
    dailyStats.set(row.fecha, day)
  }

  return {
    period: { from, to },
    stats: { ...totals, utilidad_neta: totals.ventas_periodo - totals.premios_pagados, vendedores: usersById.size, dias_con_actividad: dailyStats.size },
    ranking: [...vendorStats.values()].sort((first, second) => second.ventas_monto - first.ventas_monto),
    daily: [...dailyStats.values()].sort((first, second) => first.fecha.localeCompare(second.fecha)),
    vendedores: [...vendorStats.values()],
  }
}

export const setAssignedVendors = async (supervisorId, vendorIds) => {
  const supabase = getClient()

  const { data: supervisor, error: supervisorError } = await supabase.from('usuario').select('id, rol').eq('id', supervisorId).maybeSingle()
  if (supervisorError) throw new Error(supervisorError.message)
  if (!supervisor || supervisor.rol !== 'supervisor') throw new Error('El usuario no es un supervisor')

  const uniqueVendorIds = [...new Set(vendorIds)]
  if (uniqueVendorIds.length > 0) {
    const { data: vendors, error: vendorsError } = await supabase.from('usuario').select('id, rol').in('id', uniqueVendorIds)
    if (vendorsError) throw new Error(vendorsError.message)
    const invalidIds = uniqueVendorIds.filter((id) => !(vendors || []).some((vendor) => vendor.id === id && vendor.rol === 'vendedor'))
    if (invalidIds.length > 0) throw new Error(`Estos IDs no son vendedores validos: ${invalidIds.join(', ')}`)
  }

  const { error: deleteError } = await supabase.from('supervisor_vendedor').delete().eq('id_supervisor', supervisorId)
  if (deleteError) throw new Error(deleteError.message)

  if (uniqueVendorIds.length > 0) {
    const rows = uniqueVendorIds.map((id_vendedor) => ({ id_supervisor: supervisorId, id_vendedor }))
    const { error: insertError } = await supabase.from('supervisor_vendedor').insert(rows)
    if (insertError) throw new Error(insertError.message)
  }

  return getAssignedVendors(supervisorId)
}
