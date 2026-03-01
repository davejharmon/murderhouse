// server/Game.js
// Core game state machine and logic

import {
  GamePhase,
  Team,
  PlayerStatus,
  ServerMsg,
  EventId,
  RoleId,
  ItemId,
  SlideStyle,
  SlideType,
  ITEM_DISPLAY,
  MIN_PLAYERS,
  MAX_PLAYERS,
} from '../shared/constants.js';
import { Player, resetSeatCounter } from './Player.js';
import {
  getRole,
  buildRolePool,
  GAME_COMPOSITION,
} from './definitions/roles.js';
import { getEvent, getEventsForPhase } from './definitions/events.js';
import { getItem } from './definitions/items.js';
import { HunterRevengeFlow, GovernorPardonFlow } from './flows/index.js';
import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GAME_PRESETS_PATH = path.join(__dirname, 'game-presets.json');
const HOST_SETTINGS_PATH = path.join(__dirname, 'host-settings.json');

export class Game {
  constructor(broadcast, sendToHostFn, sendToScreenFn) {
    this.broadcast = broadcast; // Function to send to all clients
    this._sendToHost = sendToHostFn; // Function to find & send to host from clients set
    this._sendToScreen = sendToScreenFn; // Function to find & send to screen from clients set
    this.host = null; // Legacy reference (kept for handler compat)
    this.slideIdCounter = 0; // Unique ID counter for slides
    this.screen = null; // Legacy reference (kept for handler compat)
    this.playerCustomizations = new Map(); // Persist player names/portraits across resets

    // Initialize interrupt flows (these persist across resets)
    this.flows = new Map([
      [HunterRevengeFlow.id, new HunterRevengeFlow(this)],
      [GovernorPardonFlow.id, new GovernorPardonFlow(this)],
    ]);

    // Death processing queue (prevents recursive killPlayer cascades)
    this._deathQueue = [];
    this._processingDeaths = false;

    // Debounced broadcast for rapid dial input (selection changes)
    this._broadcastDebounceTimer = null;

    this.presetRolePool = null;

    this.reset();
    this._loadGamePresetsFromDisk();
    this._loadHostSettingsFromDisk();

    // Auto-load default preset if one is set
    if (this._hostSettings.defaultPresetId) {
      this.loadGamePreset(this._hostSettings.defaultPresetId);
    }
  }

  reset() {
    // Save player customizations before clearing (if players exist)
    if (this.players) {
      for (const [playerId, player] of this.players) {
        this.playerCustomizations.set(playerId, {
          name: player.name,
          portrait: player.portrait,
          preAssignedRole: player.preAssignedRole || null,
        });
      }
    }

    // Clear any running event timers
    if (this.eventTimers) {
      for (const { timeout } of this.eventTimers.values()) {
        clearTimeout(timeout);
      }
    }
    this.eventTimers = new Map();

    resetSeatCounter();
    this.players = new Map(); // id -> Player
    // NOTE: We keep host and screen connections alive during reset
    // Only clear them if explicitly needed (not during game reset)

    this.phase = GamePhase.LOBBY;
    this.dayCount = 0;

    // Event management
    this.pendingEvents = []; // Events that can be started this phase
    this.activeEvents = new Map(); // eventId -> { event, results, participants }
    this.eventResults = []; // Results to reveal at end of phase
    this.customEventConfig = null; // Stored config for pending custom events

    // Slide queue for big screen
    this.slideQueue = [];
    this.currentSlideIndex = -1;

    // Legacy interrupt handling (flows now manage their own state)
    // Kept for backwards compatibility during transition
    this.interruptData = null;

    // Reset all flows
    if (this.flows) {
      for (const flow of this.flows.values()) {
        flow.cleanup();
      }
    }

    // Janitor cleaning flag (set by clean event, read by kill event)
    this.janitorCleaning = false;

    // Poisoner flag (set by poison event, read by kill event)
    this.poisonerActing = false;

    // Death processing queue
    this._deathQueue = [];
    this._processingDeaths = false;

    // Slide count at start of night phase (for detecting silent nights)
    this._nightStartSlideCount = 0;

    // Log
    this.log = [];
  }

  // === Player Management ===

  addPlayer(id, ws) {
    if (this.players.size >= MAX_PLAYERS) {
      return { success: false, error: 'Game is full' };
    }
    if (this.phase !== GamePhase.LOBBY) {
      return { success: false, error: 'Game already in progress' };
    }

    const player = new Player(id, ws);

    // Restore customizations if they exist from previous games
    const customization = this.playerCustomizations.get(id);
    if (customization) {
      player.name = customization.name;
      player.portrait = customization.portrait;
      if (this.phase === GamePhase.LOBBY && customization.preAssignedRole) {
        player.preAssignedRole = customization.preAssignedRole;
      }
    }

    this.players.set(id, player);

    const via = ws.source === 'terminal' ? 'terminal' : 'web';
    this.addLog(`${player.name} joined via ${via}`);
    this.broadcastPlayerList();

    return { success: true, player };
  }

  persistPlayerCustomization(player) {
    const customization = this.playerCustomizations.get(player.id) || {};
    this.playerCustomizations.set(player.id, {
      ...customization,
      name: player.name,
      portrait: player.portrait,
      preAssignedRole: player.preAssignedRole || customization.preAssignedRole || null,
    });
  }

  // === Host Settings ===

  _loadHostSettingsFromDisk() {
    const defaults = { timerDuration: 30, autoAdvanceEnabled: false };
    if (!fs.existsSync(HOST_SETTINGS_PATH)) {
      this._hostSettings = defaults;
      return;
    }
    try {
      this._hostSettings = { ...defaults, ...JSON.parse(fs.readFileSync(HOST_SETTINGS_PATH, 'utf-8')) };
    } catch (e) {
      console.error('[Server] Failed to load host settings:', e.message);
      this._hostSettings = defaults;
    }
  }

  getHostSettings() {
    return { ...this._hostSettings };
  }

  saveHostSettings(settings) {
    this._hostSettings = { ...this._hostSettings, ...settings };
    fs.writeFileSync(HOST_SETTINGS_PATH, JSON.stringify(this._hostSettings, null, 2));
  }

  setDefaultPreset(id) {
    // Toggle off if already the default
    const defaultPresetId = this._hostSettings.defaultPresetId === id ? null : id;
    this.saveHostSettings({ defaultPresetId });
  }

  // === Game Presets ===

  _loadGamePresetsFromDisk() {
    if (!fs.existsSync(GAME_PRESETS_PATH)) {
      this._gamePresets = [];
      return;
    }
    try {
      const data = JSON.parse(fs.readFileSync(GAME_PRESETS_PATH, 'utf-8'));
      this._gamePresets = data.presets || [];
    } catch (e) {
      console.error('[Server] Failed to load game presets:', e.message);
      this._gamePresets = [];
    }
  }

  _saveGamePresetsToDisk() {
    fs.writeFileSync(GAME_PRESETS_PATH, JSON.stringify({ presets: this._gamePresets }, null, 2));
  }

  getGamePresets() {
    return { presets: this._gamePresets };
  }

  saveGamePreset(name, timerDuration, autoAdvanceEnabled, overwriteId = null) {
    // Capture current player customizations (names + portraits)
    const players = {};
    for (const [id, cust] of this.playerCustomizations) {
      if (cust.name || cust.portrait) {
        players[id] = { name: cust.name, portrait: cust.portrait };
      }
    }
    for (const player of this.players.values()) {
      players[player.id] = { name: player.name, portrait: player.portrait };
    }

    // Capture role configuration
    const playerCount = this.players.size;
    const hasPreAssigned = [...this.players.values()].some(p => p.preAssignedRole);
    let roleMode, rolePool, roleAssignments;
    if (hasPreAssigned) {
      roleMode = 'assigned';
      roleAssignments = {};
      for (const player of this.getPlayersBySeat()) {
        if (player.preAssignedRole) roleAssignments[player.id] = player.preAssignedRole;
      }
      rolePool = null;
    } else if (playerCount >= 4 && GAME_COMPOSITION[playerCount]) {
      roleMode = 'random';
      rolePool = buildRolePool(playerCount);
      roleAssignments = null;
    } else {
      roleMode = 'random';
      rolePool = null;
      roleAssignments = null;
    }

    if (overwriteId) {
      const index = this._gamePresets.findIndex(p => p.id === overwriteId);
      if (index !== -1) {
        this._gamePresets[index] = { ...this._gamePresets[index], name, players, roleMode, rolePool, roleAssignments, timerDuration, autoAdvanceEnabled };
        this._saveGamePresetsToDisk();
        this.addLog(`Updated game preset: ${name}`);
        return this._gamePresets[index];
      }
    }

    const preset = {
      id: String(Date.now()),
      name: name.trim() || 'Unnamed Preset',
      created: Date.now(),
      players,
      roleMode,
      rolePool,
      roleAssignments,
      timerDuration,
      autoAdvanceEnabled,
    };

    this._gamePresets.push(preset);
    this._saveGamePresetsToDisk();
    this.addLog(`Saved game preset: ${preset.name}`);
    return preset;
  }

