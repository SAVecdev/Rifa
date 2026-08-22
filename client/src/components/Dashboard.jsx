import StatCard from './StatCard'
import RaffleList from './RaffleList'
import SalesList from './SalesList'

const formatMoney = (value) => new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
}).format(Number(value || 0))

const formatDate = (value) => new Date(`${value}T00:00:00`).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit' })

function Dashboard({ data, stats: legacyStats = [], rifas = [], ventas = [], filters, onFilterChange, onFilterSubmit }) {
  if (!data) {
    return (
      <main className="main-panel">
        <section className="stats-grid">
          {legacyStats.map((stat) => <StatCard key={stat.label} label={stat.label} value={stat.value} accent={stat.accent} helper={stat.helper} />)}
        </section>
        <section className="content-grid">
          <RaffleList items={rifas} />
          <SalesList items={ventas} />
        </section>
      </main>
    )
  }

  const { stats, daily = [], ranking = [], period } = data
  const maxDailySales = Math.max(...daily.map((day) => Number(day.ventas_monto || 0)), 1)

  return (
    <main className="admin-overview">
      <form className="dashboard-period-form" onSubmit={onFilterSubmit}>
        <label><span>Desde</span><input name="dateFrom" type="date" value={filters.dateFrom} onChange={onFilterChange} /></label>
        <label><span>Hasta</span><input name="dateTo" type="date" value={filters.dateTo} onChange={onFilterChange} /></label>
        <button className="btn btn-primary" type="submit">Actualizar</button>
      </form>

      <section className="dashboard-stat-grid">
        <article className="dashboard-stat dashboard-stat--yellow"><span>Ventas del periodo</span><strong>{formatMoney(stats.ventas_periodo)}</strong><small>{stats.ventas_cantidad} ventas</small></article>
        <article className="dashboard-stat dashboard-stat--blue"><span>Premios del periodo</span><strong>{formatMoney(stats.premios_periodo)}</strong><small>{stats.dias_con_actividad} dias con actividad</small></article>
        <article className="dashboard-stat dashboard-stat--green"><span>Premios pagados</span><strong>{formatMoney(stats.premios_pagados)}</strong><small>Pagos registrados</small></article>
        <article className="dashboard-stat dashboard-stat--purple"><span>Premios pendientes</span><strong>{formatMoney(stats.premios_pendientes)}</strong><small>Por pagar</small></article>
        <article className="dashboard-stat dashboard-stat--red"><span>Utilidad neta</span><strong>{formatMoney(stats.utilidad_neta)}</strong><small>{stats.vendedores} vendedores</small></article>
      </section>

      <section className="dashboard-middle-grid">
        <article className="dashboard-panel dashboard-ranking-panel">
          <div className="dashboard-panel-heading"><h2>Vendedores ranking</h2><span>{data.period.from} a {data.period.to}</span></div>
          <div className="dashboard-ranking-list">
            {ranking.map((seller, index) => <div className="dashboard-ranking-row" key={seller.id_usuario}><strong>#{index + 1}</strong><span>{seller.nombre}</span><i><b style={{ width: `${Math.max(8, seller.ventas_monto / Math.max(ranking[0]?.ventas_monto || 1, 1) * 100)}%` }} /></i><em>{formatMoney(seller.ventas_monto)}</em></div>)}
            {ranking.length === 0 && <p className="empty-list">No hay ventas en este periodo.</p>}
          </div>
        </article>

        <article className="dashboard-panel dashboard-chart-panel">
          <div className="dashboard-panel-heading"><h2>Ventas diarias</h2><span>{daily.length} dias</span></div>
          <div className="dashboard-chart" aria-label="Ventas por dia">
            {daily.map((day) => <div className="dashboard-chart-column" key={day.fecha} title={`${formatDate(day.fecha)}: ${formatMoney(day.ventas_monto)}`}><b style={{ height: `${Math.max(3, Number(day.ventas_monto || 0) / maxDailySales * 100)}%` }} /><span>{formatDate(day.fecha)}</span></div>)}
            {daily.length === 0 && <p className="empty-list">No hay datos diarios.</p>}
          </div>
        </article>

        <article className="dashboard-panel dashboard-side-panel">
          <div className="dashboard-panel-heading"><h2>Resumen rapido</h2></div>
          <div className="dashboard-side-item"><span>Ventas de hoy</span><strong>{formatMoney(stats.ventas_hoy)}</strong></div>
          <div className="dashboard-side-item"><span>Pagos de hoy</span><strong>{formatMoney(stats.pagos_hoy)}</strong></div>
          <div className="dashboard-side-item"><span>Vendedores activos</span><strong>{stats.vendedores}</strong></div>
          <div className="dashboard-side-item"><span>Dias registrados</span><strong>{stats.dias_con_actividad}</strong></div>
        </article>
      </section>

      <section className="dashboard-bottom-grid">
        <article className="dashboard-bottom-card dashboard-bottom-card--green"><span>Ventas de hoy</span><strong>{formatMoney(stats.ventas_hoy)}</strong><small>{stats.ventas_cantidad} ventas del periodo</small></article>
        <article className="dashboard-bottom-card dashboard-bottom-card--teal"><span>Vendedores</span><strong>{stats.vendedores}</strong><small>Con estadisticas registradas</small></article>
        <article className="dashboard-bottom-card dashboard-bottom-card--red"><span>Premios pagados</span><strong>{formatMoney(stats.premios_pagados)}</strong><small>Acumulado del periodo</small></article>
        <article className="dashboard-bottom-card dashboard-bottom-card--pink"><span>Pagos de hoy</span><strong>{formatMoney(stats.pagos_hoy)}</strong><small>Movimiento de hoy</small></article>
      </section>
    </main>
  )
}

export default Dashboard
