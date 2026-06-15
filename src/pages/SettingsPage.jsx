import SystemStatus from '../components/SystemStatus'

const DATSTREAMS = [
  { pin: 'V0', label: 'Soil Moisture Tier 1', type: 'Double', use: 'Live sensor display and ML feature' },
  { pin: 'V1', label: 'Temperature', type: 'Double', use: 'Environmental context' },
  { pin: 'V2', label: 'Humidity', type: 'Double', use: 'Environmental context' },
  { pin: 'V3', label: 'Soil Moisture Tier 2', type: 'Double', use: 'Live sensor display and ML feature' },
  { pin: 'V4', label: 'Soil Moisture Tier 3', type: 'Double', use: 'Live sensor display and ML feature' },
  { pin: 'V5', label: 'Light Intensity', type: 'Integer', use: 'Environmental context' },
  { pin: 'V6', label: 'Water Tank Status', type: 'Integer', use: 'Safety interlock' },
  { pin: 'V7', label: 'Manual Pump Control', type: 'Integer', use: 'Dashboard override switch' },
  { pin: 'V8', label: 'AUTO / MANUAL Mode', type: 'Integer', use: 'System mode selector' },
  { pin: 'V9', label: 'Pump Status', type: 'Integer', use: 'Live actuator feedback' },
]

const FLOW = [
  { title: 'AUTO mode', text: 'Soil moisture thresholds decide whether to water.' },
  { title: 'MANUAL mode', text: 'The dashboard pump button overrides automatic control.' },
  { title: 'Safety lock', text: 'If the tank is empty, the system forces everything off.' },
  { title: 'Data collection', text: 'Live readings are stored for dashboard trends and ML training.' },
]

const QUICK_FACTS = [
  { label: 'Dry threshold', value: '30%', tone: 'green' },
  { label: 'Wet threshold', value: '60%', tone: 'blue' },
  { label: 'ML input', value: '7 features', tone: 'amber' },
  { label: 'Control mode', value: 'AUTO / MANUAL', tone: 'slate' },
]

export default function SettingsPage({ data }) {
  return (
    <main className="page-main settings-main" style={styles.main}>
      <section className="settings-hero" style={styles.hero}>
        <div style={styles.heroCopy}>
          <p style={styles.kicker}>Setup</p>
          <h1 className="page-title" style={styles.title}>System Configuration</h1>
          <p className="page-subtitle" style={styles.subtitle}>
            Reference page for the ESP32 logic, Blynk datastreams, and control behavior used by the thesis prototype.
          </p>
        </div>

        <div style={styles.heroPanel}>
          <div style={styles.heroPanelLabel}>Current focus</div>
          <div style={styles.heroPanelValue}>Safe irrigation control</div>
          <div style={styles.heroPanelMeta}>
            AUTO handles threshold watering. MANUAL is for testing and maintenance. Tank empty always locks the actuators off.
          </div>
        </div>
      </section>

      <section className="settings-quick-grid settings-grid" style={styles.quickGrid}>
        {QUICK_FACTS.map((item) => (
          <article key={item.label} style={{ ...styles.quickCard, ...toneStyles[item.tone] }}>
            <div style={styles.quickLabel}>{item.label}</div>
            <div style={styles.quickValue}>{item.value}</div>
          </article>
        ))}
      </section>

      <section className="settings-flow-grid" style={styles.flowGrid}>
        {FLOW.map((item) => (
          <article key={item.title} className="settings-card" style={styles.flowCard}>
            <div style={styles.flowTitle}>{item.title}</div>
            <div style={styles.flowText}>{item.text}</div>
          </article>
        ))}
      </section>

      <section className="settings-grid" style={styles.contentGrid}>
        <article className="settings-card" style={styles.card}>
          <div style={styles.cardHeader}>
            <h2 style={styles.cardTitle}>Control rules</h2>
            <span style={styles.cardPill}>ESP32 logic</span>
          </div>
          <Rule label="Dry threshold" value="30%" />
          <Rule label="Wet threshold" value="60%" />
          <Rule label="Auto watering" value="Tier-specific based on sensor reading" />
          <Rule label="Manual override" value="Dashboard pump switch enabled in MANUAL mode" />
          <Rule label="Tank empty behavior" value="Force pump and valves OFF" />
        </article>

        <article className="settings-card" style={styles.card}>
          <div style={styles.cardHeader}>
            <h2 style={styles.cardTitle}>Datastream reference</h2>
            <span style={styles.cardPill}>Blynk pins</span>
          </div>
          <div style={styles.streamList}>
            {DATSTREAMS.map((item) => (
              <StreamRow key={item.pin} item={item} />
            ))}
          </div>
        </article>
      </section>

      <section className="settings-grid" style={styles.bottomGrid}>
        <article className="settings-card" style={styles.card}>
          <div style={styles.cardHeader}>
            <h2 style={styles.cardTitle}>Implementation notes</h2>
            <span style={styles.cardPill}>Web app</span>
          </div>
          <p style={styles.text}>
            The website dashboard is the main front-end for monitoring and control. Blynk is still the transport layer for ESP32 datastreams.
          </p>
          <p style={styles.text}>
            For thesis defense, keep `V8` as the mode switch and `V7` as the manual pump override. `V9` should always reflect the actual pump state.
          </p>
          <p style={styles.text}>
            The ML page can train from the same history stream without changing the hardware flow.
          </p>
        </article>

        <article className="settings-card" style={styles.card}>
          <div style={styles.cardHeader}>
            <h2 style={styles.cardTitle}>Live system status</h2>
            <span style={styles.cardPill}>Real-time</span>
          </div>
          <SystemStatus data={data} />
        </article>
      </section>
    </main>
  )
}

