import express from 'express'
import { getAllAssignments, getAssignedVendors, getSupervisorDashboard, getSupervisors, setAssignedVendors } from '../services/supervisorService.js'

const router = express.Router()

router.get('/', async (req, res) => {
  try {
    const supervisors = await getSupervisors()
    return res.json(supervisors)
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
})

router.get('/assignments', async (req, res) => {
  try {
    const assignments = await getAllAssignments()
    return res.json(assignments)
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
})

router.get('/:id/dashboard', async (req, res) => {
  try {
    const supervisorId = Number(req.params.id)
    if (!Number.isInteger(supervisorId) || supervisorId < 1) return res.status(400).json({ message: 'id invalido' })
    return res.json(await getSupervisorDashboard(supervisorId, req.query.dateFrom, req.query.dateTo))
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
})

router.get('/:id/vendors', async (req, res) => {
  try {
    const supervisorId = Number(req.params.id)
    if (!Number.isInteger(supervisorId) || supervisorId < 1) return res.status(400).json({ message: 'id invalido' })
    const vendors = await getAssignedVendors(supervisorId)
    return res.json(vendors)
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
})

router.put('/:id/vendors', async (req, res) => {
  try {
    const supervisorId = Number(req.params.id)
    if (!Number.isInteger(supervisorId) || supervisorId < 1) return res.status(400).json({ message: 'id invalido' })
    const vendorIds = Array.isArray(req.body?.vendorIds) ? req.body.vendorIds.map(Number).filter((id) => Number.isInteger(id) && id > 0) : []
    const vendors = await setAssignedVendors(supervisorId, vendorIds)
    return res.json(vendors)
  } catch (error) {
    return res.status(400).json({ message: error.message })
  }
})

export default router