  loadGamePreset(id) {
    const preset = this._gamePresets.find(p => p.id === id);
    if (!preset) return null;

    // Apply player customizations (names + portraits)
    for (const [playerId, data] of Object.entries(preset.players)) {
      const existing = this.playerCustomizations.get(playerId) || {};
      this.playerCustomizations.set(playerId, {
        ...existing,
        name: data.name,
        portrait: data.portrait,
      });
      const player = this.players.get(playerId);
      if (player) {
        player.name = data.name;
        player.portrait = data.portrait;
      }
    }

    // Clear all existing pre-assignments
    for (const [id, cust] of this.playerCustomizations) {
      this.playerCustomizations.set(id, { ...cust, preAssignedRole: null });
    }
    for (const player of this.players.values()) {
      player.preAssignedRole = null;
    }

    // Apply role configuration
    const roleMode = preset.roleMode || 'random'; // backward-compat: old presets had only rolePool
    if (roleMode === 'assigned' && preset.roleAssignments) {
      for (const [seatId, roleId] of Object.entries(preset.roleAssignments)) {
        const cust = this.playerCustomizations.get(seatId) || {};
        this.playerCustomizations.set(seatId, { ...cust, preAssignedRole: roleId });
        const player = this.players.get(seatId);
        if (player) player.preAssignedRole = roleId;
      }
      this.presetRolePool = null;
    } else {
      this.presetRolePool = preset.rolePool || null;
    }

    // Persist timer/auto-advance and which preset is loaded
    this.saveHostSettings({
      timerDuration: preset.timerDuration,
      autoAdvanceEnabled: preset.autoAdvanceEnabled,
      lastLoadedPresetId: preset.id,
    });

    if (this.players.size > 0) {
      this.broadcastPlayerList();
      this.broadcastGameState();
    }
    this.addLog(`Loaded game preset: ${preset.name}`);
    return { timerDuration: preset.timerDuration, autoAdvanceEnabled: preset.autoAdvanceEnabled };
  }

  deleteGamePreset(id) {
    const index = this._gamePresets.findIndex(p => p.id === id);
    if (index === -1) return false;
    const name = this._gamePresets[index].name;
    this._gamePresets.splice(index, 1);
    this._saveGamePresetsToDisk();
    this.addLog(`Deleted game preset: ${name}`);
    return true;
  }

  removePlayer(id) {
    const player = this.players.get(id);
    if (!player) return { success: false, error: 'Player not found' };

    this.players.delete(id);
    this.addLog(`${player.name} left`);
    this.broadcastPlayerList();

    return { success: true };
  }

  getPlayer(id) {
    return this.players.get(id) || null;
  }

  getAlivePlayers() {
    return [...this.players.values()].filter((p) => p.isAlive);
  }

  getPlayersBySeat() {
    return [...this.players.values()].sort(
      (a, b) => a.seatNumber - b.seatNumber,
    );
  }

  reconnectPlayer(id, ws) {
    const player = this.players.get(id);
    if (!player) return { success: false, error: 'Player not found' };

    const wasConnected = player.connected;
    const hadTerminal = player.terminalConnected;
    player.setConnection(ws);

    const via = ws.source === 'terminal' ? 'terminal' : 'web';
    if (!wasConnected) {
      this.addLog(`${player.name} reconnected via ${via}`);
    } else if (ws.source === 'terminal' && !hadTerminal) {
      this.addLog(`${player.name} terminal connected`);
    }

    return { success: true, player };
  }

  // === Game Flow ===

  startGame() {
    if (this.phase !== GamePhase.LOBBY) {
      return { success: false, error: 'Game already started' };
    }
    if (this.players.size < MIN_PLAYERS) {
      return { success: false, error: `Need at least ${MIN_PLAYERS} players` };
    }

    // Validate pre-assigned composition before assigning
    const validation = this._validateComposition();
    if (!validation.valid) {
      this.addLog(`Cannot start: ${validation.error}`);
      return { success: false, error: validation.error };
    }

    // Assign roles
    this.assignRoles();

    // Set tutorial tips for each player
    this._setTutorialTips();

    // Start day 1
    this.phase = GamePhase.DAY;
    this.dayCount = 1;

    // Send role reveals to each player
    for (const player of this.players.values()) {
      player.syncState(this);
    }

    // Build pending events for this phase
    this.buildPendingEvents();

    // Flag role reveal so each player's first idle shows CRITICAL blink
    for (const player of this.players.values()) {
      if (player.isAlive) player.roleRevealPending = true;
    }

    this.addLog('Game started — Day 1');
    this.pushSlide({
      type: 'gallery',
      title: 'DAY 1',
      subtitle: 'The game begins.',
      playerIds: this.getAlivePlayers().map((p) => p.id),
      style: SlideStyle.NEUTRAL,
    });

    this.broadcastGameState();

    return { success: true };
  }

  preAssignRole(playerId, roleId) {
    if (this.phase !== GamePhase.LOBBY) {
      return { success: false, error: 'Can only pre-assign roles in lobby' };
    }
    const player = this.getPlayer(playerId);
    if (!player) {
      return { success: false, error: 'Player not found' };
    }
    // null/empty means clear pre-assignment
    player.preAssignedRole = roleId || null;
    this.broadcastPlayerList();
    this.broadcastGameState();
    return { success: true };
  }

  randomizeRoles() {
    if (this.phase !== GamePhase.LOBBY) {
      return { success: false, error: 'Can only randomize roles in lobby' };
    }

    // Collect all pre-assigned roles
    const roles = [];
    for (const player of this.players.values()) {
      if (player.preAssignedRole) {
        roles.push(player.preAssignedRole);
      }
      player.preAssignedRole = null;
    }

    if (roles.length === 0) {
      return { success: false, error: 'No roles to randomize' };
    }

    // Fisher-Yates shuffle roles
    for (let i = roles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [roles[i], roles[j]] = [roles[j], roles[i]];
    }

    // Shuffle players
    const playerList = [...this.players.values()];
    for (let i = playerList.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [playerList[i], playerList[j]] = [playerList[j], playerList[i]];
    }

    // Assign shuffled roles to first N players
    for (let i = 0; i < roles.length; i++) {
      playerList[i].preAssignedRole = roles[i];
    }

    this.addLog(`Roles randomized`);
    this.broadcastPlayerList();
    this.broadcastGameState();
    return { success: true };
  }

  assignRoles() {
    const playerCount = this.players.size;

    // Use preset role pool if one was loaded, otherwise build from GAME_COMPOSITION
    let pool;
    if (this.presetRolePool && this.presetRolePool.length === playerCount) {
      pool = [...this.presetRolePool];
      this.presetRolePool = null;
      // With a preset pool, shuffle and assign directly (no per-seat pre-assignments)
      const shuffled = pool.sort(() => Math.random() - 0.5);
      const playerList = this.getPlayersBySeat();
      for (let i = 0; i < playerList.length; i++) {
        playerList[i].assignRole(getRole(shuffled[i]));
      }
      return;
    }
    this.presetRolePool = null;
    pool = buildRolePool(playerCount);

    const playerList = this.getPlayersBySeat();
    const preAssigned = playerList.filter((p) => p.preAssignedRole);
    const unassigned = playerList.filter((p) => !p.preAssignedRole);

    // Phase 1: Honor pre-assignments
    for (const player of preAssigned) {
      const roleId = player.preAssignedRole;
      const poolIndex = pool.indexOf(roleId);
      if (poolIndex !== -1) {
        pool.splice(poolIndex, 1);
      } else {
        const villagerIndex = pool.lastIndexOf('villager');
        if (villagerIndex !== -1) {
          pool.splice(villagerIndex, 1);
        } else {
          pool.pop();
        }
      }
      player.assignRole(getRole(roleId));
    }

    // Phase 2: Inject companions for pre-assigned roles
    const allRoleIds = [...preAssigned.map((p) => p.preAssignedRole), ...pool];
    for (const player of preAssigned) {
      const roleDef = getRole(player.preAssignedRole);
      if (!roleDef?.companions) continue;
      for (const companionId of roleDef.companions) {
        if (allRoleIds.includes(companionId)) continue;
        const villagerIndex = pool.lastIndexOf('villager');
        if (villagerIndex === -1) continue; // No room — skip silently
        pool.splice(villagerIndex, 1, companionId);
        allRoleIds.push(companionId);
      }
    }

    // Phase 3: Shuffle remaining pool and assign to unassigned players
    const shuffled = pool.sort(() => Math.random() - 0.5);
    for (let i = 0; i < unassigned.length; i++) {
      unassigned[i].assignRole(getRole(shuffled[i]));
    }
  }

  _validateComposition() {
    const playerCount = this.players.size;
    const pool = buildRolePool(playerCount);
    const preAssigned = [...this.players.values()]
      .filter((p) => p.preAssignedRole)
      .map((p) => p.preAssignedRole);

    // Check duplicate unique roles (alpha can only appear once)
    const uniqueRoles = [RoleId.ALPHA];
    for (const roleId of uniqueRoles) {
      const count = preAssigned.filter((r) => r === roleId).length;
      if (count > 1) {
        const roleDef = getRole(roleId);
        return {
          valid: false,
          error: `${count} players pre-assigned as ${roleDef.name} (max 1)`,
        };
      }
    }

    // Simulate final composition: consume pre-assigned from pool, then fill remainder
    const remaining = [...pool];
    for (const roleId of preAssigned) {
      const idx = remaining.indexOf(roleId);
      if (idx !== -1) {
        remaining.splice(idx, 1);
      } else {
        const vi = remaining.lastIndexOf(RoleId.VILLAGER);
        if (vi !== -1) remaining.splice(vi, 1);
        else remaining.pop();
      }
    }
    const finalRoles = [...preAssigned, ...remaining];

    // Count teams
    const wolves = finalRoles.filter(
      (r) => getRole(r)?.team === Team.WEREWOLF,
    ).length;
    const villagers = finalRoles.filter(
      (r) => getRole(r)?.team === Team.VILLAGE,
    ).length;

    if (villagers === 0) {
      return {
        valid: false,
        error: 'No village team members — werewolves win instantly',
      };
    }
    if (wolves === 0) {
      return {
        valid: false,
        error: 'No werewolf team members — village wins instantly',
      };
    }
    if (wolves >= villagers) {
      return {
        valid: false,
        error: `${wolves} werewolves vs ${villagers} villagers — werewolves win instantly`,
      };
    }

    return { valid: true };
  }

