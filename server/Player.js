// server/Player.js
// Player model - represents a player in the game

import {
  PlayerStatus,
  ServerMsg,
  Team,
  GamePhase,
  RoleId,
  EventId,
  ItemId,
  LedState,
  DisplayStyle,
  StatusLed,
  IconState,
} from '../shared/constants.js';
import { getEvent } from './definitions/events.js';
import { getItem } from './definitions/items.js';

// Returns the best-fitting role name within maxChars: full name if it fits,
// otherwise shortName (truncated to maxChars if necessary).
function fitRoleName(role, maxChars) {
  const full = role.name.toUpperCase();
  if (full.length <= maxChars) return full;
  return (role.shortName || role.name).toUpperCase().substring(0, maxChars);
}

// Action labels for each event type (confirm action / abstain action / select prompt)
const EVENT_ACTIONS = {
  [EventId.VOTE]:         { confirm: 'VOTE',    abstain: 'ABSTAIN', prompt: 'VOTE FOR SOMEONE' },
  pardon:                 { confirm: 'PARDON',  abstain: 'CONDEMN', prompt: 'PARDON' },
  [EventId.SUGGEST]:      { confirm: 'SUGGEST', abstain: 'ABSTAIN', prompt: 'SUGGEST SOMEONE' },
  [EventId.KILL]:         { confirm: 'KILL',    abstain: 'ABSTAIN', prompt: 'TARGET SOMEONE' },
  [EventId.INVESTIGATE]:  { confirm: 'REVEAL',  abstain: 'ABSTAIN', prompt: 'INVESTIGATE SOMEONE' },
  [EventId.STUMBLE]:      { confirm: 'REVEAL',  abstain: 'ABSTAIN', prompt: 'INVESTIGATE SOMEONE' },
  [EventId.PROTECT]:      { confirm: 'PROTECT', abstain: 'ABSTAIN', prompt: 'PROTECT SOMEONE' },
  [EventId.SHOOT]:        { confirm: 'SHOOT',   abstain: 'ABSTAIN', prompt: 'SHOOT SOMEONE' },
  [EventId.SUSPECT]:      { confirm: 'SUSPECT', abstain: 'ABSTAIN', prompt: 'SUSPECT SOMEONE' },
  [EventId.BLOCK]:        { confirm: 'BLOCK',   abstain: 'ABSTAIN', prompt: 'BLOCK SOMEONE' },
  [EventId.JAIL]:         { confirm: 'JAIL',    abstain: 'ABSTAIN', prompt: 'JAIL SOMEONE' },
  [EventId.INJECT]:       { confirm: 'INJECT',  abstain: 'ABSTAIN', prompt: 'SELECT TARGET' },
  [EventId.CLEAN]:        { confirm: 'YES',     abstain: 'NO',      prompt: 'CLEAN UP?',    negPrompt: "DON'T CLEAN" },
  [EventId.POISON]:       { confirm: 'YES',     abstain: 'NO',      prompt: 'USE POISON?', negPrompt: "DON'T POISON" },
  [EventId.VIGIL]:        { confirm: 'KILL',    abstain: 'ABSTAIN', prompt: 'SHOOT SOMEONE' },
  [EventId.CUSTOM_EVENT]: { confirm: 'CONFIRM', abstain: 'ABSTAIN', prompt: 'VOTE FOR SOMEONE' },
  hunterRevenge:          { confirm: 'SHOOT',   abstain: 'ABSTAIN', prompt: 'SHOOT SOMEONE' },
};

// Get action labels for an event (with fallback)
function getEventActions(eventId) {
  return EVENT_ACTIONS[eventId] || { confirm: 'CONFIRM', abstain: 'ABSTAIN', prompt: 'SELECT SOMEONE' };
}

let nextSeatNumber = 1;

export class Player {
  constructor(id, ws = null) {
    this.id = id;

    // If ID is numeric (e.g., "8"), use that as seat number for consistency
    // Otherwise use auto-increment counter
    const numericId = parseInt(id, 10);
    if (!isNaN(numericId) && numericId >= 1 && numericId <= 99) {
      this.seatNumber = numericId;
    } else {
      this.seatNumber = nextSeatNumber++;
    }

    // Multiple connections support (web client + physical terminal)
    this.connections = ws ? [ws] : [];

    // Identity
    this.name = id === 'player-0' ? 'A' : `Player ${this.seatNumber}`;
    this.portrait = `player${this.seatNumber}.png`;

    // Game state
    this.role = null;
    this.preAssignedRole = null; // Host pre-assignment (lobby only)
    this.status = PlayerStatus.ALIVE;
    this.isProtected = false;
    this.isRoleblocked = false;
    this.isRoleCleaned = false;
    this.linkedTo = null; // For Cupid

    // Event state
    this.currentSelection = null; // Currently highlighted target
    this.pendingEvents = new Set(); // Events waiting for this player
    this.lastEventResult = null; // { message } shown on TinyScreen after event resolves
    this.roleRevealPending = false; // True after game start until first phase transition

    // Tutorial
    this.tutorialTip = null; // Role tip shown on TinyScreen line 3 during idle

    // Icon column idle scroll
    this.idleScrollIndex = 0; // 0=role, 1=item1, 2=item2

    // History
    this.investigations = [];
    this.suspicions = [];
    this.lastProtected = null;

    // Role-specific state
    this.vigilanteUsed = false;
    this.poisonedAt = null; // dayCount value of the night poison was applied

    // Inventory
    this.inventory = []; // Array of { id, uses, maxUses } — visible to player (max 3 slots)
    this.hiddenInventory = []; // Hidden items (not shown on console or icon column)

    // Heartbeat (from ESP32 AD8232)
    this.heartbeat = { bpm: 0, active: false, lastUpdate: 0 };

    // Connection
    this.lastSeen = Date.now();
  }

  // Connection status (true if any connection is open)
  get connected() {
    return this.connections.some(ws => ws && ws.readyState === 1);
  }

  // Terminal connection status (true if any ESP32 terminal is connected)
  get terminalConnected() {
    return this.connections.some(ws => ws && ws.readyState === 1 && ws.source === 'terminal');
  }

