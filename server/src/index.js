import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import raffleRoutes from './routes/raffles.js'
import authRoutes from './routes/auth.js'
import usersRoutes from './routes/users.js'
import sessionsRoutes from './routes/sessions.js'
import securityRoutes from './routes/security.js'
import areasRoutes from './routes/areas.js'
import raffleAreaQuotasRoutes from './routes/raffleAreaQuotas.js'
import raffleTypesRoutes from './routes/raffleTypes.js'
import pendingSalesRoutes from './routes/pendingSales.js'
import adminRoutes from './routes/admin.js'
import uploadsRoutes, { profilesDirectory } from './routes/uploads.js'
import imagesRoutes from './routes/images.js'
import raffleLogosRoutes from './routes/raffleLogos.js'
import winningNumbersRoutes from './routes/winningNumbers.js'
import invoicesRoutes from './routes/invoices.js'
import vendorRoutes from './routes/vendor.js'
import prizeOptionsRoutes from './routes/prizeOptions.js'
import invoiceSettingsRoutes from './routes/invoiceSettings.js'
import supervisorsRoutes from './routes/supervisors.js'
import reportsRoutes from './routes/reports.js'
import raffleTypeAreasRoutes from './routes/raffleTypeAreas.js'
import { createResourceRouter } from './routes/resourceRoutes.js'
import { ensureSupabaseConfigured } from './config/supabase.js'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 4000
let requestSequence = 0

app.set('trust proxy', true)
app.use(cors())
app.use(express.json())
app.use((req, res, next) => {
  const requestId = ++requestSequence
  const startedAt = Date.now()
  req.requestId = requestId
  if (req.path.startsWith('/api/')) res.set('Cache-Control', 'no-store')
  res.on('finish', () => {
    const duration = Date.now() - startedAt
    console.log(`[HTTP ${requestId}] ${req.method} ${req.originalUrl} -> ${res.statusCode} ${duration}ms`)
  })
  next()
})
app.use('/uploads', express.static(profilesDirectory.replace(/profiles$/, '')))

app.get('/api/health', (req, res) => {
  res.json({ ok: true, message: 'Rifa POS API funcionando con Supabase' })
})

app.use('/api/auth', authRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/vendors', vendorRoutes)
app.use('/api/uploads', uploadsRoutes)
app.use('/api/users', usersRoutes)
app.use('/api/sessions', sessionsRoutes)
app.use('/api/security', securityRoutes)
app.use('/api/areas', areasRoutes)
app.use('/api/raffle-area-quotas', raffleAreaQuotasRoutes)
app.use('/api/raffle-types', raffleTypesRoutes)
app.use('/api/raffle-type-areas', raffleTypeAreasRoutes)
app.use('/api/raffles', raffleRoutes)
app.use('/api/sales', pendingSalesRoutes)
app.use('/api/images', imagesRoutes)
app.use('/api/invoices', invoicesRoutes)
app.use('/api/invoice-settings', invoiceSettingsRoutes)
app.use('/api/winning-numbers', winningNumbersRoutes)
app.use('/api/winners', createResourceRouter({ table: 'ganadores', orderBy: 'created_at' }))
app.use('/api/prize-options', prizeOptionsRoutes)
app.use('/api/supervisors', supervisorsRoutes)
app.use('/api/reports', reportsRoutes)
app.use('/api/transactions', createResourceRouter({ table: 'transacciones', orderBy: 'fecha' }))
app.use('/api/daily-statistics', createResourceRouter({
  table: 'estadisticas_diarias',
  primaryKeys: ['fecha', 'id_usuario'],
  orderBy: 'fecha',
}))
app.use('/api/raffle-logos', raffleLogosRoutes)

const startServer = async () => {
  try {
    ensureSupabaseConfigured()
    app.listen(PORT, () => {
      console.log(`Servidor escuchando en http://localhost:${PORT}`)
    })
  } catch (error) {
    console.error('No se pudo iniciar la API:', error.message)
    process.exit(1)
  }
}

startServer()
