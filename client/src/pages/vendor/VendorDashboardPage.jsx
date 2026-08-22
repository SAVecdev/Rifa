import { useEffect, useRef, useState } from 'react'
import Header from '../../components/Header'
import Sidebar from '../../components/Sidebar'
import InvoiceReceiptModal from './InvoiceReceiptModal'
import InvoiceDetailView from '../../components/InvoiceDetailView'
import VendorPointOfSale from './VendorPointOfSale'

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000'

const formatMoney = (value) => new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
}).format(Number(value || 0))

const sumDaily = (daily, field) => daily.reduce((total, row) => total + Number(row[field] || 0), 0)
const maskInvoice = (value) => {
  const text = String(value || '')
  return text.length > 2 ? `${text.slice(0, 1)}${'*'.repeat(text.length - 2)}${text.slice(-1)}` : '**'
}

const request = async (path, options = {}) => {
  const response = await fetch(`${apiUrl}${path}`, options)
  const data = await response.json()
  if (!response.ok) throw new Error(data.message || 'No se pudo completar la solicitud')
  return data
}

function VendorInvoiceHistory({ user }) {
  const [invoices, setInvoices] = useState([])
  const [selectedInvoice, setSelectedInvoice] = useState(null)
  const [isLoadingDetail, setIsLoadingDetail] = useState(false)
  const [payingId, setPayingId] = useState(null)
  const [printInvoice, setPrintInvoice] = useState(null)
  const [settings, setSettings] = useState(null)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [pagination, setPagination] = useState({ total: 0, totalPages: 0 })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const listRequestRef = useRef(null)
  const detailRequestRef = useRef(null)

  const loadInvoices = async () => {
    const controller = new AbortController()
    try {
      listRequestRef.current?.abort()
      listRequestRef.current = controller
      setIsLoading(true)
      const params = new URLSearchParams({ page: String(page), limit: '10' })
      if (appliedSearch) params.set('search', appliedSearch)
      const result = await request(`/api/vendors/${user.id}/invoice-history?${params}`, { signal: controller.signal })
      setInvoices(result.data || [])
      setPagination(result.pagination || { total: 0, totalPages: 0 })
    } catch (requestError) {
      if (requestError.name !== 'AbortError') setError(requestError.message)
    } finally {
      if (listRequestRef.current === controller) setIsLoading(false)
    }
  }

  useEffect(() => { loadInvoices() }, [user.id, page, appliedSearch])

  const handleSearch = (event) => {
    event.preventDefault()
    setPage(1)
    setAppliedSearch(search.trim().toUpperCase())
  }

  const openInvoice = async (invoice) => {
    try {
      detailRequestRef.current?.abort()
      const controller = new AbortController()
      detailRequestRef.current = controller
      setError('')
      setSelectedInvoice(null)
      setIsLoadingDetail(true)
      const details = await request(`/api/vendors/${user.id}/invoice-history/${invoice.id}`, { signal: controller.signal })
      setSelectedInvoice(details)
    } catch (requestError) {
      if (requestError.name !== 'AbortError') setError(requestError.message)
    } finally {
      setIsLoadingDetail(false)
    }
  }

  useEffect(() => () => {
    listRequestRef.current?.abort()
    detailRequestRef.current?.abort()
  }, [])

  const openPrint = async () => {
    try {
      const invoiceSettings = await request(`/api/invoice-settings/${user.id}`).catch(() => null)
      setSettings(invoiceSettings)
      setPrintInvoice(selectedInvoice)
      setSelectedInvoice(null)
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  const deleteInvoice = async () => {
    if (!selectedInvoice || !window.confirm(`Eliminar factura ${selectedInvoice.numero_factura}?`)) return
    try {
      await request(`/api/invoices/${selectedInvoice.id}/delete`, { method: 'POST' })
      setSelectedInvoice(null)
      await loadInvoices()
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  const payNumberPrize = async (sale) => {
    if (!selectedInvoice || sale.ganador_ids.length === 0) return
    try {
      setPayingId(sale.id)
      await request(`/api/vendors/${user.id}/prize-payments/pay-many`, {
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
      await request(`/api/vendors/${user.id}/prize-payments/pay-all`, {
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

  return <section className="vendor-invoice-history">
    <form className="vendor-invoice-search" onSubmit={handleSearch}><label><span>Filtrar historial de facturas</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Opcional: A001" /></label><button className="btn btn-primary" type="submit">Filtrar</button></form>
    {error && <p className="dashboard-message dashboard-message--error">{error}</p>}
    {isLoading && <VendorDashboardSkeleton section="history" />}
    {!isLoading && <div className="vendor-history-list">{invoices.map((invoice) => <button type="button" className="vendor-history-row" key={invoice.id} onClick={() => openInvoice(invoice)}><span><strong>Factura {maskInvoice(invoice.numero_factura)}</strong><small>{new Date(invoice.created_at).toLocaleString('es-CO')}</small></span><span className={`user-status ${invoice.eliminada ? '' : 'user-status--active'}`}>{invoice.eliminada ? 'Eliminada' : 'Activa'}</span></button>)}{invoices.length === 0 && <p className="empty-list">No hay facturas registradas.</p>}</div>}
    {!isLoading && pagination.totalPages > 0 && <div className="pagination-bar"><span>Pagina {page} de {pagination.totalPages}</span><div><button className="btn btn-ghost" type="button" disabled={page === 1} onClick={() => setPage((current) => current - 1)}>Anterior</button><button className="btn btn-ghost" type="button" disabled={page >= pagination.totalPages} onClick={() => setPage((current) => current + 1)}>Siguiente</button></div></div>}
    {selectedInvoice && <div className="modal-overlay" onClick={() => setSelectedInvoice(null)}><div className="modal-card vendor-invoice-detail-modal" onClick={(event) => event.stopPropagation()}>
      <div className="modal-header"><div><p className="eyebrow">Detalle de factura buscada</p><h2>{maskInvoice(selectedInvoice.numero_factura)}</h2></div><button type="button" className="close-btn" onClick={() => setSelectedInvoice(null)} aria-label="Cerrar">×</button></div>
      {isLoadingDetail ? <VendorDashboardSkeleton section="sales-only" /> : <InvoiceDetailView invoice={selectedInvoice} onPayNumber={payNumberPrize} onPayAll={payAllPrizes} payingId={payingId} formatMoney={formatMoney} />}
      <div className="invoice-receipt-actions"><button className="btn btn-primary" type="button" onClick={openPrint}>Reimprimir factura</button><button className="btn btn-danger" type="button" onClick={deleteInvoice}>Eliminar factura</button><button className="btn btn-ghost" type="button" onClick={() => setSelectedInvoice(null)}>Cerrar</button></div>
    </div></div>}
    {printInvoice && <InvoiceReceiptModal invoice={printInvoice} settings={settings} onClose={() => setPrintInvoice(null)} />}
  </section>
}

function VendorPrizePayments({ user }) {
  const [invoice, setInvoice] = useState('')
  const [invoiceDetail, setInvoiceDetail] = useState(null)
  const [searched, setSearched] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [payingId, setPayingId] = useState(null)
  const [error, setError] = useState('')

  const searchPrizes = async (event) => {
    event.preventDefault()
    const value = invoice.trim().toUpperCase()
    if (!value) return
    try {
      setIsLoading(true)
      setError('')
      setSearched(true)
      const list = await request(`/api/vendors/${user.id}/invoice-history?search=${encodeURIComponent(value)}&limit=1`)
      const match = (list.data || []).find((item) => item.numero_factura === value)
      if (!match) {
        setInvoiceDetail(null)
        setError('Factura no encontrada')
        return
      }
      const details = await request(`/api/vendors/${user.id}/invoice-history/${match.id}`)
      setInvoiceDetail(details)
    } catch (requestError) {
      setInvoiceDetail(null)
      setError(requestError.message)
    } finally {
      setIsLoading(false)
    }
  }

  const payNumberPrize = async (sale) => {
    if (!invoiceDetail || sale.ganador_ids.length === 0) return
    try {
      setPayingId(sale.id)
      await request(`/api/vendors/${user.id}/prize-payments/pay-many`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: sale.ganador_ids }),
      })
      setInvoiceDetail((current) => ({
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
    if (!invoiceDetail || !window.confirm(`Pagar todos los premios pendientes de la factura ${invoiceDetail.numero_factura}?`)) return
    try {
      setPayingId('all')
      await request(`/api/vendors/${user.id}/prize-payments/pay-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoice: invoiceDetail.numero_factura }),
      })
      setInvoiceDetail((current) => ({
        ...current,
        ventas: current.ventas.map((sale) => sale.activo && !sale.eliminada ? { ...sale, premio_pagado: true } : sale),
      }))
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setPayingId(null)
    }
  }

  return <section className="vendor-prize-payments">
    <form className="vendor-invoice-search" onSubmit={searchPrizes}><label><span>Buscar factura para pagar premios</span><input value={invoice} onChange={(event) => setInvoice(event.target.value)} placeholder="Ejemplo: A001" /></label><button className="btn btn-primary" type="submit" disabled={isLoading}>Buscar</button></form>
    {error && <p className="dashboard-message dashboard-message--error">{error}</p>}
    {isLoading && <VendorDashboardSkeleton section="sales-only" />}
    {!isLoading && invoiceDetail && <InvoiceDetailView invoice={invoiceDetail} onPayNumber={payNumberPrize} onPayAll={payAllPrizes} payingId={payingId} formatMoney={formatMoney} />}
    {!isLoading && !invoiceDetail && !searched && <p className="empty-list">Busca una factura para ver sus numeros y premios.</p>}
  </section>
}

function VendorStatsDashboard({ overview }) {
  const daily = overview.daily || []
  const recentSales = overview.recentSales || []
  const today = daily[0] || {}
  const cards = [
    ['💰', 'Ventas de hoy', formatMoney(today.ventas_hoy || today.ventas_monto)],
    ['🎟️', 'Total numeros vendidos', `${today.ventas_cantidad || 0}`],
    ['💵', 'Pagos de hoy', formatMoney(today.pagos_hoy)],
    ['🏆', 'Premios totales', formatMoney(sumDaily(daily, 'premios_totales'))],
    ['✅', 'Premios pagados', formatMoney(sumDaily(daily, 'premios_pagados'))],
    ['⌛', 'Premios pendientes', formatMoney(sumDaily(daily, 'premios_pendientes'))],
    ['📈', 'Recargas', formatMoney(sumDaily(daily, 'recargas'))],
    ['📉', 'Retiros', formatMoney(sumDaily(daily, 'retiros'))],
    ['💸', 'Balance de hoy', formatMoney(Number(today.ventas_hoy || today.ventas_monto || 0) + Number(today.recargas || 0) - Number(today.pagos_hoy || 0) - Number(today.retiros || 0))],
    ['💰', 'Ganancia neta', formatMoney(sumDaily(daily, 'ventas_monto') - sumDaily(daily, 'premios_totales'))],
  ]

  return <main className="vendor-stats-dashboard">
    <section className="vendor-stats-section"><h2>📊 Estadisticas detalladas de hoy ({new Date().toLocaleDateString('es-CO')})</h2>{overview.daily ? <div className="vendor-stat-cards">{cards.map(([icon, label, value]) => <article key={label}><strong>{icon}</strong><span>{label}</span><b>{value}</b></article>)}</div> : <VendorDashboardSkeleton section="stats-only" />}</section>
    <section className="vendor-stats-section vendor-daily-section"><h2>📈 Ultimos 8 dias trabajados</h2>{overview.daily ? <div className="vendor-daily-table-wrap"><table className="vendor-daily-table"><thead><tr><th>Fecha</th><th>Ventas monto</th><th>Cant.</th><th>Premios total</th><th>Pagados</th><th>Pendientes</th><th>Recargas</th><th>Retiros</th><th>Balance</th></tr></thead><tbody>{daily.map((row) => <tr key={row.fecha}><td>{new Date(`${row.fecha}T00:00:00`).toLocaleDateString('es-CO')}</td><td>{formatMoney(row.ventas_monto)}</td><td>{row.ventas_cantidad}</td><td>{formatMoney(row.premios_totales)}</td><td>{formatMoney(row.premios_pagados)}</td><td>{formatMoney(row.premios_pendientes)}</td><td>{formatMoney(row.recargas)}</td><td>{formatMoney(row.retiros)}</td><td>{formatMoney(Number(row.ventas_monto || 0) + Number(row.recargas || 0) - Number(row.premios_pagados || 0) - Number(row.retiros || 0))}</td></tr>)}{daily.length === 0 && <tr><td colSpan="9">No hay estadisticas registradas.</td></tr>}</tbody></table></div> : <div className="vendor-skeleton-table">{Array.from({ length: 8 }, (_, index) => <span key={index} />)}</div>}</section>
    <section className="vendor-stats-section"><h2>🧾 Ultimas 5 ventas</h2>{overview.recentSales ? <div className="vendor-activity-list">{recentSales.slice(0, 5).map((sale) => <article key={sale.id}><strong>🎟️ Venta · Numero {sale.numero}</strong><span>{sale.rifa?.nombre || 'Rifa'} · {formatMoney(sale.total)}</span><time>{new Date(sale.fecha).toLocaleString('es-CO')}</time></article>)}{recentSales.length === 0 && <p className="empty-list">No hay ventas recientes.</p>}</div> : <VendorDashboardSkeleton section="sales-only" />}</section>
  </main>
}

function VendorDashboardSkeleton({ section }) {
  if (section === 'ventas') return <div className="vendor-skeleton vendor-skeleton--pos"><span /><span /><span /><span /></div>
  if (section === 'rifas') return <section className="vendor-raffles-grid vendor-skeleton-grid">{Array.from({ length: 4 }, (_, index) => <article className="vendor-skeleton-card" key={index}><span /><span /><span /><span /></article>)}</section>
  if (section === 'history') return <div className="vendor-skeleton-activity">{Array.from({ length: 6 }, (_, index) => <span key={index} />)}</div>
  if (section === 'stats-only') return <div className="vendor-stat-cards">{Array.from({ length: 10 }, (_, index) => <article className="vendor-skeleton-stat" key={index}><span /><span /><b /></article>)}</div>
  if (section === 'sales-only') return <div className="vendor-skeleton-activity">{Array.from({ length: 5 }, (_, index) => <span key={index} />)}</div>
  return <main className="vendor-stats-dashboard"><section className="vendor-stats-section"><h2><span className="skeleton-line skeleton-line--heading" /></h2><div className="vendor-stat-cards">{Array.from({ length: 10 }, (_, index) => <article className="vendor-skeleton-stat" key={index}><span /><span /><b /></article>)}</div></section><section className="vendor-stats-section"><h2><span className="skeleton-line skeleton-line--heading" /></h2><div className="vendor-skeleton-table">{Array.from({ length: 8 }, (_, index) => <span key={index} />)}</div></section><section className="vendor-stats-section"><h2><span className="skeleton-line skeleton-line--heading" /></h2><div className="vendor-skeleton-activity">{Array.from({ length: 5 }, (_, index) => <span key={index} />)}</div></section></main>
}

function VendorDashboardPage({ user, onLogout }) {
  const [section, setSection] = useState('resumen')
  const [overview, setOverview] = useState(null)
  const [raffleTypes, setRaffleTypes] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()

    const loadOverview = async () => {
      try {
        setError('')
        setOverview(null)
        setRaffleTypes([])
        if (section === 'resumen') {
          setOverview({ daily: null, recentSales: null })
          const loadPart = async (path, field) => {
            const response = await fetch(`${apiUrl}/api/vendors/${user.id}/${path}`, { signal: controller.signal })
            const data = await response.json()
            if (!response.ok) throw new Error(data.message || `No se pudo cargar ${field}`)
            setOverview((current) => ({ ...(current || {}), [field]: data[field] }))
          }
          loadPart('dashboard-stats', 'daily').catch((requestError) => { if (requestError.name !== 'AbortError') setError(requestError.message) })
          loadPart('recent-sales', 'recentSales').catch((requestError) => { if (requestError.name !== 'AbortError') setError(requestError.message) })
          return
        }
        if (section === 'rifas' || section === 'historial-facturas' || section === 'pagar-premios') return
        const overviewPath = section === 'ventas' ? 'pos-overview' : section === 'rifas' ? 'overview' : 'dashboard-overview'
        const overviewResponse = await fetch(`${apiUrl}/api/vendors/${user.id}/${overviewPath}`, { signal: controller.signal })
        const data = await overviewResponse.json()
        if (!overviewResponse.ok) throw new Error(data.message || 'No se pudo cargar la informacion del vendedor')
        setOverview(section === 'ventas' ? { ...data, stats: {}, sales: [] } : data)
        if (section === 'ventas') {
          const typesResponse = await fetch(`${apiUrl}/api/raffle-types`, { signal: controller.signal })
          const types = await typesResponse.json()
          if (!typesResponse.ok) throw new Error(types.message || 'No se pudieron cargar los tipos de rifa')
          setRaffleTypes(types)
        }
      } catch (requestError) {
        if (requestError.name !== 'AbortError') setError(requestError.message || 'No se pudo conectar con el servidor')
      }
    }

    loadOverview()
    return () => controller.abort()
  }, [user.id, section])

  return (
    <div className="app-shell">
      <Sidebar role="vendedor" activeItem={section} onNavigate={setSection} onLogout={onLogout} />

      <div className="content-wrap">
        {section === 'historial-facturas' ? <>
          <Header title="Historial de ventas" subtitle="Facturas del vendedor" />
          {error && <p className="dashboard-message dashboard-message--error">{error}</p>}
          <VendorInvoiceHistory user={user} />
        </> : section === 'pagar-premios' ? <>
          <Header title="Pagar premios" subtitle="Premios de facturas del vendedor" />
          <VendorPrizePayments user={user} />
        </> : section === 'ventas' ? <>
          <Header title="Punto de ventas" subtitle="Factura local por ventana" />
          {overview && <VendorPointOfSale user={user} raffles={overview.raffles || []} raffleTypes={raffleTypes || []} />}
              {!error && !overview && <VendorDashboardSkeleton section={section} />}
        </> : <>
          <Header title="Panel del vendedor" subtitle={user.nombre || 'Resumen'} />
          {error && <p className="dashboard-message dashboard-message--error">{error}</p>}
          {!error && !overview && <VendorDashboardSkeleton section={section} />}
          {overview && <VendorStatsDashboard overview={overview} />}
        </>}
      </div>
    </div>
  )
}

export default VendorDashboardPage
