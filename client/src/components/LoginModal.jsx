import { useState } from 'react'

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000'

function LoginModal({ isOpen, onClose, onLogin }) {
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!isOpen) return null

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
    if (error) setError('')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (isSubmitting) return

    try {
      setIsSubmitting(true)
      setError('')
      const response = await fetch(`${apiUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email, password: form.password }),
      })
      const data = await response.json()

      if (!response.ok) throw new Error(data.message || 'No se pudo iniciar sesion')

      sessionStorage.setItem('rifa-session', JSON.stringify(data))
      onLogin(data.user)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <p className="eyebrow">Bienvenido</p>
            <h2>Iniciar sesión</h2>
          </div>
          <button type="button" className="close-btn" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            <span>Email</span>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              placeholder="correo@ejemplo.com"
            />
          </label>

          <label>
            <span>Contraseña</span>
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              placeholder="••••••••"
            />
          </label>

          {error && <p className="error-message">{error}</p>}

          <button type="submit" className="btn btn-primary btn-block" disabled={isSubmitting}>
            {isSubmitting ? 'Ingresando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default LoginModal
