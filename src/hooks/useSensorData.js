import { useState, useEffect, useRef, useCallback } from 'react'
import axios from 'axios'

const TOKEN = import.meta.env.VITE_BLYNK_TOKEN
const BASE   = import.meta.env.VITE_BLYNK_BASE

const PINS = ['V0','V1','V2','V3','V4','V5','V6','V7','V8','V9']

const HISTORY_LIMIT = 2000
const HISTORY_STORAGE_KEY = 'vertigation_sensor_history_v1'
const FORECAST_HISTORY_LIMIT = 2000
const FORECAST_HISTORY_STORAGE_KEY = 'vertigation_forecast_history_v1'
const FORECAST_SAMPLE_MS = 1000

function loadStoredHistory(storageKey, limit) {
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(item => item && typeof item === 'object')
      .map((item) => ({
        ...item,
        time: item.time ? new Date(item.time) : new Date(),
      }))
      .filter((item) => !Number.isNaN(item.time.getTime()))
      .slice(-limit)
  } catch {
    return []
  }
}

function persistHistory(storageKey, history, limit) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(history.slice(-limit)))
  } catch {
    // Ignore storage quota or privacy-mode failures.
  }
}

function deriveForecastHistoryFromRaw(rawHistory) {
  if (!Array.isArray(rawHistory) || !rawHistory.length) return []

  const buckets = new Map()
  rawHistory.forEach((item) => {
    const time = item?.time instanceof Date ? item.time : new Date(item?.time || Date.now())
    if (Number.isNaN(time.getTime())) return
    const bucket = Math.floor(time.getTime() / FORECAST_SAMPLE_MS)
    buckets.set(bucket, { ...item, time })
  })

  return Array.from(buckets.values()).slice(-FORECAST_HISTORY_LIMIT)
}

export function useSensorData() {
  const [data, setData]       = useState(null)
  const [history, setHistory] = useState(() => loadStoredHistory(HISTORY_STORAGE_KEY, HISTORY_LIMIT))
  const [forecastHistory, setForecastHistory] = useState(() => {
    const storedForecast = loadStoredHistory(FORECAST_HISTORY_STORAGE_KEY, FORECAST_HISTORY_LIMIT)
    if (storedForecast.length) return storedForecast
    const storedRaw = loadStoredHistory(HISTORY_STORAGE_KEY, HISTORY_LIMIT)
    const derived = deriveForecastHistoryFromRaw(storedRaw)
    if (derived.length) {
      persistHistory(FORECAST_HISTORY_STORAGE_KEY, derived, FORECAST_HISTORY_LIMIT)
    }
    return derived
  })
  const [status, setStatus]   = useState('connecting') // connecting | live | error
  const [lastUpdate, setLastUpdate] = useState(null)
  const intervalRef = useRef(null)
  const lastForecastBucketRef = useRef(null)

  const fetchAll = useCallback(async () => {
    try {
      const query = PINS.join('&')
      const res = await axios.get(`${BASE}/get?token=${TOKEN}&${query}`, { timeout: 5000 })
      const raw = res.data

      const parsed = {
        t1:       Math.round(parseFloat(raw.V0  ?? 0)),
        temp:     parseFloat(raw.V1  ?? 0).toFixed(1),
        humidity: parseFloat(raw.V2  ?? 0).toFixed(1),
        t2:       Math.round(parseFloat(raw.V3  ?? 0)),
        t3:       Math.round(parseFloat(raw.V4  ?? 0)),
        lux:      Math.round(parseFloat(raw.V5  ?? 0)),
        tank:     parseInt(raw.V6   ?? 0),    // 1 = OK, 0 = EMPTY (current datastream)
        pumpManual: parseInt(raw.V7 ?? 0),    // dashboard switch input
        mode:     parseInt(raw.V8   ?? 0),    // 0 = AUTO, 1 = MANUAL
        pump:     parseInt(raw.V9   ?? 0),    // 1 = running
      }

      setData(parsed)
      setStatus('live')
      setLastUpdate(new Date())

      // Append to history for trend chart
      setHistory(prev => {
        const next = [...prev, { time: new Date(), ...parsed }]
        const trimmed = next.slice(-HISTORY_LIMIT)
        persistHistory(HISTORY_STORAGE_KEY, trimmed, HISTORY_LIMIT)
        return trimmed
      })

      const now = new Date()
      const currentBucket = Math.floor(now.getTime() / FORECAST_SAMPLE_MS)
      if (lastForecastBucketRef.current !== currentBucket) {
        lastForecastBucketRef.current = currentBucket
        setForecastHistory(prev => {
          const next = [...prev, { time: now, ...parsed }]
          const trimmed = next.slice(-FORECAST_HISTORY_LIMIT)
          persistHistory(FORECAST_HISTORY_STORAGE_KEY, trimmed, FORECAST_HISTORY_LIMIT)
          return trimmed
        })
      }
    } catch {
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    fetchAll()
    intervalRef.current = setInterval(fetchAll, 1000)
    return () => clearInterval(intervalRef.current)
  }, [fetchAll])

  useEffect(() => {
    if (forecastHistory.length || !history.length) return
    const derived = deriveForecastHistoryFromRaw(history)
    if (!derived.length) return
    setForecastHistory(derived)
    persistHistory(FORECAST_HISTORY_STORAGE_KEY, derived, FORECAST_HISTORY_LIMIT)
  }, [forecastHistory.length, history])

  const clearHistory = useCallback(() => {
    try {
      localStorage.removeItem(HISTORY_STORAGE_KEY)
      localStorage.removeItem(FORECAST_HISTORY_STORAGE_KEY)
    } catch {
      // Ignore storage errors and still clear in-memory history.
    }
    setHistory([])
    setForecastHistory([])
    lastForecastBucketRef.current = null
  }, [])

  const sendControl = useCallback(async (pin, value) => {
    const endpoint = `${BASE}/update?token=${TOKEN}&${pin}=${value}`
    const res = await axios.get(endpoint, { timeout: 5000 })
    if (res.status >= 200 && res.status < 300) return true
    throw new Error(`Failed to update ${pin}`)
  }, [])

  return { data, history, forecastHistory, status, lastUpdate, clearHistory, sendControl }
}
