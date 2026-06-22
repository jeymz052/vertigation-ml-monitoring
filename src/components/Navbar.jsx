import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import logo from '../images/vertigationlogo-removebg-preview.png'

export default function Navbar({ status, lastUpdate, activePage = 'dashboard', onNavigate, role = 'admin' }) {
  const { logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  const statusConfig = {
    connecting: { color: '#f59e0b', text: 'Connecting...' },
    live:       { color: '#2ecc71', text: 'Live' },
    error:      { color: '#ef4444', text: 'Connection error' },
  }[status] ?? { color: '#64748b', text: 'Unknown' }

  const navItems = useMemo(() => ([
    { key: 'dashboard', label: 'Dashboard', icon: 'fa-solid fa-house' },
    { key: 'machineLearning', label: 'Machine Learning', icon: 'fa-solid fa-brain', roles: ['admin'] },
    { key: 'reports', label: 'Results', icon: 'fa-solid fa-chart-line', roles: ['admin'] },
    { key: 'settings', label: 'Setup', icon: 'fa-solid fa-gear' },
  ].filter((item) => !item.roles || item.roles.includes(role))), [role])

  useEffect(() => {
    const onDocClick = (event) => {
      if (!menuRef.current?.contains(event.target)) {
        setMenuOpen(false)
      }
    }
    const onEscape = (event) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }

    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onEscape)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onEscape)
    }
  }, [])

  const handleNavigate = (key) => {
    onNavigate?.(key)
    setMenuOpen(false)
  }

  return (
    <nav className="app-navbar" style={styles.nav} ref={menuRef}>
      <div style={styles.left}>
        <img className="app-navbar__logo" src={logo} alt="Vertigation logo" style={styles.logoImage} />
      </div>

      <div className="app-navbar__links" style={styles.links}>
        {navItems.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => handleNavigate(item.key)}
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
        <div style={styles.roleBadge}>{role === 'farmer' ? 'Farmer view' : 'Admin view'}</div>
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

        <button
          type="button"
          className="app-navbar__menuToggle"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Open navigation menu"
          aria-expanded={menuOpen}
          style={styles.menuToggle}
        >
          <i className={`fa-solid ${menuOpen ? 'fa-xmark' : 'fa-bars'}`} aria-hidden="true" />
        </button>

        <button className="app-navbar__logout app-navbar__logout--desktop" onClick={logout} style={styles.logoutBtn}>
          Sign out
        </button>
      </div>

      <div className="app-navbar__mobileMenu" style={{ ...styles.mobileMenu, display: menuOpen ? 'flex' : 'none' }}>
        {navItems.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => handleNavigate(item.key)}
            style={{
              ...styles.mobileMenuItem,
              ...(activePage === item.key ? styles.mobileMenuItemActive : null),
            }}
          >
            <i className={item.icon} aria-hidden="true" style={styles.mobileMenuIcon} />
            <span>{item.label}</span>
          </button>
        ))}
        <button type="button" onClick={logout} style={styles.mobileLogout}>
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
  roleBadge: {
    fontSize: 11,
    fontWeight: 800,
    padding: '7px 10px',
    borderRadius: 999,
    background: 'rgba(22,163,74,0.08)',
    border: '1px solid rgba(22,163,74,0.12)',
    color: 'var(--green-700)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
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
  menuToggle: {
    display: 'none',
    width: 38,
    height: 38,
    borderRadius: 12,
    border: '1px solid rgba(15,23,42,0.08)',
    background: 'white',
    color: 'var(--slate-700)',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    fontSize: 14,
  },
  mobileMenu: {
    gridColumn: '1 / -1',
    display: 'none',
    flexDirection: 'column',
    gap: 8,
    width: '100%',
    padding: '0.25rem 0 0.2rem',
  },
  mobileMenuItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    padding: '10px 12px',
    borderRadius: 12,
    border: '1px solid rgba(15,23,42,0.08)',
    background: 'white',
    color: 'var(--slate-700)',
    fontWeight: 800,
    textAlign: 'left',
  },
  mobileMenuItemActive: {
    background: 'rgba(22,163,74,0.10)',
    color: 'var(--green-800)',
    borderColor: 'rgba(22,163,74,0.18)',
  },
  mobileMenuIcon: { fontSize: 12 },
  mobileLogout: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 12,
    border: '1px solid rgba(239,68,68,0.12)',
    background: 'rgba(239,68,68,0.06)',
    color: '#dc2626',
    fontWeight: 800,
    textAlign: 'left',
  },
}
