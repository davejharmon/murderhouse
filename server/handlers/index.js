// server/handlers/index.js
// WebSocket message handlers

import {
  ClientMsg,
  ServerMsg,
  SlideType,
  SlideStyle,
  DEBUG_MODE,
  Team,
} from '../../shared/constants.js';
import { getEvent } from '../definitions/events.js';
import { getItem } from '../definitions/items.js';
import { getRole } from '../definitions/roles.js';
import { str } from '../strings.js';

// Wraps a handler so it only runs when the connection is authenticated as host.
function requireHost(fn) {
  return (ws, payload) => {
    if (ws.clientType !== 'host') return { success: false, error: 'Not host' }
    return fn(ws, payload)
  }
}

export function createHandlers(game, clients) {
  const handlers = {
    // === Connection Handlers ===

    [ClientMsg.JOIN]: (ws, payload) => {
      const { playerId, source, firmwareVersion } = payload;
      ws.source = source || 'web';
      if (firmwareVersion) ws.firmwareVersion = firmwareVersion;

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
          if (ws.source === 'terminal') {
            send(ws, ServerMsg.HEARTRATE_MONITOR, { enabled: game._isHeartrateNeeded(playerId) });
          }
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
        if (ws.source === 'terminal') {
          send(ws, ServerMsg.HEARTRATE_MONITOR, { enabled: game._isHeartrateNeeded(playerId) });
        }
      } else {
        send(ws, ServerMsg.ERROR, { message: result.error });
      }
      return result;
    },

    [ClientMsg.REJOIN]: (ws, payload) => {
      const { playerId, source, firmwareVersion } = payload;
      ws.source = source || 'web';
      if (firmwareVersion) ws.firmwareVersion = firmwareVersion;
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
        if (ws.source === 'terminal') {
          send(ws, ServerMsg.HEARTRATE_MONITOR, { enabled: game._isHeartrateNeeded(playerId) });
        }
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
      send(ws, ServerMsg.PLAYER_LIST, game.getPlayersBySeat().map(p => p.getPrivateState(game)));
      send(ws, ServerMsg.SLIDE_QUEUE, {
        queue: game.slideQueue,
        currentIndex: game.currentSlideIndex,
        current: game.getCurrentSlide(),
      });
      send(ws, ServerMsg.LOG, game.log.slice(-50));
      send(ws, ServerMsg.GAME_PRESETS, game.getGamePresets());
      send(ws, ServerMsg.HOST_SETTINGS, game.getHostSettings());
      send(ws, ServerMsg.SCORES, { scores: game.getScoresObject() });
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
          game.debouncedBroadcastGameState(); // Debounced - host updates after dial settles

          // Broadcast pack state for cell events (real-time selection sharing)
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
          game.debouncedBroadcastGameState(); // Debounced - host updates after dial settles

          // Broadcast pack state for cell events (real-time selection sharing)
          if (game.shouldBroadcastPackState(eventId, player)) {
            game.broadcastPackState();
          }

          return { success: true, selected };
        }
      }

      return { success: false, error: 'No active event' };
    },

    // Settle update from terminal: sets selection by targetId after dial stops moving.
    // No syncState — terminal already shows correct state; we only need server + pack in sync.
    [ClientMsg.SELECT_TO]: (ws, payload) => {
      const player = game.getPlayer(ws.playerId);
      if (!player) return { success: false, error: 'Not a player' };
      if (!payload?.targetId) return { success: false, error: 'Missing targetId' };

      player.currentSelection = payload.targetId;
      game.debouncedBroadcastGameState();

      for (const [eventId] of game.activeEvents) {
        if (game.shouldBroadcastPackState(eventId, player)) {
          game.broadcastPackState();
          break;
        }
      }

      return { success: true };
    },

    [ClientMsg.CONFIRM]: (ws, payload) => {
      const player = game.getPlayer(ws.playerId);
      if (!player) return { success: false, error: 'Not a player' };

      // ESP32 terminals send the explicit targetId to bypass stale server-side selection
      // (caused by rate-limited SELECT messages during rapid dial scrubbing)
      if (payload?.targetId) {
        player.currentSelection = payload.targetId;
      }

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

    [ClientMsg.IDLE_SCROLL_UP]: (ws) => {
      const player = game.getPlayer(ws.playerId);
      if (!player) return { success: false, error: 'Not a player' };
      if (!player.isAlive || player.pendingEvents.size > 0) {
        return { success: false, error: 'Cannot scroll now' };
      }

      player.idleScrollUp();
      player.syncState(game);
      return { success: true };
    },

    [ClientMsg.IDLE_SCROLL_DOWN]: (ws) => {
      const player = game.getPlayer(ws.playerId);
      if (!player) return { success: false, error: 'Not a player' };
      if (!player.isAlive || player.pendingEvents.size > 0) {
        return { success: false, error: 'Cannot scroll now' };
      }

      player.idleScrollDown();
      player.syncState(game);
      return { success: true };
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

      // Start the event for this player only — not all eligible participants
      const result = game.startEventForPlayer(itemDef.startsEvent, player.id);
      return result;
    },

    // === Host Actions ===

    [ClientMsg.START_GAME]: requireHost(() => game.startGame()),

    [ClientMsg.START_EVENT]: requireHost((ws, payload) => game.startEvent(payload.eventId)),

    [ClientMsg.START_ALL_EVENTS]: requireHost(() => game.startAllEvents()),

    [ClientMsg.CREATE_CUSTOM_EVENT]: requireHost((ws, payload) => {
      const { mechanism, rewardType, rewardParam, description } = payload;
      return game.createCustomEvent({
        mechanism: mechanism || 'vote',
        rewardType,
        rewardParam,
        description,
      });
    }),

    [ClientMsg.RESOLVE_EVENT]: requireHost((ws, payload) => game.resolveEvent(payload.eventId)),

    [ClientMsg.RESOLVE_ALL_EVENTS]: requireHost(() => game.resolveAllEvents()),

    [ClientMsg.SKIP_EVENT]: requireHost((ws, payload) => game.skipEvent(payload.eventId)),

    [ClientMsg.RESET_EVENT]: requireHost((ws, payload) => game.resetEvent(payload.eventId)),

    [ClientMsg.START_EVENT_TIMER]: requireHost((ws, payload) => game.startAllEventTimers(payload.duration)),

    [ClientMsg.NEXT_PHASE]: requireHost(() => game.nextPhase()),

    [ClientMsg.END_GAME]: requireHost((ws, payload) => {
      game.endGame(payload?.winner || null);
      return { success: true };
    }),

    [ClientMsg.RESET_GAME]: requireHost(() => {
      game.reset();

      // Re-add connected player clients to the new lobby
      for (const client of clients) {
        if (client.readyState !== 1 || client.clientType !== 'player' || !client.playerId) continue;
        const existing = game.getPlayer(client.playerId);
        if (existing) {
          // Additional connection for same player (e.g. web + terminal)
          existing.addConnection(client);
        } else {
          const result = game.addPlayer(client.playerId, client);
          if (!result.success) continue;
        }
        const player = game.getPlayer(client.playerId);
        send(client, ServerMsg.WELCOME, {
          playerId: client.playerId,
          player: player.getPrivateState(game),
        });
        send(client, ServerMsg.PLAYER_STATE, player.getPrivateState(game));
        if (client.source === 'terminal') {
          send(client, ServerMsg.HEARTRATE_MONITOR, { enabled: game._isHeartrateNeeded(client.playerId) });
        }
      }

      // Broadcast updated state to all
      game.broadcastGameState();
      game.broadcastPlayerList();
      game.broadcastSlides();
      return { success: true };
    }),

    // === Slide Controls ===

    // Only host can advance slides (screens no longer auto-advance)
    [ClientMsg.NEXT_SLIDE]: requireHost(() => {
      game.nextSlide();
      return { success: true };
    }),

    [ClientMsg.PREV_SLIDE]: requireHost(() => {
      game.prevSlide();
      return { success: true };
    }),

    [ClientMsg.PUSH_SLIDE]: requireHost((ws, payload) => {
      game.pushSlide(payload.slide, payload.jumpTo);
      return { success: true };
    }),

    [ClientMsg.CLEAR_SLIDES]: requireHost(() => {
      game.clearSlides();
      return { success: true };
    }),

    // === Player Management ===

    [ClientMsg.CHANGE_ROLE]: requireHost((ws, payload) => {
      const player = game.getPlayer(payload.playerId);
      if (!player) return { success: false, error: 'Player not found' };
      const role = getRole(payload.roleId);
      if (!role) return { success: false, error: 'Role not found' };
      const oldRoleName = player.role?.name || 'None';
      player.assignRole(role);
      game._invalidateWinCache(); // Team may have changed
      game.addLog(str('log', 'roleChanged', { name: player.getNameWithEmoji(), old: oldRoleName, new: role.name }));
      game.broadcastGameState();
      return { success: true };
    }),

    [ClientMsg.PRE_ASSIGN_ROLE]: requireHost((ws, payload) => game.preAssignRole(payload.playerId, payload.roleId)),

    [ClientMsg.RANDOMIZE_ROLES]: requireHost(() => game.randomizeRoles()),

    [ClientMsg.KICK_PLAYER]: requireHost((ws, payload) => game.removePlayer(payload.playerId)),

    [ClientMsg.KILL_PLAYER]: requireHost((ws, payload) => {
      const player = game.getPlayer(payload.playerId);
      if (!player) return { success: false, error: 'Player not found' };
      game.killPlayer(payload.playerId, 'host');
      game.addLog(str('log', 'killedByHost', { name: player.getNameWithEmoji() }));
      // Queue death slide (queueDeathSlide handles hunter revenge automatically)
      game.queueDeathSlide(game.createDeathSlide(player, 'host'), true);
      game.broadcastGameState();
      return { success: true };
    }),

    [ClientMsg.REVIVE_PLAYER]: requireHost((ws, payload) => {
      const player = game.getPlayer(payload.playerId);
      if (player) {
        game.revivePlayer(payload.playerId, 'host');
        game.broadcastGameState();
        return { success: true };
      }
      return { success: false, error: 'Player not found' };
    }),

    [ClientMsg.SET_PLAYER_PORTRAIT]: requireHost((ws, payload) => {
      // Validate portrait filename (alphanumeric + .png, no path traversal)
      if (!/^[a-zA-Z0-9_-]+\.png$/.test(payload.portrait)) {
        return { success: false, error: 'Invalid portrait' };
      }

      const player = game.getPlayer(payload.playerId);
      if (!player) return { success: false, error: 'Player not found' };

      player.portrait = payload.portrait;
      game.persistPlayerCustomization(player);
      game.broadcastPlayerList();
      return { success: true };
    }),

    [ClientMsg.GIVE_ITEM]: requireHost((ws, payload) => {
      const result = game.giveItem(payload.playerId, payload.itemId);
      if (result.success) {
        game.broadcastGameState();
      }
      return result;
    }),

    [ClientMsg.REMOVE_ITEM]: requireHost((ws, payload) => {
      const player = game.getPlayer(payload.playerId);
      if (!player) return { success: false, error: 'Player not found' };
      const removed = game.removeItem(payload.playerId, payload.itemId);
      if (removed) {
        game.addLog(str('log', 'itemRemoved', { name: player.getNameWithEmoji(), item: payload.itemId }));
        game.broadcastGameState();
        return { success: true };
      }
      return { success: false, error: 'Item not found in inventory' };
    }),

    // === Lobby Tutorial Slides ===

    [ClientMsg.PUSH_COMP_SLIDE]: requireHost(() => game.pushCompSlide()),

    [ClientMsg.PUSH_ROLE_TIP_SLIDE]: requireHost((ws, payload) => game.pushRoleTipSlide(payload.roleId)),

    [ClientMsg.PUSH_ITEM_TIP_SLIDE]: requireHost((ws, payload) => game.pushItemTipSlide(payload.itemId)),

    // === Game Presets ===

    [ClientMsg.LIST_GAME_PRESETS]: requireHost((ws) => {
      send(ws, ServerMsg.GAME_PRESETS, game.getGamePresets());
      return { success: true };
    }),

    [ClientMsg.SAVE_GAME_PRESET]: requireHost((ws, payload) => {
      const { name, timerDuration, autoAdvanceEnabled, fakeHeartbeats, overwriteId } = payload;
      game.saveGamePreset(name, timerDuration, autoAdvanceEnabled, fakeHeartbeats, overwriteId);
      send(ws, ServerMsg.GAME_PRESETS, game.getGamePresets());
      return { success: true };
    }),

    [ClientMsg.LOAD_GAME_PRESET]: requireHost((ws, payload) => {
      const result = game.loadGamePreset(payload.id);
      if (!result) return { success: false, error: 'Preset not found' };
      send(ws, ServerMsg.GAME_PRESET_LOADED, result);
      game.broadcastGameState();
      return { success: true };
    }),

    [ClientMsg.DELETE_GAME_PRESET]: requireHost((ws, payload) => {
      game.deleteGamePreset(payload.id);
      send(ws, ServerMsg.GAME_PRESETS, game.getGamePresets());
      return { success: true };
    }),

    // === Host Settings ===

    [ClientMsg.SAVE_HOST_SETTINGS]: requireHost((ws, payload) => {
      game.saveHostSettings(payload);
      return { success: true };
    }),

    [ClientMsg.SET_DEFAULT_PRESET]: requireHost((ws, payload) => {
      game.setDefaultPreset(payload.id);
      send(ws, ServerMsg.HOST_SETTINGS, game.getHostSettings());
      return { success: true };
    }),

    // === Heartbeat ===

    [ClientMsg.HEARTBEAT]: (ws, payload) => {
      const player = game.getPlayer(ws.playerId);
      if (!player) return { success: false, error: 'Not a player' };

      // Don't let real sensor overwrite simulated heartbeat
      const cal = game._hostSettings?.heartbeatCalibration?.[ws.playerId];
      if (cal?.simulated) {
        // Still collect calibration samples from real sensor if calibrating
        if (game._calibration) {
          const tmpHeartbeat = player.heartbeat;
          player.heartbeat = { ...tmpHeartbeat, bpm: payload.bpm || 0 };
          game.collectCalibrationSample(player);
          player.heartbeat = tmpHeartbeat;
        }
        return { success: true };
      }

      player.heartbeat = {
        bpm: payload.bpm || 0,
        active: (payload.bpm || 0) > 0,
        fake: payload.fake === true,
        lastUpdate: Date.now(),
      };
      // Collect calibration sample if calibration is active
      if (game._calibration) {
        game.collectCalibrationSample(player);
        game._broadcastCalibrationState();
      }
      game._checkHeartbeatModeSpike(player);
      game.broadcastGameState();
      return { success: true };
    },

    [ClientMsg.TOGGLE_HEARTBEAT_MODE]: requireHost(() => game.toggleHeartbeatMode()),
    [ClientMsg.TOGGLE_FAKE_HEARTBEATS]: requireHost(() => game.toggleFakeHeartbeats()),

    // Heartbeat calibration
    [ClientMsg.START_CALIBRATION]: requireHost(() => {
      const playerIds = [...game.players.values()]
        .filter(p => p.heartbeat?.active || p.heartbeat?.fake)
        .map(p => p.id);
      if (!playerIds.length) return { success: false, error: 'No active sensors' };
      return game.startCalibration(playerIds);
    }),
    [ClientMsg.START_SINGLE_CALIBRATION]: requireHost((ws, payload) => {
      if (!payload.playerId) return { success: false, error: 'No player specified' };
      return game.startSingleCalibration(payload.playerId);
    }),
    [ClientMsg.STOP_CALIBRATION]: requireHost(() => game.stopCalibration()),
    [ClientMsg.SAVE_CALIBRATION]: requireHost(() => game.saveCalibration()),
    [ClientMsg.TOGGLE_PLAYER_HEARTBEAT]: requireHost((ws, payload) => {
      if (!payload.playerId) return { success: false, error: 'No player specified' };
      return game.togglePlayerHeartbeat(payload.playerId);
    }),
    [ClientMsg.SET_PLAYER_CALIBRATION]: requireHost((ws, payload) => {
      if (!payload.playerId) return { success: false, error: 'No player specified' };
      return game.setPlayerCalibration(payload.playerId, payload.restingBpm, payload.elevatedBpm);
    }),
    [ClientMsg.TOGGLE_PLAYER_SIMULATED]: requireHost((ws, payload) => {
      if (!payload.playerId) return { success: false, error: 'No player specified' };
      return game.togglePlayerSimulated(payload.playerId);
    }),

    [ClientMsg.PUSH_HEARTBEAT_SLIDE]: requireHost((ws, payload) => {
      const player = game.getPlayer(payload.playerId);
      if (!player) return { success: false, error: 'Player not found' };
      const bpm = player.heartbeat?.bpm || 0;
      const fake = player.heartbeat?.fake ?? false;
      game.pushSlide({
        type: SlideType.HEARTBEAT,
        playerId: payload.playerId,
        playerName: player.name,
        portrait: player.portrait,
        bpm,
        fake,
        style: SlideStyle.HOSTILE,
      }, true);
      return { success: true };
    }),

    // === Operator Terminal ===

    [ClientMsg.OPERATOR_JOIN]: (ws) => {
      ws.clientType = 'operator';
      send(ws, ServerMsg.WELCOME, { role: 'operator' });
      send(ws, ServerMsg.OPERATOR_STATE, game.getOperatorState());
      return { success: true };
    },

    [ClientMsg.OPERATOR_ADD]: (ws, payload) => {
      if (!payload.word || typeof payload.word !== 'string') {
        return { success: false, error: 'Invalid word' };
      }
      game.operatorAdd(payload.word);
      return { success: true };
    },

    [ClientMsg.OPERATOR_DELETE]: () => {
      game.operatorDelete();
      return { success: true };
    },

    [ClientMsg.OPERATOR_READY]: () => {
      game.operatorSetReady(true);
      return { success: true };
    },

    [ClientMsg.OPERATOR_UNREADY]: () => {
      game.operatorSetReady(false);
      return { success: true };
    },

    [ClientMsg.OPERATOR_CLEAR]: () => {
      game.operatorClear();
      return { success: true };
    },

    [ClientMsg.OPERATOR_SEND]: requireHost(() => {
      game.operatorSend();
      return { success: true };
    }),

    // === Scores ===

    [ClientMsg.SET_SCORE]: requireHost((ws, payload) => {
      if (typeof payload.name !== 'string' || typeof payload.score !== 'number') {
        return { success: false, error: 'Invalid payload' };
      }
      game.setScore(payload.name, payload.score);
      return { success: true };
    }),

    [ClientMsg.PUSH_SCORE_SLIDE]: requireHost(() => {
      game.pushScoreSlide();
      return { success: true };
    }),

    // === Firmware Update ===

    [ClientMsg.TRIGGER_FIRMWARE_UPDATE]: requireHost(() => {
      // Send UPDATE_FIRMWARE to all terminal connections
      let updated = 0;
      for (const player of game.players.values()) {
        for (const ws of player.connections) {
          if (ws && ws.readyState === 1 && ws.source === 'terminal') {
            ws.send(JSON.stringify({ type: ServerMsg.UPDATE_FIRMWARE, payload: {} }));
            updated++;
          }
        }
      }
      console.log(`[Firmware] Triggered OTA update on ${updated} terminal(s)`);
      return { success: true, terminalsUpdated: updated };
    }),

    // === Debug Actions ===

    [ClientMsg.DEBUG_AUTO_SELECT]: requireHost((ws, payload) => {
      if (!DEBUG_MODE) return { success: false, error: 'Debug mode not enabled' };

      const player = game.getPlayer(payload.playerId);
      if (!player) return { success: false, error: 'Player not found' };

      // Find active event for this player
      let eventId = null;
      for (const [eid, instance] of game.activeEvents) {
        if (instance.participants.includes(player.id)) {
          eventId = eid;
          break;
        }
      }

      if (!eventId) return { success: false, error: 'Player has no active event' };

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
    }),

    [ClientMsg.DEBUG_AUTO_SELECT_ALL]: requireHost((ws, payload) => {
      if (!DEBUG_MODE) return { success: false, error: 'Debug mode not enabled' };

      const { eventId } = payload;
      const instance = game.activeEvents.get(eventId);
      if (!instance) return { success: false, error: 'Event not active' };

      const { event, participants, results } = instance;
      let autoSelectedCount = 0;

      // Auto-select for all participants who haven't locked in a selection
      for (const playerId of participants) {
        const player = game.getPlayer(playerId);
        if (!player) continue;

        // Skip if player already has a result recorded
        if (playerId in results) continue;

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
    }),
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
