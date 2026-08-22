function MenuItem({ label, icon, active = false, onClick }) {
  return (
    <button className={`menu-item ${active ? 'active' : ''}`} type="button" onClick={onClick}>
      <span className="menu-icon">{icon}</span>
      <span>{label}</span>
    </button>
  )
}

export default MenuItem