  _setTutorialTips() {
    for (const player of this.players.values()) {
      if (player.role.team === Team.WEREWOLF) {
        player.tutorialTip = null; // Computed dynamically in _buildDisplay
      } else {
        player.tutorialTip = player.role.tip || 'Good luck!';
      }
    }
  }

  nextPhase() {
    // Auto-resolve remaining events so resolution effects aren't lost
    if (this.activeEvents.size > 0) {
      const pending = [...this.activeEvents.entries()]
        .filter(([, inst]) => !inst.managedByFlow)
        .sort((a, b) => a[1].event.priority - b[1].event.priority);

      for (const [eventId, instance] of pending) {
        const { event, results } = instance;
        const resolution = event.resolve(results, this);

        if (!resolution.silent) {
          this.eventResults.push(resolution);
          this.addLog(resolution.message);
        }

        // Deliver private results (e.g., seer investigations) to living players
        if (resolution.investigations) {
          for (const inv of resolution.investigations) {
            const player = this.getPlayer(inv.seerId);
            if (player?.isAlive) {
              player.lastEventResult = { message: inv.privateMessage, critical: true };
              player.send(ServerMsg.EVENT_RESULT, {
                eventId: EventId.INVESTIGATE,
                message: inv.privateMessage,
                data: inv,
              });
            }
          }
        }
      }
    }

    // Process poison deaths (night → day only) before isProtected is cleared
    if (this.phase === GamePhase.NIGHT) {
      this._processPoisonDeaths();
    }

    // Clear protection, player event state, and janitor flag
    this.janitorCleaning = false;
    this.poisonerActing = false;
    for (const player of this.players.values()) {
      player.resetForPhase();
    }

    // Check win condition
    const winner = this.checkWinCondition();
    if (winner) {
      this.endGame(winner);
      return { success: true, gameOver: true, winner };
    }

    // Transition phase
    if (this.phase === GamePhase.DAY) {
      this.phase = GamePhase.NIGHT;
      this.addLog(`Night ${this.dayCount} begins`);
      this.pushSlide({
        type: 'gallery',
        title: `NIGHT ${this.dayCount}`,
        subtitle: 'Close your eyes... just kidding.',
        playerIds: this.getAlivePlayers().map((p) => p.id),
        style: SlideStyle.NEUTRAL,
      });
      // Snapshot slide count after the night gallery — used to detect silent nights
      this._nightStartSlideCount = this.slideQueue.length;
    } else if (this.phase === GamePhase.NIGHT) {
      this.phase = GamePhase.DAY;
      this.dayCount++;
      this.addLog(`Day ${this.dayCount} begins`);
      this.pushSlide({
        type: 'gallery',
        title: `DAY ${this.dayCount}`,
        subtitle: 'The sun rises.',
        playerIds: this.getAlivePlayers().map((p) => p.id),
        style: SlideStyle.NEUTRAL,
      });
    }

    // Clear events and build new ones
    this.activeEvents.clear();
    this.eventResults = [];
    this.buildPendingEvents();

    this.broadcastGameState();

    return { success: true };
  }

  buildPendingEvents() {
    const phaseEvents = getEventsForPhase(this.phase);
    this.pendingEvents = [];
    this.customEventConfig = null; // Clear any pending custom event config on phase change

    for (const event of phaseEvents) {
      // Skip player-initiated events (like shoot) - they start when player uses ability
      if (event.playerInitiated) continue;

      // Skip customEvent - it's only added via createCustomEvent()
      if (event.id === EventId.CUSTOM_EVENT) continue;

      const participants = this.getEventParticipants(event.id);
      if (participants.length > 0) {
        this.pendingEvents.push(event.id);
      }
    }
  }

  // === Event Management ===

  /**
   * Get all participants for an event, combining:
   * - Role-based participants (from event.participants)
   * - Item-based participants (players with items that have startsEvent: eventId)
   */
  getEventParticipants(eventId) {
    const event = getEvent(eventId);
    if (!event) return [];

    // Get role-based participants
    const roleParticipants = event.participants(this);

    // Get item-based participants (players with items granting this event)
    const itemParticipants = this.getAlivePlayers().filter((player) => {
      return player.inventory.some(
        (item) => item.startsEvent === eventId && item.uses > 0,
      );
    });

    // Combine and deduplicate by player ID
    const allParticipants = [...roleParticipants];
    for (const player of itemParticipants) {
      if (!allParticipants.find((p) => p.id === player.id)) {
        allParticipants.push(player);
      }
    }

    // Coward's Way Out: holder loses all actions — never a participant
    return allParticipants.filter((p) => !p.hasItem('coward'));
  }

  startEvent(eventId) {
    // Special handling for customEvent - requires stored config
    if (eventId === EventId.CUSTOM_EVENT) {
      return this._startCustomEvent();
    }

    const event = getEvent(eventId);
    if (!event) {
      return { success: false, error: 'Event not found' };
    }

    // Check phase restriction for player-initiated events
    if (
      event.playerInitiated &&
      event.phase &&
      !event.phase.includes(this.phase)
    ) {
      return {
        success: false,
        error: `Not available during ${this.phase} phase`,
      };
    }

    const participants = this.getEventParticipants(eventId);
    if (participants.length === 0) {
      return { success: false, error: 'No eligible participants' };
    }

    // Create active event instance
    const eventInstance = {
      event,
      results: {}, // playerId -> targetId
      participants: participants.map((p) => p.id),
      startedAt: Date.now(),
    };

    this.activeEvents.set(eventId, eventInstance);
    this.pendingEvents = this.pendingEvents.filter((id) => id !== eventId);

    // Notify participants
    for (const player of participants) {
      player.pendingEvents.add(eventId);
      player.clearSelection();
      player.lastEventResult = null;

      const targets = event.validTargets(player, this);

      // Auto-select if only one target (e.g., governor pardon)
      if (targets.length === 1) {
        player.currentSelection = targets[0].id;
      }

      // Send updated player state so client clears abstained/confirmed flags
      player.syncState(this);

      player.send(ServerMsg.EVENT_PROMPT, {
        eventId,
        eventName: event.name,
        description: event.description,
        targets: targets.map((t) => t.getPublicState()),
        allowAbstain: event.allowAbstain !== false,
      });
    }

    this.addLog(`${event.name} started`);

    // Special handling for shoot event - show immediate slide
    if (eventId === EventId.SHOOT && participants.length > 0) {
      const shooter = participants[0];
      this.pushSlide(
        {
          type: 'title',
          title: 'DRAW!',
          subtitle: `${shooter.name} is searching for a target...`,
          style: SlideStyle.WARNING,
        },
        true,
      ); // Jump to this slide immediately
    }

    // Show slide when vote events start
    if (eventId === EventId.VOTE) {
      this.pushSlide(
        {
          type: 'gallery',
          title: 'ELIMINATION VOTE',
          subtitle: 'Choose who to eliminate',
          playerIds: this.getAlivePlayers().map((p) => p.id),
          targetsOnly: true,
          activeEventId: eventId,
          style: SlideStyle.NEUTRAL,
        },
        true,
      );
    }

    // Note: Flow-managed events (like hunterRevenge) are started via _startFlowEvent()

    this.broadcastGameState();

    return { success: true };
  }

  startAllEvents() {
    const started = [];
    for (const eventId of [...this.pendingEvents]) {
      const result = this.startEvent(eventId);
      if (result.success) {
        started.push(eventId);
      }
    }
    return { success: true, started };
  }

  /**
   * Start an event managed by an InterruptFlow
   * This is a lightweight event creation for flows that manage their own logic.
   *
   * @param {string} eventId - The event/flow ID
   * @param {Object} options - Event configuration
   * @param {string} options.name - Display name
   * @param {string} options.description - Description shown to players
   * @param {string} options.verb - Action verb (e.g., 'shoot')
   * @param {string[]} options.participants - Player IDs who can act
   * @param {Function} options.getValidTargets - (playerId) => Player[]
   * @param {boolean} options.allowAbstain - Whether abstaining is allowed
   * @param {boolean} options.playerResolved - Whether to auto-resolve on selection
   */
  _startFlowEvent(eventId, options) {
    const {
      name,
      description,
      verb = eventId,
      participants,
      getValidTargets,
      allowAbstain = false,
      playerResolved = false,
    } = options;

    // Create a minimal event-like object for the activeEvents map
    const eventInstance = {
      event: {
        id: eventId,
        name,
        description,
        verb,
        validTargets: (actor) => getValidTargets(actor.id),
        allowAbstain,
        playerResolved,
      },
      results: {},
      participants,
      startedAt: Date.now(),
      managedByFlow: true, // Flag to indicate this is flow-managed
    };

    this.activeEvents.set(eventId, eventInstance);

    // Notify participants
    for (const playerId of participants) {
      const player = this.getPlayer(playerId);
      if (!player) continue;

      player.pendingEvents.add(eventId);
      player.clearSelection();
      player.lastEventResult = null;

      const targets = getValidTargets(playerId);

      // Auto-select if only one target
      if (targets.length === 1) {
        player.currentSelection = targets[0].id;
      }

      // Send updated player state
      player.syncState(this);

      // Send event prompt
      player.send(ServerMsg.EVENT_PROMPT, {
        eventId,
        eventName: name,
        description,
        targets: targets.map((t) => t.getPublicState()),
        allowAbstain,
      });
    }

    this.addLog(`${name} started`);
    this.broadcastGameState();

    return { success: true };
  }