  // Firmware version of the connected terminal (if any)
  get terminalFirmwareVersion() {
    const terminal = this.connections.find(ws => ws && ws.readyState === 1 && ws.source === 'terminal');
    return terminal?.firmwareVersion || null;
  }

  // Legacy getter for backward compatibility
  get ws() {
    return this.connections[0] || null;
  }

  // Get player name with role emoji
  getNameWithEmoji() {
    if (this.role && this.role.emoji) {
      return `${this.role.emoji} ${this.name}`;
    }
    return this.name;
  }

  // Reset for new game
  reset() {
    this.role = null;
    this.preAssignedRole = null;
    this.status = PlayerStatus.ALIVE;
    this.isRoleCleaned = false;
    this.linkedTo = null;
    this.resetForPhase();
    this.tutorialTip = null;
    this.idleScrollIndex = 0;
    this.investigations = [];
    this.suspicions = [];
    this.lastProtected = null;
    this.vigilanteUsed = false;
    this.poisonedAt = null;
    this.inventory = [];
    this.hiddenInventory = [];
  }

  // Check if player is alive
  get isAlive() {
    return this.status === PlayerStatus.ALIVE;
  }

  // Kill the player
  kill(cause = 'unknown') {
    this.status = PlayerStatus.DEAD;
    this.deathCause = cause;
    this.deathTimestamp = Date.now(); // Track when they died for ordering
    this.isProtected = false;
    this.isRoleblocked = false;
    return this;
  }

  // Revive the player (host action)
  revive(cause = 'unknown') {
    this.status = PlayerStatus.ALIVE;
    this.deathCause = null;
    return this;
  }

  // Set role
  assignRole(role) {
    this.role = role;
    return this;
  }

  // Selection controls (for swipe interface)
  selectUp(validTargets) {
    if (!validTargets.length) return null;

    const currentIndex = this.currentSelection
      ? validTargets.findIndex((t) => t.id === this.currentSelection)
      : -1;

    const newIndex =
      currentIndex <= 0 ? validTargets.length - 1 : currentIndex - 1;

    this.currentSelection = validTargets[newIndex].id;
    return this.currentSelection;
  }

  selectDown(validTargets) {
    if (!validTargets.length) return null;

    const currentIndex = this.currentSelection
      ? validTargets.findIndex((t) => t.id === this.currentSelection)
      : -1;

    const newIndex =
      currentIndex >= validTargets.length - 1 ? 0 : currentIndex + 1;

    this.currentSelection = validTargets[newIndex].id;
    return this.currentSelection;
  }

  confirmSelection() {
    const selection = this.currentSelection;
    this.currentSelection = null;
    return selection;
  }

  abstain() {
    this.currentSelection = null;
    return this;
  }

  cancelSelection() {
    return null;
  }

  clearSelection() {
    this.currentSelection = null;
  }

  clearFromEvent(eventId) {
    this.pendingEvents.delete(eventId);
    this.clearSelection();
  }

  // Get list of non-empty icon slot indices
  _getActiveSlots() {
    const slots = [0]; // Slot 0 (role) is always populated when alive
    if (this.inventory && this.inventory.length > 0) slots.push(1);
    if (this.inventory && this.inventory.length > 1) slots.push(2);
    return slots;
  }

  // Idle scroll controls (cycle through non-empty icon slots only)
  idleScrollUp() {
    const slots = this._getActiveSlots();
    const cur = slots.indexOf(this.idleScrollIndex);
    this.idleScrollIndex = slots[cur <= 0 ? slots.length - 1 : cur - 1];
    return this.idleScrollIndex;
  }

  idleScrollDown() {
    const slots = this._getActiveSlots();
    const cur = slots.indexOf(this.idleScrollIndex);
    this.idleScrollIndex = slots[cur >= slots.length - 1 ? 0 : cur + 1];
    return this.idleScrollIndex;
  }

  // Derive confirmed selection / abstained state from instance.results + pendingEvents.
  // Single source of truth: no stored confirmedSelection or abstained fields needed.
  getActiveResult(game) {
    if (!game) return null;
    for (const [eventId, instance] of game.activeEvents) {
      if (this.pendingEvents.has(eventId) && this.id in instance.results) {
        const targetId = instance.results[this.id];
        return { eventId, targetId, abstained: targetId === null };
      }
    }
    return null;
  }

  resetForPhase() {
    this.isProtected = false;
    this.isRoleblocked = false;
    this.clearSelection();
    this.pendingEvents.clear();
    this.lastEventResult = null;
    this.roleRevealPending = false;
    this.idleScrollIndex = 0;
  }

  // Get public state (safe to send to other players)
  getPublicState() {
    const isDead = this.status === PlayerStatus.DEAD;
    const showRole = isDead && !this.isRoleCleaned;
    return {
      id: this.id,
      seatNumber: this.seatNumber,
      name: this.name,
      portrait: this.portrait,
      status: this.status,
      isAlive: this.isAlive,
      connected: this.connected,
      terminalConnected: this.terminalConnected,
      terminalCount: this.connections.filter(ws => ws && ws.readyState === 1 && ws.source === 'terminal').length,
      terminalFirmware: this.terminalFirmwareVersion,
      // Role only shown if dead and not cleaned by fixer
      role: showRole ? this.role?.id : null,
      roleName: showRole ? this.role?.name : null,
      roleColor: showRole ? this.role?.color : null,
      roleTeam: showRole ? this.role?.team : null,
      deathTimestamp: isDead ? this.deathTimestamp : null,
      isPoisoned: this.hasItem(ItemId.POISONED),
      isCowering: this.hasItem(ItemId.COWARD),
      hasNovote: this.hasItem(ItemId.NOVOTE),
    };
  }

