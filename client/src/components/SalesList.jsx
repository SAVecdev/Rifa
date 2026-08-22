function SalesList({ items }) {
  return (
    <div className="panel">
      <div className="panel-header">
        <h2>Ventas recientes</h2>
      </div>

      <div className="sales-list">
        {items.length === 0 && <p className="empty-list">No hay ventas confirmadas.</p>}
        {items.map((venta) => (
          <div key={venta.id} className="sale-item">
            <div>
              <strong>{venta.usuario?.nombre || 'Usuario sin nombre'}</strong>
              <small>{venta.rifa?.nombre || 'Rifa no disponible'}</small>
            </div>

            <div className="sale-details">
              <span>Numero {venta.numero}</span>
              <strong>{new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(venta.total || 0))}</strong>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default SalesList
