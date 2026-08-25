import { useEffect, useState } from 'react'

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000'
const emptyForm = { id_tipo_rifa: '', id_area: '', nivel_premio: '1', saldo_ganado: '', valor_premio: '', digitos: '2', descripcion: '' }
const emptyFilters = { id_tipo_rifa: '', id_area: '', digitos: '', saldoMinimo: '', saldoMaximo: '' }
const createGeneratorLevels = () => Array.from({ length: 10 }, (_, index) => ({ nivel_premio: index + 1, saldo_inicial: '', saldo_final: '', incremento: '', premio_por_incremento: '' }))
const emptyGenerator = { id_tipo_rifa: '', id_area: '', digitos: '2', descripcion: '', levels: createGeneratorLevels() }
const emptyBulkUpdate = { id_tipo_rifa: '', id_area: '', nivel_premio: '', digitos: '', saldoMinimo: '', saldoMaximo: '', multiplicador: '' }

const request = async (path, options = {}) => {
  const response = await fetch(`${apiUrl}${path}`, options)
  const data = await response.json()
  if (!response.ok) throw new Error(data.message || 'No se pudo completar la solicitud')
  return data
}

const getPrizeOptionsPath = (filters = {}) => {
  const params = new URLSearchParams()
  for (const field of ['id_tipo_rifa', 'id_area', 'digitos', 'saldoMinimo', 'saldoMaximo']) {
    if (filters[field]) params.set(field, filters[field])
  }
  const query = params.toString()
  return `/api/prize-options${query ? `?${query}` : ''}`
}

const formatMoney = (value) => new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  minimumFractionDigits: 2,
}).format(Number(value || 0))

