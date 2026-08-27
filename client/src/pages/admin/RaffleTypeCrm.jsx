import { useEffect, useState } from 'react'

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000'

const WEEK_DAYS = [
  { id: 1, label: 'Lunes' },
  { id: 2, label: 'Martes' },
  { id: 3, label: 'Miercoles' },
  { id: 4, label: 'Jueves' },
  { id: 5, label: 'Viernes' },
  { id: 6, label: 'Sabado' },
  { id: 0, label: 'Domingo' },
]

const emptyForm = {
  nombre: '',
  descripcion: '',
  color_primario: '#000000',
  color_secundario: '#FFFFFF',
  dias_creacion_auto: [],
  hora_juego_auto: '18:00',
  auto_creacion_activa: false,
  sorteos_auto: 1,
}

const request = async (path, options = {}) => {
  const response = await fetch(`${apiUrl}${path}`, options)
  const data = await response.json()
  if (!response.ok) throw new Error(data.message || 'No se pudo completar la solicitud')
  return data
}

const formatDaysLabel = (days) => {
  if (!Array.isArray(days) || days.length === 0) return 'Sin dias'
  const map = { 1: 'Lun', 2: 'Mar', 3: 'Mie', 4: 'Jue', 5: 'Vie', 6: 'Sab', 0: 'Dom' }
  return days.map((d) => map[d]).filter(Boolean).join(', ')
}

