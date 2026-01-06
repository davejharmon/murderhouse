// server/handlers/index.js
// WebSocket message handlers

import { ClientMsg, ServerMsg } from '../../shared/constants.js';
import { getEvent } from '../definitions/events.js';

export function createHandlers(game) {
  const handlers = {
    // === Connection Handlers ===
    
    [ClientMsg.JOIN]: (ws, payload) => {
      const { playerId } = payload;
      
      // Check if player already exists (reconnection)
      const existing = game.getPlayer(playerId);
      if (existing) {
        const result = game.reconnectPlayer(playerId, ws);
        if (result.success) {
          ws.playerId = playerId;
          ws.clientType = 'player';
          send(ws, ServerMsg.WELCOME, { 
            playerId, 
            reconnected: true,
            player: existing.getPrivateState(),
          });
          send(ws, ServerMsg.GAME_STATE, game.getPublicGameState());
          send(ws, ServerMsg.PLAYER_STATE, existing.getPrivateState());
        }
        return result;
      }
      
      // New player
      const result = game.addPlayer(playerId, ws);
      if (result.success) {
        ws.playerId = playerId;
        ws.clientType = 'player';
        send(ws, ServerMsg.WELCOME, { 
          playerId, 
          player: result.player.getPrivateState(),
        });
        send(ws, ServerMsg.GAME_STATE, game.getPublicGameState());
        send(ws, ServerMsg.PLAYER_STATE, result.player.getPrivateState());
      } else {
        send(ws, ServerMsg.ERROR, { message: result.error });
      }
      return result;
    },

    [ClientMsg.REJOIN]: (ws, payload) => {
      const { playerId } = payload;
      const result = game.reconnectPlayer(playerId, ws);
      
      if (result.success) {
        ws.playerId = playerId;
        ws.clientType = 'player';
        send(ws, ServerMsg.WELCOME, { 
          playerId, 
          reconnected: true,
          player: result.player.getPrivateState(),
        });
        send(ws, ServerMsg.GAME_STATE, game.getPublicGameState());
        send(ws, ServerMsg.PLAYER_STATE, result.player.getPrivateState());
      } else {
        send(ws, ServerMsg.ERROR, { message: result.error });
      }
      return result;
    },

    [ClientMsg.HOST_CONNECT]: (ws) => {
      game.host = ws;
      ws.clientType = 'host';
      send(ws, ServerMsg.WELCOME, { role: 'host' });
      send(ws, ServerMsg.GAME_STATE, game.getPublicGameState());
      send(ws, ServerMsg.SLIDE_QUEUE, {
        queue: game.slideQueue,
        currentIndex: game.currentSlideIndex,
        current: game.getCurrentSlide(),
      });
      send(ws, ServerMsg.LOG, game.log.slice(-50));
      return { success: true };
    },

    [ClientMsg.SCREEN_CONNECT]: (ws) => {
      game.screen = ws;
      ws.clientType = 'screen';
      send(ws, ServerMsg.WELCOME, { role: 'screen' });
      send(ws, ServerMsg.GAME_STATE, game.getPublicGameState());
      send(ws, ServerMsg.SLIDE, game.getCurrentSlide());
      return { success: true };
    },

    // === Player Actions ===

    [ClientMsg.SET_NAME]: (ws, payload) => {
      const player = game.getPlayer(ws.playerId);
      if (!player) return { success: false, error: 'Not a player' };
      
      player.name = payload.name.slice(0, 20); // Max 20 chars
      game.broadcastPlayerList();
      return { success: true };
    },

    [ClientMsg.SELECT_UP]: (ws) => {
      const player = game.getPlayer(ws.playerId);
      if (!player) return { success: false, error: 'Not a player' };
      
      // Find active event and valid targets
      for (const [eventId, instance] of game.activeEvents) {
        if (instance.participants.includes(player.id)) {
          const event = instance.event;
          const targets = event.validTargets(player, game);
          const selected = player.selectUp(targets);
          
          player.send(ServerMsg.PLAYER_STATE, player.getPrivateState());
          return { success: true, selected };
        }
      }
      
      return { success: false, error: 'No active event' };
    },

    [ClientMsg.SELECT_DOWN]: (ws) => {
      const player = game.getPlayer(ws.playerId);
      if (!player) return { success: false, error: 'Not a player' };
      
      for (const [eventId, instance] of game.activeEvents) {
        if (instance.participants.includes(player.id)) {
          const event = instance.event;
          const targets = event.validTargets(player, game);
          const selected = player.selectDown(targets);
          
          player.send(ServerMsg.PLAYER_STATE, player.getPrivateState());
          return { success: true, selected };
        }
      }
      
      return { success: false, error: 'No active event' };
    },

    [ClientMsg.CONFIRM]: (ws) => {
      const player = game.getPlayer(ws.playerId);
      if (!player) return { success: false, error: 'Not a player' };
      
      const targetId = player.confirmSelection();
      if (targetId === null) {
        return { success: false, error: 'Nothing selected' };
      }
      
      const result = game.recordSelection(player.id, targetId);
      player.send(ServerMsg.PLAYER_STATE, player.getPrivateState());
      
      return result;
    },

    [ClientMsg.CANCEL]: (ws) => {
      const player = game.getPlayer(ws.playerId);
      if (!player) return { success: false, error: 'Not a player' };
      
      player.cancelSelection();
      player.send(ServerMsg.PLAYER_STATE, player.getPrivateState());
      
      return { success: true };
    },

    // === Host Actions ===

    [ClientMsg.START_GAME]: (ws) => {
      if (ws.clientType !== 'host') {
        return { success: false, error: 'Not host' };
      }
      return game.startGame();
    },

    [ClientMsg.START_EVENT]: (ws, payload) => {
      if (ws.clientType !== 'host') {
        return { success: false, error: 'Not host' };
      }
      return game.startEvent(payload.eventId);
    },

    [ClientMsg.START_ALL_EVENTS]: (ws) => {
      if (ws.clientType !== 'host') {
        return { success: false, error: 'Not host' };
      }
      return game.startAllEvents();
    },

    [ClientMsg.RESOLVE_EVENT]: (ws, payload) => {
      if (ws.clientType !== 'host') {
        return { success: false, error: 'Not host' };
      }
      return game.resolveEvent(payload.eventId);
    },

    [ClientMsg.RESOLVE_ALL_EVENTS]: (ws) => {
      if (ws.clientType !== 'host') {
        return { success: false, error: 'Not host' };
      }
      return game.resolveAllEvents();
    },

    [ClientMsg.NEXT_PHASE]: (ws) => {
      if (ws.clientType !== 'host') {
        return { success: false, error: 'Not host' };
      }
      return game.nextPhase();
    },

    [ClientMsg.END_GAME]: (ws, payload) => {
      if (ws.clientType !== 'host') {
        return { success: false, error: 'Not host' };
      }
      game.endGame(payload?.winner || null);
      return { success: true };
    },

    [ClientMsg.RESET_GAME]: (ws) => {
      if (ws.clientType !== 'host') {
        return { success: false, error: 'Not host' };
      }
      game.reset();
      game.broadcastGameState();
      game.broadcastSlides();
      return { success: true };
    },

    // === Slide Controls ===

    [ClientMsg.NEXT_SLIDE]: (ws) => {
      if (ws.clientType !== 'host') {
        return { success: false, error: 'Not host' };
      }
      game.nextSlide();
      return { success: true };
    },

    [ClientMsg.PREV_SLIDE]: (ws) => {
      if (ws.clientType !== 'host') {
        return { success: false, error: 'Not host' };
      }
      game.prevSlide();
      return { success: true };
    },

    [ClientMsg.PUSH_SLIDE]: (ws, payload) => {
      if (ws.clientType !== 'host') {
        return { success: false, error: 'Not host' };
      }
      game.pushSlide(payload.slide, payload.jumpTo);
      return { success: true };
    },

    [ClientMsg.CLEAR_SLIDES]: (ws) => {
      if (ws.clientType !== 'host') {
        return { success: false, error: 'Not host' };
      }
      game.clearSlides();
      return { success: true };
    },

    // === Player Management ===

    [ClientMsg.KICK_PLAYER]: (ws, payload) => {
      if (ws.clientType !== 'host') {
        return { success: false, error: 'Not host' };
      }
      return game.removePlayer(payload.playerId);
    },

    [ClientMsg.KILL_PLAYER]: (ws, payload) => {
      if (ws.clientType !== 'host') {
        return { success: false, error: 'Not host' };
      }
      game.killPlayer(payload.playerId, 'host');
      game.broadcastGameState();
      return { success: true };
    },

    [ClientMsg.REVIVE_PLAYER]: (ws, payload) => {
      if (ws.clientType !== 'host') {
        return { success: false, error: 'Not host' };
      }
      const player = game.getPlayer(payload.playerId);
      if (player) {
        player.revive();
        game.broadcastGameState();
        return { success: true };
      }
      return { success: false, error: 'Player not found' };
    },

    [ClientMsg.SET_PLAYER_PORTRAIT]: (ws, payload) => {
      if (ws.clientType !== 'host') {
        return { success: false, error: 'Not host' };
      }
      const player = game.getPlayer(payload.playerId);
      if (player) {
        player.portrait = payload.portrait;
        game.broadcastPlayerList();
        return { success: true };
      }
      return { success: false, error: 'Player not found' };
    },
  };

  return handlers;
}

function send(ws, type, payload) {
  if (ws.readyState === 1) {
    ws.send(JSON.stringify({ type, payload }));
  }
}

export function handleMessage(handlers, ws, message) {
  let data;
  try {
    data = JSON.parse(message);
  } catch (e) {
    send(ws, ServerMsg.ERROR, { message: 'Invalid JSON' });
    return;
  }

  const { type, payload = {} } = data;
  const handler = handlers[type];

  if (!handler) {
    send(ws, ServerMsg.ERROR, { message: `Unknown message type: ${type}` });
    return;
  }

  try {
    const result = handler(ws, payload);
    if (result && !result.success && result.error) {
      send(ws, ServerMsg.ERROR, { message: result.error });
    }
  } catch (e) {
    console.error(`Error handling ${type}:`, e);
    send(ws, ServerMsg.ERROR, { message: 'Internal server error' });
  }
}
