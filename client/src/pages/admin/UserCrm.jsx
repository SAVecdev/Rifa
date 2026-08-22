import { useEffect, useState } from 'react'

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000'

const emptyForm = {
  nombre: '',
  correo: '',
  password: '',
  rol: 'cliente',
  direccion: '',
  telefono: '',
  id_area: '',
  foto_perfil: '',
  activo: true,
}

const request = async (path, options = {}) => {
  const response = await fetch(`${apiUrl}${path}`, options)
  const data = await response.json()

  if (!response.ok) throw new Error(data.message || 'No se pudo completar la solicitud')
  return data
}

function UserCrm() {
  const [users, setUsers] = useState([])
  const [areas, setAreas] = useState([])
  const [photos, setPhotos] = useState([])
  const [search, setSearch] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false)
  const [error, setError] = useState('')

  const loadData = async () => {
    try {
      setIsLoading(true)
      setError('')
      const [loadedUsers, loadedAreas, loadedPhotos] = await Promise.all([
        request('/api/users'),
        request('/api/areas'),
        request('/api/uploads/profile-photos'),
      ])
      setUsers(loadedUsers)
      setAreas(loadedAreas)
      setPhotos(loadedPhotos)
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

  const openEditForm = (user) => {
    setEditingId(user.id)
    setForm({
      nombre: user.nombre || '',
      correo: user.correo || '',
      password: '',
      rol: user.rol || 'cliente',
      direccion: user.direccion || '',
      telefono: user.telefono || '',
      id_area: user.id_area ? String(user.id_area) : '',
      foto_perfil: user.foto_perfil || '',
      activo: Boolean(user.activo),
    })
    setError('')
    setIsFormOpen(true)
  }

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target
    setForm((currentForm) => ({
      ...currentForm,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  const profilePhotoUrl = (photoUrl) => {
    if (!photoUrl) return ''
    return photoUrl.startsWith('http') ? photoUrl : `${apiUrl}${photoUrl}`
  }

  const handlePhotoUpload = async (event) => {
    const photo = event.target.files?.[0]
    if (!photo) return

    try {
      setIsUploadingPhoto(true)
      setError('')
      const body = new FormData()
      body.append('photo', photo)
      const uploadedPhoto = await request('/api/uploads/profile-photos', {
        method: 'POST',
        body,
      })

      setPhotos((currentPhotos) => [uploadedPhoto, ...currentPhotos.filter((item) => item.name !== uploadedPhoto.name)])
      setForm((currentForm) => ({ ...currentForm, foto_perfil: uploadedPhoto.url }))
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsUploadingPhoto(false)
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    try {
      setIsSaving(true)
      setError('')
      const payload = {
        ...form,
        id_area: form.id_area ? Number(form.id_area) : null,
      }

      if (editingId && !payload.password) delete payload.password
      if (!editingId && !payload.password) throw new Error('La contrasena es obligatoria para crear un usuario')

      await request(editingId ? `/api/users/${editingId}` : '/api/users', {
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

  const handleDelete = async (user) => {
    if (!window.confirm(`Eliminar a ${user.nombre}? Esta accion no se puede deshacer.`)) return

    try {
      setError('')
      await request(`/api/users/${user.id}`, { method: 'DELETE' })
      await loadData()
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  const normalizedSearch = search.trim().toLowerCase()
  const filteredUsers = users.filter((user) => {
    const searchable = `${user.nombre || ''} ${user.correo || ''} ${user.rol || ''}`.toLowerCase()
    return searchable.includes(normalizedSearch)
  })

  const areaNameById = new Map(areas.map((area) => [area.id, area.nombre]))

  return (
    <section className="users-crm">
      <div className="users-toolbar">
        <label className="user-search">
          <span>Buscar</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Nombre, correo o rol"
          />
        </label>
        <button className="btn btn-primary" type="button" onClick={openCreateForm}>Agregar usuario</button>
      </div>

      {error && <p className="dashboard-message dashboard-message--error">{error}</p>}
      {isLoading && <p className="dashboard-message">Cargando usuarios...</p>}

      {!isLoading && (
        <div className="users-table-wrap">
          <table className="users-table">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Rol</th>
                <th>Area</th>
                <th>Estado</th>
                <th aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user.id}>
                  <td>
                    <strong>{user.nombre}</strong>
                    <span>{user.correo}</span>
                  </td>
                  <td>{user.rol}</td>
                  <td>{areaNameById.get(user.id_area) || 'Sin area'}</td>
                  <td><span className={`user-status ${user.activo ? 'user-status--active' : ''}`}>{user.activo ? 'Activo' : 'Inactivo'}</span></td>
                  <td className="user-actions">
                    <button className="btn btn-ghost" type="button" onClick={() => openEditForm(user)}>Editar</button>
                    <button className="btn btn-danger" type="button" onClick={() => handleDelete(user)}>Eliminar</button>
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 && (
                <tr>
                  <td className="users-empty" colSpan="5">No hay usuarios que coincidan con la busqueda.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {isFormOpen && (
        <div className="modal-overlay" onClick={() => setIsFormOpen(false)}>
          <div className="modal-card user-form-card" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <p className="eyebrow">Usuarios</p>
                <h2>{editingId ? 'Editar usuario' : 'Agregar usuario'}</h2>
              </div>
              <button type="button" className="close-btn" onClick={() => setIsFormOpen(false)} aria-label="Cerrar">×</button>
            </div>

            <form className="login-form" onSubmit={handleSubmit}>
              <label><span>Nombre</span><input name="nombre" value={form.nombre} onChange={handleChange} required /></label>
              <label><span>Correo</span><input name="correo" type="email" value={form.correo} onChange={handleChange} required /></label>
              <label><span>{editingId ? 'Nueva contrasena (opcional)' : 'Contrasena'}</span><input name="password" type="password" value={form.password} onChange={handleChange} required={!editingId} /></label>
              <div className="user-form-grid">
                <label><span>Rol</span><select name="rol" value={form.rol} onChange={handleChange}><option value="cliente">Cliente</option><option value="vendedor">Vendedor</option><option value="supervisor">Supervisor</option><option value="administrador">Administrador</option></select></label>
                <label><span>Area</span><select name="id_area" value={form.id_area} onChange={handleChange}><option value="">Sin area</option>{areas.map((area) => <option key={area.id} value={area.id}>{area.nombre}</option>)}</select></label>
              </div>
              <label><span>Telefono</span><input name="telefono" value={form.telefono} onChange={handleChange} /></label>
              <label><span>Direccion</span><input name="direccion" value={form.direccion} onChange={handleChange} /></label>
              <label><span>Subir foto de perfil</span><input type="file" accept="image/avif,image/gif,image/jpeg,image/png,image/webp" onChange={handlePhotoUpload} disabled={isUploadingPhoto} /></label>
              {isUploadingPhoto && <p className="photo-upload-status">Subiendo imagen...</p>}
              {photos.length > 0 && (
                <div className="profile-photo-gallery">
                  {photos.map((photo) => (
                    <button
                      key={photo.name}
                      className={`profile-photo-option ${form.foto_perfil === photo.url ? 'profile-photo-option--selected' : ''}`}
                      type="button"
                      onClick={() => setForm((currentForm) => ({ ...currentForm, foto_perfil: photo.url }))}
                    >
                      <img src={profilePhotoUrl(photo.url)} alt="Foto de perfil disponible" />
                    </button>
                  ))}
                </div>
              )}
              {form.foto_perfil && <img className="profile-photo-preview" src={profilePhotoUrl(form.foto_perfil)} alt="Vista previa de foto de perfil" />}
              <label className="user-active-toggle"><input name="activo" type="checkbox" checked={form.activo} onChange={handleChange} /><span>Usuario activo</span></label>
              <button type="submit" className="btn btn-primary btn-block" disabled={isSaving}>{isSaving ? 'Guardando...' : 'Guardar usuario'}</button>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}

export default UserCrm