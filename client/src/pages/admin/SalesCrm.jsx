import { useEffect, useState } from 'react'
import InvoiceDetailView from '../../components/InvoiceDetailView'

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000'

const request = async (path, options = {}) => {
  const response = await fetch(`${apiUrl}${path}`, options)
  const data = await response.json()
  if (!response.ok) throw new Error(data.message || 'No se pudo completar la solicitud')
  return data
}

const formatMoney = (value) => new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
}).format(Number(value || 0))

function SalesCrm() {
  const [invoices, setInvoices] = useState([])
  const [filters, setFilters] = useState({ search: '', user: '', dateFrom: '', dateTo: '' })
  const [appliedFilters, setAppliedFilters] = useState({ search: '', user: '', dateFrom: '', dateTo: '' })
  const [filter, setFilter] = useState('activas')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 })
  const [selectedInvoice, setSelectedInvoice] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [payingId, setPayingId] = useState(null)

  const loadInvoices = async () => {
    try {
      setIsLoading(true)
      setError('')
      const params = new URLSearchParams({ ...appliedFilters, status: filter, page: String(page), limit: String(pageSize) })
      const result = await request(`/api/invoices?${params}`)
      setInvoices(result.data || [])
      setPagination(result.pagination || { page, total: 0, totalPages: 0 })
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadInvoices()
  }, [appliedFilters, filter, page, pageSize])

  const handleFilterChange = (event) => {
    const { name, value } = event.target
    setFilters((currentFilters) => ({ ...currentFilters, [name]: value }))
  }

  const applyFilters = (event) => {
    event.preventDefault()
    setPage(1)
    setAppliedFilters({ ...filters })
  }

  const clearFilters = () => {
    const emptyFilters = { search: '', user: '', dateFrom: '', dateTo: '' }
    setFilters(emptyFilters)
    setPage(1)
    setAppliedFilters(emptyFilters)
  }

  const changeStatus = (nextFilter) => {
    setFilter(nextFilter)
    setPage(1)
  }

  const payNumberPrize = async (sale) => {
    if (!selectedInvoice || sale.ganador_ids.length === 0) return
    try {
      setPayingId(sale.id)
      await request(`/api/vendors/${selectedInvoice.id_usuario}/prize-payments/pay-many`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: sale.ganador_ids }),
      })
      setSelectedInvoice((current) => ({
        ...current,
        ventas: current.ventas.map((currentSale) => currentSale.id === sale.id ? { ...currentSale, premio_pagado: true } : currentSale),
      }))
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setPayingId(null)
    }
  }

  const payAllPrizes = async () => {
    if (!selectedInvoice || !window.confirm(`Pagar todos los premios pendientes de la factura ${selectedInvoice.numero_factura}?`)) return
    try {
      setPayingId('all')
      await request(`/api/vendors/${selectedInvoice.id_usuario}/prize-payments/pay-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoice: selectedInvoice.numero_factura }),
      })
      setSelectedInvoice((current) => ({
        ...current,
        ventas: current.ventas.map((sale) => sale.activo && !sale.eliminada ? { ...sale, premio_pagado: true } : sale),
      }))
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setPayingId(null)
    }
  }

  const handleInvoiceAction = async (invoice, action) => {
    const actionLabel = action === 'restore' ? 'restaurar' : 'eliminar'
    if (!window.confirm(`Deseas ${actionLabel} la factura ${invoice.numero_factura}?`)) return

    try {
      setError('')
      await request(`/api/invoices/${invoice.id}/${action}`, { method: 'POST' })
      setSelectedInvoice(null)
      await loadInvoices()
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  return (
    <section className="sales-crm">
      <form className="sales-filter-panel" onSubmit={applyFilters}>
        <label><span>ID o numero de factura</span><input name="search" type="search" value={filters.search} onChange={handleFilterChange} placeholder="ID o A001" /></label>
        <label><span>Usuario</span><input name="user" type="search" value={filters.user} onChange={handleFilterChange} placeholder="Nombre, correo o ID" /></label>
        <label><span>Desde</span><input name="dateFrom" type="date" value={filters.dateFrom} onChange={handleFilterChange} /></label>
        <label><span>Hasta</span><input name="dateTo" type="date" value={filters.dateTo} onChange={handleFilterChange} /></label>
        <div className="sales-filter-actions"><button className="btn btn-primary" type="submit">Buscar</button><button className="btn btn-ghost" type="button" onClick={clearFilters}>Limpiar</button></div>
      </form>
      <div className="sales-toolbar">
        <div className="invoice-filter" role="group" aria-label="Estado de facturas">
          <button className={filter === 'activas' ? 'active' : ''} type="button" onClick={() => changeStatus('activas')}>Activas</button>
          <button className={filter === 'eliminadas' ? 'active' : ''} type="button" onClick={() => changeStatus('eliminadas')}>Eliminadas</button>
          <button className={filter === 'todas' ? 'active' : ''} type="button" onClick={() => changeStatus('todas')}>Todas</button>
        </div>
      </div>

      {error && <p className="dashboard-message dashboard-message--error">{error}</p>}
      {isLoading && <p className="dashboard-message">Cargando ventas...</p>}

      {!isLoading && <div className="users-table-wrap"><table className="users-table invoices-table">
        <thead><tr><th>Factura</th><th>Total</th><th>Estado</th><th aria-label="Acciones" /></tr></thead>
        <tbody>
          {invoices.map((invoice) => <tr key={invoice.id} className="invoice-row" onClick={() => setSelectedInvoice(invoice)}>
            <td><strong>{invoice.numero_factura}</strong><span>{new Date(invoice.created_at).toLocaleString('es-CO')}</span></td>
            <td>{formatMoney(invoice.total)}</td>
            <td><span className={`user-status ${invoice.eliminada ? '' : 'user-status--active'}`}>{invoice.eliminada ? 'Eliminada' : 'Activa'}</span></td>
            <td className="user-actions">{invoice.eliminada ? <button className="btn btn-primary" type="button" onClick={(event) => { event.stopPropagation(); handleInvoiceAction(invoice, 'restore') }}>Restaurar</button> : <button className="btn btn-danger" type="button" onClick={(event) => { event.stopPropagation(); handleInvoiceAction(invoice, 'delete') }}>Eliminar</button>}</td>
          </tr>)}
          {invoices.length === 0 && <tr><td className="users-empty" colSpan="4">No hay facturas para este filtro.</td></tr>}
        </tbody>
      </table></div>}

      {!isLoading && pagination.total > 0 && <div className="pagination-bar"><span>Pagina {pagination.page} de {pagination.totalPages} ({pagination.total} factura(s))</span><div><label>Filas por pagina <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1) }}><option value="10">10</option><option value="25">25</option><option value="50">50</option></select></label><button className="btn btn-ghost" type="button" disabled={page === 1} onClick={() => setPage((currentPage) => currentPage - 1)}>Anterior</button><button className="btn btn-ghost" type="button" disabled={page >= pagination.totalPages} onClick={() => setPage((currentPage) => currentPage + 1)}>Siguiente</button></div></div>}

      {selectedInvoice && <div className="modal-overlay" onClick={() => setSelectedInvoice(null)}><div className="modal-card invoice-modal-card" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header"><div><p className="eyebrow">Factura {selectedInvoice.numero_factura}</p><h2>{selectedInvoice.usuario?.nombre || 'Usuario no disponible'}</h2></div><button type="button" className="close-btn" onClick={() => setSelectedInvoice(null)} aria-label="Cerrar">×</button></div>
        <InvoiceDetailView invoice={selectedInvoice} onPayNumber={payNumberPrize} onPayAll={payAllPrizes} payingId={payingId} formatMoney={formatMoney} />
        <div className="invoice-modal-actions">{selectedInvoice.eliminada ? <button className="btn btn-primary" type="button" onClick={() => handleInvoiceAction(selectedInvoice, 'restore')}>Restaurar factura</button> : <button className="btn btn-danger" type="button" onClick={() => handleInvoiceAction(selectedInvoice, 'delete')}>Eliminar factura</button>}</div>
      </div></div>}
    </section>
  )
}

export default SalesCrm