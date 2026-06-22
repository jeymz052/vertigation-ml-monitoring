import { useEffect, useMemo, useRef, useState } from 'react'
import { trainRandomForest, predictRF, accuracyScore, confusionMatrix } from '../lib/randomForest'
import {
  trainDecisionTree,
  predictDecisionTree,
  trainLogisticRegression,
  predictLogisticRegression,
} from '../lib/mlModels'
import { clearStoredModelData, loadTrainingRuns, loadTrainedModelSnapshot, saveTrainingRun, saveTrainedModelSnapshot } from '../lib/mlAdvisor'
import { loadPreferredHorizon, savePreferredHorizon } from '../lib/forecastSettings'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, CartesianGrid } from 'recharts'

const FEATURE_NAMES = ['t1', 't2', 't3', 'avg moisture', 'imbalance', 'temp', 'humidity', 'lux', 'tank', 'pump', 'hour sin', 'hour cos']
const CLASS_ORDER = ['dry', 'ok', 'wet']
const TRAIN_FOLDS = 5
const TRAIN_ESTIMATORS = 50
const TRAIN_SAMPLE_RATIO = 0.9
const FORECAST_SAMPLE_INTERVAL_SECONDS = 1
const MIN_FORECAST_TRAIN_ROWS = 120
const MODEL_OPTIONS = [
  { key: 'random_forest', label: 'Random Forest', short: 'RF' },
  { key: 'decision_tree', label: 'Decision Tree', short: 'DT' },
  { key: 'logistic_regression', label: 'Logistic Regression', short: 'LR' },
]
const FORECAST_OPTIONS = [
  { key: '5m', label: '5 minutes', minutes: 5 },
  { key: '10m', label: '10 minutes', minutes: 10 },
  { key: '20m', label: '20 minutes', minutes: 20 },
  { key: '30m', label: '30 minutes', minutes: 30 },
]

function deriveLabel(avg) {
  if (avg <= 30) return 'dry'
  if (avg >= 60) return 'wet'
  return 'ok'
}

function horizonToSteps(minutes) {
  return Math.max(1, Math.round((minutes * 60) / FORECAST_SAMPLE_INTERVAL_SECONDS))
}

function toValidDate(value) {
  const date = value instanceof Date ? value : new Date(value || Date.now())
  return Number.isNaN(date.getTime()) ? new Date() : date
}

function buildFeatureVectorFromRow(row) {
  const t1 = Number(row?.t1) || 0
  const t2 = Number(row?.t2) || 0
  const t3 = Number(row?.t3) || 0
  const temp = Number(row?.temp) || 0
  const humidity = Number(row?.humidity) || 0
  const lux = Number(row?.lux) || 0
  const tank = Number(row?.tank) || 0
  const pump = Number(row?.pump) || 0
  const avgMoisture = (t1 + t2 + t3) / 3
  const imbalance = Math.max(t1, t2, t3) - Math.min(t1, t2, t3)
  const timestamp = toValidDate(row?.timestamp || row?.time)
  const minutesOfDay = (timestamp.getHours() * 60) + timestamp.getMinutes()
  const angle = (minutesOfDay / 1440) * Math.PI * 2
  const hourSin = Math.sin(angle)
  const hourCos = Math.cos(angle)

  return {
    features: [t1, t2, t3, avgMoisture, imbalance, temp, humidity, lux, tank, pump, hourSin, hourCos],
    avgMoisture,
    imbalance,
    timestamp: timestamp.toISOString(),
  }
}

function deriveForecastRowsFromRawHistory(rawHistory) {
  if (!Array.isArray(rawHistory) || !rawHistory.length) return []

  const buckets = new Map()
  rawHistory.forEach((item) => {
    const time = item?.time instanceof Date ? item.time : new Date(item?.time || Date.now())
    if (Number.isNaN(time.getTime())) return
    const bucket = Math.floor(time.getTime() / (FORECAST_SAMPLE_INTERVAL_SECONDS * 1000))
    buckets.set(bucket, item)
  })

  return Array.from(buckets.values())
}

