function average(values) {
  if (!values.length) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function getTierState(pct, delta, pumpOn) {
  if (pct >= 60) {
    return {
      label: 'Wet',
      note: 'Hold water level',
      color: '#1a9e52',
      icon: 'fa-solid fa-droplet',
      active: false,
      tone: 'wet',
    }
  }

  if (pumpOn) {
    return {
      label: 'Watering',
      note: 'Live recovery to 60%',
      color: '#3b82f6',
      icon: 'fa-solid fa-shower',
      active: true,
      tone: 'watering',
    }
  }

  if (pct < 30) {
    return {
      label: 'Dry',
      note: 'Below watering threshold',
      color: '#f59e0b',
      icon: 'fa-solid fa-triangle-exclamation',
      active: true,
      tone: 'dry',
    }
  }

  const rising = delta > 0
  return {
    label: rising ? 'Recovering' : 'Stable',
    note: rising ? 'Moving toward wet threshold' : 'Waiting for watering',
    color: '#64748b',
    icon: rising ? 'fa-solid fa-arrow-trend-up' : 'fa-solid fa-minus',
    active: rising,
    tone: rising ? 'watering' : 'stable',
  }
}

function ProgressRow({ label, pct, delta, pumpOn }) {
  const state = getTierState(pct, delta, pumpOn)

  return (
    <div
      style={{
        ...styles.rowCard,
        borderLeftColor: state.color,
        boxShadow: state.active ? `0 16px 32px ${state.color}18` : '0 10px 22px rgba(15,23,42,0.05)',
      }}
    >
      {state.active && <div style={{ ...styles.waterGlow, background: `radial-gradient(circle at 20% 20%, ${state.color}33, transparent 70%)` }} />}

      <div className="moisture-row-header" style={styles.rowHeader}>
        <div style={styles.labelGroup}>
          <div style={{ ...styles.labelIconWrap, background: `${state.color}12`, color: state.color }}>
            <i className={state.icon} aria-hidden="true" style={styles.labelIcon} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={styles.tierLabel}>
              {label}
              <span style={{ ...styles.stateBadge, background: `${state.color}18`, color: state.color }}>
                {state.label}
              </span>
            </div>
            <div className="moisture-tier-meta" style={styles.tierMeta}>
              {state.note}
              {pct < 60 && state.active ? ` · target ${60 - pct > 0 ? `60%` : 'hold'}` : ''}
            </div>
          </div>
        </div>

        <div style={styles.valueGroup}>
          <div style={{ ...styles.badge, background: state.color, color: '#ffffff' }}>{pct}%</div>
          <div style={styles.deltaText}>
            {delta > 0 ? '+' : ''}
            {delta.toFixed(1)}%
          </div>
        </div>
      </div>

      <div style={styles.progressTrack}>
        <div
          style={{
            ...styles.progressFill,
            width: `${pct}%`,
            background: state.active
              ? `linear-gradient(90deg, ${state.color}, ${state.color}cc, ${state.color})`
              : state.color,
            animation: state.tone === 'watering' ? 'waterFlow 1.4s linear infinite' : 'none',
            backgroundSize: state.tone === 'watering' ? '220% 100%' : '100% 100%',
          }}
        />
        {state.tone === 'watering' && <div style={styles.progressShine} />}
      </div>
    </div>
  )
}

export default function TierMoisture({ data, history = [] }) {
  const t1 = typeof data.t1 === 'number' ? data.t1 : 0
  const t2 = typeof data.t2 === 'number' ? data.t2 : 0
  const t3 = typeof data.t3 === 'number' ? data.t3 : 0
  const pumpOn = Number(data.pump) === 1

  const recent = history.slice(-6)
  const trend = ['t1', 't2', 't3'].map((key) => {
    const values = recent.map((row) => Number(row[key]) || 0)
    if (values.length < 2) return 0
    return values[values.length - 1] - values[0]
  })

  const averageMoisture = average([t1, t2, t3])
  const wateringCount = [t1, t2, t3].filter((pct) => pct < 60).length
  const anyDry = [t1, t2, t3].some((pct) => pct < 30)
  const activeTiers = [
    t1 < 60 ? 'Tier 1' : null,
    t2 < 60 ? 'Tier 2' : null,
    t3 < 60 ? 'Tier 3' : null,
  ].filter(Boolean)

  const trendRates = [
    estimateRate(recent.map((row) => Number(row.t1) || 0)),
    estimateRate(recent.map((row) => Number(row.t2) || 0)),
    estimateRate(recent.map((row) => Number(row.t3) || 0)),
  ]
  const etaSeconds = pumpOn
    ? estimateEtaToWet([t1, t2, t3], trendRates)
    : null

  return (
    <div className="moisture-card fade-up fade-up-3" style={styles.card}>
      <div style={styles.header}>
        <span style={styles.title}><i className="fa-solid fa-seedling" style={{ marginRight: 8 }} /> Soil Moisture — Per Tier</span>
        <div style={styles.headerMeta}>
          <span style={styles.headerPill}>{anyDry ? 'Dry detected' : 'Stable'}</span>
          <span style={styles.headerPill}>{pumpOn ? 'Watering active' : 'Pump off'}</span>
        </div>
      </div>

      {(pumpOn || anyDry) && (
        <div style={styles.banner}>
          <div style={styles.bannerIcon}>
            <span style={styles.dropWrap}>
              <i className="fa-solid fa-droplet" aria-hidden="true" />
            </span>
          </div>
          <div style={{ flex: 1 }}>
            <div style={styles.bannerTitle}>
              {pumpOn ? 'Watering in progress' : 'Dry soil detected'}
            </div>
            <div style={styles.bannerText}>
              {pumpOn
                ? `Live soil values are moving toward the wet threshold. ${wateringCount} tier(s) are still below 60%.`
                : 'The next watering cycle will start when a tier reaches the dry threshold of 30% or below.'}
            </div>
            {pumpOn && etaSeconds !== null && (
              <div style={styles.bannerEta}>
                Estimated time to wet threshold: <strong>{formatEta(etaSeconds)}</strong>
                {activeTiers.length ? ` · Active: ${activeTiers.join(', ')}` : ''}
              </div>
            )}
          </div>
          <div style={styles.bannerGauge}>
            <div style={styles.bannerGaugeLabel}>Average</div>
            <div style={styles.bannerGaugeValue}>{averageMoisture.toFixed(1)}%</div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <ProgressRow label="Tier 1" pct={t1} delta={trend[0]} pumpOn={pumpOn && t1 < 60} />
        <ProgressRow label="Tier 2" pct={t2} delta={trend[1]} pumpOn={pumpOn && t2 < 60} />
        <ProgressRow label="Tier 3" pct={t3} delta={trend[2]} pumpOn={pumpOn && t3 < 60} />
      </div>

      <style>{`
        @keyframes waterFlow {
          0% { background-position: 0% 50%; }
          100% { background-position: 220% 50%; }
        }
        @keyframes waterGlowPulse {
          0%, 100% { opacity: 0.75; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.02); }
        }
        @keyframes dropletBob {
          0%, 100% { transform: translateY(0) scale(1); opacity: 0.9; }
          50% { transform: translateY(-3px) scale(1.05); opacity: 1; }
        }
      `}</style>
    </div>
  )
}

function estimateRate(values) {
  if (values.length < 2) return 0
  const delta = values[values.length - 1] - values[0]
  const samples = Math.max(values.length - 1, 1)
  return delta / samples
}

function estimateEtaToWet(values, rates) {
  const perTier = values.map((pct, index) => {
    const rate = rates[index]
    if (pct >= 60) return 0
    if (rate <= 0) return null
    const remaining = 60 - pct
    return Math.max((remaining / rate) * 2, 0) // 2s sensor interval
  }).filter((value) => value !== null)

  if (!perTier.length) return null
  return Math.max(...perTier)
}

function formatEta(seconds) {
  if (!Number.isFinite(seconds)) return '--'
  const total = Math.max(Math.round(seconds), 0)
  const mins = Math.floor(total / 60)
  const secs = total % 60
  if (mins <= 0) return `${secs}s`
  return `${mins}m ${secs}s`
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
    flexWrap: 'wrap', gap: 10, marginBottom: '0.85rem',
  },
  title: { fontSize: 15, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.01em' },
  headerMeta: { display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  headerPill: { padding: '7px 10px', borderRadius: 999, background: 'rgba(15,23,42,0.05)', color: 'var(--slate-700)', fontSize: 12, fontWeight: 800 },
  banner: {
    display: 'flex',
    gap: 14,
    alignItems: 'center',
    padding: '12px 14px',
    borderRadius: 16,
    marginBottom: 14,
    background: 'linear-gradient(135deg, rgba(59,130,246,0.08), rgba(22,163,74,0.06))',
    border: '1px solid rgba(59,130,246,0.12)',
  },
  bannerIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'white',
    color: '#3b82f6',
    boxShadow: '0 10px 18px rgba(15,23,42,0.08)',
    flexShrink: 0,
  },
  dropWrap: {
    display: 'inline-flex',
    animation: 'dropletBob 1.4s ease-in-out infinite',
  },
  bannerTitle: { fontSize: 14, fontWeight: 900, color: '#0f172a', marginBottom: 2 },
  bannerText: { fontSize: 12.5, color: '#475569', lineHeight: 1.45 },
  bannerEta: { fontSize: 12, color: '#1f2937', marginTop: 6, lineHeight: 1.45 },
  bannerGauge: {
    minWidth: 96,
    padding: '8px 10px',
    borderRadius: 14,
    background: 'rgba(255,255,255,0.8)',
    border: '1px solid rgba(15,23,42,0.05)',
    textAlign: 'center',
  },
  bannerGaugeLabel: { fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.08em' },
  bannerGaugeValue: { fontSize: 20, fontWeight: 900, color: '#0f172a', marginTop: 4 },
  rowHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 },
  labelGroup: { display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 },
  labelIconWrap: { width: 36, height: 36, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  labelIcon: { fontSize: 15 },
  tierLabel: { fontSize: 16, fontWeight: 900, color: '#0f172a', fontFamily: "'Outfit', sans-serif", letterSpacing: '-0.02em', lineHeight: 1.1, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  stateBadge: { padding: '4px 8px', borderRadius: 999, fontSize: 11, fontWeight: 900, letterSpacing: '0.04em' },
  tierMeta: { fontSize: 12, color: '#64748b', marginTop: 2, lineHeight: 1.35 },
  valueGroup: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 },
  deltaText: { fontSize: 11, fontWeight: 800, color: '#64748b', fontFamily: "'DM Mono', monospace" },
  rowCard: {
    position: 'relative',
    overflow: 'hidden',
    background: '#ffffff',
    padding: 14,
    borderRadius: 14,
    border: '1px solid rgba(15,23,42,0.06)',
    borderLeftWidth: 5,
    borderLeftStyle: 'solid',
  },
  waterGlow: {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    animation: 'waterGlowPulse 1.8s ease-in-out infinite',
  },
  badge: {
    color: 'white',
    padding: '6px 10px',
    borderRadius: 999,
    fontWeight: 900,
    fontSize: 13,
    minWidth: 48,
    textAlign: 'center',
    boxShadow: '0 10px 18px rgba(15,23,42,0.12)',
    flexShrink: 0,
  },
  progressTrack: { position: 'relative', height: 12, background: 'rgba(15,23,42,0.06)', borderRadius: 999, marginTop: 10, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999, transition: 'width 0.5s ease, background 0.4s ease' },
  progressShine: {
    position: 'absolute',
    inset: 0,
    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.45), transparent)',
    animation: 'waterFlow 1.5s linear infinite',
    opacity: 0.55,
    pointerEvents: 'none',
  },
}
