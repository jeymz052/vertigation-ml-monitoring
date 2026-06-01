import SystemStatus from '../components/SystemStatus'

export default function SettingsPage({ data }) {
  return (
    <main style={styles.main}>
      <section style={styles.hero}>
        <h1 style={styles.title}>Settings</h1>
        <p style={styles.subtitle}>Basic application preferences and system configuration placeholders.</p>
      </section>

      <div style={styles.grid}>
        <article style={styles.card}>
          <h2 style={styles.cardTitle}>System Preferences</h2>
          <div style={styles.row}>
            <span>Theme</span>
            <span style={styles.badge}>Green dashboard</span>
          </div>
          <div style={styles.row}>
            <span>Default page</span>
            <span style={styles.badge}>Dashboard</span>
          </div>
          <div style={styles.row}>
            <span>Navigation</span>
            <span style={styles.badge}>Header tabs</span>
          </div>
        </article>

        <article style={styles.card}>
          <h2 style={styles.cardTitle}>Integration Notes</h2>
          <p style={styles.text}>
            This page can later hold alert thresholds, Blynk settings, Wi-Fi credentials, and user preferences.
          </p>
          <p style={styles.text}>
            The machine learning section is prepared for a Random Forest workflow when you add the training data and evaluation outputs.
          </p>
        </article>
      </div>

      <section style={{ marginTop: 18 }}>
        <article style={styles.card}>
          <h2 style={styles.cardTitle}>System Status</h2>
          <SystemStatus data={data} />
        </article>
      </section>
    </main>
  )
}

const styles = {
  main: {
    padding: '2rem 3rem 3rem',
    maxWidth: 1400,
    margin: '0 auto',
    color: 'var(--slate-900)',
  },
  hero: { marginBottom: 20 },
  title: { fontSize: 32, fontWeight: 800, marginBottom: 6 },
  subtitle: { fontSize: 14, color: 'var(--slate-600)', fontFamily: "'DM Mono', monospace" },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 18 },
  card: {
    background: 'white',
    border: '1px solid rgba(15,23,42,0.04)',
    borderRadius: 18,
    boxShadow: 'var(--shadow-sm)',
    padding: '1.5rem',
  },
  cardTitle: { fontSize: 16, fontWeight: 800, marginBottom: 14 },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 0',
    borderBottom: '1px solid rgba(15,23,42,0.06)',
    fontSize: 14,
  },
  badge: {
    background: 'rgba(22,163,74,0.08)',
    color: 'var(--green-700)',
    border: '1px solid rgba(22,163,74,0.14)',
    borderRadius: 999,
    padding: '6px 12px',
    fontSize: 12,
    fontWeight: 700,
  },
  text: { fontSize: 13, color: 'var(--slate-600)', lineHeight: 1.7, marginBottom: 12 },
}
