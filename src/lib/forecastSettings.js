export const FORECAST_HORIZON_STORAGE_KEY = 'vertigation_ml_forecast_horizon_v1'

export const FORECAST_HORIZON_OPTIONS = [
  { key: '5m', label: '5 minutes', minutes: 5 },
  { key: '10m', label: '10 minutes', minutes: 10 },
  { key: '20m', label: '20 minutes', minutes: 20 },
  { key: '30m', label: '30 minutes', minutes: 30 },
]

export function loadPreferredHorizon(defaultKey = '10m') {
  try {
    return localStorage.getItem(FORECAST_HORIZON_STORAGE_KEY) || defaultKey
  } catch {
    return defaultKey
  }
}

export function savePreferredHorizon(horizonKey) {
  try {
    if (horizonKey) localStorage.setItem(FORECAST_HORIZON_STORAGE_KEY, horizonKey)
  } catch {
    // Ignore storage failures.
  }
}
