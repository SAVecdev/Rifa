import { useEffect, useState } from 'react'

const defaultFormatMoney = (value) => new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
}).format(Number(value || 0))

const maskInvoiceNumberValue = (value) => {
  const text = String(value || '')
  return text.length > 2 ? `${text.slice(0, 1)}${'*'.repeat(text.length - 2)}${text.slice(-1)}` : '**'
}

const PAGE_SIZE = 5

function InvoiceDetailView({ invoice, onPayNumber, onPayAll, payingId, formatMoney = defaultFormatMoney, maskInvoiceNumber = false, maskInvoiceId = false }) {
  const sales = invoice.ventas || []
  const anyActive = sales.some((sale) => !sale.eliminada && sale.activo)
  const anyPremio = sales.some((sale) => Number(sale.premio_total) > 0)
  const anyPending = sales.some((sale) => !invoice.eliminada && !sale.eliminada && sale.activo && Number(sale.premio_total) > 0 && !sale.premio_pagado)
  const estadoLabel = invoice.eliminada ? 'Eliminada' : anyActive ? 'Activa' : 'Inactiva'
  const raffleTypeName = sales[0]?.rifa?.tipo_rifa?.nombre || sales[0]?.rifa?.nombre || '-'
  const totalNumeros = sales.reduce((sum, sale) => sum + Number(sale.cantidad || 0), 0)
  const [page, setPage] = useState(1)
  useEffect(() => { setPage(1) }, [invoice.id])
  const totalPages = Math.max(1, Math.ceil(sales.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pagedSales = sales.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  return (
    <div className="invoice-detail-view">
      <section className="invoice-detail-card">
        <h3>📋 Informacion de la Factura</h3>
        <div className="invoice-detail-grid">
          <div><span>ID Factura</span><strong>{maskInvoiceId ? maskInvoiceNumberValue(invoice.id) : invoice.id}</strong></div>
          <div><span>Numero Factura</span><strong>#{maskInvoiceNumber ? maskInvoiceNumberValue(invoice.numero_factura) : invoice.numero_factura}</strong></div>
          <div><span>Vendedor</span><strong>{invoice.usuario?.nombre || '-'}</strong></div>
          <div><span>Fecha Emision</span><strong>{new Date(invoice.created_at).toLocaleString('es-CO', { dateStyle: 'long', timeStyle: 'short' })}</strong></div>
          <div><span>Tipo Rifa</span><strong className="invoice-detail-chip">{raffleTypeName}</strong></div>
          <div><span>Total Numeros</span><strong>{totalNumeros}</strong></div>
          <div><span>Monto Total</span><strong className="invoice-detail-money">{formatMoney(invoice.total)}</strong></div>
          <div><span>Estado</span><strong className={`invoice-detail-status ${anyActive && !invoice.eliminada ? 'is-active' : 'is-inactive'}`}>{estadoLabel}{!anyPremio && ' (Sin Premio)'}</strong></div>
        </div>
      </section>

      <section className="invoice-detail-card">
        <div className="invoice-detail-card-header">
          <h3>🗂️ Numeros Vendidos</h3>
          {onPayAll && anyPending && <button className="btn btn-primary" type="button" disabled={payingId === 'all'} onClick={onPayAll}>{payingId === 'all' ? 'Pagando todo...' : 'Pagar todos los premios'}</button>}
        </div>
        <div className="invoice-detail-table-wrap">
          <table className="invoice-detail-table">
            <thead><tr><th>N°</th><th>ID Venta</th><th>Numero</th><th>Cantidad</th><th>Valor</th><th>Total</th><th>Premio</th><th>Estado</th><th /></tr></thead>
            <tbody>
              {pagedSales.map((sale, index) => {
                const canPay = !invoice.eliminada && !sale.eliminada && sale.activo && Number(sale.premio_total) > 0 && !sale.premio_pagado
                return (
                  <tr key={sale.id}>
                    <td>{(currentPage - 1) * PAGE_SIZE + index + 1}</td>
                    <td>#{sale.id}</td>
                    <td><span className="invoice-detail-number">{sale.numero}</span></td>
                    <td>{sale.cantidad}</td>
                    <td>{formatMoney(sale.valor)}</td>
                    <td>{formatMoney(sale.total)}</td>
                    <td>{Number(sale.premio_total) > 0 ? formatMoney(sale.premio_total) : <span className="invoice-detail-note">Sin premio</span>}</td>
                    <td><span className={`invoice-detail-badge ${sale.eliminada ? 'is-deleted' : sale.activo ? 'is-active' : 'is-inactive'}`}>{sale.eliminada ? 'Eliminada' : sale.activo ? 'Activa' : 'Inactiva'}</span></td>
                    <td>
                      {Number(sale.premio_total) > 0 && (
                        sale.premio_pagado
                          ? <span className="invoice-detail-note">Pagado</span>
                          : canPay && onPayNumber
                            ? <button className="btn btn-primary" type="button" disabled={payingId === sale.id} onClick={() => onPayNumber(sale)}>{payingId === sale.id ? 'Pagando...' : 'Pagar'}</button>
                            : <span className="invoice-detail-note">{invoice.eliminada || sale.eliminada ? 'Venta eliminada' : canPay ? 'Pendiente' : 'Plazo vencido (8 dias)'}</span>
                      )}
                    </td>
                  </tr>
                )
              })}
              {sales.length === 0 && <tr><td colSpan="9" className="invoice-detail-empty">Sin numeros vendidos</td></tr>}
            </tbody>
            <tfoot><tr><td colSpan="5" /><td><strong>Total Premios:</strong></td><td><strong>{formatMoney(sales.reduce((sum, sale) => sum + Number(sale.premio_total || 0), 0))}</strong></td><td colSpan="2" /></tr></tfoot>
          </table>
        </div>
        {sales.length > PAGE_SIZE && <div className="pagination-bar"><span>Pagina {currentPage} de {totalPages}</span><div><button className="btn btn-ghost" type="button" disabled={currentPage === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Anterior</button><button className="btn btn-ghost" type="button" disabled={currentPage === totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>Siguiente</button></div></div>}
      </section>
    </div>
  )
}

export default InvoiceDetailView
