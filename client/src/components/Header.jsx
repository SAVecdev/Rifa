import PrimaryButton from './PrimaryButton'

function Header({ title, subtitle, actionLabel }) {
  return (
    <header className="topbar">
      <div>
        <p className="eyebrow">{subtitle}</p>
        <h1>{title}</h1>
      </div>

      {actionLabel && <PrimaryButton>{actionLabel}</PrimaryButton>}
    </header>
  )
}

export default Header
