function ProgressRow({ label, pct }) {
  // Map ranges to safe CSS variables and light background tints (rgba)
  const tone = pct < 30 ? 'low' : pct > 60 ? 'high' : 'mid'
  // Use explicit hex colors to avoid CSS var concatenation or runtime issues
  const colorVar = tone === 'low' ? '#f59e0b' : tone === 'high' ? '#1a9e52' : '#2ecc71'
  const bgTint = tone === 'low' ? 'rgba(245,158,11,0.10)' : tone === 'high' ? 'rgba(26,158,82,0.10)' : 'rgba(46,204,113,0.06)'
  const iconClass = tone === 'low' ? 'fa-solid fa-triangle-exclamation' : tone === 'high' ? 'fa-solid fa-droplet' : 'fa-solid fa-leaf'

  return (
    <div style={{ ...styles.rowCard, borderLeftColor: colorVar }}>
      <div style={styles.rowHeader}>
        <div style={styles.labelGroup}>
          <div style={{ ...styles.labelIconWrap, background: bgTint, color: colorVar }}>
            <i className={iconClass} aria-hidden="true" style={styles.labelIcon} />
          </div>
          <div>
            <div style={styles.tierLabel}>{label}</div>
            <div style={styles.tierMeta}>Moisture status for the current tier</div>
          </div>
        </div>
        <div style={{ ...styles.badge, background: colorVar, color: '#ffffff' }}>{pct}%</div>
      </div>
      <div style={styles.progressTrack}>
        <div style={{ ...styles.progressFill, width: `${pct}%`, background: colorVar }} />
      </div>
    </div>
  )
}

export default function TierMoisture({ data }) {
  const t1 = typeof data.t1 === 'number' ? data.t1 : 0
  const t2 = typeof data.t2 === 'number' ? data.t2 : 0
  const t3 = typeof data.t3 === 'number' ? data.t3 : 0

  return (
    <div className="fade-up fade-up-3" style={styles.card}>
      <div style={styles.header}>
        <span style={styles.title}><i className="fa-solid fa-seedling" style={{ marginRight: 8 }} /> Soil Moisture — Per Tier</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <ProgressRow label="Tier 1" pct={t1} />
        <ProgressRow label="Tier 2" pct={t2} />
        <ProgressRow label="Tier 3" pct={t3} />
      </div>
    </div>
  )
}

const styles = {
  card: {
    background: 'white',
    border: '1px solid rgba(15,23,42,0.06)',
    borderRadius: 18,
    padding: '1.35rem',
    marginBottom: 16,
    boxShadow: '0 14px 32px rgba(15,23,42,0.05)',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    flexWrap: 'wrap', gap: 8, marginBottom: '0.75rem',
  },
  title: { fontSize: 15, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.01em' },
  rowHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 },
  labelGroup: { display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 },
  labelIconWrap: { width: 36, height: 36, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  labelIcon: { fontSize: 15 },
  tierLabel: { fontSize: 16, fontWeight: 900, color: '#0f172a', fontFamily: "'Outfit', sans-serif", letterSpacing: '-0.02em', lineHeight: 1.1 },
  tierMeta: { fontSize: 12, color: '#64748b', marginTop: 2, lineHeight: 1.35 },
  rowCard: { background: '#ffffff', padding: 14, borderRadius: 14, border: '1px solid rgba(15,23,42,0.06)', borderLeftWidth: 5, borderLeftStyle: 'solid' },
  badge: { color: 'white', padding: '6px 10px', borderRadius: 999, fontWeight: 900, fontSize: 13, minWidth: 48, textAlign: 'center', boxShadow: '0 10px 18px rgba(15,23,42,0.12)', flexShrink: 0 },
  progressTrack: { height: 12, background: 'rgba(15,23,42,0.06)', borderRadius: 999, marginTop: 10, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999, transition: 'width 0.5s ease' },
}
