import { useState } from 'react'
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

const metrics = [
  { value: '12k+', label: 'boletos vendidos' },
  { value: '320', label: 'rifas activas' },
  { value: '96%', label: 'participantes felices' },
  { value: '5k+', label: 'ganadores' },
]

const highlights = [
  'Premios de alto valor',
  'Rifas verificadas y activas',
  'Compra rápida y segura',
  'Ganadores claros y transparentes',
]

function HomePage({ onRoleLogin }) {
  const [isLoginOpen, setIsLoginOpen] = useState(false)

  const handleLogin = (user) => {
    setIsLoginOpen(false)
    onRoleLogin?.(user)
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

      <LoginModal isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} onLogin={handleLogin} />
    </>
  )
}

export default HomePage
