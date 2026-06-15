import { useState, useEffect, useRef, useCallback } from 'react'
import axios from 'axios'

const TOKEN = import.meta.env.VITE_BLYNK_TOKEN
const BASE   = import.meta.env.VITE_BLYNK_BASE

const PINS = ['V0','V1','V2','V3','V4','V5','V6','V7','V8','V9']

const HISTORY_LIMIT = 2000 // enough for longer thesis training sessions
const HISTORY_STORAGE_KEY = 'vertigation_sensor_history_v1'

function loadStoredHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY)
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
      .slice(-HISTORY_LIMIT)
  } catch {
    return []
  }
}

function persistHistory(history) {
  try {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history.slice(-HISTORY_LIMIT)))
  } catch {
    // Ignore storage quota or privacy-mode failures.
  }
}

export function useSensorData() {
  const [data, setData]       = useState(null)
  const [history, setHistory] = useState(() => loadStoredHistory())
  const [status, setStatus]   = useState('connecting') // connecting | live | error
  const [lastUpdate, setLastUpdate] = useState(null)
  const intervalRef = useRef(null)

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
        persistHistory(trimmed)
        return trimmed
      })
    } catch {
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    fetchAll()
    intervalRef.current = setInterval(fetchAll, 2000)
    return () => clearInterval(intervalRef.current)
  }, [fetchAll])

  const clearHistory = useCallback(() => {
    try {
      localStorage.removeItem(HISTORY_STORAGE_KEY)
    } catch {
      // Ignore storage errors and still clear in-memory history.
    }
    setHistory([])
  }, [])

  const sendControl = useCallback(async (pin, value) => {
    const endpoint = `${BASE}/update?token=${TOKEN}&${pin}=${value}`
    const res = await axios.get(endpoint, { timeout: 5000 })
    if (res.status >= 200 && res.status < 300) return true
    throw new Error(`Failed to update ${pin}`)
  }, [])

  return { data, history, status, lastUpdate, clearHistory, sendControl }
}
