import express from 'express'
import { createRaffle, createSale, deleteRaffle, getRaffleById, getRaffles, updateRaffle } from '../services/raffleService.js'
import { ensureSupabaseConfigured } from '../config/supabase.js'
import { requireSessionOwner } from '../middleware/requireSession.js'

const router = express.Router()

router.get('/', async (req, res) => {
  try {
    const raffles = await getRaffles()
    res.json(raffles)
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener rifas', error: error.message })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const raffle = await getRaffleById(req.params.id)
    if (!raffle) {
      return res.status(404).json({ message: 'Rifa no encontrada' })
    }
    return res.json(raffle)
  } catch (error) {
    return res.status(500).json({ message: 'Error al buscar la rifa', error: error.message })
  }
})

router.get('/:id/unavailable-numbers', async (req, res) => {
  try {
    const supabase = ensureSupabaseConfigured()
    const { data, error } = await supabase
      .from('venta')
      .select('numero')
      .eq('id_rifa', req.params.id)
      .eq('eliminada', false)
      .order('numero', { ascending: true })

    if (error) throw new Error(error.message)
    return res.json((data || []).map((sale) => sale.numero))
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
})

router.post('/', async (req, res) => {
  try {
    const raffle = await createRaffle(req.body)
    res.status(201).json(raffle)
  } catch (error) {
    res.status(500).json({ message: 'Error al crear la rifa', error: error.message })
  }
})

router.patch('/:id', async (req, res) => {
  try {
    const raffle = await updateRaffle(req.params.id, req.body || {})
    if (!raffle) {
      return res.status(404).json({ message: 'Rifa no encontrada' })
    }
    return res.json(raffle)
  } catch (error) {
    return res.status(400).json({ message: error.message })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    const raffle = await deleteRaffle(req.params.id)
    if (!raffle) return res.status(404).json({ message: 'Rifa no encontrada' })

    return res.json({ ok: true, raffle })
  } catch (error) {
    return res.status(400).json({ message: error.message })
  }
})

router.post('/:id/sales', ...requireSessionOwner((req) => req.body.id_usuario ?? req.body.userId), async (req, res) => {
  try {
    const sale = await createSale({
      raffleId: req.params.id,
      userId: req.body.id_usuario ?? req.body.userId,
      invoiceNumber: req.body.numero_factura ?? req.body.invoiceNumber,
      numbers: req.body.numbers,
      value: req.body.valor ?? req.body.value,
      quantity: req.body.cantidad ?? req.body.quantity,
    })
    res.status(201).json(sale)
  } catch (error) {
    res.status(400).json({ message: error.message })
  }
})

export default router
