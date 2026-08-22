function RaffleList({ items }) {
  return (
    <div className="panel">
      <div className="panel-header">
        <h2>Rifas</h2>
      </div>

      <div className="raffle-list">
        {items.length === 0 && <p className="empty-list">No hay rifas registradas.</p>}
        {items.map((rifa) => (
          <div key={rifa.id} className="raffle-item">
            <div>
              <h3>{rifa.nombre}</h3>
              <small>{rifa.sorteos} sorteo{rifa.sorteos === 1 ? '' : 's'}</small>
            </div>

            <div className="raffle-meta">
              <span>{rifa.ventas_registradas || 0} ventas</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default RaffleList