  // Get private state (only for this player)
  // forSelf: true when sending to the player themselves — applies role disguise if present
  getPrivateState(game, { forSelf = false } = {}) {
    const role = this.role;
    const dr = (forSelf && role?.disguiseAs) ? role.disguiseAs : role;
    const activeResult = this.getActiveResult(game);
    // Collect all confirmed/pending selections across active events (for host multi-pip display)
    const allSelections = {};
    if (game) {
      for (const [eventId, instance] of game.activeEvents) {
        if (!instance.participants.includes(this.id)) continue;
        if (this.id in instance.results) {
          const tid = instance.results[this.id];
          if (tid) allSelections[eventId] = tid;
        } else if (this.currentSelection) {
          allSelections[eventId] = this.currentSelection;
        }
      }
    }
    return {
      ...this.getPublicState(),
      role: dr?.id,
      roleName: dr?.name,
      roleColor: dr?.color,
      roleDescription: dr?.description,
      team: role?.team,
      preAssignedRole: this.preAssignedRole,
      currentSelection: this.currentSelection,
      confirmedSelection: (activeResult && !activeResult.abstained) ? activeResult.targetId : null,
      abstained: activeResult?.abstained ?? false,
      allSelections,
      pendingEvents: [...this.pendingEvents],
      investigations: this.investigations,
      linkedTo: this.linkedTo,
      vigilanteUsed: this.vigilanteUsed,
      inventory: this.inventory,
      hiddenInventory: this.hiddenInventory,
      packInfo: game ? this.getPackInfo(game) : null,
      display: game ? this.getDisplayState(game, null, dr) : null,
    };
  }

  // Get pack info (for cell team members)
  getPackInfo(game) {
    if (!this.role || this.role.team !== Team.CELL) {
      return null;
    }

    const packMembers = game
      .getAlivePlayers()
      .filter((p) => p.role.team === Team.CELL && p.id !== this.id)
      .map((p) => {
        const result = p.getActiveResult(game);
        return {
          id: p.id,
          name: p.name,
          portrait: p.portrait,
          role: p.role.id,
          roleName: p.role.name,
          isAlpha: p.role.id === RoleId.ALPHA,
          currentSelection: p.currentSelection,
          confirmedSelection: (result && !result.abstained) ? result.targetId : null,
        };
      });

    return {
      packMembers,
      playerRole: this.role.id,
      isAlpha: this.role.id === RoleId.ALPHA,
    };
  }

  // === Display State (TinyScreen) ===

  /**
   * Get the display state for TinyScreen (3-line format)
   * @param {Game} game - The game instance
   * @param {Object} eventContext - Optional event context { eventId, eventName, description, allowAbstain }
   * @returns {Object} Display state with line1, line2, line3, leds
   */
  getDisplayState(game, eventContext = null, displayRole = null) {
    const phase = game?.phase;
    const dayCount = game?.dayCount || 0;
    const hasActiveEvent = this.pendingEvents.size > 0;

    // Get current event info
    const activeEventId = hasActiveEvent ? [...this.pendingEvents][0] : null;
    const activeEvent = activeEventId ? game?.activeEvents?.get(activeEventId) : null;
    // Use displayName when rendering for the player themselves (e.g. amateur's stumble → "Investigate")
    const eventName = (displayRole && activeEvent?.event?.displayName)
      || activeEvent?.event?.name
      || eventContext?.eventName
      || null;

    // Set display role override for this render pass (used by _getLine1, _buildIcons, _displayIdleScroll)
    const prevDisplayRole = this._displayRoleOverride;
    this._displayRoleOverride = displayRole;
    try {
      return this._buildDisplay(game, {
        phase,
        dayCount,
        hasActiveEvent,
        activeEventId,
        eventName,
        eventContext,
      });
    } finally {
      this._displayRoleOverride = prevDisplayRole;
    }
  }

