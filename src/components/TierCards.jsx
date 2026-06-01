import { useState } from 'react'

export default function TierCards({ data }) {
  const cards = [
    { label: 'Soil Moisture T1', pct: data.t1, iconClass: 'fa-solid fa-droplet' },
    { label: 'Soil Moisture T2', pct: data.t2, iconClass: 'fa-solid fa-droplet' },
    { label: 'Soil Moisture T3', pct: data.t3, iconClass: 'fa-solid fa-droplet' },
  ]

  // Use explicit hex colors so appended alpha suffixes work consistently
  const accentColors = ['#3b82f6', '#f87171', '#1a9e52']
  const [activeIndex, setActiveIndex] = useState(0)

  return (
    <div style={styles.grid}>
      {cards.map((c, i) => {
        const color = accentColors[i % accentColors.length]
        return (
          <div
            key={c.label}
            role="button"
            tabIndex={0}
            onClick={() => setActiveIndex(i)}
            onKeyDown={(e) => e.key === 'Enter' && setActiveIndex(i)}
            style={{
              ...styles.card,
              borderColor: activeIndex === i ? `${color}30` : 'rgba(15,23,42,0.04)',
              transform: activeIndex === i ? 'translateY(-1px)' : 'translateY(0)',
              boxShadow: activeIndex === i ? '0 12px 30px rgba(16,24,40,0.10)' : 'var(--shadow-sm)',
            }}
            className={`fade-up fade-up-${i + 2}`}
          >
            <div style={styles.cardInner}>
              <div style={{ ...styles.topAccent, background: color, opacity: activeIndex === i ? 1 : 0.7 }} />

              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <div style={{ ...styles.iconCircle, background: `${color}10`, color }}>
                  <i className={c.iconClass} aria-hidden="true" />
                </div>
              </div>

              <div style={{ textAlign: 'center', paddingTop: 8 }}>
                <div style={styles.label}>{c.label}</div>
                <div style={{ ...styles.value, color: 'var(--slate-900)' }}>{c.pct ?? '--'}%</div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

const styles = {
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: 18,
    marginBottom: 20,
  },
  card: {
    background: 'white',
    border: '1px solid rgba(15,23,42,0.04)',
    borderRadius: 16,
    padding: 0,
    minHeight: 140,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: 'var(--shadow-sm)',
    position: 'relative',
    cursor: 'pointer',
    transition: 'transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease',
  },
  cardInner: { padding: '18px 22px 20px', width: '100%', position: 'relative' },
  topAccent: { height: 4, borderRadius: '0 0 99px 99px', position: 'absolute', top: 0, left: 18, right: 18 },
  iconCircle: { width: 54, height: 54, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, marginTop: 6, marginBottom: 8 },
  label: { fontSize: 12, color: 'var(--slate-500)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' },
  value: { fontSize: 42, color: 'var(--slate-900)', fontWeight: 900, marginTop: 6 },
}
