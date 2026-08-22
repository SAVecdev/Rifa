import { useEffect, useState } from 'react'
import Header from '../../components/Header'
import Sidebar from '../../components/Sidebar'
import Dashboard from '../../components/Dashboard'
import UserCrm from './UserCrm'
import ImageCrm from './ImageCrm'
import AreaCrm from './AreaCrm'
import RaffleTypeCrm from './RaffleTypeCrm'
import SupervisorCrm from './SupervisorCrm'
import RaffleCrm from './RaffleCrm'
import RaffleLogoCrm from './RaffleLogoCrm'
import RaffleAreaQuotaCrm from './RaffleAreaQuotaCrm'
import SalesCrm from './SalesCrm'
import PrizeOptionsCrm from './PrizeOptionsCrm'
import InvoiceSettingsCrm from './InvoiceSettingsCrm'
import ReportsCrm from './ReportsCrm'
import SecurityCrm from '../../components/SecurityCrm'

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000'

function AdminDashboardPage({ onLogout }) {
  const [section, setSection] = useState('resumen')
  const [dashboard, setDashboard] = useState(null)
  const [filters, setFilters] = useState({ dateFrom: '', dateTo: '' })
  const [appliedFilters, setAppliedFilters] = useState({ dateFrom: '', dateTo: '' })
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()

    const loadDashboard = async () => {
      try {
        setError('')
        const params = new URLSearchParams()
        if (appliedFilters.dateFrom) params.set('dateFrom', appliedFilters.dateFrom)
        if (appliedFilters.dateTo) params.set('dateTo', appliedFilters.dateTo)
        const response = await fetch(`${apiUrl}/api/admin/dashboard?${params}`, { signal: controller.signal })
        const data = await response.json()

        if (!response.ok) throw new Error(data.message || 'No se pudo cargar el resumen administrativo')
        setDashboard(data)
      } catch (requestError) {
        if (requestError.name !== 'AbortError') setError(requestError.message)
      }
    }

    loadDashboard()
    return () => controller.abort()
  }, [appliedFilters])

  const handleFilterChange = (event) => {
    const { name, value } = event.target
    setFilters((currentFilters) => ({ ...currentFilters, [name]: value }))
  }

  const handleFilterSubmit = (event) => {
    event.preventDefault()
    setAppliedFilters({ ...filters })
  }

  return (
    <div className="app-shell">
      <Sidebar role="administrador" activeItem={section} onNavigate={setSection} onLogout={onLogout} />

      <div className="content-wrap">
        {section === 'seguridad' ? (
          <>
            <Header title="Seguridad" subtitle="Inicios de sesion y acceso de usuarios" />
            <SecurityCrm />
          </>
        ) : section === 'usuarios' ? (
          <>
            <Header title="Usuarios" subtitle="Administracion de cuentas" />
            <UserCrm />
          </>
        ) : section === 'imagenes' ? (
          <>
            <Header title="Imagenes" subtitle="Biblioteca local" />
            <ImageCrm />
          </>
        ) : section === 'areas' ? (
          <>
            <Header title="Areas" subtitle="Organizacion territorial" />
            <AreaCrm />
          </>
        ) : section === 'supervisores' ? (
          <>
            <Header title="Supervisores" subtitle="Asignacion de vendedores" />
            <SupervisorCrm />
          </>
        ) : section === 'tipos-rifa' ? (
          <>
            <Header title="Tipos de rifa" subtitle="Configuracion visual" />
            <RaffleTypeCrm />
          </>
        ) : section === 'rifas' ? (
          <>
            <Header title="Rifas" subtitle="Catalogo de sorteos" />
            <RaffleCrm />
          </>
        ) : section === 'logos-rifa' ? (
          <>
            <Header title="Logos de rifa" subtitle="Personalizacion por area" />
            <RaffleLogoCrm />
          </>
        ) : section === 'cupos-rifa' ? (
          <>
            <Header title="Cupos por area" subtitle="Limites de venta por tipo de rifa" />
            <RaffleAreaQuotaCrm />
          </>
        ) : section === 'ventas' ? (
          <>
            <Header title="Ventas" subtitle="Facturas y restauracion" />
            <SalesCrm />
          </>
        ) : section === 'opciones-premios' ? (
          <>
            <Header title="Opciones de premios" subtitle="Valores por rifa y area" />
            <PrizeOptionsCrm />
          </>
        ) : section === 'configuracion-factura' ? (
          <>
            <Header title="Facturas" subtitle="Configuracion por usuario" />
            <InvoiceSettingsCrm />
          </>
        ) : section === 'finanzas' ? (
          <>
            <Header title="Reportes" subtitle="Finanzas y estadisticas" />
            <ReportsCrm />
          </>
        ) : (
          <>
            <Header title="Panel del administrador" subtitle="Operacion general" />
            {error && <p className="dashboard-message dashboard-message--error">{error}</p>}
            {!error && !dashboard && <p className="dashboard-message">Cargando datos reales...</p>}
            {dashboard && <Dashboard data={dashboard} filters={filters} onFilterChange={handleFilterChange} onFilterSubmit={handleFilterSubmit} />}
          </>
        )}
      </div>
    </div>
  )
}

export default AdminDashboardPage
