// server/Game.js
// Core game state machine and logic

// Sentinel value that distinguishes "cache empty" from "no winner (null)".
const WIN_CACHE_EMPTY = Symbol('WIN_CACHE_EMPTY');

// Named constants for magic numbers
const BROADCAST_DEBOUNCE_MS = 120;  // Coalesce rapid dial input broadcasts
const LOG_MAX_ENTRIES = 500;        // Server-side log trim threshold

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
import { str } from './strings.js';
import { PersistenceManager } from './PersistenceManager.js';
import { SlideManager } from './SlideManager.js';
import { EventResolver } from './EventResolver.js';
import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class Game {
  constructor(broadcast, sendToHostFn, sendToScreenFn) {
    this.broadcast = broadcast; // Function to send to all clients
    this._sendToHost = sendToHostFn; // Function to find & send to host from clients set
    this._sendToScreen = sendToScreenFn; // Function to find & send to screen from clients set
    this.host = null; // Legacy reference (kept for handler compat)
    this.screen = null; // Legacy reference (kept for handler compat)
    this.playerCustomizations = new Map(); // Persist player names/portraits across resets

    // Sub-object managers (created before reset() since reset() calls their reset())
    this.persistence = new PersistenceManager(this);
    this.slides = new SlideManager(this);
    this.events = new EventResolver(this);

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

    // Microtask coalescing: multiple broadcastGameState() calls in the same
    // synchronous tick schedule a single actual send on the next microtask.
    this._broadcastScheduled = false;

    this.presetRolePool = null;

    this.reset();
    this.persistence.loadAll();
    this._ensureSimTimer();

    // Auto-load default preset if one is set
    if (this._hostSettings.defaultPresetId) {
      this.loadGamePreset(this._hostSettings.defaultPresetId);
    }
  }

  // ── Getters/setters: delegate sub-object state to Game for backward compat ──

  // PersistenceManager state
  get _hostSettings() { return this.persistence._hostSettings; }
  set _hostSettings(v) { this.persistence._hostSettings = v; }
  get _gamePresets() { return this.persistence._gamePresets; }
  set _gamePresets(v) { this.persistence._gamePresets = v; }
  get _scores() { return this.persistence._scores; }
  set _scores(v) { this.persistence._scores = v; }
  get _preGameScores() { return this.persistence._preGameScores; }
  set _preGameScores(v) { this.persistence._preGameScores = v; }

  // SlideManager state
  get slideQueue() { return this.slides.slideQueue; }
  set slideQueue(v) { this.slides.slideQueue = v; }
  get currentSlideIndex() { return this.slides.currentSlideIndex; }
  set currentSlideIndex(v) { this.slides.currentSlideIndex = v; }
  get slideIdCounter() { return this.slides.slideIdCounter; }
  set slideIdCounter(v) { this.slides.slideIdCounter = v; }
  get _heartrateSlidePlayerId() { return this.slides._heartrateSlidePlayerId; }
  set _heartrateSlidePlayerId(v) { this.slides._heartrateSlidePlayerId = v; }

  // EventResolver state
  get pendingEvents() { return this.events.pendingEvents; }
  set pendingEvents(v) { this.events.pendingEvents = v; }
  get activeEvents() { return this.events.activeEvents; }
  set activeEvents(v) { this.events.activeEvents = v; }
  get eventTimers() { return this.events.eventTimers; }
  set eventTimers(v) { this.events.eventTimers = v; }
  get eventResults() { return this.events.eventResults; }
  set eventResults(v) { this.events.eventResults = v; }
  get customEventConfig() { return this.events.customEventConfig; }
  set customEventConfig(v) { this.events.customEventConfig = v; }

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

    // Reset sub-object managers
    if (this.events) this.events.reset();
    if (this.slides) this.slides.reset();

    resetSeatCounter();
    this.players = new Map(); // id -> Player
    // NOTE: We keep host and screen connections alive during reset
    // Only clear them if explicitly needed (not during game reset)

    this.phase = GamePhase.LOBBY;
    this.dayCount = 0;

    // Legacy interrupt handling (flows now manage their own state)
    // Kept for backwards compatibility during transition
    this.interruptData = null;

    // Reset all flows
    if (this.flows) {
      for (const flow of this.flows.values()) {
        flow.cleanup();
      }
    }

    // Fixer covering flag (set by clean event, read by kill event)
    this.fixerCovering = false;

    // Chemist flag (set by poison event, read by kill event)
    this.chemistActing = false;

    // Death processing queue
    this._deathQueue = [];
    this._processingDeaths = false;

    // Slide count at start of night phase (for detecting silent nights)
    this._nightStartSlideCount = 0;

    // Log
    this.log = [];

    // Win condition cache — invalidated by killPlayer, revivePlayer, role/item changes
    this._winCache = WIN_CACHE_EMPTY;

    // Operator terminal
    this.operatorWords = [];
    this.operatorReady = false;

    // Heartbeat mode
    this.heartbeatMode = false;
    this.heartbeatSpikesThisDay = new Set();

    // Fake heartbeat simulation
    this._fakeHeartbeats = false;
    this._fakeHeartbeatTimer = null;
    this._fakeHeartbeatSimState = {};

    // Heartbeat calibration (null when not active)
    if (this._calibrationTimer) clearTimeout(this._calibrationTimer);
    this._calibration = null;
    this._calibrationTimer = null;

    // Simulated heartbeat (secret per-player fake, survives reset)
    // Don't clear _simHeartbeatState or timer on reset — these persist like calibration config
    if (!this._simHeartbeatState) this._simHeartbeatState = {};
    if (this._hostSettings) this._ensureSimTimer();

    // Noise injection state per player (tracks recent normalized values)
    if (!this._noiseState) this._noiseState = {};
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

    // Ensure player has a default calibration entry
    const calConfig = this._hostSettings.heartbeatCalibration || {};
    if (!calConfig[id]) {
      calConfig[id] = { restingBpm: 60, elevatedBpm: 100, enabled: false };
      this._hostSettings.heartbeatCalibration = calConfig;
      this.saveHostSettings(this._hostSettings);
    }

    const via = ws.source === 'terminal' ? 'terminal' : 'web';
    this.addLog(str('log', 'playerJoined', { name: player.name, via }));
    this.broadcastPlayerList();
    this.broadcastGameState();

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
  _loadHostSettingsFromDisk() { this.persistence._loadHostSettingsFromDisk(); }
  getHostSettings() { return this.persistence.getHostSettings(); }
  saveHostSettings(settings) { return this.persistence.saveHostSettings(settings); }
  setDefaultPreset(id) { return this.persistence.setDefaultPreset(id); }

  // === Scores ===
  _loadScoresFromDisk() { this.persistence._loadScoresFromDisk(); }
  _saveScoresToDisk() { this.persistence._saveScoresToDisk(); }
  setScore(name, score) { return this.persistence.setScore(name, score); }
  getScoresForConnectedPlayers() { return this.persistence.getScoresForConnectedPlayers(); }
  getScoresObject() { return this.persistence.getScoresObject(); }
  sendScoresToHost() { return this.persistence.sendScoresToHost(); }
  pushScoreSlide() { return this.persistence.pushScoreSlide(); }

  // === Game Presets ===
  _loadGamePresetsFromDisk() { this.persistence._loadGamePresetsFromDisk(); }
  _saveGamePresetsToDisk() { this.persistence._saveGamePresetsToDisk(); }
  getGamePresets() { return this.persistence.getGamePresets(); }
  saveGamePreset(name, timerDuration, autoAdvanceEnabled, fakeHeartbeats = false, overwriteId = null) { return this.persistence.saveGamePreset(name, timerDuration, autoAdvanceEnabled, fakeHeartbeats, overwriteId); }
  loadGamePreset(id) { return this.persistence.loadGamePreset(id); }
  deleteGamePreset(id) { return this.persistence.deleteGamePreset(id); }

  removePlayer(id) {
    const player = this.players.get(id);
    if (!player) return { success: false, error: 'Player not found' };

    // Notify all connections they've been kicked, then close
    const kickMsg = JSON.stringify({ type: ServerMsg.KICKED, payload: {} });
    for (const ws of player.connections) {
      if (ws && ws.readyState <= 1) {
        try { ws.send(kickMsg); ws.close(); } catch {}
      }
    }

    this.players.delete(id);
    this.addLog(str('log', 'playerLeft', { name: player.name }));
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
      this.addLog(str('log', 'playerReconnected', { name: player.name, via }));
    } else if (ws.source === 'terminal' && !hadTerminal) {
      this.addLog(str('log', 'terminalConnected', { name: player.name }));
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
      this.addLog(str('log', 'gameStartError', { error: validation.error }));
      return { success: false, error: validation.error };
    }

    // Snapshot scores for animated scoreboard at end of game
    this.persistence.capturePreGameScores();

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

    // Clear per-day heartbeat spike tracking
    this.heartbeatSpikesThisDay.clear();

    // Build pending events for this phase
    this.buildPendingEvents();

    // Flag role reveal so each player's first idle shows CRITICAL blink
    for (const player of this.players.values()) {
      if (player.isAlive) player.roleRevealPending = true;
    }

    this.addLog(str('log', 'gameStarted'));
    this.pushSlide({
      type: 'gallery',
      title: str('slides', 'phase.day1.title'),
      subtitle: str('slides', 'phase.day1.subtitle'),
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

    this.addLog(str('log', 'rolesRandomized'));
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
        const nobodyIndex = pool.lastIndexOf('nobody');
        if (nobodyIndex !== -1) {
          pool.splice(nobodyIndex, 1);
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
        const nobodyIndex = pool.lastIndexOf('nobody');
        if (nobodyIndex === -1) continue; // No room — skip silently
        pool.splice(nobodyIndex, 1, companionId);
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
        const vi = remaining.lastIndexOf(RoleId.NOBODY);
        if (vi !== -1) remaining.splice(vi, 1);
        else remaining.pop();
      }
    }
    const finalRoles = [...preAssigned, ...remaining];

    // Count teams
    const wolves = finalRoles.filter(
      (r) => getRole(r)?.team === Team.CELL,
    ).length;
    const circleMembers = finalRoles.filter(
      (r) => getRole(r)?.team === Team.CIRCLE,
    ).length;

    if (circleMembers === 0) {
      return {
        valid: false,
        error: 'No circle team members — cell wins instantly',
      };
    }
    if (wolves === 0) {
      return {
        valid: false,
        error: 'No cell team members — circle wins instantly',
      };
    }
    if (wolves >= circleMembers) {
      return {
        valid: false,
        error: `${wolves} cell members vs ${circleMembers} circle members — cell wins instantly`,
      };
    }

    return { valid: true };
  }

  _setTutorialTips() {
    for (const player of this.players.values()) {
      if (player.role.team === Team.CELL) {
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

        // Deliver private results (e.g., seeker investigations) to living players
        if (resolution.investigations) {
          for (const inv of resolution.investigations) {
            const player = this.getPlayer(inv.seekerId);
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

    // Clear protection, player event state, and fixer flag
    this.fixerCovering = false;
    this.chemistActing = false;
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
      this.addLog(str('log', 'nightBegins', { n: this.dayCount }));
      this.pushSlide({
        type: 'gallery',
        title: str('slides', 'phase.nightN.title', { n: this.dayCount }),
        subtitle: str('slides', 'phase.nightN.subtitle'),
        playerIds: this.getAlivePlayers().map((p) => p.id),
        style: SlideStyle.NEUTRAL,
      }); // Jump immediately on phase transition
      // Snapshot slide count after the night gallery — used to detect silent nights
      this._nightStartSlideCount = this.slideQueue.length;
    } else if (this.phase === GamePhase.NIGHT) {
      this.phase = GamePhase.DAY;
      this.dayCount++;
      this.heartbeatSpikesThisDay.clear();
      this.addLog(str('log', 'dayBegins', { n: this.dayCount }));
      this.pushSlide({
        type: 'gallery',
        title: str('slides', 'phase.dayN.title', { n: this.dayCount }),
        subtitle: str('slides', 'phase.dayN.subtitle'),
        playerIds: this.getAlivePlayers().map((p) => p.id),
        style: SlideStyle.NEUTRAL,
      }); // Jump immediately on phase transition
    }

    // Clear events and build new ones
    this.activeEvents.clear();
    this.eventResults = [];
    this.buildPendingEvents();

    this.broadcastGameState();

    return { success: true };
  }

  buildPendingEvents() { return this.events.buildPendingEvents(); }

  // === Event Management ===

  /**
   * Get all participants for an event, combining:
   * - Role-based participants (from event.participants)
   * - Item-based participants (players with items that have startsEvent: eventId)
   */
  getEventParticipants(eventId) { return this.events.getEventParticipants(eventId); }

  startEvent(eventId) { return this.events.startEvent(eventId); }

  // Start (or join) an event on behalf of a single player activating an item.
  // Unlike startEvent(), this does NOT sweep in all eligible participants — only the
  // activating player is added.  If the event is already active (e.g. the seeker's
  // INVESTIGATE is running), the player is appended to its participant list and
  // notified without restarting the event.
  startEventForPlayer(eventId, playerId) { return this.events.startEventForPlayer(eventId, playerId); }

  startAllEvents() { return this.events.startAllEvents(); }

  /**
   * Create a custom event and add it to pending events.
   * The event is not started until startEvent('customEvent') is called.
   */
  createCustomEvent(config) { return this.events.createCustomEvent(config); }

  /**
   * Internal method to start the custom event using stored config.
   * Called by startEvent('customEvent').
   */
  _startCustomEvent() { return this.events._startCustomEvent(); }

  validateCustomEventConfig(config) { return this.events.validateCustomEventConfig(config); }

  recordSelection(playerId, targetId) { return this.events.recordSelection(playerId, targetId); }

  startEventTimer(eventId, duration) { return this.events.startEventTimer(eventId, duration); }

  startAllEventTimers(duration) { return this.events.startAllEventTimers(duration); }

  clearEventTimer(eventId) { return this.events.clearEventTimer(eventId); }

  pauseEventTimers() { return this.events.pauseEventTimers(); }

  resumeEventTimers() { return this.events.resumeEventTimers(); }

  cancelEventTimers() { return this.events.cancelEventTimers(); }

  checkEventTimersComplete() { return this.events.checkEventTimersComplete(); }

  // ── Shared event startup helper ──────────────────────────────────────────

  // Registers each participant into the event, sends them an EVENT_PROMPT,
  // and auto-selects when only a single target is available.
  // getTargets(player) → Player[]   prompt → { eventName, description, allowAbstain }
  _notifyEventParticipants(eventId, participantIds, getTargets, prompt) { return this.events._notifyEventParticipants(eventId, participantIds, getTargets, prompt); }

  // ── Event definition validation ──────────────────────────────────────────

  // Validates that an event definition has all required fields with correct types.
  // Throws on misconfiguration so silent bugs are caught at start time, not resolve time.
  _assertValidEventDef(event, eventId) { return this.events._assertValidEventDef(event, eventId); }

  // ── resolveEvent helpers ────────────────────────────────────────────────

  // Returns an error string if responses are incomplete, null if ready to resolve.
  _checkResponsesComplete(force, event, results, participants) { return this.events._checkResponsesComplete(force, event, results, participants); }

  // Nullify selections from roleblocked players (treat as abstain).
  // The block event itself is exempt — blocking a handler is intentional.
  // Returns an array of { actorId, originalTargetId } for non-null selections that were blocked.
  _applyRoleblocks(results, eventId) { return this.events._applyRoleblocks(results, eventId); }

  // Sync player display state, remove them from the event, and consume any
  // item that granted their participation (only on a non-abstain result).
  // Sync must happen BEFORE clearFromEvent so getActiveResult() can still read
  // the final selection; clearing first would flip the display to WAITING.
  _cleanupParticipants(participants, eventId, results) { return this.events._cleanupParticipants(participants, eventId, results); }

  // Finalise a successful resolution: remove the event, log, and push its slide.
  _commitResolution(eventId, resolution) { return this.events._commitResolution(eventId, resolution); }

  // Deliver private investigation results to individual seers.
  _dispatchPrivateResults(resolution) { return this.events._dispatchPrivateResults(resolution); }

  // ─────────────────────────────────────────────────────────────────────────

  resolveEvent(eventId, { force = false } = {}) { return this.events.resolveEvent(eventId, { force }); }

  resolveAllEvents() { return this.events.resolveAllEvents(); }

  skipEvent(eventId) { return this.events.skipEvent(eventId); }

  resetEvent(eventId) { return this.events.resetEvent(eventId); }

  // Build vote tally slide data with all necessary info for rendering
  buildTallySlide(eventId, results, event, outcome) { return this.events.buildTallySlide(eventId, results, event, outcome); }

  showTallyAndDeferResolution(eventId, instance) { return this.events.showTallyAndDeferResolution(eventId, instance); }

  triggerRunoff(eventId, frontrunners) { return this.events.triggerRunoff(eventId, frontrunners); }

  _activateRunoff(eventId) { return this.events._activateRunoff(eventId); }

  // === Win Conditions ===

  _invalidateWinCache() {
    this._winCache = WIN_CACHE_EMPTY;
  }

  checkWinCondition() {
    if (this._winCache !== WIN_CACHE_EMPTY) return this._winCache;

    const alive = this.getAlivePlayers();
    const cellMembers = alive.filter((p) => p.role.team === Team.CELL);
    // Cowards can't vote, so they provide no effective voting power to the circle.
    // Exclude them from the majority calculation so the cell isn't artificially
    // blocked by unvotable circle members.
    const circleMembers = alive.filter((p) => p.role.team === Team.CIRCLE && !p.hasItem('coward'));

    let result = null;
    if (cellMembers.length === 0) result = Team.CIRCLE;
    else if (cellMembers.length >= circleMembers.length) result = Team.CELL;

    this._winCache = result;
    return result;
  }

  endGame(winner) {
    if (this.phase === GamePhase.GAME_OVER) return; // Guard against multiple calls
    this.phase = GamePhase.GAME_OVER;

    // Reveal all cleaned roles at game over
    for (const player of this.players.values()) {
      player.isRoleCleaned = false;
    }

    const winnerName = winner === Team.CIRCLE
      ? str('slides', 'victory.circleName')
      : str('slides', 'victory.cellName');

    this.addLog(str('log', 'gameOver', { winners: winnerName }));

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
          winner === Team.CIRCLE
            ? str('slides', 'victory.circleSubtitle')
            : str('slides', 'victory.cellSubtitle'),
        style:
          winner === Team.CIRCLE ? SlideStyle.POSITIVE : SlideStyle.HOSTILE,
      },
      false,
    ); // Queue after death slide, don't jump to it

    this.persistence.awardEndGameScores(winner);
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
   * Called when a player's last connection closes.
   * Gives active flows a chance to auto-resolve rather than hanging indefinitely.
   * @param {Player} player
   */
  notifyFlowsOfDisconnect(player) {
    for (const flow of this.flows.values()) {
      if (!flow.isActive()) continue;
      const result = flow.onPlayerDisconnect(player);
      if (result) {
        this._executeFlowResult(result);
        this.broadcastGameState();
        break; // Only one flow can be active at a time
      }
    }
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
    for (const player of this.players.values()) {
      if (!player.hasItem(ItemId.POISONED) || !player.isAlive) continue;
      // Trigger if it's not the same day poison was applied
      if (this.dayCount <= player.poisonedAt) continue;

      this.removeItem(player.id, ItemId.POISONED);
      player.poisonedAt = null;

      // Poison is unstoppable once applied — protection on a subsequent night has no effect.
      // (Medic CAN prevent poisoning on the same night it is administered — see kill event.)

      this.addLog(str('log', 'playerDiedPoison', { name: player.getNameWithEmoji() }));
      this.killPlayer(player.id, 'poison');
      const teamNames = {
        circle: str('slides', 'death.teamCircle'),
        cell: str('slides', 'death.teamCell'),
        neutral: str('slides', 'death.teamNeutral'),
      };
      const teamName = teamNames[player.role?.team] || str('slides', 'death.teamUnknown');
      const deathSuffix = this._hostSettings.poisonKillsGeneric
        ? str('slides', 'death.suffixKilled')
        : str('slides', 'death.suffixPoisoned');
      this.queueDeathSlide({
        type: 'death',
        _slidePriority: 50, // Between normal kills (0) and hunter revenge (100)
        playerId: player.id,
        title: `${teamName} ${deathSuffix}`,
        subtitle: player.name,
        revealRole: true,
        style: SlideStyle.HOSTILE,
      }, false);
    }
  }

  killPlayer(playerId, cause) {
    const player = this.getPlayer(playerId);
    if (!player || !player.isAlive) return false;

    // HARDENED: absorbs any kill on first trigger
    if (player.hasItem(ItemId.HARDENED)) {
      this._hardenedAbsorb(player);
      return 'barricaded';
    }

    // PROSPECT: cell kill on a prospect → recruit instead of kill
    if (cause === 'cell' && player.hasItem(ItemId.PROSPECT)) {
      this._recruitProspect(player);
      return true;
    }

    player.kill(cause);
    player.deathDay = this.dayCount;
    player.deathPhase = this.phase;
    this._invalidateWinCache();
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

  _hardenedAbsorb(player) {
    player.removeItem(ItemId.HARDENED);
    player.lastEventResult = { message: str('feedback', 'hardened.broken'), detail: str('feedback', 'hardened.detail'), critical: true };
    this.addLog(str('log', 'hardenedAbsorbed', { name: player.getNameWithEmoji() }));
  }

  _recruitProspect(player) {
    player.removeItem(ItemId.PROSPECT);
    player.assignRole(getRole(RoleId.SLEEPER));
    this._invalidateWinCache(); // Team changed
    player.lastEventResult = { message: str('feedback', 'prospect.changed'), detail: str('feedback', 'prospect.detail'), critical: true };
    this.addLog(str('log', 'playerRecruited', { name: player.getNameWithEmoji() }));
    this.broadcastPackState(); // syncs all cell members including the new recruit
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
        // Broadcast pack state so all cell members see new roles
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
        this.addLog(str('log', 'playerDiedHeartbreak', { name: other.getNameWithEmoji() }));
        this.queueDeathSlide(this.createDeathSlide(other, 'heartbreak'), false);
      }
    }
  }

  revivePlayer(playerId, cause) {
    const player = this.getPlayer(playerId);
    if (!player) return false;
    player.revive(cause);
    this._invalidateWinCache();
    this.addLog(str('log', 'playerRevived', { name: player.getNameWithEmoji() }));
    return true;
  }

  giveItem(playerId, itemId, { silent = false } = {}) {
    const player = this.getPlayer(playerId);
    if (!player) {
      return { success: false, error: 'Player not found' };
    }

    const itemDef = getItem(itemId);
    if (!itemDef) {
      return { success: false, error: 'Item not found' };
    }

    player.addItem(itemDef);
    if (itemId === ItemId.COWARD) this._invalidateWinCache();
    if (!silent) this.addLog(str('log', 'itemGiven', { name: player.getNameWithEmoji(), item: itemDef.name }));

    if (itemId === 'coward') {
      this.pushSlide({
        type: SlideType.DEATH,
        coward: true,
        playerId: player.id,
        title: player.name.toUpperCase(),
        subtitle: str('slides', 'death.cowardTitle'),
        revealRole: false,
        style: SlideStyle.WARNING,
      }, true);
    }

    return { success: true };
  }

  // Host-initiated item removal (invalidates win cache for coward).
  // Returns true if item was found and removed.
  removeItem(playerId, itemId) {
    const player = this.getPlayer(playerId);
    if (!player) return false;
    const removed = player.removeItem(itemId);
    if (removed && itemId === ItemId.COWARD) this._invalidateWinCache();
    return removed;
  }

  consumeItem(playerId, itemId) {
    const player = this.getPlayer(playerId);
    if (!player) return false;

    const depleted = player.useItem(itemId);
    if (depleted) {
      player.removeItem(itemId);
      if (itemId === ItemId.COWARD) this._invalidateWinCache();
    }
    return true;
  }

  // === Slide Management ===

  // Centralized death slide queuing - always splits into two slides:
  //   1. Identity slide: victim name in title (e.g. "MARK KILLED"), no role shown
  //      If slide.identityTitle is set, uses that as title (e.g. pistol: "MARK shot JANE!")
  //      and sets subtitle to victim name.
  //   2. Role reveal slide: team name in title (e.g. "CIRCLE KILLED"), shows role.
  //      If victim.isRoleCleaned, title becomes "??? {ACTION}" and shows revealText instead.
  queueDeathSlide(slide, jumpTo = true) { return this.slides.queueDeathSlide(slide, jumpTo); }

  // Create a death slide for a given cause (used when events don't provide custom slides)
  createDeathSlide(player, cause) { return this.slides.createDeathSlide(player, cause); }

  pushSlide(slide, jumpTo = true) { return this.slides.pushSlide(slide, jumpTo); }

  nextSlide() { return this.slides.nextSlide(); }

  prevSlide() { return this.slides.prevSlide(); }

  _onSlideActivated() { return this.slides._onSlideActivated(); }

  clearSlides() { return this.slides.clearSlides(); }

  getCurrentSlide() { return this.slides.getCurrentSlide(); }

  // === Operator Terminal ===

  getOperatorState() {
    return { words: this.operatorWords, ready: this.operatorReady };
  }

  operatorAdd(word) {
    this.operatorWords.push(word);
    this.broadcastOperatorState();
  }

  operatorDelete() {
    this.operatorWords.pop();
    this.operatorReady = false;
    this.broadcastOperatorState();
  }

  operatorClear() {
    this.operatorWords = [];
    this.operatorReady = false;
    this.broadcastOperatorState();
  }

  operatorSetReady(ready) {
    this.operatorReady = ready;
    this.broadcastOperatorState();
  }

  operatorSend() {
    if (this.operatorWords.length === 0) return;
    this.pushSlide({
      type: SlideType.OPERATOR,
      title: str('slides', 'misc.operatorTitle'),
      words: [...this.operatorWords],
    }, true);
    this.operatorWords = [];
    this.operatorReady = false;
    this.broadcastOperatorState();
  }

  broadcastOperatorState() {
    this.broadcast(ServerMsg.OPERATOR_STATE, this.getOperatorState());
  }

  // === Heartbeat Mode ===

  // Whether live heartbeat data is needed (globally or for a specific player via slide)
  _isHeartrateNeeded(playerId) {
    if (this.heartbeatMode || this._calibration) return true;
    if (playerId && this._heartrateSlidePlayerId === playerId) return true;
    return false;
  }

  // Tell all terminal-connected players to enable/disable their AD8232
  _broadcastHeartrateMonitor() {
    for (const player of this.players.values()) {
      if (player.terminalConnected) {
        player.send(ServerMsg.HEARTRATE_MONITOR, { enabled: this._isHeartrateNeeded(player.id) });
      }
    }
  }

  toggleHeartbeatMode() {
    this.heartbeatMode = !this.heartbeatMode;
    this._broadcastHeartrateMonitor();
    this.broadcastGameState();
    return { success: true, heartbeatMode: this.heartbeatMode };
  }

  toggleFakeHeartbeats() {
    this._fakeHeartbeats = !this._fakeHeartbeats;
    if (this._fakeHeartbeats) {
      this._fakeHeartbeatSimState = {};
      this._fakeHeartbeatTimer = setInterval(() => this._tickFakeHeartbeats(), 1500);
      this.broadcastGameState();
    } else {
      clearInterval(this._fakeHeartbeatTimer);
      this._fakeHeartbeatTimer = null;
      // Zero out fake heartbeats on all players
      for (const player of this.players.values()) {
        if (player.heartbeat?.fake) {
          player.heartbeat = { bpm: 0, active: false, fake: false, lastUpdate: Date.now() };
        }
      }
      this.broadcastGameState();
    }
    return { success: true, fakeHeartbeats: this._fakeHeartbeats };
  }

  _initFakeSimState() {
    const base = 60 + Math.random() * 20;
    return { base, current: base, mode: 'normal', spikeTarget: 0, spikeTicks: 0 };
  }

  // canSpike: true = spikes can exceed ceiling (debug fakes & simsCanLose)
  // ceiling: hard clamp for BPM when canSpike is false
  // Same spike frequency either way — only difference is the clamp.
  _tickFakeSimState(s, { canSpike = true, ceiling = 200 } = {}) {
    if (s.mode === 'normal') {
      if (Math.random() < 0.005) {
        s.mode = 'spiking';
        s.spikeTarget = 112 + Math.random() * 20;
        s.spikeTicks = 5 + Math.floor(Math.random() * 5);
      } else {
        const drift = (s.base - s.current) * 0.15;
        s.current = Math.round(s.current + drift + (Math.random() * 6 - 3));
        s.current = Math.max(54, Math.min(100, s.current));
      }
    } else if (s.mode === 'spiking') {
      s.current = Math.round(s.current + (s.spikeTarget - s.current) * 0.5);
      s.spikeTicks--;
      if (s.spikeTicks <= 0) s.mode = 'recovering';
    } else if (s.mode === 'recovering') {
      s.current = Math.round(s.current + (s.base - s.current) * 0.15);
      if (Math.abs(s.current - s.base) < 3) {
        s.current = Math.round(s.base);
        s.mode = 'normal';
      }
    }
    // Hard clamp — spikes happen identically, but get capped when canSpike is off
    if (!canSpike) s.current = Math.min(s.current, ceiling - 1);
    return s;
  }

  _tickFakeHeartbeats() {
    for (const player of this.players.values()) {
      // Don't override real heartbeats
      if (player.heartbeat?.active && !player.heartbeat?.fake) continue;
      if (!this._fakeHeartbeatSimState[player.id]) {
        this._fakeHeartbeatSimState[player.id] = this._initFakeSimState();
      }
      const s = this._tickFakeSimState(this._fakeHeartbeatSimState[player.id]);
      player.heartbeat = { bpm: s.current, active: true, fake: true, lastUpdate: Date.now() };
      this._checkHeartbeatModeSpike(player);
    }
    this.broadcastGameState();
  }

  _checkHeartbeatModeSpike(player) {
    if (!this.heartbeatMode) return;
    if (this.phase !== GamePhase.DAY) return;
    if (!player.isAlive) return;
    const threshold = this._hostSettings.heartbeatThreshold ?? 110;
    const cal = this._hostSettings.heartbeatCalibration?.[player.id];
    const bpmForCheck = (cal?.enabled) ? this._normalizeHeartbeat(player) : player.heartbeat.bpm;
    if (bpmForCheck <= threshold) return;
    if (this.heartbeatSpikesThisDay.has(player.id)) return;

    // If vote is already running, check if player already confirmed — if so, skip
    if (this.activeEvents.has(EventId.VOTE)) {
      const voteInstance = this.activeEvents.get(EventId.VOTE);
      if (player.id in voteInstance.results) return;
      // Remove player from vote participants so they can't vote
      voteInstance.participants = voteInstance.participants.filter(id => id !== player.id);
    }

    this.heartbeatSpikesThisDay.add(player.id);
    player.addItem(getItem(ItemId.NOVOTE));
    this.addLog(str('log', 'bpmPanicked', { name: player.getNameWithEmoji(), bpm: bpmForCheck, threshold }));
    this.pushSlide({
      type: SlideType.HEARTBEAT,
      playerId: player.id,
      playerName: player.name,
      portrait: player.portrait,
      bpm: bpmForCheck,
      fake: player.heartbeat.fake ?? false,
      title: str('slides', 'misc.bpmSpike.title', { name: player.name.toUpperCase() }),
      subtitle: str('slides', 'misc.bpmSpike.subtitle'),
      style: SlideStyle.WARNING,
    }, false);
    this.broadcastGameState();
  }

  // === Heartbeat Calibration ===

  startCalibration(playerIds) {
    if (this._calibration) this.stopCalibration();
    this._calibration = {
      phase: 'resting',
      playerIds: playerIds.map(String),
      samples: {},  // { playerId: { resting: [], elevated: [] } }
      duration: 30000,
      startTime: Date.now(),
    };
    for (const id of this._calibration.playerIds) {
      this._calibration.samples[id] = { resting: [], elevated: [] };
    }
    this._calibrationTimer = setTimeout(() => this._advanceCalibration(), 30000);
    this._broadcastCalibrationState();
    this._broadcastHeartrateMonitor();
    this.broadcastGameState();
    return { success: true };
  }

  startSingleCalibration(playerId) {
    return this.startCalibration([playerId]);
  }

  stopCalibration() {
    if (this._calibrationTimer) clearTimeout(this._calibrationTimer);
    this._calibration = null;
    this._calibrationTimer = null;
    this._broadcastCalibrationState();
    this._broadcastHeartrateMonitor();
    this.broadcastGameState();
    return { success: true };
  }

  _advanceCalibration() {
    if (!this._calibration) return;
    if (this._calibration.phase === 'resting') {
      this._calibration.phase = 'elevated';
      this._calibration.startTime = Date.now();
      this._calibrationTimer = setTimeout(() => this._advanceCalibration(), 30000);
    } else if (this._calibration.phase === 'elevated') {
      this._calibration.phase = 'review';
    }
    this._broadcastCalibrationState();
    this.broadcastGameState();
  }

  collectCalibrationSample(player) {
    if (!this._calibration) return;
    if (!this._calibration.playerIds.includes(String(player.id))) return;
    const bpm = player.heartbeat?.bpm;
    if (!bpm || bpm <= 0) return;
    const phase = this._calibration.phase;
    if (phase !== 'resting' && phase !== 'elevated') return;
    this._calibration.samples[player.id][phase].push(bpm);
  }

  saveCalibration() {
    if (!this._calibration || this._calibration.phase !== 'review') {
      return { success: false, error: 'No calibration to save' };
    }
    const calConfig = { ...this._hostSettings.heartbeatCalibration };
    let count = 0;
    for (const id of this._calibration.playerIds) {
      const s = this._calibration.samples[id];
      const restingMedian = this._median(s.resting);
      const elevatedMedian = this._median(s.elevated);
      if (restingMedian > 0 && elevatedMedian > 0 && elevatedMedian > restingMedian) {
        calConfig[id] = { restingBpm: restingMedian, elevatedBpm: elevatedMedian, enabled: true };
        count++;
      }
    }
    this._hostSettings.heartbeatCalibration = calConfig;
    this.saveHostSettings(this._hostSettings);
    this.addLog(str('log', 'calibrationSaved', { count }));
    this.stopCalibration();
    return { success: true };
  }

  togglePlayerHeartbeat(playerId) {
    const calConfig = this._hostSettings.heartbeatCalibration || {};
    const entry = calConfig[playerId];
    if (!entry) return { success: false, error: 'Player not calibrated' };
    entry.enabled = !entry.enabled;
    this.saveHostSettings(this._hostSettings);
    this.broadcastGameState();
    return { success: true, enabled: entry.enabled };
  }

  setPlayerCalibration(playerId, restingBpm, elevatedBpm) {
    if (!restingBpm || !elevatedBpm || elevatedBpm <= restingBpm) {
      return { success: false, error: 'Elevated must be greater than resting' };
    }
    const calConfig = this._hostSettings.heartbeatCalibration || {};
    const existing = calConfig[playerId];
    calConfig[playerId] = {
      restingBpm: Math.round(restingBpm),
      elevatedBpm: Math.round(elevatedBpm),
      enabled: existing?.enabled ?? true,
    };
    this._hostSettings.heartbeatCalibration = calConfig;
    this.saveHostSettings(this._hostSettings);
    this.broadcastGameState();
    return { success: true };
  }

  togglePlayerSimulated(playerId) {
    const calConfig = this._hostSettings.heartbeatCalibration || {};
    if (!calConfig[playerId]) {
      // Auto-create a calibration entry with sensible defaults
      calConfig[playerId] = { restingBpm: 60, elevatedBpm: 100, enabled: true };
      this._hostSettings.heartbeatCalibration = calConfig;
    }
    const entry = calConfig[playerId];
    entry.simulated = !entry.simulated;
    entry.enabled = true;
    this.saveHostSettings(this._hostSettings);
    if (entry.simulated) {
      this._simHeartbeatState[playerId] = this._initFakeSimState();
    } else {
      delete this._simHeartbeatState[playerId];
    }
    this._ensureSimTimer();
    this.broadcastGameState();
    return { success: true, simulated: entry.simulated };
  }

  _ensureSimTimer() {
    const hasSimulated = Object.values(this._hostSettings?.heartbeatCalibration || {})
      .some(c => c.simulated);
    if (hasSimulated && !this._simHeartbeatTimer) {
      this._simHeartbeatTimer = setInterval(() => this._tickSimHeartbeats(), 1500);
    } else if (!hasSimulated && this._simHeartbeatTimer) {
      clearInterval(this._simHeartbeatTimer);
      this._simHeartbeatTimer = null;
    }
  }

  _tickSimHeartbeats() {
    const calConfig = this._hostSettings?.heartbeatCalibration || {};
    const simsCanLose = this._hostSettings?.simsCanLose ?? false;
    const threshold = this._hostSettings?.heartbeatThreshold ?? 110;
    let ticked = false;
    for (const [id, cal] of Object.entries(calConfig)) {
      if (!cal.simulated) continue;
      const player = this.getPlayer(id);
      if (!player) continue;
      if (!this._simHeartbeatState[id]) {
        this._simHeartbeatState[id] = this._initFakeSimState();
      }
      const s = this._tickFakeSimState(this._simHeartbeatState[id], {
        canSpike: simsCanLose,
        ceiling: threshold,
      });
      // Simulated always wins over real sensor data
      player.heartbeat = { bpm: s.current, active: true, fake: false, _simulated: true, lastUpdate: Date.now() };
      this._checkHeartbeatModeSpike(player);
      ticked = true;
    }
    if (ticked) this.broadcastGameState();
  }

  _normalizeHeartbeat(player) {
    const cal = this._hostSettings.heartbeatCalibration?.[player.id];
    if (!cal || !cal.enabled) return 0;
    const raw = player.heartbeat?.bpm || 0;
    if (raw <= 0) return 0;
    const displayResting = this._hostSettings.heartbeatDisplayResting ?? 65;
    const displayElevated = this._hostSettings.heartbeatDisplayElevated ?? 110;
    const range = cal.elevatedBpm - cal.restingBpm;
    if (range <= 0) return displayResting;
    let normalized = displayResting + (raw - cal.restingBpm) / range * (displayElevated - displayResting);
    normalized = Math.max(40, Math.min(200, Math.round(normalized)));

    // Add noise if enabled — smooth random walk that makes flat readings look alive
    if (this._hostSettings.heartbeatAddNoise) {
      const ns = this._noiseState[player.id] || (this._noiseState[player.id] = { offset: 0, velocity: 0 });
      // Brownian motion: velocity is pulled toward zero (mean-reverting) with random kicks
      ns.velocity += (Math.random() - 0.5) * 1.8 - ns.velocity * 0.3 - ns.offset * 0.08;
      ns.offset += ns.velocity;
      // Soft clamp offset to ±5 range
      ns.offset = Math.max(-5, Math.min(5, ns.offset));
      normalized = Math.max(40, Math.min(200, Math.round(normalized + ns.offset)));
    }

    return normalized;
  }

  _broadcastCalibrationState() {
    const state = this._calibration ? {
      phase: this._calibration.phase,
      playerIds: this._calibration.playerIds,
      startTime: this._calibration.startTime,
      duration: this._calibration.duration,
      samples: this._calibration.samples,
    } : null;
    this.sendToHost(ServerMsg.CALIBRATION_STATE, state);
  }

  _median(arr) {
    if (!arr.length) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
  }

  // === Broadcasting ===

  // Schedule a game state broadcast. Multiple calls within the same synchronous
  // execution context are coalesced into a single send on the next microtask,
  // avoiding redundant serialisation when one handler path calls several
  // state-mutating methods that each broadcast.
  broadcastGameState() {
    if (this._broadcastScheduled) return;
    this._broadcastScheduled = true;
    queueMicrotask(() => {
      this._broadcastScheduled = false;
      this._executeBroadcast();
    });
  }

  _executeBroadcast() {
    // Send public state to each player (not host - they get host state below)
    const publicState = this.getGameState({ audience: 'public' });
    for (const player of this.players.values()) {
      player.send(ServerMsg.GAME_STATE, publicState);
    }

    // Each player also gets their private state.
    // Skip terminal connections for players in target selection — they
    // run a local-only input loop and ignore server state anyway.
    for (const player of this.players.values()) {
      player.syncState(this, { skipTerminalIfSelecting: true });
    }

    // Host gets full player info (only state update they receive)
    this.sendToHost(
      ServerMsg.GAME_STATE,
      this.getGameState({ audience: 'host' }),
    );

    // Screen gets public state
    this.sendToScreen(ServerMsg.GAME_STATE, publicState);
  }

  // Debounced version for rapid dial input: coalesces calls within a 120 ms
  // window so the host panel doesn't flicker on every encoder tick.
  debouncedBroadcastGameState(delayMs = BROADCAST_DEBOUNCE_MS) {
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
    // Broadcast for any cell member's night event — packsense includes
    // suggestion target, cleanup status, and poison status
    return (
      (eventId === EventId.SUGGEST || eventId === EventId.KILL ||
       eventId === EventId.CLEAN || eventId === EventId.POISON) &&
      player?.role?.team === Team.CELL
    );
  }

  // Broadcast pack state to all cell members (for real-time hunt updates)
  broadcastPackState() {
    const cellMembers = this.getAlivePlayers().filter(
      (p) => p.role && p.role.team === Team.CELL,
    );

    for (const member of cellMembers) {
      member.syncState(this);
    }
  }

  broadcastSlides() { return this.slides.broadcastSlides(); }

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
      const cal = this._hostSettings.heartbeatCalibration?.[p.id];
      const calEnabled = cal?.enabled === true;
      const normalizedBpm = calEnabled ? this._normalizeHeartbeat(p) : 0;
      const isSimulated = !!(cal?.simulated && p.heartbeat._simulated);
      base.heartbeat = {
        bpm: calEnabled ? normalizedBpm : p.heartbeat.bpm,
        rawBpm: audience === 'host' ? p.heartbeat.bpm : undefined,
        active: calEnabled ? (calEnabled && p.heartbeat.active && !stale) : (p.heartbeat.active && !stale),
        fake: isSimulated ? false : (p.heartbeat.fake ?? false),
        simulated: audience === 'host' ? isSimulated : undefined,
      };

      return base;
    });

    // Count total cell members (both alive and dead)
    const totalCellMembers = [...this.players.values()].filter(
      (p) => p.role && p.role.team === Team.CELL,
    ).length;

    return {
      phase: this.phase,
      dayCount: this.dayCount,
      players,
      totalCellMembers,
      pendingEvents: this.pendingEvents,
      activeEvents: [...this.activeEvents.keys()],
      eventParticipants: this.getEventParticipantMap(),
      eventProgress: this.getEventProgressMap(),
      eventMetadata: this.getEventMetadataMap(),
      eventRespondents: this.getEventRespondentsMap(),
      heartbeatMode: this.heartbeatMode,
      heartbeatThreshold: this._hostSettings.heartbeatThreshold ?? 110,
      fakeHeartbeats: this._fakeHeartbeats,
      ...(audience === 'host' ? {
        availableFirmware: this._getAvailableFirmwareVersion(),
        customEventConfig: this.customEventConfig,
      } : {}),
    };
  }

  _getAvailableFirmwareVersion() {
    try {
      const versionPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'firmware', 'version.json');
      const data = JSON.parse(fs.readFileSync(versionPath, 'utf8'));
      return data.version || null;
    } catch {
      return null;
    }
  }

  getEventParticipantMap() { return this.events.getEventParticipantMap(); }

  getEventProgressMap() { return this.events.getEventProgressMap(); }

  getEventMetadataMap() { return this.events.getEventMetadataMap(); }

  getEventRespondentsMap() { return this.events.getEventRespondentsMap(); }

  // === Lobby Tutorial Slides ===

  pushCompSlide() { return this.slides.pushCompSlide(); }

  pushRoleTipSlide(roleId) { return this.slides.pushRoleTipSlide(roleId); }

  pushItemTipSlide(itemId) { return this.slides.pushItemTipSlide(itemId); }

  _getRoleAbilities(roleDef) { return this.slides._getRoleAbilities(roleDef); }

  // === Logging ===

  addLog(message) {
    const entry = { timestamp: Date.now(), message };
    this.log.push(entry);
    // Trim server-side log to prevent unbounded growth
    if (this.log.length > LOG_MAX_ENTRIES) this.log.splice(0, this.log.length - LOG_MAX_ENTRIES);
    // Send only the new entry — clients append. Full snapshot sent on HOST_CONNECT.
    this.broadcast(ServerMsg.LOG_APPEND, [entry]);
  }
}
