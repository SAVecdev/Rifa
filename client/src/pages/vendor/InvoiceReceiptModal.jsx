import { useEffect, useState } from 'react'

const formatMoney = (value) => new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  minimumFractionDigits: 2,
}).format(Number(value || 0))
const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000'

const defaultSettings = {
  nombre_empresa: 'Rifa POS',
  mensaje_encabezado: 'Gracias por participar',
  mensaje_pie: 'Conserve esta factura',
  tipo_letra: 'Arial',
  tamano_letra: 12,
  color_primario: '#000000',
  color_secundario: '#FFFFFF',
  modelo_factura: 'clasica',
  mostrar_logo: true,
  mostrar_premios: true,
  orden_premios: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
}

const maskValue = (value) => {
  const text = String(value || '')
  if (text.length <= 2) return '*'.repeat(text.length)
  return `${text.slice(0, 1)}${'*'.repeat(text.length - 2)}${text.slice(-1)}`
}

const withSeparators = (items) => items.flatMap((item, index) => index === 0 ? [item] : [<hr key={`sep-${index}`} />, item])

function InvoiceReceiptModal({ invoice, settings, onDelete, onClose, isOriginal = false }) {
  const [isReprinting, setIsReprinting] = useState(false)
  const config = { ...defaultSettings, ...(settings || {}) }
  const visibleInvoiceNumber = !isOriginal ? maskValue(invoice.numero_factura) : invoice.numero_factura
  const rawLevels = config.mostrar_premios ? config.orden_premios : []
  const visibleLevels = Array.isArray(rawLevels)
    ? rawLevels
    : typeof rawLevels === 'string'
      ? (() => { try { return JSON.parse(rawLevels) } catch { return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] } })()
      : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
  const logoUrl = invoice.logo_ruta?.startsWith('http') ? invoice.logo_ruta : invoice.logo_ruta ? `${apiUrl}${invoice.logo_ruta}` : null
  const groupedSales = invoice.ventas.reduce((groups, sale) => {
    const key = `${sale.rifa?.nombre || 'Rifa'}:${sale.valor}`
    if (!groups.has(key)) groups.set(key, { ...sale, numeros: [], cantidad: 0, total: 0 })
    const group = groups.get(key)
    group.numeros.push(sale.numero)
    group.cantidad += sale.cantidad
    group.total += Number(sale.total)
    return groups
  }, new Map())

  // Agrupar ventas por valor (saldo de apuesta) y cantidad de digitos para mostrar cuadros de premios adecuados
  const prizeGroupedSales = invoice.ventas.reduce((groups, sale) => {
    const digits = String(sale.numero || '').trim().length
    const key = `${sale.valor}:${digits}:${sale.rifa?.id_tipo || sale.rifa?.id || ''}`
    if (!groups.has(key)) groups.set(key, sale)
    return groups
  }, new Map())

  const header = (
    <>
      <div className="invoice-receipt-header">
        {config.mostrar_logo && (logoUrl ? <img className="invoice-receipt-logo-image" src={logoUrl} alt="Logo" /> : <div className="invoice-receipt-logo">R</div>)}
        <div className="invoice-receipt-header-details">
          <strong>{config.nombre_empresa || invoice.usuario?.nombre || 'Rifa POS'}</strong>
          {config.identificacion_empresa && <span>{config.identificacion_empresa}</span>}
          {config.telefono_empresa && <span>{config.telefono_empresa}</span>}
          {config.direccion_empresa && <span>{config.direccion_empresa}</span>}
        </div>
      </div>
      <span>{config.mensaje_encabezado}</span>
      <hr />
      <strong>Factura {visibleInvoiceNumber}</strong>
      <span>{new Date(invoice.created_at).toLocaleString('es-CO')}</span>
    </>
  )

  const prizeTable = (sale, compact = false) => {
    if (visibleLevels.length === 0) return null
    const targetSale = sale || invoice.ventas[0] || {}
    const rows = Math.ceil(visibleLevels.length / 2)
    return (
      <table>
        <tbody>
          {Array.from({ length: rows }, (_, rowIndex) => (
            <tr key={rowIndex}>
              {visibleLevels.slice(rowIndex * 2, rowIndex * 2 + 2).flatMap((level) => {
                const prizeVal = targetSale[`premio_${String(level).padStart(2, '0')}`]
                return [
                  <td key={`label-${level}`}>{compact ? `P${level}` : `${level}er.`}</td>,
                  <td key={`value-${level}`}>{formatMoney(prizeVal || 0)}</td>,
                ]
              })}
            </tr>
          ))}
        </tbody>
      </table>
    )
  }
  const quantityLine = (sale) => <>X{sale.cantidad} {formatMoney(sale.valor)} = {formatMoney(sale.total)}</>

  const modelKey = String(config.modelo_factura || 'clasica').trim().toLowerCase()
  const contentMap = {
    clasica: (
      <div className="invoice-model-clasica">
        {withSeparators(invoice.ventas.map((sale) => (
          <section key={sale.id} className="invoice-receipt-sale">
            <strong>{sale.rifa?.nombre || 'Rifa'} · #{sale.numero}</strong>
            <span>{quantityLine(sale)}</span>
            {prizeTable(sale, false)}
          </section>
        )))}
      </div>
    ),
    compacta: (
      <div className="invoice-model-compacta">
        {invoice.ventas.map((sale) => (
          <div key={sale.id} className="invoice-line">
            <span>{sale.rifa?.nombre || 'Rifa'} #{sale.numero}</span>
            <strong>{quantityLine(sale)}</strong>
          </div>
        ))}
        <hr />
        {[...prizeGroupedSales.values()].map((sampleSale, idx) => (
          <div key={idx} style={{ marginTop: idx > 0 ? '4px' : '0' }}>
            {prizeGroupedSales.size > 1 && (
              <small style={{ display: 'block', fontSize: '0.75em', fontWeight: 'bold', textAlign: 'center' }}>
                Premios para apuesta de {formatMoney(sampleSale.valor)} ({String(sampleSale.numero || '').trim().length} digitos):
              </small>
            )}
            {prizeTable(sampleSale, true)}
          </div>
        ))}
      </div>
    ),
    agrupada: (
      <div className="invoice-model-agrupada">
        {withSeparators([...groupedSales.values()].map((group, idx) => (
          <div key={idx} className="invoice-group">
            <strong>{group.rifa?.nombre || 'Rifa'} · {quantityLine(group)}</strong>
            <span>{group.numeros.join(', ')}</span>
            {prizeTable(group, true)}
          </div>
        )))}
      </div>
    ),
    resumen: (
      <div className="invoice-model-resumen">
        <section className="invoice-receipt-sale">
          <strong>Premios activos</strong>
          {[...prizeGroupedSales.values()].map((sampleSale, idx) => (
            <div key={idx} style={{ marginTop: idx > 0 ? '4px' : '0' }}>
              {prizeGroupedSales.size > 1 && (
                <small style={{ display: 'block', fontSize: '0.75em', fontWeight: 'bold', textAlign: 'center' }}>
                  Apuesta {formatMoney(sampleSale.valor)} ({String(sampleSale.numero || '').trim().length} digitos):
                </small>
              )}
              {prizeTable(sampleSale, true)}
            </div>
          ))}
        </section>
        <hr />
        <span>{invoice.ventas.reduce((sum, s) => sum + Number(s.cantidad || 1), 0)} numeros · {invoice.ventas.length} apuestas</span>
      </div>
    ),
  }
  const content = contentMap[modelKey] || contentMap.clasica

  useEffect(() => {
    if (!isReprinting) return undefined
    const handleAfterPrint = () => setIsReprinting(false)
    window.addEventListener('afterprint', handleAfterPrint)
    return () => window.removeEventListener('afterprint', handleAfterPrint)
  }, [isReprinting])

  const handlePrint = () => {
    setIsReprinting(true)
    window.setTimeout(() => window.print(), 0)
  }

  return (
    <div className="modal-overlay invoice-receipt-overlay" onClick={onClose}>
      <div className="modal-card invoice-receipt-modal" role="dialog" aria-modal="true" aria-label="Factura" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header no-print"><div><p className="eyebrow">{isOriginal ? 'Factura confirmada' : 'Reimpresion de factura (Censurada)'} · Modelo {config.modelo_factura}</p><h2>{visibleInvoiceNumber}</h2></div><button type="button" className="close-btn" onClick={onClose} aria-label="Cerrar">×</button></div>
        <article className="invoice-receipt" style={{ fontFamily: config.tipo_letra, fontSize: `${config.tamano_letra}px`, color: config.color_primario, backgroundColor: config.color_secundario }}>
          {header}
          <div className={`invoice-model invoice-model--${config.modelo_factura}`}>{content}</div>
          <hr />
          <strong>Total: {formatMoney(invoice.total)}</strong>
          <div className="invoice-receipt-meta"><span>Factura: {visibleInvoiceNumber}</span><span>Fecha: {new Date(invoice.created_at).toLocaleString('es-CO')}</span><span>ID: {invoice.id}</span></div>
          <span>{config.mensaje_pie}</span>
        </article>
        <div className="invoice-receipt-actions no-print"><button className="btn btn-primary" type="button" onClick={handlePrint} disabled={isReprinting}>{isReprinting ? 'Preparando impresion...' : isOriginal ? 'Imprimir factura' : 'Reimprimir factura'}</button>{onDelete && <button className="btn btn-danger" type="button" onClick={onDelete}>Eliminar factura</button>}<button className="btn btn-ghost" type="button" onClick={onClose}>Cerrar</button></div>
      </div>
    </div>
  )
}

export default InvoiceReceiptModal