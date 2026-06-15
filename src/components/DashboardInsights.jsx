import { useMemo } from 'react'
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, Legend } from 'recharts'
import { buildIrrigationAdvisory, loadTrainedModelSnapshot, predictStoredModel } from '../lib/mlAdvisor'

function avg(values) {
  if (!values.length) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function fmtPct(value) {
  return `${Math.round(value)}%`
}

export default function DashboardInsights({ history, data }) {
  const stats = useMemo(() => {
    const rows = history.slice(-30)
    const withAvg = rows.map((row) => {
      const t1 = Number(row.t1) || 0
      const t2 = Number(row.t2) || 0
      const t3 = Number(row.t3) || 0
      const moistureAvg = (t1 + t2 + t3) / 3
      return { ...row, t1, t2, t3, moistureAvg, pump: Number(row.pump) || 0 }
    })

    const first = withAvg[0]
    const last = withAvg[withAvg.length - 1]
    const avgMoisture = avg(withAvg.map((row) => row.moistureAvg))
    const pumpDuty = withAvg.length ? (withAvg.filter((row) => row.pump === 1).length / withAvg.length) * 100 : 0
    const imbalance = avg(withAvg.map((row) => Math.max(row.t1, row.t2, row.t3) - Math.min(row.t1, row.t2, row.t3)))
    const trendDelta = first && last ? last.moistureAvg - first.moistureAvg : 0
    const trendLabel = trendDelta <= -4 ? 'Drying' : trendDelta >= 4 ? 'Wetting' : 'Stable'
    const recommendation =
      !withAvg.length ? 'Collecting data'
      : last?.tank === 0 ? 'Refill tank'
      : last?.pump === 1 ? 'Watering active'
      : last?.moistureAvg < 30 ? 'Water needed'
      : 'Monitoring'

    return {
      rows: withAvg,
      avgMoisture,
      pumpDuty,
      imbalance,
      trendDelta,
      trendLabel,
      recommendation,
      latest: last,
    }
  }, [history])

  const latestRow = useMemo(() => {
    if (stats.latest) return stats.latest
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
      time: new Date(),
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
  }, [stats.latest, data])

  const mlAdvisor = useMemo(() => {
    const snapshot = loadTrainedModelSnapshot()
    const prediction = snapshot && latestRow ? predictStoredModel(snapshot, latestRow) : null
    const advisory = buildIrrigationAdvisory(prediction, latestRow, snapshot)

    return { snapshot, prediction, advisory }
  }, [latestRow, history.length, data?.t1, data?.t2, data?.t3, data?.temp, data?.humidity, data?.lux, data?.tank, data?.pump])

  const chartData = stats.rows.map((row) => ({
    time: row.time instanceof Date ? row.time.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) : '--:--:--',
    'Tier 1': row.t1,
    'Tier 2': row.t2,
    'Tier 3': row.t3,
    Average: row.moistureAvg,
    Pump: row.pump,
  }))

  if (!history.length) {
    return (
      <section style={styles.card}>
        <div style={styles.header}>
          <div>
            <h3 style={styles.title}>Operational insights</h3>
            <p style={styles.sub}>Trend-based indicators for your thesis dashboard.</p>
          </div>
        </div>
        <div style={styles.empty}>No history yet. The insights section will populate after the first readings arrive.</div>
      </section>
    )
  }

  return (
    <section style={styles.card}>
      <div style={styles.header}>
        <div>
          <h3 style={styles.title}>Operational insights</h3>
          <p style={styles.sub}>Trend-based indicators for irrigation performance and system behavior.</p>
        </div>
        <div style={styles.badge}>{stats.recommendation}</div>
      </div>

      <div style={styles.advisorCard}>
        <div style={styles.advisorHead}>
          <div>
            <div style={styles.advisorLabel}>ML advisory</div>
            <div style={styles.advisorValue}>{mlAdvisor.advisory.status}</div>
          </div>
          <div style={styles.advisorTone(mlAdvisor.advisory.tone)}>
            {mlAdvisor.snapshot?.label ?? 'No trained model'}
          </div>
        </div>
        <div style={styles.advisorText}>{mlAdvisor.advisory.detail}</div>
        <div style={styles.advisorMetaRow}>
          <span style={styles.advisorMeta}>Prediction: {mlAdvisor.prediction ?? 'n/a'}</span>
          <span style={styles.advisorMeta}>{latestRow ? `Latest row: T1 ${Math.round(latestRow.t1)}%, T2 ${Math.round(latestRow.t2)}%, T3 ${Math.round(latestRow.t3)}%` : 'No sensor row yet'}</span>
        </div>
      </div>

      <div style={styles.metrics}>
        <Metric label="Avg moisture" value={fmtPct(stats.avgMoisture)} note="Last 30 readings" tone="green" />
        <Metric label="Pump duty" value={fmtPct(stats.pumpDuty)} note="Pump ON ratio" tone="blue" />
        <Metric label="Trend" value={stats.trendLabel} note={`${stats.trendDelta >= 0 ? '+' : ''}${stats.trendDelta.toFixed(1)}% change`} tone="amber" />
        <Metric label="Imbalance" value={`${stats.imbalance.toFixed(1)}%`} note="Tier spread" tone="slate" />
      </div>

      <div style={styles.charts}>
        <div style={styles.chartCard}>
          <div style={styles.chartHead}>
            <h4 style={styles.chartTitle}>Moisture trend with average</h4>
            <span style={styles.chartMeta}>Dry line 30% · Wet line 60%</span>
          </div>
          <div style={styles.chartWrap}>
            <ResponsiveContainer>
              <LineChart data={chartData} margin={{ top: 10, right: 16, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,23,42,0.06)" />
                <XAxis dataKey="time" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => `${Number(v).toFixed(1)}%`} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="Tier 1" stroke="#3b82f6" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Tier 2" stroke="#f59e0b" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Tier 3" stroke="#16a34a" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Average" stroke="#0f172a" strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div style={styles.chartCard}>
          <div style={styles.chartHead}>
            <h4 style={styles.chartTitle}>Pump activity</h4>
            <span style={styles.chartMeta}>ON = 1 · OFF = 0</span>
          </div>
          <div style={styles.chartWrap}>
            <ResponsiveContainer>
              <BarChart data={chartData} margin={{ top: 10, right: 16, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,23,42,0.06)" />
                <XAxis dataKey="time" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis domain={[0, 1]} ticks={[0, 1]} tickFormatter={(v) => (v === 1 ? 'ON' : 'OFF')} />
                <Tooltip formatter={(v) => (Number(v) ? 'ON' : 'OFF')} />
                <Bar dataKey="Pump" radius={[8, 8, 0, 0]}>
                  {chartData.map((row, index) => (
                    <Cell key={index} fill={row.Pump ? '#16a34a' : '#94a3b8'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </section>
  )
}

function Metric({ label, value, note, tone }) {
  return (
    <div style={{ ...styles.metric, ...styles[`tone${tone[0].toUpperCase()}${tone.slice(1)}`] }}>
      <div style={styles.metricLabel}>{label}</div>
      <div style={styles.metricValue}>{value}</div>
      <div style={styles.metricNote}>{note}</div>
    </div>
  )
}

const styles = {
  card: {
    background: 'white',
    border: '1px solid rgba(15,23,42,0.05)',
    borderRadius: 18,
    padding: '1.2rem',
    marginBottom: 16,
    boxShadow: 'var(--shadow-sm)',
  },
  header: { display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 14, flexWrap: 'wrap' },
  title: { fontSize: 16, fontWeight: 900, color: 'var(--slate-900)' },
  sub: { fontSize: 13, color: 'var(--slate-600)', marginTop: 4 },
  badge: { padding: '8px 12px', borderRadius: 999, background: 'rgba(22,163,74,0.10)', color: 'var(--green-800)', fontSize: 12, fontWeight: 800 },
  advisorCard: { marginBottom: 14, padding: '1rem', borderRadius: 16, background: 'linear-gradient(180deg, rgba(59,130,246,0.07), rgba(22,163,74,0.06))', border: '1px solid rgba(15,23,42,0.05)' },
  advisorHead: { display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' },
  advisorLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 800, color: 'var(--slate-500)' },
  advisorValue: { fontSize: 24, fontWeight: 900, marginTop: 4, color: 'var(--slate-900)' },
  advisorText: { marginTop: 8, fontSize: 13, color: 'var(--slate-700)', lineHeight: 1.5 },
  advisorMetaRow: { marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 10 },
  advisorMeta: { fontSize: 12, color: 'var(--slate-600)', background: 'rgba(255,255,255,0.72)', border: '1px solid rgba(15,23,42,0.05)', borderRadius: 999, padding: '6px 10px' },
  advisorTone: (tone) => ({
    padding: '8px 12px',
    borderRadius: 999,
    background:
      tone === 'red'
        ? 'rgba(239,68,68,0.12)'
        : tone === 'green'
          ? 'rgba(22,163,74,0.12)'
          : tone === 'amber'
            ? 'rgba(245,158,11,0.14)'
            : 'rgba(100,116,139,0.12)',
    color:
      tone === 'red'
        ? '#b91c1c'
        : tone === 'green'
          ? '#166534'
          : tone === 'amber'
            ? '#92400e'
            : '#334155',
    fontSize: 12,
    fontWeight: 800,
  }),
  empty: { minHeight: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--slate-500)', fontSize: 13, background: 'rgba(15,23,42,0.02)', borderRadius: 14 },
  metrics: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 14 },
  metric: { borderRadius: 16, padding: '1rem', border: '1px solid rgba(15,23,42,0.05)', background: 'rgba(248,250,252,0.95)' },
  metricLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 800, color: 'var(--slate-500)' },
  metricValue: { fontSize: 22, fontWeight: 900, marginTop: 6, color: 'var(--slate-900)' },
  metricNote: { fontSize: 12, color: 'var(--slate-600)', marginTop: 4, lineHeight: 1.4 },
  toneGreen: { borderLeft: '4px solid #16a34a' },
  toneBlue: { borderLeft: '4px solid #3b82f6' },
  toneAmber: { borderLeft: '4px solid #f59e0b' },
  toneSlate: { borderLeft: '4px solid #64748b' },
  charts: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 },
  chartCard: { borderRadius: 16, border: '1px solid rgba(15,23,42,0.05)', padding: '1rem', background: 'white' },
  chartHead: { display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline', marginBottom: 8, flexWrap: 'wrap' },
  chartTitle: { fontSize: 14, fontWeight: 900, color: 'var(--slate-900)' },
  chartMeta: { fontSize: 11, color: 'var(--slate-500)', fontFamily: "'DM Mono', monospace" },
  chartWrap: { height: 260 },
}
