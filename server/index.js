// server/index.js
// WebSocket server entry point

import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import dgram from 'dgram';
import { Game } from './Game.js';
import { createHandlers, handleMessage } from './handlers/index.js';
import { handleFirmwareRequest } from './firmware.js';

const PORT = process.env.PORT || 8080;

// Create HTTP server (serves firmware endpoints, upgrades WebSocket)
const server = createServer((req, res) => {
  if (handleFirmwareRequest(req, res)) return;
  res.writeHead(404);
  res.end();
});

// Create WebSocket server on the same HTTP server
const wss = new WebSocketServer({ server, perMessageDeflate: false });

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

// Send to host function — finds host from live clients set
function sendToHost(type, payload) {
  const message = JSON.stringify({ type, payload });
  for (const client of clients) {
    if (client.readyState === 1 && client.clientType === 'host') {
      client.send(message);
    }
  }
}

// Send to screen function — finds screen from live clients set
function sendToScreen(type, payload) {
  const message = JSON.stringify({ type, payload });
  for (const client of clients) {
    if (client.readyState === 1 && client.clientType === 'screen') {
      client.send(message);
    }
  }
}

// Create game instance
const game = new Game(broadcast, sendToHost, sendToScreen);

// Create handlers
const handlers = createHandlers(game, clients);

server.listen(PORT, () => {
  console.log(`[Server] Running on http://localhost:${PORT} (WebSocket + firmware)`);
});

// UDP discovery listener - ESP32 terminals broadcast to find the server
const DISCOVERY_PORT = 8089;
const udpServer = dgram.createSocket('udp4');

udpServer.on('message', (msg, rinfo) => {
  if (msg.toString() === 'MURDERHOUSE_DISCOVER') {
    const response = Buffer.from(`MURDERHOUSE_SERVER:${PORT}`);
    udpServer.send(response, rinfo.port, rinfo.address);
  }
});

udpServer.bind(DISCOVERY_PORT);

// Ping all clients every 15 seconds to detect dead connections promptly
// (e.g. terminals that rebooted after OTA without a clean WebSocket close).
const PING_INTERVAL_MS = 15000;
setInterval(() => {
  for (const ws of clients) {
    if (ws.isAlive === false) {
      // Didn't respond to last ping — terminate
      ws.terminate();
      continue;
    }
    ws.isAlive = false;
    ws.ping();
  }
}, PING_INTERVAL_MS);

wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  clients.add(ws);

  ws.on('message', (message) => {
    handleMessage(handlers, ws, message.toString());
  });

  ws.on('close', () => {
    clients.delete(ws);

    // Remove this connection from the player's connection list
    if (ws.playerId) {
      const player = game.getPlayer(ws.playerId);
      if (player) {
        player.removeConnection(ws);
        // Broadcast updated player list (connected status may have changed)
        game.broadcastPlayerList();
        // If the player has no connections left, notify flows so they can
        // auto-resolve rather than hanging indefinitely.
        if (player.connections.length === 0) {
          game.notifyFlowsOfDisconnect(player);
        }
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
