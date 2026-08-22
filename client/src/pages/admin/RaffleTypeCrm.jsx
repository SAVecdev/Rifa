import { useEffect, useState } from 'react'

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000'
const emptyForm = { nombre: '', descripcion: '', color_primario: '#000000', color_secundario: '#FFFFFF' }

const request = async (path, options = {}) => {
  const response = await fetch(`${apiUrl}${path}`, options)
  const data = await response.json()
  if (!response.ok) throw new Error(data.message || 'No se pudo completar la solicitud')
  return data
}

function RaffleTypeCrm() {
  const [types, setTypes] = useState([])
  const [search, setSearch] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

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
    setIsFormOpen(true)
  }

  const openEditForm = (type) => {
    setEditingId(type.id)
    setForm({
      nombre: type.nombre || '',
      descripcion: type.descripcion || '',
      color_primario: type.color_primario || '#000000',
      color_secundario: type.color_secundario || '#FFFFFF',
    })
    setError('')
    setIsFormOpen(true)
  }

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((currentForm) => ({ ...currentForm, [name]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    try {
      setIsSaving(true)
      setError('')
      await request(editingId ? `/api/raffle-types/${editingId}` : '/api/raffle-types', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      setIsFormOpen(false)
      await loadTypes()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (type) => {
    if (!window.confirm(`Eliminar el tipo de rifa ${type.nombre}?`)) return
    try {
      setError('')
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
        <label className="user-search"><span>Buscar</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nombre o descripcion" /></label>
        <button className="btn btn-primary" type="button" onClick={openCreateForm}>Agregar tipo</button>
      </div>
      {error && <p className="dashboard-message dashboard-message--error">{error}</p>}
      {isLoading && <p className="dashboard-message">Cargando tipos de rifa...</p>}

      {!isLoading && <div className="raffle-type-grid">
        {filteredTypes.map((type) => (
          <article key={type.id} className="raffle-type-card" style={{ '--type-primary': type.color_primario, '--type-secondary': type.color_secundario }}>
            <div className="raffle-type-colors"><span /><span /></div>
            <div><strong>{type.nombre}</strong><p>{type.descripcion || 'Sin descripcion'}</p></div>
            <small>#{type.id} · {type.color_primario} / {type.color_secundario}</small>
            <div className="image-library-actions"><button className="btn btn-ghost" type="button" onClick={() => openEditForm(type)}>Editar</button><button className="btn btn-danger" type="button" onClick={() => handleDelete(type)}>Eliminar</button></div>
          </article>
        ))}
        {filteredTypes.length === 0 && <p className="empty-list">No hay tipos de rifa registrados.</p>}
      </div>}

      {isFormOpen && <div className="modal-overlay" onClick={() => setIsFormOpen(false)}><div className="modal-card raffle-type-form-card" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header"><div><p className="eyebrow">Tipos de rifa</p><h2>{editingId ? 'Editar tipo' : 'Agregar tipo'}</h2></div><button type="button" className="close-btn" onClick={() => setIsFormOpen(false)} aria-label="Cerrar">×</button></div>
        <form className="login-form" onSubmit={handleSubmit}>
          <label><span>Nombre</span><input name="nombre" value={form.nombre} onChange={handleChange} required /></label>
          <label><span>Descripcion</span><textarea name="descripcion" value={form.descripcion} onChange={handleChange} rows="4" /></label>
          <div className="color-input-grid">
            <label><span>Color primario</span><input name="color_primario" type="color" value={form.color_primario} onChange={handleChange} /></label>
            <label><span>Color secundario</span><input name="color_secundario" type="color" value={form.color_secundario} onChange={handleChange} /></label>
          </div>
          <button className="btn btn-primary btn-block" type="submit" disabled={isSaving}>{isSaving ? 'Guardando...' : 'Guardar tipo'}</button>
        </form>
      </div></div>}
    </section>
  )
}

export default RaffleTypeCrm