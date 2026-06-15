function StatusRow({ iconClass, label, active, activeText, inactiveText, activeColor = '#2ecc71' }) {
  return (
    <div style={styles.row}>
      <div style={styles.rowLeft}>
        <span style={styles.icon}><i className={iconClass} aria-hidden="true" /></span>
        <span style={styles.rowLabel}>{label}</span>
      </div>
      <span style={{
        ...styles.pill,
        color:      active ? activeColor : '#475569',
        background: active ? `${activeColor}18` : 'rgba(71,85,105,0.15)',
        border:     `1px solid ${active ? `${activeColor}40` : 'rgba(71,85,105,0.3)'}`,
      }}>
        {active ? activeText : inactiveText}
      </span>
    </div>
  )
}

export default function SystemStatus({ data }) {
  return (
    <div className="fade-up fade-up-4" style={{ ...styles.card }}>
      <div style={styles.header}>
        <span style={styles.title}><i className="fa-solid fa-cog" style={{ marginRight: 8 }} /> System Status</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ ...styles.liveDot, animation: 'pulse-dot 1.5s ease infinite' }} />
          <span style={{ fontSize: 12, color: '#64748b', fontFamily: "'DM Mono', monospace" }}>live</span>
        </div>
      </div>

      <div style={styles.grid}>
        <div style={styles.col}>
          <p style={styles.colTitle}>Actuators</p>
          <StatusRow iconClass="fa-solid fa-water" label="Pump" active={data.pump === 1} activeText="Running" inactiveText="Off" activeColor="var(--green-400)" />
          <StatusRow iconClass="fa-solid fa-toggle-on" label="Control mode" active={data.mode === 1} activeText="Manual" inactiveText="Auto" activeColor="var(--amber-400)" />
        </div>

        <div style={styles.col}>
          <p style={styles.colTitle}>Sensors</p>
          <StatusRow iconClass="fa-solid fa-thermometer-half" label="DHT22 (Temp/Hum)" active={parseFloat(data.temp) > 0} activeText="OK" inactiveText="No data" activeColor="var(--green-400)" />
          <StatusRow iconClass="fa-solid fa-sun" label="BH1750 (Light)"   active={data.lux > 0}              activeText="OK" inactiveText="No data" activeColor="var(--green-400)" />
          <StatusRow iconClass="fa-solid fa-tint" label="Float Switch"      active={data.tank === 1}            activeText="Water OK" inactiveText="Tank empty" activeColor="var(--green-400)" />
          <StatusRow iconClass="fa-solid fa-cloud" label="Blynk Cloud"       active={true}                       activeText="Connected" inactiveText="Offline" activeColor="#2ecc71" />
        </div>
      </div>
    </div>
  )
}

const styles = {
  card: {
    background: 'white',
    border: '1px solid rgba(15,23,42,0.04)',
    borderRadius: 16,
    padding: '1.25rem',
    marginBottom: 16,
    boxShadow: 'var(--shadow-sm)',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem',
  },
  title: { fontSize: 15, fontWeight: 700, color: 'var(--slate-900)' },
  liveDot: { width: 8, height: 8, borderRadius: '50%', background: 'var(--green-400)', display: 'inline-block' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 },
  col: { display: 'flex', flexDirection: 'column', gap: 8 },
  colTitle: { fontSize: 11, fontWeight: 600, color: 'var(--slate-600)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 },
  row: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  rowLeft: { display: 'flex', alignItems: 'center', gap: 8 },
  icon: { fontSize: 16 },
  rowLabel: { fontSize: 13, color: 'var(--slate-700)' },
  pill: { fontSize: 11, fontWeight: 600, padding: '6px 12px', borderRadius: 99 },
}
