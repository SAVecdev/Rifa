import express from 'express'
import { ensureSupabaseConfigured } from '../config/supabase.js'
import { adjuntarEstadoPremios } from '../services/invoicePrizeStatus.js'

const router = express.Router()

const sanitizeSearch = (value) => String(value || '').trim().replace(/[%,()]/g, '')
const logStep = (requestId, label, startedAt, details = '') => {
  const duration = Date.now() - startedAt
  console.log(`[INVOICES ${requestId}] ${label} ${duration}ms${details ? ` - ${details}` : ''}`)
}

const runTimedQuery = async (requestId, label, query) => {
  const startedAt = Date.now()
  const result = await query
  logStep(requestId, label, startedAt, result.error ? result.error.message : `${result.data?.length || 0} resultados`)
  return result
}

const getInvoicesWithSales = async ({ invoiceId = null, invoiceQuery = null, requestId = '-' } = {}) => {
  const supabase = ensureSupabaseConfigured()
  const startedAt = Date.now()
  let invoicesQuery = supabase.from('factura').select('*', { count: 'exact' }).order('created_at', { ascending: false })
  if (invoiceId) invoicesQuery = invoicesQuery.eq('id', invoiceId)
  if (invoiceQuery) {
    if (invoiceQuery.search) {
      const search = sanitizeSearch(invoiceQuery.search)
      if (/^\d+$/.test(search)) invoicesQuery = invoicesQuery.eq('id', Number(search))
      else if (search) invoicesQuery = invoicesQuery.ilike('numero_factura', `%${search}%`)
    }
    if (invoiceQuery.userIds) invoicesQuery = invoicesQuery.in('id_usuario', invoiceQuery.userIds)
    if (invoiceQuery.status === 'activas') invoicesQuery = invoicesQuery.eq('eliminada', false)
    if (invoiceQuery.status === 'eliminadas') invoicesQuery = invoicesQuery.eq('eliminada', true)
    if (invoiceQuery.dateFrom) invoicesQuery = invoicesQuery.gte('created_at', `${invoiceQuery.dateFrom}T00:00:00.000Z`)
    if (invoiceQuery.dateTo) invoicesQuery = invoicesQuery.lte('created_at', `${invoiceQuery.dateTo}T23:59:59.999Z`)
    invoicesQuery = invoicesQuery.range(invoiceQuery.from, invoiceQuery.to)
  }

  const invoicesStartedAt = Date.now()
  const invoicesResult = await invoicesQuery
  if (invoicesResult.error) throw new Error(invoicesResult.error.message)

  const invoices = invoicesResult.data || []
  logStep(requestId, 'Consulta factura completada', invoicesStartedAt, `${invoices.length} resultados, total ${invoicesResult.count || 0}`)
  if (invoices.length === 0) {
    logStep(requestId, 'Solicitud completada sin relaciones', startedAt)
    return { data: [], total: invoicesResult.count || 0 }
  }

  const invoiceIds = invoices.map((invoice) => invoice.id)
  const userIds = [...new Set(invoices.map((invoice) => invoice.id_usuario))]
  const relationsStartedAt = Date.now()
  const [usersResult, salesResult, winnersResult] = await Promise.all([
    runTimedQuery(requestId, 'Consulta usuarios relacionadas', supabase.from('usuario').select('id, nombre, correo, id_area').in('id', userIds)),
    runTimedQuery(requestId, 'Consulta ventas relacionadas', supabase.from('venta').select('id, id_factura, id_rifa, numero, cantidad, valor, total, premio_01, premio_02, premio_03, premio_04, premio_05, premio_06, premio_07, premio_08, premio_09, premio_10, pagada, eliminada, fecha').in('id_factura', invoiceIds)),
    runTimedQuery(requestId, 'Consulta premios relacionados', supabase.from('ganadores').select('id, id_factura, numerol, saldo_premio, pagada, nivel_premio').in('id_factura', invoiceIds)),
  ])

  for (const result of [usersResult, salesResult, winnersResult]) {
    if (result.error) throw new Error(result.error.message)
  }

  const raffleIds = [...new Set((salesResult.data || []).map((sale) => sale.id_rifa))]
  const rafflesResult = raffleIds.length > 0
    ? await runTimedQuery(requestId, 'Consulta rifas relacionadas', supabase.from('rifa').select('id, nombre, id_tipo, fecha_hora_juego').in('id', raffleIds))
    : { data: [], error: null }
  if (rafflesResult.error) throw new Error(rafflesResult.error.message)

  const areaIds = [...new Set((usersResult.data || []).map((user) => user.id_area).filter(Boolean))]
  const raffleTypes = [...new Set((rafflesResult.data || []).map((raffle) => raffle.id_tipo).filter(Boolean))]
  const [logosResult, raffleTypesResult] = await Promise.all([
    areaIds.length > 0 && raffleTypes.length > 0
      ? runTimedQuery(requestId, 'Consulta logos relacionados', supabase.from('logo_rifa').select('id_tipo_rifa, id_area, id_imagen').in('id_tipo_rifa', raffleTypes).in('id_area', areaIds))
      : Promise.resolve({ data: [], error: null }),
    raffleTypes.length > 0
      ? runTimedQuery(requestId, 'Consulta tipos de rifa relacionados', supabase.from('tipo_rifa').select('id, nombre').in('id', raffleTypes))
      : Promise.resolve({ data: [], error: null }),
  ])
  if (logosResult.error) throw new Error(logosResult.error.message)
  if (raffleTypesResult.error) throw new Error(raffleTypesResult.error.message)

  const imageIds = [...new Set((logosResult.data || []).map((logo) => logo.id_imagen).filter(Boolean))]
  const imagesResult = imageIds.length > 0
    ? await runTimedQuery(requestId, 'Consulta imagenes relacionadas', supabase.from('imagenes').select('id, ruta').in('id', imageIds))
    : { data: [], error: null }
  if (imagesResult.error) throw new Error(imagesResult.error.message)

  logStep(requestId, 'Consultas relacionadas completadas', relationsStartedAt, `${salesResult.data?.length || 0} ventas`)

  const usersById = new Map((usersResult.data || []).map((user) => [user.id, user]))
  const rafflesById = new Map((rafflesResult.data || []).map((raffle) => [raffle.id, raffle]))
  const raffleTypesById = new Map((raffleTypesResult.data || []).map((type) => [type.id, type]))
  const imagesById = new Map((imagesResult.data || []).map((image) => [image.id, image]))
  const logosByTypeAndArea = new Map((logosResult.data || []).map((logo) => [`${logo.id_tipo_rifa}:${logo.id_area}`, logo]))
  const salesByInvoice = new Map()

  const enrichedSales = adjuntarEstadoPremios(salesResult.data || [], winnersResult.data || []).map((sale) => {
    const rifa = rafflesById.get(sale.id_rifa) || null
    return { ...sale, rifa: rifa ? { ...rifa, tipo_rifa: raffleTypesById.get(rifa.id_tipo) || null } : null }
  })
  for (const sale of enrichedSales) {
    if (!salesByInvoice.has(sale.id_factura)) salesByInvoice.set(sale.id_factura, [])
    salesByInvoice.get(sale.id_factura).push(sale)
  }

  const result = {
    data: invoices.map((invoice) => {
    const sales = salesByInvoice.get(invoice.id) || []
    const user = usersById.get(invoice.id_usuario) || null
    const firstRaffle = sales[0]?.rifa
    const logo = firstRaffle && user?.id_area ? logosByTypeAndArea.get(`${firstRaffle.id_tipo}:${user.id_area}`) : null
    return {
      ...invoice,
      usuario: user,
      ventas: sales,
      total: sales.reduce((sum, sale) => sum + Number(sale.total || 0), 0),
      logo_ruta: logo ? imagesById.get(logo.id_imagen)?.ruta || null : null,
    }
    }),
    total: invoicesResult.count || 0,
  }
  logStep(requestId, 'Procesamiento de facturas completado', startedAt, `${result.data.length} facturas`)
  return result
}

