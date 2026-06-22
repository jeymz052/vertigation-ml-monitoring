import { useMemo } from 'react'
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, Legend } from 'recharts'
import { buildIrrigationAdvisory, loadTrainedModelSnapshot, predictStoredModel, predictStoredTierForecasts } from '../lib/mlAdvisor'

function avg(values) {
  if (!values.length) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function fmtPct(value) {
  return `${Math.round(value)}%`
}

function tierPredictionTone(prediction) {
  if (prediction === 'dry') return {
    background: 'rgba(239,68,68,0.12)',
    border: '1px solid rgba(239,68,68,0.18)',
    color: '#b91c1c',
  }

  if (prediction === 'wet') return {
    background: 'rgba(22,163,74,0.12)',
    border: '1px solid rgba(22,163,74,0.18)',
    color: '#166534',
  }

  if (prediction === 'ok') return {
    background: 'rgba(245,158,11,0.14)',
    border: '1px solid rgba(245,158,11,0.18)',
    color: '#92400e',
  }

  return {
    background: 'rgba(100,116,139,0.12)',
    border: '1px solid rgba(100,116,139,0.16)',
    color: '#334155',
  }
}

function tierPredictionLabel(prediction) {
  if (prediction === 'ok') return 'okay'
  return prediction || 'n/a'
}

function buildTierSummary(snapshot, tierPredictions) {
  if (!snapshot || !tierPredictions) return null

  const horizonLabel = snapshot.horizonLabel || 'the selected horizon'
  return {
    title: `After ${horizonLabel}: T1 ${tierPredictionLabel(tierPredictions.t1)}, T2 ${tierPredictionLabel(tierPredictions.t2)}, T3 ${tierPredictionLabel(tierPredictions.t3)}`,
    detail: `Per-tier forecast for ${horizonLabel}. This shows which tier is likely to become dry, remain okay, or stay wet based on the trained ${snapshot.label} model.`,
  }
}

function normalizePrediction(prediction) {
  return prediction === 'ok' ? 'okay' : prediction || 'n/a'
}

function tierRecommendation(prediction) {
  if (prediction === 'dry') return 'Prepare watering soon'
  if (prediction === 'ok') return 'Continue monitoring'
  if (prediction === 'wet') return 'No action needed'
  return 'No forecast available'
}

function tierReason(tierLabel, currentValue, prediction, trendLabel) {
  if (prediction === 'dry') {
    return `Predicted dry because ${tierLabel} is already low at ${Math.round(currentValue)}% and the recent trend is ${trendLabel.toLowerCase()}.`
  }

  if (prediction === 'wet') {
    return `Predicted wet because ${tierLabel} is still high at ${Math.round(currentValue)}% and moisture remains sufficient.`
  }

  if (prediction === 'ok') {
    return `Predicted okay because ${tierLabel} is still within the middle range at ${Math.round(currentValue)}% and no sharp drop is detected.`
  }

  return `No trained forecast is available yet for ${tierLabel}.`
}

function horizonKeyFromLabel(label) {
  const text = String(label || '').toLowerCase()
  if (text.includes('5 minute')) return '5m'
  if (text.includes('10 minute')) return '10m'
  if (text.includes('20 minute')) return '20m'
  if (text.includes('30 minute')) return '30m'
  return null
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
    const tierPredictions = snapshot && latestRow ? predictStoredTierForecasts(snapshot, latestRow) : null
    const advisory = buildIrrigationAdvisory(prediction, latestRow, snapshot)
    const tierSummary = buildTierSummary(snapshot, tierPredictions)

    return { snapshot, prediction, tierPredictions, advisory, tierSummary }
  }, [latestRow, history.length, data?.t1, data?.t2, data?.t3, data?.temp, data?.humidity, data?.lux, data?.tank, data?.pump])

  const tierForecastCards = useMemo(() => {
    if (!latestRow) return []

    return [
      {
        key: 't1',
        label: 'Tier 1',
        current: Number(latestRow.t1) || 0,
        prediction: mlAdvisor.tierPredictions?.t1 ?? null,
      },
      {
        key: 't2',
        label: 'Tier 2',
        current: Number(latestRow.t2) || 0,
        prediction: mlAdvisor.tierPredictions?.t2 ?? null,
      },
      {
        key: 't3',
        label: 'Tier 3',
        current: Number(latestRow.t3) || 0,
        prediction: mlAdvisor.tierPredictions?.t3 ?? null,
      },
    ].map((tier) => ({
      ...tier,
      predictionLabel: normalizePrediction(tier.prediction),
      recommendation: tierRecommendation(tier.prediction),
      reason: tierReason(tier.label, tier.current, tier.prediction, stats.trendLabel),
    }))
  }, [latestRow, mlAdvisor.tierPredictions, stats.trendLabel])

  const forecastTimeline = useMemo(() => {
    const trainedHorizonKey = horizonKeyFromLabel(mlAdvisor.snapshot?.horizonLabel)
    const tiers = mlAdvisor.tierPredictions
    const makeSummary = () => {
      if (!tiers) return 'Train this horizon on the ML page'
      return `T1 ${normalizePrediction(tiers.t1)} · T2 ${normalizePrediction(tiers.t2)} · T3 ${normalizePrediction(tiers.t3)}`
    }

    return [
      {
        key: 'current',
        label: 'Current condition',
        active: true,
        summary: latestRow ? `T1 ${Math.round(latestRow.t1)}% · T2 ${Math.round(latestRow.t2)}% · T3 ${Math.round(latestRow.t3)}%` : 'No live row yet',
      },
      {
        key: '5m',
        label: 'After 5 minutes',
        active: trainedHorizonKey === '5m',
        summary: trainedHorizonKey === '5m' ? makeSummary() : 'Train 5-minute forecast',
      },
      {
        key: '10m',
        label: 'After 10 minutes',
        active: trainedHorizonKey === '10m',
        summary: trainedHorizonKey === '10m' ? makeSummary() : 'Train 10-minute forecast',
      },
      {
        key: '20m',
        label: 'After 20 minutes',
        active: trainedHorizonKey === '20m',
        summary: trainedHorizonKey === '20m' ? makeSummary() : 'Train 20-minute forecast',
      },
    ]
  }, [latestRow, mlAdvisor.snapshot?.horizonLabel, mlAdvisor.tierPredictions])

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
          <div style={styles.kickerRow}>
            <span style={styles.kicker}>Prediction first</span>
            <span style={styles.kickerMuted}>Live + forecast</span>
          </div>
          <h3 style={styles.title}>Forecast and operational insights</h3>
          <p style={styles.sub}>Per-tier prediction, recommendations, and a forecast timeline at the top of the dashboard.</p>
        </div>
        <div style={styles.badge}>{stats.recommendation}</div>
      </div>

      <div style={styles.advisorCard}>
        <div style={styles.advisorHead}>
          <div>
            <div style={styles.advisorLabel}>Time-based soil prediction</div>
            <div style={styles.advisorValue}>{mlAdvisor.tierSummary?.title || mlAdvisor.advisory.status}</div>
            <div style={styles.advisorSub}>{mlAdvisor.snapshot ? `Horizon: ${mlAdvisor.snapshot.horizonLabel} · Model: ${mlAdvisor.snapshot.label}` : 'Train a model to enable forecasting.'}</div>
          </div>
          <div style={styles.advisorTone(mlAdvisor.advisory.tone)}>
            {mlAdvisor.snapshot?.label ?? 'No trained model'}
          </div>
        </div>
        <div style={styles.advisorText}>{mlAdvisor.tierSummary?.detail || mlAdvisor.advisory.detail}</div>
        {mlAdvisor.tierPredictions && (
          <div style={styles.tierForecastRow}>
            <span style={styles.tierForecastLabel}>Per-tier forecast</span>
            <span style={{ ...styles.tierForecastChip, ...tierPredictionTone(mlAdvisor.tierPredictions.t1) }}>T1: {mlAdvisor.tierPredictions.t1 ?? 'n/a'}</span>
            <span style={{ ...styles.tierForecastChip, ...tierPredictionTone(mlAdvisor.tierPredictions.t2) }}>T2: {mlAdvisor.tierPredictions.t2 ?? 'n/a'}</span>
            <span style={{ ...styles.tierForecastChip, ...tierPredictionTone(mlAdvisor.tierPredictions.t3) }}>T3: {mlAdvisor.tierPredictions.t3 ?? 'n/a'}</span>
          </div>
        )}
        <div style={styles.advisorMetaRow}>
          <span style={styles.advisorMeta}>Predicted class: {mlAdvisor.prediction ?? 'n/a'}</span>
          <span style={styles.advisorMeta}>{latestRow ? `Latest row: T1 ${Math.round(latestRow.t1)}%, T2 ${Math.round(latestRow.t2)}%, T3 ${Math.round(latestRow.t3)}%` : 'No sensor row yet'}</span>
        </div>
      </div>

      {tierForecastCards.length > 0 && (
        <div style={styles.predictionWorkspace}>
          <div style={styles.tierCardGrid}>
            {tierForecastCards.map((tier) => (
              <div key={tier.key} style={styles.tierCard}>
                <div style={styles.tierCardTop}>
                  <div>
                    <div style={styles.tierCardLabel}>{tier.label}</div>
                    <div style={styles.tierCardCurrent}>Current: {Math.round(tier.current)}%</div>
                  </div>
                  <span style={{ ...styles.tierStateBadge, ...tierPredictionTone(tier.prediction) }}>
                    Likely {tier.predictionLabel}
                  </span>
                </div>
                <div style={styles.tierRecommendation}>{tier.recommendation}</div>
                <div style={styles.tierReason}>{tier.reason}</div>
              </div>
            ))}
          </div>

          <div style={styles.timelineCard}>
            <div style={styles.chartHead}>
              <h4 style={styles.chartTitle}>Forecast timeline</h4>
              <span style={styles.chartMeta}>Current and forecast checkpoints</span>
            </div>
            <div style={styles.timelineGrid}>
              {forecastTimeline.map((item) => (
                <div key={item.key} style={item.active ? styles.timelineItemActive : styles.timelineItem}>
                  <div style={styles.timelineLabel}>{item.label}</div>
                  <div style={styles.timelineSummary}>{item.summary}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

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
    background: 'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(248,250,252,0.96))',
    border: '1px solid rgba(15,23,42,0.05)',
    borderRadius: 24,
    padding: '1.4rem',
    marginBottom: 16,
    boxShadow: '0 18px 34px rgba(15,23,42,0.05)',
  },
  header: { display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 14, flexWrap: 'wrap' },
  title: { fontSize: 20, fontWeight: 900, color: 'var(--slate-900)', letterSpacing: '-0.03em' },
  sub: { fontSize: 13, color: 'var(--slate-600)', marginTop: 4 },
  kickerRow: { display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' },
  kicker: { display: 'inline-flex', padding: '6px 10px', borderRadius: 999, background: 'rgba(22,163,74,0.12)', color: 'var(--green-800)', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em' },
  kickerMuted: { display: 'inline-flex', padding: '6px 10px', borderRadius: 999, background: 'rgba(15,23,42,0.06)', color: 'var(--slate-700)', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' },
  badge: { padding: '8px 12px', borderRadius: 999, background: 'rgba(22,163,74,0.10)', color: 'var(--green-800)', fontSize: 12, fontWeight: 800 },
  advisorCard: { marginBottom: 16, padding: '1.15rem', borderRadius: 20, background: 'linear-gradient(135deg, rgba(59,130,246,0.10), rgba(34,197,94,0.10) 60%, rgba(255,255,255,0.95))', border: '1px solid rgba(15,23,42,0.05)', boxShadow: '0 14px 28px rgba(15,23,42,0.05)' },
  advisorHead: { display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' },
  advisorLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 800, color: 'var(--slate-500)' },
  advisorValue: { fontSize: 28, fontWeight: 900, marginTop: 4, color: 'var(--slate-900)', lineHeight: 1.15, maxWidth: 880 },
  advisorSub: { marginTop: 8, fontSize: 12.5, color: 'var(--slate-500)', fontFamily: "'DM Mono', monospace" },
  advisorText: { marginTop: 10, fontSize: 13.5, color: 'var(--slate-700)', lineHeight: 1.6, maxWidth: 940 },
  tierForecastRow: { marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  tierForecastLabel: { fontSize: 12, fontWeight: 800, color: 'var(--slate-600)' },
  tierForecastChip: { fontSize: 12, color: 'var(--slate-700)', background: 'rgba(255,255,255,0.78)', border: '1px solid rgba(15,23,42,0.06)', borderRadius: 999, padding: '6px 10px', fontWeight: 700 },
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
  predictionWorkspace: { display: 'grid', gap: 16, marginBottom: 18 },
  tierCardGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 },
  tierCard: { borderRadius: 20, border: '1px solid rgba(15,23,42,0.05)', padding: '1rem', background: 'linear-gradient(180deg, rgba(255,255,255,1), rgba(248,250,252,0.97))', boxShadow: '0 10px 24px rgba(15,23,42,0.04)' },
  tierCardTop: { display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', marginBottom: 12 },
  tierCardLabel: { fontSize: 13, fontWeight: 900, color: 'var(--slate-900)', textTransform: 'uppercase', letterSpacing: '0.06em' },
  tierCardCurrent: { marginTop: 4, fontSize: 13, color: 'var(--slate-600)' },
  tierStateBadge: { display: 'inline-flex', alignItems: 'center', borderRadius: 999, padding: '8px 12px', fontSize: 12, fontWeight: 900, textTransform: 'uppercase' },
  tierRecommendation: { fontSize: 18, fontWeight: 900, color: 'var(--slate-900)', marginBottom: 8, letterSpacing: '-0.02em' },
  tierReason: { fontSize: 13, color: 'var(--slate-600)', lineHeight: 1.6 },
  timelineCard: { borderRadius: 20, border: '1px solid rgba(15,23,42,0.05)', padding: '1rem', background: 'white', boxShadow: '0 10px 24px rgba(15,23,42,0.04)' },
  timelineGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 },
  timelineItem: { borderRadius: 14, padding: '0.9rem', background: 'rgba(248,250,252,0.95)', border: '1px solid rgba(15,23,42,0.05)' },
  timelineItemActive: { borderRadius: 14, padding: '0.9rem', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.16)' },
  timelineLabel: { fontSize: 12, fontWeight: 900, color: 'var(--slate-700)', marginBottom: 6 },
  timelineSummary: { fontSize: 13, color: 'var(--slate-600)', lineHeight: 1.5 },
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
