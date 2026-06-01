import { useAuth } from '../hooks/useAuth'
import logo from '../images/vertigationlogo-removebg-preview.png'

export default function Navbar({ status, lastUpdate, activePage = 'dashboard', onNavigate }) {
  const { logout } = useAuth()

  const statusConfig = {
    connecting: { color: '#f59e0b', text: 'Connecting...' },
    live:       { color: '#2ecc71', text: 'Live' },
    error:      { color: '#ef4444', text: 'Connection error' },
  }[status] ?? { color: '#64748b', text: 'Unknown' }

  return (
    <nav className="app-navbar" style={styles.nav}>
      <div style={styles.left}>
        <img className="app-navbar__logo" src={logo} alt="Vertigation logo" style={styles.logoImage} />
      </div>

      <div className="app-navbar__links" style={styles.links}>
        {[
          { key: 'dashboard', label: 'Dashboard', icon: 'fa-solid fa-house' },
          { key: 'machineLearning', label: 'Machine Learning', icon: 'fa-solid fa-brain' },
          { key: 'reports', label: 'Reports', icon: 'fa-solid fa-chart-line' },
          { key: 'settings', label: 'Settings', icon: 'fa-solid fa-gear' },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => onNavigate?.(item.key)}
            style={{
              ...styles.link,
              ...(activePage === item.key ? styles.linkActive : null),
            }}
            className="app-navbar__link"
          >
            <i className={item.icon} aria-hidden="true" style={styles.linkIcon} />
            {item.label}
          </button>
        ))}
      </div>

      <div className="app-navbar__right" style={styles.right}>
        {/* Status badge */}
        <div style={styles.statusBadge}>
          <span style={{ ...styles.statusDot, background: statusConfig.color,
            animation: status === 'live' ? 'pulse-dot 1.5s ease infinite' : undefined }} />
          <span className="app-navbar__status-text" style={{ fontSize: 12, color: statusConfig.color, fontFamily: "'DM Mono', monospace" }}>
            {statusConfig.text}
          </span>
        </div>

        {lastUpdate && (
          <span className="app-navbar__timestamp" style={styles.timestamp}>
            Updated {lastUpdate.toLocaleTimeString('en-PH', { hour12: false })}
          </span>
        )}

        <button className="app-navbar__logout" onClick={logout} style={styles.logoutBtn}>
          Sign out
        </button>
      </div>

      <style>{`button.logout-btn:hover { background: rgba(239,68,68,0.1) !important; color: #f87171 !important; }`}</style>
    </nav>
  )
}

const styles = {
  nav: {
    display: 'grid', gridTemplateColumns: 'auto 1fr auto', alignItems: 'center',
    padding: '0.8rem 1.5rem',
    background: 'rgba(255,255,255,0.96)',
    borderBottom: '1px solid rgba(15,23,42,0.04)',
    position: 'sticky', top: 0, zIndex: 100,
    gap: 12,
  },
  left: { display: 'flex', alignItems: 'center', gap: 8 },
  logoImage: { height: 64, width: 'auto', objectFit: 'contain', display: 'block' },
  links: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'center' },
  link: {
    border: 'none',
    background: 'transparent',
    color: 'var(--slate-700)',
    borderRadius: 12,
    padding: '8px 14px',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
  },
  linkActive: {
    background: 'rgba(22,163,74,0.12)',
    color: 'var(--green-700)',
  },
  linkIcon: { fontSize: 12 },
  right: { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  statusBadge: {
    display: 'flex', alignItems: 'center', gap: 6,
    background: 'rgba(15,23,42,0.03)',
    border: '1px solid rgba(15,23,42,0.04)',
    borderRadius: 99, padding: '6px 12px',
  },
  statusDot: { width: 7, height: 7, borderRadius: '50%' },
  timestamp: { fontSize: 11, color: 'var(--slate-600)', fontFamily: "'DM Mono', monospace" },
  logoutBtn: {
    fontSize: 12, padding: '8px 14px', borderRadius: 10,
    background: 'rgba(239,68,68,0.08)',
    border: '1px solid rgba(239,68,68,0.1)',
    color: '#dc2626', cursor: 'pointer',
    fontFamily: "'Outfit', sans-serif",
    transition: 'all 0.2s',
  },
}