function csvEscape(value) {
  const text = String(value ?? '')
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function formatPreviewTimestamp(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleTimeString('en-PH', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

function formatPreviewValue(value) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return String(value ?? '')
  if (Number.isInteger(numeric)) return String(numeric)
  return numeric.toFixed(2)
}

function buildTimeSeriesSplits(length, k) {
  if (length < 2) return []

  const splits = []
  const baseTrainSize = Math.max(MIN_FORECAST_TRAIN_ROWS, Math.floor(length * 0.5))
  const remaining = Math.max(1, length - baseTrainSize)
  const testWindow = Math.max(1, Math.floor(remaining / k))

  for (let foldIndex = 0; foldIndex < k; foldIndex += 1) {
    const trainEnd = Math.min(length - 1, baseTrainSize + (foldIndex * testWindow))
    const testStart = trainEnd
    const testEnd = foldIndex === k - 1 ? length : Math.min(length, testStart + testWindow)

    if (trainEnd <= 0 || testStart >= testEnd) continue

    splits.push({
      trainStart: 0,
      trainEnd,
      testStart,
      testEnd,
    })
  }

  return splits
}

function majorityLabel(labels) {
  const counts = {}
  labels.forEach((label) => {
    counts[label] = (counts[label] || 0) + 1
  })

  return Object.keys(counts).reduce((best, label) => (counts[label] > (counts[best] || 0) ? label : best), labels[0] || 'ok')
}

function buildConfusionFromPredictions(labels, yTrue, yPred) {
  return confusionMatrix(labels, yTrue, yPred)
}

function trainByModelKey(modelKey, X, y) {
  if (!X.length) return null

  if (modelKey === 'decision_tree') {
    const model = trainDecisionTree(X, y, { maxDepth: 6, minSamplesSplit: 2 })
    return { model, preds: predictDecisionTree(model, X), importance: model.importance }
  }

  if (modelKey === 'logistic_regression') {
    const model = trainLogisticRegression(X, y, { epochs: 500, learningRate: 0.04, l2: 0.0015, patience: 18 })
    return { model, preds: predictLogisticRegression(model, X), importance: model.importance }
  }

  const model = trainRandomForest(X, y, {
    nEstimators: TRAIN_ESTIMATORS,
    sampleRatio: TRAIN_SAMPLE_RATIO,
    maxDepth: 5,
    minSamplesSplit: 3,
    featureRatio: Math.sqrt(X[0]?.length || 0),
  })
  return { model, preds: predictRF(model, X), importance: model.importance }
}

function trainTierModelsByKey(modelKey, rows) {
  if (!rows.length) return null

  const X = rows.map((row) => row.features)
  const tier1 = trainByModelKey(modelKey, X, rows.map((row) => row.targetTier1Label))?.model ?? null
  const tier2 = trainByModelKey(modelKey, X, rows.map((row) => row.targetTier2Label))?.model ?? null
  const tier3 = trainByModelKey(modelKey, X, rows.map((row) => row.targetTier3Label))?.model ?? null

  return { t1: tier1, t2: tier2, t3: tier3 }
}

function evaluateModelByKey(modelKey, X, y) {
  if (!X.length) return null

  const k = Math.min(TRAIN_FOLDS, X.length)
  const folds = buildTimeSeriesSplits(X.length, k)
  const oofPreds = new Array(y.length).fill(null)

  for (let foldIndex = 0; foldIndex < folds.length; foldIndex += 1) {
    const fold = folds[foldIndex]
    const trainX = X.slice(fold.trainStart, fold.trainEnd)
    const trainY = y.slice(fold.trainStart, fold.trainEnd)
    const testX = X.slice(fold.testStart, fold.testEnd)
    const testOrder = Array.from({ length: fold.testEnd - fold.testStart }, (_, index) => fold.testStart + index)

    if (!trainX.length || !testX.length) continue

    const trained = trainByModelKey(modelKey, trainX, trainY)
    const foldPreds = modelKey === 'decision_tree'
      ? predictDecisionTree(trained.model, testX)
      : modelKey === 'logistic_regression'
        ? predictLogisticRegression(trained.model, testX)
        : predictRF(trained.model, testX)

    foldPreds.forEach((pred, i) => {
      oofPreds[testOrder[i]] = pred
    })
  }

  const filledPreds = oofPreds.map((pred) => pred ?? majorityLabel(y))
  const accuracy = accuracyScore(y, filledPreds)
  const labels = Array.from(new Set([...CLASS_ORDER, ...y, ...filledPreds]))
  const confusion = buildConfusionFromPredictions(labels, y, filledPreds)
  const finalModel = trainByModelKey(modelKey, X, y)

  return {
    model: finalModel.model,
    accuracy,
    predictions: filledPreds,
    confusion,
    labels,
    importance: finalModel.importance,
    validationType: 'Time-aware forward validation',
  }
}

export default function MachineLearningPage({ history = [], forecastHistory = [], clearHistory }) {
  const savedSnapshot = useMemo(() => loadTrainedModelSnapshot(), [])
  const [selectedModel, setSelectedModel] = useState(savedSnapshot?.modelKey || 'random_forest')
  const [selectedHorizon, setSelectedHorizon] = useState(() => loadPreferredHorizon(savedSnapshot?.horizonKey || '10m'))
  const [model, setModel] = useState(savedSnapshot?.model ?? null)
  const [metrics, setMetrics] = useState(savedSnapshot ? {
    accuracy: savedSnapshot.accuracy ?? null,
    baseline: savedSnapshot.baseline ?? null,
    trainedOn: savedSnapshot.trainedOn ?? null,
    testOn: savedSnapshot.trainedOn ?? null,
    folds: savedSnapshot.folds ?? null,
    estimators: savedSnapshot.modelKey === 'random_forest' ? TRAIN_ESTIMATORS : '—',
    modelLabel: savedSnapshot.label ?? 'Model',
    validationType: savedSnapshot.validationType ?? 'Time-aware forward validation',
  } : null)
  const [confMat, setConfMat] = useState(null)
  const [comparison, setComparison] = useState(null)
  const [dialog, setDialog] = useState(null)
  const [csvRows, setCsvRows] = useState(null)
  const [uploadedFileName, setUploadedFileName] = useState('')
  const [trainNote, setTrainNote] = useState(
    savedSnapshot
      ? `Loaded saved ${savedSnapshot.label} forecast for ${savedSnapshot.horizonLabel || 'selected horizon'}`
      : 'Ready to train'
  )
  const [trainingRuns, setTrainingRuns] = useState(() => loadTrainingRuns())
  const fileRef = useRef(null)
  const hasAnySavedHistory = history.length > 0 || forecastHistory.length > 0 || trainingRuns.length > 0 || Boolean(savedSnapshot)

  const sampledHistorySource = useMemo(() => {
    return forecastHistory.length ? forecastHistory : deriveForecastRowsFromRawHistory(history)
  }, [forecastHistory, history])

  const historyRows = useMemo(() => {
    return sampledHistorySource.map((h) => {
      const t1 = Number(h.t1) || 0
      const t2 = Number(h.t2) || 0
      const t3 = Number(h.t3) || 0
      const temp = Number.parseFloat(h.temp) || 0
      const humidity = Number.parseFloat(h.humidity) || 0
      const lux = Number.parseFloat(h.lux) || 0
      const tank = Number(h.tank) || 0
      const pump = Number(h.pump) || 0
      const timestamp = h.time ? new Date(h.time).toISOString() : new Date().toISOString()
      const engineered = buildFeatureVectorFromRow({ t1, t2, t3, temp, humidity, lux, tank, pump, timestamp })

      return {
        timestamp,
        features: engineered.features,
        label: deriveLabel(engineered.avgMoisture),
        t1,
        t2,
        t3,
        temp,
        humidity,
        lux,
        tank,
        pump,
        avgMoisture: engineered.avgMoisture,
        imbalance: engineered.imbalance,
      }
    })
  }, [sampledHistorySource])

  const activeRows = csvRows || historyRows
  const modelReady = Boolean(model)
  const dataSourceLabel = csvRows ? 'Uploaded CSV' : 'Saved sensor history'
  const forecastOptions = useMemo(() => {
    return FORECAST_OPTIONS.map((option) => {
      const steps = horizonToSteps(option.minutes)
      const maxRows = Math.max(0, activeRows.length - steps)
      const available = maxRows >= MIN_FORECAST_TRAIN_ROWS
      const requiredRows = steps + MIN_FORECAST_TRAIN_ROWS
      const missingRows = Math.max(0, requiredRows - activeRows.length)
      return {
        ...option,
        steps,
        available,
        usableRows: maxRows,
        requiredRows,
        missingRows,
      }
    })
  }, [activeRows.length])

  const selectedForecastOption = forecastOptions.find((option) => option.key === selectedHorizon) ?? forecastOptions[0]
  const firstAvailableForecast = forecastOptions.find((option) => option.available) ?? null

  useEffect(() => {
    savePreferredHorizon(selectedHorizon)
  }, [selectedHorizon])

  useEffect(() => {
    if (selectedForecastOption?.available) return
    if (!firstAvailableForecast) return
    setSelectedHorizon(firstAvailableForecast.key)
  }, [selectedForecastOption, firstAvailableForecast])

  const dataset = useMemo(() => {
    const shift = selectedForecastOption.steps
    if (activeRows.length <= shift) {
      return { X: [], y: [], rows: [] }
    }

    const rows = activeRows.slice(0, activeRows.length - shift).map((row, index) => {
      const futureRow = activeRows[index + shift]
      return {
        ...row,
        targetLabel: futureRow.label,
        targetTier1Label: deriveLabel(Number(futureRow.t1) || 0),
        targetTier2Label: deriveLabel(Number(futureRow.t2) || 0),
        targetTier3Label: deriveLabel(Number(futureRow.t3) || 0),
        targetTimestamp: futureRow.timestamp,
      }
    })

    return {
      X: rows.map((row) => row.features),
      y: rows.map((row) => row.targetLabel),
      rows,
    }
  }, [activeRows, selectedForecastOption])

  const previewRows = useMemo(() => {
    if (dataset.rows.length) {
      return dataset.rows.slice(0, 5)
    }

    return activeRows.slice(0, 5).map((row) => ({
      ...row,
      targetLabel: row.label,
      targetTimestamp: row.timestamp,
    }))
  }, [activeRows, dataset.rows])

  const labelDistribution = useMemo(() => {
    const counts = { dry: 0, ok: 0, wet: 0 }
    dataset.rows.forEach((row) => {
      counts[row.targetLabel] = (counts[row.targetLabel] || 0) + 1
    })
    return CLASS_ORDER.map((label) => ({ label, value: counts[label] || 0 }))
  }, [dataset.rows])

  const modelImportance = useMemo(() => {
    if (!model?.importance) {
      return FEATURE_NAMES.map((name) => ({ name, value: 0 }))
    }

    return FEATURE_NAMES.map((name, index) => ({
      name,
      value: +(model.importance[index] || 0).toFixed(3),
    }))
  }, [model])

  function handleTrain() {
    if (!selectedForecastOption.available || !dataset.X.length) {
      alert(`Not enough rows to forecast ${selectedForecastOption.label}. Collect more data or choose a shorter horizon.`)
      return
    }

    const result = evaluateModelByKey(selectedModel, dataset.X, dataset.y)
    if (!result) {
      alert('Training failed because the dataset is too small.')
      return
    }

    const baseline = accuracyScore(dataset.y, new Array(dataset.y.length).fill(majorityLabel(dataset.y)))
    const modelLabel = MODEL_OPTIONS.find((m) => m.key === selectedModel)?.label ?? 'Model'
    const tierModels = trainTierModelsByKey(selectedModel, dataset.rows)
    setModel(result.model)
    setMetrics({
      accuracy: result.accuracy,
      baseline,
      trainedOn: dataset.X.length,
      testOn: dataset.y.length,
      folds: Math.min(TRAIN_FOLDS, dataset.X.length),
      estimators: selectedModel === 'random_forest' ? TRAIN_ESTIMATORS : '—',
      modelLabel,
      validationType: result.validationType,
    })
    setConfMat(result.confusion)
    setComparison(null)
    saveTrainedModelSnapshot({
      modelKey: selectedModel,
      label: modelLabel,
      model: result.model,
      tierModels,
      accuracy: result.accuracy,
      baseline,
      trainedOn: dataset.X.length,
      folds: Math.min(TRAIN_FOLDS, dataset.X.length),
      horizonKey: selectedForecastOption.key,
      horizonLabel: selectedForecastOption.label,
      horizonMinutes: selectedForecastOption.minutes,
      featureCount: FEATURE_NAMES.length,
      featureNames: FEATURE_NAMES,
      validationType: result.validationType,
      trainedAt: new Date().toISOString(),
    })
    const run = {
      modelKey: selectedModel,
      label: modelLabel,
      accuracy: result.accuracy,
      baseline,
      tierModels,
      trainedOn: dataset.X.length,
      folds: Math.min(TRAIN_FOLDS, dataset.X.length),
      horizonKey: selectedForecastOption.key,
      horizonLabel: selectedForecastOption.label,
      horizonMinutes: selectedForecastOption.minutes,
      featureCount: FEATURE_NAMES.length,
      featureNames: FEATURE_NAMES,
      validationType: result.validationType,
      trainedAt: new Date().toISOString(),
    }
    saveTrainingRun(run)
    setTrainingRuns(loadTrainingRuns())
    setTrainNote(`Trained ${modelLabel} to forecast ${selectedForecastOption.label} ahead using ${dataset.X.length} rows with time-aware forward validation`)
    setDialog(null)
  }

  function handleCompareAll() {
    if (!selectedForecastOption.available || !dataset.X.length) {
      alert(`Not enough rows to forecast ${selectedForecastOption.label}. Collect more data or choose a shorter horizon.`)
      return
    }

    const baseline = accuracyScore(dataset.y, new Array(dataset.y.length).fill(majorityLabel(dataset.y)))
    const results = MODEL_OPTIONS.map((option) => {
      const evaluated = evaluateModelByKey(option.key, dataset.X, dataset.y)
      return {
        ...option,
        accuracy: evaluated?.accuracy ?? 0,
        confusion: evaluated?.confusion ?? null,
        model: evaluated?.model ?? null,
        importance: evaluated?.importance ?? [],
        validationType: evaluated?.validationType ?? 'Time-aware forward validation',
      }
    })

    const best = results.slice().sort((a, b) => b.accuracy - a.accuracy)[0]
    setComparison(results)
    setSelectedModel(best?.key ?? selectedModel)
    if (best?.model) {
      const tierModels = trainTierModelsByKey(best.key, dataset.rows)
      setModel(best.model)
      setMetrics({
        accuracy: best.accuracy,
        baseline,
        trainedOn: dataset.X.length,
        testOn: dataset.y.length,
        folds: Math.min(TRAIN_FOLDS, dataset.X.length),
        estimators: best.key === 'random_forest' ? TRAIN_ESTIMATORS : '—',
        modelLabel: best.label,
        validationType: best.validationType,
      })
      setConfMat(best.confusion)
      saveTrainedModelSnapshot({
        modelKey: best.key,
        label: best.label,
        model: best.model,
        tierModels,
        accuracy: best.accuracy,
        baseline,
        trainedOn: dataset.X.length,
        folds: Math.min(TRAIN_FOLDS, dataset.X.length),
        horizonKey: selectedForecastOption.key,
        horizonLabel: selectedForecastOption.label,
        horizonMinutes: selectedForecastOption.minutes,
        featureCount: FEATURE_NAMES.length,
        featureNames: FEATURE_NAMES,
        validationType: best.validationType,
        trainedAt: new Date().toISOString(),
      })
      const run = {
        modelKey: best.key,
        label: best.label,
        accuracy: best.accuracy,
        baseline,
        tierModels,
        trainedOn: dataset.X.length,
        folds: Math.min(TRAIN_FOLDS, dataset.X.length),
        horizonKey: selectedForecastOption.key,
        horizonLabel: selectedForecastOption.label,
        horizonMinutes: selectedForecastOption.minutes,
        featureCount: FEATURE_NAMES.length,
        featureNames: FEATURE_NAMES,
        validationType: best.validationType,
        trainedAt: new Date().toISOString(),
      }
      saveTrainingRun(run)
      setTrainingRuns(loadTrainingRuns())
      setTrainNote(`Compared ${MODEL_OPTIONS.length} models for ${selectedForecastOption.label} forecasting with time-aware forward validation. Best result: ${best.label}`)
    }
    setDialog(null)
  }

  function handleCsvUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      const text = String(reader.result || '')
      const rows = text.split(/\r?\n/).map((r) => r.trim()).filter(Boolean)

      if (rows.length < 2) {
        alert('CSV loaded, but no data rows were found.')
        return
      }

      const header = rows[0].split(',').map((h) => h.trim().toLowerCase())
      const data = rows.slice(1).map((line) => {
        const cols = line.split(',').map((c) => c.trim())
        const map = Object.fromEntries(header.map((h, i) => [h, cols[i] ?? '']))
        const t1 = Number(map.t1) || 0
        const t2 = Number(map.t2) || 0
        const t3 = Number(map.t3) || 0
        const temp = Number(map.temp) || 0
        const humidity = Number(map.humidity) || 0
        const lux = Number(map.lux) || 0
        const tank = Number(map.tank || 0)
        const pump = Number(map.pump || 0)
        const timestamp = map.timestamp || new Date().toISOString()
        const engineered = buildFeatureVectorFromRow({ t1, t2, t3, temp, humidity, lux, tank, pump, timestamp })
        const label = map.label || map.target || deriveLabel(engineered.avgMoisture)

        return {
          timestamp,
          features: engineered.features,
          label,
          t1,
          t2,
          t3,
          temp,
          humidity,
          lux,
          tank,
          pump,
          avgMoisture: engineered.avgMoisture,
          imbalance: engineered.imbalance,
        }
      })

      setCsvRows(data)
      setUploadedFileName(file.name)
      setTrainNote(`CSV loaded: ${file.name}`)
      try {
        if (fileRef.current) fileRef.current.value = ''
      } catch {}
    }
    reader.readAsText(file)
  }

  function exportLiveCsv() {
    if (!historyRows.length) {
      alert('No saved sensor readings available yet.')
      return
    }

    const header = 'timestamp,t1,t2,t3,temp,humidity,lux,tank,pump,label'
    const rows = historyRows.map((row) =>
      [
        csvEscape(row.timestamp),
        row.t1,
        row.t2,
        row.t3,
        row.temp,
        row.humidity,
        row.lux,
        row.tank,
        row.pump,
        csvEscape(row.label),
      ].join(',')
    )

    downloadFile('sensor_readings.csv', [header, ...rows].join('\n'), 'text/csv')
  }

  function exportModel() {
    if (!model) return alert('Train a model first.')
    downloadFile(`trained-model-${selectedModel}.json`, JSON.stringify(model, null, 2), 'application/json')
  }

  function resetPage() {
    clearStoredModelData()
    setModel(null)
    setMetrics(null)
    setConfMat(null)
    setComparison(null)
    setDialog(null)
    setCsvRows(null)
    setUploadedFileName('')
    setTrainingRuns([])
    setTrainNote('Ready to train')
    try {
      if (fileRef.current) fileRef.current.value = ''
    } catch {}
  }

  function clearSavedSensorHistory() {
    clearHistory?.()
    clearStoredModelData()
    setTrainingRuns([])
    resetPage()
  }

  function openTrainDialog() {
    if (!selectedForecastOption.available || !dataset.X.length) {
      setDialog({
        type: 'info',
        title: 'Forecast horizon not ready',
        message: `There are not enough rows yet to forecast ${selectedForecastOption.label}.`,
        detail: 'Collect more live data or choose a shorter forecast horizon.',
        actionLabel: 'Close',
      })
      return
    }

    setDialog({
      type: 'confirm',
      title: `Train ${selectedModelOption.label}?`,
      message: `This will train ${selectedModelOption.label} to forecast the soil state ${selectedForecastOption.label} ahead using ${dataset.X.length} rows.`,
      detail: 'The result will replace the current single-model output and update the thesis visuals below.',
      actionLabel: 'Train now',
      onConfirm: handleTrain,
    })
  }

  function openCompareDialog() {
    if (!selectedForecastOption.available || !dataset.X.length) {
      setDialog({
        type: 'info',
        title: 'Forecast horizon not ready',
        message: `There are not enough rows yet to forecast ${selectedForecastOption.label}.`,
        detail: 'Collect more live data or choose a shorter forecast horizon.',
        actionLabel: 'Close',
      })
      return
    }

    setDialog({
      type: 'confirm',
      title: 'Compare all three models?',
      message: `This runs Random Forest, Decision Tree, and Logistic Regression on the same dataset to forecast ${selectedForecastOption.label} ahead.`,
      detail: 'Use this to defend which model is best for future soil-state prediction.',
      actionLabel: 'Run comparison',
      onConfirm: handleCompareAll,
    })
  }

  function openClearDialog() {
    if (!hasAnySavedHistory) {
      setDialog({
        type: 'info',
        title: 'No saved history',
        message: 'There are no saved sensor readings in this browser to clear.',
        actionLabel: 'Close',
      })
      return
    }

    setDialog({
      type: 'confirm',
      title: 'Clear saved sensor history?',
      message: 'This removes the saved raw history, forecast history, trained forecasts, and training runs from this browser.',
      detail: 'Use this when you want to fully reset the ML page for a fresh experiment.',
      actionLabel: 'Clear history',
      tone: 'danger',
      onConfirm: clearSavedSensorHistory,
    })
  }

  const dataRowsCount = dataset.rows.length
  const liveRowCount = historyRows.length
  const baselineText = metrics ? `${(metrics.baseline * 100).toFixed(2)}%` : '—'
  const accuracyText = metrics ? `${(metrics.accuracy * 100).toFixed(2)}%` : '—'
  const selectedModelOption = MODEL_OPTIONS.find((m) => m.key === selectedModel) ?? MODEL_OPTIONS[0]
  const activeModelLabel = metrics?.modelLabel ?? selectedModelOption.label

  const overviewCards = [
    { label: 'Data source', value: dataSourceLabel, meta: uploadedFileName || `Saved live rows: ${liveRowCount}`, icon: 'fa-solid fa-database', tone: 'blue' },
    { label: 'Forecast horizon', value: selectedForecastOption.label, meta: `Needs ${selectedForecastOption.requiredRows} rows total`, icon: 'fa-solid fa-hourglass-half', tone: 'green' },
    { label: 'Live row counter', value: `${liveRowCount}`, meta: 'Adds about 1 row every second while the dashboard is open', icon: 'fa-solid fa-wave-square', tone: 'blue' },
    { label: 'Accuracy', value: accuracyText, meta: `Baseline ${baselineText}`, icon: 'fa-solid fa-bullseye', tone: 'amber' },
    { label: 'Training', value: modelReady ? 'Complete' : 'Not trained', meta: metrics?.validationType || trainNote, icon: 'fa-solid fa-brain', tone: 'slate' },
  ]

  const modelCards = [
    { label: 'Model', value: activeModelLabel, meta: 'Currently trained model' },
    { label: 'Trees', value: model?.trees?.length ?? 'â€”', meta: selectedModel === 'random_forest' ? `Fixed ${TRAIN_ESTIMATORS} estimators` : 'Not applicable' },
    { label: 'Folds', value: metrics?.folds ?? '—', meta: metrics?.validationType || 'Cross-validation' },
    { label: 'Train rows', value: metrics?.trainedOn ?? '—', meta: 'Dataset size' },
    { label: 'Test rows', value: metrics?.testOn ?? '—', meta: 'Evaluated rows' },
  ]

  return (
    <main className="page-main ml-main" style={styles.main}>
      <section className="ml-hero-shell" style={styles.hero}>
        <div>
          <div style={styles.kickerRow}>
            <span style={styles.kicker}>Machine Learning</span>
            <span style={styles.badge}>{dataSourceLabel}</span>
            <span style={styles.badgeStrong}>Thesis workflow</span>
          </div>
          <h1 className="page-title" style={styles.title}>Machine learning for future soil-state forecasting</h1>
          <p className="page-subtitle" style={styles.subtitle}>
            This page forecasts whether the soil will be dry, okay, or wet after a selected future horizon using the current sensor values and a 1-second sampled forecast history.
          </p>
          <div style={styles.heroPills}>
            <span style={styles.heroPill}><i className="fa-solid fa-circle-check" /> Live or CSV input</span>
            <span style={styles.heroPill}><i className="fa-solid fa-circle-check" /> Future horizon labels</span>
            <span style={styles.heroPill}><i className="fa-solid fa-circle-check" /> Accuracy, balance, importance</span>
          </div>
        </div>

        <div style={styles.heroNote}>
          <div style={styles.heroNoteLabel}>Status</div>
          <div style={styles.heroNoteValue}>{modelReady ? `${accuracyText} accuracy` : 'No model trained yet'}</div>
          <div style={styles.heroNoteMeta}>
            {dataRowsCount} usable rows for {selectedForecastOption.label} forecasting from {liveRowCount} saved live rows.
            {' '}Needs {selectedForecastOption.requiredRows} total rows{selectedForecastOption.missingRows ? `, ${selectedForecastOption.missingRows} more needed` : ', ready to train'}.
          </div>
        </div>
      </section>

      <section className="ml-stats-grid" style={styles.grid4Small}>
        {overviewCards.map((item) => (
          <div key={item.label} style={styles.card}>
            <div style={{ ...styles.cardAccent, ...(item.tone === 'green' ? styles.cardAccentGreen : item.tone === 'amber' ? styles.cardAccentAmber : item.tone === 'slate' ? styles.cardAccentSlate : styles.cardAccentBlue) }} />
            <div style={styles.cardTop}>
              <span style={{ ...styles.cardIconWrap, ...(item.tone === 'green' ? styles.cardIconGreen : item.tone === 'amber' ? styles.cardIconAmber : item.tone === 'slate' ? styles.cardIconSlate : styles.cardIconBlue) }}>
                <i className={item.icon} aria-hidden="true" style={styles.cardIcon} />
              </span>
            </div>
            <div style={styles.cardLabel}>{item.label}</div>
            <div style={styles.cardValue}>{item.value}</div>
            <div style={styles.cardMeta}>{item.meta}</div>
          </div>
        ))}
      </section>

      <section style={styles.workspace}>
        <div className="ml-panel" style={styles.panel}>
          <div style={styles.panelHeader}>
            <div>
              <h3 style={styles.panelTitle}>Training and data</h3>
              <p style={styles.panelText}>Choose a forecast horizon first, then train one of the three models to predict the future soil state from the current sensor row using the 1-second sampled forecast dataset.</p>
            </div>
            <div style={styles.panelPill}>{selectedModelOption.label} · {selectedForecastOption.label} forecast · time-aware validation</div>
          </div>

          <div style={styles.modelHint}>
            Select a horizon, then choose one model or compare all three. Forecasting now uses engineered sensor features plus time-of-day signals, and evaluation uses time-aware forward validation to better match real forecasting.
          </div>

          <div style={styles.modelHint}>
            Live row counter: <strong>{liveRowCount}</strong> saved rows. This should increase by about 1 every second while this website stays open and connected to Blynk.
          </div>

          <div style={styles.modelHint}>
            Formula: <strong>required rows = forecast seconds + {MIN_FORECAST_TRAIN_ROWS} minimum training rows</strong>. For {selectedForecastOption.label}, that means <strong>{selectedForecastOption.requiredRows}</strong> total rows.
          </div>

          {!historyRows.length && modelReady && (
            <div style={styles.modelHint}>
              A saved trained model is loaded, but the current forecast dataset is still empty. Leave the dashboard open a bit longer so new sampled forecast rows can accumulate.
            </div>
          )}

          <div style={styles.horizonPicker}>
            {forecastOptions.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setSelectedHorizon(option.key)}
                disabled={!option.available}
                style={{
                  ...styles.horizonChip,
                  ...(selectedHorizon === option.key ? styles.horizonChipActive : null),
                  ...(!option.available ? styles.horizonChipDisabled : null),
                }}
              >
                <span>{option.label}</span>
                <small style={styles.horizonMeta}>
                  {option.available
                    ? `${option.usableRows} usable rows • ready`
                    : `Needs ${option.requiredRows} rows • ${option.missingRows} more`}
                </small>
              </button>
            ))}
          </div>

          <div style={styles.modelPicker}>
            {MODEL_OPTIONS.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setSelectedModel(option.key)}
                style={{
                  ...styles.modelChip,
                  ...(selectedModel === option.key ? styles.modelChipActive : null),
                }}
              >
                <span style={styles.modelChipShort}>{option.short}</span>
                <span>{option.label}</span>
              </button>
            ))}
          </div>

          <div className="ml-button-row" style={styles.buttonRow}>
            <button onClick={openTrainDialog} style={styles.primaryBtn}>Train & Evaluate</button>
            <button onClick={openCompareDialog} style={styles.secondaryBtn}>Compare All Models</button>
            <button onClick={resetPage} style={styles.ghostBtn}>Reset page</button>
            <button onClick={exportLiveCsv} style={styles.ghostBtn} disabled={!historyRows.length}>Export Sensor CSV</button>
            <button onClick={() => fileRef.current?.click()} style={styles.ghostBtn}>Upload CSV</button>
            <button onClick={exportModel} style={styles.secondaryBtn} disabled={!modelReady}>Export model</button>
            <button onClick={openClearDialog} style={styles.dangerBtn} disabled={!hasAnySavedHistory}>Clear saved history</button>
            <input ref={fileRef} type="file" accept="text/csv" style={{ display: 'none' }} onChange={handleCsvUpload} />
          </div>

          {csvRows && (
            <div style={styles.uploadNotice}>
              Loaded <strong>{csvRows.length}</strong> CSV rows
              {uploadedFileName ? ` from ${uploadedFileName}` : ''}
            </div>
          )}

          <div className="ml-preview-card" style={styles.previewCard}>
            <div style={styles.sectionHead}>
              <div>
                <h4 style={styles.sectionTitle}>Dataset preview</h4>
                <p style={styles.sectionText}>
                  {dataset.rows.length
                    ? 'This is the data used for training. Each target label is taken from a future row at the selected forecast horizon.'
                    : 'Forecast training is not ready yet, so this preview shows the first 5 collected sensor rows.'}
                </p>
              </div>
            </div>
            <div style={styles.columnNote}>
              Columns: <strong>#</strong>, <strong>current time</strong>, <strong>target time</strong>, <strong>{FEATURE_NAMES.join(', ')}</strong>, <strong>future label</strong>
            </div>

            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.tableHeadIndex}>#</th>
                    <th style={styles.tableHeadTime}>current time</th>
                    <th style={styles.tableHeadTime}>target time</th>
                    {FEATURE_NAMES.map((name) => (
                      <th key={name} style={styles.tableHead}>{name}</th>
                    ))}
                    <th style={styles.tableHeadLabel}>future label</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, idx) => (
                    <tr key={`${row.timestamp}-${idx}`}>
                      <td style={styles.tableIndex}>{idx + 1}</td>
                      <td style={styles.tableTimeCell}>{formatPreviewTimestamp(row.timestamp)}</td>
                      <td style={styles.tableTimeCell}>{formatPreviewTimestamp(row.targetTimestamp)}</td>
                      {row.features.map((value, j) => (
                        <td key={j} style={styles.tableCell} title={String(value)}>
                          {formatPreviewValue(value)}
                        </td>
                      ))}
                      <td style={styles.tableLabelCell}><span style={styles.labelChip}>{row.targetLabel}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="ml-panel" style={styles.panel}>
          <div style={styles.panelHeader}>
            <div>
              <h3 style={styles.panelTitle}>Model results</h3>
              <p style={styles.panelText}>This section is for thesis defense: accuracy, baseline comparison, feature importance, and confusion matrix.</p>
            </div>
          </div>

          {modelReady ? (
            <>
              <section className="ml-metric-grid" style={styles.grid4Small}>
                {modelCards.map((item) => (
                  <div key={item.label} style={styles.metricCard}>
                    <div style={styles.cardLabel}>{item.label}</div>
                    <div style={styles.cardValue}>{item.value}</div>
                    <div style={styles.cardMeta}>{item.meta}</div>
                  </div>
                ))}
              </section>

              {comparison && (
                <div style={styles.comparisonCard}>
                  <div style={styles.sectionHead}>
                    <div>
                      <h4 style={styles.sectionTitle}>Model comparison</h4>
                      <p style={styles.sectionText}>Direct comparison of the three trained models on the same dataset and the same time-aware forward validation setup.</p>
                    </div>
                  </div>
                  <div style={styles.comparisonNote}>
                    The bar chart below shows the accuracy of each model side by side. The highlighted tile marks the current best model.
                  </div>
                  <div style={styles.comparisonChartWrap}>
                    <ResponsiveContainer>
                      <BarChart
                        data={comparison.map((item) => ({
                          name: item.label,
                          accuracy: item.accuracy,
                        }))}
                        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,23,42,0.06)" />
                        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                        <YAxis domain={[0, 1]} tickFormatter={(v) => `${Math.round(v * 100)}%`} />
                        <Tooltip formatter={(v) => `${(Number(v) * 100).toFixed(2)}%`} />
                        <Bar dataKey="accuracy" radius={[10, 10, 0, 0]}>
                          {comparison.map((item) => (
                            <Cell
                              key={item.key}
                              fill={
                                item.key === selectedModel
                                  ? '#16a34a'
                                  : item.key === 'decision_tree'
                                    ? '#f59e0b'
                                    : '#3b82f6'
                              }
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={styles.comparisonGrid}>
                    {comparison.map((item) => (
                      <div key={item.key} style={item.key === selectedModel ? styles.comparisonItemActive : styles.comparisonItem}>
                        <div style={styles.comparisonName}>{item.label}</div>
                        <div style={styles.comparisonValue}>{(item.accuracy * 100).toFixed(2)}%</div>
                        <div style={styles.comparisonSub}>{item.key === selectedModel ? 'Active' : 'Compared'}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="ml-workspace-grid" style={styles.visualsGrid}>
                <div className="ml-chart-card" style={styles.chartCard}>
                  <div style={styles.sectionHead}>
                    <div>
                      <h4 style={styles.sectionTitle}>Accuracy vs baseline</h4>
                      <p style={styles.sectionText}>Shows whether the model performs better than always guessing the most common class.</p>
                    </div>
                  </div>
                  <div style={styles.chartWrapSmall}>
                    <ResponsiveContainer>
                      <BarChart
                        data={[
                          { name: 'Baseline', value: metrics?.baseline ?? 0 },
                          { name: activeModelLabel, value: metrics?.accuracy ?? 0 },
                        ]}
                        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,23,42,0.06)" />
                        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                        <YAxis domain={[0, 1]} tickFormatter={(v) => `${Math.round(v * 100)}%`} />
                        <Tooltip formatter={(v) => `${(Number(v) * 100).toFixed(2)}%`} />
                        <Bar dataKey="value" radius={[10, 10, 0, 0]}>
                          <Cell fill="#94a3b8" />
                          <Cell fill="#16a34a" />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="ml-chart-card" style={styles.chartCard}>
                  <div style={styles.sectionHead}>
                    <div>
                      <h4 style={styles.sectionTitle}>Class distribution</h4>
                      <p style={styles.sectionText}>Shows whether the training data is balanced across dry, ok, and wet classes.</p>
                    </div>
                  </div>
                  <div style={styles.chartWrapSmall}>
                    <ResponsiveContainer>
                      <BarChart data={labelDistribution} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,23,42,0.06)" />
                        <XAxis dataKey="label" />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Bar dataKey="value" radius={[10, 10, 0, 0]}>
                          {labelDistribution.map((_, i) => (
                            <Cell key={i} fill={['#f59e0b', '#64748b', '#3b82f6'][i % 3]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              <div style={styles.chartCard}>
                <div style={styles.sectionHead}>
                  <div>
                    <h4 style={styles.sectionTitle}>Feature importance</h4>
                    <p style={styles.sectionText}>Highlights which sensors influence the irrigation decision most in the trained model.</p>
                  </div>
                </div>
                <div style={styles.chartWrap}>
                  <ResponsiveContainer>
                    <BarChart data={modelImportance} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,23,42,0.06)" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} interval={0} angle={-18} textAnchor="end" height={55} />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="value" radius={[10, 10, 0, 0]}>
                        {modelImportance.map((_, i) => (
                          <Cell key={i} fill={['#16a34a', '#f59e0b', '#3b82f6', '#06b6d4', '#f97316', '#8b5cf6', '#10b981'][i % 7]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {confMat && (
                <div style={styles.matrixCard}>
                  <div style={styles.sectionHead}>
                    <div>
                      <h4 style={styles.sectionTitle}>Confusion matrix</h4>
                      <p style={styles.sectionText}>Diagonal cells are correct predictions. Off-diagonal values show misclassification.</p>
                    </div>
                  </div>

                  <div style={styles.matrixWrap}>
                    <table style={styles.matrixTable}>
                      <thead>
                        <tr>
                          <th style={styles.matrixHead}>Truth / Pred</th>
                          {confMat.labels.map((label) => (
                            <th key={label} style={styles.matrixHead}>{label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {confMat.matrix.map((row, i) => {
                          const max = Math.max(...confMat.matrix.flat()) || 1
                          return (
                            <tr key={confMat.labels[i] ?? i}>
                              <td style={styles.matrixHead}>{confMat.labels[i]}</td>
                              {row.map((value, j) => {
                                const intensity = Math.round((value / max) * 220)
                                return (
                                  <td
                                    key={j}
                                    style={{
                                      ...styles.matrixCell,
                                      background: `rgb(${255 - intensity}, ${255 - Math.round(intensity * 0.6)}, 255)`,
                                    }}
                                  >
                                    {value}
                                  </td>
                                )
                              })}
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div style={styles.trainingHistoryCard}>
                <div style={styles.sectionHead}>
                  <div>
                    <h4 style={styles.sectionTitle}>Stored training runs</h4>
                    <p style={styles.sectionText}>Saved locally in this browser. These remain available even if you clear the sensor history.</p>
                  </div>
                </div>
                {trainingRuns.length ? (
                  <div style={styles.trainingRunList}>
                    {trainingRuns.map((run) => (
                      <div key={run.id} style={styles.trainingRunItem}>
                        <div style={styles.trainingRunTop}>
                          <span style={styles.trainingRunName}>{run.label}</span>
                          <span style={styles.trainingRunAccuracy}>{((run.accuracy || 0) * 100).toFixed(2)}%</span>
                        </div>
                        <div style={styles.trainingRunMeta}>
                          Forecast: {run.horizonLabel || '-'} · Rows: {run.trainedOn || '-'} · Folds: {run.folds || '-'}
                        </div>
                        <div style={styles.trainingRunTime}>
                          Trained at {formatPreviewTimestamp(run.trainedAt)} on {run.trainedAt ? new Date(run.trainedAt).toLocaleDateString('en-PH') : '-'}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={styles.trainingRunEmpty}>No saved training runs yet.</div>
                )}
              </div>
            </>
          ) : (
              <div className="ml-empty-state" style={styles.emptyState}>
              <div style={styles.emptyIcon}>{selectedModelOption.short}</div>
              <h4 style={styles.emptyTitle}>No model trained yet</h4>
              <p style={styles.emptyText}>
                Choose a forecast horizon, then train Random Forest, Decision Tree, or Logistic Regression to predict the future soil state and generate the thesis visuals below.
              </p>
              <div className="ml-empty-model-picker" style={styles.emptyModelPicker}>
                {MODEL_OPTIONS.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setSelectedModel(option.key)}
                    style={{
                      ...styles.modelChip,
                      ...(selectedModel === option.key ? styles.modelChipActive : null),
                    }}
                  >
                    <span style={styles.modelChipShort}>{option.short}</span>
                    <span>{option.label}</span>
                  </button>
                ))}
              </div>
              <div className="ml-button-row" style={styles.emptyActions}>
                <button onClick={handleTrain} style={styles.primaryBtn} disabled={!dataset.X.length}>Train selected model</button>
                <button onClick={handleCompareAll} style={styles.secondaryBtn} disabled={!dataset.X.length}>Compare all models</button>
                <button onClick={() => fileRef.current?.click()} style={styles.ghostBtn}>Upload CSV</button>
              </div>
            </div>
          )}
        </div>
      </section>

      {dialog && (
        <div style={styles.modalOverlay} onClick={() => setDialog(null)} role="presentation">
          <div
            style={styles.modalCard}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="ml-dialog-title"
          >
            <div style={styles.modalHeader}>
              <div style={styles.modalIcon}>{dialog.type === 'danger' ? '!' : 'i'}</div>
              <div>
                <h3 id="ml-dialog-title" style={styles.modalTitle}>{dialog.title}</h3>
                <p style={styles.modalText}>{dialog.message}</p>
              </div>
            </div>
            {dialog.detail && <div style={styles.modalDetail}>{dialog.detail}</div>}
            <div style={styles.modalActions}>
              <button
                type="button"
                style={dialog.type === 'confirm' ? styles.primaryBtn : styles.secondaryBtn}
                onClick={() => {
                  const action = dialog.onConfirm
                  setDialog(null)
                  action?.()
                }}
              >
                {dialog.actionLabel || 'Continue'}
              </button>
              <button type="button" style={styles.ghostBtn} onClick={() => setDialog(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
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
  hero: {
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
  kicker: { fontSize: 12, fontWeight: 800, color: 'var(--green-700)', textTransform: 'uppercase', letterSpacing: '0.12em' },
  badge: { fontSize: 12, fontWeight: 700, padding: '6px 10px', borderRadius: 999, background: 'rgba(34,197,94,0.10)', color: 'var(--green-800)' },
  badgeStrong: { fontSize: 12, fontWeight: 800, padding: '6px 10px', borderRadius: 999, background: 'rgba(15,23,42,0.08)', color: 'var(--slate-800)' },
  title: { fontSize: 34, fontWeight: 900, marginBottom: 8, letterSpacing: '-0.03em', lineHeight: 1.1 },
  subtitle: { fontSize: 14.5, color: 'var(--slate-600)', maxWidth: 780, lineHeight: 1.75 },
  heroNote: { minWidth: 220, maxWidth: 300, padding: '1rem', borderRadius: 16, background: 'linear-gradient(135deg, rgba(22,163,74,0.08), rgba(255,255,255,0.95))', border: '1px solid rgba(22,163,74,0.12)', alignSelf: 'stretch' },
  heroNoteLabel: { fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--green-700)', marginBottom: 10 },
  heroNoteValue: { fontSize: 18, fontWeight: 900, marginBottom: 6 },
  heroNoteMeta: { fontSize: 13, color: 'var(--slate-600)', lineHeight: 1.5 },
  heroPills: { display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 16 },
  heroPill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 12px',
    borderRadius: 999,
    background: 'rgba(34,197,94,0.08)',
    color: 'var(--slate-700)',
    border: '1px solid rgba(34,197,94,0.12)',
    fontSize: 12,
    fontWeight: 700,
  },
  grid4: { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12, marginBottom: 16 },
  grid4Small: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 14 },
  card: {
    background: 'rgba(255,255,255,0.9)',
    border: '1px solid rgba(15,23,42,0.06)',
    borderRadius: 20,
    padding: '1rem',
    boxShadow: '0 10px 24px rgba(15,23,42,0.03)',
    position: 'relative',
    overflow: 'hidden',
  },
  cardAccent: { position: 'absolute', inset: '0 auto auto 0', width: 6, height: '100%' },
  cardAccentBlue: { background: 'linear-gradient(180deg, #3b82f6, #60a5fa)' },
  cardAccentGreen: { background: 'linear-gradient(180deg, #16a34a, #22c55e)' },
  cardAccentAmber: { background: 'linear-gradient(180deg, #f59e0b, #fbbf24)' },
  cardAccentSlate: { background: 'linear-gradient(180deg, #64748b, #94a3b8)' },
  cardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, paddingLeft: 8 },
  cardIconWrap: { width: 36, height: 36, borderRadius: 12, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' },
  cardIconBlue: { background: 'rgba(59,130,246,0.12)', color: '#2563eb' },
  cardIconGreen: { background: 'rgba(22,163,74,0.12)', color: 'var(--green-700)' },
  cardIconAmber: { background: 'rgba(245,158,11,0.14)', color: '#d97706' },
  cardIconSlate: { background: 'rgba(100,116,139,0.12)', color: '#475569' },
  cardIcon: { fontSize: 15 },
  metricCard: { background: 'rgba(248,250,252,0.95)', border: '1px solid rgba(15,23,42,0.05)', borderRadius: 18, padding: '1rem' },
  cardLabel: { fontSize: 11, fontWeight: 800, color: 'var(--slate-500)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 },
  cardValue: { fontSize: 22, fontWeight: 900, marginBottom: 6, letterSpacing: '-0.03em', lineHeight: 1.1 },
  cardMeta: { fontSize: 13, color: 'var(--slate-600)', lineHeight: 1.45 },
  workspace: { display: 'block', marginBottom: 16 },
  visualsGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14, marginBottom: 14 },
  panel: { background: 'rgba(255,255,255,0.96)', border: '1px solid rgba(15,23,42,0.06)', borderRadius: 20, padding: '1.15rem', boxShadow: '0 18px 34px rgba(15,23,42,0.04)' },
  panelHeader: { display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', marginBottom: 14 },
  panelTitle: { fontSize: 17, fontWeight: 900, marginBottom: 4 },
  panelText: { fontSize: 13.5, color: 'var(--slate-600)', lineHeight: 1.6 },
  panelPill: { padding: '7px 10px', borderRadius: 999, fontSize: 12, fontWeight: 800, background: 'rgba(15,23,42,0.05)', color: 'var(--slate-700)', whiteSpace: 'nowrap' },
  horizonPicker: { display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  horizonChip: {
    display: 'inline-flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 4,
    padding: '10px 12px',
    borderRadius: 14,
    border: '1px solid rgba(15,23,42,0.08)',
    background: 'white',
    color: 'var(--slate-700)',
    fontWeight: 800,
    cursor: 'pointer',
    minWidth: 124,
  },
  horizonChipActive: {
    borderColor: 'rgba(59,130,246,0.22)',
    boxShadow: '0 10px 18px rgba(59,130,246,0.10)',
    color: '#1d4ed8',
    background: 'rgba(59,130,246,0.06)',
  },
  horizonChipDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
    background: 'rgba(248,250,252,0.95)',
  },
  horizonMeta: { fontSize: 11, fontWeight: 700, color: 'var(--slate-500)' },
  modelPicker: { display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  modelHint: {
    marginBottom: 12,
    padding: '10px 12px',
    borderRadius: 12,
    background: 'rgba(15,23,42,0.03)',
    border: '1px solid rgba(15,23,42,0.05)',
    color: 'var(--slate-700)',
    fontSize: 13,
    lineHeight: 1.5,
  },
  modelChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 14px',
    borderRadius: 999,
    border: '1px solid rgba(15,23,42,0.08)',
    background: 'white',
    color: 'var(--slate-700)',
    fontWeight: 800,
    cursor: 'pointer',
  },
  modelChipActive: {
    borderColor: 'rgba(22,163,74,0.22)',
    boxShadow: '0 10px 18px rgba(22,163,74,0.10)',
    color: 'var(--green-800)',
    background: 'rgba(34,197,94,0.06)',
  },
  modelChipShort: {
    width: 28,
    height: 28,
    borderRadius: 999,
    background: 'rgba(15,23,42,0.05)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 12,
    fontWeight: 900,
  },
  buttonRow: { display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 14 },
  primaryBtn: { background: 'linear-gradient(135deg, #16a34a, #22c55e)', color: 'white', border: 'none', padding: '10px 14px', borderRadius: 12, cursor: 'pointer', fontWeight: 800, boxShadow: '0 10px 24px rgba(34,197,94,0.22)' },
  secondaryBtn: { background: 'rgba(22,163,74,0.08)', color: 'var(--green-800)', border: '1px solid rgba(22,163,74,0.16)', padding: '10px 14px', borderRadius: 12, cursor: 'pointer', fontWeight: 800 },
  ghostBtn: { background: 'transparent', border: '1px solid rgba(15,23,42,0.08)', padding: '10px 14px', borderRadius: 12, cursor: 'pointer', fontWeight: 700, color: 'var(--slate-700)' },
  dangerBtn: { background: 'rgba(220,38,38,0.08)', color: '#b91c1c', border: '1px solid rgba(220,38,38,0.18)', padding: '10px 14px', borderRadius: 12, cursor: 'pointer', fontWeight: 800 },
  uploadNotice: { marginTop: 12, padding: '10px 12px', borderRadius: 12, background: 'rgba(34,197,94,0.10)', border: '1px solid rgba(34,197,94,0.18)', color: 'var(--slate-800)', fontSize: 13, lineHeight: 1.5 },
  previewCard: { marginTop: 14, padding: '0.95rem', borderRadius: 16, background: 'white', border: '1px solid rgba(15,23,42,0.06)' },
  sectionHead: { marginBottom: 10 },
  sectionTitle: { fontSize: 15, fontWeight: 900, marginBottom: 4 },
  sectionText: { fontSize: 13, color: 'var(--slate-600)', lineHeight: 1.6 },
  columnNote: {
    marginTop: 6,
    marginBottom: 10,
    padding: '8px 10px',
    borderRadius: 12,
    background: 'rgba(15,23,42,0.03)',
    color: 'var(--slate-700)',
    fontSize: 12,
    lineHeight: 1.5,
  },
  tableWrap: { maxHeight: 260, overflow: 'auto', borderTop: '1px solid rgba(15,23,42,0.05)', marginTop: 10 },
  table: { width: '100%', minWidth: 1420, borderCollapse: 'separate', borderSpacing: 0, tableLayout: 'fixed', fontSize: 13 },
  tableHead: {
    minWidth: 88,
    padding: '10px 8px',
    textAlign: 'center',
    fontSize: 12,
    fontWeight: 900,
    color: 'var(--slate-700)',
    borderBottom: '1px solid rgba(15,23,42,0.08)',
    whiteSpace: 'nowrap',
  },
  tableHeadIndex: {
    width: 44,
    padding: '10px 8px',
    textAlign: 'center',
    fontSize: 12,
    fontWeight: 900,
    color: 'var(--slate-700)',
    borderBottom: '1px solid rgba(15,23,42,0.08)',
    whiteSpace: 'nowrap',
  },
  tableHeadTime: {
    width: 92,
    padding: '10px 8px',
    textAlign: 'center',
    fontSize: 12,
    fontWeight: 900,
    color: 'var(--slate-700)',
    borderBottom: '1px solid rgba(15,23,42,0.08)',
    whiteSpace: 'nowrap',
  },
  tableHeadLabel: {
    width: 90,
    padding: '10px 8px',
    textAlign: 'center',
    fontSize: 12,
    fontWeight: 900,
    color: 'var(--slate-700)',
    borderBottom: '1px solid rgba(15,23,42,0.08)',
    whiteSpace: 'nowrap',
  },
  tableIndex: {
    width: 44,
    padding: '10px 8px',
    textAlign: 'center',
    borderBottom: '1px solid rgba(15,23,42,0.04)',
    color: 'var(--slate-600)',
    fontWeight: 700,
  },
  tableCell: {
    minWidth: 88,
    padding: '10px 8px',
    textAlign: 'center',
    borderBottom: '1px solid rgba(15,23,42,0.04)',
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  tableTimeCell: {
    padding: '10px 8px',
    textAlign: 'center',
    borderBottom: '1px solid rgba(15,23,42,0.04)',
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
    fontSize: 12,
    color: 'var(--slate-600)',
  },
  tableLabelCell: {
    width: 90,
    padding: '10px 8px',
    textAlign: 'center',
    borderBottom: '1px solid rgba(15,23,42,0.04)',
  },
  labelChip: { display: 'inline-flex', alignItems: 'center', padding: '5px 8px', borderRadius: 999, background: 'rgba(34,197,94,0.10)', color: 'var(--green-800)', fontWeight: 800, fontSize: 12 },
  chartCard: { marginBottom: 14, padding: '1rem', borderRadius: 16, border: '1px solid rgba(15,23,42,0.05)', background: 'white' },
  chartWrap: { height: 290 },
  chartWrapSmall: { height: 220 },
  comparisonCard: { marginBottom: 14, padding: '1rem', borderRadius: 16, border: '1px solid rgba(15,23,42,0.05)', background: 'white' },
  comparisonChartWrap: { height: 260, marginBottom: 12 },
  comparisonGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 },
  comparisonItem: { padding: '0.9rem', borderRadius: 14, background: 'rgba(248,250,252,0.95)', border: '1px solid rgba(15,23,42,0.05)' },
  comparisonItemActive: { padding: '0.9rem', borderRadius: 14, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.16)' },
  comparisonName: { fontSize: 12, fontWeight: 800, color: 'var(--slate-500)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 },
  comparisonValue: { fontSize: 24, fontWeight: 900, color: 'var(--slate-900)' },
  comparisonSub: { marginTop: 4, fontSize: 12, color: 'var(--slate-500)', fontWeight: 700 },
  comparisonNote: { marginBottom: 10, padding: '10px 12px', borderRadius: 12, background: 'rgba(15,23,42,0.03)', color: 'var(--slate-700)', fontSize: 13, lineHeight: 1.5 },
  matrixCard: { padding: '1rem', borderRadius: 16, border: '1px solid rgba(15,23,42,0.05)', background: 'white' },
  matrixWrap: { overflowX: 'auto' },
  matrixTable: { borderCollapse: 'collapse', width: '100%' },
  matrixHead: { padding: 8, background: 'rgba(15,23,42,0.04)', fontWeight: 700 },
  matrixCell: { padding: 10, textAlign: 'center', fontWeight: 700 },
  trainingHistoryCard: { marginTop: 14, padding: '1rem', borderRadius: 16, border: '1px solid rgba(15,23,42,0.05)', background: 'white' },
  trainingRunList: { display: 'grid', gap: 10 },
  trainingRunItem: { padding: '0.95rem', borderRadius: 14, background: 'rgba(248,250,252,0.95)', border: '1px solid rgba(15,23,42,0.05)' },
  trainingRunTop: { display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' },
  trainingRunName: { fontSize: 14, fontWeight: 900, color: 'var(--slate-900)' },
  trainingRunAccuracy: { fontSize: 16, fontWeight: 900, color: 'var(--green-700)' },
  trainingRunMeta: { fontSize: 12, color: 'var(--slate-600)', lineHeight: 1.5 },
  trainingRunTime: { marginTop: 4, fontSize: 12, color: 'var(--slate-500)', fontFamily: "'DM Mono', monospace" },
  trainingRunEmpty: { padding: '0.95rem', borderRadius: 14, background: 'rgba(248,250,252,0.95)', color: 'var(--slate-500)', fontSize: 13 },
  emptyState: { textAlign: 'center', padding: '2.5rem 1.5rem', borderRadius: 18, background: 'linear-gradient(180deg, rgba(248,250,252,0.95), rgba(255,255,255,1))', border: '1px dashed rgba(34,197,94,0.18)' },
  emptyIcon: { width: 60, height: 60, borderRadius: 18, margin: '0 auto 14px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: 'white', background: 'linear-gradient(135deg, #16a34a, #22c55e)', boxShadow: '0 14px 24px rgba(34,197,94,0.22)' },
  emptyTitle: { fontSize: 18, fontWeight: 900, marginBottom: 8 },
  emptyText: { fontSize: 13.5, color: 'var(--slate-600)', lineHeight: 1.7, maxWidth: 420, margin: '0 auto 16px' },
  emptyModelPicker: { display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginBottom: 16 },
  emptyActions: { display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 10 },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15,23,42,0.45)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    zIndex: 60,
  },
  modalCard: {
    width: 'min(560px, 100%)',
    background: 'white',
    borderRadius: 20,
    padding: '1.1rem',
    boxShadow: '0 30px 80px rgba(15,23,42,0.22)',
    border: '1px solid rgba(15,23,42,0.08)',
  },
  modalHeader: { display: 'flex', gap: 14, alignItems: 'flex-start' },
  modalIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 900,
    color: 'white',
    background: 'linear-gradient(135deg, #16a34a, #22c55e)',
    flex: '0 0 auto',
  },
  modalTitle: { fontSize: 18, fontWeight: 900, marginBottom: 6 },
  modalText: { fontSize: 13.5, lineHeight: 1.6, color: 'var(--slate-600)' },
  modalDetail: { marginTop: 12, padding: '10px 12px', borderRadius: 12, background: 'rgba(34,197,94,0.08)', color: 'var(--slate-700)', fontSize: 13, lineHeight: 1.55 },
  modalActions: { display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16, flexWrap: 'wrap' },
}
