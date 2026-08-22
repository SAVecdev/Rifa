import { useState } from 'react'
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'
import Dashboard from '../components/Dashboard'
import PrimaryButton from '../components/PrimaryButton'
import LoginModal from '../components/LoginModal'

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

const metrics = [
  { value: '12k+', label: 'boletos vendidos' },
  { value: '320', label: 'rifas activas' },
  { value: '96%', label: 'participantes felices' },
  { value: '5k+', label: 'ganadores', accent: true, helper: 'y contando...' },
]

const highlights = [
  'Premios de alto valor',
  'Rifas verificadas y activas',
  'Compra rápida y segura',
  'Ganadores claros y transparentes',
]

const sellerStats = [
  { label: 'Total recaudado', value: '$18,450', accent: true },
  { label: 'Boletos vendidos', value: '1,240' },
  { label: 'Rifas activas', value: '8' },
  { label: 'Ganadores', value: '3' },
]

const adminStats = [
  { label: 'Ingresos totales', value: '$86,200', accent: true },
  { label: 'Usuarios activos', value: '1,430' },
  { label: 'Sucursales', value: '12' },
  { label: 'Margen neto', value: '28%' },
]

const supervisorStats = [
  { label: 'Supervisión total', value: '94%', accent: true },
  { label: 'Cobertura', value: '18 zonas' },
  { label: 'Incidencias', value: '7' },
  { label: 'Cumplimiento', value: '92%' },
]

const sellerRaffles = [
  { id: 1, nombre: 'Toyota Corolla', precio: 120, vendidos: 18, total: 100, estado: 'Activa' },
  { id: 2, nombre: 'Moto XR 250', precio: 90, vendidos: 34, total: 80, estado: 'Activa' },
  { id: 3, nombre: 'Bicicleta premium', precio: 60, vendidos: 12, total: 50, estado: 'Cerrada' },
]

const adminRaffles = [
  { id: 1, nombre: 'BMW Serie 3', precio: 200, vendidos: 48, total: 120, estado: 'Activa' },
  { id: 2, nombre: 'Laptop premium', precio: 120, vendidos: 72, total: 90, estado: 'Activa' },
  { id: 3, nombre: 'Smart TV 75', precio: 95, vendidos: 33, total: 60, estado: 'Cerrada' },
]

const supervisorRaffles = [
  { id: 1, nombre: 'Monterrey Zona Norte', precio: 150, vendidos: 61, total: 100, estado: 'Activa' },
  { id: 2, nombre: 'Ciudad de México', precio: 170, vendidos: 42, total: 120, estado: 'Activa' },
  { id: 3, nombre: 'Guadalajara', precio: 110, vendidos: 26, total: 80, estado: 'Cerrada' },
]

const sellerSales = [
  { id: 1, vendedor: 'María', rifa: 'Toyota Corolla', numeros: '12, 27, 58', total: '$360' },
  { id: 2, vendedor: 'Luis', rifa: 'Moto XR 250', numeros: '5, 9, 21', total: '$270' },
  { id: 3, vendedor: 'Ana', rifa: 'Bicicleta premium', numeros: '40, 45', total: '$120' },
]

const adminSales = [
  { id: 1, vendedor: 'Admin Central', rifa: 'BMW Serie 3', numeros: '8, 15, 44', total: '$600' },
  { id: 2, vendedor: 'Operación Norte', rifa: 'Laptop premium', numeros: '7, 37, 49', total: '$360' },
  { id: 3, vendedor: 'Ventas Sur', rifa: 'Smart TV 75', numeros: '12, 17', total: '$190' },
]

const supervisorSales = [
  { id: 1, vendedor: 'Zona Norte', rifa: 'Monterrey', numeros: '11, 24, 39', total: '$450' },
  { id: 2, vendedor: 'Zona Centro', rifa: 'CDMX', numeros: '20, 33, 61', total: '$510' },
  { id: 3, vendedor: 'Zona Occidente', rifa: 'Guadalajara', numeros: '5, 18', total: '$220' },
]

const roleConfig = {
  vendedor: {
    title: 'Panel del vendedor',
    subtitle: 'Resumen',
    stats: sellerStats,
    rifas: sellerRaffles,
    ventas: sellerSales,
  },
  administrador: {
    title: 'Panel del administrador',
    subtitle: 'Operación general',
    stats: adminStats,
    rifas: adminRaffles,
    ventas: adminSales,
  },
  supervisor: {
    title: 'Panel del supervisor',
    subtitle: 'Control y seguimiento',
    stats: supervisorStats,
    rifas: supervisorRaffles,
    ventas: supervisorSales,
  },
}

function HomePage() {
  const [isLoginOpen, setIsLoginOpen] = useState(false)
  const [userRole, setUserRole] = useState(null)

  const handleLoginSuccess = (user) => {
    setIsLoginOpen(false)
    setUserRole(user.role)
  }

  if (userRole && roleConfig[userRole]) {
    const currentRole = roleConfig[userRole]

    return (
      <div className="app-shell">
        <Sidebar role={userRole} />

        <div className="content-wrap">
          <Header title={currentRole.title} subtitle={currentRole.subtitle} actionLabel="Nueva venta" />
          <Dashboard stats={currentRole.stats} rifas={currentRole.rifas} ventas={currentRole.ventas} />
        </div>
      </div>
    )
  }

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
              <p>
                Encuentra rifas activas, revisa los premios, elige tus números y participa con la confianza de una
                experiencia moderna, rápida y transparente.
              </p>

              <div className="hero-actions">
                <PrimaryButton className="primary-cta">Ver rifas</PrimaryButton>
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

                <h2>Toyota Corolla 2025</h2>

                <div className="raffle-prize">
                  <strong>$120</strong>
                  <span>por boleto</span>
                </div>

                <div className="progress-wrap">
                  <div className="progress-label">
                    <span>Boletos vendidos</span>
                    <span>68%</span>
                  </div>
                  <div className="progress-bar">
                    <span style={{ width: '68%' }} />
                  </div>
                </div>

                <div className="ticket-row">
                  <span>12</span>
                  <span>28</span>
                  <span>41</span>
                  <span>67</span>
                </div>
              </div>

              <div className="mini-card mini-card--top">
                <span>Premio mayor</span>
                <strong>$180k</strong>
              </div>

              <div className="mini-card mini-card--bottom">
                <span>Participantes hoy</span>
                <strong>146</strong>
              </div>
            </div>
          </section>

          <section className="benefits-section" id="beneficios">
            <div className="section-heading">
              <span className="eyebrow">¿Por qué participar?</span>
              <h2>Porque cada boleto trae emoción, esperanza y grandes premios.</h2>
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
                <h2>Compra con emoción, sin estrés y con la certeza de estar participando en algo real.</h2>
              </div>

              <ul className="check-list">
                {highlights.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </section>
        </main>
      </div>

      <LoginModal isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} onLogin={handleLoginSuccess} />
    </>
  )
}

export default HomePage
