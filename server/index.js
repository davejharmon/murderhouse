// server/index.js
// WebSocket server entry point

import { WebSocketServer } from 'ws';
import { Game } from './Game.js';
import { createHandlers, handleMessage } from './handlers/index.js';

const PORT = process.env.PORT || 8080;

// Create WebSocket server
const wss = new WebSocketServer({
  port: PORT,
  perMessageDeflate: false // Disable compression for faster connections
});

// Track all connected clients
const clients = new Set();

// Broadcast function
function broadcast(type, payload) {
  const message = JSON.stringify({ type, payload });
  for (const client of clients) {
    if (client.readyState === 1) {
      client.send(message);
    }
  }
}

// Create game instance
const game = new Game(broadcast);

// Create handlers
const handlers = createHandlers(game);

console.log(`[Server] WebSocket server running on ws://localhost:${PORT}`);

wss.on('connection', (ws) => {
  clients.add(ws);
  console.log(`[Server] Client connected (${clients.size} total)`);

  ws.on('message', (message) => {
    handleMessage(handlers, ws, message.toString());
  });

  ws.on('close', () => {
    clients.delete(ws);
    console.log(`[Server] Client disconnected (${clients.size} total), playerId=${ws.playerId}`);

    // Remove this connection from the player's connection list
    if (ws.playerId) {
      const player = game.getPlayer(ws.playerId);
      if (player) {
        player.removeConnection(ws);
        console.log(`[Server] Removed connection for player ${ws.playerId}, ${player.connections.length} remaining`);
        // Broadcast updated player list (connected status may have changed)
        game.broadcastPlayerList();
      }
    }

    // Clear host/screen reference
    if (ws === game.host) {
      game.host = null;
    }
    if (ws === game.screen) {
      game.screen = null;
    }
  });

  ws.on('error', (error) => {
    console.error('[Server] WebSocket error:', error);
  });
});