function RaffleTypeCrm() {
  const [types, setTypes] = useState([])
  const [search, setSearch] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const loadTypes = async () => {
    try {
      setIsLoading(true)
      setError('')
      setTypes(await request('/api/raffle-types'))
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadTypes()
  }, [])

  const openCreateForm = () => {
    setEditingId(null)
    setForm(emptyForm)
    setError('')
    setSuccessMsg('')
    setIsFormOpen(true)
  }

  const openEditForm = (type) => {
    setEditingId(type.id)
    let parsedDays = []
    if (Array.isArray(type.dias_creacion_auto)) {
      parsedDays = type.dias_creacion_auto.map(Number)
    } else if (typeof type.dias_creacion_auto === 'string') {
      try { parsedDays = JSON.parse(type.dias_creacion_auto).map(Number) } catch { parsedDays = [] }
    }

    setForm({
      nombre: type.nombre || '',
      descripcion: type.descripcion || '',
      color_primario: type.color_primario || '#000000',
      color_secundario: type.color_secundario || '#FFFFFF',
      dias_creacion_auto: parsedDays,
      hora_juego_auto: type.hora_juego_auto ? String(type.hora_juego_auto).slice(0, 5) : '18:00',
      auto_creacion_activa: Boolean(type.auto_creacion_activa),
      sorteos_auto: Number(type.sorteos_auto) || 1,
    })
    setError('')
    setSuccessMsg('')
    setIsFormOpen(true)
  }

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target
    setForm((currentForm) => ({
      ...currentForm,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  const toggleDay = (dayId) => {
    setForm((current) => {
      const currentDays = current.dias_creacion_auto || []
      const exists = currentDays.includes(dayId)
      return {
        ...current,
        dias_creacion_auto: exists
          ? currentDays.filter((id) => id !== dayId)
          : [...currentDays, dayId],
      }
    })
  }

  const applyPresetDays = (daysArray) => {
    setForm((current) => ({ ...current, dias_creacion_auto: daysArray, auto_creacion_activa: true }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    try {
      setIsSaving(true)
      setError('')
      setSuccessMsg('')

      const payload = {
        ...form,
        hora_juego_auto: `${form.hora_juego_auto}:00`,
      }

      await request(editingId ? `/api/raffle-types/${editingId}` : '/api/raffle-types', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      setIsFormOpen(false)
      setSuccessMsg('Tipo de rifa guardado correctamente. Se han sincronizado las rifas automaticas.')
      await loadTypes()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleTriggerAutoGenerate = async () => {
    try {
      setIsGenerating(true)
      setError('')
      setSuccessMsg('')
      const res = await request('/api/raffle-types/auto-generate', { method: 'POST' })
      if (res.createdCount > 0) {
        setSuccessMsg(`Se crearon ${res.createdCount} rifa(s) de manera automatica.`)
      } else {
        setSuccessMsg('No habia rifas pendientes por generar.')
      }
      await loadTypes()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleDelete = async (type) => {
    if (!window.confirm(`Eliminar el tipo de rifa ${type.nombre}?`)) return
    try {
      setError('')
      setSuccessMsg('')
      await request(`/api/raffle-types/${type.id}`, { method: 'DELETE' })
      await loadTypes()
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  const filteredTypes = types.filter((type) => `${type.nombre || ''} ${type.descripcion || ''}`.toLowerCase().includes(search.trim().toLowerCase()))

  return (
    <section className="raffle-types-crm">
      <div className="users-toolbar">
        <label className="user-search">
          <span>Buscar</span>
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nombre o descripcion" />
        </label>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-ghost" type="button" onClick={handleTriggerAutoGenerate} disabled={isGenerating}>
            {isGenerating ? 'Generando...' : '⚡ Generar rifas ahora'}
          </button>
          <button className="btn btn-primary" type="button" onClick={openCreateForm}>
            Agregar tipo
          </button>
        </div>
      </div>

      {successMsg && <p className="dashboard-message dashboard-message--success">{successMsg}</p>}
      {error && <p className="dashboard-message dashboard-message--error">{error}</p>}
      {isLoading && <p className="dashboard-message">Cargando tipos de rifa...</p>}

      {!isLoading && (
        <div className="raffle-type-grid">
          {filteredTypes.map((type) => {
            const days = Array.isArray(type.dias_creacion_auto)
              ? type.dias_creacion_auto
              : typeof type.dias_creacion_auto === 'string'
                ? JSON.parse(type.dias_creacion_auto || '[]')
                : []
            const isAutoActive = Boolean(type.auto_creacion_activa)

            return (
              <article key={type.id} className="raffle-type-card" style={{ '--type-primary': type.color_primario, '--type-secondary': type.color_secundario }}>
                <div className="raffle-type-colors"><span /><span /></div>
                <div>
                  <strong>{type.nombre}</strong>
                  <p>{type.descripcion || 'Sin descripcion'}</p>
                </div>
                <div style={{ fontSize: '0.8rem', margin: '0.35rem 0', color: isAutoActive ? '#15803d' : '#64748b' }}>
                  <strong>{isAutoActive ? '🔄 Auto-creacion activa:' : '⚪ Auto-creacion desactivada'}</strong>
                  {isAutoActive && (
                    <div>
                      📅 {formatDaysLabel(days)} @ {type.hora_juego_auto ? String(type.hora_juego_auto).slice(0, 5) : '18:00'} ({type.sorteos_auto || 1} sorteo/s)
                    </div>
                  )}
                </div>
                <small>#{type.id} · {type.color_primario} / {type.color_secundario}</small>
                <div className="image-library-actions">
                  <button className="btn btn-ghost" type="button" onClick={() => openEditForm(type)}>Editar</button>
                  <button className="btn btn-danger" type="button" onClick={() => handleDelete(type)}>Eliminar</button>
                </div>
              </article>
            )
          })}
          {filteredTypes.length === 0 && <p className="empty-list">No hay tipos de rifa registrados.</p>}
        </div>
      )}

      {isFormOpen && (
        <div className="modal-overlay" onClick={() => setIsFormOpen(false)}>
          <div className="modal-card raffle-type-form-card" onClick={(event) => event.stopPropagation()} style={{ maxWidth: '540px' }}>
            <div className="modal-header">
              <div>
                <p className="eyebrow">Tipos de rifa</p>
                <h2>{editingId ? 'Editar tipo' : 'Agregar tipo'}</h2>
              </div>
              <button type="button" className="close-btn" onClick={() => setIsFormOpen(false)} aria-label="Cerrar">×</button>
            </div>

            <form className="login-form" onSubmit={handleSubmit}>
              <label>
                <span>Nombre</span>
                <input name="nombre" value={form.nombre} onChange={handleChange} required />
              </label>

              <label>
                <span>Descripcion</span>
                <textarea name="descripcion" value={form.descripcion} onChange={handleChange} rows="3" />
              </label>

              <div className="color-input-grid">
                <label>
                  <span>Color primario</span>
                  <input name="color_primario" type="color" value={form.color_primario} onChange={handleChange} />
                </label>
                <label>
                  <span>Color secundario</span>
                  <input name="color_secundario" type="color" value={form.color_secundario} onChange={handleChange} />
                </label>
              </div>

              <hr style={{ margin: '1rem 0', borderColor: '#e2e8f0' }} />

              <div style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <strong style={{ fontSize: '0.9rem', color: '#1e293b', display: 'block', marginBottom: '0.5rem' }}>
                  📅 Creacion Automatica de Rifas por Dia
                </strong>

                <label className="user-active-toggle" style={{ marginBottom: '0.75rem' }}>
                  <input
                    type="checkbox"
                    name="auto_creacion_activa"
                    checked={form.auto_creacion_activa}
                    onChange={handleChange}
                  />
                  <span>Activar generacion automatica semanal</span>
                </label>

                <div style={{ marginBottom: '0.75rem' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '0.35rem' }}>
                    Dias de la semana en que se crea la rifa:
                  </span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                    {WEEK_DAYS.map((day) => {
                      const isSelected = (form.dias_creacion_auto || []).includes(day.id)
                      return (
                        <button
                          key={day.id}
                          type="button"
                          className={`btn ${isSelected ? 'btn-primary' : 'btn-ghost'}`}
                          style={{ padding: '0.3rem 0.6rem', fontSize: '0.78rem' }}
                          onClick={() => toggleDay(day.id)}
                        >
                          {isSelected ? '✓ ' : ''}{day.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.75rem' }}>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ padding: '0.2rem 0.4rem', fontSize: '0.72rem' }}
                    onClick={() => applyPresetDays([1, 2, 3, 4, 5, 6])}
                  >
                    Lun a Sab (1-6)
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ padding: '0.2rem 0.4rem', fontSize: '0.72rem' }}
                    onClick={() => applyPresetDays([1, 3, 4, 6])}
                  >
                    Lun, Mie, Jue, Sab (1,3,4,6)
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ padding: '0.2rem 0.4rem', fontSize: '0.72rem' }}
                    onClick={() => applyPresetDays([0, 1, 2, 3, 4, 5, 6])}
                  >
                    Todos los dias
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <label style={{ margin: 0 }}>
                    <span style={{ fontSize: '0.8rem' }}>Hora del Sorteo</span>
                    <input
                      type="time"
                      name="hora_juego_auto"
                      value={form.hora_juego_auto}
                      onChange={handleChange}
                    />
                  </label>

                  <label style={{ margin: 0 }}>
                    <span style={{ fontSize: '0.8rem' }}>Cantidad de Sorteos</span>
                    <input
                      type="number"
                      name="sorteos_auto"
                      min="1"
                      max="100"
                      value={form.sorteos_auto}
                      onChange={handleChange}
                    />
                  </label>
                </div>
              </div>

              <button className="btn btn-primary btn-block" type="submit" disabled={isSaving} style={{ marginTop: '1rem' }}>
                {isSaving ? 'Guardando...' : 'Guardar tipo de rifa'}
              </button>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}

export default RaffleTypeCrm