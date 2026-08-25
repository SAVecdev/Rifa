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
  const [editingLevel, setEditingLevel] = useState(null)
  const [editingValue, setEditingValue] = useState('')
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

  useEffect(() => {
    if (Number(raffle.sorteos) <= 1) setDraw('1')
  }, [raffle.sorteos])

  const loadedByLevelForDraw = new Map(winningNumbers.filter((winningNumber) => winningNumber.sorteo === Number(draw)).map((winningNumber) => [winningNumber.nivel_premio, winningNumber]))
  const hasEditableLevels = prizeLevels.some((item) => !loadedByLevelForDraw.has(item.nivel_premio))

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
      const filledLevels = prizeLevels.filter((item) => item.numero_ganador.trim() && !loadedByLevelForDraw.has(item.nivel_premio))
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

      setPrizeLevels(createPrizeLevels())
      await loadWinningNumbers()
      onSaved()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsSaving(false)
    }
  }

  const startEditingLevel = (loaded) => {
    setEditingLevel(loaded.nivel_premio)
    setEditingValue(loaded.numero_ganador)
    setError('')
  }

  const cancelEditingLevel = () => {
    setEditingLevel(null)
    setEditingValue('')
  }

  const saveEditingLevel = async (loaded) => {
    try {
      setIsSaving(true)
      setError('')
      await request(`/api/winning-numbers/${loaded.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nivel_premio: loaded.nivel_premio, numero_ganador: editingValue.trim(), sorteo: loaded.sorteo }),
      })
      cancelEditingLevel()
      await loadWinningNumbers()
      onSaved()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsSaving(false)
    }
  }

  const deleteEditingLevel = async (loaded) => {
    if (!window.confirm(`Eliminar el premio del nivel ${loaded.nivel_premio}?`)) return
    try {
      setError('')
      await request(`/api/winning-numbers/${loaded.id}`, { method: 'DELETE' })
      cancelEditingLevel()
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
        {isLoading ? <p className="empty-list">Cargando premios...</p> : <form className="prize-form" onSubmit={handleSubmit}>
          {Number(raffle.sorteos) > 1 && <label className="prize-draw-input"><span>Sorteo</span><select value={draw} onChange={(event) => { setDraw(event.target.value); cancelEditingLevel() }}>{Array.from({ length: Number(raffle.sorteos) }, (_, index) => index + 1).map((drawNumber) => <option key={drawNumber} value={drawNumber}>Sorteo {drawNumber}</option>)}</select></label>}
          <div className="prize-level-grid">
            {prizeLevels.map((item) => {
              const loaded = loadedByLevelForDraw.get(item.nivel_premio)
              const isEditingThis = editingLevel === item.nivel_premio
              if (loaded) {
                return <div key={item.nivel_premio} className="prize-level-row">
                  <label><span>Nivel {item.nivel_premio}</span><input value={isEditingThis ? editingValue : loaded.numero_ganador} disabled={!isEditingThis} onChange={(event) => setEditingValue(event.target.value)} /></label>
                  {isEditingThis ? <>
                    <button className="btn btn-primary" type="button" disabled={isSaving} onClick={() => saveEditingLevel(loaded)}>Guardar</button>
                    <button className="btn btn-ghost" type="button" onClick={cancelEditingLevel}>Cancelar</button>
                    <button className="btn btn-danger" type="button" onClick={() => deleteEditingLevel(loaded)}>Eliminar</button>
                  </> : <button className="btn btn-ghost" type="button" onClick={() => startEditingLevel(loaded)}>Editar</button>}
                </div>
              }
              return <label key={item.nivel_premio}><span>Nivel {item.nivel_premio}</span><input value={item.numero_ganador} onChange={(event) => handlePrizeLevelChange(item.nivel_premio, event.target.value)} placeholder="Numero ganador" /></label>
            })}
          </div>
          {!hasEditableLevels && <p className="empty-list">Todos los niveles de este sorteo ya tienen numero ganador.</p>}
          <button className="btn btn-primary" type="submit" disabled={isSaving || !hasEditableLevels}>{isSaving ? 'Guardando...' : 'Guardar niveles'}</button>
        </form>}
      </div>
    </div>
  )
}

export default WinningNumbersModal
