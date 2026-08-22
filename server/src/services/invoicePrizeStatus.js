// El cliente tiene 8 dias desde la fecha del sorteo para reclamar su premio.
export const PLAZO_PAGO_DIAS = 8

export const calcularVentaActiva = (fechaHoraJuego) => {
  if (!fechaHoraJuego) return true
  const expira = new Date(fechaHoraJuego)
  expira.setDate(expira.getDate() + PLAZO_PAGO_DIAS)
  return Date.now() <= expira.getTime()
}

export const adjuntarEstadoPremios = (sales, winners) => {
  const winnersByKey = new Map()
  for (const winner of winners || []) {
    const key = `${winner.id_factura}:${winner.numerol}`
    if (!winnersByKey.has(key)) winnersByKey.set(key, [])
    winnersByKey.get(key).push(winner)
  }

  return (sales || []).map((sale) => {
    const matches = winnersByKey.get(`${sale.id_factura}:${sale.numero}`) || []
    const premioTotal = matches.reduce((sum, winner) => sum + Number(winner.saldo_premio || 0), 0)
    const premioPagado = matches.length > 0 && matches.every((winner) => winner.pagada)
    return {
      ...sale,
      premio_total: premioTotal,
      premio_pagado: premioPagado,
      ganador_ids: matches.map((winner) => winner.id),
      activo: calcularVentaActiva(sale.rifa?.fecha_hora_juego),
    }
  })
}

// venta.pagada refleja si el premio de ese numero ya fue pagado, no si el cliente pago el ticket.
export const marcarVentasComoPagadas = async (supabase, userId, winners) => {
  const targets = (winners || []).filter((winner) => winner.id_factura && winner.numerol)
  await Promise.all(targets.map((winner) => supabase
    .from('venta')
    .update({ pagada: true, fecha_pago: winner.fecha_hora_pago || new Date().toISOString() })
    .eq('id_usuario', userId)
    .eq('id_factura', winner.id_factura)
    .eq('numero', winner.numerol)))
}
