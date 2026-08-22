import { useEffect, useState } from 'react'

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000'
const request = async (path, options = {}) => {
  const session = JSON.parse(sessionStorage.getItem('rifa-session') || '{}')
  const response = await fetch(`${apiUrl}${path}`, { ...options, headers: { ...(options.headers || {}), Authorization: `Bearer ${session.token || ''}` } })
  const data = await response.json()
  if (!response.ok) throw new Error(data.message || 'No se pudo completar la solicitud')
  return data
}

const formatDate = (value) => value ? new Date(value).toLocaleString('es-CO') : '-'

function SecurityCrm() {
  const [sessions, setSessions] = useState([])
  const [minutes, setMinutes] = useState('60')
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  const loadSessions = async () => {
    try {
      setIsLoading(true)
      setError('')
      setSessions(await request('/api/security/sessions'))
      setPage(1)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { loadSessions() }, [])

  const manageUser = async (userId, action) => {
    try {
      setError('')
      const message = action === 'block' ? `Bloquear usuario durante ${minutes} minutos?` : 'Cerrar todas sus sesiones activas?'
      if (!window.confirm(message)) return
      await request(`/api/security/users/${userId}/${action === 'block' ? 'block' : 'sessions/revoke'}`, {
        method: 'POST',
        ...(action === 'block' ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ minutes: Number(minutes) }) } : {}),
      })
      await loadSessions()
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  const users = [...new Map(sessions.map((session) => [session.id_usuario, session.usuario])).values()].filter(Boolean)
  const pageSize = 10
  const totalPages = Math.max(1, Math.ceil(sessions.length / pageSize))
  const visibleSessions = sessions.slice((page - 1) * pageSize, page * pageSize)

  return <section className="security-crm">
    <div className="security-toolbar"><label><span>Bloqueo temporal</span><select value={minutes} onChange={(event) => setMinutes(event.target.value)}><option value="15">15 minutos</option><option value="60">1 hora</option><option value="1440">24 horas</option><option value="10080">7 dias</option></select></label><button className="btn btn-ghost" type="button" onClick={loadSessions}>Actualizar</button></div>
    {error && <p className="dashboard-message dashboard-message--error">{error}</p>}
    {isLoading && <p className="dashboard-message">Cargando inicios de sesion...</p>}
    {!isLoading && <div className="users-table-wrap"><table className="users-table security-table">
      <thead><tr><th>Usuario</th><th>IP publica</th><th>Dispositivo</th><th>Inicio</th><th>Ultimo acceso</th><th>Estado</th><th aria-label="Acciones" /></tr></thead>
      <tbody>{visibleSessions.map((session) => <tr key={session.id}>
        <td><strong>{session.usuario?.nombre || `Usuario ${session.id_usuario}`}</strong><span>{session.usuario?.correo || '-'}</span></td>
        <td>{session.ip || 'No registrada'}</td>
        <td><span>{session.navegador && session.navegador !== 'api' ? session.navegador : 'Sesion anterior'}</span><small>{session.sistema_operativo || 'Sistema no registrado'}</small></td>
        <td>{formatDate(session.fecha_inicio)}</td><td>{formatDate(session.ultimo_acceso)}</td>
        <td><span className={`user-status ${session.estado === 'activa' ? 'user-status--active' : ''}`}>{session.estado}</span>{session.usuario?.bloqueado_hasta && new Date(session.usuario.bloqueado_hasta) > new Date() && <small>Bloqueado hasta {formatDate(session.usuario.bloqueado_hasta)}</small>}</td>
        <td className="user-actions">{session.usuario && <><button className="btn btn-ghost" type="button" disabled={session.estado !== 'activa'} onClick={() => manageUser(session.id_usuario, 'revoke')}>Cerrar sesiones</button><button className="btn btn-danger" type="button" onClick={() => manageUser(session.id_usuario, 'block')}>Bloquear</button></>}</td>
      </tr>)}
        {sessions.length === 0 && <tr><td className="users-empty" colSpan="7">No hay inicios de sesion registrados.</td></tr>}
      </tbody>
    </table></div>}
    {!isLoading && sessions.length > 0 && <div className="pagination-bar"><span>Pagina {page} de {totalPages} ({sessions.length} sesiones)</span><div><button className="btn btn-ghost" type="button" disabled={page === 1} onClick={() => setPage((current) => current - 1)}>Anterior</button><button className="btn btn-ghost" type="button" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)}>Siguiente</button></div></div>}
    {!isLoading && users.length > 0 && <p className="dashboard-message">Se muestran solo usuarios permitidos para tu rol.</p>}
  </section>
}

export default SecurityCrm