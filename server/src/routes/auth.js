import express from 'express'
import crypto from 'crypto'
import { createSession, createUser, getUserById, getUsers, loginUser } from '../services/authService.js'

const router = express.Router()

const generateToken = () => crypto.randomBytes(32).toString('hex')

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {}
    const user = await loginUser({ email, password })
    const token = generateToken()

    await createSession({
      userId: user.id,
      token,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    })

    return res.json({
      token,
      user: {
        id: user.id,
        nombre: user.nombre,
        correo: user.correo,
        rol: user.rol,
        activo: user.activo,
      },
    })
  } catch (error) {
    return res.status(401).json({ message: error.message })
  }
})

router.post('/register', async (req, res) => {
  try {
    const { nombre, correo, password, rol, direccion, telefono, id_area } = req.body || {}

    if (!nombre || !correo || !password) {
      return res.status(400).json({ message: 'Nombre, correo y contraseña son obligatorios' })
    }

    const user = await createUser({
      nombre,
      correo,
      password,
      rol: rol || 'cliente',
      direccion,
      telefono,
      id_area,
    })

    return res.status(201).json({ user })
  } catch (error) {
    return res.status(400).json({ message: error.message })
  }
})

router.get('/users', async (req, res) => {
  try {
    const users = await getUsers()
    return res.json(users)
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
})

router.get('/users/:id', async (req, res) => {
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

export default router
