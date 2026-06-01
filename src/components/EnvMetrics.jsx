import { useState } from 'react'

const cards = (data) => [
  {
    iconClass: 'fa-solid fa-thermometer-half',
    label: 'Temperature',
    value: `${data.temp}°C`,
    sub: data.temp > 35 ? 'High' : data.temp < 18 ? 'Cool' : 'Normal',
    color: data.temp > 35 ? 'var(--amber-400)' : 'var(--blue-400)',
  },
  {
    iconClass: 'fa-solid fa-droplet',
    label: 'Humidity',
    value: `${data.humidity}%`,
    sub: data.humidity > 80 ? 'High' : data.humidity < 40 ? 'Low' : 'Normal',
    color: 'var(--green-600)',
  },
  {
    iconClass: 'fa-solid fa-sun',
    label: 'Light',
    value: data.lux >= 1000 ? `${(data.lux/1000).toFixed(1)}k lux` : `${data.lux} lux`,
    sub: data.lux > 10000 ? 'Bright' : data.lux > 1000 ? 'Moderate' : 'Low light',
    color: 'var(--amber-400)',
  },
  {
    iconClass: 'fa-solid fa-fill-drip',
    label: 'Water Tank',
    value: data.tank === 1 ? 'OK' : 'EMPTY',
    sub: data.tank === 1 ? 'Sufficient' : 'Refill needed',
    color: data.tank === 1 ? 'var(--green-600)' : 'var(--red-400)',
  },
]

export default function EnvMetrics({ data }) {
  const [activeIndex, setActiveIndex] = useState(0)

  return (
    <div className="env-metrics-grid" style={styles.grid}>
      {cards(data).map((c, i) => (
        <div
          key={c.label}
          role="button"
          tabIndex={0}
          onClick={() => setActiveIndex(i)}
          onKeyDown={(e) => e.key === 'Enter' && setActiveIndex(i)}
          className={`env-card fade-up fade-up-${i + 2}`}
          style={{
            ...styles.card,
            borderColor: activeIndex === i ? `${c.color}30` : 'rgba(15,23,42,0.04)',
            transform: activeIndex === i ? 'translateY(-1px)' : 'translateY(0)',
            boxShadow: activeIndex === i ? '0 12px 30px rgba(16,24,40,0.10)' : 'var(--shadow-sm)',
          }}
        >
          <div style={{ ...styles.topAccent, background: c.color, opacity: activeIndex === i ? 1 : 0.7 }} />
          <div className="env-card__head" style={styles.cardHead}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ ...styles.iconWrap, background: `${c.color}10`, color: c.color }}>
                <i className={c.iconClass} aria-hidden="true" style={{ fontSize: 18 }} />
              </div>
              <div>
                <div style={styles.label}>{c.label}</div>
                <div style={{ ...styles.sub, color: 'var(--slate-500)' }}>{c.sub}</div>
              </div>
            </div>
            <div className="env-card__value" style={styles.value}>{c.value}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

const styles = {
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: 16,
    marginBottom: 20,
  },
  card: {
    background: 'white',
    border: '1px solid rgba(15,23,42,0.04)',
    borderRadius: 16,
    padding: '1.35rem 1.5rem 1.2rem',
    boxShadow: 'var(--shadow-sm)',
    minHeight: 120,
    position: 'relative',
    cursor: 'pointer',
    transition: 'transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease',
  },
  topAccent: {
    position: 'absolute',
    top: 0,
    left: 16,
    right: 16,
    height: 4,
    borderRadius: '0 0 99px 99px',
  },
  cardHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  iconWrap: { width: 52, height: 52, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 },
  value: { fontSize: 30, fontWeight: 800, color: 'var(--slate-900)' },
  label: { fontSize: 12, color: 'var(--slate-600)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' },
  sub: { fontSize: 13, fontWeight: 600 },
}