  /**
   * Build the display object based on current state.
   * Priority-ordered dispatcher — each state extracted to its own method.
   */
  _buildDisplay(game, ctx) {
    const { phase, hasActiveEvent, activeEventId, eventName } = ctx;

    const getLine1 = (evtName = null, evtId = null) =>
      this._getLine1(phase, ctx.dayCount, evtName, evtId);
    const phaseLed = phase === GamePhase.DAY ? StatusLed.DAY : StatusLed.NIGHT;

    // Derive confirmed/abstained from single source of truth
    const activeResult = this.getActiveResult(game);
    const isAbstained = activeResult?.abstained ?? false;
    const confirmedTargetId = (activeResult && !activeResult.abstained) ? activeResult.targetId : null;

    // If player has confirmed/abstained on current event but has more pending events,
    // advance to the next unresolved event instead of showing the locked/abstained screen.
    let displayEventId = activeEventId;
    let displayEventName = eventName;
    let displayConfirmedId = confirmedTargetId;
    let displayConfirmedNames = null;
    let advancedToNext = false;
    if ((isAbstained || confirmedTargetId) && this.pendingEvents.size > 1) {
      for (const eid of this.pendingEvents) {
        const inst = game?.activeEvents?.get(eid);
        if (inst && !(this.id in inst.results)) {
          displayEventId = eid;
          const evt = inst.event;
          displayEventName = (this._displayRoleOverride && evt?.displayName) || evt?.name || null;
          advancedToNext = true;
          break;
        }
      }
      // All events resolved: collect all confirmed target names for summary display
      if (!advancedToNext) {
        const allTargetNames = [];
        for (const eid of this.pendingEvents) {
          const inst = game?.activeEvents?.get(eid);
          if (inst && this.id in inst.results) {
            const tid = inst.results[this.id];
            if (tid) {
              const t = game.getPlayer(tid);
              if (t) allTargetNames.push(t.name.toUpperCase());
            }
          }
        }
        displayConfirmedId = '__summary__';
        displayConfirmedNames = allTargetNames;
      }
    }

    // Calibration override — highest priority when active
    if (game._calibration?.playerIds.includes(String(this.id))) {
      return this._displayCalibration(game._calibration);
    }

    // Priority-ordered state dispatch
    if (phase === GamePhase.LOBBY)          return this._displayLobby(getLine1);
    if (phase === GamePhase.GAME_OVER)      return this._displayGameOver(getLine1);
    if (!this.isAlive && !hasActiveEvent)    return this._displayDead(getLine1, ctx.dayCount, phase);

    // Only show confirmed/abstained if there's no next event to advance to
    if (!advancedToNext) {
      if (isAbstained)                       return this._displayAbstained(getLine1, displayEventName, displayEventId);
      if (displayConfirmedNames) {
        // Multi-event summary: show all confirmed targets
        const summaryText = displayConfirmedNames.join('  ');
        return this._display(
          { left: getLine1(), right: '' },
          { text: summaryText, style: DisplayStyle.LOCKED },
          { text: 'Selection locked' },
          { yes: LedState.OFF, no: LedState.OFF },
          StatusLed.LOCKED,
          { activeEventId: displayEventId }
        );
      }
      if (displayConfirmedId)                return this._displayConfirmed(game, getLine1, displayEventName, displayEventId, displayConfirmedId);
    }

    // When advancing to next event, always show fresh target selection (no stale selection)
    if (advancedToNext)
      return this._displayEventNoSelection(game, ctx, getLine1, displayEventId, displayEventName);
    if (hasActiveEvent && this.currentSelection)
      return this._displayEventWithSelection(game, ctx, getLine1, displayEventId, displayEventName);
    if (hasActiveEvent)
      return this._displayEventNoSelection(game, ctx, getLine1, displayEventId, displayEventName);

    // Vote is active but player is excluded (novote, coward, or any other reason)
    if (this.isAlive && game.activeEvents?.has(EventId.VOTE) && !this.pendingEvents.has(EventId.VOTE)) {
      return this._displayVoteLocked(getLine1);
    }

    if (this.lastEventResult) return this._displayEventResult(getLine1, phaseLed);

    // Coward: blank lines, just the label, no icons, yellow neopixel
    if (this.hasItem(ItemId.COWARD)) {
      const d = this._display(
        { left: '', right: '' },
        { text: 'COWARD', style: DisplayStyle.NORMAL },
        { text: '' },
        { yes: LedState.OFF, no: LedState.OFF },
        StatusLed.COWARD
      );
      d.icons = [];
      return d;
    }

    // Poisoned players don't know they're poisoned — no display notification

    // Dynamically compute packmate tip for cell members (reflects living members)
    if (this.role?.team === Team.CELL) {
      const packmates = game.getAlivePlayers().filter(
        (p) => p.id !== this.id && p.role.team === Team.CELL,
      );
      const cellNames = [this.name, ...packmates.map(p => p.name)].join(', ');
      if (packmates.length === 0) {
        this.tutorialTip = `CELL: ${this.name}`;
      } else {
        // Non-alpha idle during KILL: show alpha's current/confirmed pick
        const killInstance = game.activeEvents?.get(EventId.KILL);
        if (killInstance && this.role.id !== RoleId.ALPHA) {
          const alpha = packmates.find(p => p.role.id === RoleId.ALPHA);
          if (alpha) {
            const alphaResult = alpha.getActiveResult(game);
            const alphaPick = (alphaResult && !alphaResult.abstained) ? alphaResult.targetId : alpha.currentSelection;
            if (alphaPick) {
              const targetName = game.getPlayer(alphaPick)?.name || 'Unknown';
              this.tutorialTip = `CELL: ${targetName.toUpperCase()}`;
            } else {
              this.tutorialTip = `CELL: ${cellNames}`;
            }
          } else {
            this.tutorialTip = `CELL: ${cellNames}`;
          }
        } else {
          this.tutorialTip = `CELL: ${cellNames}`;
        }
      }
    }

    return this._displayIdleScroll(getLine1, phaseLed, game);
  }

  // --- Display state methods (called by _buildDisplay) ---

  _displayCalibration(cal) {
    const remaining = Math.max(0, Math.ceil((cal.startTime + cal.duration - Date.now()) / 1000));
    let line2Text, line3Text;
    if (cal.phase === 'resting') {
      line2Text = `RESTING... ${remaining}s`;
      line3Text = 'Sit still';
    } else if (cal.phase === 'elevated') {
      line2Text = `ELEVATED... ${remaining}s`;
      line3Text = 'Breathe fast';
    } else {
      line2Text = 'COMPLETE';
      line3Text = 'Stand by';
    }
    return this._display(
      { left: 'CALIBRATION', right: '' },
      { text: line2Text, style: DisplayStyle.NORMAL },
      { text: line3Text },
      { yes: LedState.OFF, no: LedState.OFF },
      StatusLed.LOBBY
    );
  }

  _displayLobby(getLine1) {
    return this._display(
      { left: getLine1(), right: '' },
      { text: 'WAITING', style: DisplayStyle.NORMAL },
      { text: 'Game will begin soon' },
      { yes: LedState.OFF, no: LedState.OFF },
      StatusLed.LOBBY
    );
  }

  _displayGameOver() {
    const d = this._display(
      { left: '', right: '' },
      { text: 'GAME OVER', style: DisplayStyle.NORMAL },
      { text: '' },
      { yes: LedState.OFF, no: LedState.OFF },
      StatusLed.GAME_OVER
    );
    d.icons = []; // Hide icon column
    return d;
  }

  _displayDead(getLine1, dayCount, phase) {
    // Red neopixel during the phase they die, off from the next phase onwards
    const diedThisPhase = this.deathDay === dayCount && this.deathPhase === phase;
    const d = this._display(
      { left: '', right: '' },
      { text: 'DEAD', style: DisplayStyle.NORMAL },
      { text: '' },
      { yes: LedState.OFF, no: LedState.OFF },
      diedThisPhase ? StatusLed.DEAD : StatusLed.OFF
    );
    d.icons = [];
    return d;
  }

  _displayAbstained(getLine1, eventName, activeEventId) {
    return this._display(
      { left: getLine1(eventName, activeEventId), right: '' },
      { text: 'ABSTAINED', style: DisplayStyle.ABSTAINED },
      { text: 'Waiting for others' },
      { yes: LedState.OFF, no: LedState.OFF },
      StatusLed.ABSTAINED,
      { activeEventId }
    );
  }

