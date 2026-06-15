import { useMemo } from 'react'
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, Legend } from 'recharts'

function avg(values) {
  if (!values.length) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function pct(count, total) {
  if (!total) return 0
  return (count / total) * 100
}

function fmtPct(value) {
  return `${value.toFixed(1)}%`
}

export default function ReportsPage({ data, history = [], status }) {
  const report = useMemo(() => {
    const rows = history.slice(-120)
    const withAvg = rows.map((row) => {
      const t1 = Number(row.t1) || 0
      const t2 = Number(row.t2) || 0
      const t3 = Number(row.t3) || 0
      const pump = Number(row.pump) || 0
      const tank = Number(row.tank) || 0
      const moistureAvg = (t1 + t2 + t3) / 3
      return { ...row, t1, t2, t3, pump, tank, moistureAvg }
    })

    const total = withAvg.length
    const pumpOn = withAvg.filter((row) => row.pump === 1).length
    const tankOk = withAvg.filter((row) => row.tank === 1).length
    const dryRows = withAvg.filter((row) => row.moistureAvg < 30).length
    const wetRows = withAvg.filter((row) => row.moistureAvg >= 60).length
    const manualRows = withAvg.filter((row) => Number(row.mode) === 1).length
    const avgT1 = avg(withAvg.map((row) => row.t1))
    const avgT2 = avg(withAvg.map((row) => row.t2))
    const avgT3 = avg(withAvg.map((row) => row.t3))
    const avgSoil = avg([avgT1, avgT2, avgT3])
    const imbalance = avg(withAvg.map((row) => Math.max(row.t1, row.t2, row.t3) - Math.min(row.t1, row.t2, row.t3)))

    return {
      rows: withAvg,
      total,
      pumpOn,
      tankOk,
      dryRows,
      wetRows,
      manualRows,
      avgT1,
      avgT2,
      avgT3,
      avgSoil,
      imbalance,
      latest: withAvg[withAvg.length - 1] || null,
    }
  }, [history])

  const moistureTrend = report.rows.map((row) => ({
    time: row.time instanceof Date ? row.time.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) : '--:--:--',
    Average: row.moistureAvg,
    'Tier 1': row.t1,
    'Tier 2': row.t2,
    'Tier 3': row.t3,
  }))

  const stateBars = [
    { label: 'Pump ON', value: report.pumpOn, color: '#16a34a' },
    { label: 'Tank OK', value: report.tankOk, color: '#3b82f6' },
    { label: 'Dry', value: report.dryRows, color: '#f59e0b' },
    { label: 'Wet', value: report.wetRows, color: '#64748b' },
    { label: 'Manual', value: report.manualRows, color: '#8b5cf6' },
  ]

  const labelBreakdown = [
    { name: 'Dry', value: report.dryRows, color: '#f59e0b' },
    { name: 'OK', value: Math.max(report.total - report.dryRows - report.wetRows, 0), color: '#64748b' },
    { name: 'Wet', value: report.wetRows, color: '#3b82f6' },
  ]

  return (
    <main className="page-main" style={styles.main}>
      <section style={styles.hero}>
        <p style={styles.kicker}>Results</p>
        <h1 className="page-title" style={styles.title}>Thesis Results and Operational Summary</h1>
        <p className="page-subtitle" style={styles.subtitle}>
          This page turns live sensor history into thesis-ready results: irrigation activity, moisture behavior, tank uptime, and tier balance.
        </p>
      </section>

      <section style={styles.metricsGrid}>
        <Metric label="Records analyzed" value={report.total} note="Last 120 readings" tone="green" />
        <Metric label="Pump duty" value={fmtPct(pct(report.pumpOn, report.total))} note="Pump ON ratio" tone="blue" />
        <Metric label="Tank uptime" value={fmtPct(pct(report.tankOk, report.total))} note="Tank available" tone="amber" />
        <Metric label="Tier imbalance" value={`${report.imbalance.toFixed(1)}%`} note="Average spread between tiers" tone="slate" />
      </section>

      <section style={styles.chartsGrid}>
        <article style={styles.card}>
          <div style={styles.cardHead}>
            <div>
              <h2 style={styles.cardTitle}>Moisture trend</h2>
              <p style={styles.cardText}>Average moisture with individual tier lines. Shows whether the system is drying or stabilizing over time.</p>
            </div>
            <div style={styles.pill}>Dry 30% · Wet 60%</div>
          </div>
          <div style={styles.chartWrapLarge}>
            <ResponsiveContainer>
              <AreaChart data={moistureTrend} margin={{ top: 10, right: 16, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,23,42,0.06)" />
                <XAxis dataKey="time" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
                <Tooltip formatter={(v) => `${Number(v).toFixed(1)}%`} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="Average" stroke="#0f172a" fill="rgba(15,23,42,0.08)" strokeWidth={2} />
                <Area type="monotone" dataKey="Tier 1" stroke="#3b82f6" fill="transparent" strokeWidth={2} />
                <Area type="monotone" dataKey="Tier 2" stroke="#f59e0b" fill="transparent" strokeWidth={2} />
                <Area type="monotone" dataKey="Tier 3" stroke="#16a34a" fill="transparent" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article style={styles.card}>
          <div style={styles.cardHead}>
            <div>
              <h2 style={styles.cardTitle}>System activity</h2>
              <p style={styles.cardText}>Counts of key states that matter in the thesis defense.</p>
            </div>
          </div>
          <div style={styles.chartWrapMedium}>
            <ResponsiveContainer>
              <BarChart data={stateBars} margin={{ top: 10, right: 16, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,23,42,0.06)" />
                <XAxis dataKey="label" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" radius={[10, 10, 0, 0]}>
                  {stateBars.map((item) => (
                    <Cell key={item.label} fill={item.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>
      </section>

      <section style={styles.bottomGrid}>
        <article style={styles.card}>
          <h2 style={styles.cardTitle}>Label distribution</h2>
          <p style={styles.cardText}>How the dataset breaks down by soil-moisture class for ML training context.</p>
          <div style={styles.legendRow}>
            {labelBreakdown.map((item) => (
              <span key={item.name} style={styles.legendPill}>
                <span style={{ ...styles.legendDot, background: item.color }} />
                {item.name}: {item.value}
              </span>
            ))}
          </div>
          <div style={styles.pieList}>
            {labelBreakdown.map((item) => (
              <div key={item.name} style={styles.pieRow}>
                <div style={styles.pieLabel}>{item.name}</div>
                <div style={styles.pieBarTrack}>
                  <div style={{ ...styles.pieBarFill, width: `${pct(item.value, report.total)}%`, background: item.color }} />
                </div>
                <div style={styles.pieValue}>{fmtPct(pct(item.value, report.total))}</div>
              </div>
            ))}
          </div>
        </article>

        <article style={styles.card}>
          <h2 style={styles.cardTitle}>Thesis notes</h2>
          <Check label="Dashboard live monitoring" done />
          <Check label="Machine learning comparison" done />
          <Check label="CSV export/import workflow" done />
          <Check label="Manual override control" done={report.latest?.mode === 1} note="Only active when MANUAL mode is selected" />
          <Check label="Tier balance analysis" done={report.imbalance > 0} note="Shows if one tier behaves differently" />
        </article>
      </section>

      {report.latest && (
        <section style={styles.footerCard}>
          <div>
            <h2 style={styles.cardTitle}>Latest reading summary</h2>
            <p style={styles.cardText}>
              Mode: <strong>{Number(report.latest.mode) === 1 ? 'Manual' : 'Auto'}</strong> ·
              Pump: <strong>{Number(report.latest.pump) === 1 ? 'On' : 'Off'}</strong> ·
              Tank: <strong>{Number(report.latest.tank) === 1 ? 'Water OK' : 'Empty'}</strong>
            </p>
          </div>
          <div style={styles.latestGrid}>
            <SmallStat label="Tier 1" value={`${report.latest.t1}%`} />
            <SmallStat label="Tier 2" value={`${report.latest.t2}%`} />
            <SmallStat label="Tier 3" value={`${report.latest.t3}%`} />
            <SmallStat label="Temp" value={`${report.latest.temp}°C`} />
            <SmallStat label="Humidity" value={`${report.latest.humidity}%`} />
            <SmallStat label="Lux" value={`${report.latest.lux}`} />
          </div>
        </section>
      )}
    </main>
  )
}

function Metric({ label, value, note, tone }) {
  return (
    <article style={{ ...styles.metric, ...styles[`tone${tone[0].toUpperCase()}${tone.slice(1)}`] }}>
      <div style={styles.metricLabel}>{label}</div>
      <div style={styles.metricValue}>{value}</div>
      <div style={styles.metricNote}>{note}</div>
    </article>
  )
}

function Check({ label, done, note }) {
  return (
    <div style={styles.checkRow}>
      <span style={{ ...styles.checkDot, background: done ? 'var(--green-400)' : 'var(--slate-300)' }} />
      <div style={{ flex: 1 }}>
        <div style={styles.checkLabel}>{label}</div>
        {note && <div style={styles.checkNote}>{note}</div>}
      </div>
      <strong style={{ color: done ? 'var(--green-700)' : 'var(--slate-500)' }}>{done ? 'Ready' : 'Pending'}</strong>
    </div>
  )
}

function SmallStat({ label, value }) {
  return (
    <div style={styles.smallStat}>
      <div style={styles.smallStatLabel}>{label}</div>
      <div style={styles.smallStatValue}>{value}</div>
    </div>
  )
}

const styles = {
  main: { padding: '2rem 3rem 3rem', maxWidth: 1400, margin: '0 auto', color: 'var(--slate-900)' },
  hero: { marginBottom: 20 },
  kicker: { fontSize: 12, fontWeight: 800, color: 'var(--green-700)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8 },
  title: { fontSize: 32, fontWeight: 800, marginBottom: 8 },
  subtitle: { fontSize: 14, color: 'var(--slate-600)', maxWidth: 820, lineHeight: 1.7 },
  metricsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14, marginBottom: 18 },
  metric: { background: 'white', border: '1px solid rgba(15,23,42,0.05)', borderRadius: 18, padding: '1rem', boxShadow: 'var(--shadow-sm)' },
  metricLabel: { fontSize: 11, color: 'var(--slate-500)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.08em' },
  metricValue: { fontSize: 24, fontWeight: 900, color: 'var(--slate-900)', marginTop: 6 },
  metricNote: { fontSize: 12, color: 'var(--slate-600)', marginTop: 4, lineHeight: 1.5 },
  toneGreen: { borderLeft: '4px solid #16a34a' },
  toneBlue: { borderLeft: '4px solid #3b82f6' },
  toneAmber: { borderLeft: '4px solid #f59e0b' },
  toneSlate: { borderLeft: '4px solid #64748b' },
  chartsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 18, marginBottom: 18 },
  bottomGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 18, marginBottom: 18 },
  card: { background: 'white', border: '1px solid rgba(15,23,42,0.04)', borderRadius: 18, boxShadow: 'var(--shadow-sm)', padding: '1.4rem' },
  cardHead: { display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 12, flexWrap: 'wrap' },
  cardTitle: { fontSize: 16, fontWeight: 800, marginBottom: 6 },
  cardText: { fontSize: 13, color: 'var(--slate-600)', lineHeight: 1.6 },
  pill: { padding: '7px 10px', borderRadius: 999, background: 'rgba(15,23,42,0.05)', color: 'var(--slate-700)', fontSize: 12, fontWeight: 700 },
  chartWrapLarge: { height: 290 },
  chartWrapMedium: { height: 290 },
  legendRow: { display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  legendPill: { display: 'inline-flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 999, background: 'rgba(15,23,42,0.03)', color: 'var(--slate-700)', fontSize: 12, fontWeight: 700 },
  legendDot: { width: 10, height: 10, borderRadius: '50%' },
  pieList: { display: 'flex', flexDirection: 'column', gap: 12 },
  pieRow: { display: 'grid', gridTemplateColumns: '60px 1fr 52px', gap: 10, alignItems: 'center' },
  pieLabel: { fontSize: 13, fontWeight: 700, color: 'var(--slate-700)' },
  pieBarTrack: { height: 12, borderRadius: 999, background: 'rgba(15,23,42,0.06)', overflow: 'hidden' },
  pieBarFill: { height: '100%', borderRadius: 999 },
  pieValue: { fontSize: 12, fontWeight: 800, color: 'var(--slate-700)', textAlign: 'right' },
  checkRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid rgba(15,23,42,0.06)' },
  checkDot: { width: 10, height: 10, borderRadius: '50%', flexShrink: 0 },
  checkLabel: { fontSize: 14, fontWeight: 700 },
  checkNote: { fontSize: 12, color: 'var(--slate-500)', marginTop: 2, lineHeight: 1.4 },
  footerCard: { background: 'white', border: '1px solid rgba(15,23,42,0.04)', borderRadius: 18, boxShadow: 'var(--shadow-sm)', padding: '1.4rem' },
  latestGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12, marginTop: 14 },
  smallStat: { background: 'rgba(15,23,42,0.02)', border: '1px solid rgba(15,23,42,0.04)', borderRadius: 14, padding: '0.85rem' },
  smallStatLabel: { fontSize: 11, color: 'var(--slate-500)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.08em' },
  smallStatValue: { fontSize: 15, fontWeight: 900, marginTop: 6 },
}