  /**
   * Create a custom event and add it to pending events.
   * The event is not started until startEvent('customEvent') is called.
   */
  createCustomEvent(config) {
    // Validate configuration
    const validation = this.validateCustomEventConfig(config);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    // Check phase
    if (this.phase !== GamePhase.DAY) {
      return {
        success: false,
        error: 'Custom events only available during DAY phase',
      };
    }

    // Check if customEvent already active
    if (this.activeEvents.has(EventId.CUSTOM_EVENT)) {
      return { success: false, error: 'Custom event already in progress' };
    }

    // Store the config (replaces any existing pending config)
    this.customEventConfig = config;

    // Add to pending if not already there
    if (!this.pendingEvents.includes(EventId.CUSTOM_EVENT)) {
      this.pendingEvents.push(EventId.CUSTOM_EVENT);
    }

    this.broadcastGameState();

    return { success: true };
  }

  /**
   * Internal method to start the custom event using stored config.
   * Called by startEvent('customEvent').
   */
  _startCustomEvent() {
    const config = this.customEventConfig;
    if (!config) {
      return { success: false, error: 'No custom event config found' };
    }

    // Check if customEvent already active
    if (this.activeEvents.has(EventId.CUSTOM_EVENT)) {
      return { success: false, error: 'Custom event already in progress' };
    }

    const event = getEvent(EventId.CUSTOM_EVENT);
    if (!event) {
      return { success: false, error: 'Custom event not found' };
    }

    const participants = this.getEventParticipants(EventId.CUSTOM_EVENT);
    if (participants.length === 0) {
      return { success: false, error: 'No eligible participants' };
    }

    // Create event instance with configuration and runoff tracking
    const eventInstance = {
      event,
      results: {},
      participants: participants.map((p) => p.id),
      startedAt: Date.now(),
      config, // Store configuration
      runoffCandidates: [],
      runoffRound: 0,
    };

    this.activeEvents.set(EventId.CUSTOM_EVENT, eventInstance);
    this.pendingEvents = this.pendingEvents.filter(
      (id) => id !== EventId.CUSTOM_EVENT,
    );

    // Notify participants with custom description
    for (const player of participants) {
      player.pendingEvents.add(EventId.CUSTOM_EVENT);
      player.clearSelection();
      player.lastEventResult = null;

      const targets = event.validTargets(player, this);

      // Send updated player state so client clears abstained/confirmed flags
      player.syncState(this);

      player.send(ServerMsg.EVENT_PROMPT, {
        eventId: EventId.CUSTOM_EVENT,
        eventName: event.name,
        description: config.description,
        targets: targets.map((t) => t.getPublicState()),
        allowAbstain: event.allowAbstain !== false,
      });
    }

    this.addLog(`Custom event started — ${config.description}`);

    // Show slide when custom event starts — gallery of eligible targets
    const customTargets =
      config.rewardType === 'resurrection'
        ? [...this.players.values()].filter((p) => !p.isAlive)
        : this.getAlivePlayers();
    const rewardItemDef = config.rewardType === 'item' ? getItem(config.rewardParam) : null;
    this.pushSlide(
      {
        type: 'gallery',
        title: 'CUSTOM VOTE',
        subtitle: config.description,
        itemDescription: rewardItemDef?.description || null,
        playerIds: customTargets.map((p) => p.id),
        targetsOnly: true,
        activeEventId: EventId.CUSTOM_EVENT,
        style: SlideStyle.NEUTRAL,
      },
      true,
    );

    // Clear the config now that we've started
    this.customEventConfig = null;

    this.broadcastGameState();

    return { success: true };
  }

  validateCustomEventConfig(config) {
    if (!config) {
      return { valid: false, error: 'Configuration required' };
    }

    const { rewardType, rewardParam, description } = config;

    // Validate reward type
    if (!['item', 'role', 'resurrection'].includes(rewardType)) {
      return { valid: false, error: 'Invalid reward type' };
    }

    // Validate reward parameter
    if (rewardType === 'item') {
      const item = getItem(rewardParam);
      if (!item) {
        return { valid: false, error: `Item '${rewardParam}' not found` };
      }
    } else if (rewardType === 'role') {
      const role = getRole(rewardParam);
      if (!role) {
        return { valid: false, error: `Role '${rewardParam}' not found` };
      }
    }
    // Resurrection doesn't need param validation

    if (!description || description.trim() === '') {
      return { valid: false, error: 'Description required' };
    }

    return { valid: true };
  }

  recordSelection(playerId, targetId) {
    const player = this.getPlayer(playerId);
    if (!player) return { success: false, error: 'Player not found' };

    // Find which active event this player is in
    for (const [eventId, instance] of this.activeEvents) {
      if (instance.participants.includes(playerId)) {
        instance.results[playerId] = targetId;

        // Check if this event is managed by a flow
        if (instance.managedByFlow) {
          const flow = this.flows.get(eventId);
          if (flow) {
            const result = flow.onSelection(playerId, targetId);
            if (result) {
              this._executeFlowResult(result);
              this.broadcastGameState();
              return { success: true, eventId, flowResult: result };
            }
          }
          // Flow handled it, skip normal event processing
          this.broadcastGameState();
          return { success: true, eventId };
        }

        // Broadcast pack state for werewolf events
        if (this.shouldBroadcastPackState(eventId, player)) {
          this.broadcastPackState();
        }

        // Check if event has immediate slide generation on selection
        if (instance.event.onSelection) {
          const result = instance.event.onSelection(playerId, targetId, this);
          if (result?.slide) {
            // Use queueDeathSlide for death slides (handles hunter revenge automatically)
            if (result.slide.type === 'death') {
              this.queueDeathSlide(result.slide, true);
            } else {
              this.pushSlide(result.slide, true);
            }
          }
          if (result?.message) {
            this.addLog(result.message);
          }
        }

        // Auto-resolve player-resolved events immediately
        if (instance.event.playerResolved) {
          this.resolveEvent(eventId);
        }

        // End timer early if all participants have responded
        this.checkEventTimersComplete();

        this.broadcastGameState();
        return { success: true, eventId };
      }
    }

    return { success: false, error: 'No active event for player' };
  }

  startEventTimer(eventId, duration) {
    const instance = this.activeEvents.get(eventId);
    if (!instance) {
      return { success: false, error: 'Event not active' };
    }

    // Clear existing timer for this event if one is running
    this.clearEventTimer(eventId);

    const timeout = setTimeout(() => {
      this.eventTimers.delete(eventId);
      this.resolveEvent(eventId, { force: true });
    }, duration);

    this.eventTimers.set(eventId, {
      timeout,
      endsAt: Date.now() + duration,
    });

    this.broadcast(ServerMsg.EVENT_TIMER, {
      eventId,
      duration,
    });

    return { success: true };
  }

  startAllEventTimers(duration) {
    const eventIds = [...this.activeEvents.keys()];
    if (eventIds.length === 0) {
      return { success: false, error: 'No active events' };
    }

    // Collect all participants across all active events for the slide
    const allParticipants = [];
    for (const eventId of eventIds) {
      this.startEventTimer(eventId, duration);
      const instance = this.activeEvents.get(eventId);
      if (instance) {
        for (const pid of instance.participants) {
          if (!allParticipants.includes(pid)) {
            allParticipants.push(pid);
          }
        }
      }
    }

    // Push a single timer slide for all events
    this.pushSlide(
      {
        type: 'gallery',
        title: "TIME'S UP",
        subtitle: "Confirm your selection before it's too late.",
        playerIds: allParticipants,
        targetsOnly: true,
        timerEventId: eventIds[0],
        style: SlideStyle.WARNING,
      },
      true,
    );

    this.addLog(`Timer started for ${eventIds.length} event(s)`);

    return { success: true };
  }

  clearEventTimer(eventId) {
    const timer = this.eventTimers.get(eventId);
    if (timer) {
      clearTimeout(timer.timeout);
      this.eventTimers.delete(eventId);
      this.broadcast(ServerMsg.EVENT_TIMER, { eventId, duration: null });
    }
  }

  // End event timers early if all participants have confirmed or abstained
  checkEventTimersComplete() {
    for (const [eventId, timer] of this.eventTimers) {
      const instance = this.activeEvents.get(eventId);
      if (!instance) continue;

      const { participants, results } = instance;
      if (Object.keys(results).length >= participants.length) {
        this.clearEventTimer(eventId);
        this.resolveEvent(eventId);
      }
    }
  }

