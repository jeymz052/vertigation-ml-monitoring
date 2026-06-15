import { predictRF } from './randomForest'
import { predictDecisionTree, predictLogisticRegression } from './mlModels'

const ML_MODEL_STORAGE_KEY = 'vertigation_ml_model_v1'

function toFeatureRow(row) {
  if (Array.isArray(row?.features)) {
    return row.features.map((value) => Number(value) || 0)
  }

  return [
    Number(row?.t1) || 0,
    Number(row?.t2) || 0,
    Number(row?.t3) || 0,
    Number(row?.temp) || 0,
    Number(row?.humidity) || 0,
    Number(row?.lux) || 0,
    Number(row?.tank) || 0,
  ]
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

export function predictStoredModel(snapshot, row) {
  if (!snapshot?.model) return null
  const features = toFeatureRow(row)

  switch (snapshot.modelKey) {
    case 'decision_tree':
      return predictDecisionTree(snapshot.model, [features])[0] ?? null
    case 'logistic_regression':
      return predictLogisticRegression(snapshot.model, [features])[0] ?? null
    default:
      return predictRF(snapshot.model, [features])[0] ?? null
  }
}

export function buildIrrigationAdvisory(prediction, row, snapshot) {
  if (!row) {
    return {
      status: 'No live data',
      detail: 'Waiting for sensor readings.',
      tone: 'slate',
    }
  }

  if (Number(row.tank) === 0) {
    return {
      status: 'Refill tank',
      detail: 'Water level is empty, so irrigation should stay locked.',
      tone: 'red',
    }
  }

  const pumpOn = Number(row.pump) === 1

  if (pumpOn) {
    return {
      status: 'Watering active',
      detail: snapshot?.label ? `Model: ${snapshot.label}` : 'Current irrigation cycle is running.',
      tone: 'green',
    }
  }

  if (!prediction) {
    return {
      status: 'Model unavailable',
      detail: 'Train a model on the ML page to enable advisory output.',
      tone: 'slate',
    }
  }

  if (prediction === 'dry') {
    return {
      status: 'Water needed',
      detail: 'The trained model predicts dry soil conditions.',
      tone: 'red',
    }
  }

  if (prediction === 'wet') {
    return {
      status: 'No watering',
      detail: 'The trained model predicts wet soil conditions.',
      tone: 'green',
    }
  }

  return {
    status: 'Monitor',
    detail: 'The trained model predicts an intermediate moisture state.',
    tone: 'amber',
  }
}
