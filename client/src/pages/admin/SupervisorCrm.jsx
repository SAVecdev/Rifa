import { useEffect, useState } from 'react'

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000'

const request = async (path, options = {}) => {
  const response = await fetch(`${apiUrl}${path}`, options)
  const data = await response.json()
  if (!response.ok) throw new Error(data.message || 'No se pudo completar la solicitud')
  return data
}

function SupervisorCrm() {
  const [supervisors, setSupervisors] = useState([])
  const [vendors, setVendors] = useState([])
  const [assignments, setAssignments] = useState([])
  const [selectedSupervisor, setSelectedSupervisor] = useState(null)
  const [assignedVendorIds, setAssignedVendorIds] = useState([])
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingAssignment, setIsLoadingAssignment] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  const loadData = async () => {
    try {
      setIsLoading(true)
      setError('')
      const [loadedSupervisors, allUsers, loadedAssignments] = await Promise.all([
        request('/api/supervisors'),
        request('/api/users'),
        request('/api/supervisors/assignments'),
      ])
      setSupervisors(loadedSupervisors)
      setVendors(allUsers.filter((user) => user.rol === 'vendedor'))
      setAssignments(loadedAssignments)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const vendorCountBySupervisor = assignments.reduce((counts, row) => {
    counts[row.id_supervisor] = (counts[row.id_supervisor] || 0) + 1
    return counts
  }, {})

  const supervisorCountByVendor = assignments.reduce((counts, row) => {
    counts[row.id_vendedor] = (counts[row.id_vendedor] || 0) + 1
    return counts
  }, {})

  const openAssignment = async (supervisor) => {
    try {
      setError('')
      setSelectedSupervisor(supervisor)
      setIsLoadingAssignment(true)
      const assigned = await request(`/api/supervisors/${supervisor.id}/vendors`)
      setAssignedVendorIds(assigned.map((vendor) => vendor.id))
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsLoadingAssignment(false)
    }
  }

  const toggleVendor = (vendorId) => {
    setAssignedVendorIds((current) => current.includes(vendorId)
      ? current.filter((id) => id !== vendorId)
      : [...current, vendorId])
  }

  const saveAssignment = async () => {
    if (!selectedSupervisor) return
    try {
      setIsSaving(true)
      setError('')
      await request(`/api/supervisors/${selectedSupervisor.id}/vendors`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vendorIds: assignedVendorIds }),
      })
      const loadedAssignments = await request('/api/supervisors/assignments')
      setAssignments(loadedAssignments)
      setSelectedSupervisor(null)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsSaving(false)
    }
  }

  const filteredVendors = vendors.filter((vendor) => {
    const term = search.trim().toLowerCase()
    if (!term) return true
    return vendor.nombre.toLowerCase().includes(term) || vendor.correo.toLowerCase().includes(term)
  })

  return (
    <section className="supervisors-crm">
      {error && <p className="dashboard-message dashboard-message--error">{error}</p>}
      {isLoading && <p className="dashboard-message">Cargando supervisores...</p>}

      {!isLoading && <div className="users-table-wrap"><table className="users-table">
        <thead><tr><th>Supervisor</th><th>Estado</th><th>Vendedores asignados</th><th aria-label="Acciones" /></tr></thead>
        <tbody>
          {supervisors.map((supervisor) => (
            <tr key={supervisor.id}>
              <td><strong>{supervisor.nombre}</strong><span>{supervisor.correo}</span></td>
              <td><span className={`user-status ${supervisor.activo ? 'user-status--active' : ''}`}>{supervisor.activo ? 'Activo' : 'Inactivo'}</span></td>
              <td>{vendorCountBySupervisor[supervisor.id] || 0}</td>
              <td className="user-actions"><button className="btn btn-primary" type="button" onClick={() => openAssignment(supervisor)}>Asignar vendedores</button></td>
            </tr>
          ))}
          {supervisors.length === 0 && <tr><td className="users-empty" colSpan="4">No hay supervisores registrados. Crea uno desde Usuarios con el rol "supervisor".</td></tr>}
        </tbody>
      </table></div>}

      {selectedSupervisor && (
        <div className="modal-overlay" onClick={() => setSelectedSupervisor(null)}>
          <div className="modal-card supervisor-assignment-card" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div><p className="eyebrow">Asignar vendedores</p><h2>{selectedSupervisor.nombre}</h2></div>
              <button type="button" className="close-btn" onClick={() => setSelectedSupervisor(null)} aria-label="Cerrar">×</button>
            </div>

            <label className="supervisor-vendor-search"><span>Buscar vendedor</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nombre o correo" /></label>

            {isLoadingAssignment && <p className="dashboard-message">Cargando vendedores asignados...</p>}

            {!isLoadingAssignment && (
              <div className="supervisor-vendor-list">
                {filteredVendors.map((vendor) => {
                  const otherSupervisors = (supervisorCountByVendor[vendor.id] || 0) - (assignedVendorIds.includes(vendor.id) ? 1 : 0)
                  return (
                    <label key={vendor.id} className="supervisor-vendor-item">
                      <input type="checkbox" checked={assignedVendorIds.includes(vendor.id)} onChange={() => toggleVendor(vendor.id)} />
                      <span className="supervisor-vendor-name"><strong>{vendor.nombre}</strong><small>{vendor.correo}</small></span>
                      {otherSupervisors > 0 && <span className="supervisor-vendor-shared">Compartido con {otherSupervisors} supervisor(es) mas</span>}
                    </label>
                  )
                })}
                {filteredVendors.length === 0 && <p className="empty-list">No hay vendedores que coincidan con la busqueda.</p>}
              </div>
            )}

            <div className="invoice-modal-actions">
              <button className="btn btn-primary" type="button" disabled={isSaving || isLoadingAssignment} onClick={saveAssignment}>{isSaving ? 'Guardando...' : 'Guardar asignacion'}</button>
              <button className="btn btn-ghost" type="button" onClick={() => setSelectedSupervisor(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

export default SupervisorCrm
