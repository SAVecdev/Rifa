import express from 'express'
import { ensureSupabaseConfigured } from '../config/supabase.js'
import {
  beginPayment,
  closeSaleWindow,
  completePendingInvoice,
  getPendingInvoice,
  getCachedRaffleGameTimes,
  openSaleWindow,
  releaseExpiredPendingSales,
  removePendingSale,
  restorePendingInvoice,
} from '../services/localSaleService.js'
import { refreshWinnerCache } from '../services/winnerCache.js'
import { requireSessionOwner } from '../middleware/requireSession.js'
import { checkVendorSellingSchedule } from '../services/sellingScheduleService.js'

const router = express.Router()

const callRpcWithRetry = async (supabase, payload, requestLabel) => {
  let lastError = null
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const result = await supabase.rpc('confirmar_ventas_pendientes', payload)
      if (!result.error) return result
      lastError = result.error
      console.error(`[PAYMENT ${requestLabel}] RPC intento ${attempt}: ${result.error.message}`)
      if (!String(result.error.message || '').toLowerCase().includes('fetch failed')) return result
    } catch (error) {
      lastError = error
      console.error(`[PAYMENT ${requestLabel}] RPC intento ${attempt}: ${error.message}`)
      if (!String(error.message || '').toLowerCase().includes('fetch failed')) throw error
    }
  }
  return { data: null, error: lastError }
}

router.post('/windows', ...requireSessionOwner((req) => req.body?.id_usuario ?? req.body?.userId), async (req, res) => {
  try {
    const userId = req.body?.id_usuario ?? req.body?.userId
    await checkVendorSellingSchedule(userId)
    const invoice = openSaleWindow(userId)
    return res.status(201).json(invoice)
  } catch (error) {
    return res.status(400).json({ message: error.message })
  }
})

router.get('/windows/:userId/:invoiceNumber', ...requireSessionOwner((req) => req.params.userId), (req, res) => {
  try {
    return res.json(getPendingInvoice(req.params.userId, req.params.invoiceNumber))
  } catch (error) {
    return res.status(404).json({ message: error.message })
  }
})

router.delete('/windows/:userId/:invoiceNumber', ...requireSessionOwner((req) => req.params.userId), (req, res) => {
  try {
    closeSaleWindow(req.params.userId, req.params.invoiceNumber)
    return res.json({ ok: true, message: 'Factura pendiente cerrada y ventas eliminadas' })
  } catch (error) {
    return res.status(400).json({ message: error.message })
  }
})

router.delete('/windows/:userId/:invoiceNumber/items/:saleId', ...requireSessionOwner((req) => req.params.userId), (req, res) => {
  try {
    const invoice = removePendingSale(req.params.userId, req.params.invoiceNumber, req.params.saleId)
    return res.json(invoice)
  } catch (error) {
    return res.status(400).json({ message: error.message })
  }
})

router.post('/windows/:userId/:invoiceNumber/pay', ...requireSessionOwner((req) => req.params.userId), async (req, res) => {
  let invoice
  let paymentStarted = false

  try {
    await checkVendorSellingSchedule(req.params.userId)
    const startedAt = Date.now()
    invoice = getPendingInvoice(req.params.userId, req.params.invoiceNumber)
    invoice = beginPayment(req.params.userId, req.params.invoiceNumber)
    paymentStarted = true
    const raffleIds = [...new Set(invoice.sales.map((sale) => sale.id_rifa))]
    const localRafflesStartedAt = Date.now()
    let raffles = getCachedRaffleGameTimes(raffleIds)
    console.log(`[PAYMENT ${req.params.userId}/${req.params.invoiceNumber}] Validacion local ${Date.now() - localRafflesStartedAt}ms - ${raffles.length}/${raffleIds.length} rifas`)

    const supabase = ensureSupabaseConfigured()
    if (raffles.length !== raffleIds.length) {
      const fallbackStartedAt = Date.now()
      const { data, error: rafflesError } = await supabase
        .from('rifa')
        .select('id, fecha_hora_juego')
        .in('id', raffleIds)
      if (rafflesError) throw new Error(rafflesError.message)
      raffles = data || []
      console.log(`[PAYMENT ${req.params.userId}/${req.params.invoiceNumber}] Fallback Supabase rifas ${Date.now() - fallbackStartedAt}ms - ${raffles.length}/${raffleIds.length} rifas`)
    }

    if (raffles.length !== raffleIds.length) throw new Error('No se pudo validar la fecha de una de las rifas')

    const now = Date.now()
    const expiredRaffleIds = (raffles || [])
      .filter((raffle) => new Date(raffle.fecha_hora_juego).getTime() <= now)
      .map((raffle) => raffle.id)

    if (expiredRaffleIds.length > 0) {
      const released = releaseExpiredPendingSales(invoice.id, expiredRaffleIds)
      invoice = null
      throw new Error(`Se liberaron ${released} venta(s) porque la fecha y hora de juego ya paso`)
    }

    const rpcStartedAt = Date.now()
    const sales = invoice.sales.map((sale) => ({
      id_rifa: sale.id_rifa,
      numero: sale.numero,
      valor: sale.valor,
      cantidad: sale.cantidad,
    }))
    const { data, error } = await callRpcWithRetry(supabase, {
      p_id_usuario: invoice.id_usuario,
      p_numero_factura: invoice.numero_factura,
      p_ventas: sales,
    }, `${req.params.userId}/${req.params.invoiceNumber}`)

    if (error) throw new Error(error.message)
    console.log(`[PAYMENT ${req.params.userId}/${req.params.invoiceNumber}] RPC confirmar ventas ${Date.now() - rpcStartedAt}ms`)

    const completeStartedAt = Date.now()
    completePendingInvoice(invoice.id)
    void refreshWinnerCache().catch((refreshError) => console.error('[WINNERS-CACHE] Actualizacion asincrona fallida:', refreshError.message))
    console.log(`[PAYMENT ${req.params.userId}/${req.params.invoiceNumber}] Cierre local ${Date.now() - completeStartedAt}ms, total ${Date.now() - startedAt}ms`)
    return res.status(201).json(data[0])
  } catch (error) {
    console.error(`[PAYMENT ${req.params.userId}/${req.params.invoiceNumber}] Error: ${error.message}`, error.stack)
    if (paymentStarted && invoice) restorePendingInvoice(invoice.id)
    return res.status(400).json({ message: error.message })
  }
})

export default router