  _displayConfirmed(game, getLine1, eventName, activeEventId, targetId) {
    const targetName = game?.getPlayer(targetId)?.name || 'Unknown';
    // Special display for specific events
    let line2Text;
    if (activeEventId === 'pardon') {
      line2Text = `PARDONING ${targetName.toUpperCase()}`;
    } else if (activeEventId === EventId.CLEAN) {
      line2Text = 'CLEANING UP';
    } else if (activeEventId === EventId.POISON) {
      line2Text = 'POISONING';
    } else {
      line2Text = targetName.toUpperCase();
    }
    // Show cell status alongside "Selection locked" for KILL/HUNT
    const packHint = this._getPackHint(game, activeEventId);
    const line3 = packHint
      ? { left: packHint.left, center: packHint.center, right: packHint.right }
      : { text: 'Selection locked' };
    return this._display(
      { left: getLine1(eventName, activeEventId), right: '' },
      { text: line2Text, style: DisplayStyle.LOCKED },
      line3,
      { yes: LedState.OFF, no: LedState.OFF },
      StatusLed.LOCKED,
      { activeEventId }
    );
  }

  _displayEventWithSelection(game, ctx, getLine1, activeEventId, eventName) {
    const targetName = game?.getPlayer(this.currentSelection)?.name || 'Unknown';
    const packHint = this._getPackHint(game, activeEventId);
    const canAbstain = ctx.eventContext?.allowAbstain !== false;
    const actions = getEventActions(activeEventId);

    // Boolean toggle events: delegate to NoSelection display (same UX, both LEDs bright)
    if (actions.negPrompt || activeEventId === 'pardon') {
      return this._displayEventNoSelection(game, ctx, getLine1, activeEventId, eventName);
    }

    const line2Text = targetName.toUpperCase();

    const display = this._display(
      { left: getLine1(eventName, activeEventId), right: '' },
      { text: line2Text, style: DisplayStyle.NORMAL },
      packHint
        ? { left: packHint.left, center: packHint.center, right: packHint.right }
        : { left: actions.confirm, right: canAbstain ? actions.abstain : '' },
      { yes: LedState.BRIGHT, no: canAbstain ? LedState.DIM : LedState.OFF },
      StatusLed.VOTING,
      { activeEventId }
    );

    // Include target list so ESP32 can scroll locally without a server round-trip per tick
    const instance = game.activeEvents?.get(activeEventId);
    const validTargets = instance?.event?.validTargets?.(this, game) || [];
    display.targetNames = validTargets.map(t => t.name.toUpperCase());
    display.targetIds    = validTargets.map(t => t.id);
    display.selectionIndex = validTargets.findIndex(t => t.id === this.currentSelection);
    return display;
  }

  _displayEventNoSelection(game, ctx, getLine1, activeEventId, eventName) {
    const packHint = this._getPackHint(game, activeEventId);
    const canAbstain = ctx.eventContext?.allowAbstain !== false;
    const actions = getEventActions(activeEventId);

    // Boolean toggle events (self-target with negPrompt): dial swaps positive/negative text
    // YES on positive = confirm action, YES on negative = decline (__decline__ sentinel)
    // NO always = decline. Both buttons always active.
    if (actions.negPrompt) {
      const display = this._display(
        { left: getLine1(eventName, activeEventId), right: '' },
        { text: actions.prompt, style: DisplayStyle.NORMAL },
        packHint
          ? { left: packHint.left, center: packHint.center, right: packHint.right }
          : { text: '' },
        { yes: LedState.BRIGHT, no: LedState.BRIGHT },
        StatusLed.VOTING,
        { activeEventId }
      );
      display.targetNames = [actions.prompt, actions.negPrompt];
      display.targetIds   = [this.id, '__decline__'];
      display.selectionIndex = 0;
      return display;
    }

    // Pardon toggle: same pattern — dial swaps PARDON/EXECUTE
    if (activeEventId === 'pardon') {
      const condemnedId = game?.flows?.get('pardon')?.state?.condemnedId || '';
      const condemnedName = game?.flows?.get('pardon')?.state?.condemnedName || 'Unknown';
      const display = this._display(
        { left: getLine1(eventName, activeEventId), right: '' },
        { text: `PARDON ${condemnedName.toUpperCase()}?`, style: DisplayStyle.NORMAL },
        { left: actions.confirm, right: actions.abstain },
        { yes: LedState.BRIGHT, no: LedState.BRIGHT },
        StatusLed.VOTING,
        { activeEventId }
      );
      display.targetNames = [`PARDON ${condemnedName.toUpperCase()}?`, `EXECUTE ${condemnedName.toUpperCase()}`];
      display.targetIds   = [condemnedId, '__decline__'];
      display.selectionIndex = 0;
      return display;
    }

    const display = this._display(
      { left: getLine1(eventName, activeEventId), right: '' },
      { text: actions.prompt, style: DisplayStyle.WAITING },
      packHint
        ? { left: packHint.left, center: packHint.center, right: packHint.right }
        : { left: 'Use dial', right: canAbstain ? actions.abstain : '' },
      { yes: LedState.OFF, no: canAbstain ? LedState.DIM : LedState.OFF },
      StatusLed.VOTING,
      { activeEventId }
    );

    // Include target list so ESP32 can render the first selection locally without a round-trip
    const instance = game.activeEvents?.get(activeEventId);
    const validTargets = instance?.event?.validTargets?.(this, game) || [];
    display.targetNames = validTargets.map(t => t.name.toUpperCase());
    display.targetIds    = validTargets.map(t => t.id);
    display.selectionIndex = -1;
    return display;
  }

  _displayVoteLocked(getLine1) {
    return this._display(
      { left: getLine1('Vote', EventId.VOTE), right: '' },
      { text: 'VOTE LOCKED', style: DisplayStyle.CRITICAL },
      { text: 'Better luck next time' },
      { yes: LedState.OFF, no: LedState.OFF },
      StatusLed.LOCKED
    );
  }

  _displayPoisoned(getLine1, phaseLed) {
    return this._display(
      { left: getLine1(), right: '' },
      { text: 'POISONED', style: DisplayStyle.LOCKED },
      { text: 'You will not survive the night' },
      { yes: LedState.OFF, no: LedState.OFF },
      phaseLed
    );
  }

  _displayEventResult(getLine1, phaseLed) {
    const style = this.lastEventResult.critical ? DisplayStyle.CRITICAL : DisplayStyle.NORMAL;
    return this._display(
      { left: getLine1(), right: '' },
      { text: this.lastEventResult.message, style },
      { text: this.lastEventResult.detail || '' },
      { yes: LedState.OFF, no: LedState.OFF },
      phaseLed
    );
  }

