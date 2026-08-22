import { useEffect, useState } from 'react'

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000'
const createPrizeLevels = () => Array.from({ length: 10 }, (_, index) => ({ nivel_premio: index + 1, numero_ganador: '' }))

const request = async (path, options = {}) => {
  const response = await fetch(`${apiUrl}${path}`, options)
  const data = await response.json()
  if (!response.ok) throw new Error(data.message || 'No se pudo completar la solicitud')
  return data
}

function WinningNumbersModal({ raffle, onClose, onSaved }) {
  const [winningNumbers, setWinningNumbers] = useState([])
  const [prizeLevels, setPrizeLevels] = useState(createPrizeLevels)
  const [draw, setDraw] = useState('1')
  const [editingId, setEditingId] = useState(null)
  const [editingForm, setEditingForm] = useState({ nivel_premio: '', numero_ganador: '', sorteo: '' })
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  const loadWinningNumbers = async () => {
    try {
      setIsLoading(true)
      setError('')
      setWinningNumbers(await request(`/api/winning-numbers?id_rifa=${raffle.id}`))
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadWinningNumbers()
  }, [raffle.id])

  const handlePrizeLevelChange = (level, value) => {
    setPrizeLevels((currentLevels) => currentLevels.map((item) => (
      item.nivel_premio === level ? { ...item, numero_ganador: value } : item
    )))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    try {
      setIsSaving(true)
      setError('')

      if (editingId) {
        await request(`/api/winning-numbers/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nivel_premio: Number(editingForm.nivel_premio),
            numero_ganador: editingForm.numero_ganador,
            sorteo: Number(editingForm.sorteo),
          }),
        })
      } else {
        const filledLevels = prizeLevels.filter((item) => item.numero_ganador.trim())
        if (filledLevels.length === 0) throw new Error('Ingresa al menos un numero ganador')

        await Promise.all(filledLevels.map((item) => request('/api/winning-numbers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id_rifa: raffle.id,
            nivel_premio: item.nivel_premio,
            numero_ganador: item.numero_ganador.trim(),
            sorteo: Number(draw),
          }),
        })))
      }

      setEditingId(null)
      setEditingForm({ nivel_premio: '', numero_ganador: '', sorteo: '' })
      setPrizeLevels(createPrizeLevels())
      await loadWinningNumbers()
      onSaved()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleEdit = (winningNumber) => {
    setEditingId(winningNumber.id)
    setEditingForm({
      nivel_premio: String(winningNumber.nivel_premio),
      numero_ganador: winningNumber.numero_ganador,
      sorteo: String(winningNumber.sorteo),
    })
  }

  const handleDelete = async (winningNumber) => {
    if (!window.confirm(`Eliminar el premio ${winningNumber.nivel_premio}?`)) return
    try {
      setError('')
      await request(`/api/winning-numbers/${winningNumber.id}`, { method: 'DELETE' })
      await loadWinningNumbers()
      onSaved()
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card prizes-modal-card" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div><p className="eyebrow">Premios de rifa</p><h2>{raffle.nombre}</h2></div>
          <button type="button" className="close-btn" onClick={onClose} aria-label="Cerrar">×</button>
        </div>
        {error && <p className="error-message">{error}</p>}
        <form className={`prize-form ${editingId ? 'prize-form--editing' : ''}`} onSubmit={handleSubmit}>
          {editingId ? <>
            <label><span>Nivel</span><input name="nivel_premio" type="number" min="1" max="10" value={editingForm.nivel_premio} onChange={(event) => setEditingForm((currentForm) => ({ ...currentForm, nivel_premio: event.target.value }))} required /></label>
            <label><span>Numero ganador</span><input name="numero_ganador" value={editingForm.numero_ganador} onChange={(event) => setEditingForm((currentForm) => ({ ...currentForm, numero_ganador: event.target.value }))} required /></label>
            <label><span>Sorteo</span><input name="sorteo" type="number" min="1" value={editingForm.sorteo} onChange={(event) => setEditingForm((currentForm) => ({ ...currentForm, sorteo: event.target.value }))} required /></label>
          </> : <>
            <label className="prize-draw-input"><span>Sorteo</span><input type="number" min="1" value={draw} onChange={(event) => setDraw(event.target.value)} required /></label>
            <div className="prize-level-grid">
              {prizeLevels.map((item) => <label key={item.nivel_premio}><span>Nivel {item.nivel_premio}</span><input value={item.numero_ganador} onChange={(event) => handlePrizeLevelChange(item.nivel_premio, event.target.value)} placeholder="Numero ganador" /></label>)}
            </div>
          </>}
          <button className="btn btn-primary" type="submit" disabled={isSaving}>{isSaving ? 'Guardando...' : editingId ? 'Actualizar premio' : 'Guardar niveles'}</button>
          {editingId && <button className="btn btn-ghost" type="button" onClick={() => { setEditingId(null); setEditingForm({ nivel_premio: '', numero_ganador: '', sorteo: '' }) }}>Cancelar</button>}
        </form>
        <div className="prizes-list">
          {isLoading && <p className="empty-list">Cargando premios...</p>}
          {!isLoading && winningNumbers.map((winningNumber) => <div key={winningNumber.id} className="prize-row">
            <div><strong>Premio {winningNumber.nivel_premio}</strong><span>Numero {winningNumber.numero_ganador} · Sorteo {winningNumber.sorteo}</span></div>
            <div className="user-actions"><button className="btn btn-ghost" type="button" onClick={() => handleEdit(winningNumber)}>Editar</button><button className="btn btn-danger" type="button" onClick={() => handleDelete(winningNumber)}>Eliminar</button></div>
          </div>)}
          {!isLoading && winningNumbers.length === 0 && <p className="empty-list">Aun no hay premios registrados.</p>}
        </div>
      </div>
    </div>
  )
}

export default WinningNumbersModal