export default function ReportsPage() {
  return (
    <main style={styles.main}>
      <section style={styles.hero}>
        <p style={styles.kicker}>Reports</p>
        <h1 style={styles.title}>System Reports</h1>
        <p style={styles.subtitle}>
          Summary area for performance reports, moisture trends, and model evaluation results.
        </p>
      </section>

      <div style={styles.grid}>
        <article style={styles.card}>
          <h2 style={styles.cardTitle}>Moisture Summary</h2>
          <div style={styles.reportRow}><span>Tier 1</span><strong>Stable</strong></div>
          <div style={styles.reportRow}><span>Tier 2</span><strong>Needs review</strong></div>
          <div style={styles.reportRow}><span>Tier 3</span><strong>Stable</strong></div>
        </article>

        <article style={styles.card}>
          <h2 style={styles.cardTitle}>Model Evaluation</h2>
          <div style={styles.reportRow}><span>Accuracy</span><strong>Pending</strong></div>
          <div style={styles.reportRow}><span>Precision</span><strong>Pending</strong></div>
          <div style={styles.reportRow}><span>Recall</span><strong>Pending</strong></div>
        </article>
      </div>
    </main>
  )
}

const styles = {
  main: { padding: '2rem 3rem 3rem', maxWidth: 1400, margin: '0 auto', color: 'var(--slate-900)' },
  hero: { marginBottom: 20 },
  kicker: { fontSize: 12, fontWeight: 800, color: 'var(--green-700)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8 },
  title: { fontSize: 32, fontWeight: 800, marginBottom: 8 },
  subtitle: { fontSize: 14, color: 'var(--slate-600)', maxWidth: 760, lineHeight: 1.7 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 18 },
  card: { background: 'white', border: '1px solid rgba(15,23,42,0.04)', borderRadius: 18, boxShadow: 'var(--shadow-sm)', padding: '1.5rem' },
  cardTitle: { fontSize: 16, fontWeight: 800, marginBottom: 14 },
  reportRow: { display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid rgba(15,23,42,0.06)', fontSize: 14 },
}