  resolveEvent(eventId, { force = false } = {}) {
    const instance = this.activeEvents.get(eventId);
    if (!instance) {
      return { success: false, error: 'Event not active' };
    }

    const { event, results, participants } = instance;

    // Check if all required responses are in (skip when force-resolving via timer)
    if (!force && !event.allowAbstain) {
      const responded = Object.keys(results).length;
      if (responded < participants.length) {
        return {
          success: false,
          error: `Waiting for ${
            participants.length - responded
          } more responses`,
        };
      }
    }

    // For vote/customEvent events, show tally slide first and defer resolution
    if (eventId === EventId.VOTE || eventId === EventId.CUSTOM_EVENT) {
      return this.showTallyAndDeferResolution(eventId, instance);
    }

    // Nullify roleblocked players' selections (treat as abstain)
    if (eventId !== EventId.BLOCK) {
      for (const actorId of Object.keys(results)) {
        const actor = this.getPlayer(actorId);
        if (actor && actor.isRoleblocked) {
          results[actorId] = null;
        }
      }
    }

    // Resolve the event
    const resolution = event.resolve(results, this);

    // Check if this is a runoff situation
    if (resolution.runoff === true) {
      // Don't clear event or player states - trigger runoff instead
      this.addLog(resolution.message);
      return this.triggerRunoff(eventId, resolution.frontrunners);
    }

    // Note: Governor pardon is now handled by GovernorPardonFlow

    // Clear player event state and consume items that granted event participation
    for (const pid of participants) {
      const player = this.getPlayer(pid);
      if (player) {
        player.clearFromEvent(eventId);

        // Check if player participated via an item (not just their role)
        // Only consume if they actually submitted a result (not abstained)
        if (results[pid] !== undefined && results[pid] !== null) {
          const grantingItem = player.inventory.find(
            (item) => item.startsEvent === eventId && item.uses > 0,
          );
          if (grantingItem) {
            this.consumeItem(pid, grantingItem.id);
          }
        }

        // Send updated player state so UI refreshes
        player.syncState(this);
      }
    }

    // Handle resolution
    this.activeEvents.delete(eventId);
    this.clearEventTimer(eventId);

    if (!resolution.silent) {
      this.eventResults.push(resolution);
      this.addLog(resolution.message);
    }

    // Push result slide if defined
    if (resolution.slide) {
      const jumpTo = resolution.immediateSlide !== false;
      // Use queueDeathSlide for death slides (handles hunter revenge automatically)
      if (resolution.slide.type === 'death') {
        this.queueDeathSlide(resolution.slide, jumpTo);
      } else {
        this.pushSlide(resolution.slide, jumpTo);
      }
    }

    // Send private results (e.g., seer investigations)
    if (resolution.investigations) {
      for (const inv of resolution.investigations) {
        const seer = this.getPlayer(inv.seerId);
        if (seer) {
          seer.lastEventResult = { message: inv.privateMessage, critical: true };
          seer.send(ServerMsg.EVENT_RESULT, {
            eventId: EventId.INVESTIGATE,
            message: inv.privateMessage,
            data: inv,
          });
        }
      }
    }

    // Check win condition
    const winner = this.checkWinCondition();
    if (winner) {
      this.endGame(winner);
    }

    this.broadcastGameState();

    return { success: true, resolution };
  }

  resolveAllEvents() {
    // Sort by priority and resolve
    const sorted = [...this.activeEvents.entries()].sort(
      (a, b) => a[1].event.priority - b[1].event.priority,
    );

    const results = [];
    for (const [eventId] of sorted) {
      const result = this.resolveEvent(eventId);
      results.push({ eventId, ...result });
    }

    // Night fallback: if no informative slides were pushed this night, show TIME PASSES
    if (this.phase === GamePhase.NIGHT && this.slideQueue.length === this._nightStartSlideCount) {
      this.pushSlide({
        type: 'title',
        title: '🌙 TIME PASSES',
        subtitle: 'Tensions are rising',
        style: SlideStyle.NEUTRAL,
      });
    }

    return { success: true, results };
  }

  skipEvent(eventId) {
    // Skip/cancel an event immediately with no effect (useful for player-resolved events)
    const instance = this.activeEvents.get(eventId);
    if (!instance) {
      return { success: false, error: 'Event not active' };
    }

    const { event, participants } = instance;

    // Clear player event state
    for (const pid of participants) {
      const player = this.getPlayer(pid);
      if (player) {
        player.clearFromEvent(eventId);
      }
    }

    // Remove from active events
    this.activeEvents.delete(eventId);
    this.clearEventTimer(eventId);

    this.addLog(`${event.name} skipped`);
    this.broadcastGameState();

    return { success: true };
  }

  resetEvent(eventId) {
    const instance = this.activeEvents.get(eventId);
    if (!instance) {
      return { success: false, error: 'Event not active' };
    }

    const { event, participants } = instance;

    for (const pid of participants) {
      const player = this.getPlayer(pid);
      if (player) {
        player.clearFromEvent(eventId);
      }
    }

    this.activeEvents.delete(eventId);
    this.clearEventTimer(eventId);

    // Return to pending so host can re-start it
    this.pendingEvents.push(eventId);

    this.addLog(`${event.name} reset`);
    this.broadcastGameState();

    return { success: true };
  }

  // Build vote tally slide data with all necessary info for rendering
  buildTallySlide(eventId, results, event, outcome) {
    // Compute tally counts and voter lists
    const tally = {};
    const voters = {}; // candidateId -> [voterId, ...]
    for (const [voterId, targetId] of Object.entries(results)) {
      if (targetId === null) continue;
      tally[targetId] = (tally[targetId] || 0) + 1;
      if (!voters[targetId]) voters[targetId] = [];
      voters[targetId].push(voterId);
    }

    // Find frontrunners (candidates with max votes)
    const maxVotes = Math.max(...Object.values(tally), 0);
    const frontrunners = Object.keys(tally).filter(
      (id) => tally[id] === maxVotes,
    );
    const isTied = frontrunners.length > 1;

    // Determine title and subtitle based on outcome
    let title = isTied ? 'VOTES TIED' : 'VOTES';
    let subtitle;
    switch (outcome.type) {
      case 'runoff':
        subtitle = 'Tiebreaker vote starting soon';
        break;
      case 'random':
        subtitle = 'Selecting random frontrunner';
        break;
      case 'selected':
        subtitle = `${outcome.selectedName} has been selected`;
        break;
      case 'no-selection':
        subtitle = 'No one was selected';
        break;
      default:
        subtitle = `${Object.keys(tally).length} candidates received votes`;
    }

    return {
      type: 'voteTally',
      tally,
      voters,
      frontrunners,
      anonymousVoting: event.anonymousVoting ?? false,
      title,
      subtitle,
    };
  }

  showTallyAndDeferResolution(eventId, instance) {
    const { event, results, participants } = instance;

    // Pre-compute the resolution
    const resolution = event.resolve(results, this);

    // If this is a runoff, handle it immediately
    if (resolution.runoff === true) {
      const tallySlide = this.buildTallySlide(eventId, results, event, {
        type: 'runoff',
      });
      this.pushSlide(tallySlide, true);
      this.addLog(resolution.message);
      return this.triggerRunoff(eventId, resolution.frontrunners);
    }

    // Check if any flow wants to intercept the vote resolution (e.g., governor pardon)
    const flowContext = { voteEventId: eventId, resolution, instance };
    const interceptingFlow = [...this.flows.values()].find(
      (f) =>
        f.constructor.hooks.includes('onVoteResolution') &&
        f.canTrigger(flowContext),
    );

    if (interceptingFlow) {
      const selectedName = resolution.victim?.name || 'Unknown';
      const tallySlide = this.buildTallySlide(eventId, results, event, {
        type: 'selected',
        selectedName,
      });
      this.pushSlide(tallySlide, true);

      // Common vote cleanup (applies to any vote-interrupting flow)
      this.activeEvents.delete(eventId);
      for (const pid of participants) {
        const player = this.getPlayer(pid);
        if (player) {
          player.clearFromEvent(eventId);
          player.syncState(this);
        }
      }

      this.broadcastGameState();

      // Trigger the intercepting flow
      interceptingFlow.trigger(flowContext);
      return { success: true, showingTally: true, awaitingPardon: true };
    }

    // === Execute immediately (no deferred resolution) ===

    // Clear player event state
    for (const pid of participants) {
      const player = this.getPlayer(pid);
      if (player) {
        player.clearFromEvent(eventId);
        player.syncState(this);
      }
    }

    // Remove from active events
    this.activeEvents.delete(eventId);

    // Log and record result
    if (!resolution.silent) {
      this.eventResults.push(resolution);
      this.addLog(resolution.message);
    }

    // Execute the kill if there's a victim
    if (resolution.outcome === 'eliminated' && resolution.victim) {
      this.killPlayer(resolution.victim.id, 'eliminated');
    }

    // Determine outcome type for tally slide
    let outcomeInfo;
    if (resolution.outcome === 'eliminated' && resolution.victim) {
      outcomeInfo = { type: 'selected', selectedName: resolution.victim.name };
    } else if (resolution.outcome === 'no-kill') {
      outcomeInfo = { type: 'no-selection' };
    } else if (resolution.tally && resolution.message?.includes('randomly')) {
      outcomeInfo = { type: 'random' };
    } else {
      outcomeInfo = {
        type: 'selected',
        selectedName:
          resolution.victim?.name || resolution.winner?.name || 'Unknown',
      };
    }

    // Queue slides: tally first, then result
    const tallySlide = this.buildTallySlide(
      eventId,
      results,
      event,
      outcomeInfo,
    );
    this.pushSlide(tallySlide, false);

    let resultSlideCount = 0;
    if (resolution.slide) {
      // Use queueDeathSlide for death slides (handles hunter revenge automatically)
      if (resolution.slide.type === 'death') {
        // Add voter IDs to death slide for vote results (shows who voted for elimination)
        const victimId = resolution.victim?.id;
        const voterIds = victimId ? tallySlide.voters[victimId] || [] : [];
        const slidesBefore = this.slideQueue.length;
        this.queueDeathSlide({ ...resolution.slide, voterIds }, false);
        resultSlideCount = this.slideQueue.length - slidesBefore;
      } else {
        this.pushSlide(resolution.slide, false);
        resultSlideCount = 1;
      }
    }

    // Jump to tally (host advances through result slides)
    this.currentSlideIndex = this.slideQueue.length - resultSlideCount - 1;
    this.broadcastSlides();

    // Check win condition
    const winner = this.checkWinCondition();
    if (winner) {
      this.endGame(winner);
    }

    this.broadcastGameState();
    return { success: true, resolution };
  }