function PrizeOptionsCrm() {
  const [options, setOptions] = useState([])
  const [raffleTypes, setRaffleTypes] = useState([])
  const [areas, setAreas] = useState([])
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState(emptyFilters)
  const [appliedFilters, setAppliedFilters] = useState(emptyFilters)
  const [selectedIds, setSelectedIds] = useState([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false)
  const [generator, setGenerator] = useState(emptyGenerator)
  const [isBulkUpdateOpen, setIsBulkUpdateOpen] = useState(false)
  const [bulkUpdate, setBulkUpdate] = useState(emptyBulkUpdate)
  const [isGroupFormOpen, setIsGroupFormOpen] = useState(false)
  const [groupForm, setGroupForm] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  const loadData = async () => {
    try {
      setIsLoading(true)
      setError('')
      const [loadedRaffleTypes, loadedAreas] = await Promise.all([
        request('/api/raffle-types'),
        request('/api/areas'),
      ])
      const nextFilters = filters.id_tipo_rifa || loadedRaffleTypes.length === 0
        ? filters
        : { ...filters, id_tipo_rifa: String(loadedRaffleTypes[0].id) }
      const loadedOptions = await request(getPrizeOptionsPath(nextFilters))
      setOptions(loadedOptions)
      setRaffleTypes(loadedRaffleTypes)
      setAreas(loadedAreas)
      setFilters(nextFilters)
      setAppliedFilters(nextFilters)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsLoading(false)
    }
  }

  const loadOptions = async (activeFilters = filters) => {
    try {
      setIsLoading(true)
      setError('')
      const loadedOptions = await request(getPrizeOptionsPath(activeFilters))
      setOptions(loadedOptions)
      setAppliedFilters(activeFilters)
      setSelectedIds([])
      setPage(1)
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

  const openEditGroupForm = (group) => {
    setGroupForm({
      id_tipo_rifa: group.id_tipo_rifa,
      id_area: group.id_area,
      digitos: group.digitos,
      saldo_ganado: group.saldo_ganado,
      levels: group.prizes.map((option, index) => ({
        nivel_premio: index + 1,
        id: option ? option.id : null,
        valor_premio: option ? String(option.valor_premio) : '',
        descripcion: option ? (option.descripcion || '') : '',
      })),
    })
    setError('')
    setIsGroupFormOpen(true)
  }

  const handleGroupLevelChange = (nivelPremio, value) => {
    setGroupForm((currentGroupForm) => ({
      ...currentGroupForm,
      levels: currentGroupForm.levels.map((level) => level.nivel_premio === nivelPremio ? { ...level, valor_premio: value } : level),
    }))
  }

  const handleGroupFormSubmit = async (event) => {
    event.preventDefault()
    try {
      setIsSaving(true)
      setError('')
      const levelsToSave = groupForm.levels.filter((level) => level.valor_premio !== '')
      if (levelsToSave.length === 0) throw new Error('Ingresa al menos un valor de premio')

      await Promise.all(levelsToSave.map((level) => {
        const payload = {
          id_tipo_rifa: groupForm.id_tipo_rifa,
          id_area: groupForm.id_area,
          nivel_premio: level.nivel_premio,
          saldo_ganado: groupForm.saldo_ganado,
          valor_premio: Number(level.valor_premio),
          digitos: groupForm.digitos,
          descripcion: level.descripcion,
        }
        return level.id
          ? request(`/api/prize-options/${level.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ valor_premio: payload.valor_premio }),
          })
          : request('/api/prize-options', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
      }))
      setIsGroupFormOpen(false)
      setGroupForm(null)
      await loadData()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((currentForm) => ({ ...currentForm, [name]: value }))
  }

  const handleFilterChange = (event) => {
    const { name, value } = event.target
    const nextFilters = { ...filters, [name]: value }
    setFilters(nextFilters)
    setPage(1)
  }

  const applyFilters = () => {
    void loadOptions(filters)
  }

  const clearFilters = () => {
    const nextFilters = emptyFilters
    setSearch('')
    setFilters(nextFilters)
    void loadOptions(nextFilters)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    try {
      setIsSaving(true)
      setError('')
      const payload = {
        id_tipo_rifa: Number(form.id_tipo_rifa),
        id_area: Number(form.id_area),
        nivel_premio: Number(form.nivel_premio),
        saldo_ganado: Number(form.saldo_ganado),
        valor_premio: Number(form.valor_premio),
        digitos: Number(form.digitos),
        descripcion: form.descripcion,
      }
      const duplicateOption = options.find((option) => option.id !== editingId
        && option.id_tipo_rifa === payload.id_tipo_rifa
        && option.id_area === payload.id_area
        && option.nivel_premio === payload.nivel_premio
        && Number(option.saldo_ganado) === payload.saldo_ganado
        && option.digitos === payload.digitos)
      if (duplicateOption) throw new Error('Ya existe una opcion para ese tipo, area, nivel, digitos y saldo ganado')
      await request(editingId ? `/api/prize-options/${editingId}` : '/api/prize-options', {
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

  const handleGeneratorChange = (event) => {
    const { name, value } = event.target
    setGenerator((currentGenerator) => ({ ...currentGenerator, [name]: value }))
  }

  const handleGeneratorLevelChange = (level, field, value) => {
    setGenerator((currentGenerator) => ({
      ...currentGenerator,
      levels: currentGenerator.levels.map((item) => item.nivel_premio === level ? { ...item, [field]: value } : item),
    }))
  }

  const handleGenerate = async (event) => {
    event.preventDefault()
    try {
      setIsSaving(true)
      setError('')
      const filledLevels = generator.levels.filter((level) => (
        level.saldo_inicial && level.saldo_final && level.incremento && level.premio_por_incremento
      ))
      if (filledLevels.length === 0) throw new Error('Completa al menos un nivel para generar opciones')

      await Promise.all(filledLevels.map((level) => request('/api/prize-options/generate-proportional', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_tipo_rifa: Number(generator.id_tipo_rifa),
          id_area: Number(generator.id_area),
          digitos: Number(generator.digitos),
          descripcion: generator.descripcion,
          nivel_premio: level.nivel_premio,
          saldo_inicial: Number(level.saldo_inicial),
          saldo_final: Number(level.saldo_final),
          incremento: Number(level.incremento),
          premio_por_incremento: Number(level.premio_por_incremento),
        }),
      })))
      setIsGeneratorOpen(false)
      setGenerator(emptyGenerator)
      await loadData()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (option) => {
    if (!window.confirm(`Eliminar la opcion del nivel ${option.nivel_premio}?`)) return
    try {
      setError('')
      await request(`/api/prize-options/${option.id}`, { method: 'DELETE' })
      await loadData()
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  const deleteOptions = async (ids) => {
    if (ids.length === 0) return
    if (!window.confirm(`Eliminar ${ids.length} opcion(es) seleccionada(s)?`)) return

    try {
      setError('')
      await request('/api/prize-options/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      })
      setSelectedIds([])
      await loadData()
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  const handleBulkDelete = () => deleteOptions(selectedIds)

  const handleBulkUpdateChange = (event) => {
    const { name, value } = event.target
    setBulkUpdate((currentBulkUpdate) => ({ ...currentBulkUpdate, [name]: value }))
  }

  const handleBulkUpdateSubmit = async (event) => {
    event.preventDefault()
    try {
      setIsSaving(true)
      setError('')
      const { id_tipo_rifa, id_area, nivel_premio, digitos, saldoMinimo, saldoMaximo, multiplicador } = bulkUpdate
      if (!id_tipo_rifa && !id_area && !nivel_premio && !digitos) {
        throw new Error('Selecciona al menos un filtro (tipo, area, nivel o digitos)')
      }
      const result = await request('/api/prize-options/bulk-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_tipo_rifa: id_tipo_rifa || undefined,
          id_area: id_area || undefined,
          nivel_premio: nivel_premio || undefined,
          digitos: digitos || undefined,
          saldoMinimo: saldoMinimo || undefined,
          saldoMaximo: saldoMaximo || undefined,
          multiplicador: Number(multiplicador),
        }),
      })
      setIsBulkUpdateOpen(false)
      setBulkUpdate(emptyBulkUpdate)
      await loadData()
      window.alert(`Se actualizaron ${result.updated} opcion(es) de premio.`)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsSaving(false)
    }
  }

  const toggleSelected = (id) => {
    setSelectedIds((currentIds) => currentIds.includes(id) ? currentIds.filter((currentId) => currentId !== id) : [...currentIds, id])
  }

  const raffleTypesById = new Map(raffleTypes.map((type) => [type.id, type.nombre]))
  const areasById = new Map(areas.map((area) => [area.id, area.nombre]))
  const filteredOptions = options.filter((option) => {
    const searchable = `${raffleTypesById.get(option.id_tipo_rifa) || ''} ${areasById.get(option.id_area) || ''} ${option.nivel_premio} ${option.descripcion || ''}`.toLowerCase()
    const matchesSearch = searchable.includes(search.trim().toLowerCase())
    const matchesType = !appliedFilters.id_tipo_rifa || option.id_tipo_rifa === Number(appliedFilters.id_tipo_rifa)
    const matchesArea = !appliedFilters.id_area || option.id_area === Number(appliedFilters.id_area)
    const matchesDigits = !appliedFilters.digitos || option.digitos === Number(appliedFilters.digitos)
    const matchesMinimum = !appliedFilters.saldoMinimo || Number(option.saldo_ganado) >= Number(appliedFilters.saldoMinimo)
    const matchesMaximum = !appliedFilters.saldoMaximo || Number(option.saldo_ganado) <= Number(appliedFilters.saldoMaximo)
    return matchesSearch && matchesType && matchesArea && matchesDigits && matchesMinimum && matchesMaximum
  })
  const groupedOptions = Array.from(filteredOptions.reduce((groups, option) => {
    const key = `${option.id_tipo_rifa}:${option.id_area}:${option.digitos}:${option.saldo_ganado}`
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        id_tipo_rifa: option.id_tipo_rifa,
        id_area: option.id_area,
        digitos: option.digitos,
        saldo_ganado: option.saldo_ganado,
        options: [],
        prizes: Array(10).fill(null),
      })
    }
    const group = groups.get(key)
    group.options.push(option)
    group.prizes[option.nivel_premio - 1] = option
    return groups
  }, new Map()).values())
  const totalPages = Math.max(1, Math.ceil(groupedOptions.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pageOptions = groupedOptions.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const pageIds = pageOptions.flatMap((group) => group.options.map((option) => option.id))
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id))
  const filtersChanged = JSON.stringify(filters) !== JSON.stringify(appliedFilters)

  const toggleCurrentPage = () => {
    setSelectedIds((currentIds) => allPageSelected
      ? currentIds.filter((id) => !pageIds.includes(id))
      : [...new Set([...currentIds, ...pageIds])])
  }

  return (
    <section className="prize-options-crm">
      <section className="prize-filter-panel" aria-label="Filtros de opciones de premios">
        <div className="prize-filter-heading"><strong>Filtros de busqueda</strong></div>
        <div className="prize-filter-controls">
          <label><span>Tipo de rifa</span><select name="id_tipo_rifa" value={filters.id_tipo_rifa} onChange={handleFilterChange}><option value="">Todos</option>{raffleTypes.map((type) => <option key={type.id} value={type.id}>{type.nombre}</option>)}</select></label>
          <label><span>Area</span><select name="id_area" value={filters.id_area} onChange={handleFilterChange}><option value="">Todas</option>{areas.map((area) => <option key={area.id} value={area.id}>{area.nombre}</option>)}</select></label>
          <label><span>Digitos</span><select name="digitos" value={filters.digitos} onChange={handleFilterChange}><option value="">Todos</option>{[2, 3, 4, 5].map((digits) => <option key={digits} value={digits}>{digits} digitos</option>)}</select></label>
          <label><span>Apuesta minima</span><input name="saldoMinimo" type="number" min="0" step="0.01" value={filters.saldoMinimo} onChange={handleFilterChange} placeholder="0.25" /></label>
          <label><span>Apuesta maxima</span><input name="saldoMaximo" type="number" min="0" step="0.01" value={filters.saldoMaximo} onChange={handleFilterChange} placeholder="20.00" /></label>
          <div className="prize-filter-actions"><button className="btn btn-primary" type="button" onClick={applyFilters} disabled={isLoading}>{isLoading ? 'Buscando...' : 'Buscar'}</button><button className="btn btn-danger" type="button" onClick={clearFilters} disabled={isLoading}>Limpiar filtros</button><span>{groupedOptions.length} resultado(s){filtersChanged ? ' sin actualizar' : ''}</span></div>
        </div>
      </section>
      <div className="users-toolbar">
        <label className="user-search"><span>Buscar</span><input type="search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="Tipo, area, nivel o descripcion" /></label>
        <div className="prize-options-actions"><button className="btn btn-ghost" type="button" onClick={() => { setGenerator(emptyGenerator); setIsGeneratorOpen(true) }}>Generar proporcional</button><button className="btn btn-ghost" type="button" onClick={() => { setBulkUpdate(emptyBulkUpdate); setIsBulkUpdateOpen(true) }}>Editar en masa</button><button className="btn btn-primary" type="button" onClick={openCreateForm}>Agregar opcion</button></div>
      </div>
      {error && <p className="dashboard-message dashboard-message--error">{error}</p>}
      {isLoading && <p className="dashboard-message">Cargando opciones de premios...</p>}
      {!isLoading && <div className="prize-options-table-toolbar"><span>{selectedIds.length} seleccionada(s)</span><div><label>Filas por pagina <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1) }}><option value="10">10</option><option value="25">25</option><option value="50">50</option></select></label><button className="btn btn-danger" type="button" disabled={selectedIds.length === 0} onClick={handleBulkDelete}>Eliminar seleccionadas</button></div></div>}
      {!isLoading && <div className="users-table-wrap"><table className="users-table prize-options-table">
        <thead><tr><th><input type="checkbox" checked={allPageSelected} onChange={toggleCurrentPage} aria-label="Seleccionar pagina" /></th><th>Tipo</th><th>Apuesta</th>{Array.from({ length: 10 }, (_, index) => <th key={index}>Premio {index + 1}</th>)}<th>Area</th><th>Digitos</th><th aria-label="Acciones" /></tr></thead>
        <tbody>
          {pageOptions.map((group) => <tr key={group.key}>
            <td><input type="checkbox" checked={group.options.every((option) => selectedIds.includes(option.id))} onChange={() => setSelectedIds((currentIds) => {
              const groupIds = group.options.map((option) => option.id)
              const allSelected = groupIds.every((id) => currentIds.includes(id))
              return allSelected ? currentIds.filter((id) => !groupIds.includes(id)) : [...new Set([...currentIds, ...groupIds])]
            })} aria-label={`Seleccionar opciones para ${group.saldo_ganado}`} /></td>
            <td>{raffleTypesById.get(group.id_tipo_rifa) || 'Tipo no disponible'}</td>
            <td>{formatMoney(group.saldo_ganado)}</td>
            {group.prizes.map((option, index) => <td key={index} className="prize-matrix-cell">{option ? formatMoney(option.valor_premio) : '$0.00'}</td>)}
            <td>{areasById.get(group.id_area) || 'Area no disponible'}</td>
            <td>{group.digitos}D</td>
            <td className="user-actions"><button className="btn btn-ghost" type="button" onClick={() => openEditGroupForm(group)}>Editar</button><button className="btn btn-danger" type="button" onClick={() => deleteOptions(group.options.map((option) => option.id))}>Eliminar</button></td>
          </tr>)}
          {groupedOptions.length === 0 && <tr><td className="users-empty" colSpan="15">No hay opciones de premios configuradas.</td></tr>}
        </tbody>
      </table></div>}
      {!isLoading && groupedOptions.length > 0 && <div className="pagination-bar"><span>Pagina {currentPage} de {totalPages}</span><div><button className="btn btn-ghost" type="button" disabled={currentPage === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Anterior</button><button className="btn btn-ghost" type="button" disabled={currentPage === totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>Siguiente</button></div></div>}

      {isFormOpen && <div className="modal-overlay" onClick={() => setIsFormOpen(false)}><div className="modal-card prize-option-form-card" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header"><div><p className="eyebrow">Opciones de premios</p><h2>{editingId ? 'Editar opcion' : 'Agregar opcion'}</h2></div><button type="button" className="close-btn" onClick={() => setIsFormOpen(false)} aria-label="Cerrar">×</button></div>
        <form className="login-form" onSubmit={handleSubmit}>
          <label><span>Tipo de rifa</span><select name="id_tipo_rifa" value={form.id_tipo_rifa} onChange={handleChange} required><option value="">Selecciona un tipo</option>{raffleTypes.map((type) => <option key={type.id} value={type.id}>{type.nombre}</option>)}</select></label>
          <label><span>Area</span><select name="id_area" value={form.id_area} onChange={handleChange} required><option value="">Selecciona un area</option>{areas.map((area) => <option key={area.id} value={area.id}>{area.nombre}</option>)}</select></label>
          <div className="prize-option-grid"><label><span>Nivel</span><select name="nivel_premio" value={form.nivel_premio} onChange={handleChange}>{Array.from({ length: 10 }, (_, index) => <option key={index + 1} value={index + 1}>Nivel {index + 1}</option>)}</select></label><label><span>Digitos</span><select name="digitos" value={form.digitos} onChange={handleChange}>{[2, 3, 4, 5].map((digits) => <option key={digits} value={digits}>{digits} digitos</option>)}</select></label></div>
          <div className="prize-option-grid"><label><span>Saldo ganado</span><input name="saldo_ganado" type="number" min="0.01" step="0.01" value={form.saldo_ganado} onChange={handleChange} required /></label><label><span>Valor del premio</span><input name="valor_premio" type="number" min="0.01" step="0.01" value={form.valor_premio} onChange={handleChange} required /></label></div>
          <label><span>Descripcion</span><textarea name="descripcion" value={form.descripcion} onChange={handleChange} rows="3" /></label>
          <button className="btn btn-primary btn-block" type="submit" disabled={isSaving}>{isSaving ? 'Guardando...' : 'Guardar opcion'}</button>
        </form>
      </div></div>}

      {isGroupFormOpen && groupForm && <div className="modal-overlay" onClick={() => setIsGroupFormOpen(false)}><div className="modal-card prize-option-form-card" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header"><div><p className="eyebrow">Opciones de premios</p><h2>Editar niveles de premio</h2></div><button type="button" className="close-btn" onClick={() => setIsGroupFormOpen(false)} aria-label="Cerrar">×</button></div>
        <form className="login-form" onSubmit={handleGroupFormSubmit}>
          <p className="proportional-preview">{raffleTypesById.get(groupForm.id_tipo_rifa) || 'Tipo no disponible'} · {areasById.get(groupForm.id_area) || 'Area no disponible'} · {groupForm.digitos} digitos · Apuesta {formatMoney(groupForm.saldo_ganado)}</p>
          <div className="proportional-level-template">
            <div className="proportional-level-header"><span>Nivel</span><span>Valor del premio</span></div>
            {groupForm.levels.map((level) => <div key={level.nivel_premio} className="proportional-level-row"><strong>{level.nivel_premio}</strong><input type="number" min="0.01" step="0.01" value={level.valor_premio} onChange={(event) => handleGroupLevelChange(level.nivel_premio, event.target.value)} placeholder="0.00" /></div>)}
          </div>
          <p className="proportional-preview">Deja un nivel en blanco para omitirlo. Los niveles sin opcion existente se crearan al guardar.</p>
          <button className="btn btn-primary btn-block" type="submit" disabled={isSaving}>{isSaving ? 'Guardando...' : 'Guardar cambios'}</button>
        </form>
      </div></div>}

      {isGeneratorOpen && <div className="modal-overlay" onClick={() => setIsGeneratorOpen(false)}><div className="modal-card prize-option-form-card" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header"><div><p className="eyebrow">Generacion proporcional</p><h2>Crear opciones rapidamente</h2></div><button type="button" className="close-btn" onClick={() => setIsGeneratorOpen(false)} aria-label="Cerrar">×</button></div>
        <form className="login-form" onSubmit={handleGenerate}>
          <label><span>Tipo de rifa</span><select name="id_tipo_rifa" value={generator.id_tipo_rifa} onChange={handleGeneratorChange} required><option value="">Selecciona un tipo</option>{raffleTypes.map((type) => <option key={type.id} value={type.id}>{type.nombre}</option>)}</select></label>
          <label><span>Area</span><select name="id_area" value={generator.id_area} onChange={handleGeneratorChange} required><option value="">Selecciona un area</option>{areas.map((area) => <option key={area.id} value={area.id}>{area.nombre}</option>)}</select></label>
          <label><span>Digitos</span><select name="digitos" value={generator.digitos} onChange={handleGeneratorChange}>{[2, 3, 4, 5].map((digits) => <option key={digits} value={digits}>{digits} digitos</option>)}</select></label>
          <div className="proportional-level-template">
            <div className="proportional-level-header"><span>Nivel</span><span>Saldo inicial</span><span>Saldo final</span><span>Incremento</span><span>Premio / incremento</span></div>
            {generator.levels.map((level) => <div key={level.nivel_premio} className="proportional-level-row"><strong>{level.nivel_premio}</strong><input type="number" min="0.01" step="0.01" value={level.saldo_inicial} onChange={(event) => handleGeneratorLevelChange(level.nivel_premio, 'saldo_inicial', event.target.value)} placeholder="0.25" /><input type="number" min="0.01" step="0.01" value={level.saldo_final} onChange={(event) => handleGeneratorLevelChange(level.nivel_premio, 'saldo_final', event.target.value)} placeholder="20.00" /><input type="number" min="0.01" step="0.01" value={level.incremento} onChange={(event) => handleGeneratorLevelChange(level.nivel_premio, 'incremento', event.target.value)} placeholder="0.25" /><input type="number" min="0.01" step="0.01" value={level.premio_por_incremento} onChange={(event) => handleGeneratorLevelChange(level.nivel_premio, 'premio_por_incremento', event.target.value)} placeholder="1.00" /></div>)}
          </div>
          <label><span>Descripcion</span><textarea name="descripcion" value={generator.descripcion} onChange={handleGeneratorChange} rows="3" /></label>
          <p className="proportional-preview">Los niveles en blanco no se generan. Cada nivel completo crea sus opciones proporcionales.</p>
          <button className="btn btn-primary btn-block" type="submit" disabled={isSaving}>{isSaving ? 'Generando...' : 'Generar opciones'}</button>
        </form>
      </div></div>}

      {isBulkUpdateOpen && <div className="modal-overlay" onClick={() => setIsBulkUpdateOpen(false)}><div className="modal-card prize-option-form-card" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header"><div><p className="eyebrow">Opciones de premios</p><h2>Editar en masa</h2></div><button type="button" className="close-btn" onClick={() => setIsBulkUpdateOpen(false)} aria-label="Cerrar">×</button></div>
        <form className="login-form" onSubmit={handleBulkUpdateSubmit}>
          <p className="proportional-preview">Recalcula el valor del premio de las opciones existentes que coincidan con los filtros: <code>valor_premio = saldo_ganado * multiplicador</code>.</p>
          <label><span>Tipo de rifa</span><select name="id_tipo_rifa" value={bulkUpdate.id_tipo_rifa} onChange={handleBulkUpdateChange}><option value="">Todos</option>{raffleTypes.map((type) => <option key={type.id} value={type.id}>{type.nombre}</option>)}</select></label>
          <label><span>Area</span><select name="id_area" value={bulkUpdate.id_area} onChange={handleBulkUpdateChange}><option value="">Todas</option>{areas.map((area) => <option key={area.id} value={area.id}>{area.nombre}</option>)}</select></label>
          <div className="prize-option-grid"><label><span>Nivel</span><select name="nivel_premio" value={bulkUpdate.nivel_premio} onChange={handleBulkUpdateChange}><option value="">Todos</option>{Array.from({ length: 10 }, (_, index) => <option key={index + 1} value={index + 1}>Nivel {index + 1}</option>)}</select></label><label><span>Digitos</span><select name="digitos" value={bulkUpdate.digitos} onChange={handleBulkUpdateChange}><option value="">Todos</option>{[2, 3, 4, 5].map((digits) => <option key={digits} value={digits}>{digits} digitos</option>)}</select></label></div>
          <div className="prize-option-grid"><label><span>Apuesta minima</span><input name="saldoMinimo" type="number" min="0" step="0.01" value={bulkUpdate.saldoMinimo} onChange={handleBulkUpdateChange} placeholder="0.25" /></label><label><span>Apuesta maxima</span><input name="saldoMaximo" type="number" min="0" step="0.01" value={bulkUpdate.saldoMaximo} onChange={handleBulkUpdateChange} placeholder="20.00" /></label></div>
          <label><span>Multiplicador</span><input name="multiplicador" type="number" min="0.01" step="0.01" value={bulkUpdate.multiplicador} onChange={handleBulkUpdateChange} placeholder="100" required /></label>
          <button className="btn btn-primary btn-block" type="submit" disabled={isSaving}>{isSaving ? 'Actualizando...' : 'Actualizar opciones'}</button>
        </form>
      </div></div>}
    </section>
  )
}

export default PrizeOptionsCrm