router.get('/', async (req, res) => {
  const requestId = req.requestId || '-'
  const startedAt = Date.now()
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1)
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 10))
    const status = ['activas', 'eliminadas', 'todas'].includes(req.query.status) ? req.query.status : 'activas'
    const user = sanitizeSearch(req.query.user)
    let userIds = null
    console.log(`[INVOICES ${requestId}] Inicio filtros page=${page} limit=${limit} status=${status} search=${Boolean(req.query.search)} user=${Boolean(user)} dateFrom=${req.query.dateFrom || '-'} dateTo=${req.query.dateTo || '-'}`)

    if (user) {
      const usersStartedAt = Date.now()
      let usersQuery = ensureSupabaseConfigured().from('usuario').select('id')
      if (/^\d+$/.test(user)) usersQuery = usersQuery.or(`id.eq.${Number(user)},nombre.ilike.%${user}%,correo.ilike.%${user}%`)
      else usersQuery = usersQuery.or(`nombre.ilike.%${user}%,correo.ilike.%${user}%`)
      const usersResult = await usersQuery
      if (usersResult.error) throw new Error(usersResult.error.message)
      userIds = (usersResult.data || []).map((item) => item.id)
      logStep(requestId, 'Filtro de usuario completado', usersStartedAt, `${userIds.length} usuarios`)
      if (userIds.length === 0) {
        logStep(requestId, 'Solicitud completada sin coincidencias', startedAt)
        return res.json({ data: [], pagination: { page, limit, total: 0, totalPages: 0 } })
      }
    }

    const dateFrom = /^\d{4}-\d{2}-\d{2}$/.test(req.query.dateFrom || '') ? req.query.dateFrom : ''
    const dateTo = /^\d{4}-\d{2}-\d{2}$/.test(req.query.dateTo || '') ? req.query.dateTo : ''
    const result = await getInvoicesWithSales({ requestId, invoiceQuery: {
      search: req.query.search,
      userIds,
      status,
      dateFrom,
      dateTo,
      from: (page - 1) * limit,
      to: page * limit - 1,
    } })
    const totalPages = result.total === 0 ? 0 : Math.ceil(result.total / limit)
    const response = { data: result.data, pagination: { page, limit, total: result.total, totalPages } }
    logStep(requestId, 'Respuesta preparada', startedAt, `${result.data.length} facturas, ${JSON.stringify(response.pagination)}`)
    return res.json(response)
  } catch (error) {
    console.error(`[INVOICES ${requestId}] Error: ${error.message}`)
    return res.status(500).json({ message: error.message })
  }
})

router.get('/:id', async (req, res) => {
  const requestId = req.requestId || '-'
  try {
    const result = await getInvoicesWithSales({ invoiceId: req.params.id, requestId })
    const [invoice] = result.data
    if (!invoice) return res.status(404).json({ message: 'Factura no encontrada' })
    return res.json(invoice)
  } catch (error) {
    console.error(`[INVOICES ${requestId}] Error detalle: ${error.message}`)
    return res.status(500).json({ message: error.message })
  }
})

router.post('/:id/delete', async (req, res) => {
  try {
    const supabase = ensureSupabaseConfigured()
    const { data, error } = await supabase.rpc('eliminar_factura', { p_id_factura: Number(req.params.id) })

    if (error) throw new Error(error.message)
    return res.json(data)
  } catch (error) {
    return res.status(400).json({ message: error.message })
  }
})

router.post('/:id/restore', async (req, res) => {
  try {
    const supabase = ensureSupabaseConfigured()
    const { data, error } = await supabase.rpc('restaurar_factura', { p_id_factura: Number(req.params.id) })

    if (error) throw new Error(error.message)
    return res.json(data)
  } catch (error) {
    return res.status(400).json({ message: error.message })
  }
})

export default router