import Database from 'better-sqlite3'
import { mkdirSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const serviceDirectory = dirname(fileURLToPath(import.meta.url))
const databasePath = resolve(serviceDirectory, '../../data/pending-sales.db')
mkdirSync(dirname(databasePath), { recursive: true })

const database = new Database(databasePath)
database.pragma('journal_mode = WAL')

database.exec(`
  CREATE TABLE IF NOT EXISTS factura_pendiente (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    id_usuario INTEGER NOT NULL,
    numero_factura TEXT NOT NULL,
    estado TEXT NOT NULL DEFAULT 'abierta',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TEXT NOT NULL,
    UNIQUE (id_usuario, numero_factura)
  );

  CREATE TABLE IF NOT EXISTS numero_factura_asignado (
    id_usuario INTEGER NOT NULL,
    numero_factura TEXT NOT NULL,
    assigned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id_usuario, numero_factura)
  );

  CREATE TABLE IF NOT EXISTS venta_pendiente (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    id_ventana INTEGER,
    id_usuario INTEGER NOT NULL,
    id_rifa INTEGER NOT NULL,
    numero TEXT NOT NULL,
    valor REAL NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS rifa_cupo_cache (
    id_rifa INTEGER PRIMARY KEY,
    id_area INTEGER NOT NULL,
    id_tipo_rifa INTEGER NOT NULL,
    fecha_hora_juego TEXT NOT NULL,
    c_2digitos REAL NOT NULL,
    c_3digitos REAL NOT NULL,
    c_4digitos REAL NOT NULL,
    c_5digitos REAL NOT NULL,
    sincronizado_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS cupo_numero_local (
    id_rifa INTEGER NOT NULL,
    numero TEXT NOT NULL,
    cupo_maximo REAL NOT NULL,
    monto_confirmado REAL NOT NULL DEFAULT 0,
    monto_pendiente REAL NOT NULL DEFAULT 0,
    PRIMARY KEY (id_rifa, numero)
  );
`)

const saleColumns = database.prepare('PRAGMA table_info(venta_pendiente)').all().map((column) => column.name)
if (!saleColumns.includes('id_ventana')) database.exec('ALTER TABLE venta_pendiente ADD COLUMN id_ventana INTEGER')
if (!saleColumns.includes('cantidad')) database.exec('ALTER TABLE venta_pendiente ADD COLUMN cantidad INTEGER NOT NULL DEFAULT 1')

const quotaCacheColumns = database.prepare('PRAGMA table_info(rifa_cupo_cache)').all().map((column) => column.name)
if (!quotaCacheColumns.includes('fecha_hora_juego')) database.exec('ALTER TABLE rifa_cupo_cache ADD COLUMN fecha_hora_juego TEXT')

const normalizeUserId = (value) => {
  const userId = Number(value)
  if (!Number.isInteger(userId) || userId < 1) throw new Error('id_usuario es obligatorio')
  return userId
}

const normalizeInvoiceNumber = (value) => {
  const invoiceNumber = String(value || '').trim().toUpperCase()
  if (!/^[A-Z]\d{3,}$/.test(invoiceNumber)) throw new Error('numero_factura debe tener el formato A001')
  return invoiceNumber
}

const normalizeSaleNumber = (value) => {
  const number = String(value || '').trim()
  if (!/^\d{2,5}$/.test(number)) throw new Error('numero debe contener entre 2 y 5 digitos')
  return number
}

const getQuotaForNumber = (raffleId, number) => {
  const cache = database.prepare('SELECT * FROM rifa_cupo_cache WHERE id_rifa = ?').get(raffleId)
  if (!cache) throw new Error('Primero prepara los cupos locales de esta rifa')

  const quotaByLength = {
    2: cache.c_2digitos,
    3: cache.c_3digitos,
    4: cache.c_4digitos,
    5: cache.c_5digitos,
  }
  const quota = Number(quotaByLength[number.length])
  if (!Number.isFinite(quota) || quota <= 0) throw new Error(`No hay cupo configurado para numeros de ${number.length} digitos`)
  return quota
}

export const getCachedUnavailableNumbers = (raffleId) => {
  const cache = database.prepare('SELECT id_rifa FROM rifa_cupo_cache WHERE id_rifa = ?').get(Number(raffleId))
  return cache ? getUnavailableNumbers(raffleId) : null
}

export const getCachedRaffleGameTimes = (raffleIds) => {
  const normalizedIds = [...new Set((raffleIds || []).map(Number).filter((id) => Number.isInteger(id) && id > 0))]
  if (normalizedIds.length === 0) return []
  const placeholders = normalizedIds.map(() => '?').join(', ')
  return database
    .prepare(`SELECT id_rifa, fecha_hora_juego FROM rifa_cupo_cache WHERE id_rifa IN (${placeholders})`)
    .all(...normalizedIds)
}

export const initializeRaffleQuotaCache = ({ raffleId, areaId, raffleTypeId, gameTime, quotas, confirmedSales }) => {
  const normalizedRaffleId = Number(raffleId)
  if (!Number.isInteger(normalizedRaffleId) || normalizedRaffleId < 1) throw new Error('id_rifa es obligatorio')

  const existing = database.prepare('SELECT id_rifa, fecha_hora_juego FROM rifa_cupo_cache WHERE id_rifa = ?').get(normalizedRaffleId)
  if (existing) return getUnavailableNumbers(normalizedRaffleId)

  const gameDate = new Date(gameTime)
  if (Number.isNaN(gameDate.getTime())) throw new Error('La rifa no tiene una fecha de juego valida')
  const normalizedGameTime = gameDate.toISOString()

  const normalizedQuotas = {
    c_2digitos: Number(quotas.c_2digitos || 0),
    c_3digitos: Number(quotas.c_3digitos || 0),
    c_4digitos: Number(quotas.c_4digitos || 0),
    c_5digitos: Number(quotas.c_5digitos || 0),
  }

  database.transaction(() => {
    database.prepare(`
      INSERT INTO rifa_cupo_cache (id_rifa, id_area, id_tipo_rifa, fecha_hora_juego, c_2digitos, c_3digitos, c_4digitos, c_5digitos)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(normalizedRaffleId, Number(areaId), Number(raffleTypeId), normalizedGameTime, normalizedQuotas.c_2digitos, normalizedQuotas.c_3digitos, normalizedQuotas.c_4digitos, normalizedQuotas.c_5digitos)

    const insert = database.prepare(`
      INSERT INTO cupo_numero_local (id_rifa, numero, cupo_maximo, monto_confirmado)
      VALUES (?, ?, ?, ?)
    `)
    for (const sale of confirmedSales) {
      const number = normalizeSaleNumber(sale.numero)
      const quota = normalizedQuotas[`c_${number.length}digitos`]
      if (quota > 0) insert.run(normalizedRaffleId, number, quota, Number(sale.total || 0))
    }
  })()

  return getUnavailableNumbers(normalizedRaffleId)
}

export const getUnavailableNumbers = (raffleId) => {
  return database.prepare(`
    SELECT numero FROM cupo_numero_local
    WHERE id_rifa = ? AND monto_confirmado + monto_pendiente >= cupo_maximo
    ORDER BY numero ASC
  `).all(Number(raffleId)).map((row) => row.numero)
}

const releaseWindowReservations = (windowId) => {
  const sales = database.prepare('SELECT id_rifa, numero, valor, cantidad FROM venta_pendiente WHERE id_ventana = ?').all(windowId)
  const release = database.prepare(`
    UPDATE cupo_numero_local
    SET monto_pendiente = MAX(0, monto_pendiente - ?)
    WHERE id_rifa = ? AND numero = ?
  `)
  for (const sale of sales) release.run(sale.valor * sale.cantidad, sale.id_rifa, sale.numero)
}

const releaseSalesForRaffles = database.transaction((windowId, raffleIds) => {
  if (raffleIds.length === 0) return 0

  const placeholders = raffleIds.map(() => '?').join(', ')
  const sales = database
    .prepare(`SELECT id_rifa, numero, valor, cantidad FROM venta_pendiente WHERE id_ventana = ? AND id_rifa IN (${placeholders})`)
    .all(windowId, ...raffleIds)
  const release = database.prepare(`
    UPDATE cupo_numero_local
    SET monto_pendiente = MAX(0, monto_pendiente - ?)
    WHERE id_rifa = ? AND numero = ?
  `)
  for (const sale of sales) release.run(sale.valor * sale.cantidad, sale.id_rifa, sale.numero)
  database.prepare(`DELETE FROM venta_pendiente WHERE id_ventana = ? AND id_rifa IN (${placeholders})`).run(windowId, ...raffleIds)
  return sales.length
})

export const releaseExpiredPendingSales = (windowId, raffleIds) => releaseSalesForRaffles(windowId, raffleIds)

const cleanupStartedRaffleReservations = database.transaction(() => {
  const now = new Date().toISOString()
  const expiredSales = database.prepare(`
    SELECT venta_pendiente.id_ventana, venta_pendiente.id_rifa
    FROM venta_pendiente
    INNER JOIN rifa_cupo_cache ON rifa_cupo_cache.id_rifa = venta_pendiente.id_rifa
    WHERE rifa_cupo_cache.fecha_hora_juego IS NOT NULL
      AND rifa_cupo_cache.fecha_hora_juego <= ?
  `).all(now)

  const rafflesByWindow = new Map()
  for (const sale of expiredSales) {
    if (!rafflesByWindow.has(sale.id_ventana)) rafflesByWindow.set(sale.id_ventana, new Set())
    rafflesByWindow.get(sale.id_ventana).add(sale.id_rifa)
  }
  for (const [windowId, raffleIds] of rafflesByWindow) releaseSalesForRaffles(windowId, [...raffleIds])
  return expiredSales.length
})

const cleanupExpiredWindows = database.transaction(() => {
  cleanupStartedRaffleReservations()
  const expiredWindows = database.prepare('SELECT id FROM factura_pendiente WHERE expires_at <= ?').all(new Date().toISOString())
  if (expiredWindows.length === 0) return 0

  const windowIds = expiredWindows.map((window) => window.id)
  for (const windowId of windowIds) releaseWindowReservations(windowId)
  const placeholders = windowIds.map(() => '?').join(', ')
  database.prepare(`DELETE FROM venta_pendiente WHERE id_ventana IN (${placeholders})`).run(...windowIds)
  database.prepare(`DELETE FROM factura_pendiente WHERE id IN (${placeholders})`).run(...windowIds)
  return windowIds.length
})

const getWindow = (userId, invoiceNumber) => {
  cleanupExpiredWindows()
  const window = database
    .prepare('SELECT * FROM factura_pendiente WHERE id_usuario = ? AND numero_factura = ?')
    .get(userId, invoiceNumber)
  if (!window) throw new Error('La factura no existe o expiro')
  return window
}

const INVOICE_LETTERS = Array.from({ length: 26 }, (_, index) => String.fromCharCode(65 + index))

// Numeros aleatorios (no consecutivos). Se agota el nivel de digitos actual (A-Z x 001-999,
// luego A-Z x 0001-9999, etc.) antes de pasar al siguiente nivel con un digito mas.
const generateInvoiceNumber = (userId) => {
  for (let digits = 3; digits <= 6; digits += 1) {
    const maxNumber = 10 ** digits - 1
    const totalSlots = INVOICE_LETTERS.length * maxNumber
    const usedCount = database
      .prepare(`SELECT COUNT(*) AS count FROM numero_factura_asignado WHERE id_usuario = ? AND numero_factura GLOB ?`)
      .get(userId, `[A-Z]${'[0-9]'.repeat(digits)}`).count
    if (usedCount >= totalSlots) continue

    for (let attempt = 0; attempt < 30; attempt += 1) {
      const letter = INVOICE_LETTERS[Math.floor(Math.random() * INVOICE_LETTERS.length)]
      const number = 1 + Math.floor(Math.random() * maxNumber)
      const candidate = `${letter}${String(number).padStart(digits, '0')}`
      const used = database.prepare('SELECT 1 FROM numero_factura_asignado WHERE id_usuario = ? AND numero_factura = ?').get(userId, candidate)
      if (!used) return candidate
    }

    const usedSet = new Set(
      database
        .prepare('SELECT numero_factura FROM numero_factura_asignado WHERE id_usuario = ? AND numero_factura GLOB ?')
        .all(userId, `[A-Z]${'[0-9]'.repeat(digits)}`)
        .map((row) => row.numero_factura),
    )
    const remaining = []
    for (const letter of INVOICE_LETTERS) {
      for (let number = 1; number <= maxNumber; number += 1) {
        const candidate = `${letter}${String(number).padStart(digits, '0')}`
        if (!usedSet.has(candidate)) remaining.push(candidate)
      }
    }
    if (remaining.length > 0) return remaining[Math.floor(Math.random() * remaining.length)]
  }

  throw new Error('El usuario ya utilizo todas las facturas disponibles')
}

export const openSaleWindow = (value) => {
  const userId = normalizeUserId(value)

  return database.transaction(() => {
    cleanupExpiredWindows()
    const invoiceNumber = generateInvoiceNumber(userId)

    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()
    database.prepare('INSERT INTO numero_factura_asignado (id_usuario, numero_factura) VALUES (?, ?)').run(userId, invoiceNumber)
    database
      .prepare('INSERT INTO factura_pendiente (id_usuario, numero_factura, expires_at) VALUES (?, ?, ?)')
      .run(userId, invoiceNumber, expiresAt)

    return { id_usuario: userId, numero_factura: invoiceNumber, expires_at: expiresAt }
  })()
}

export const addPendingSales = ({ userId, raffleId, invoiceNumber, numbers, value, quantity }) => {
  const normalizedUserId = normalizeUserId(userId)
  const normalizedInvoiceNumber = normalizeInvoiceNumber(invoiceNumber)
  const normalizedRaffleId = Number(raffleId)
  const normalizedValue = Number(value)
  const normalizedQuantity = Number.isInteger(Number(quantity)) && Number(quantity) > 0 ? Number(quantity) : 1

  if (!Number.isInteger(normalizedRaffleId) || normalizedRaffleId < 1) throw new Error('id_rifa es obligatorio')
  if (!Array.isArray(numbers) || numbers.length === 0) throw new Error('numbers debe ser un arreglo no vacio')
  if (!Number.isFinite(normalizedValue) || normalizedValue < 0) throw new Error('valor debe ser un numero igual o mayor a cero')

  const window = getWindow(normalizedUserId, normalizedInvoiceNumber)
  if (window.estado !== 'abierta') throw new Error('La factura se esta procesando')

  const existingSale = database.prepare('SELECT id_rifa FROM venta_pendiente WHERE id_ventana = ? LIMIT 1').get(window.id)
  if (existingSale && existingSale.id_rifa !== normalizedRaffleId) {
    throw new Error('RIFA_DIFERENTE: Esta factura ya tiene numeros de otra rifa. No se pueden mezclar rifas distintas en la misma factura.')
  }

  const raffleCache = database.prepare('SELECT fecha_hora_juego FROM rifa_cupo_cache WHERE id_rifa = ?').get(normalizedRaffleId)
  if (!raffleCache) throw new Error('Primero prepara los cupos locales de esta rifa')
  if (raffleCache.fecha_hora_juego && raffleCache.fecha_hora_juego <= new Date().toISOString()) {
    throw new Error('La fecha y hora de juego ya paso; no se pueden apartar numeros')
  }

  const insert = database.prepare(`
    INSERT INTO venta_pendiente (id_ventana, id_usuario, id_rifa, numero, valor, cantidad)
    VALUES (@id_ventana, @id_usuario, @id_rifa, @numero, @valor, @cantidad)
  `)
  const reserve = database.prepare(`
    INSERT INTO cupo_numero_local (id_rifa, numero, cupo_maximo, monto_pendiente)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(id_rifa, numero) DO UPDATE SET monto_pendiente = monto_pendiente + excluded.monto_pendiente
  `)
  const currentQuota = database.prepare('SELECT cupo_maximo, monto_confirmado, monto_pendiente FROM cupo_numero_local WHERE id_rifa = ? AND numero = ?')

  return database.transaction(() => {
    return numbers.map((number) => {
      const normalizedNumber = normalizeSaleNumber(number)
      const quota = getQuotaForNumber(normalizedRaffleId, normalizedNumber)
      const current = currentQuota.get(normalizedRaffleId, normalizedNumber)
      const usedAmount = current ? Number(current.monto_confirmado) + Number(current.monto_pendiente) : 0
      const montoSolicitado = normalizedValue * normalizedQuantity
      if (usedAmount + montoSolicitado > quota) {
        const availableAmount = Math.max(0, quota - usedAmount)
        throw new Error(
          `El numero ${normalizedNumber} supera su cupo. Cupo total: ${quota.toFixed(2)}. ` +
          `Monto comprometido: ${usedAmount.toFixed(2)}. Puedes usar hasta: ${availableAmount.toFixed(2)}`,
        )
      }
      reserve.run(normalizedRaffleId, normalizedNumber, quota, montoSolicitado)
      const result = insert.run({
        id_ventana: window.id,
        id_usuario: normalizedUserId,
        id_rifa: normalizedRaffleId,
        numero: normalizedNumber,
        valor: normalizedValue,
        cantidad: normalizedQuantity,
      })
      return { id: Number(result.lastInsertRowid), numero: normalizedNumber, valor: normalizedValue, cantidad: normalizedQuantity }
    })
  })()
}

export const getPendingInvoice = (userId, invoiceNumber) => {
  const window = getWindow(normalizeUserId(userId), normalizeInvoiceNumber(invoiceNumber))
  const sales = database.prepare('SELECT * FROM venta_pendiente WHERE id_ventana = ? ORDER BY id ASC').all(window.id)
  const total = sales.reduce((sum, sale) => sum + sale.valor * sale.cantidad, 0)
  return { ...window, sales, total }
}

export const beginPayment = (userId, invoiceNumber) => {
  const invoice = getPendingInvoice(userId, invoiceNumber)
  if (invoice.estado !== 'abierta') throw new Error('La factura se esta procesando')
  if (invoice.sales.length === 0) throw new Error('La factura no tiene ventas pendientes')

  const result = database
    .prepare("UPDATE factura_pendiente SET estado = 'procesando' WHERE id = ? AND estado = 'abierta'")
    .run(invoice.id)
  if (result.changes !== 1) throw new Error('La factura se esta procesando')
  return invoice
}

export const restorePendingInvoice = (windowId) => {
  database.prepare("UPDATE factura_pendiente SET estado = 'abierta' WHERE id = ?").run(windowId)
}

export const completePendingInvoice = (windowId) => {
  database.transaction(() => {
    const sales = database.prepare('SELECT id_rifa, numero, valor, cantidad FROM venta_pendiente WHERE id_ventana = ?').all(windowId)
    const confirm = database.prepare(`
      UPDATE cupo_numero_local
      SET monto_pendiente = MAX(0, monto_pendiente - ?), monto_confirmado = monto_confirmado + ?
      WHERE id_rifa = ? AND numero = ?
    `)
    for (const sale of sales) {
      const monto = sale.valor * sale.cantidad
      confirm.run(monto, monto, sale.id_rifa, sale.numero)
    }
    database.prepare('DELETE FROM venta_pendiente WHERE id_ventana = ?').run(windowId)
    database.prepare('DELETE FROM factura_pendiente WHERE id = ?').run(windowId)
  })()
}

export const closeSaleWindow = (userId, invoiceNumber) => {
  const invoice = getPendingInvoice(userId, invoiceNumber)
  if (invoice.estado !== 'abierta') throw new Error('La factura se esta procesando')
  database.transaction(() => {
    releaseWindowReservations(invoice.id)
    database.prepare('DELETE FROM venta_pendiente WHERE id_ventana = ?').run(invoice.id)
    database.prepare('DELETE FROM factura_pendiente WHERE id = ?').run(invoice.id)
  })()
}

export const removePendingSale = (userId, invoiceNumber, saleId) => {
  const normalizedUserId = normalizeUserId(userId)
  const normalizedInvoiceNumber = normalizeInvoiceNumber(invoiceNumber)
  const normalizedSaleId = Number(saleId)
  if (!Number.isInteger(normalizedSaleId) || normalizedSaleId < 1) throw new Error('El id de la venta es invalido')

  const window = getWindow(normalizedUserId, normalizedInvoiceNumber)
  if (window.estado !== 'abierta') throw new Error('La factura se esta procesando')

  const sale = database.prepare('SELECT * FROM venta_pendiente WHERE id = ? AND id_ventana = ?').get(normalizedSaleId, window.id)
  if (!sale) throw new Error('La venta no existe en esta factura')

  database.transaction(() => {
    database.prepare(`
      UPDATE cupo_numero_local
      SET monto_pendiente = MAX(0, monto_pendiente - ?)
      WHERE id_rifa = ? AND numero = ?
    `).run(sale.valor * sale.cantidad, sale.id_rifa, sale.numero)
    database.prepare('DELETE FROM venta_pendiente WHERE id = ?').run(normalizedSaleId)
  })()

  return getPendingInvoice(normalizedUserId, normalizedInvoiceNumber)
}

setInterval(cleanupExpiredWindows, 60 * 1000).unref()