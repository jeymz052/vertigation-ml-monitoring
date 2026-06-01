import { useState, useMemo, useRef } from 'react'
import { trainRandomForest, predictRF, accuracyScore, confusionMatrix } from '../lib/randomForest'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts'

export default function MachineLearningPage({ history = [] }) {
  const [nEstimators, setNEstimators] = useState(25)
  const [sampleRatio, setSampleRatio] = useState(1.0)
  const [model, setModel] = useState(null)
  const [metrics, setMetrics] = useState(null)
  const [csvRows, setCsvRows] = useState(null)
  const [splitRatio, setSplitRatio] = useState(0.7)
  const [confMat, setConfMat] = useState(null)
  const fileRef = useRef()
  const metricsRef = useRef()
  const [useImportedOnly, setUseImportedOnly] = useState(false)
  const [featureNamesState, setFeatureNamesState] = useState(null)

  // Prepare data from history: features = [t1,t2,t3,temp,humidity,lux,tank]
  const { X, y, featureNames } = useMemo(() => {
    const rows = history.map(h => ({
      features: [h.t1, h.t2, h.t3, parseFloat(h.temp), parseFloat(h.humidity), parseFloat(h.lux), h.tank || 0],
      avg: (h.t1 + h.t2 + h.t3) / 3,
    }))
    const X = rows.map(r => r.features)
    const y = rows.map(r => r.avg <= 30 ? 'dry' : (r.avg >= 60 ? 'wet' : 'ok'))
    const featureNames = ['t1','t2','t3','temp','humidity','lux','tank']
    return { X, y, featureNames }
  }, [history])

  const displayFeatureNames = featureNamesState || featureNames

  function handleTrain() {
    // choose dataset: CSV rows if present else live history
    const datasetX = csvRows ? csvRows.map(r => r.features) : X
    const datasety = csvRows ? csvRows.map(r => r.label) : y
    if (!datasetX.length) return alert('Not enough data — wait for more sensor readings or upload CSV.')

    // split
    const split = Math.max(1, Math.floor(datasetX.length * splitRatio))
    const Xtrain = datasetX.slice(0, split)
    const ytrain = datasety.slice(0, split)
    const Xtest = datasetX.slice(split)
    const ytest = datasety.slice(split)

    const m = trainRandomForest(Xtrain, ytrain, { nEstimators, sampleRatio })
    const preds = Xtest.length ? predictRF(m, Xtest) : predictRF(m, Xtrain)
    const evalAgainst = Xtest.length ? ytest : ytrain
    const acc = accuracyScore(evalAgainst, preds)
    setModel(m)
    setMetrics({ accuracy: acc, trainedOn: Xtrain.length, testOn: evalAgainst.length })

    if (evalAgainst.length) {
      const cm = confusionMatrix(evalAgainst.concat([]), evalAgainst, preds)
      setConfMat(cm)
    }
  }

  function handleCsvUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const text = reader.result
      const rows = text.split(/\r?\n/).map(r => r.trim()).filter(Boolean)
      // Expect CSV with header: t1,t2,t3,temp,humidity,lux,tank,label
      const header = rows[0].split(',').map(h => h.trim())
      const data = rows.slice(1).map(line => {
        const cols = line.split(',').map(c => c.trim())
        const map = Object.fromEntries(header.map((h, i) => [h, cols[i]]))
        const features = [Number(map.t1), Number(map.t2), Number(map.t3), Number(map.temp), Number(map.humidity), Number(map.lux), Number(map.tank || 0)]
        const label = map.label || map.labelled || map.target || cols[cols.length - 1]
        return { features, label }
      })
      setCsvRows(data)
      try { if (fileRef.current) fileRef.current.value = '' } catch (e) {}
    }
    reader.readAsText(file)
  }

  function handleMetricsUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result)
        // Accept common key variations and the notebook's schema
        const importancesRaw = parsed.feature_importances || parsed.importances || parsed.featureImportances
        const labels = parsed.class_labels || parsed.labels || parsed.class_names || parsed.classes
        const matrix = parsed.confusion_matrix || parsed.confusionMatrix
        const fname = parsed.feature_columns || parsed.feature_names || parsed.featureNames
        const acc = parsed.accuracy || parsed.acc
        const trainRows = parsed.train_rows || parsed.trainedOn || parsed.train_rows_count
        const testRows = parsed.test_rows || parsed.testOn || parsed.test_rows_count

        setMetrics({ accuracy: acc, trainedOn: trainRows, testOn: testRows })

        if (matrix && labels) setConfMat({ labels, matrix })

        // Normalize feature importances into an array aligned with feature names
        if (importancesRaw) {
          let importanceArray = []
          if (importancesRaw.length && typeof importancesRaw[0] === 'number') {
            importanceArray = importancesRaw
          } else if (importancesRaw.length && importancesRaw[0] && importancesRaw[0].importance !== undefined) {
            // Array of { feature: name, importance: value }
            const nameOrder = fname || importancesRaw.map(f => f.feature)
            importanceArray = (nameOrder || []).map(fn => {
              const found = importancesRaw.find(x => String(x.feature) === String(fn))
              return found ? found.importance : 0
            })
          } else {
            // Fallback: try to map objects to numeric values
            importanceArray = importancesRaw.map(x => (typeof x === 'number' ? x : (x.importance || x.value || 0)))
          }

          setModel({ importance: importanceArray, trees: new Array(parsed.n_estimators || parsed.n_estimators || 1) })
        }

        if (fname) setFeatureNamesState(fname)
        setUseImportedOnly(true)
        try { if (metricsRef.current) metricsRef.current.value = '' } catch (e) {}
      } catch (err) {
        alert('Failed to parse metrics JSON: ' + err.message)
      }
    }
    reader.readAsText(file)
  }

  function handleExportModel() {
    if (!model) return alert('No model to export')
    const blob = new Blob([JSON.stringify(model)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'rf-model.json'
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  function downloadSampleCsv() {
    const rows = (csvRows ? csvRows : (history.length ? history.slice(-20) : [])).map(h => {
      if (h.features) {
        // already csvRows format
        return [...h.features, h.label].join(',')
      }
      // history item
      return [h.t1 ?? 0, h.t2 ?? 0, h.t3 ?? 0, parseFloat(h.temp) || 0, parseFloat(h.humidity) || 0, parseFloat(h.lux) || 0, h.tank || 0, (((h.t1||0)+(h.t2||0)+(h.t3||0))/3)<=30 ? 'dry' : ((((h.t1||0)+(h.t2||0)+(h.t3||0))/3)>=60 ? 'wet' : 'ok')].join(',')
    })
    const header = 't1,t2,t3,temp,humidity,lux,tank,label'
    const csv = [header].concat(rows).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'sample_dataset.csv'
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const modelReady = Boolean(model)
  const sourceLabel = useImportedOnly ? 'Imported metrics' : (csvRows ? 'Uploaded CSV' : 'Live sensor history')
  const dataRowCount = csvRows ? csvRows.length : X.length
  const activeSplitLabel = `${Math.round(splitRatio * 100)}% / ${Math.round((1 - splitRatio) * 100)}%`
  const overviewKpis = [
    {
      label: 'Data source',
      value: sourceLabel,
      meta: useImportedOnly ? 'Imported metrics locked for reporting' : 'Quick experiments still available',
      icon: 'fa-solid fa-database',
      tone: 'green',
    },
    {
      label: 'Rows available',
      value: dataRowCount,
      meta: 'Sensor history or uploaded CSV rows',
      icon: 'fa-solid fa-table-cells-large',
      tone: 'blue',
    },
    {
      label: 'Train split',
      value: `${Math.round(splitRatio * 100)}%`,
      meta: `Test set ${Math.round((1 - splitRatio) * 100)}%`,
      icon: 'fa-solid fa-scissors',
      tone: 'amber',
    },
    {
      label: 'Model state',
      value: modelReady ? 'Ready' : 'Waiting',
      meta: modelReady ? 'Feature importance + confusion matrix ready' : 'Import metrics JSON to populate results',
      icon: 'fa-solid fa-square-poll-vertical',
      tone: 'slate',
      highlight: true,
    },
  ]

  const modelKpis = [
    { label: 'Trees', value: model?.trees?.length ?? 0, meta: 'Forest size', icon: 'fa-solid fa-tree', tone: 'green' },
    { label: 'Accuracy', value: `${((metrics?.accuracy ?? 0) * 100).toFixed(2)}%`, meta: 'Primary thesis metric', icon: 'fa-solid fa-bullseye', tone: 'green', highlight: true },
    { label: 'Trained on', value: metrics?.trainedOn ?? '—', meta: 'Training rows', icon: 'fa-solid fa-layer-group', tone: 'blue' },
    { label: 'Test rows', value: metrics?.testOn ?? '—', meta: 'Hold-out rows', icon: 'fa-solid fa-flask', tone: 'amber' },
  ]

  return (
    <main className="page-main ml-main" style={styles.main}>
      <section className="ml-hero-shell" style={styles.heroShell}>
        <div>
          <div style={styles.kickerRow}>
            <span style={styles.kicker}>Machine Learning</span>
            <span style={styles.badge}>{sourceLabel}</span>
            {useImportedOnly && <span style={styles.badgeStrong}>Thesis-ready metrics</span>}
          </div>
          <h1 className="page-title" style={styles.title}>Random Forest for pump decision support</h1>
          <p className="page-subtitle" style={styles.subtitle}>
            Use this page to review model performance, import scikit-learn results, and explain which sensor signals drive irrigation decisions.
          </p>
        </div>

        <div style={styles.heroNote}>
          <div style={styles.heroNoteLabel}>Current experiment</div>
          <div style={styles.heroNoteValue}>{modelReady ? `${((metrics?.accuracy ?? 0) * 100).toFixed(2)}% accuracy` : 'No model loaded yet'}</div>
          <div style={styles.heroNoteMeta}>{dataRowCount} rows · split {activeSplitLabel}</div>
        </div>
      </section>

      <section className="ml-stats-grid" style={styles.statsGrid}>
        {overviewKpis.map((item) => (
          <div key={item.label} style={item.highlight ? styles.kpiCardAccent : styles.kpiCard}>
            <div style={styles.kpiTopRow}>
              <div style={{ ...styles.kpiIconWrap, ...(item.tone === 'green' ? styles.kpiIconGreen : item.tone === 'blue' ? styles.kpiIconBlue : item.tone === 'amber' ? styles.kpiIconAmber : styles.kpiIconSlate) }}>
                <i className={item.icon} aria-hidden="true" style={styles.kpiIcon} />
              </div>
              <div style={styles.kpiTag}>{item.label}</div>
            </div>
            <div style={styles.kpiValue}>{item.value}</div>
            <div style={styles.kpiMeta}>{item.meta}</div>
          </div>
        ))}
      </section>

      <div className="ml-workspace-grid" style={styles.workspaceGrid}>
        <section className="ml-panel" style={styles.panel}>
          <div style={styles.panelHeader}>
            <div>
              <h3 style={styles.panelTitle}>Experiment setup</h3>
              <p style={styles.panelText}>Tune the prototype or keep the imported results as the source of truth.</p>
            </div>
            <div style={styles.panelPill}>{useImportedOnly ? 'Imported only' : 'Interactive mode'}</div>
          </div>

          <div style={styles.sliderBlock}>
            <div style={styles.sliderTop}>
              <label style={styles.label}>nEstimators</label>
              <strong style={styles.value}>{nEstimators}</strong>
            </div>
            <input className="ml-range" type="range" min={5} max={200} value={nEstimators} onChange={(e) => setNEstimators(Number(e.target.value))} disabled={useImportedOnly} />
            <div style={styles.sliderHint}>More trees usually smooth the decision boundary, but also increase training cost.</div>
          </div>

          <div style={styles.sliderBlock}>
            <div style={styles.sliderTop}>
              <label style={styles.label}>sampleRatio</label>
              <strong style={styles.value}>{sampleRatio.toFixed(2)}</strong>
            </div>
            <input className="ml-range" type="range" min={0.3} max={1.0} step={0.05} value={sampleRatio} onChange={(e) => setSampleRatio(Number(e.target.value))} disabled={useImportedOnly} />
            <div style={styles.sliderHint}>Controls how much of each tree sees during bootstrap sampling.</div>
          </div>

          <div className="ml-button-row" style={styles.buttonRow}>
            <button onClick={handleTrain} style={styles.primaryBtn} disabled={useImportedOnly}>Train & Evaluate</button>
            <button onClick={() => {
              setModel(null);
              setMetrics(null);
              setConfMat(null);
              setFeatureNamesState(null);
              setCsvRows(null);
              setUseImportedOnly(false);
              try { if (metricsRef.current) metricsRef.current.value = '' } catch (e) {}
              try { if (fileRef.current) fileRef.current.value = '' } catch (e) {}
            }} style={styles.ghostBtn}>Reset</button>
            <button onClick={() => fileRef.current?.click()} style={styles.ghostBtn} disabled={useImportedOnly}>Upload CSV</button>
            <button onClick={downloadSampleCsv} style={styles.ghostBtn} disabled={useImportedOnly}>Download Sample CSV</button>
            <button onClick={() => metricsRef.current?.click()} style={styles.secondaryBtn}>Import metrics JSON</button>
            <input ref={fileRef} type="file" accept="text/csv" style={{ display: 'none' }} onChange={handleCsvUpload} />
            <input ref={metricsRef} type="file" accept="application/json,.json" style={{ display: 'none' }} onChange={handleMetricsUpload} />
          </div>

          <label style={styles.toggleRow}>
            <input type="checkbox" checked={useImportedOnly} onChange={(e) => setUseImportedOnly(Boolean(e.target.checked))} />
            <span>
              <strong>Use imported metrics only</strong>
              <span style={styles.toggleMeta}>Keep this on for thesis screenshots and final reporting.</span>
            </span>
          </label>

          <div className="ml-split-card" style={styles.splitCard}>
            <div>
              <div style={styles.statLabel}>Train/Test split</div>
              <div style={styles.splitValue}>{Math.round(splitRatio * 100)}% / {Math.round((1 - splitRatio) * 100)}%</div>
            </div>
            <input className="ml-range" type="range" min={0.5} max={0.95} step={0.05} value={splitRatio} onChange={(e) => setSplitRatio(Number(e.target.value))} disabled={useImportedOnly} />
          </div>

          <div className="ml-preview-card" style={styles.previewCard}>
            <div style={styles.previewHeader}>
              <div>
                <h4 style={styles.previewTitle}>Dataset preview</h4>
                <p style={styles.previewText}>Quickly verify the row structure before training or importing metrics.</p>
              </div>
            </div>
            <div style={styles.previewWrap}>
              <table style={styles.previewTable}>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>t1</th>
                    <th>t2</th>
                    <th>t3</th>
                    <th>temp</th>
                    <th>hum</th>
                    <th>lux</th>
                    <th>tank</th>
                    <th>label</th>
                  </tr>
                </thead>
                <tbody>
                  {(csvRows ? csvRows.slice(0, 6).map((r) => ({ features: r.features, label: r.label })) : history.slice(-6).reverse().map((h) => ({ features: [h.t1, h.t2, h.t3, parseFloat(h.temp), parseFloat(h.humidity), parseFloat(h.lux), h.tank || 0], label: ((h.t1 + h.t2 + h.t3) / 3) <= 30 ? 'dry' : (((h.t1 + h.t2 + h.t3) / 3) >= 60 ? 'wet' : 'ok') }))).map((r, i) => (
                    <tr key={i}>
                      <td style={{ padding: 6, color: 'var(--slate-500)', fontWeight: 700 }}>{i + 1}</td>
                      {r.features.map((v, j) => <td key={j} style={{ padding: 6 }}>{v}</td>)}
                      <td style={{ padding: 6 }}><span style={styles.labelChip}>{r.label}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="ml-panel" style={styles.panelResults}>
          <div style={styles.panelHeader}>
            <div>
              <h3 style={styles.panelTitle}>Model results</h3>
              <p style={styles.panelText}>This area is optimized for thesis screenshots and clear reporting.</p>
            </div>
            <button onClick={handleExportModel} style={styles.ghostBtn} disabled={!modelReady}>Export model</button>
          </div>

          {modelReady ? (
            <>
              <div className="ml-metric-grid" style={styles.metricGrid}>
                {modelKpis.map((item) => (
                  <div key={item.label} style={item.highlight ? styles.metricCardAccent : styles.metricCard}>
                    <div style={styles.kpiTopRow}>
                      <div style={{ ...styles.kpiIconWrap, ...(item.tone === 'green' ? styles.kpiIconGreen : item.tone === 'blue' ? styles.kpiIconBlue : item.tone === 'amber' ? styles.kpiIconAmber : styles.kpiIconSlate) }}>
                        <i className={item.icon} aria-hidden="true" style={styles.kpiIcon} />
                      </div>
                      <div style={styles.kpiTag}>{item.label}</div>
                    </div>
                    <div style={styles.kpiValue}>{item.value}</div>
                    <div style={styles.kpiMeta}>{item.meta}</div>
                  </div>
                ))}
              </div>

              <div className="ml-chart-card" style={styles.chartCard}>
                <div style={styles.chartHeader}>
                  <div>
                    <h4 style={styles.chartTitle}>Feature importance</h4>
                    <p style={styles.chartText}>Use this to explain which environmental signals most influence pump decisions.</p>
                  </div>
                </div>
                <div style={styles.chartWrap}>
                  <ResponsiveContainer>
                    <BarChart data={displayFeatureNames.map((n, i) => ({ name: n, value: +(model.importance[i] || 0).toFixed(3) }))}>
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} interval={0} angle={-18} textAnchor="end" height={55} />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="value" radius={[10, 10, 0, 0]}>
                        {displayFeatureNames.map((_, i) => <Cell key={i} fill={['#16a34a', '#f59e0b', '#3b82f6', '#06b6d4', '#f97316', '#8b5cf6', '#10b981'][i % 7]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {confMat && (
                <div className="ml-matrix-card" style={styles.matrixCard}>
                  <div style={styles.chartHeader}>
                    <div>
                      <h4 style={styles.chartTitle}>Confusion matrix</h4>
                      <p style={styles.chartText}>Diagonal cells show correct predictions; darker cells indicate larger counts.</p>
                    </div>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={styles.confTable}>
                      <thead>
                        <tr>
                          <th style={styles.confHeader}>Truth \ Pred</th>
                          {confMat.labels.map((l, j) => <th key={j} style={styles.confHeader}>{l}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {confMat.matrix.map((row, i) => (
                          <tr key={i}>
                            <td style={styles.confHeader}>{confMat.labels[i]}</td>
                            {row.map((v, j) => {
                              const max = Math.max(...confMat.matrix.flat()) || 1
                              const intensity = Math.round((v / max) * 220)
                              return <td key={j} style={{ padding: 10, textAlign: 'center', background: `rgb(${255 - intensity}, ${255 - Math.round(intensity * 0.6)}, ${255})`, fontWeight: 700 }}>{v}</td>
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="ml-empty-state" style={styles.emptyState}>
              <div style={styles.emptyIcon}>RF</div>
              <h4 style={styles.emptyTitle}>No model loaded yet</h4>
              <p style={styles.emptyText}>
                Import `metrics.json` for thesis-ready visuals, or switch off imported-only mode and run a quick local training pass.
              </p>
              <div style={styles.emptyActions}>
                <button onClick={() => metricsRef.current?.click()} style={styles.primaryBtn}>Import metrics JSON</button>
                <button onClick={handleTrain} style={styles.ghostBtn} disabled={useImportedOnly}>Train locally</button>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

const styles = {
  main: {
    padding: '1.5rem 2rem 2.5rem',
    maxWidth: 1460,
    margin: '0 auto',
    color: 'var(--slate-900)',
    background: 'radial-gradient(circle at top left, rgba(34,197,94,0.10), transparent 30%), linear-gradient(180deg, rgba(248,250,252,0.92), rgba(255,255,255,0.96))',
  },
  heroShell: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 18,
    alignItems: 'stretch',
    padding: '1.35rem 1.45rem',
    background: 'rgba(255,255,255,0.78)',
    border: '1px solid rgba(15,23,42,0.06)',
    borderRadius: 20,
    boxShadow: '0 18px 40px rgba(15,23,42,0.04)',
    backdropFilter: 'blur(10px)',
    marginBottom: 16,
  },
  kickerRow: { display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 10 },
  kicker: { fontSize: 12, fontWeight: 800, color: 'var(--green-700)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8 },
  title: { fontSize: 34, fontWeight: 900, marginBottom: 8, letterSpacing: '-0.03em', lineHeight: 1.1 },
  subtitle: { fontSize: 14.5, color: 'var(--slate-600)', maxWidth: 760, lineHeight: 1.75 },
  badge: { fontSize: 12, fontWeight: 700, padding: '6px 10px', borderRadius: 999, background: 'rgba(34,197,94,0.10)', color: 'var(--green-800)' },
  badgeStrong: { fontSize: 12, fontWeight: 800, padding: '6px 10px', borderRadius: 999, background: 'rgba(15,23,42,0.08)', color: 'var(--slate-800)' },
  heroNote: { minWidth: 220, maxWidth: 300, padding: '1rem', borderRadius: 16, background: 'linear-gradient(135deg, rgba(22,163,74,0.08), rgba(255,255,255,0.95))', border: '1px solid rgba(22,163,74,0.12)', alignSelf: 'stretch' },
  heroNoteLabel: { fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--green-700)', marginBottom: 10 },
  heroNoteValue: { fontSize: 18, fontWeight: 900, marginBottom: 6 },
  heroNoteMeta: { fontSize: 13, color: 'var(--slate-600)', lineHeight: 1.5 },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12, marginBottom: 16 },
  kpiCard: { background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(15,23,42,0.06)', borderRadius: 18, padding: '1rem', boxShadow: '0 10px 24px rgba(15,23,42,0.03)', position: 'relative', overflow: 'hidden' },
  kpiCardAccent: { background: 'linear-gradient(135deg, rgba(34,197,94,0.16), rgba(255,255,255,0.98))', border: '1px solid rgba(34,197,94,0.14)', borderRadius: 18, padding: '1rem', boxShadow: '0 10px 24px rgba(15,23,42,0.03)', position: 'relative', overflow: 'hidden' },
  kpiTopRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12 },
  kpiIconWrap: { width: 42, height: 42, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  kpiIconGreen: { background: 'rgba(22,163,74,0.12)', color: 'var(--green-700)' },
  kpiIconBlue: { background: 'rgba(59,130,246,0.12)', color: '#2563eb' },
  kpiIconAmber: { background: 'rgba(245,158,11,0.14)', color: '#d97706' },
  kpiIconSlate: { background: 'rgba(15,23,42,0.08)', color: 'var(--slate-700)' },
  kpiIcon: { fontSize: 17 },
  kpiTag: { fontSize: 11, fontWeight: 800, color: 'var(--slate-500)', textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'right' },
  kpiValue: { fontSize: 24, fontWeight: 900, marginBottom: 6, letterSpacing: '-0.03em', lineHeight: 1.1 },
  kpiMeta: { fontSize: 13, color: 'var(--slate-600)', lineHeight: 1.45 },
  workspaceGrid: { display: 'grid', gridTemplateColumns: '1.05fr 1fr', gap: 16, alignItems: 'start' },
  panel: { background: 'rgba(255,255,255,0.95)', border: '1px solid rgba(15,23,42,0.06)', borderRadius: 20, padding: '1.15rem', boxShadow: '0 18px 34px rgba(15,23,42,0.04)' },
  panelResults: { background: 'rgba(255,255,255,0.96)', border: '1px solid rgba(15,23,42,0.06)', borderRadius: 20, padding: '1.15rem', boxShadow: '0 18px 34px rgba(15,23,42,0.04)' },
  panelHeader: { display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', marginBottom: 14 },
  panelTitle: { fontSize: 17, fontWeight: 900, marginBottom: 4 },
  panelText: { fontSize: 13.5, color: 'var(--slate-600)', lineHeight: 1.6 },
  panelPill: { padding: '7px 10px', borderRadius: 999, fontSize: 12, fontWeight: 800, background: 'rgba(15,23,42,0.05)', color: 'var(--slate-700)', whiteSpace: 'nowrap' },
  sliderBlock: { marginTop: 14, padding: '0.95rem', borderRadius: 16, background: 'linear-gradient(180deg, rgba(248,250,252,0.95), rgba(255,255,255,1))', border: '1px solid rgba(15,23,42,0.05)' },
  sliderTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  label: { fontSize: 13, fontWeight: 700, color: 'var(--slate-700)' },
  value: { minWidth: 44, textAlign: 'right', fontWeight: 900, color: 'var(--slate-800)' },
  sliderHint: { marginTop: 8, fontSize: 12.5, color: 'var(--slate-500)', lineHeight: 1.45 },
  buttonRow: { display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 14 },
  primaryBtn: { background: 'linear-gradient(135deg, #16a34a, #22c55e)', color: 'white', border: 'none', padding: '10px 14px', borderRadius: 12, cursor: 'pointer', fontWeight: 800, boxShadow: '0 10px 24px rgba(34,197,94,0.22)' },
  secondaryBtn: { background: 'rgba(22,163,74,0.08)', color: 'var(--green-800)', border: '1px solid rgba(22,163,74,0.16)', padding: '10px 14px', borderRadius: 12, cursor: 'pointer', fontWeight: 800 },
  ghostBtn: { background: 'transparent', border: '1px solid rgba(15,23,42,0.08)', padding: '10px 14px', borderRadius: 12, cursor: 'pointer', fontWeight: 700, color: 'var(--slate-700)' },
  toggleRow: { display: 'flex', gap: 10, alignItems: 'flex-start', marginTop: 14, padding: '0.95rem', borderRadius: 16, background: 'rgba(15,23,42,0.03)', border: '1px solid rgba(15,23,42,0.05)', cursor: 'pointer' },
  toggleMeta: { display: 'block', marginTop: 4, fontSize: 12.5, color: 'var(--slate-500)', lineHeight: 1.45 },
  splitCard: { marginTop: 14, display: 'flex', gap: 12, justifyContent: 'space-between', alignItems: 'center', padding: '0.95rem', borderRadius: 16, border: '1px solid rgba(15,23,42,0.05)', background: 'white' },
  splitValue: { marginTop: 4, fontSize: 18, fontWeight: 900 },
  previewCard: { marginTop: 14, padding: '0.95rem', borderRadius: 16, background: 'white', border: '1px solid rgba(15,23,42,0.06)' },
  previewHeader: { marginBottom: 10 },
  previewTitle: { fontSize: 15, fontWeight: 900, marginBottom: 4 },
  previewText: { fontSize: 13, color: 'var(--slate-600)', lineHeight: 1.6 },
  previewWrap: { maxHeight: 260, overflow: 'auto', borderTop: '1px solid rgba(15,23,42,0.05)', marginTop: 10 },
  previewTable: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  labelChip: { display: 'inline-flex', alignItems: 'center', padding: '5px 8px', borderRadius: 999, background: 'rgba(34,197,94,0.10)', color: 'var(--green-800)', fontWeight: 800, fontSize: 12 },
  metricGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10, marginBottom: 14 },
  metricCard: { background: 'rgba(248,250,252,0.95)', border: '1px solid rgba(15,23,42,0.05)', borderRadius: 18, padding: '1rem', position: 'relative', overflow: 'hidden' },
  metricCardAccent: { background: 'linear-gradient(135deg, rgba(34,197,94,0.12), rgba(248,250,252,0.96))', border: '1px solid rgba(34,197,94,0.12)', borderRadius: 18, padding: '1rem', position: 'relative', overflow: 'hidden' },
  metricLabel: { fontSize: 12, fontWeight: 800, color: 'var(--slate-500)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 },
  metricValue: { fontSize: 22, fontWeight: 900 },
  chartCard: { marginBottom: 14, padding: '1rem', borderRadius: 16, border: '1px solid rgba(15,23,42,0.05)', background: 'white' },
  chartHeader: { marginBottom: 10 },
  chartTitle: { fontSize: 15, fontWeight: 900, marginBottom: 4 },
  chartText: { fontSize: 13, color: 'var(--slate-600)', lineHeight: 1.6 },
  chartWrap: { height: 290 },
  matrixCard: { padding: '1rem', borderRadius: 16, border: '1px solid rgba(15,23,42,0.05)', background: 'white' },
  emptyState: { textAlign: 'center', padding: '2.5rem 1.5rem', borderRadius: 18, background: 'linear-gradient(180deg, rgba(248,250,252,0.95), rgba(255,255,255,1))', border: '1px dashed rgba(34,197,94,0.18)' },
  emptyIcon: { width: 60, height: 60, borderRadius: 18, margin: '0 auto 14px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: 'white', background: 'linear-gradient(135deg, #16a34a, #22c55e)', boxShadow: '0 14px 24px rgba(34,197,94,0.22)' },
  emptyTitle: { fontSize: 18, fontWeight: 900, marginBottom: 8 },
  emptyText: { fontSize: 13.5, color: 'var(--slate-600)', lineHeight: 1.7, maxWidth: 420, margin: '0 auto 16px' },
  emptyActions: { display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 10 },
  confTable: { borderCollapse: 'collapse', width: '100%' },
  confHeader: { padding: 8, background: 'rgba(15,23,42,0.04)', fontWeight: 700 },
}
