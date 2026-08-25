import { useEffect, useState } from 'react'
import WinningNumbersModal from './WinningNumbersModal'

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000'
const emptyForm = { nombre: '', sorteos: '1', id_tipo: '', id_imagen: '', fecha_hora_juego: '' }

const request = async (path, options = {}) => {
  const response = await fetch(`${apiUrl}${path}`, options)
  const data = await response.json()
  if (!response.ok) throw new Error(data.message || 'No se pudo completar la solicitud')
  return data
}

const imageUrl = (ruta) => (ruta?.startsWith('http') ? ruta : `${apiUrl}${ruta}`)
const toDateTimeInput = (value) => (value ? new Date(value).toISOString().slice(0, 16) : '')

function RaffleCrm() {
  const [raffles, setRaffles] = useState([])
  const [types, setTypes] = useState([])
  const [images, setImages] = useState([])
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [selectedRaffleForPrizes, setSelectedRaffleForPrizes] = useState(null)
  const [error, setError] = useState('')

  const loadData = async () => {
    try {
      setIsLoading(true)
      setError('')
      const [loadedRaffles, loadedTypes, loadedImages] = await Promise.all([request('/api/raffles'), request('/api/raffle-types'), request('/api/images')])
      setRaffles(loadedRaffles)
      setTypes(loadedTypes)
      setImages(loadedImages)
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

  const openEditForm = (raffle) => {
    setEditingId(raffle.id)
    setForm({ nombre: raffle.nombre || '', sorteos: String(raffle.sorteos || 1), id_tipo: raffle.id_tipo ? String(raffle.id_tipo) : '', id_imagen: raffle.id_imagen ? String(raffle.id_imagen) : '', fecha_hora_juego: toDateTimeInput(raffle.fecha_hora_juego) })
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
      const payload = {
        nombre: form.nombre,
        sorteos: Number(form.sorteos),
        id_tipo: form.id_tipo ? Number(form.id_tipo) : null,
        id_imagen: form.id_imagen ? Number(form.id_imagen) : null,
        fecha_hora_juego: form.fecha_hora_juego ? new Date(form.fecha_hora_juego).toISOString() : undefined,
      }
      if (!payload.fecha_hora_juego) delete payload.fecha_hora_juego
      await request(editingId ? `/api/raffles/${editingId}` : '/api/raffles', { method: editingId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      setIsFormOpen(false)
      await loadData()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (raffle) => {
    if (!window.confirm(`Eliminar la rifa ${raffle.nombre}?`)) return
    try {
      setError('')
      await request(`/api/raffles/${raffle.id}`, { method: 'DELETE' })
      await loadData()
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  const typeById = new Map(types.map((type) => [type.id, type]))
  const imageById = new Map(images.map((image) => [image.id, image]))
  const filteredRaffles = raffles.filter((raffle) => raffle.nombre?.toLowerCase().includes(search.trim().toLowerCase()))
  const totalPages = Math.max(1, Math.ceil(filteredRaffles.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pageRaffles = filteredRaffles.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  return (
    <section className="raffles-crm">
      <div className="users-toolbar"><label className="user-search"><span>Buscar</span><input type="search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="Nombre de rifa" /></label><button className="btn btn-primary" type="button" onClick={openCreateForm}>Agregar rifa</button></div>
      {error && <p className="dashboard-message dashboard-message--error">{error}</p>}
      {isLoading && <p className="dashboard-message">Cargando rifas...</p>}
      {!isLoading && <div className="prize-options-table-toolbar"><span>{filteredRaffles.length} resultado(s)</span><label>Filas por pagina <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1) }}><option value="10">10</option><option value="25">25</option><option value="50">50</option></select></label></div>}
      {!isLoading && <div className="users-table-wrap"><table className="users-table raffles-table">
        <thead><tr><th>Imagen</th><th>Nombre</th><th>Sorteos</th><th>Tipo</th><th>Fecha del sorteo</th><th>Finalizacion</th><th aria-label="Acciones" /></tr></thead>
        <tbody>
          {pageRaffles.map((raffle) => {
            const type = typeById.get(raffle.id_tipo)
            const image = imageById.get(raffle.id_imagen)
            return <tr key={raffle.id}>
              <td>{image ? <img className="raffles-table-thumb" src={imageUrl(image.ruta)} alt={raffle.nombre} /> : <span className="admin-raffle-image-placeholder">Sin imagen</span>}</td>
              <td><strong>{raffle.nombre}</strong></td>
              <td>{raffle.sorteos} sorteo{raffle.sorteos === 1 ? '' : 's'}</td>
              <td>{type?.nombre || 'Sin tipo'}</td>
              <td>{new Date(raffle.fecha_hora_juego).toLocaleString('es-CO')}</td>
              <td>{raffle.fecha_hora_finalizacion ? new Date(raffle.fecha_hora_finalizacion).toLocaleString('es-CO') : 'Sin finalizar'}</td>
              <td className="user-actions"><button className="btn btn-ghost" type="button" onClick={() => setSelectedRaffleForPrizes(raffle)}>Premios</button><button className="btn btn-ghost" type="button" onClick={() => openEditForm(raffle)}>Editar</button><button className="btn btn-danger" type="button" onClick={() => handleDelete(raffle)}>Eliminar</button></td>
            </tr>
          })}
          {pageRaffles.length === 0 && <tr><td className="users-empty" colSpan="7">No hay rifas registradas.</td></tr>}
        </tbody>
      </table></div>}
      {!isLoading && filteredRaffles.length > 0 && <div className="pagination-bar"><span>Pagina {currentPage} de {totalPages}</span><div><button className="btn btn-ghost" type="button" disabled={currentPage === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Anterior</button><button className="btn btn-ghost" type="button" disabled={currentPage === totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>Siguiente</button></div></div>}


      {isFormOpen && <div className="modal-overlay" onClick={() => setIsFormOpen(false)}><div className="modal-card raffle-form-card" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header"><div><p className="eyebrow">Rifas</p><h2>{editingId ? 'Editar rifa' : 'Agregar rifa'}</h2></div><button type="button" className="close-btn" onClick={() => setIsFormOpen(false)} aria-label="Cerrar">×</button></div>
        <form className="login-form" onSubmit={handleSubmit}>
          <label><span>Nombre</span><input name="nombre" value={form.nombre} onChange={handleChange} required /></label>
          <div className="raffle-form-grid"><label><span>Sorteos</span><input name="sorteos" type="number" min="1" value={form.sorteos} onChange={handleChange} required /></label><label><span>Fecha y hora</span><input name="fecha_hora_juego" type="datetime-local" value={form.fecha_hora_juego} onChange={handleChange} /></label></div>
          <label><span>Tipo de rifa</span><select name="id_tipo" value={form.id_tipo} onChange={handleChange}><option value="">Sin tipo</option>{types.map((type) => <option key={type.id} value={type.id}>{type.nombre}</option>)}</select></label>
          <label><span>Imagen</span><select name="id_imagen" value={form.id_imagen} onChange={handleChange}><option value="">Sin imagen</option>{images.map((image) => <option key={image.id} value={image.id}>{image.nombre || `Imagen #${image.id}`}</option>)}</select></label>
          {form.id_imagen && imageById.get(Number(form.id_imagen)) && <img className="image-edit-preview" src={imageUrl(imageById.get(Number(form.id_imagen)).ruta)} alt="Vista previa de imagen" />}
          <button className="btn btn-primary btn-block" type="submit" disabled={isSaving}>{isSaving ? 'Guardando...' : 'Guardar rifa'}</button>
        </form>
      </div></div>}
      {selectedRaffleForPrizes && <WinningNumbersModal raffle={selectedRaffleForPrizes} onClose={() => setSelectedRaffleForPrizes(null)} onSaved={loadData} />}
    </section>
  )
}

export default RaffleCrm