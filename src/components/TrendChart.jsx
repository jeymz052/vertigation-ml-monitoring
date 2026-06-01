import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ReferenceLine,
} from 'recharts'

function fmt(date) {
  return date.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 10, padding: '10px 14px', fontSize: 13,
    }}>
      <p style={{ color: '#64748b', marginBottom: 6, fontFamily: "'DM Mono', monospace", fontSize: 11 }}>{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color, fontWeight: 500 }}>
          {p.name}: {p.value}%
        </p>
      ))}
    </div>
  )
}

export default function TrendChart({ history, fullPage = false }) {
  const chartData = history.map(h => ({
    time: fmt(h.time),
    'Tier 1': h.t1,
    'Tier 2': h.t2,
    'Tier 3': h.t3,
  }))

  return (
    <div className="chart-card fade-up fade-up-5" style={styles.card}>
      <div style={styles.header}>
        <span style={styles.title}><i className="fa-solid fa-chart-line" style={{ marginRight: 8 }} /> Moisture Trend</span>
        <span style={styles.meta}>Last {history.length} readings - updates every 2s</span>
      </div>

      {history.length < 2 ? (
        <div style={styles.empty}>
          <i className="fa-solid fa-satellite-dish" style={{ fontSize: 28 }} />
          <p>Collecting data...</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={ fullPage ? '100%' : 200 }>
          <LineChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis
              dataKey="time"
              tick={{ fontSize: 10, fill: '#475569', fontFamily: "'DM Mono', monospace" }}
              interval="preserveStartEnd"
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 10, fill: '#475569' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={v => `${v}%`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: 12, color: '#94a3b8', paddingTop: 8 }}
              iconType="circle"
            />
            <ReferenceLine y={30} stroke="#f59e0b" strokeDasharray="4 4" strokeOpacity={0.5} />
            <ReferenceLine y={60} stroke="#3b82f6" strokeDasharray="4 4" strokeOpacity={0.5} />

            <Line type="monotone" dataKey="Tier 1" stroke="#2ecc71" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
            <Line type="monotone" dataKey="Tier 2" stroke="#f59e0b" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
            <Line type="monotone" dataKey="Tier 3" stroke="#3b82f6" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      )}

      <div style={styles.refRow}>
        <span style={styles.refItem}><span style={{ ...styles.refLine, background: '#f59e0b' }} />Dry threshold (30%)</span>
        <span style={styles.refItem}><span style={{ ...styles.refLine, background: '#3b82f6' }} />Wet threshold (60%)</span>
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
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    flexWrap: 'wrap', gap: 6, marginBottom: '1rem',
  },
  title: { fontSize: 15, fontWeight: 700, color: 'var(--slate-900)' },
  meta: { fontSize: 11, color: 'var(--slate-600)', fontFamily: "'DM Mono', monospace" },
  empty: {
    height: 180, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap: 8,
    color: 'var(--slate-600)', fontSize: 14,
  },
  refRow: { display: 'flex', gap: 16, marginTop: 8, flexWrap: 'wrap' },
  refItem: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--slate-600)' },
  refLine: { display: 'inline-block', width: 20, height: 2, borderRadius: 1 },
}
