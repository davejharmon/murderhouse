// server/handlers/index.js
// WebSocket message handlers

import {
  ClientMsg,
  ServerMsg,
  DEBUG_MODE,
  Team,
} from '../../shared/constants.js';
import { getEvent } from '../definitions/events.js';
import { getItem } from '../definitions/items.js';

export function createHandlers(game) {
  const handlers = {
    // === Connection Handlers ===

    [ClientMsg.JOIN]: (ws, payload) => {
      const { playerId, source } = payload;
      ws.source = source || 'web';

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
            player: existing.getPrivateState(game),
          });
          send(ws, ServerMsg.GAME_STATE, game.getGameState());
          send(ws, ServerMsg.PLAYER_STATE, existing.getPrivateState(game));
          // Notify others of reconnection - broadcastGameState after broadcastPlayerList
          // ensures host gets role info (PLAYER_LIST only has public state)
          game.broadcastPlayerList();
          game.broadcastGameState();
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
          player: result.player.getPrivateState(game),
        });
        send(ws, ServerMsg.GAME_STATE, game.getGameState());
        send(ws, ServerMsg.PLAYER_STATE, result.player.getPrivateState(game));
      } else {
        send(ws, ServerMsg.ERROR, { message: result.error });
      }
      return result;
    },

    [ClientMsg.REJOIN]: (ws, payload) => {
      const { playerId, source } = payload;
      ws.source = source || 'web';
      const result = game.reconnectPlayer(playerId, ws);

      if (result.success) {
        ws.playerId = playerId;
        ws.clientType = 'player';
        send(ws, ServerMsg.WELCOME, {
          playerId,
          reconnected: true,
          player: result.player.getPrivateState(game),
        });
        send(ws, ServerMsg.GAME_STATE, game.getGameState());
        send(ws, ServerMsg.PLAYER_STATE, result.player.getPrivateState(game));
        // Notify others of reconnection - broadcastGameState after broadcastPlayerList
        // ensures host gets role info (PLAYER_LIST only has public state)
        game.broadcastPlayerList();
        game.broadcastGameState();
      } else {
        send(ws, ServerMsg.ERROR, { message: result.error });
      }
      return result;
    },

    [ClientMsg.HOST_CONNECT]: (ws) => {
      game.host = ws;
      ws.clientType = 'host';
      send(ws, ServerMsg.WELCOME, { role: 'host' });
      send(ws, ServerMsg.GAME_STATE, game.getGameState({ audience: 'host' }));
      send(ws, ServerMsg.PLAYER_LIST, game.getPlayersBySeat().map(p => p.getPublicState()));
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
      send(ws, ServerMsg.GAME_STATE, game.getGameState());
      send(ws, ServerMsg.SLIDE, game.getCurrentSlide());
      return { success: true };
    },

    // === Player Actions ===

    [ClientMsg.SET_NAME]: (ws, payload) => {
      // Allow both players to set their own name and hosts to set any player's name
      let player;
      if (ws.clientType === 'host' && payload.playerId) {
        // Host setting a player's name
        player = game.getPlayer(payload.playerId);
      } else {
        // Player setting their own name
        player = game.getPlayer(ws.playerId);
      }

      if (!player) return { success: false, error: 'Player not found' };

      player.name = payload.name.slice(0, 20); // Max 20 chars
      game.persistPlayerCustomization(player);
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

          player.syncState(game);
          game.broadcastGameState(); // Update host with selection changes

          // Broadcast pack state for werewolf events (real-time selection sharing)
          if (game.shouldBroadcastPackState(eventId, player)) {
            game.broadcastPackState();
          }

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

          player.syncState(game);
          game.broadcastGameState(); // Update host with selection changes

          // Broadcast pack state for werewolf events (real-time selection sharing)
          if (game.shouldBroadcastPackState(eventId, player)) {
            game.broadcastPackState();
          }

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
      player.syncState(game);

      return result;
    },

    [ClientMsg.CANCEL]: (ws) => {
      const player = game.getPlayer(ws.playerId);
      if (!player) return { success: false, error: 'Not a player' };

      player.cancelSelection();
      player.syncState(game);

      return { success: true };
    },

    [ClientMsg.ABSTAIN]: (ws) => {
      const player = game.getPlayer(ws.playerId);
      if (!player) return { success: false, error: 'Not a player' };

      // Find player's active event and check if abstaining is allowed
      for (const [eventId, instance] of game.activeEvents) {
        if (instance.participants.includes(player.id)) {
          if (!instance.event.allowAbstain) {
            return { success: false, error: 'Cannot abstain from this event' };
          }
          break;
        }
      }

      player.abstain();
      const result = game.recordSelection(player.id, null);
      player.syncState(game);

      return result;
    },

    [ClientMsg.USE_ITEM]: (ws, payload) => {
      const player = game.getPlayer(ws.playerId);
      if (!player) return { success: false, error: 'Not a player' };

      const { itemId } = payload;

      // Check if player has the item
      if (!player.hasItem(itemId)) {
        return { success: false, error: 'Item not in inventory' };
      }

      // Check if item can be used
      if (!player.canUseItem(itemId)) {
        return { success: false, error: 'Item has no uses remaining' };
      }

      // Get item definition and check if it starts an event
      const itemDef = getItem(itemId);
      if (!itemDef?.startsEvent) {
        return { success: false, error: 'Item cannot be activated' };
      }

      // Start the event (this will check phase, participants, etc.)
      const result = game.startEvent(itemDef.startsEvent);
      return result;
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

    [ClientMsg.CREATE_CUSTOM_EVENT]: (ws, payload) => {
      if (ws.clientType !== 'host') {
        return { success: false, error: 'Not host' };
      }

      const { mechanism, rewardType, rewardParam, description } = payload;

      return game.createCustomEvent({
        mechanism: mechanism || 'vote',
        rewardType,
        rewardParam,
        description,
      });
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

    [ClientMsg.SKIP_EVENT]: (ws, payload) => {
      if (ws.clientType !== 'host') {
        return { success: false, error: 'Not host' };
      }
      return game.skipEvent(payload.eventId);
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
      // Only host can advance slides (screens no longer auto-advance)
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
      const player = game.getPlayer(payload.playerId);
      if (!player) {
        return { success: false, error: 'Player not found' };
      }
      game.killPlayer(payload.playerId, 'host');
      game.addLog(`${player.getNameWithEmoji()} killed by host`);
      // Queue death slide (queueDeathSlide handles hunter revenge automatically)
      game.queueDeathSlide(game.createDeathSlide(player, 'host'), true);
      game.broadcastGameState();
      return { success: true };
    },

    [ClientMsg.REVIVE_PLAYER]: (ws, payload) => {
      if (ws.clientType !== 'host') {
        return { success: false, error: 'Not host' };
      }
      const player = game.getPlayer(payload.playerId);
      if (player) {
        game.revivePlayer(payload.playerId, 'host');
        game.broadcastGameState();
        return { success: true };
      }
      return { success: false, error: 'Player not found' };
    },

    [ClientMsg.SET_PLAYER_PORTRAIT]: (ws, payload) => {
      if (ws.clientType !== 'host') {
        return { success: false, error: 'Not host' };
      }

      // Validate portrait filename
      const validPortraits = [
        'player1.png',
        'player2.png',
        'player3.png',
        'player4.png',
        'player5.png',
        'player6.png',
        'player7.png',
        'player8.png',
        'player9.png',
        'playerA.png',
        'anon.png',
      ];
      if (!validPortraits.includes(payload.portrait)) {
        return { success: false, error: 'Invalid portrait' };
      }

      const player = game.getPlayer(payload.playerId);
      if (!player) {
        return { success: false, error: 'Player not found' };
      }

      player.portrait = payload.portrait;
      game.persistPlayerCustomization(player);
      game.broadcastPlayerList();
      return { success: true };
    },

    [ClientMsg.GIVE_ITEM]: (ws, payload) => {
      if (ws.clientType !== 'host') {
        return { success: false, error: 'Not host' };
      }
      const result = game.giveItem(payload.playerId, payload.itemId);
      if (result.success) {
        game.broadcastGameState();
      }
      return result;
    },

    [ClientMsg.REMOVE_ITEM]: (ws, payload) => {
      if (ws.clientType !== 'host') {
        return { success: false, error: 'Not host' };
      }
      const player = game.getPlayer(payload.playerId);
      if (!player) {
        return { success: false, error: 'Player not found' };
      }
      const removed = player.removeItem(payload.itemId);
      if (removed) {
        game.addLog(`${player.getNameWithEmoji()} lost ${payload.itemId}`);
        game.broadcastGameState();
        return { success: true };
      }
      return { success: false, error: 'Item not found in inventory' };
    },

    // === Player Presets ===

    [ClientMsg.SAVE_PLAYER_PRESETS]: (ws) => {
      if (ws.clientType !== 'host') {
        return { success: false, error: 'Not host' };
      }
      const count = game.savePlayerPresets();
      return { success: true, count };
    },

    [ClientMsg.LOAD_PLAYER_PRESETS]: (ws) => {
      if (ws.clientType !== 'host') {
        return { success: false, error: 'Not host' };
      }
      const count = game.loadPlayerPresets();
      return { success: true, count };
    },

    // === Debug Actions ===

    [ClientMsg.DEBUG_AUTO_SELECT]: (ws, payload) => {
      if (!DEBUG_MODE) {
        return { success: false, error: 'Debug mode not enabled' };
      }
      if (ws.clientType !== 'host') {
        return { success: false, error: 'Not host' };
      }

      const player = game.getPlayer(payload.playerId);
      if (!player) {
        return { success: false, error: 'Player not found' };
      }

      // Find active event for this player
      let eventId = null;
      for (const [eid, instance] of game.activeEvents) {
        if (instance.participants.includes(player.id)) {
          eventId = eid;
          break;
        }
      }

      if (!eventId) {
        return { success: false, error: 'Player has no active event' };
      }

      const instance = game.activeEvents.get(eventId);
      const event = instance.event;
      const targets = event.validTargets(player, game);

      if (targets.length === 0) {
        // No targets, just abstain
        player.abstain();
        game.recordSelection(player.id, null);
        return { success: true, action: 'abstained' };
      }

      // Pick random target
      const randomTarget = targets[Math.floor(Math.random() * targets.length)];
      player.currentSelection = randomTarget.id;
      player.confirmSelection();
      game.recordSelection(player.id, randomTarget.id);

      return { success: true, action: 'selected', targetId: randomTarget.id };
    },

    [ClientMsg.DEBUG_AUTO_SELECT_ALL]: (ws, payload) => {
      if (!DEBUG_MODE) {
        return { success: false, error: 'Debug mode not enabled' };
      }
      if (ws.clientType !== 'host') {
        return { success: false, error: 'Not host' };
      }

      const { eventId } = payload;
      const instance = game.activeEvents.get(eventId);
      if (!instance) {
        return { success: false, error: 'Event not active' };
      }

      const { event, participants, results } = instance;
      let autoSelectedCount = 0;

      // Auto-select for all participants who haven't locked in a selection
      for (const playerId of participants) {
        const player = game.getPlayer(playerId);
        if (!player) continue;

        // Skip if player already has confirmed selection or abstained
        if (player.confirmedSelection || player.abstained) continue;

        const targets = event.validTargets(player, game);

        if (targets.length === 0) {
          // No targets, abstain
          player.abstain();
          game.recordSelection(player.id, null);
          autoSelectedCount++;
        } else {
          // Pick random target
          const randomTarget =
            targets[Math.floor(Math.random() * targets.length)];
          player.currentSelection = randomTarget.id;
          player.confirmSelection();
          game.recordSelection(player.id, randomTarget.id);
          autoSelectedCount++;
        }
      }

      return { success: true, autoSelectedCount };
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
    console.error(`[Server] Error handling ${type}:`, e);
    send(ws, ServerMsg.ERROR, { message: 'Internal server error' });
  }
}
