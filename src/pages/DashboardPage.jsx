import EnvMetrics    from '../components/EnvMetrics'
import DashboardControls from '../components/DashboardControls'
import SystemStatus   from '../components/SystemStatus'
import TierMoisture  from '../components/TierMoisture'
import TierCards     from '../components/TierCards'
import DashboardInsights from '../components/DashboardInsights'
import { useMemo } from 'react'
import { buildIrrigationAdvisory, loadTrainedModelSnapshot, predictStoredModel } from '../lib/mlAdvisor'

export default function DashboardPage({ data, history, status, sendControl }) {
  const latestRow = useMemo(() => {
    if (!data) return null
    return {
      t1: Number(data.t1) || 0,
      t2: Number(data.t2) || 0,
      t3: Number(data.t3) || 0,
      temp: Number(data.temp) || 0,
      humidity: Number(data.humidity) || 0,
      lux: Number(data.lux) || 0,
      tank: Number(data.tank) || 0,
      pump: Number(data.pump) || 0,
      features: [
        Number(data.t1) || 0,
        Number(data.t2) || 0,
        Number(data.t3) || 0,
        Number(data.temp) || 0,
        Number(data.humidity) || 0,
        Number(data.lux) || 0,
        Number(data.tank) || 0,
      ],
    }
  }, [data])

  const mlBanner = useMemo(() => {
    const snapshot = loadTrainedModelSnapshot()
    const prediction = snapshot && latestRow ? predictStoredModel(snapshot, latestRow) : null
    return {
      snapshot,
      prediction,
      advisory: buildIrrigationAdvisory(prediction, latestRow, snapshot),
    }
  }, [latestRow])

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

        {data && (
          <div style={{ ...styles.banner, ...(mlBanner.advisory.tone === 'red' ? styles.bannerRed : mlBanner.advisory.tone === 'green' ? styles.bannerGreen : mlBanner.advisory.tone === 'amber' ? styles.bannerAmber : styles.bannerSlate) }}>
            <div style={styles.bannerLabel}>ML recommendation</div>
            <div style={styles.bannerTitle}>{mlBanner.advisory.status}</div>
            <div style={styles.bannerText}>
              {mlBanner.advisory.detail}
              {mlBanner.snapshot?.label ? ` · Model: ${mlBanner.snapshot.label}` : ' · Train a model on the ML page to enable this advisory.'}
            </div>
          </div>
        )}

        {/* Dashboard content */}
        {data && (
          <>
            <TierCards data={data} />
            <EnvMetrics data={data} />
            <DashboardControls data={data} sendControl={sendControl} />
            <SystemStatus data={data} />
            <DashboardInsights data={data} history={history} />
            <TierMoisture data={data} history={history} />
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
  banner: {
    marginBottom: 16,
    padding: '1rem 1.1rem',
    borderRadius: 16,
    border: '1px solid rgba(15,23,42,0.05)',
    background: 'white',
    boxShadow: 'var(--shadow-sm)',
  },
  bannerLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 800, color: 'var(--slate-500)' },
  bannerTitle: { marginTop: 6, fontSize: 20, fontWeight: 900, color: 'var(--slate-900)' },
  bannerText: { marginTop: 6, fontSize: 13, color: 'var(--slate-600)', lineHeight: 1.5 },
  bannerRed: { borderLeft: '5px solid #ef4444', background: 'linear-gradient(180deg, rgba(254,242,242,0.95), rgba(255,255,255,0.98))' },
  bannerGreen: { borderLeft: '5px solid #16a34a', background: 'linear-gradient(180deg, rgba(240,253,244,0.95), rgba(255,255,255,0.98))' },
  bannerAmber: { borderLeft: '5px solid #f59e0b', background: 'linear-gradient(180deg, rgba(255,251,235,0.95), rgba(255,255,255,0.98))' },
  bannerSlate: { borderLeft: '5px solid #64748b', background: 'linear-gradient(180deg, rgba(248,250,252,0.95), rgba(255,255,255,0.98))' },
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
