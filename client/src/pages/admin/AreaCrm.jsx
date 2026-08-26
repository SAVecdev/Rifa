import { useEffect, useState } from 'react'

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000'

const emptyForm = {
  nombre: '',
  descripcion: '',
  activo: true,
  hora_inicio_venta: '07:00',
  hora_fin_venta: '17:00',
  horario_activo: false,
}

const request = async (path, options = {}) => {
  const response = await fetch(`${apiUrl}${path}`, options)
  const data = await response.json()
  if (!response.ok) throw new Error(data.message || 'No se pudo completar la solicitud')
  return data
}

function AreaCrm() {
  const [areas, setAreas] = useState([])
  const [search, setSearch] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  const loadAreas = async () => {
    try {
      setIsLoading(true)
      setError('')
      setAreas(await request('/api/areas'))
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadAreas()
  }, [])

  const openCreateForm = () => {
    setEditingId(null)
    setForm(emptyForm)
    setError('')
    setIsFormOpen(true)
  }

  const openEditForm = (area) => {
    setEditingId(area.id)
    setForm({
      nombre: area.nombre || '',
      descripcion: area.descripcion || '',
      activo: Boolean(area.activo),
      hora_inicio_venta: area.hora_inicio_venta ? String(area.hora_inicio_venta).slice(0, 5) : '07:00',
      hora_fin_venta: area.hora_fin_venta ? String(area.hora_fin_venta).slice(0, 5) : '17:00',
      horario_activo: Boolean(area.horario_activo),
    })
    setError('')
    setIsFormOpen(true)
  }

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target
    setForm((currentForm) => ({ ...currentForm, [name]: type === 'checkbox' ? checked : value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    try {
      setIsSaving(true)
      setError('')
      await request(editingId ? `/api/areas/${editingId}` : '/api/areas', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      setIsFormOpen(false)
      await loadAreas()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (area) => {
    if (!window.confirm(`Eliminar el area ${area.nombre}?`)) return

    try {
      setError('')
      await request(`/api/areas/${area.id}`, { method: 'DELETE' })
      await loadAreas()
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  const filteredAreas = areas.filter((area) => {
    const searchable = `${area.nombre || ''} ${area.descripcion || ''}`.toLowerCase()
    return searchable.includes(search.trim().toLowerCase())
  })

  return (
    <section className="areas-crm">
      <div className="users-toolbar">
        <label className="user-search">
          <span>Buscar</span>
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nombre o descripcion" />
        </label>
        <button className="btn btn-primary" type="button" onClick={openCreateForm}>Agregar area</button>
      </div>

      {error && <p className="dashboard-message dashboard-message--error">{error}</p>}
      {isLoading && <p className="dashboard-message">Cargando areas...</p>}

      {!isLoading && (
        <div className="users-table-wrap">
          <table className="users-table">
            <thead>
              <tr><th>Area</th><th>Descripcion</th><th>Horario Venta</th><th>Estado</th><th aria-label="Acciones" /></tr>
            </thead>
            <tbody>
              {filteredAreas.map((area) => (
                <tr key={area.id}>
                  <td><strong>{area.nombre}</strong><span>#{area.id}</span></td>
                  <td>{area.descripcion || 'Sin descripcion'}</td>
                  <td>
                    <span>
                      {area.hora_inicio_venta ? String(area.hora_inicio_venta).slice(0, 5) : '07:00'} - {area.hora_fin_venta ? String(area.hora_fin_venta).slice(0, 5) : '17:00'}
                    </span>
                    <br />
                    <small style={{ color: area.horario_activo ? '#16a34a' : '#64748b' }}>
                      {area.horario_activo ? '🔒 Restringido' : '🔓 Libre'}
                    </small>
                  </td>
                  <td><span className={`user-status ${area.activo ? 'user-status--active' : ''}`}>{area.activo ? 'Activa' : 'Inactiva'}</span></td>
                  <td className="user-actions">
                    <button className="btn btn-ghost" type="button" onClick={() => openEditForm(area)}>Editar</button>
                    <button className="btn btn-danger" type="button" onClick={() => handleDelete(area)}>Eliminar</button>
                  </td>
                </tr>
              ))}
              {filteredAreas.length === 0 && <tr><td className="users-empty" colSpan="5">No hay areas que coincidan con la busqueda.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {isFormOpen && (
        <div className="modal-overlay" onClick={() => setIsFormOpen(false)}>
          <div className="modal-card area-form-card" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div><p className="eyebrow">Areas</p><h2>{editingId ? 'Editar area' : 'Agregar area'}</h2></div>
              <button type="button" className="close-btn" onClick={() => setIsFormOpen(false)} aria-label="Cerrar">×</button>
            </div>
            <form className="login-form" onSubmit={handleSubmit}>
              <label><span>Nombre</span><input name="nombre" value={form.nombre} onChange={handleChange} required /></label>
              <label><span>Descripcion</span><textarea name="descripcion" value={form.descripcion} onChange={handleChange} rows="3" /></label>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <label><span>Hora inicio venta</span><input type="time" name="hora_inicio_venta" value={form.hora_inicio_venta} onChange={handleChange} /></label>
                <label><span>Hora fin venta</span><input type="time" name="hora_fin_venta" value={form.hora_fin_venta} onChange={handleChange} /></label>
              </div>

              <label className="user-active-toggle"><input name="horario_activo" type="checkbox" checked={form.horario_activo} onChange={handleChange} /><span>Activar restriccion de horario de venta</span></label>
              <label className="user-active-toggle"><input name="activo" type="checkbox" checked={form.activo} onChange={handleChange} /><span>Area activa</span></label>
              <button className="btn btn-primary btn-block" type="submit" disabled={isSaving}>{isSaving ? 'Guardando...' : 'Guardar area'}</button>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}

export default AreaCrm