import MenuItem from './MenuItem'

const menuByRole = {
  vendedor: [
    { label: 'Resumen', icon: '◫', id: 'resumen' },
    { label: 'Historial de facturas', icon: '▤', id: 'historial-facturas' },
    { label: 'Historial de ventas', icon: '▤', id: 'historial-ventas' },
    { label: 'Pagar premios', icon: '✦', id: 'pagar-premios' },
    { label: 'Ventas', icon: '◌', id: 'ventas' },
  ],
  administrador: [
    { label: 'Resumen', icon: '◫', id: 'resumen' },
    { label: 'Usuarios', icon: '◎', id: 'usuarios' },
    { label: 'Imagenes', icon: '◌', id: 'imagenes' },
    { label: 'Areas', icon: '◍', id: 'areas' },
    { label: 'Horarios de venta', icon: '🕒', id: 'horarios-venta' },
    { label: 'Supervisores', icon: '◈', id: 'supervisores' },
    { label: 'Tipos de rifa', icon: '▣', id: 'tipos-rifa' },
    { label: 'Rifas', icon: '◎', id: 'rifas' },
    { label: 'Logos de rifa', icon: '◈', id: 'logos-rifa' },
    { label: 'Cupos por area', icon: '▤', id: 'cupos-rifa' },
    { label: 'Opciones de premios', icon: '✦', id: 'opciones-premios' },
    { label: 'Facturas', icon: '▧', id: 'configuracion-factura' },
    { label: 'Ventas', icon: '◫', id: 'ventas' },
    { label: 'Finanzas', icon: '◌', id: 'finanzas' },
    { label: 'Seguridad', icon: '▣', id: 'seguridad' },
  ],
  supervisor: [
    { label: 'Resumen', icon: '◫', id: 'resumen' },
    { label: 'Vendedores', icon: '◎', id: 'vendedores' },
    { label: 'Seguridad', icon: '▣', id: 'seguridad' },
  ],
}

function Sidebar({ role = 'vendedor', activeItem, onNavigate, onLogout }) {
  const menuItems = menuByRole[role] || menuByRole.vendedor

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">R</div>
        <div>
          <strong>Rifa POS</strong>
          <small>{role}</small>
        </div>
      </div>

      <nav className="menu" aria-label="Menú principal">
        {menuItems.map((item) => (
          <MenuItem
            key={item.label}
            label={item.label}
            icon={item.icon}
            active={item.id ? item.id === activeItem : item.active}
            onClick={() => item.id && onNavigate?.(item.id)}
          />
        ))}
      </nav>
      {onLogout && <button className="logout-button" type="button" onClick={onLogout}>Cerrar sesion</button>}
    </aside>
  )
}

export default Sidebar
