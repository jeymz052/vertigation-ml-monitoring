export default function MachineLearningReportsPage() {
  return (
    <main style={styles.main}>
      <section style={styles.hero}>
        <h1 style={styles.title}>Machine Learning Reports</h1>
        <p style={styles.subtitle}>Random Forest will be used for moisture prediction and irrigation decision support.</p>
      </section>

      <div style={styles.grid}>
        <article style={styles.card}>
          <div style={styles.cardHeader}>
            <i className="fa-solid fa-tree" style={styles.icon} />
            <div>
              <h2 style={styles.cardTitle}>Random Forest Overview</h2>
              <p style={styles.cardText}>Ensemble learning model for classification and regression using multiple decision trees.</p>
            </div>
          </div>
          <ul style={styles.list}>
            <li>Input features: soil moisture, temperature, humidity, light, water tank status</li>
            <li>Target outputs: moisture category and irrigation recommendation</li>
            <li>Goal: improve prediction stability compared with a single tree model</li>
          </ul>
        </article>

        <article style={styles.card}>
          <div style={styles.cardHeader}>
            <i className="fa-solid fa-chart-column" style={styles.icon} />
            <div>
              <h2 style={styles.cardTitle}>Model Status</h2>
              <p style={styles.cardText}>Placeholder report page ready for experiment results and evaluation metrics.</p>
            </div>
          </div>
          <div style={styles.metrics}>
            <div style={styles.metricBox}>
              <span style={styles.metricLabel}>Model</span>
              <span style={styles.metricValue}>Random Forest</span>
            </div>
            <div style={styles.metricBox}>
              <span style={styles.metricLabel}>Training</span>
              <span style={styles.metricValue}>Pending</span>
            </div>
            <div style={styles.metricBox}>
              <span style={styles.metricLabel}>Validation</span>
              <span style={styles.metricValue}>Pending</span>
            </div>
          </div>
        </article>
      </div>
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
  cardHeader: { display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 14 },
  icon: { fontSize: 22, color: 'var(--green-600)', marginTop: 2 },
  cardTitle: { fontSize: 16, fontWeight: 800, marginBottom: 4 },
  cardText: { fontSize: 13, color: 'var(--slate-600)', lineHeight: 1.6 },
  list: { margin: '0 0 0 20px', padding: 0, color: 'var(--slate-700)', fontSize: 13, lineHeight: 1.7 },
  metrics: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 },
  metricBox: {
    background: 'rgba(15,23,42,0.02)',
    border: '1px solid rgba(15,23,42,0.04)',
    borderRadius: 14,
    padding: '1rem',
  },
  metricLabel: { display: 'block', fontSize: 11, color: 'var(--slate-500)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.08em' },
  metricValue: { display: 'block', fontSize: 15, color: 'var(--slate-900)', fontWeight: 800, marginTop: 6 },
}
