import { predictRF } from './randomForest'
import { predictDecisionTree, predictLogisticRegression } from './mlModels'

const ML_MODEL_STORAGE_KEY = 'vertigation_ml_model_v1'
const ML_TRAINING_RUNS_STORAGE_KEY = 'vertigation_ml_training_runs_v1'

function toFeatureRow(row) {
  if (Array.isArray(row?.features)) {
    return row.features.map((value) => Number(value) || 0)
  }

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
  const timestamp = row?.timestamp ? new Date(row.timestamp) : row?.time ? new Date(row.time) : new Date()
  const safeTimestamp = Number.isNaN(timestamp.getTime()) ? new Date() : timestamp
  const minutesOfDay = (safeTimestamp.getHours() * 60) + safeTimestamp.getMinutes()
  const angle = (minutesOfDay / 1440) * Math.PI * 2

  return [t1, t2, t3, avgMoisture, imbalance, temp, humidity, lux, tank, pump, Math.sin(angle), Math.cos(angle)]
}

export function saveTrainedModelSnapshot(snapshot) {
  try {
    if (typeof window === 'undefined') return false
    const payload = {
      ...snapshot,
      savedAt: new Date().toISOString(),
    }
    localStorage.setItem(ML_MODEL_STORAGE_KEY, JSON.stringify(payload))
    return true
  } catch {
    return false
  }
}

export function saveTrainingRun(run) {
  try {
    if (typeof window === 'undefined') return false
    const current = loadTrainingRuns()
    const next = [
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        savedAt: new Date().toISOString(),
        ...run,
      },
      ...current,
    ].slice(0, 20)
    localStorage.setItem(ML_TRAINING_RUNS_STORAGE_KEY, JSON.stringify(next))
    return true
  } catch {
    return false
  }
}

export function loadTrainedModelSnapshot() {
  try {
    if (typeof window === 'undefined') return null
    const raw = localStorage.getItem(ML_MODEL_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || !parsed.model || !parsed.modelKey) return null
    return parsed
  } catch {
    return null
  }
}

export function loadTrainingRuns() {
  try {
    if (typeof window === 'undefined') return []
    const raw = localStorage.getItem(ML_TRAINING_RUNS_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function clearStoredModelData() {
  try {
    if (typeof window === 'undefined') return false
    localStorage.removeItem(ML_MODEL_STORAGE_KEY)
    localStorage.removeItem(ML_TRAINING_RUNS_STORAGE_KEY)
    return true
  } catch {
    return false
  }
}

function predictWithModelKey(modelKey, model, features) {
  if (!model) return null

  switch (modelKey) {
    case 'decision_tree':
      return predictDecisionTree(model, [features])[0] ?? null
    case 'logistic_regression':
      return predictLogisticRegression(model, [features])[0] ?? null
    default:
      return predictRF(model, [features])[0] ?? null
  }
}

function getExpectedFeatureCount(snapshot) {
  if (Number.isInteger(snapshot?.featureCount) && snapshot.featureCount > 0) {
    return snapshot.featureCount
  }

  if (Array.isArray(snapshot?.featureNames) && snapshot.featureNames.length) {
    return snapshot.featureNames.length
  }

  if (Array.isArray(snapshot?.model?.importance) && snapshot.model.importance.length) {
    return snapshot.model.importance.length
  }

  if (Array.isArray(snapshot?.model?.means) && snapshot.model.means.length) {
    return snapshot.model.means.length
  }

  return null
}

export function predictStoredModel(snapshot, row) {
  if (!snapshot?.model) return null
  const baseFeatures = toFeatureRow(row)
  const expectedFeatureCount = getExpectedFeatureCount(snapshot)
  const features = expectedFeatureCount ? baseFeatures.slice(0, expectedFeatureCount) : baseFeatures

  return predictWithModelKey(snapshot.modelKey, snapshot.model, features)
}

export function predictStoredTierForecasts(snapshot, row) {
  if (!snapshot?.tierModels) return null
  const baseFeatures = toFeatureRow(row)
  const expectedFeatureCount = getExpectedFeatureCount(snapshot)
  const features = expectedFeatureCount ? baseFeatures.slice(0, expectedFeatureCount) : baseFeatures

  return {
    t1: predictWithModelKey(snapshot.modelKey, snapshot.tierModels.t1, features),
    t2: predictWithModelKey(snapshot.modelKey, snapshot.tierModels.t2, features),
    t3: predictWithModelKey(snapshot.modelKey, snapshot.tierModels.t3, features),
  }
}

function formatPredictionLabel(prediction) {
  if (prediction === 'dry') return 'dry'
  if (prediction === 'wet') return 'wet'
  if (prediction === 'ok') return 'okay'
  return 'unknown'
}

export function buildIrrigationAdvisory(prediction, row, snapshot) {
  const horizonLabel = snapshot?.horizonLabel || 'the selected horizon'

  if (!row) {
    return {
      status: 'No live data yet',
      detail: 'Waiting for sensor readings.',
      tone: 'slate',
    }
  }

  if (!snapshot || !prediction) {
    return {
      status: `After ${horizonLabel}: prediction unavailable`,
      detail: 'Train a model on the ML page to enable future soil-state prediction.',
      tone: 'slate',
    }
  }

  const predictionLabel = formatPredictionLabel(prediction)
  const pumpOn = Number(row.pump) === 1
  const tankEmpty = Number(row.tank) === 0

  let tone = 'amber'
  let recommendation = 'Continue monitoring the current soil condition.'

  if (prediction === 'dry') {
    tone = tankEmpty ? 'red' : 'amber'
    recommendation = tankEmpty
      ? 'Recommendation: refill the tank now because the soil is forecast to become dry.'
      : 'Recommendation: keep AUTO mode enabled or prepare the next watering cycle before the soil becomes dry.'
  } else if (prediction === 'wet') {
    tone = 'green'
    recommendation = 'Recommendation: no immediate watering is needed because the soil is forecast to stay wet.'
  } else if (prediction === 'ok') {
    tone = 'amber'
    recommendation = 'Recommendation: moisture is forecast to stay in the normal range, so continue monitoring.'
  }

  const contextParts = []
  if (pumpOn) contextParts.push('Pump is currently ON')
  else contextParts.push('Pump is currently OFF')

  if (tankEmpty) {
    contextParts.push('tank is EMPTY')
    tone = 'red'
  } else {
    contextParts.push('tank is OK')
  }

  return {
    status: `After ${horizonLabel}: soil likely ${predictionLabel}`,
    detail: `${recommendation} Current status: ${contextParts.join(', ')}. Forecast model: ${snapshot.label}.`,
    tone,
  }
}
