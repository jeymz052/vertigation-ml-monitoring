import { useMemo, useState } from 'react'

function ControlToggle({ label, description, checked, disabled, onChange, accent = '#16a34a' }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      style={{
        ...styles.toggleCard,
        borderColor: checked ? `${accent}40` : 'rgba(15,23,42,0.06)',
        background: checked ? `${accent}08` : 'white',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <div style={styles.toggleHead}>
        <div>
          <div style={styles.toggleLabel}>{label}</div>
          <div style={styles.toggleDesc}>{description}</div>
        </div>
        <div
          style={{
            ...styles.switchTrack,
            background: checked ? accent : 'rgba(148,163,184,0.35)',
          }}
        >
          <span
            style={{
              ...styles.switchThumb,
              transform: checked ? 'translateX(18px)' : 'translateX(0)',
            }}
          />
        </div>
      </div>
    </button>
  )
}

export default function DashboardControls({ data, sendControl }) {
  const [busy, setBusy] = useState(null)

  const manualMode = Number(data?.mode) === 1
  const pumpManual = Number(data?.pumpManual) === 1
  const pumpStatus = Number(data?.pump) === 1

  const statusText = useMemo(() => {
    if (manualMode) return 'Manual control is active. The dashboard switch drives the pump.'
    return 'Auto mode is active. Soil moisture controls watering.'
  }, [manualMode])

  async function updatePin(pin, value, label) {
    setBusy(label)
    try {
      await sendControl?.(pin, value ? 1 : 0)
    } catch (error) {
      alert(`Failed to update ${label}. Check Blynk connection and datastream settings.`)
      throw error
    } finally {
      setBusy(null)
    }
  }

  return (
    <section style={styles.card}>
      <div style={styles.header}>
        <div>
          <h3 style={styles.title}><i className="fa-solid fa-sliders" style={{ marginRight: 8 }} /> Control center</h3>
          <p style={styles.sub}>Use the dashboard to switch between automatic watering and manual pump control.</p>
        </div>
        <div style={styles.liveBadge}>{manualMode ? 'MANUAL' : 'AUTO'}</div>
      </div>

      <div style={styles.infoBox}>{statusText}</div>

      <div style={styles.grid}>
        <ControlToggle
          label="Auto / Manual"
          description="AUTO uses soil sensors. MANUAL lets the dashboard control the pump."
          checked={manualMode}
          disabled={busy === 'mode'}
          accent="#f59e0b"
          onChange={(next) => updatePin('V8', next, 'mode')}
        />
      </div>

      {manualMode ? (
        <div style={styles.manualBlock}>
          <div style={styles.manualHeader}>
            <div>
              <div style={styles.manualTitle}>Pump override</div>
              <div style={styles.manualDesc}>Turn the pump on or off from the dashboard. In manual mode, the valves follow the same override behavior for testing.</div>
            </div>
            <button
              type="button"
              disabled={busy === 'pump'}
              onClick={() => updatePin('V7', !pumpManual, 'pump')}
              style={{
                ...styles.manualBtn,
                background: pumpManual ? 'linear-gradient(135deg, #16a34a, #22c55e)' : 'rgba(148,163,184,0.18)',
                color: pumpManual ? 'white' : 'var(--slate-700)',
              }}
            >
              {pumpManual ? 'Pump ON' : 'Pump OFF'}
            </button>
          </div>
        </div>
      ) : (
        <div style={styles.manualLocked}>
          Pump control is locked in AUTO mode. Switch to MANUAL first.
        </div>
      )}

      <div style={styles.footerRow}>
        <div style={styles.statusPill}>
          Pump status: <strong style={{ marginLeft: 6 }}>{pumpStatus ? 'ON' : 'OFF'}</strong>
        </div>
        <div style={styles.statusMeta}>
          V8 controls mode. V7 controls the pump in manual mode.
        </div>
      </div>
    </section>
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
  header: { display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 12, flexWrap: 'wrap' },
  title: { fontSize: 16, fontWeight: 900, color: 'var(--slate-900)' },
  sub: { fontSize: 13, color: 'var(--slate-600)', marginTop: 4, lineHeight: 1.5 },
  liveBadge: { padding: '8px 12px', borderRadius: 999, background: 'rgba(22,163,74,0.10)', color: 'var(--green-800)', fontSize: 12, fontWeight: 800, letterSpacing: '0.08em' },
  infoBox: { padding: '10px 12px', borderRadius: 12, background: 'rgba(15,23,42,0.03)', color: 'var(--slate-700)', fontSize: 13, lineHeight: 1.5, marginBottom: 12 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 },
  toggleCard: {
    width: '100%',
    textAlign: 'left',
    padding: '14px 14px 12px',
    borderRadius: 16,
    border: '1px solid rgba(15,23,42,0.06)',
    background: 'white',
    cursor: 'pointer',
  },
  manualBlock: {
    marginTop: 12,
    padding: '14px',
    borderRadius: 16,
    border: '1px solid rgba(15,23,42,0.06)',
    background: 'rgba(15,23,42,0.02)',
  },
  manualHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  manualTitle: { fontSize: 13, fontWeight: 900, color: 'var(--slate-900)' },
  manualDesc: { fontSize: 12, color: 'var(--slate-600)', marginTop: 4, lineHeight: 1.45, maxWidth: 520 },
  manualBtn: {
    minWidth: 110,
    border: 'none',
    borderRadius: 14,
    padding: '10px 14px',
    fontWeight: 900,
    cursor: 'pointer',
    boxShadow: '0 10px 20px rgba(15,23,42,0.08)',
  },
  manualLocked: {
    marginTop: 12,
    padding: '10px 12px',
    borderRadius: 12,
    background: 'rgba(148,163,184,0.12)',
    color: 'var(--slate-600)',
    fontSize: 12,
  },
  toggleHead: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  toggleLabel: { fontSize: 13, fontWeight: 900, color: 'var(--slate-900)' },
  toggleDesc: { fontSize: 12, color: 'var(--slate-600)', lineHeight: 1.45, marginTop: 4, maxWidth: 360 },
  switchTrack: {
    width: 40,
    height: 22,
    borderRadius: 999,
    padding: 2,
    flexShrink: 0,
    transition: 'background 0.2s ease',
  },
  switchThumb: {
    display: 'block',
    width: 18,
    height: 18,
    borderRadius: '50%',
    background: 'white',
    boxShadow: '0 4px 10px rgba(15,23,42,0.18)',
    transition: 'transform 0.2s ease',
  },
  footerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 10,
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 12,
  },
  statusPill: { padding: '8px 12px', borderRadius: 999, background: 'rgba(15,23,42,0.04)', color: 'var(--slate-700)', fontSize: 12 },
  statusMeta: { fontSize: 12, color: 'var(--slate-500)' },
}
