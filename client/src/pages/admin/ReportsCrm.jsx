import { useEffect, useState } from 'react'

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
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
}).format(Number(value || 0))

const toLocalDate = (value) => {
  const date = new Date(value)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const escapeHtml = (value) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const exportToExcel = (filename, columns, rows) => {
  const header = `<tr>${columns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join('')}</tr>`
  const body = rows.map((row) => `<tr>${columns.map((column) => `<td>${escapeHtml(column.value(row))}</td>`).join('')}</tr>`).join('')
  const html = `<html><head><meta charset="UTF-8" /></head><body><table border="1">${header}${body}</table></body></html>`
  const blob = new Blob(['\ufeff' + html], { type: 'application/vnd.ms-excel' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${filename}.xls`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

const tabs = [
  { id: 'resumen', label: 'Resumen', icon: '📇' },
  { id: 'ventas', label: 'Ventas', icon: '🔥' },
  { id: 'premios', label: 'Premios', icon: '🏆' },
  { id: 'control-premios', label: 'Control Premios', icon: '🎯' },
  { id: 'transacciones', label: 'Transacciones', icon: '💳' },
  { id: 'estadisticas', label: 'Estadisticas Diarias', icon: '📊' },
]

const reportEndpointByTab = {
  ventas: '/api/reports/ventas',
  premios: '/api/reports/premios',
  'control-premios': '/api/reports/premios',
  transacciones: '/api/reports/transacciones',
  estadisticas: '/api/reports/estadisticas-diarias',
}

function ReportsCrm() {
  const [users, setUsers] = useState([])
  const [activeTab, setActiveTab] = useState('resumen')
  const [filters, setFilters] = useState({ dateFrom: toLocalDate(new Date(Date.now() - 29 * 86400000)), dateTo: toLocalDate(new Date()), userId: '' })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [reportData, setReportData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    request('/api/users').then(setUsers).catch(() => {})
  }, [])

  useEffect(() => {
    setPage(1)
  }, [activeTab, filters])

  useEffect(() => {
    const controller = new AbortController()
    const loadReport = async () => {
      try {
        setIsLoading(true)
        setError('')
        const params = new URLSearchParams({ dateFrom: filters.dateFrom, dateTo: filters.dateTo, page: String(page), limit: String(pageSize) })
        if (filters.userId) params.set('userId', filters.userId)
        const path = activeTab === 'resumen' ? '/api/admin/dashboard' : reportEndpointByTab[activeTab]
        const data = await request(`${path}?${params}`, { signal: controller.signal })
        setReportData(data)
      } catch (requestError) {
        if (requestError.name !== 'AbortError') setError(requestError.message)
      } finally {
        setIsLoading(false)
      }
    }
    loadReport()
    return () => controller.abort()
  }, [activeTab, filters, page, pageSize])

  const applyPreset = (preset) => {
    const today = new Date()
    if (preset === '7d') setFilters((current) => ({ ...current, dateFrom: toLocalDate(new Date(today.getTime() - 6 * 86400000)), dateTo: toLocalDate(today) }))
    else if (preset === '30d') setFilters((current) => ({ ...current, dateFrom: toLocalDate(new Date(today.getTime() - 29 * 86400000)), dateTo: toLocalDate(today) }))
    else if (preset === 'month') setFilters((current) => ({ ...current, dateFrom: toLocalDate(new Date(today.getFullYear(), today.getMonth(), 1)), dateTo: toLocalDate(today) }))
  }

  const handleFilterChange = (event) => {
    const { name, value } = event.target
    setFilters((current) => ({ ...current, [name]: value }))
  }

  const columnsByTab = {
    ventas: [
      { label: 'Fecha', value: (row) => new Date(row.fecha).toLocaleString('es-CO') },
      { label: 'Vendedor', value: (row) => row.vendedor },
      { label: 'Rifa', value: (row) => row.rifa?.nombre || '-' },
      { label: 'Numero', value: (row) => row.numero },
      { label: 'Cantidad', value: (row) => row.cantidad },
      { label: 'Valor', value: (row) => formatMoney(row.valor) },
      { label: 'Total', value: (row) => formatMoney(row.total) },
    ],
    premios: [
      { label: 'Fecha', value: (row) => row.fecha },
      { label: 'Vendedor', value: (row) => row.vendedor },
      { label: 'Factura', value: (row) => row.factura?.numero_factura || '-' },
      { label: 'Numero', value: (row) => row.numerol },
      { label: 'Nivel', value: (row) => row.nivel_premio },
      { label: 'Premio', value: (row) => formatMoney(row.saldo_premio) },
      { label: 'Estado', value: (row) => row.pagada ? 'Pagado' : 'Pendiente' },
      { label: 'Fecha pago', value: (row) => row.fecha_hora_pago ? new Date(row.fecha_hora_pago).toLocaleString('es-CO') : '-' },
    ],
    transacciones: [
      { label: 'Fecha', value: (row) => new Date(row.fecha).toLocaleString('es-CO') },
      { label: 'Vendedor', value: (row) => row.vendedor },
      { label: 'Tipo', value: (row) => row.tipo },
      { label: 'Monto', value: (row) => formatMoney(row.monto) },
      { label: 'Estado', value: (row) => row.estado },
      { label: 'Descripcion', value: (row) => row.descripcion || '-' },
    ],
    estadisticas: [
      { label: 'Fecha', value: (row) => row.fecha },
      { label: 'ID Usuario', value: (row) => row.id_usuario },
      { label: 'Vendedor', value: (row) => row.vendedor },
      { label: 'Ventas Monto', value: (row) => formatMoney(row.ventas_monto) },
      { label: 'Cantidad Ventas', value: (row) => row.ventas_cantidad },
      { label: 'Ventas Hoy', value: (row) => formatMoney(row.ventas_hoy) },
      { label: 'Premios Totales', value: (row) => formatMoney(row.premios_totales) },
      { label: 'Premios Pagados', value: (row) => formatMoney(row.premios_pagados) },
      { label: 'Premios Pendientes', value: (row) => formatMoney(row.premios_pendientes) },
      { label: 'Pagos Hoy', value: (row) => formatMoney(row.pagos_hoy) },
      { label: 'Recargas', value: (row) => formatMoney(row.recargas) },
      { label: 'Retiros', value: (row) => formatMoney(row.retiros) },
      { label: 'Ganancia Neta', value: (row) => formatMoney(row.ganancia_neta) },
    ],
  }

  const handleExport = async () => {
    try {
      setError('')
      if (activeTab === 'resumen') {
        const columns = [
          { label: 'Fecha', value: (row) => row.fecha },
          { label: 'Ventas Monto', value: (row) => formatMoney(row.ventas_monto) },
          { label: 'Premios Totales', value: (row) => formatMoney(row.premios_totales) },
          { label: 'Premios Pagados', value: (row) => formatMoney(row.premios_pagados) },
          { label: 'Premios Pendientes', value: (row) => formatMoney(row.premios_pendientes) },
        ]
        exportToExcel(`resumen-${filters.dateFrom}-a-${filters.dateTo}`, columns, reportData?.daily || [])
        return
      }
      const params = new URLSearchParams({ dateFrom: filters.dateFrom, dateTo: filters.dateTo, all: 'true' })
      if (filters.userId) params.set('userId', filters.userId)
      const fullData = await request(`${reportEndpointByTab[activeTab]}?${params}`)
      const columns = columnsByTab[activeTab]
      exportToExcel(`${activeTab}-${filters.dateFrom}-a-${filters.dateTo}`, columns, fullData?.data || [])
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  const renderTable = () => {
    if (activeTab === 'resumen') {
      const stats = reportData?.stats
      const dailyRows = reportData?.daily || []
      const pagedDaily = dailyRows.slice((page - 1) * pageSize, page * pageSize)
      return (
        <>
          {stats && <div className="dashboard-stat-grid">
            <article className="dashboard-stat dashboard-stat--yellow"><span>Ventas del periodo</span><strong>{formatMoney(stats.ventas_periodo)}</strong><small>{stats.ventas_cantidad} ventas</small></article>
            <article className="dashboard-stat dashboard-stat--blue"><span>Premios del periodo</span><strong>{formatMoney(stats.premios_periodo)}</strong><small>{stats.dias_con_actividad} dias con actividad</small></article>
            <article className="dashboard-stat dashboard-stat--green"><span>Premios pagados</span><strong>{formatMoney(stats.premios_pagados)}</strong><small>Pagos registrados</small></article>
            <article className="dashboard-stat dashboard-stat--purple"><span>Premios pendientes</span><strong>{formatMoney(stats.premios_pendientes)}</strong><small>Por pagar</small></article>
            <article className="dashboard-stat dashboard-stat--red"><span>Utilidad neta</span><strong>{formatMoney(stats.utilidad_neta)}</strong><small>{stats.vendedores} vendedores</small></article>
          </div>}
          <div className="invoice-detail-table-wrap"><table className="invoice-detail-table">
            <thead><tr><th>Fecha</th><th>Ventas Monto</th><th>Premios Totales</th><th>Premios Pagados</th><th>Premios Pendientes</th></tr></thead>
            <tbody>
              {pagedDaily.map((row) => <tr key={row.fecha}><td>{row.fecha}</td><td>{formatMoney(row.ventas_monto)}</td><td>{formatMoney(row.premios_totales)}</td><td>{formatMoney(row.premios_pagados)}</td><td>{formatMoney(row.premios_pendientes)}</td></tr>)}
              {pagedDaily.length === 0 && <tr><td colSpan="5" className="invoice-detail-empty">Sin datos en este periodo.</td></tr>}
            </tbody>
          </table></div>
        </>
      )
    }

    if (activeTab === 'control-premios') {
      const totals = reportData?.totals
      const rows = reportData?.data || []
      return (
        <>
          {totals && <div className="dashboard-stat-grid">
            <article className="dashboard-stat dashboard-stat--green"><span>Premios pagados</span><strong>{formatMoney(totals.pagados)}</strong></article>
            <article className="dashboard-stat dashboard-stat--purple"><span>Premios pendientes</span><strong>{formatMoney(totals.pendientes)}</strong></article>
            <article className="dashboard-stat dashboard-stat--yellow"><span>Total premios</span><strong>{formatMoney(totals.total)}</strong></article>
          </div>}
          <div className="invoice-detail-table-wrap"><table className="invoice-detail-table">
            <thead><tr><th>Fecha</th><th>Vendedor</th><th>Factura</th><th>Numero</th><th>Nivel</th><th>Premio</th><th>Estado</th><th>Fecha pago</th></tr></thead>
            <tbody>
              {rows.map((row) => <tr key={row.id}><td>{row.fecha}</td><td>{row.vendedor}</td><td>{row.factura?.numero_factura || '-'}</td><td>{row.numerol}</td><td>{row.nivel_premio}</td><td>{formatMoney(row.saldo_premio)}</td><td><span className={`invoice-detail-badge ${row.pagada ? 'is-active' : 'is-inactive'}`}>{row.pagada ? 'Pagado' : 'Pendiente'}</span></td><td>{row.fecha_hora_pago ? new Date(row.fecha_hora_pago).toLocaleString('es-CO') : '-'}</td></tr>)}
              {rows.length === 0 && <tr><td colSpan="8" className="invoice-detail-empty">Sin premios en este periodo.</td></tr>}
            </tbody>
          </table></div>
        </>
      )
    }

    const columns = columnsByTab[activeTab]
    const rows = reportData?.data || []
    return (
      <div className="invoice-detail-table-wrap"><table className="invoice-detail-table">
        <thead><tr>{columns.map((column) => <th key={column.label}>{column.label}</th>)}</tr></thead>
        <tbody>
          {rows.map((row, index) => <tr key={row.id ?? index}>{columns.map((column) => <td key={column.label}>{column.value(row)}</td>)}</tr>)}
          {rows.length === 0 && <tr><td colSpan={columns.length} className="invoice-detail-empty">Sin datos en este periodo.</td></tr>}
        </tbody>
      </table></div>
    )
  }

  const dailyRows = reportData?.daily || []
  const pagination = activeTab === 'resumen'
    ? { page, limit: pageSize, total: dailyRows.length, totalPages: Math.max(1, Math.ceil(dailyRows.length / pageSize)) }
    : reportData?.pagination || { page: 1, limit: pageSize, total: 0, totalPages: 0 }

  return (
    <section className="reports-crm">
      <div className="reports-filters-card">
        <div className="reports-filters-grid">
          <label><span>Fecha inicio</span><input type="date" name="dateFrom" value={filters.dateFrom} onChange={handleFilterChange} /></label>
          <label><span>Fecha fin</span><input type="date" name="dateTo" value={filters.dateTo} onChange={handleFilterChange} /></label>
          <label><span>Usuario</span><select name="userId" value={filters.userId} onChange={handleFilterChange}><option value="">Todos los usuarios</option>{users.map((user) => <option key={user.id} value={user.id}>{user.nombre} ({user.rol})</option>)}</select></label>
        </div>
        <div className="reports-preset-actions">
          <button className="btn btn-primary" type="button" onClick={() => applyPreset('7d')}>Ultimos 7 dias</button>
          <button className="btn btn-primary" type="button" onClick={() => applyPreset('30d')}>Ultimos 30 dias</button>
          <button className="btn btn-primary" type="button" onClick={() => applyPreset('month')}>Mes actual</button>
        </div>
      </div>

      <div className="reports-tabs" role="tablist">
        {tabs.map((tab) => (
          <button key={tab.id} type="button" className={`reports-tab ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id)}>
            <span>{tab.icon}</span> {tab.label}
          </button>
        ))}
      </div>

      <button className="btn reports-export-btn" type="button" onClick={handleExport} disabled={isLoading}>⬇️ Exportar Excel</button>

      {error && <p className="dashboard-message dashboard-message--error">{error}</p>}
      {isLoading && <p className="dashboard-message">Cargando reporte...</p>}
      {!isLoading && !error && renderTable()}
      {!isLoading && !error && pagination.total > 0 && <div className="pagination-bar">
        <span>Pagina {pagination.page} de {pagination.totalPages} ({pagination.total} registro(s))</span>
        <div>
          <label>Filas por pagina <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1) }}><option value="10">10</option><option value="20">20</option><option value="50">50</option><option value="100">100</option></select></label>
          <button className="btn btn-ghost" type="button" disabled={page === 1} onClick={() => setPage((current) => current - 1)}>Anterior</button>
          <button className="btn btn-ghost" type="button" disabled={page >= pagination.totalPages} onClick={() => setPage((current) => current + 1)}>Siguiente</button>
        </div>
      </div>}
    </section>
  )
}

export default ReportsCrm
