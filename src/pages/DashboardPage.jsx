import EnvMetrics    from '../components/EnvMetrics'
import TierMoisture  from '../components/TierMoisture'
import TierCards     from '../components/TierCards'
import TrendChart    from '../components/TrendChart'

export default function DashboardPage({ data, history, status }) {

  return (
    <div style={styles.page}>
      <main className="page-main dashboard-main" style={styles.main}>
        {/* Hero header */}
        <div className="fade-up fade-up-1 dashboard-hero" style={styles.hero}>
          <h1 className="page-title" style={styles.heroTitle}>Live Dashboard</h1>
          <p className="dashboard-subtitle" style={styles.heroSub}>
            3-tier vertical irrigation · ESP32 · Blynk Cloud
          </p>
        </div>

        {/* Error banner */}
        {status === 'error' && (
          <div style={styles.errorBanner}>
            <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: 8 }} /> Cannot reach Blynk Cloud. Check your internet connection or token.
          </div>
        )}

        {/* Connecting state */}
        {status === 'connecting' && !data && (
          <div style={styles.loading}>
            <div style={styles.spinner} />
            <p>Connecting to sensors...</p>
          </div>
        )}

        {/* Dashboard content */}
        {data && (
          <>
            <TierCards data={data} />
            <EnvMetrics data={data} />
            <div style={styles.bottomGridFull}>
              <TrendChart history={history} />
            </div>
            <TierMoisture data={data} />
          </>
        )}

        <footer style={styles.footer}>
          Vertigation ML · BS Computer Engineering Thesis · {new Date().getFullYear()}
        </footer>
      </main>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    background: 'transparent',
    position: 'relative',
    overflow: 'auto',
  },
  main: {
    position: 'relative', zIndex: 1,
    maxWidth: '100%', margin: '0 auto',
    padding: '2rem 3rem 3rem',
    background: 'linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0) 8%, rgba(248,250,252,0.98) 8%, rgba(248,250,252,0.98) 100%)',
    borderRadius: '0 0 28px 28px',
  },
  hero: { marginBottom: '1.5rem' },
  heroTitle: { fontSize: 34, fontWeight: 800, color: 'var(--slate-900)', marginBottom: 6 },
  heroSub: { fontSize: 14, color: 'var(--slate-600)', fontFamily: "'DM Mono', monospace" },
  errorBanner: {
    background: 'rgba(220,38,38,0.1)',
    border: '1px solid rgba(220,38,38,0.25)',
    borderRadius: 10,
    padding: '12px 16px',
    fontSize: 13,
    color: '#fca5a5',
    marginBottom: 16,
  },
  loading: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', gap: 14, padding: '4rem 0', color: 'var(--slate-600)', fontSize: 14,
  },
  spinner: {
    width: 36, height: 36, borderRadius: '50%',
    border: '3px solid rgba(46,204,113,0.15)',
    borderTopColor: '#2ecc71',
    animation: 'spin 0.8s linear infinite',
  },
  bottomGrid: {
    display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start',
  },
  bottomGridFull: {
    marginTop: 12,
  },
  footer: {
    marginTop: '2rem',
    textAlign: 'center',
    fontSize: 12,
    color: 'var(--slate-600)',
    fontFamily: "'DM Mono', monospace",
    paddingBottom: '1rem',
  },
}
