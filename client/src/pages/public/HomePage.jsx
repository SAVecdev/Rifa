import { useEffect, useState } from 'react'
import PrimaryButton from '../../components/PrimaryButton'
import LoginModal from '../../components/LoginModal'

const features = [
  {
    title: 'Premios reales',
    text: 'Descubre rifas con premios atractivos, claros y con la emoción de ganar algo que realmente vale la pena.',
  },
  {
    title: 'Compra fácil',
    text: 'Selecciona tus números, revisa la rifa y participa sin complicaciones ni procesos largos.',
  },
  {
    title: 'Participa con confianza',
    text: 'Todo está organizado para que veas la información de la rifa, boletos disponibles y resultados con claridad.',
  },
]

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000'

const request = async (path) => {
  const response = await fetch(`${apiUrl}${path}`)
  const data = await response.json()
  if (!response.ok) throw new Error(data.message || 'No se pudo cargar la informacion')
  return data
}

const formatDate = (value) => value ? new Date(value).toLocaleDateString('es-CO', { dateStyle: 'long' }) : 'Fecha no definida'

function HomePage({ onRoleLogin }) {
  const [isLoginOpen, setIsLoginOpen] = useState(false)
  const [raffles, setRaffles] = useState([])
  const [areaCount, setAreaCount] = useState(0)
  const [salesCount, setSalesCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    const loadPublicData = async () => {
      try {
        const [loadedRaffles, loadedAreas, loadedSales] = await Promise.all([
          request('/api/raffles'),
          request('/api/areas'),
          request('/api/reports/ventas?all=true'),
        ])
        setRaffles(loadedRaffles || [])
        setAreaCount((loadedAreas || []).length)
        setSalesCount((loadedSales?.data || []).length)
      } catch (requestError) {
        setLoadError(requestError.message)
      } finally {
        setIsLoading(false)
      }
    }
    loadPublicData()
  }, [])

  const handleLogin = (user) => {
    setIsLoginOpen(false)
    onRoleLogin?.(user)
  }

  const showRaffles = () => {
    document.getElementById('catalogo-rifas')?.scrollIntoView({ behavior: 'smooth' })
  }

  const activeRaffles = raffles.filter((raffle) => !raffle.fecha_hora_juego || new Date(raffle.fecha_hora_juego) > new Date())
  const featuredRaffle = activeRaffles[0] || raffles[0]
  const metrics = [
    { value: String(raffles.length), label: 'rifas registradas' },
    { value: String(activeRaffles.length), label: 'rifas activas' },
    { value: String(salesCount), label: 'ventas registradas' },
    { value: String(areaCount), label: 'areas configuradas' },
  ]

  return (
    <>
      <div className="landing-page">
        <header className="landing-header">
          <div className="brand-row">
            <div className="brand-mark">R</div>
            <div>
              <strong>Rifa Premium</strong>
              <small>Tu próxima oportunidad empieza aquí</small>
            </div>
          </div>

          <nav className="landing-nav" aria-label="Navegación principal">
            <a href="#beneficios">Beneficios</a>
            <a href="#rifas">Rifas</a>
            <a href="#ganadores">Ganadores</a>
          </nav>

          <PrimaryButton className="login-btn" onClick={() => setIsLoginOpen(true)}>
            Iniciar sesión
          </PrimaryButton>
        </header>

        <main className="landing-main">
          <section className="hero-section" id="rifas">
            <div className="hero-copy">
              <span className="eyebrow eyebrow--light">Hoy puedes ganar más</span>
              <h1>Participa en rifas emocionantes con premios que te hacen soñar.</h1>
              <p>Consulta las rifas disponibles, revisa su informacion y accede al sistema con los datos configurados por la administracion.</p>

              <div className="hero-actions">
                <PrimaryButton className="primary-cta" onClick={showRaffles}>Ver rifas</PrimaryButton>
                <button className="btn btn-primary" type="button" onClick={() => setIsLoginOpen(true)}>
                  Iniciar sesión
                </button>
              </div>

              <div className="hero-metrics">
                {metrics.map((metric) => (
                  <div key={metric.label} className="metric-item">
                    <strong>{metric.value}</strong>
                    <span>{metric.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="hero-visual">
              <div className="raffle-card raffle-card--main">
                <div className="card-topline">
                  <span>Premio del día</span>
                  <span className="pill">Activa</span>
                </div>

                <h2>{isLoading ? 'Cargando rifas...' : featuredRaffle?.nombre || 'No hay rifas publicadas'}</h2>

                <div className="raffle-prize">
                  <strong>{featuredRaffle ? `${featuredRaffle.sorteos || 0}` : '0'}</strong>
                  <span>sorteos configurados</span>
                </div>

                <div className="progress-wrap">
                  <div className="progress-label">
                    <span>Fecha del sorteo</span>
                    <span>{featuredRaffle ? formatDate(featuredRaffle.fecha_hora_juego) : '-'}</span>
                  </div>
                  <div className="progress-bar">
                    <span style={{ width: featuredRaffle ? '100%' : '0%' }} />
                  </div>
                </div>

                <div className="ticket-row">
                  {(featuredRaffle ? [featuredRaffle.id, featuredRaffle.sorteos, featuredRaffle.id_tipo, featuredRaffle.id_imagen] : []).map((value, index) => <span key={`${value}-${index}`}>{value || '-'}</span>)}
                </div>
              </div>

              <div className="mini-card mini-card--top">
                <span>Rifas activas</span>
                <strong>{activeRaffles.length}</strong>
              </div>

              <div className="mini-card mini-card--bottom">
                <span>Areas configuradas</span>
                <strong>{areaCount}</strong>
              </div>
            </div>
          </section>

          <section className="showcase-section" id="catalogo-rifas">
            <div className="section-heading">
              <span className="eyebrow">Catalogo actual</span>
              <h2>Rifas configuradas en el sistema</h2>
            </div>
            {isLoading && <p className="dashboard-message">Cargando rifas...</p>}
            {!isLoading && raffles.length === 0 && <p className="dashboard-message">No hay rifas disponibles actualmente.</p>}
            {!isLoading && raffles.length > 0 && <div className="feature-grid">
              {raffles.slice(0, 3).map((raffle) => {
                const isActive = !raffle.fecha_hora_juego || new Date(raffle.fecha_hora_juego) > new Date()
                return <article key={raffle.id} className="feature-card">
                  <div className="card-topline"><span>Rifa #{raffle.id}</span><span className="pill">{isActive ? 'Activa' : 'Finalizada'}</span></div>
                  <h3>{raffle.nombre || 'Rifa sin nombre'}</h3>
                  <p>Fecha del sorteo: {formatDate(raffle.fecha_hora_juego)}</p>
                  <p>Sorteos configurados: {raffle.sorteos || 0}</p>
                </article>
              })}
            </div>}
          </section>

          <section className="benefits-section" id="beneficios">
            <div className="section-heading">
              <span className="eyebrow">¿Por qué participar?</span>
              <h2>Informacion actualizada desde la operacion de rifas.</h2>
            </div>

            <div className="feature-grid">
                {features.map((feature) => (
                <article key={feature.title} className="feature-card">
                  <div className="feature-icon">✦</div>
                  <h3>{feature.title}</h3>
                  <p>{feature.text}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="showcase-section" id="ganadores">
            <div className="showcase-panel">
              <div>
                <span className="eyebrow">Una experiencia clara</span>
                <h2>Consulta el catalogo configurado y utiliza el sistema con informacion verificable.</h2>
              </div>

              <ul className="check-list">
                {[
                  `${raffles.length} rifas cargadas en el sistema`,
                  `${activeRaffles.length} rifas con fecha vigente`,
                  `${salesCount} ventas registradas`,
                  `${areaCount} areas configuradas`,
                ].map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            {loadError && <p className="dashboard-message dashboard-message--error">{loadError}</p>}
          </section>
        </main>
      </div>

      <LoginModal isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} onLogin={handleLogin} />
    </>
  )
}

export default HomePage