  triggerRunoff(eventId, frontrunners) {
    const instance = this.activeEvents.get(eventId);
    if (!instance) {
      return { success: false, error: 'Event not active' };
    }

    // Set runoff state but DON'T clear player selections or send prompts yet.
    // Players stay in LOCKED state showing their previous vote until the
    // runoff gallery slide becomes current (via _onSlideActivated).
    instance.runoffCandidates = frontrunners;
    instance.runoffRound = (instance.runoffRound || 0) + 1;
    instance.results = {}; // Clear previous votes

    // Build context-aware subtitle
    let runoffSubtitle = 'Choose who to eliminate';
    if (eventId === EventId.CUSTOM_EVENT && instance.config) {
      const { rewardType, rewardParam } = instance.config;
      if (rewardType === 'resurrection')
        runoffSubtitle = 'Choose who to resurrect';
      else if (rewardType === 'item')
        runoffSubtitle = `Choose who to give ${rewardParam}`;
      else if (rewardType === 'role')
        runoffSubtitle = `Choose who to elect as ${rewardParam}`;
    }

    // Queue runoff slide with all participants (not just frontrunners)
    // so that vote confirmation highlights work the same as normal votes
    this.pushSlide(
      {
        type: 'gallery',
        title: `RUNOFF VOTE #${instance.runoffRound}`,
        subtitle: runoffSubtitle,
        playerIds: instance.participants,
        targetsOnly: true,
        activeEventId: eventId,
        style: SlideStyle.NEUTRAL,
        activateRunoff: eventId,
      },
      false,
    );

    this.addLog(
      `${instance.event.name} runoff — Round ${instance.runoffRound}`,
    );
    this.broadcastGameState();

    return { success: true, runoff: true };
  }

  _activateRunoff(eventId) {
    const instance = this.activeEvents.get(eventId);
    if (!instance) return;

    const { event, participants } = instance;

    // Now clear player selections and send new prompts
    for (const pid of participants) {
      const player = this.getPlayer(pid);
      if (player) {
        player.clearSelection();
      }
    }

    const runoffParticipants = participants
      .map((pid) => this.getPlayer(pid))
      .filter((p) => p);

    for (const player of runoffParticipants) {
      const targets = event.validTargets(player, this);

      // Auto-select if only one target
      if (targets.length === 1) {
        player.currentSelection = targets[0].id;
      }

      const baseDescription = instance.config?.description || event.description;
      const description = `RUNOFF VOTE (Round ${instance.runoffRound}): ${baseDescription}`;

      player.send(ServerMsg.EVENT_PROMPT, {
        eventId,
        eventName: event.name,
        description,
        targets: targets.map((t) => t.getPublicState()),
        allowAbstain: event.allowAbstain !== false,
      });
    }

    this.broadcastGameState();
  }

  // === Win Conditions ===

  checkWinCondition() {
    const alive = this.getAlivePlayers();
    const werewolves = alive.filter((p) => p.role.team === Team.WEREWOLF);
    // Cowards can't vote, so they provide no effective voting power to the village.
    // Exclude them from the majority calculation so werewolves aren't artificially
    // blocked by unvotable village members.
    const villagers = alive.filter((p) => p.role.team === Team.VILLAGE && !p.hasItem('coward'));

    if (werewolves.length === 0) {
      return Team.VILLAGE;
    }

    if (werewolves.length >= villagers.length) {
      return Team.WEREWOLF;
    }

    return null;
  }

  endGame(winner) {
    this.phase = GamePhase.GAME_OVER;

    // Reveal all cleaned roles at game over
    for (const player of this.players.values()) {
      player.isRoleCleaned = false;
    }

    const winnerName = winner === Team.VILLAGE ? 'VILLAGERS' : 'WEREWOLVES';

    this.addLog(`Game over — ${winnerName} win!`);

    const winners = [...this.players.values()]
      .filter((p) => p.role.team === winner)
      .map((p) => ({
        id: p.id,
        name: p.name,
        portrait: p.portrait,
        roleName: p.role.name,
        roleColor: p.role.color,
        isAlive: p.isAlive,
      }));

    this.pushSlide(
      {
        type: 'victory',
        winner,
        winners,
        title: `${winnerName} WIN`,
        subtitle:
          winner === Team.VILLAGE
            ? 'All werewolves have been eliminated.'
            : 'The werewolves have taken over.',
        style:
          winner === Team.VILLAGE ? SlideStyle.POSITIVE : SlideStyle.HOSTILE,
      },
      false,
    ); // Queue after death slide, don't jump to it

    this.broadcastGameState();
  }

  // === Flow Dispatch ===

  /**
   * Check if any registered flow should trigger for the given hook.
   * Iterates flows, checks hook match + canTrigger(), calls trigger().
   * @param {string} hook - Hook name (e.g., 'onDeath', 'onVoteResolution')
   * @param {Object} context - Context passed to canTrigger and trigger
   * @returns {Object|null} Flow trigger result, or null if no flow triggered
   */
  _checkFlows(hook, context) {
    for (const flow of this.flows.values()) {
      if (flow.constructor.hooks.includes(hook) && flow.canTrigger(context)) {
        return flow.trigger(context);
      }
    }
    return null;
  }

  /**
   * Execute a structured result returned by a flow's resolve/onSelection method.
   * Processes: consumeItems → kills → slides → jumpToSlide → log
   * @param {Object} result - Flow result with optional kills, slides, consumeItems, jumpToSlide, log
   */
  _executeFlowResult(result) {
    if (!result || result.error) return;

    // Consume items first (before state changes from kills)
    if (result.consumeItems) {
      for (const { playerId, itemId } of result.consumeItems) {
        this.consumeItem(playerId, itemId);
      }
    }

    // Execute kills (may trigger more flows and enqueue slides)
    if (result.kills) {
      for (const { playerId, cause } of result.kills) {
        this.killPlayer(playerId, cause);
      }
    }

    // Push slides, tracking positions for jumpToSlide
    const slidePositions = [];
    if (result.slides) {
      for (const { slide, jumpTo, isDeath } of result.slides) {
        slidePositions.push(this.slideQueue.length);
        if (isDeath) {
          this.queueDeathSlide(slide, jumpTo);
        } else {
          this.pushSlide(slide, jumpTo);
        }
      }
    }

    // Jump to a specific slide by index into the result's slides array
    if (
      result.jumpToSlide !== undefined &&
      slidePositions[result.jumpToSlide] !== undefined
    ) {
      this.currentSlideIndex = slidePositions[result.jumpToSlide];
      this.broadcastSlides();
    }

    // Log message
    if (result.log) {
      this.addLog(result.log);
    }

    // Check win condition after kills
    if (result.kills?.length > 0) {
      const winner = this.checkWinCondition();
      if (winner) {
        this.endGame(winner);
      }
    }
  }

  // === Death Handling ===

  // Process poison deaths when transitioning from night to day.
  // Called before resetForPhase() so isProtected is still readable.
  _processPoisonDeaths() {
    const teamDisplayNames = {
      village: 'VILLAGER',
      werewolf: 'WEREWOLF',
      neutral: 'INDEPENDENT',
    };

    for (const player of this.players.values()) {
      if (!player.isPoisoned || !player.isAlive) continue;
      // Trigger one night after poison was applied (poisonedAt + 1 === current dayCount)
      if (this.dayCount !== player.poisonedAt + 1) continue;

      player.isPoisoned = false;
      player.poisonedAt = null;

      // Doctor protection on the death night cures the poison — no slide
      if (player.isProtected) {
        player.isProtected = false;
        this.addLog(`${player.getNameWithEmoji()} was saved from poison by the Doctor`);
        continue;
      }

      this.addLog(`${player.getNameWithEmoji()} died from poison`);
      this.killPlayer(player.id, 'poison');
      const teamName = teamDisplayNames[player.role?.team] || 'PLAYER';
      this.queueDeathSlide({
        type: 'death',
        playerId: player.id,
        title: `${teamName} POISONED`,
        subtitle: player.name,
        revealRole: true,
        style: SlideStyle.HOSTILE,
      }, false);
    }
  }