  _displayIdleScroll(getLine1, phaseLed, game) {
    const icons = this._buildIcons();
    const idx = this.idleScrollIndex;
    const slot = icons[idx];

    // Determine line2/line3 content based on which slot is highlighted
    let line2Text = '';
    let line2Style = DisplayStyle.NORMAL;
    let line3 = { text: '' };
    let leds = { yes: LedState.OFF, no: LedState.OFF };

    if (idx === 0) {
      // Role slot - show role name and tip (use display override if set)
      const displayRole = this._displayRoleOverride || this.role;
      line2Text = displayRole ? fitRoleName(displayRole, 23) : 'READY';
      line3 = { text: this.tutorialTip || '' };
      if (this.roleRevealPending) {
        line2Style = DisplayStyle.CRITICAL;
        this.roleRevealPending = false; // Flash once, then clear
      }
    } else {
      // Item slots (1 or 2)
      const itemIndex = idx - 1;
      const inventoryItem = this._getIconSlotItem(itemIndex);
      if (inventoryItem) {
        if (inventoryItem.startsEvent) {
          // Check if the linked event is available in the current phase
          const linkedEvent = game ? getEvent(inventoryItem.startsEvent) : null;
          const phaseOk = !linkedEvent?.phase || linkedEvent.phase.includes(game?.phase);
          const usesLabel = inventoryItem.maxUses === -1
            ? 'UNLIMITED'
            : `(${inventoryItem.uses}/${inventoryItem.maxUses})`;
          if (phaseOk) {
            // Usable item — activatable now
            line2Text = `USE ${inventoryItem.id.toUpperCase()}?`;
            line3 = { left: usesLabel, right: '' };
            leds = { yes: LedState.DIM, no: LedState.OFF };
          } else {
            // Item exists but not usable in this phase — show description
            const itemDef = getItem(inventoryItem.id);
            line2Text = (itemDef?.name || inventoryItem.id).toUpperCase();
            const desc = itemDef?.description || '';
            line3 = { text: desc.length > 42 ? desc.substring(0, 40) + '..' : desc };
          }
        } else {
          // Non-activatable item (gavel, etc.)
          line2Text = inventoryItem.id.toUpperCase();
          line3 = { text: 'Passive item' };
        }
      } else {
        // Empty slot
        line2Text = '';
        line3 = { text: 'Empty slot' };
      }
    }

    return this._display(
      { left: getLine1(), right: '' },
      { text: line2Text, style: line2Style },
      line3,
      leds,
      phaseLed
    );
  }

  /**
   * Create a display state object
   */
  _display(line1, line2, line3, leds, statusLed, { activeEventId = null } = {}) {
    // Guard: warn if display strings exceed terminal limits (256px / font width)
    // Line 1/3 small font = 6px → 42 chars, Line 2 large font = 10px → 25 chars
    const MAX_SMALL = 42;
    const MAX_LARGE = 25;
    const l1Left = line1?.left || '';
    const l1Right = line1?.right || '';
    const l2Text = line2?.text || '';
    const l3Text = line3?.text || '';
    const l3Left = line3?.left || '';
    const l3Center = line3?.center || '';
    const l3Right = line3?.right || '';
    const l1Len = l1Left.length + l1Right.length;
    const l3Len = l3Text ? l3Text.length : l3Left.length + l3Center.length + l3Right.length;
    if (l1Len > MAX_SMALL) console.error(`[Player ${this.id}] Line 1 overflow (${l1Len}/${MAX_SMALL}): "${l1Left}" + "${l1Right}"`);
    if (l2Text.length > MAX_LARGE) console.error(`[Player ${this.id}] Line 2 overflow (${l2Text.length}/${MAX_LARGE}): "${l2Text}"`);
    if (l3Len > MAX_SMALL) console.error(`[Player ${this.id}] Line 3 overflow (${l3Len}/${MAX_SMALL}): text="${l3Text}" left="${l3Left}" center="${l3Center}" right="${l3Right}"`);

    return {
      line1, line2, line3, leds, statusLed,
      icons: this._buildIcons(activeEventId),
      idleScrollIndex: this.idleScrollIndex,
    };
  }

  /**
   * Build the standardized line1 left text
   * Format: #{seatNumber} {NAME/ROLE} > {PHASE} > {ACTION}
   * Examples:
   *   #8 PLAYER > LOBBY (default name, no role)
   *   #8 DEMI > LOBBY (custom name, no role)
   *   #8 SLEEPER > DAY 1 (role assigned)
   *   #8 SLEEPER > DAY 1 > VOTE
   *   #8 SLEEPER > DAY 1 > DEAD
   *   #8 NOBODY > DAY 1 > SHOOT (PISTOL)
   */
  _getLine1(phase, dayCount, eventName, eventId) {
    const playerNum = `#${this.seatNumber}`;

    // Determine what to show: role (if assigned) or player name (in lobby)
    let nameOrRole;
    if (this.role) {
      // Role assigned - show role name (use display override if set, e.g. amateur → seeker)
      const displayRole = this._displayRoleOverride || this.role;
      nameOrRole = fitRoleName(displayRole, 12);
    } else {
      // No role - show custom name if set, otherwise "PLAYER"
      const defaultName = `Player ${this.seatNumber}`;
      if (this.name && this.name !== defaultName) {
        nameOrRole = this.name.toUpperCase();
      } else {
        nameOrRole = 'PLAYER';
      }
    }
    nameOrRole = nameOrRole.substring(0, 12); // Truncate long names

    // Build phase part
    let phasePart;
    if (phase === GamePhase.LOBBY) {
      phasePart = 'LOBBY';
    } else if (phase === GamePhase.GAME_OVER) {
      phasePart = 'GAME OVER';
    } else {
      phasePart = this._getPhaseLabel(phase, dayCount);
    }

    // Build action part
    let actionPart = '';
    if (!this.isAlive) {
      actionPart = ' > DEAD';
    } else if (eventName) {
      actionPart = ` > ${eventName.toUpperCase()}`;
      // Add item name for item-triggered events
      if (eventId === EventId.SHOOT) {
        actionPart += ' (PISTOL)';
      } else if (eventId === EventId.INVESTIGATE && !this.role?.events?.investigate) {
        // Crystal ball investigate (player doesn't have investigate from role)
        actionPart += ' (CRYSTAL)';
      }
    }

    return `${playerNum} ${nameOrRole} > ${phasePart}${actionPart}`;
  }

