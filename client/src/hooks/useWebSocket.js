// client/src/hooks/useWebSocket.js
// Manages WebSocket connection lifecycle and reconnect with exponential backoff.
// onMessage is kept in a ref so handler identity changes never trigger reconnect.

import { useState, useRef, useCallback, useEffect } from 'react'

export function useWebSocket(url, onMessage) {
  const [connected, setConnected] = useState(false)
  const wsRef = useRef(null)
  const reconnectTimeoutRef = useRef(null)
  const reconnectDelayRef = useRef(2000)
  const onMessageRef = useRef(onMessage)

  useEffect(() => {
    onMessageRef.current = onMessage
  }, [onMessage])

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      console.log('[WS] Connected')
      reconnectDelayRef.current = 2000
      setConnected(true)
    }

    ws.onclose = () => {
      console.log('[WS] Disconnected')
      setConnected(false)
      const delay = reconnectDelayRef.current
      reconnectDelayRef.current = Math.min(delay * 2, 30000)
      console.log(`[WS] Reconnecting in ${delay / 1000}s`)
      reconnectTimeoutRef.current = setTimeout(connect, delay)
    }

    ws.onerror = (err) => {
      console.error('[WS] Error:', err)
    }

    ws.onmessage = (event) => {
      try {
        const { type, payload } = JSON.parse(event.data)
        onMessageRef.current(type, payload)
      } catch (e) {
        console.error('[WS] Parse error:', e)
      }
    }
  }, [url])

  const send = useCallback((type, payload = {}) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, payload }))
    } else {
      console.warn('[WS] Not connected, cannot send:', type)
    }
  }, [])

  useEffect(() => {
    connect()
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current)
      wsRef.current?.close()
    }
  }, [connect])

  return { connected, send }
}
