import express from 'express'
import { createUser, deleteUser, getUserById, getUsers, updateUser } from '../services/authService.js'

const router = express.Router()

router.get('/', async (req, res) => {
  try {
    const users = await getUsers()
    return res.json(users)
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const user = await getUserById(req.params.id)
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' })
    }
    return res.json(user)
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
})

router.post('/', async (req, res) => {
  try {
    const user = await createUser(req.body)
    return res.status(201).json(user)
  } catch (error) {
    return res.status(400).json({ message: error.message })
  }
})

router.patch('/:id', async (req, res) => {
  try {
    const user = await updateUser(req.params.id, req.body || {})
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' })

    return res.json(user)
  } catch (error) {
    return res.status(400).json({ message: error.message })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    const user = await deleteUser(req.params.id)
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' })

    return res.json({ ok: true, user })
  } catch (error) {
    return res.status(400).json({ message: error.message })
  }
})

export default router