  /**
   * Get the phase label (e.g., "DAY 1" or "NIGHT 2")
   */
  _getPhaseLabel(phase, dayCount) {
    if (phase === GamePhase.DAY) return `DAY ${dayCount}`;
    if (phase === GamePhase.NIGHT) return `NIGHT ${dayCount}`;
    return phase?.toUpperCase() || '';
  }

  /**
   * Build the 3-slot icon array for the icon column.
   * Slot 0: role (or skull if dead)
   * Slots 1-2: first two inventory items (or empty)
   */
  _buildIcons(activeEventId = null) {
    // During an active event, highlight the icon for the source of that event
    // (role icon for role events, item icon for item-granted events).
    // Otherwise, highlight based on idle scroll index.
    let highlightSlot = this.idleScrollIndex;
    if (activeEventId) {
      const itemIdx = this.inventory.findIndex(
        (item) => item.startsEvent === activeEventId && (item.maxUses === -1 || item.uses > 0),
      );
      highlightSlot = itemIdx >= 0 ? itemIdx + 1 : 0; // +1 because slot 0 is role
    }

    // Slot 0: role icon (use display override if set, e.g. amateur → seeker glyph)
    let slot0;
    if (!this.isAlive) {
      slot0 = { id: 'skull', state: IconState.INACTIVE };
    } else if (this.role) {
      const displayRole = this._displayRoleOverride || this.role;
      slot0 = { id: displayRole.id, state: highlightSlot === 0 ? IconState.ACTIVE : IconState.INACTIVE };
    } else {
      slot0 = { id: 'empty', state: IconState.EMPTY };
    }

    // Slots 1-2: inventory items
    const slot1 = this._buildItemIcon(0, highlightSlot === 1);
    const slot2 = this._buildItemIcon(1, highlightSlot === 2);

    return [slot0, slot1, slot2];
  }

  /**
   * Build icon for an inventory slot
   */
  _buildItemIcon(itemIndex, isActive) {
    const item = this._getIconSlotItem(itemIndex);
    if (!item) {
      return { id: 'empty', state: IconState.EMPTY };
    }
    const hasUses = item.maxUses === -1 || item.uses > 0;
    return {
      id: item.id,
      state: isActive ? IconState.ACTIVE : (hasUses ? IconState.INACTIVE : IconState.EMPTY),
    };
  }

  /**
   * Get the inventory item for a given icon slot index (0 or 1)
   */
  _getIconSlotItem(slotIndex) {
    if (!this.inventory || slotIndex >= this.inventory.length) return null;
    return this.inventory[slotIndex];
  }

  /**
   * Get pack hint for KILL/HUNT events.
   * Alpha (in KILL): majority of packmates' confirmedSelection ?? currentSelection
   * Non-alpha (in HUNT): alpha's confirmedSelection ?? currentSelection
   */
  /**
   * Build cell status for line3 during night events.
   * Returns { left, center, right } or null if not a cell member / no active event.
   *   left:   Fixer cleanup status (+/- CLEANUP)
   *   center: Sleeper majority suggestion (target name) or Alpha's pick
   *   right:  Chemist poison status (+/- POISON)
   */
  _getPackHint(game, eventId) {
    if (!this.role || this.role.team !== Team.CELL) return null;
    if (!game.activeEvents?.has(eventId)) return null;

    const packMembers = game.getAlivePlayers()
      .filter((p) => p.role.team === Team.CELL && p.id !== this.id);

    // --- Center: suggestion/target ---
    let center = '';
    if (this.role.id !== RoleId.ALPHA) {
      // Non-alpha: show Alpha's KILL target
      const killInstance = game.activeEvents.get(EventId.KILL);
      if (killInstance) {
        const alpha = packMembers.find(p => p.role.id === RoleId.ALPHA);
        if (alpha) {
          const alphaPick = (alpha.id in killInstance.results)
            ? killInstance.results[alpha.id]
            : alpha.currentSelection;
          if (alphaPick) {
            const target = game.getPlayer(alphaPick);
            center = target ? target.name.toUpperCase() : '';
          }
        }
      }
    } else {
      // Alpha: tally majority target from HUNT (sleeper suggestions)
      const huntInstance = game.activeEvents.get(EventId.SUGGEST);
      if (huntInstance) {
        const tally = {};
        for (const pid of huntInstance.participants) {
          const member = game.getPlayer(pid);
          if (!member || member.id === this.id) continue;
          const pick = (pid in huntInstance.results)
            ? huntInstance.results[pid]
            : member.currentSelection;
          if (pick && pick !== '__decline__') tally[pick] = (tally[pick] || 0) + 1;
        }
        const entries = Object.entries(tally);
        if (entries.length > 0) {
          const [topTargetId] = entries.sort((a, b) => b[1] - a[1])[0];
          const topTarget = game.getPlayer(topTargetId);
          center = topTarget ? topTarget.name.toUpperCase() : '';
        }
      }
    }

    // --- Left: Fixer cleanup status ---
    let left = '';
    const cleanInstance = game.activeEvents.get(EventId.CLEAN);
    if (cleanInstance) {
      const fixer = game.getAlivePlayers().find(p => p.role.id === RoleId.FIXER);
      if (fixer) {
        const fixerResult = fixer.id in cleanInstance.results;
        const fixerYes = fixerResult && cleanInstance.results[fixer.id] !== null;
        left = fixerResult ? (fixerYes ? '+CLEANUP' : '-CLEANUP') : 'CLEANUP?';
      }
    }

    // --- Right: Chemist poison status ---
    let right = '';
    const poisonInstance = game.activeEvents.get(EventId.POISON);
    if (poisonInstance) {
      const chemist = game.getAlivePlayers().find(p => p.role.id === RoleId.CHEMIST);
      if (chemist) {
        const chemistResult = chemist.id in poisonInstance.results;
        const chemistYes = chemistResult && poisonInstance.results[chemist.id] !== null;
        right = chemistResult ? (chemistYes ? '+POISON' : '-POISON') : 'POISON?';
      }
    }

    if (!left && !center && !right) return null;
    return { left, center, right };
  }

