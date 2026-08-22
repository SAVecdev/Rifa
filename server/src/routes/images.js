import crypto from 'crypto'
import express from 'express'
import { existsSync, mkdirSync, unlinkSync } from 'fs'
import multer from 'multer'
import { dirname, extname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { ensureSupabaseConfigured } from '../config/supabase.js'

const router = express.Router()
const routesDirectory = dirname(fileURLToPath(import.meta.url))
const imagesDirectory = resolve(routesDirectory, '../../uploads/images')
const imagesCacheTtl = 30 * 1000
let imagesCache = null
let imagesCacheExpiresAt = 0
let imagesLoading = null
mkdirSync(imagesDirectory, { recursive: true })

const storage = multer.diskStorage({
  destination: imagesDirectory,
  filename: (req, file, callback) => {
    callback(null, `${crypto.randomUUID()}${extname(file.originalname).toLowerCase()}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, callback) => callback(null, file.mimetype.startsWith('image/')),
})

const deleteLocalImage = (ruta) => {
  const fileName = String(ruta || '').replace('/uploads/images/', '')
  const filePath = resolve(imagesDirectory, fileName)
  if (ruta?.startsWith('/uploads/images/') && existsSync(filePath)) unlinkSync(filePath)
}

router.get('/', async (req, res) => {
  try {
    if (imagesCache && imagesCacheExpiresAt > Date.now()) return res.json(imagesCache)

    if (!imagesLoading) {
      imagesLoading = (async () => {
        const supabase = ensureSupabaseConfigured()
        const queryStartedAt = Date.now()
        const { data, error } = await supabase.from('imagenes').select('id, nombre, ruta, created_at').order('created_at', { ascending: false })
        if (error) throw new Error(error.message)
        imagesCache = data || []
        imagesCacheExpiresAt = Date.now() + imagesCacheTtl
        console.log(`[IMAGES] Consulta Supabase ${Date.now() - queryStartedAt}ms - ${imagesCache.length} imagenes`)
        return imagesCache
      })().finally(() => { imagesLoading = null })
    }

    return res.json(await imagesLoading)
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
})

router.post('/', (req, res) => {
  upload.single('image')(req, res, async (uploadError) => {
    if (uploadError) return res.status(400).json({ message: uploadError.message })
    if (!req.file) return res.status(400).json({ message: 'Selecciona un archivo de imagen' })

    const ruta = `/uploads/images/${req.file.filename}`
    const nombre = String(req.body.nombre || req.file.originalname).trim()

    try {
      const supabase = ensureSupabaseConfigured()
      const { data, error } = await supabase.from('imagenes').insert({ nombre, ruta }).select().single()

      if (error) throw new Error(error.message)
      imagesCache = null
      imagesCacheExpiresAt = 0
      return res.status(201).json(data)
    } catch (error) {
      deleteLocalImage(ruta)
      return res.status(400).json({ message: error.message })
    }
  })
})

router.patch('/:id', async (req, res) => {
  try {
    const { nombre } = req.body || {}
    if (!nombre?.trim()) return res.status(400).json({ message: 'nombre es obligatorio' })

    const supabase = ensureSupabaseConfigured()
    const { data, error } = await supabase
      .from('imagenes')
      .update({ nombre: nombre.trim() })
      .eq('id', req.params.id)
      .select()
      .maybeSingle()

    if (error) throw new Error(error.message)
    if (!data) return res.status(404).json({ message: 'Imagen no encontrada' })
    imagesCache = null
    imagesCacheExpiresAt = 0
    return res.json(data)
  } catch (error) {
    return res.status(400).json({ message: error.message })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    const supabase = ensureSupabaseConfigured()
    const { data, error } = await supabase.from('imagenes').delete().eq('id', req.params.id).select().maybeSingle()

    if (error) throw new Error(error.message)
    if (!data) return res.status(404).json({ message: 'Imagen no encontrada' })

    deleteLocalImage(data.ruta)
    imagesCache = null
    imagesCacheExpiresAt = 0
    return res.json({ ok: true, image: data })
  } catch (error) {
    return res.status(400).json({ message: error.message })
  }
})

export default router