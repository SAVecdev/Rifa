import { useEffect, useState } from 'react'

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000'
const emptyForm = { id_tipo_rifa: '', id_area: '', id_imagen: '', id_usuario: '' }

const request = async (path, options = {}) => {
  const response = await fetch(`${apiUrl}${path}`, options)
  const data = await response.json()
  if (!response.ok) throw new Error(data.message || 'No se pudo completar la solicitud')
  return data
}

const imageUrl = (ruta) => (ruta?.startsWith('http') ? ruta : `${apiUrl}${ruta}`)

function RaffleLogoCrm() {
  const [logos, setLogos] = useState([])
  const [types, setTypes] = useState([])
  const [areas, setAreas] = useState([])
  const [images, setImages] = useState([])
  const [users, setUsers] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  const loadData = async () => {
    try {
      setIsLoading(true)
      setError('')
      const [loadedLogos, loadedTypes, loadedAreas, loadedImages, loadedUsers] = await Promise.all([
        request('/api/raffle-logos'),
        request('/api/raffle-types'),
        request('/api/areas'),
        request('/api/images'),
        request('/api/users'),
      ])
      setLogos(loadedLogos)
      setTypes(loadedTypes)
      setAreas(loadedAreas)
      setImages(loadedImages)
      setUsers(loadedUsers)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const openCreateForm = () => {
    setEditingId(null)
    setForm(emptyForm)
    setError('')
    setIsFormOpen(true)
  }

  const openEditForm = (logo) => {
    setEditingId(logo.id)
    setForm({
      id_tipo_rifa: String(logo.id_tipo_rifa),
      id_area: String(logo.id_area),
      id_imagen: String(logo.id_imagen),
      id_usuario: String(logo.id_usuario),
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
      const payload = Object.fromEntries(Object.entries(form).map(([key, value]) => [key, Number(value)]))
      await request(editingId ? `/api/raffle-logos/${editingId}` : '/api/raffle-logos', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      setIsFormOpen(false)
      await loadData()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (logo) => {
    if (!window.confirm(`Eliminar la asignacion de logo #${logo.id}?`)) return
    try {
      setError('')
      await request(`/api/raffle-logos/${logo.id}`, { method: 'DELETE' })
      await loadData()
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  const typeById = new Map(types.map((type) => [type.id, type]))
  const areaById = new Map(areas.map((area) => [area.id, area]))
  const imageById = new Map(images.map((image) => [image.id, image]))
  const userById = new Map(users.map((user) => [user.id, user]))
  const selectedImage = imageById.get(Number(form.id_imagen))

  return (
    <section className="raffle-logos-crm">
      <div className="users-toolbar">
        <div><p className="crm-context">Personaliza el logo que se muestra por tipo de rifa y area.</p></div>
        <button className="btn btn-primary" type="button" onClick={openCreateForm}>Asignar logo</button>
      </div>
      {error && <p className="dashboard-message dashboard-message--error">{error}</p>}
      {isLoading && <p className="dashboard-message">Cargando asignaciones de logo...</p>}

      {!isLoading && <div className="raffle-logo-grid">
        {logos.map((logo) => {
          const image = imageById.get(logo.id_imagen)
          const type = typeById.get(logo.id_tipo_rifa)
          const area = areaById.get(logo.id_area)
          const user = userById.get(logo.id_usuario)
          return <article key={logo.id} className="raffle-logo-card">
            {image ? <img src={imageUrl(image.ruta)} alt={image.nombre || 'Logo de rifa'} /> : <div className="admin-raffle-image-placeholder">Imagen no disponible</div>}
            <div className="raffle-logo-content">
              <strong>{type?.nombre || 'Tipo no disponible'}</strong>
              <span>{area?.nombre || 'Area no disponible'}</span>
              <small>Asignado por {user?.nombre || 'Usuario no disponible'}</small>
            </div>
            <div className="image-library-actions"><button className="btn btn-ghost" type="button" onClick={() => openEditForm(logo)}>Editar</button><button className="btn btn-danger" type="button" onClick={() => handleDelete(logo)}>Eliminar</button></div>
          </article>
        })}
        {logos.length === 0 && <p className="empty-list">No hay logos asignados.</p>}
      </div>}

      {isFormOpen && <div className="modal-overlay" onClick={() => setIsFormOpen(false)}><div className="modal-card raffle-logo-form-card" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header"><div><p className="eyebrow">Logos de rifa</p><h2>{editingId ? 'Editar asignacion' : 'Asignar logo'}</h2></div><button type="button" className="close-btn" onClick={() => setIsFormOpen(false)} aria-label="Cerrar">×</button></div>
        <form className="login-form" onSubmit={handleSubmit}>
          <label><span>Tipo de rifa</span><select name="id_tipo_rifa" value={form.id_tipo_rifa} onChange={handleChange} required><option value="">Selecciona un tipo</option>{types.map((type) => <option key={type.id} value={type.id}>{type.nombre}</option>)}</select></label>
          <label><span>Area</span><select name="id_area" value={form.id_area} onChange={handleChange} required><option value="">Selecciona un area</option>{areas.map((area) => <option key={area.id} value={area.id}>{area.nombre}</option>)}</select></label>
          <label><span>Imagen local</span><select name="id_imagen" value={form.id_imagen} onChange={handleChange} required><option value="">Selecciona una imagen</option>{images.map((image) => <option key={image.id} value={image.id}>{image.nombre || `Imagen #${image.id}`}</option>)}</select></label>
          {selectedImage && <img className="image-edit-preview" src={imageUrl(selectedImage.ruta)} alt="Vista previa de logo" />}
          <label><span>Usuario responsable</span><select name="id_usuario" value={form.id_usuario} onChange={handleChange} required><option value="">Selecciona un usuario</option>{users.map((user) => <option key={user.id} value={user.id}>{user.nombre} ({user.correo})</option>)}</select></label>
          <button className="btn btn-primary btn-block" type="submit" disabled={isSaving}>{isSaving ? 'Guardando...' : 'Guardar asignacion'}</button>
        </form>
      </div></div>}
    </section>
  )
}

export default RaffleLogoCrm