  // Inventory management
  addItem(itemDef) {
    if (itemDef.hidden) {
      // Hidden items stored separately — not shown on console or icon slots
      if (!this.hiddenInventory.some(i => i.id === itemDef.id)) {
        this.hiddenInventory.push({ id: itemDef.id, uses: itemDef.maxUses, maxUses: itemDef.maxUses });
      }
      return this;
    }

    // Check if player already has this item
    const existingItem = this.inventory.find(i => i.id === itemDef.id);

    if (existingItem) {
      // Add uses to existing item instead of creating duplicate
      existingItem.uses += itemDef.maxUses === -1 ? 0 : itemDef.maxUses;
    } else {
      // Add new item to inventory
      this.inventory.push({
        id: itemDef.id,
        uses: itemDef.maxUses,
        maxUses: itemDef.maxUses,
        startsEvent: itemDef.startsEvent || null,
      });
    }

    return this;
  }

  hasItem(itemId) {
    return this.inventory.some((item) => item.id === itemId)
      || this.hiddenInventory.some((item) => item.id === itemId);
  }

  getItem(itemId) {
    return this.inventory.find((item) => item.id === itemId)
      || this.hiddenInventory.find((item) => item.id === itemId)
      || null;
  }

  removeItem(itemId) {
    const index = this.inventory.findIndex((item) => item.id === itemId);
    if (index !== -1) {
      this.inventory.splice(index, 1);
      // Clamp idle scroll index if it now points past available slots
      const maxSlot = this.inventory.length;
      if (this.idleScrollIndex > maxSlot) {
        this.idleScrollIndex = 0;
      }
      return true;
    }
    const hiddenIndex = this.hiddenInventory.findIndex((item) => item.id === itemId);
    if (hiddenIndex !== -1) {
      this.hiddenInventory.splice(hiddenIndex, 1);
      return true;
    }
    return false;
  }

  canUseItem(itemId) {
    const item = this.getItem(itemId);
    if (!item) return false;
    return item.maxUses === -1 || item.uses > 0;
  }

  useItem(itemId) {
    const item = this.getItem(itemId);
    if (!item) return false;

    if (item.maxUses !== -1) {
      item.uses--;
      return item.uses <= 0; // Return true if depleted
    }

    return false; // Unlimited use items never deplete
  }

  // Send message to this player (all connections)
  send(type, payload) {
    if (this.connections.length === 0) return false;

    // Skip GAME_STATE, EVENT_PROMPT, and EVENT_RESULT for terminal connections —
    // terminals don't use these and the JSON payload (especially EVENT_RESULT with
    // full Player objects) can exceed the ESP32's 4KB JSON parse buffer.
    const skipTerminal = type === ServerMsg.GAME_STATE || type === ServerMsg.EVENT_PROMPT || type === ServerMsg.EVENT_RESULT

    const message = JSON.stringify({ type, payload });
    let sentCount = 0;

    for (const ws of this.connections) {
      if (ws && ws.readyState === 1) {
        if (skipTerminal && ws.source === 'terminal') continue
        try {
          ws.send(message);
          sentCount++;
        } catch (err) {
          console.error(`[Player ${this.id}] Error sending ${type}:`, err.message);
        }
      }
    }

    if (sentCount === 0) return false;

    return true;
  }

  // Helper: Send updated private state to this player.
  // Terminal connections (ESP32) only receive { display } — the full private state
  // can exceed the terminal's JSON parse buffer and is not needed for rendering.
  // Web connections receive the full state as usual.
  syncState(game, { skipTerminalIfSelecting = false } = {}) {
    if (this.connections.length === 0) return false

    const fullState = this.getPrivateState(game, { forSelf: true })
    const hasTargets = fullState.display?.targetNames?.length > 0

    let sent = false
    for (const ws of this.connections) {
      if (!ws || ws.readyState !== 1) continue
      // Skip terminal connections during broadcast-driven updates when the
      // player is in target selection — the terminal is completely deaf anyway.
      if (skipTerminalIfSelecting && hasTargets && ws.source === 'terminal') continue
      try {
        const payload = ws.source === 'terminal' ? { display: fullState.display } : fullState
        ws.send(JSON.stringify({ type: ServerMsg.PLAYER_STATE, payload }))
        sent = true
      } catch (err) {
        console.error(`[Player ${this.id}] syncState error:`, err.message)
      }
    }
    return sent
  }

  // Add a new connection (supports multiple simultaneous connections)
  addConnection(ws) {
    if (!ws) return;

    // Don't add duplicates
    if (!this.connections.includes(ws)) {
      // When a terminal reconnects (e.g. after OTA reboot), close and remove
      // any prior terminal connections — the old socket may still appear OPEN
      // until TCP keepalive fires, causing stale firmwareVersion to linger.
      if (ws.source === 'terminal') {
        const stale = this.connections.filter(c => c && c !== ws && c.source === 'terminal');
        for (const old of stale) {
          try { old.close(); } catch {}
        }
        this.connections = this.connections.filter(c => !stale.includes(c));
      }
      // Prune dead/closed connections before adding
      this.connections = this.connections.filter(c => c && c.readyState <= 1);
      this.connections.push(ws);
    }
    this.lastSeen = Date.now();
  }

  // Remove a connection
  removeConnection(ws) {
    const index = this.connections.indexOf(ws);
    if (index !== -1) {
      this.connections.splice(index, 1);
    }
  }

  // Legacy method for backward compatibility
  setConnection(ws) {
    if (ws === null) {
      // Clear all connections (legacy behavior for explicit disconnect)
      this.connections = [];
    } else {
      // Add new connection
      this.addConnection(ws);
    }
    this.lastSeen = Date.now();
  }
}

// Reset seat counter (for new games)
export function resetSeatCounter() {
  nextSeatNumber = 1;
}