function Rule({ label, value }) {
  return (
    <div style={styles.ruleRow}>
      <span style={styles.ruleLabel}>{label}</span>
      <span style={styles.ruleBadge}>{value}</span>
    </div>
  )
}

function StreamRow({ item }) {
  return (
    <div className="settings-stream-row" style={styles.streamRow}>
      <div style={styles.streamPin}>{item.pin}</div>
      <div style={styles.streamBody}>
        <div style={styles.streamLabel}>{item.label}</div>
        <div style={styles.streamUse}>{item.use}</div>
      </div>
      <div className="settings-stream-type" style={styles.streamType}>{item.type}</div>
    </div>
  )
}

const toneStyles = {
  green: { borderLeftColor: '#16a34a' },
  blue: { borderLeftColor: '#3b82f6' },
  amber: { borderLeftColor: '#f59e0b' },
  slate: { borderLeftColor: '#64748b' },
}

const styles = {
  main: { padding: '2rem 3rem 3rem', maxWidth: 1400, margin: '0 auto', color: 'var(--slate-900)' },
  hero: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.4fr) minmax(280px, 360px)',
    gap: 18,
    alignItems: 'stretch',
    marginBottom: 18,
  },
  heroCopy: {
    background: 'linear-gradient(180deg, rgba(255,255,255,0.92), rgba(248,250,252,0.96))',
    border: '1px solid rgba(15,23,42,0.06)',
    borderRadius: 20,
    boxShadow: 'var(--shadow-sm)',
    padding: '1.5rem',
  },
  kicker: { fontSize: 12, fontWeight: 800, color: 'var(--green-700)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8 },
  title: { fontSize: 32, fontWeight: 900, marginBottom: 8 },
  subtitle: { fontSize: 14, color: 'var(--slate-600)', fontFamily: "'DM Mono', monospace", maxWidth: 820, lineHeight: 1.7 },
  heroPanel: {
    background: 'linear-gradient(135deg, rgba(22,163,74,0.08), rgba(255,255,255,0.95))',
    border: '1px solid rgba(22,163,74,0.12)',
    borderRadius: 20,
    padding: '1.5rem',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    boxShadow: 'var(--shadow-sm)',
  },
  heroPanelLabel: { fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--green-700)', marginBottom: 10 },
  heroPanelValue: { fontSize: 24, fontWeight: 900, marginBottom: 6 },
  heroPanelMeta: { fontSize: 13, color: 'var(--slate-600)', lineHeight: 1.7 },
  quickGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 14, marginBottom: 18 },
  quickCard: {
    background: 'white',
    border: '1px solid rgba(15,23,42,0.05)',
    borderLeftWidth: 5,
    borderLeftStyle: 'solid',
    borderRadius: 16,
    boxShadow: 'var(--shadow-sm)',
    padding: '1rem',
  },
  quickLabel: { fontSize: 12, fontWeight: 800, color: 'var(--slate-500)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 },
  quickValue: { fontSize: 18, fontWeight: 900, color: 'var(--slate-900)' },
  flowGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 18 },
  flowCard: { padding: '1rem', borderRadius: 16, boxShadow: 'var(--shadow-sm)' },
  flowTitle: { fontSize: 14, fontWeight: 900, marginBottom: 6 },
  flowText: { fontSize: 13, color: 'var(--slate-600)', lineHeight: 1.6 },
  contentGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 18, marginBottom: 18 },
  bottomGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 18 },
  card: {
    background: 'white',
    border: '1px solid rgba(15,23,42,0.05)',
    borderRadius: 18,
    boxShadow: 'var(--shadow-sm)',
    padding: '1.35rem',
  },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' },
  cardTitle: { fontSize: 16, fontWeight: 900 },
  cardPill: { fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', padding: '6px 10px', borderRadius: 999, background: 'rgba(15,23,42,0.05)', color: 'var(--slate-700)' },
  ruleRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    padding: '12px 0',
    borderBottom: '1px solid rgba(15,23,42,0.06)',
    fontSize: 14,
  },
  ruleLabel: { fontWeight: 700, color: 'var(--slate-700)' },
  ruleBadge: {
    background: 'rgba(22,163,74,0.08)',
    color: 'var(--green-700)',
    border: '1px solid rgba(22,163,74,0.14)',
    borderRadius: 999,
    padding: '6px 12px',
    fontSize: 12,
    fontWeight: 700,
    textAlign: 'right',
  },
  streamList: { display: 'flex', flexDirection: 'column', gap: 10 },
  streamRow: {
    display: 'grid',
    gridTemplateColumns: '56px minmax(0, 1fr) 70px',
    gap: 10,
    alignItems: 'center',
    padding: '10px 0',
    borderBottom: '1px solid rgba(15,23,42,0.06)',
  },
  streamPin: { fontSize: 13, fontWeight: 900, color: 'var(--green-700)' },
  streamBody: { minWidth: 0 },
  streamLabel: { fontSize: 14, fontWeight: 700, color: 'var(--slate-900)' },
  streamUse: { fontSize: 12, color: 'var(--slate-500)', marginTop: 2, lineHeight: 1.45 },
  streamType: { fontSize: 12, fontWeight: 800, color: 'var(--slate-700)', textAlign: 'right' },
  text: { fontSize: 13, color: 'var(--slate-600)', lineHeight: 1.7, marginBottom: 12 },
}
