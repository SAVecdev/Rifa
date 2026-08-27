import { useEffect, useState } from 'react'

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000'
const defaultSettings = {
  nombre_empresa: '',
  identificacion_empresa: '',
  telefono_empresa: '',
  direccion_empresa: '',
  mensaje_encabezado: '',
  mensaje_pie: '',
  tipo_letra: 'Arial',
  tamano_letra: 12,
  color_primario: '#000000',
  color_secundario: '#FFFFFF',
  modelo_factura: 'clasica',
  mostrar_logo: true,
  mostrar_premios: true,
  orden_premios: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
}

const request = async (path, options = {}) => {
  const response = await fetch(`${apiUrl}${path}`, options)
  const data = await response.json()
  if (!response.ok) throw new Error(data.message || 'No se pudo completar la solicitud')
  return data
}

const supportedFonts = ['Arial', 'Verdana', 'Tahoma', 'Trebuchet MS', 'Georgia', 'Times New Roman', 'Courier New', 'Lucida Console']
const normalizeFont = (font) => supportedFonts.includes(font) ? font : 'Arial'

function InvoiceSettingsCrm() {
  const [users, setUsers] = useState([])
  const [userId, setUserId] = useState('')
  const [settings, setSettings] = useState(defaultSettings)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const loadUsers = async () => {
      try {
        setIsLoading(true)
        setUsers(await request('/api/users'))
      } catch (requestError) {
        setError(requestError.message)
      } finally {
        setIsLoading(false)
      }
    }
    loadUsers()
  }, [])

  const loadSettings = async (selectedUserId) => {
    if (!selectedUserId) {
      setSettings(defaultSettings)
      return
    }
    try {
      setError('')
      const data = await request(`/api/invoice-settings/${selectedUserId}`)
      setSettings({ ...defaultSettings, ...(data || {}), tipo_letra: normalizeFont(data?.tipo_letra) })
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  const handleUserChange = (event) => {
    const selectedUserId = event.target.value
    setUserId(selectedUserId)
    loadSettings(selectedUserId)
  }

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target
    setSettings((currentSettings) => ({ ...currentSettings, [name]: type === 'checkbox' ? checked : value }))
  }

  const togglePrizeLevel = (level) => {
    setSettings((currentSettings) => ({
      ...currentSettings,
      orden_premios: currentSettings.orden_premios.includes(level)
        ? currentSettings.orden_premios.filter((currentLevel) => currentLevel !== level)
        : [...currentSettings.orden_premios, level].sort((first, second) => first - second),
    }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!userId) return
    try {
      setIsSaving(true)
      setError('')
      await request(`/api/invoice-settings/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...settings, tamano_letra: Number(settings.tamano_letra) }),
      })
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsSaving(false)
    }
  }

  const selectedUser = users.find((user) => user.id === Number(userId))
  const visibleLevels = settings.mostrar_premios ? settings.orden_premios : []
  const previewPrizeTable = (compact = false) => visibleLevels.length > 0 && <table><tbody>{Array.from({ length: Math.ceil(visibleLevels.length / 2) }, (_, rowIndex) => <tr key={rowIndex}>{visibleLevels.slice(rowIndex * 2, rowIndex * 2 + 2).flatMap((level) => [<td key={`label-${level}`}>{compact ? `P${level}` : `${level}er.`}</td>, <td key={`value-${level}`}>$0.00</td>])}</tr>)}</tbody></table>
  const previewContent = {
    clasica: <><strong>Factura A001</strong><span>Rifa de ejemplo · Numero 56</span><span>X2 $0.25 = $0.50</span>{previewPrizeTable()}</>,
    compacta: <><div className="invoice-line"><span>Rifa de ejemplo #56</span><strong>X2 $0.25 = $0.50</strong></div><div className="invoice-line"><span>Rifa de ejemplo #37</span><strong>X1 $0.25 = $0.25</strong></div>{previewPrizeTable(true)}</>,
    agrupada: <><div className="invoice-group"><strong>Rifa de ejemplo · X3 $0.25 = $0.75</strong><span>56, 37, 82</span>{previewPrizeTable(true)}</div></>,
    resumen: <><strong>Premios activos</strong>{previewPrizeTable(true)}<span>2 numeros · 2 apuestas</span></>,
  }

  return (
    <section className="invoice-settings-crm">
      <div className="invoice-settings-toolbar">
        <label><span>Usuario</span><select value={userId} onChange={handleUserChange}><option value="">Selecciona un usuario</option>{users.map((user) => <option key={user.id} value={user.id}>{user.nombre} ({user.correo})</option>)}</select></label>
      </div>
      {error && <p className="dashboard-message dashboard-message--error">{error}</p>}
      {isLoading && <p className="dashboard-message">Cargando usuarios...</p>}
      {!isLoading && !userId && <p className="dashboard-message">Selecciona un usuario para modificar su factura.</p>}

      {userId && <div className="invoice-settings-layout">
        <form className="invoice-settings-form" onSubmit={handleSubmit}>
          <h2>Contenido y estilo</h2>
          <label><span>Nombre de empresa</span><input name="nombre_empresa" value={settings.nombre_empresa || ''} onChange={handleChange} /></label>
          <div className="invoice-settings-grid"><label><span>Identificacion</span><input name="identificacion_empresa" value={settings.identificacion_empresa || ''} onChange={handleChange} /></label><label><span>Telefono</span><input name="telefono_empresa" value={settings.telefono_empresa || ''} onChange={handleChange} /></label></div>
          <label><span>Direccion</span><input name="direccion_empresa" value={settings.direccion_empresa || ''} onChange={handleChange} /></label>
          <label><span>Mensaje de encabezado</span><input name="mensaje_encabezado" value={settings.mensaje_encabezado || ''} onChange={handleChange} /></label>
          <label><span>Mensaje de pie</span><textarea name="mensaje_pie" value={settings.mensaje_pie || ''} onChange={handleChange} rows="3" /></label>
          <div className="invoice-settings-grid"><label><span>Tipo de letra</span><select name="tipo_letra" value={settings.tipo_letra} onChange={handleChange}><option value="Arial">Arial</option><option value="Verdana">Verdana</option><option value="Tahoma">Tahoma</option><option value="Trebuchet MS">Trebuchet MS</option><option value="Georgia">Georgia</option><option value="Times New Roman">Times New Roman</option><option value="Courier New">Courier New</option><option value="Lucida Console">Lucida Console</option></select></label><label><span>Tamano</span><input name="tamano_letra" type="number" min="8" max="36" value={settings.tamano_letra} onChange={handleChange} /></label></div>
          <label><span>Modelo de factura</span><select name="modelo_factura" value={settings.modelo_factura} onChange={handleChange}><option value="clasica">Clasica detallada</option><option value="compacta">Compacta por numero</option><option value="agrupada">Agrupada por apuesta</option><option value="resumen">Resumen de premios activos</option></select></label>
          <div className="invoice-settings-grid"><label><span>Color primario</span><input name="color_primario" type="color" value={settings.color_primario} onChange={handleChange} /></label><label><span>Color secundario</span><input name="color_secundario" type="color" value={settings.color_secundario} onChange={handleChange} /></label></div>
          <div className="invoice-toggle-row"><label><input name="mostrar_logo" type="checkbox" checked={settings.mostrar_logo} onChange={handleChange} /> Mostrar logo</label><label><input name="mostrar_premios" type="checkbox" checked={settings.mostrar_premios} onChange={handleChange} /> Mostrar premios</label></div>
          <fieldset className="invoice-prize-order"><legend>Niveles visibles de premios</legend><div>{Array.from({ length: 10 }, (_, index) => index + 1).map((level) => <label key={level}><input type="checkbox" checked={settings.orden_premios.includes(level)} onChange={() => togglePrizeLevel(level)} /> {level}</label>)}</div></fieldset>
          <button className="btn btn-primary btn-block" type="submit" disabled={isSaving}>{isSaving ? 'Guardando...' : 'Guardar configuracion'}</button>
        </form>

        <section className="invoice-preview-panel"><h2>Vista previa {settings.modelo_factura}</h2><article className="thermal-preview" style={{ fontFamily: settings.tipo_letra, fontSize: `${settings.tamano_letra}px`, color: settings.color_primario, backgroundColor: settings.color_secundario }}>
          <div className="invoice-receipt-header">
            {settings.mostrar_logo && <div className="invoice-receipt-logo">R</div>}
            <div className="invoice-receipt-header-details">
              <strong>{settings.nombre_empresa || selectedUser?.nombre || 'Nombre de empresa'}</strong>
              {settings.identificacion_empresa && <span>{settings.identificacion_empresa}</span>}
              {settings.telefono_empresa && <span>{settings.telefono_empresa}</span>}
              {settings.direccion_empresa && <span>{settings.direccion_empresa}</span>}
            </div>
          </div>
          <hr />
          <span>{settings.mensaje_encabezado || 'Factura de rifa'}</span>
          {previewContent[settings.modelo_factura] || previewContent.clasica}
          <hr />
          <strong>Total: $0.50</strong>
          <span>Factura: A0**1 · Fecha: 19/08/2026</span>
          <span>ID: 1</span>
          <span>{settings.mensaje_pie || 'Gracias por participar'}</span>
        </article></section>
      </div>}
    </section>
  )
}

export default InvoiceSettingsCrm