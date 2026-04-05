// server/handlers/utils.js
// Shared utilities for all handler modules.

// Wraps a handler so it only runs when the connection is authenticated as host.
export function requireHost(fn) {
  return (ws, payload) => {
    if (ws.clientType !== 'host') return { success: false, error: 'Not host' }
    return fn(ws, payload)
  }
}

// Send a typed message to a WebSocket client.
export function send(ws, type, payload) {
  if (ws.readyState === 1) {
    ws.send(JSON.stringify({ type, payload }))
  }
}
