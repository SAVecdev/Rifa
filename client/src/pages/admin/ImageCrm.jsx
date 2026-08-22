import { useEffect, useState } from 'react'

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000'

const request = async (path, options = {}) => {
  const response = await fetch(`${apiUrl}${path}`, options)
  const data = await response.json()
  if (!response.ok) throw new Error(data.message || 'No se pudo completar la solicitud')
  return data
}

const imageUrl = (ruta) => (ruta?.startsWith('http') ? ruta : `${apiUrl}${ruta}`)

function ImageCrm() {
  const [images, setImages] = useState([])
  const [search, setSearch] = useState('')
  const [selectedImage, setSelectedImage] = useState(null)
  const [name, setName] = useState('')
  const [file, setFile] = useState(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  const loadImages = async () => {
    try {
      setIsLoading(true)
      setError('')
      setImages(await request('/api/images'))
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadImages()
  }, [])

  const openUploadForm = () => {
    setSelectedImage(null)
    setName('')
    setFile(null)
    setError('')
    setIsFormOpen(true)
  }

  const openEditForm = (image) => {
    setSelectedImage(image)
    setName(image.nombre || '')
    setFile(null)
    setError('')
    setIsFormOpen(true)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    try {
      setIsSaving(true)
      setError('')

      if (selectedImage) {
        await request(`/api/images/${selectedImage.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nombre: name }),
        })
      } else {
        if (!file) throw new Error('Selecciona una imagen para subir')
        const body = new FormData()
        body.append('nombre', name)
        body.append('image', file)
        await request('/api/images', { method: 'POST', body })
      }

      setIsFormOpen(false)
      await loadImages()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (image) => {
    if (!window.confirm(`Eliminar la imagen ${image.nombre || image.id}?`)) return

    try {
      setError('')
      await request(`/api/images/${image.id}`, { method: 'DELETE' })
      await loadImages()
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  const filteredImages = images.filter((image) => image.nombre?.toLowerCase().includes(search.trim().toLowerCase()))

  return (
    <section className="images-crm">
      <div className="users-toolbar">
        <label className="user-search">
          <span>Buscar</span>
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nombre de imagen" />
        </label>
        <button className="btn btn-primary" type="button" onClick={openUploadForm}>Subir imagen</button>
      </div>

      {error && <p className="dashboard-message dashboard-message--error">{error}</p>}
      {isLoading && <p className="dashboard-message">Cargando imagenes...</p>}

      {!isLoading && (
        <div className="image-grid">
          {filteredImages.map((image) => (
            <article key={image.id} className="image-library-item">
              <img src={imageUrl(image.ruta)} alt={image.nombre || 'Imagen sin nombre'} />
              <div className="image-library-info">
                <strong>{image.nombre || 'Sin nombre'}</strong>
                <span>#{image.id}</span>
              </div>
              <div className="image-library-actions">
                <button className="btn btn-ghost" type="button" onClick={() => openEditForm(image)}>Editar</button>
                <button className="btn btn-danger" type="button" onClick={() => handleDelete(image)}>Eliminar</button>
              </div>
            </article>
          ))}
          {filteredImages.length === 0 && <p className="empty-list">No hay imagenes registradas.</p>}
        </div>
      )}

      {isFormOpen && (
        <div className="modal-overlay" onClick={() => setIsFormOpen(false)}>
          <div className="modal-card image-form-card" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <p className="eyebrow">Biblioteca local</p>
                <h2>{selectedImage ? 'Editar imagen' : 'Subir imagen'}</h2>
              </div>
              <button type="button" className="close-btn" onClick={() => setIsFormOpen(false)} aria-label="Cerrar">×</button>
            </div>
            <form className="login-form" onSubmit={handleSubmit}>
              {selectedImage && <img className="image-edit-preview" src={imageUrl(selectedImage.ruta)} alt={selectedImage.nombre || 'Imagen seleccionada'} />}
              <label><span>Nombre</span><input value={name} onChange={(event) => setName(event.target.value)} required /></label>
              {!selectedImage && <label><span>Archivo de imagen</span><input type="file" accept="image/avif,image/gif,image/jpeg,image/png,image/webp" onChange={(event) => setFile(event.target.files?.[0] || null)} required /></label>}
              <button type="submit" className="btn btn-primary btn-block" disabled={isSaving}>{isSaving ? 'Guardando...' : 'Guardar imagen'}</button>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}

export default ImageCrm