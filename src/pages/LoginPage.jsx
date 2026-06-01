import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import logo from '../images/vertigationlogo-removebg-preview.png'
import bg from '../images/vertigationbg.jpg'

export default function LoginPage() {
  const { login, error } = useAuth()
  const [user, setUser] = useState('')
  const [pass, setPass] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [shaking, setShaking] = useState(false)

  const handleSubmit = (e) => {
    e.preventDefault()
    const ok = login(user, pass)
    if (!ok) {
      setShaking(true)
      setTimeout(() => setShaking(false), 500)
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.grid} aria-hidden="true" />

      <div style={{ ...styles.card, animation: shaking ? 'shake 0.4s ease' : undefined }}>
        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.logoWrap}>
            <img src={logo} alt="Vertigation logo" style={styles.logoImage} />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Username</label>
            <input
              style={styles.input}
              type="text"
              value={user}
              onChange={e => setUser(e.target.value)}
              placeholder="Enter username"
              autoComplete="username"
              required
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Password</label>
            <div style={styles.passWrap}>
              <input
                style={{ ...styles.input, paddingRight: 44, width: '100%', boxSizing: 'border-box' }}
                type={showPass ? 'text' : 'password'}
                value={pass}
                onChange={e => setPass(e.target.value)}
                placeholder="Enter password"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPass(s => !s)}
                aria-label={showPass ? 'Hide password' : 'Show password'}
                style={styles.eyeBtn}
              >
                <i className={showPass ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye'} aria-hidden="true" />
              </button>
            </div>
          </div>

          {error && (
            <div style={styles.errorBox}>
                <span><i className="fa-solid fa-triangle-exclamation" style={{ marginRight: 8 }} />{error}</span>
              </div>
          )}

          <button style={styles.btn} type="submit">
            Sign in →
          </button>
        </form>
        <p style={styles.credit}>Powered by Group 1 · All Rights Reserved 2026 · Vertigation ML Thesis Project</p>
      </div>

      <style>{`
        @keyframes shake {
          0%,100% { transform: translateX(0); }
          20%,60%  { transform: translateX(-8px); }
          40%,80%  { transform: translateX(8px); }
        }
        input:focus { outline: none; border-color: #2ecc71 !important; box-shadow: 0 0 0 3px rgba(46,204,113,0.15) !important; }
        input::placeholder { color: rgba(255,255,255,0.88); opacity: 1; }
        button:hover { background: #27ae60 !important; transform: translateY(-1px); }
        button:active { transform: translateY(0); }
      `}</style>
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: `linear-gradient(rgba(3,7,18,0.36), rgba(3,7,18,0.36)), url(${bg})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    position: 'relative',
    overflow: 'hidden',
    fontFamily: "'Outfit', sans-serif",
  },
  grid: {
    position: 'absolute', inset: 0,
    backgroundImage: 'none',
    backgroundSize: '0 0',
    pointerEvents: 'none',
  },
  blob: {
    position: 'absolute',
    borderRadius: '50%',
    filter: 'blur(80px)',
    pointerEvents: 'none',
  },
  card: {
    position: 'relative',
    // lower opacity so background remains visible while keeping readability
    background: 'rgba(255,255,255,0.06)',
    backdropFilter: 'blur(6px)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 20,
    padding: '2.5rem 2rem',
    width: '100%',
    maxWidth: 460,
    boxShadow: '0 14px 40px rgba(2,6,23,0.45)',
    animation: 'fadeUp 0.5s ease both',
  },
  logoWrap: {
    display: 'flex', justifyContent: 'center', marginBottom: '1rem',
  },
  logoImage: { height: 84, width: 'auto', objectFit: 'contain', display: 'block' },
  title: {
    textAlign: 'center',
    fontSize: 22,
    fontWeight: 700,
    color: 'white',
    marginBottom: 4,
  },
  sub: {
    textAlign: 'center',
    fontSize: 13,
    color: 'white',
    marginBottom: '2rem',
    fontFamily: "'DM Mono', monospace",
  },
  form: { display: 'flex', flexDirection: 'column', gap: 14 },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.96)', textTransform: 'uppercase', letterSpacing: '0.05em' },
  input: {
    // subtle input background that keeps contrast but shows the backdrop
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 10,
    padding: '10px 14px',
    fontSize: 15,
    color: 'white',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    fontFamily: "'Outfit', sans-serif",
  },
  passWrap: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    width: '100%',
  },
  eyeBtn: {
    position: 'absolute',
    right: 12,
    top: '50%',
    transform: 'translateY(-50%)',
    border: 'none',
    background: 'transparent',
    color: 'rgba(255,255,255,0.95)',
    cursor: 'pointer',
    padding: 6,
    borderRadius: 8,
    fontSize: 14,
  },
  credit: {
    marginTop: 12,
    textAlign: 'center',
    fontSize: 12,
    color: 'rgba(255,255,255,0.94)',
    fontFamily: "'DM Mono', monospace",
  },
  errorBox: {
    background: 'rgba(220,38,38,0.12)',
    border: '1px solid rgba(220,38,38,0.22)',
    borderRadius: 8,
    padding: '10px 14px',
    fontSize: 13,
    color: 'var(--red-600)',
  },
  btn: {
    marginTop: 6,
    background: '#2ecc71',
    border: 'none',
    borderRadius: 10,
    padding: '12px',
    fontSize: 15,
    fontWeight: 700,
    color: 'white',
    cursor: 'pointer',
    transition: 'background 0.2s, transform 0.15s',
    fontFamily: "'Outfit', sans-serif",
  },
  footer: {
    display: 'none',
  },
}
