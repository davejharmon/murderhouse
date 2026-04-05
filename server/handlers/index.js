// server/handlers/index.js
// Assembles all domain handler modules and exports the public API.

import { ServerMsg } from '../../shared/constants.js'
import { send } from './utils.js'
import { createConnectionHandlers } from './connection.js'
import { createPlayerHandlers } from './player.js'
import { createHostHandlers } from './host.js'
import { createDebugHandlers } from './debug.js'

export function createHandlers(game, clients) {
  return {
    ...createConnectionHandlers(game),
    ...createPlayerHandlers(game),
    ...createHostHandlers(game, clients),
    ...createDebugHandlers(game),
  }
}

export function handleMessage(handlers, ws, message) {
  let data
  try {
    data = JSON.parse(message)
  } catch {
    send(ws, ServerMsg.ERROR, { message: 'Invalid JSON' })
    return
  }

  const { type, payload = {} } = data
  const handler = handlers[type]

  if (!handler) {
    send(ws, ServerMsg.ERROR, { message: `Unknown message type: ${type}` })
    return
  }

  try {
    const result = handler(ws, payload)
    if (result && !result.success && result.error) {
      send(ws, ServerMsg.ERROR, { message: result.error })
    }
  } catch (e) {
    console.error(`[Server] Error handling ${type}:`, e)
    send(ws, ServerMsg.ERROR, { message: 'Internal server error' })
  }
}
