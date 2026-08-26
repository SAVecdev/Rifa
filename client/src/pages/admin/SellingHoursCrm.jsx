import { useEffect, useState } from 'react'

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000'

const request = async (path, options = {}) => {
  const response = await fetch(`${apiUrl}${path}`, options)
  const data = await response.json()
  if (!response.ok) throw new Error(data.message || 'No se pudo completar la solicitud')
  return data
}

const formatTime = (timeValue) => {
  if (!timeValue) return '07:00'
  return String(timeValue).slice(0, 5)
}

function SellingHoursCrm() {
  const [areas, setAreas] = useState([])
  const [search, setSearch] = useState('')
  const [editingArea, setEditingArea] = useState(null)
  const [form, setForm] = useState({ hora_inicio_venta: '07:00', hora_fin_venta: '17:00', horario_activo: false })
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const loadAreas = async () => {
    try {
      setIsLoading(true)
      setError('')
      const data = await request('/api/areas')
      setAreas(data || [])
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadAreas()
  }, [])

  const openEditModal = (area) => {
    setEditingArea(area)
    setForm({
      hora_inicio_venta: formatTime(area.hora_inicio_venta),
      hora_fin_venta: formatTime(area.hora_fin_venta),
      horario_activo: Boolean(area.horario_activo),
    })
    setError('')
    setSuccessMessage('')
    setIsFormOpen(true)
  }

  const applyPreset = (start, end, active = true) => {
    setForm({
      hora_inicio_venta: start,
      hora_fin_venta: end,
      horario_activo: active,
    })
  }

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target
    setForm((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!editingArea) return

    try {
      setIsSaving(true)
      setError('')
      setSuccessMessage('')

      const payload = {
        hora_inicio_venta: `${form.hora_inicio_venta}:00`,
        hora_fin_venta: `${form.hora_fin_venta}:00`,
        horario_activo: Boolean(form.horario_activo),
      }

      await request(`/api/areas/${editingArea.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      setIsFormOpen(false)
      setSuccessMessage(`Horario de venta para el area "${editingArea.nombre}" guardado correctamente.`)
      await loadAreas()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsSaving(false)
    }
  }

  const toggleQuickActive = async (area) => {
    try {
      setError('')
      setSuccessMessage('')
      await request(`/api/areas/${area.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ horario_activo: !area.horario_activo }),
      })
      await loadAreas()
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  const filteredAreas = areas.filter((area) => {
    const term = search.trim().toLowerCase()
    return !term || (area.nombre || '').toLowerCase().includes(term) || (area.descripcion || '').toLowerCase().includes(term)
  })

  return (
    <section className="selling-hours-crm">
      <div className="users-toolbar">
        <label className="user-search">
          <span>Buscar area</span>
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nombre del area..." />
        </label>
        <button className="btn btn-ghost" type="button" onClick={loadAreas} disabled={isLoading}>
          🔄 Actualizar
        </button>
      </div>

      <div className="dashboard-message" style={{ background: 'var(--color-surface, #f8fafc)', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem', marginBottom: '1.5rem' }}>
        <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', color: '#1e293b' }}>🕒 Administracion de Horarios de Venta para Vendedores</h3>
        <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748b', lineHeight: '1.4' }}>
          Configura los rangos de horario permitidos para que los vendedores realicen ventas por area. Si la restriccion esta <strong>activa</strong>,
          el sistema bloqueara cualquier intento de venta o apertura de factura fuera del rango de horas especificado (ejemplo: 07:00 a 17:00).
        </p>
      </div>

      {successMessage && <p className="dashboard-message dashboard-message--success">{successMessage}</p>}
      {error && <p className="dashboard-message dashboard-message--error">{error}</p>}
      {isLoading && <p className="dashboard-message">Cargando horario de ventas por area...</p>}

      {!isLoading && (
        <div className="users-table-wrap">
          <table className="users-table">
            <thead>
              <tr>
                <th>Area</th>
                <th>Horario Permitido</th>
                <th>Estado de Restriccion</th>
                <th>Area Activa</th>
                <th aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {filteredAreas.map((area) => {
                const start = formatTime(area.hora_inicio_venta)
                const end = formatTime(area.hora_fin_venta)
                const isRestricted = Boolean(area.horario_activo)

                return (
                  <tr key={area.id}>
                    <td>
                      <strong>{area.nombre}</strong>
                      <span>#{area.id} {area.descripcion ? `· ${area.descripcion}` : ''}</span>
                    </td>
                    <td>
                      <strong style={{ fontSize: '1rem', color: isRestricted ? '#0f172a' : '#64748b' }}>
                        🕒 {start} - {end}
                      </strong>
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() => toggleQuickActive(area)}
                        className={`user-status ${isRestricted ? 'user-status--active' : ''}`}
                        style={{ border: 'none', cursor: 'pointer' }}
                        title="Haz clic para activar o desactivar la restriccion de horario"
                      >
                        {isRestricted ? '🔒 Restriccion Activa' : '🔓 Sin Restriccion (24h)'}
                      </button>
                    </td>
                    <td>
                      <span className={`user-status ${area.activo ? 'user-status--active' : ''}`}>
                        {area.activo ? 'Activa' : 'Inactiva'}
                      </span>
                    </td>
                    <td className="user-actions">
                      <button className="btn btn-primary" type="button" onClick={() => openEditModal(area)}>
                        ⚙️ Configurar horario
                      </button>
                    </td>
                  </tr>
                )
              })}
              {filteredAreas.length === 0 && (
                <tr>
                  <td className="users-empty" colSpan="5">No se encontraron areas.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {isFormOpen && editingArea && (
        <div className="modal-overlay" onClick={() => setIsFormOpen(false)}>
          <div className="modal-card area-form-card" onClick={(event) => event.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <div>
                <p className="eyebrow">Horario de Venta</p>
                <h2>{editingArea.nombre}</h2>
              </div>
              <button type="button" className="close-btn" onClick={() => setIsFormOpen(false)} aria-label="Cerrar">×</button>
            </div>

            <form className="login-form" onSubmit={handleSubmit}>
              <p style={{ fontSize: '0.875rem', color: '#64748b', marginTop: 0 }}>
                Define la hora de inicio y fin en la que los vendedores de <strong>{editingArea.nombre}</strong> pueden vender.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <label>
                  <span>Hora Inicio</span>
                  <input
                    type="time"
                    name="hora_inicio_venta"
                    value={form.hora_inicio_venta}
                    onChange={handleChange}
                    required
                  />
                </label>

                <label>
                  <span>Hora Fin</span>
                  <input
                    type="time"
                    name="hora_fin_venta"
                    value={form.hora_fin_venta}
                    onChange={handleChange}
                    required
                  />
                </label>
              </div>

              <div style={{ margin: '0.75rem 0' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '0.35rem' }}>Plantillas rapidas:</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  <button type="button" className="btn btn-ghost" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }} onClick={() => applyPreset('07:00', '17:00')}>
                    07:00 - 17:00 (Ejemplo)
                  </button>
                  <button type="button" className="btn btn-ghost" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }} onClick={() => applyPreset('08:00', '18:00')}>
                    08:00 - 18:00
                  </button>
                  <button type="button" className="btn btn-ghost" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }} onClick={() => applyPreset('06:00', '20:00')}>
                    06:00 - 20:00
                  </button>
                  <button type="button" className="btn btn-ghost" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }} onClick={() => applyPreset('00:00', '23:59', false)}>
                    Sin restriccion (24h)
                  </button>
                </div>
              </div>

              <label className="user-active-toggle" style={{ marginTop: '0.5rem' }}>
                <input
                  type="checkbox"
                  name="horario_activo"
                  checked={form.horario_activo}
                  onChange={handleChange}
                />
                <span>Activar restriccion estricta de horario para vendedores</span>
              </label>

              <button className="btn btn-primary btn-block" type="submit" disabled={isSaving} style={{ marginTop: '1rem' }}>
                {isSaving ? 'Guardando...' : 'Guardar Horario'}
              </button>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}

export default SellingHoursCrm
