export const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000'
export const SESSION_EXPIRED_EVENT = 'rifa-session-expired'

export const getStoredSession = () => {
  try {
    return JSON.parse(sessionStorage.getItem('rifa-session') || '{}')
  } catch {
    return {}
  }
}

// Adjunta el token de sesion y notifica al resto de la app cuando el servidor la considera cerrada.
export const apiRequest = async (path, options = {}) => {
  const token = getStoredSession().token
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: { ...(options.headers || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  })

  if (response.status === 401) {
    sessionStorage.removeItem('rifa-session')
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT))
  }

  const responseText = await response.text()
  let data = null
  try {
    data = responseText ? JSON.parse(responseText) : null
  } catch {
    data = null
  }
  if (!response.ok) throw new Error(data?.message || responseText || `Solicitud rechazada (${response.status})`)
  return data
}
