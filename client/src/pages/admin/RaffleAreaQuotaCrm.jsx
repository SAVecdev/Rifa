import { useEffect, useState } from 'react'

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000'
const emptyForm = { id_areas: [], id_tipo_rifa: '', sharedAcrossAreas: false, c_2digitos: '0', c_3digitos: '0', c_4digitos: '0', c_5digitos: '0' }

const request = async (path, options = {}) => {
  const response = await fetch(`${apiUrl}${path}`, options)
  const data = await response.json()
  if (!response.ok) throw new Error(data.message || 'No se pudo completar la solicitud')
  return data
}

function RaffleAreaQuotaCrm() {
  const [quotas, setQuotas] = useState([])
  const [areas, setAreas] = useState([])
  const [raffleTypes, setRaffleTypes] = useState([])
  const [search, setSearch] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [expandedQuotaId, setExpandedQuotaId] = useState(null)
  const [areaSearch, setAreaSearch] = useState('')
  const [error, setError] = useState('')

  const loadData = async () => {
    try {
      setIsLoading(true)
      setError('')
      const [loadedQuotas, loadedAreas, loadedRaffleTypes] = await Promise.all([
        request('/api/raffle-area-quotas'),
        request('/api/areas'),
        request('/api/raffle-types'),
      ])
      setQuotas(loadedQuotas)
      setAreas(loadedAreas)
      setRaffleTypes(loadedRaffleTypes)
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

  const openEditForm = (quota) => {
    setEditingId(quota.id)
    setForm({
      id_areas: quota.id_area === null ? [] : [String(quota.id_area)],
      id_tipo_rifa: String(quota.id_tipo_rifa),
      sharedAcrossAreas: quota.id_area === null,
      c_2digitos: String(quota.c_2digitos),
      c_3digitos: String(quota.c_3digitos),
      c_4digitos: String(quota.c_4digitos),
      c_5digitos: String(quota.c_5digitos),
    })
    setError('')
    setIsFormOpen(true)
  }

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target

    if (type === 'checkbox') {
      setForm((currentForm) => ({ ...currentForm, [name]: checked }))
      return
    }

    setForm((currentForm) => ({ ...currentForm, [name]: value }))
  }

  const toggleAreaSelection = (areaId) => {
    const normalizedValue = String(areaId)
    setForm((currentForm) => {
      const currentAreas = currentForm.id_areas || []
      const exists = currentAreas.includes(normalizedValue)
      return {
        ...currentForm,
        id_areas: exists
          ? currentAreas.filter((value) => value !== normalizedValue)
          : [...currentAreas, normalizedValue],
      }
    })
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    try {
      setIsSaving(true)
      setError('')

      const areaIds = (form.id_areas || []).filter((value) => value !== '').map((value) => Number(value))
      const payload = {
        sharedAcrossAreas: Boolean(form.sharedAcrossAreas),
        id_areas: areaIds,
        id_tipo_rifa: Number(form.id_tipo_rifa),
        c_2digitos: Number(form.c_2digitos),
        c_3digitos: Number(form.c_3digitos),
        c_4digitos: Number(form.c_4digitos),
        c_5digitos: Number(form.c_5digitos),
      }

      if (!payload.sharedAcrossAreas && areaIds.length === 0) {
        throw new Error('Debes seleccionar al menos un area o activar cupo compartido')
      }

      await request(editingId ? `/api/raffle-area-quotas/${editingId}` : '/api/raffle-area-quotas', {
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

  const handleDelete = async (quota) => {
    if (!window.confirm('Eliminar esta configuracion de cupos?')) return
    try {
      setError('')
      await request(`/api/raffle-area-quotas/${quota.id}`, { method: 'DELETE' })
      await loadData()
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  const areaById = new Map(areas.map((area) => [area.id, area.nombre]))
  const raffleTypeById = new Map(raffleTypes.map((type) => [type.id, type.nombre]))
  const selectedAreaIds = form.id_areas || []
  const selectedAreas = areas.filter((area) => selectedAreaIds.includes(String(area.id)))
  const filteredAvailableAreas = areas
    .filter((area) => !selectedAreaIds.includes(String(area.id)))
    .filter((area) => area.nombre.toLowerCase().includes(areaSearch.trim().toLowerCase()))
  const visibleAvailableAreas = filteredAvailableAreas.slice(0, 5)
  const getQuotaAreaLabel = (quota) => quota.id_area === null ? 'Compartida' : areaById.get(quota.id_area) || 'Area no disponible'
  const getShareText = (quotaGroup) => {
    if (!quotaGroup?.items?.length) return 'varias areas'
    return quotaGroup.items
      .map((item) => item.id_area === null ? 'Compartida' : areaById.get(item.id_area) || 'Area no disponible')
      .filter(Boolean)
      .join(', ')
  }
  const filteredQuotas = quotas.filter((quota) => {
    const areaLabel = getQuotaAreaLabel(quota)
    const searchable = `${areaLabel} ${raffleTypeById.get(quota.id_tipo_rifa) || ''}`.toLowerCase()
    return searchable.includes(search.trim().toLowerCase())
  })
  const groupedQuotas = Array.from(
    filteredQuotas.reduce((map, quota) => {
      const quotaKey = [
        quota.id_tipo_rifa,
        Number(quota.c_2digitos),
        Number(quota.c_3digitos),
        Number(quota.c_4digitos),
        Number(quota.c_5digitos),
      ].join(':')

      if (!map.has(quotaKey)) {
        map.set(quotaKey, [])
      }
      map.get(quotaKey).push(quota)
      return map
    }, new Map()).entries()
  ).map(([key, items]) => ({ key, items }))

  return (
    <section className="quotas-crm">
      <div className="users-toolbar">
        <label className="user-search"><span>Buscar</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Area o tipo de rifa" /></label>
        <button className="btn btn-primary" type="button" onClick={openCreateForm}>Agregar cupos</button>
      </div>
      {error && <p className="dashboard-message dashboard-message--error">{error}</p>}
      {isLoading && <p className="dashboard-message">Cargando cupos...</p>}

      {!isLoading && <div className="users-table-wrap"><table className="users-table quota-table">
        <thead><tr><th>Area</th><th>Tipo de rifa</th><th>2 digitos</th><th>3 digitos</th><th>4 digitos</th><th>5 digitos</th><th aria-label="Acciones" /></tr></thead>
        <tbody>
          {groupedQuotas.map((quotaGroup) => {
            const primaryQuota = quotaGroup.items[0]
            const isShared = quotaGroup.items.length > 1
            const isExpanded = expandedQuotaId === quotaGroup.key
            const displayQuota = primaryQuota
            return (
              <>
                <tr key={quotaGroup.key}>
                  <td>
                    {isShared ? (
                      <button
                        type="button"
                        onClick={() => setExpandedQuotaId((current) => current === quotaGroup.key ? null : quotaGroup.key)}
                        style={{
                          border: 'none',
                          background: 'transparent',
                          color: '#2d3748',
                          fontWeight: 600,
                          padding: 0,
                          cursor: 'pointer',
                          textDecoration: 'underline',
                        }}
                      >
                        Compartida
                      </button>
                    ) : (
                      getQuotaAreaLabel(displayQuota)
                    )}
                  </td>
                  <td>{raffleTypeById.get(displayQuota.id_tipo_rifa) || 'Tipo no disponible'}</td>
                  <td>{displayQuota.c_2digitos}</td><td>{displayQuota.c_3digitos}</td><td>{displayQuota.c_4digitos}</td><td>{displayQuota.c_5digitos}</td>
                  <td className="user-actions"><button className="btn btn-ghost" type="button" onClick={() => openEditForm(displayQuota)}>Editar</button><button className="btn btn-danger" type="button" onClick={() => handleDelete(displayQuota)}>Eliminar</button></td>
                </tr>
                {isShared && isExpanded && (
                  <tr key={`${quotaGroup.key}-details`}>
                    <td colSpan="7" style={{ background: '#f8fafc', padding: '12px 16px' }}>
                      <strong>Compartido con:</strong> {getShareText(quotaGroup)}
                    </td>
                  </tr>
                )}
              </>
            )
          })}
          {groupedQuotas.length === 0 && <tr><td className="users-empty" colSpan="7">No hay cupos configurados.</td></tr>}
        </tbody>
      </table></div>}

      {isFormOpen && <div className="modal-overlay" onClick={() => setIsFormOpen(false)}><div className="modal-card quota-form-card" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header"><div><p className="eyebrow">Cupos por area y tipo</p><h2>{editingId ? 'Editar cupos' : 'Agregar cupos'}</h2></div><button type="button" className="close-btn" onClick={() => setIsFormOpen(false)} aria-label="Cerrar">×</button></div>
        <form className="login-form" onSubmit={handleSubmit}>
          <label className="checkbox-field">
            <input type="checkbox" name="sharedAcrossAreas" checked={form.sharedAcrossAreas} onChange={handleChange} />
            <span>Cupo compartido para todas las areas</span>
          </label>

          {!form.sharedAcrossAreas && (
            <div style={{ display: 'grid', gap: '12px' }}>
              <span style={{ fontWeight: 600 }}>Areas que comparten este grupo</span>

              <div style={{ display: 'grid', gap: '8px' }}>
                <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>Seleccionadas</p>
                <div style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '8px', minHeight: '52px', display: 'flex', flexWrap: 'wrap', gap: '6px', background: '#fafafa' }}>
                  {selectedAreas.length === 0 ? (
                    <span style={{ color: '#666', fontSize: '13px' }}>Todavia no agregaste ninguna area</span>
                  ) : (
                    selectedAreas.map((area) => (
                      <button
                        type="button"
                        key={area.id}
                        onClick={() => toggleAreaSelection(area.id)}
                        style={{
                          border: '1px solid #adcbff',
                          background: '#edf4ff',
                          borderRadius: '999px',
                          padding: '5px 10px',
                          fontSize: '13px',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        {area.nombre}
                        <span aria-hidden="true">×</span>
                      </button>
                    ))
                  )}
                </div>
              </div>

              <div style={{ display: 'grid', gap: '8px' }}>
                <label style={{ fontSize: '12px', color: '#666', margin: 0 }}>Buscar area</label>
                <input
                  type="text"
                  value={areaSearch}
                  onChange={(event) => setAreaSearch(event.target.value)}
                  placeholder="Escribe para filtrar..."
                  style={{ border: '1px solid #d7d7d7', borderRadius: '8px', padding: '10px 12px' }}
                />

                <div style={{ border: '1px solid #ddd', borderRadius: '8px', maxHeight: '200px', overflowY: 'auto', display: 'grid', gap: '6px', padding: '8px', background: '#fff' }}>
                  {filteredAvailableAreas.length === 0 ? (
                    <span style={{ color: '#666', fontSize: '13px' }}>No se encontraron areas</span>
                  ) : (
                    visibleAvailableAreas.map((area) => (
                      <button
                        type="button"
                        key={area.id}
                        onClick={() => toggleAreaSelection(area.id)}
                        style={{ textAlign: 'left', padding: '8px 10px', borderRadius: '6px', border: '1px solid #d7d7d7', background: '#fff', cursor: 'pointer' }}
                      >
                        {area.nombre}
                      </button>
                    ))
                  )}
                  {filteredAvailableAreas.length > 5 && (
                    <div style={{ fontSize: '12px', color: '#666', padding: '4px 4px 0' }}>
                      Mostrando 5 de {filteredAvailableAreas.length}. Escribe para buscar mas resultados.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <label><span>Tipo de rifa</span><select name="id_tipo_rifa" value={form.id_tipo_rifa} onChange={handleChange} required><option value="">Selecciona un tipo</option>{raffleTypes.map((type) => <option key={type.id} value={type.id}>{type.nombre}</option>)}</select></label>
          <div className="quota-input-grid">
            <label><span>Cupo de 2 digitos</span><input name="c_2digitos" type="number" min="0" step="0.01" value={form.c_2digitos} onChange={handleChange} required /></label>
            <label><span>Cupo de 3 digitos</span><input name="c_3digitos" type="number" min="0" step="0.01" value={form.c_3digitos} onChange={handleChange} required /></label>
            <label><span>Cupo de 4 digitos</span><input name="c_4digitos" type="number" min="0" step="0.01" value={form.c_4digitos} onChange={handleChange} required /></label>
            <label><span>Cupo de 5 digitos</span><input name="c_5digitos" type="number" min="0" step="0.01" value={form.c_5digitos} onChange={handleChange} required /></label>
          </div>
          <button className="btn btn-primary btn-block" type="submit" disabled={isSaving}>{isSaving ? 'Guardando...' : 'Guardar cupos'}</button>
        </form>
      </div></div>}
    </section>
  )
}

export default RaffleAreaQuotaCrm