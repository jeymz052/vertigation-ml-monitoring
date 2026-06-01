import { useState, useEffect, useRef, useCallback } from 'react'
import axios from 'axios'

const TOKEN = import.meta.env.VITE_BLYNK_TOKEN
const BASE   = import.meta.env.VITE_BLYNK_BASE

const PINS = ['V0','V1','V2','V3','V4','V5','V6','V7']

const HISTORY_LIMIT = 30 // keep last 30 data points (~1 min at 2s interval)

export function useSensorData() {
  const [data, setData]       = useState(null)
  const [history, setHistory] = useState([])
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
        pump:     parseInt(raw.V7   ?? 0),    // 1 = running
      }

      setData(parsed)
      setStatus('live')
      setLastUpdate(new Date())

      // Append to history for trend chart
      setHistory(prev => {
        const next = [...prev, { time: new Date(), ...parsed }]
        return next.slice(-HISTORY_LIMIT)
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

  return { data, history, status, lastUpdate }
}