  killPlayer(playerId, cause) {
    const player = this.getPlayer(playerId);
    if (!player || !player.isAlive) return false;

    // BARRICADE: absorbs any kill on first trigger
    if (player.hasItem(ItemId.BARRICADE)) {
      this._barricadeAbsorb(player);
      return 'barricaded';
    }

    // PROSPECT: werewolf kill on a prospect → recruit instead of kill
    if (cause === 'werewolf' && player.hasItem(ItemId.PROSPECT)) {
      this._recruitProspect(player);
      return true;
    }

    player.kill(cause);
    this._deathQueue.push({ player, cause });

    // Re-entrant call (from linked death or flow): just queue, don't process
    if (this._processingDeaths) return true;

    // Top-level call: drain the full queue
    this._processingDeaths = true;
    while (this._deathQueue.length > 0) {
      this._processDeathEffects(this._deathQueue.shift());
    }
    this._processingDeaths = false;
    return true;
  }

  _barricadeAbsorb(player) {
    player.removeItem(ItemId.BARRICADE);
    player.lastEventResult = { message: 'BARRICADE BROKEN', detail: 'You are on your own now', critical: true };
    this.addLog(`${player.getNameWithEmoji()}'s barricade absorbed the attack`);
  }

  _recruitProspect(player) {
    player.removeItem(ItemId.PROSPECT);
    player.assignRole(getRole(RoleId.WEREWOLF));
    player.lastEventResult = { message: 'TEAM CHANGED', detail: 'You were recruited by the wolves', critical: true };
    this.addLog(`${player.getNameWithEmoji()} was recruited by the werewolves`);
    this.broadcastPackState(); // syncs all wolves including the new recruit
  }

  _processDeathEffects({ player, cause }) {
    // 1. Fire onDeath passives (hunter revenge, alpha promotion)
    if (player.role.passives?.onDeath) {
      const deathResult = player.role.passives.onDeath(player, cause, this);

      // Check if any flow should trigger for this death
      this._checkFlows('onDeath', { player, cause, deathResult });

      // Handle non-interrupt results (like Alpha promotion message)
      if (deathResult?.message && !deathResult.interrupt) {
        this.addLog(deathResult.message);
        // Broadcast pack state so all werewolves see new roles
        if (deathResult.message.includes('Alpha')) {
          this.broadcastPackState();
        }
      }
    }

    // 2. Check linked deaths (cupid lovers)
    //    killPlayer() just enqueues due to re-entrancy guard
    for (const other of this.players.values()) {
      if (other.linkedTo === player.id && other.isAlive) {
        this.killPlayer(other.id, 'heartbreak');
        this.addLog(`${other.getNameWithEmoji()} died of heartbreak`);
        this.queueDeathSlide(this.createDeathSlide(other, 'heartbreak'), false);
      }
    }
  }

  revivePlayer(playerId, cause) {
    const player = this.getPlayer(playerId);
    if (!player) return false;
    player.revive(cause);
    this.addLog(`${player.getNameWithEmoji()} revived`);
    return true;
  }

  giveItem(playerId, itemId) {
    const player = this.getPlayer(playerId);
    if (!player) {
      return { success: false, error: 'Player not found' };
    }

    const itemDef = getItem(itemId);
    if (!itemDef) {
      return { success: false, error: 'Item not found' };
    }

    player.addItem(itemDef);
    this.addLog(`${player.getNameWithEmoji()} received ${itemDef.name}`);

    if (itemId === 'coward') {
      this.pushSlide({
        type: SlideType.DEATH,
        coward: true,
        playerId: player.id,
        title: player.name.toUpperCase(),
        subtitle: "HAS TAKEN THE COWARD'S WAY OUT",
        revealRole: true,
        revealText: itemDef.description,
        style: SlideStyle.WARNING,
      }, true);
    }

    return { success: true };
  }

  consumeItem(playerId, itemId) {
    const player = this.getPlayer(playerId);
    if (!player) return false;

    const depleted = player.useItem(itemId);
    if (depleted) {
      player.removeItem(itemId);
    }
    return true;
  }

  // === Slide Management ===

  // Centralized death slide queuing - always splits into two slides:
  //   1. Identity slide: victim name in title (e.g. "MARK KILLED"), no role shown
  //      If slide.identityTitle is set, uses that as title (e.g. pistol: "MARK shot JANE!")
  //      and sets subtitle to victim name.
  //   2. Role reveal slide: team name in title (e.g. "VILLAGER KILLED"), shows role.
  //      If victim.isRoleCleaned, title becomes "??? {ACTION}" and shows revealText instead.
  queueDeathSlide(slide, jumpTo = true) {
    const victim = this.players.get(slide.playerId);
    const victimName = victim?.name ?? 'PLAYER';
    const action = slide.title.split(' ').pop(); // "KILLED", "ELIMINATED", etc.
    const isRoleCleaned = victim?.isRoleCleaned ?? false;

    // Slide 1: identity — shows who died, no role info
    const identitySlide = {
      ...slide,
      title: slide.identityTitle ?? `${victimName.toUpperCase()} ${action}`,
      subtitle: slide.identityTitle ? victimName : slide.subtitle,
      revealRole: false,
      revealText: undefined,
      identityTitle: undefined,
    };
    this.pushSlide(identitySlide, jumpTo);

    // Slide 2: role reveal — team name in title, shows role (or cleaned indicator)
    const roleSlide = {
      ...slide,
      title: isRoleCleaned ? `??? ${action}` : slide.title,
      identityTitle: undefined,
    };
    this.pushSlide(roleSlide, false);

    // Check all flows for pending slides to queue after the death slide
    for (const flow of this.flows.values()) {
      const pendingSlide = flow.getPendingSlide();
      if (pendingSlide) {
        this.pushSlide(pendingSlide, false);
      }
    }
  }

  // Create a death slide for a given cause (used when events don't provide custom slides)
  createDeathSlide(player, cause) {
    const teamDisplayNames = {
      village: 'VILLAGER',
      werewolf: 'WEREWOLF',
      neutral: 'INDEPENDENT',
    };
    const teamName = teamDisplayNames[player.role?.team] || 'PLAYER';

    const titles = {
      eliminated: `${teamName} ELIMINATED`,
      werewolf: `${teamName} KILLED`,
      vigilante: `${teamName} KILLED`,
      shot: `${teamName} KILLED`,
      hunter: `${teamName} KILLED`,
      heartbreak: `${teamName} HEARTBROKEN`,
      host: `${teamName} REMOVED`,
      poison: `${teamName} POISONED`,
    };

    const subtitles = {
      eliminated: player.name,
      werewolf: player.name,
      vigilante: player.name,
      shot: `${player.name} was shot`,
      hunter: `${player.name} was killed`,
      heartbreak: `${player.name} died of a broken heart`,
      host: `${player.name} was removed by the host`,
      poison: `${player.name} succumbed to poison`,
    };

    return {
      type: 'death',
      playerId: player.id,
      title: titles[cause] || `${teamName} DEAD`,
      subtitle: subtitles[cause] || player.name,
      revealRole: true,
      hostKill: cause === 'host',
      style: SlideStyle.HOSTILE,
    };
  }

  pushSlide(slide, jumpTo = true) {
    const slideWithId = { ...slide, id: `slide-${++this.slideIdCounter}` };
    this.slideQueue.push(slideWithId);

    if (this.currentSlideIndex === -1 || jumpTo) {
      this.currentSlideIndex = this.slideQueue.length - 1;
    }

    this.broadcastSlides();
  }

  nextSlide() {
    if (this.currentSlideIndex < this.slideQueue.length - 1) {
      this.currentSlideIndex++;
      this.broadcastSlides();
      this._onSlideActivated();
    }
  }

  prevSlide() {
    if (this.currentSlideIndex > 0) {
      this.currentSlideIndex--;
      this.broadcastSlides();
    }
  }

  _onSlideActivated() {
    const slide = this.slideQueue[this.currentSlideIndex];
    if (!slide) return;

    if (slide.activateRunoff) {
      this._activateRunoff(slide.activateRunoff);
      delete slide.activateRunoff; // Only fire once
    }
  }

  clearSlides() {
    this.slideQueue = [];
    this.currentSlideIndex = -1;

    // Push current phase slide
    if (this.phase === GamePhase.DAY) {
      this.pushSlide({
        type: 'gallery',
        title: `DAY ${this.dayCount}`,
        subtitle: 'The sun rises.',
        playerIds: this.getAlivePlayers().map((p) => p.id),
        style: SlideStyle.NEUTRAL,
      });
    } else if (this.phase === GamePhase.NIGHT) {
      this.pushSlide({
        type: 'gallery',
        title: `NIGHT ${this.dayCount}`,
        subtitle: 'Close your eyes... just kidding.',
        playerIds: this.getAlivePlayers().map((p) => p.id),
        style: SlideStyle.NEUTRAL,
      });
    } else if (this.phase === GamePhase.LOBBY) {
      this.pushSlide({
        type: 'gallery',
        title: 'LOBBY',
        subtitle: 'Waiting for game to start',
        playerIds: [...this.players.values()].map((p) => p.id),
        style: SlideStyle.NEUTRAL,
      });
    }
  }

