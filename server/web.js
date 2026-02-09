// server/web.js
// Web deployment entry point — serves built React client + WebSocket on a single port.
// Used for remote playtesting on PaaS platforms (Railway, Render, etc.)
// Local development still uses `npm run dev` (server/index.js + Vite dev server).

import express from 'express'
import { createServer } from 'http'
import { WebSocketServer } from 'ws'
import path from 'path'
import { fileURLToPath } from 'url'
import { Game } from './Game.js'
import { createHandlers, handleMessage } from './handlers/index.js'

const PORT = process.env.PORT || 8080
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Serve built React client
const app = express()
app.use(express.static(path.join(__dirname, '../client/dist')))
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/dist/index.html'))
})

const server = createServer(app)
const wss = new WebSocketServer({ server, perMessageDeflate: false })

// Track all connected clients
const clients = new Set()

// Broadcast function
function broadcast(type, payload) {
  const message = JSON.stringify({ type, payload })
  for (const client of clients) {
    if (client.readyState === 1) {
      client.send(message)
    }
  }
}

// Send to host function — finds host from live clients set
function sendToHost(type, payload) {
  const message = JSON.stringify({ type, payload })
  for (const client of clients) {
    if (client.readyState === 1 && client.clientType === 'host') {
      client.send(message)
    }
  }
}

// Send to screen function — finds screen from live clients set
function sendToScreen(type, payload) {
  const message = JSON.stringify({ type, payload })
  for (const client of clients) {
    if (client.readyState === 1 && client.clientType === 'screen') {
      client.send(message)
    }
  }
}

// Create game instance
const game = new Game(broadcast, sendToHost, sendToScreen)

// Create handlers
const handlers = createHandlers(game)

wss.on('connection', (ws) => {
  clients.add(ws)

  ws.on('message', (message) => {
    handleMessage(handlers, ws, message.toString())
  })

  ws.on('close', () => {
    clients.delete(ws)

    // Remove this connection from the player's connection list
    if (ws.playerId) {
      const player = game.getPlayer(ws.playerId)
      if (player) {
        player.removeConnection(ws)
        // Broadcast updated player list (connected status may have changed)
        game.broadcastPlayerList()
      }
    }

    // Clear host/screen reference
    if (ws === game.host) {
      game.host = null
    }
    if (ws === game.screen) {
      game.screen = null
    }
  })

  ws.on('error', (error) => {
    console.error('[Server] WebSocket error:', error)
  })
})

server.listen(PORT, () => {
  console.log(`[Server] Web mode running on http://localhost:${PORT}`)
})
