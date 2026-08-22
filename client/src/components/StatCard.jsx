function StatCard({ label, value, accent = false, helper }) {
  return (
    <article className={`stat-card ${accent ? 'accent' : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {helper && <small>{helper}</small>}
    </article>
  )
}

export default StatCard