  getCurrentSlide() {
    if (
      this.currentSlideIndex >= 0 &&
      this.currentSlideIndex < this.slideQueue.length
    ) {
      return this.slideQueue[this.currentSlideIndex];
    }
    return null;
  }

  // === Broadcasting ===

  broadcastGameState() {
    // Send public state to each player (not host - they get host state below)
    const publicState = this.getGameState({ audience: 'public' });
    for (const player of this.players.values()) {
      player.send(ServerMsg.GAME_STATE, publicState);
    }

    // Each player also gets their private state
    for (const player of this.players.values()) {
      player.syncState(this);
    }

    // Host gets full player info (only state update they receive)
    this.sendToHost(
      ServerMsg.GAME_STATE,
      this.getGameState({ audience: 'host' }),
    );

    // Screen gets public state
    this.sendToScreen(ServerMsg.GAME_STATE, publicState);
  }

  // Debounced version of broadcastGameState for rapid dial input.
  // Fires immediately on first call, then coalesces subsequent calls
  // within the debounce window into a single trailing broadcast.
  debouncedBroadcastGameState(delayMs = 120) {
    if (this._broadcastDebounceTimer) {
      clearTimeout(this._broadcastDebounceTimer)
    }
    this._broadcastDebounceTimer = setTimeout(() => {
      this._broadcastDebounceTimer = null
      this.broadcastGameState()
    }, delayMs)
  }

  broadcastPlayerList() {
    const players = this.getPlayersBySeat().map((p) => p.getPublicState());
    this.broadcast(ServerMsg.PLAYER_LIST, players);
    // Host needs full player info (broadcast only sends public state which hides roles)
    const hostPlayers = this.getPlayersBySeat().map((p) =>
      p.getPrivateState(this),
    );
    this.sendToHost(ServerMsg.PLAYER_LIST, hostPlayers);
  }

  // Check if pack state should be broadcast for this event/player combination
  shouldBroadcastPackState(eventId, player) {
    return (
      (eventId === EventId.HUNT || eventId === EventId.KILL) &&
      player?.role?.team === Team.WEREWOLF
    );
  }

  // Broadcast pack state to all werewolves (for real-time hunt updates)
  broadcastPackState() {
    const werewolves = this.getAlivePlayers().filter(
      (p) => p.role && p.role.team === Team.WEREWOLF,
    );

    for (const werewolf of werewolves) {
      werewolf.syncState(this);
    }
  }

  broadcastSlides() {
    const currentSlide = this.getCurrentSlide();
    const slideData = {
      queue: this.slideQueue,
      currentIndex: this.currentSlideIndex,
      current: currentSlide,
    };
    this.broadcast(ServerMsg.SLIDE_QUEUE, slideData);

    this.sendToScreen(ServerMsg.SLIDE, currentSlide);
  }

  sendToScreen(type, payload) {
    this._sendToScreen(type, payload);
  }

  sendToHost(type, payload) {
    this._sendToHost(type, payload);
  }

  // === State Getters ===

  getGameState({ audience = 'public' } = {}) {
    const now = Date.now();
    const players = this.getPlayersBySeat().map((p) => {
      const base = audience === 'host' ? p.getPrivateState(this) : p.getPublicState();

      // Include heartbeat data for all audiences
      const stale = now - p.heartbeat.lastUpdate > 5000;
      base.heartbeat = {
        bpm: p.heartbeat.bpm,
        active: p.heartbeat.active && !stale,
      };

      return base;
    });

    // Count total werewolves (both alive and dead)
    const totalWerewolves = [...this.players.values()].filter(
      (p) => p.role && p.role.team === Team.WEREWOLF,
    ).length;

    return {
      phase: this.phase,
      dayCount: this.dayCount,
      players,
      totalWerewolves,
      pendingEvents: this.pendingEvents,
      activeEvents: [...this.activeEvents.keys()],
      eventParticipants: this.getEventParticipantMap(),
      eventProgress: this.getEventProgressMap(),
      eventMetadata: this.getEventMetadataMap(),
      eventRespondents: this.getEventRespondentsMap(),
    };
  }

  getEventParticipantMap() {
    const map = {};
    for (const [eventId, instance] of this.activeEvents) {
      map[eventId] = instance.participants;
    }
    return map;
  }

  getEventProgressMap() {
    const map = {};
    for (const [eventId, instance] of this.activeEvents) {
      const responded = Object.keys(instance.results).length;
      map[eventId] = {
        responded,
        total: instance.participants.length,
        complete: responded === instance.participants.length,
      };
    }
    return map;
  }

  getEventMetadataMap() {
    const map = {};
    for (const [eventId, instance] of this.activeEvents) {
      map[eventId] = {
        playerResolved: instance.event.playerResolved || false,
        playerInitiated: instance.event.playerInitiated || false,
      };
    }
    return map;
  }

  getEventRespondentsMap() {
    const map = {};
    for (const [eventId, instance] of this.activeEvents) {
      map[eventId] = Object.keys(instance.results);
    }
    return map;
  }

  // === Lobby Tutorial Slides ===

  pushCompSlide() {
    const players = [...this.players.values()];
    // In lobby use preAssignedRole; in game use active role
    const assigned = players.filter((p) => p.preAssignedRole || p.role);
    if (assigned.length === 0) {
      return { success: false, error: 'No roles assigned' };
    }

    // Count roles by team
    const roleCounts = {};
    const teamCounts = { village: 0, werewolf: 0 };
    for (const player of assigned) {
      const roleDef = getRole(player.preAssignedRole) || player.role;
      if (!roleDef) continue;
      if (!roleCounts[roleDef.id]) {
        roleCounts[roleDef.id] = {
          roleId: roleDef.id,
          roleName: roleDef.name,
          roleEmoji: roleDef.emoji,
          roleColor: roleDef.color,
          team: roleDef.team,
          count: 0,
        };
      }
      roleCounts[roleDef.id].count++;
      if (roleDef.team === Team.VILLAGE) teamCounts.village++;
      else if (roleDef.team === Team.WEREWOLF) teamCounts.werewolf++;
    }

    const unassigned = players.length - assigned.length;

    this.pushSlide({
      type: SlideType.COMPOSITION,
      title: 'ASSIGNED ROLES',
      playerIds: players.map((p) => p.id),
      roles: Object.values(roleCounts),
      teamCounts: { ...teamCounts, unassigned },
      style: SlideStyle.NEUTRAL,
    });

    this.addLog('Composition slide pushed');
    return { success: true };
  }

  pushRoleTipSlide(roleId) {
    const roleDef = getRole(roleId);
    if (!roleDef) {
      return { success: false, error: 'Unknown role' };
    }

    this.pushSlide({
      type: SlideType.ROLE_TIP,
      title: 'NEW ROLE',
      roleId: roleDef.id,
      roleName: roleDef.name,
      roleEmoji: roleDef.emoji,
      roleColor: roleDef.color,
      team: roleDef.team,
      abilities: this._getRoleAbilities(roleDef),
      detailedTip: roleDef.detailedTip || roleDef.description,
      style:
        roleDef.team === Team.WEREWOLF
          ? SlideStyle.HOSTILE
          : SlideStyle.NEUTRAL,
    });

    this.addLog(`Role tip slide pushed: ${roleDef.name}`);
    return { success: true };
  }

  pushItemTipSlide(itemId) {
    const itemDef = getItem(itemId);
    if (!itemDef) {
      return { success: false, error: 'Unknown item' };
    }

    const display = ITEM_DISPLAY[itemId] || {};
    this.pushSlide({
      type: SlideType.ITEM_TIP,
      title: 'ITEM',
      itemId: itemDef.id,
      itemName: itemDef.name,
      itemEmoji: display.emoji || '📦',
      itemDescription: itemDef.description,
      maxUses: itemDef.maxUses,
      style: SlideStyle.WARNING,
    });

    this.addLog(`Item tip slide pushed: ${itemDef.name}`);
    return { success: true };
  }

  // Derive display ability labels from a role's events (and passives/flows)
  _getRoleAbilities(roleDef) {
    // Color rules: red = hurts, blue = helps, yellow = fallback
    const abilityColors = {
      vote: '#d4af37',
      kill: '#c94c4c',
      hunt: '#c94c4c',
      vigil: '#c94c4c',
      block: '#c94c4c',
      clean: '#c94c4c',
      revenge: '#c94c4c',
      protect: '#7eb8da',
      investigate: '#7eb8da',
      pardon: '#7eb8da',
    };
    const fallbackColor = '#d4af37';

    const abilities = Object.keys(roleDef.events || {}).map((e) => ({
      label: e.toUpperCase(),
      color: abilityColors[e] || fallbackColor,
    }));

    // Roles whose key abilities are passive/flow-based, not in events
    const passiveAbilities = {
      [RoleId.HUNTER]: [{ label: 'REVENGE', color: abilityColors.revenge }],
      [RoleId.GOVERNOR]: [{ label: 'PARDON', color: abilityColors.pardon }],
    };
    const extras = passiveAbilities[roleDef.id] || [];

    return [...abilities, ...extras];
  }

  // === Logging ===

  addLog(message) {
    const entry = {
      timestamp: Date.now(),
      message,
    };
    this.log.push(entry);
    this.broadcast(ServerMsg.LOG, this.log.slice(-50)); // Last 50 entries
  }
}
