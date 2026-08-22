import express from 'express'
import { ensureSupabaseConfigured } from '../config/supabase.js'

const removeImmutableFields = (body, primaryKeys) => {
  const payload = { ...body }

  for (const field of [...primaryKeys, 'created_at', 'updated_at']) {
    delete payload[field]
  }

  return payload
}

export const createResourceRouter = ({ table, primaryKeys = ['id'], orderBy = 'id' }) => {
  const router = express.Router()
  const routeParams = primaryKeys.map((key) => `:${key}`).join('/')

  const applyPrimaryKeyFilters = (query, params) => {
    return primaryKeys.reduce((filteredQuery, key) => filteredQuery.eq(key, params[key]), query)
  }

  router.get('/', async (req, res) => {
    try {
      const supabase = ensureSupabaseConfigured()
      const { data, error } = await supabase.from(table).select('*').order(orderBy, { ascending: false })

      if (error) throw new Error(error.message)
      return res.json(data)
    } catch (error) {
      return res.status(500).json({ message: error.message })
    }
  })

  router.get(`/${routeParams}`, async (req, res) => {
    try {
      const supabase = ensureSupabaseConfigured()
      const { data, error } = await applyPrimaryKeyFilters(supabase.from(table).select('*'), req.params).maybeSingle()

      if (error && error.code !== 'PGRST116') throw new Error(error.message)
      if (!data) return res.status(404).json({ message: 'Registro no encontrado' })

      return res.json(data)
    } catch (error) {
      return res.status(500).json({ message: error.message })
    }
  })

  router.post('/', async (req, res) => {
    try {
      const supabase = ensureSupabaseConfigured()
      const insertPrimaryKeys = primaryKeys.length === 1 && primaryKeys[0] === 'id' ? primaryKeys : []
      const payload = removeImmutableFields(req.body || {}, insertPrimaryKeys)
      const { data, error } = await supabase.from(table).insert(payload).select().single()

      if (error) throw new Error(error.message)
      return res.status(201).json(data)
    } catch (error) {
      return res.status(400).json({ message: error.message })
    }
  })

  router.patch(`/${routeParams}`, async (req, res) => {
    try {
      const payload = removeImmutableFields(req.body || {}, primaryKeys)
      if (Object.keys(payload).length === 0) {
        return res.status(400).json({ message: 'Envia al menos un campo para actualizar' })
      }

      const supabase = ensureSupabaseConfigured()
      const { data, error } = await applyPrimaryKeyFilters(supabase.from(table).update(payload), req.params)
        .select()
        .maybeSingle()

      if (error) throw new Error(error.message)
      if (!data) return res.status(404).json({ message: 'Registro no encontrado' })

      return res.json(data)
    } catch (error) {
      return res.status(400).json({ message: error.message })
    }
  })

  return router
}