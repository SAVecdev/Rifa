import { useEffect, useState } from 'react'
import Header from '../../components/Header'
import Sidebar from '../../components/Sidebar'
import Dashboard from '../../components/Dashboard'
import SecurityCrm from '../../components/SecurityCrm'

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000'
const formatMoney = (value) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(value || 0))
const request = async (path) => {
  const response = await fetch(`${apiUrl}${path}`)
  const data = await response.json()
  if (!response.ok) throw new Error(data.message || 'No se pudo cargar el panel')
  return data
}

function SupervisorVendorsCrm({ vendors }) {
  return <section className="supervisors-crm"><div className="users-table-wrap"><table className="users-table">
    <thead><tr><th>Vendedor</th><th>Estado</th><th>Ventas</th><th>Numeros</th><th>Premios pendientes</th><th>Premios pagados</th></tr></thead>
    <tbody>{vendors.map((vendor) => <tr key={vendor.id_usuario}>
      <td><strong>{vendor.nombre}</strong><span>{vendor.correo}</span></td>
      <td><span className={`user-status ${vendor.activo ? 'user-status--active' : ''}`}>{vendor.activo ? 'Activo' : 'Inactivo'}</span></td>
      <td>{formatMoney(vendor.ventas_monto)}</td><td>{vendor.ventas_cantidad}</td><td>{formatMoney(vendor.premios_pendientes)}</td><td>{formatMoney(vendor.premios_pagados)}</td>
    </tr>)}{vendors.length === 0 && <tr><td className="users-empty" colSpan="6">No tienes vendedores asignados.</td></tr>}</tbody>
  </table></div></section>
}

function SupervisorDashboardPage({ user, onLogout }) {
  const [section, setSection] = useState('resumen')
  const [dashboard, setDashboard] = useState(null)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState({ dateFrom: '', dateTo: '' })
  const [appliedFilters, setAppliedFilters] = useState({ dateFrom: '', dateTo: '' })

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        setError('')
        const params = new URLSearchParams()
        if (appliedFilters.dateFrom) params.set('dateFrom', appliedFilters.dateFrom)
        if (appliedFilters.dateTo) params.set('dateTo', appliedFilters.dateTo)
        setDashboard(await request(`/api/supervisors/${user.id}/dashboard?${params}`))
      } catch (requestError) {
        setError(requestError.message)
      }
    }
    loadDashboard()
  }, [user.id, appliedFilters])

  const handleFilterChange = (event) => {
    const { name, value } = event.target
    setFilters((current) => ({ ...current, [name]: value }))
  }

  const handleFilterSubmit = (event) => {
    event.preventDefault()
    setAppliedFilters({ ...filters })
  }

  return (
    <div className="app-shell">
      <Sidebar role="supervisor" activeItem={section} onNavigate={setSection} onLogout={onLogout} />
      <div className="content-wrap">
        <Header title={section === 'vendedores' ? 'Vendedores supervisados' : section === 'seguridad' ? 'Seguridad de vendedores' : 'Panel del supervisor'} subtitle={`Seguimiento de ${user.nombre}`} />
        {error && <p className="dashboard-message dashboard-message--error">{error}</p>}
        {!dashboard && !error && <p className="dashboard-message">Cargando estadisticas...</p>}
        {dashboard && section === 'resumen' && <Dashboard data={dashboard} filters={filters} onFilterChange={handleFilterChange} onFilterSubmit={handleFilterSubmit} />}
        {dashboard && section === 'vendedores' && <>
          <form className="dashboard-period-form" onSubmit={handleFilterSubmit}>
            <label><span>Desde</span><input name="dateFrom" type="date" value={filters.dateFrom} onChange={handleFilterChange} /></label>
            <label><span>Hasta</span><input name="dateTo" type="date" value={filters.dateTo} onChange={handleFilterChange} /></label>
            <button className="btn btn-primary" type="submit">Actualizar</button>
          </form>
          <SupervisorVendorsCrm vendors={dashboard.vendedores} />
        </>}
        {section === 'seguridad' && <SecurityCrm />}
      </div>
    </div>
  )
}

export default SupervisorDashboardPage
