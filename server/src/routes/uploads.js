import crypto from 'crypto'
import express from 'express'
import { mkdirSync, readdirSync } from 'fs'
import multer from 'multer'
import { dirname, extname, resolve } from 'path'
import { fileURLToPath } from 'url'

const router = express.Router()
const routesDirectory = dirname(fileURLToPath(import.meta.url))
export const profilesDirectory = resolve(routesDirectory, '../../uploads/profiles')
mkdirSync(profilesDirectory, { recursive: true })

const storage = multer.diskStorage({
  destination: profilesDirectory,
  filename: (req, file, callback) => {
    callback(null, `${crypto.randomUUID()}${extname(file.originalname).toLowerCase()}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    callback(null, file.mimetype.startsWith('image/'))
  },
})

const toProfilePhoto = (name) => ({ name, url: `/uploads/profiles/${name}` })

router.get('/profile-photos', (req, res) => {
  try {
    const photos = readdirSync(profilesDirectory)
      .filter((name) => /\.(avif|gif|jpe?g|png|webp)$/i.test(name))
      .sort()
      .reverse()
      .map(toProfilePhoto)

    return res.json(photos)
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
})

router.post('/profile-photos', (req, res) => {
  upload.single('photo')(req, res, (error) => {
    if (error) return res.status(400).json({ message: error.message })
    if (!req.file) return res.status(400).json({ message: 'Selecciona un archivo de imagen' })

    return res.status(201).json(toProfilePhoto(req.file.filename))
  })
})

export default router