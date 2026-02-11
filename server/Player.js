// server/Player.js
// Player model - represents a player in the game

import {
  PlayerStatus,
  ServerMsg,
  Team,
  GamePhase,
  ItemGlyphs,
  Glyphs,
  LedState,
  DisplayStyle,
  StatusLed,
} from '../shared/constants.js';

// Action labels for each event type (confirm action / abstain action / select prompt)
const EVENT_ACTIONS = {
  vote:          { confirm: 'VOTE',    abstain: 'ABSTAIN', prompt: 'VOTE FOR SOMEONE' },
  pardon:        { confirm: 'PARDON',  abstain: 'CONDEMN', prompt: 'PARDON' },
  hunt:          { confirm: 'KILL',    abstain: 'ABSTAIN', prompt: 'SUGGEST SOMEONE' },
  kill:          { confirm: 'KILL',    abstain: 'ABSTAIN', prompt: 'TARGET SOMEONE' },
  investigate:   { confirm: 'REVEAL',  abstain: 'ABSTAIN', prompt: 'INVESTIGATE SOMEONE' },
  protect:       { confirm: 'PROTECT', abstain: 'ABSTAIN', prompt: 'PROTECT SOMEONE' },
  shoot:         { confirm: 'SHOOT',   abstain: 'ABSTAIN', prompt: 'SHOOT SOMEONE' },
  suspect:       { confirm: 'SUSPECT', abstain: 'ABSTAIN', prompt: 'SUSPECT SOMEONE' },
  vigil:         { confirm: 'KILL',    abstain: 'ABSTAIN', prompt: 'SHOOT SOMEONE' },
  customEvent:   { confirm: 'CONFIRM', abstain: 'ABSTAIN', prompt: 'VOTE FOR SOMEONE' },
  hunterRevenge: { confirm: 'SHOOT',   abstain: 'ABSTAIN', prompt: 'SHOOT SOMEONE' },
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
    this.status = PlayerStatus.ALIVE;
    this.isProtected = false;
    this.linkedTo = null; // For Cupid

    // Event state
    this.currentSelection = null; // Currently highlighted target
    this.confirmedSelection = null; // Locked in choice
    this.abstained = false; // Whether player has abstained from current event
    this.pendingEvents = new Set(); // Events waiting for this player
    this.lastEventResult = null; // { message } shown on TinyScreen after event resolves

    // Tutorial
    this.tutorialTip = null; // Role tip shown on TinyScreen line 3 during idle
    this.showIdleRole = false; // Show role name on line 2 during idle (game start only)

    // History
    this.investigations = [];
    this.suspicions = [];
    this.lastProtected = null;

    // Role-specific state
    this.vigilanteUsed = false;

    // Inventory
    this.inventory = []; // Array of { id, uses, maxUses }

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
    this.status = PlayerStatus.ALIVE;
    this.isProtected = false;
    this.linkedTo = null;
    this.currentSelection = null;
    this.confirmedSelection = null;
    this.abstained = false;
    this.pendingEvents.clear();
    this.lastEventResult = null;
    this.tutorialTip = null;
    this.showIdleRole = false;
    this.investigations = [];
    this.suspicions = [];
    this.lastProtected = null;
    this.vigilanteUsed = false;
    this.inventory = [];
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
    if (this.currentSelection !== null) {
      this.confirmedSelection = this.currentSelection;
    }
    return this.confirmedSelection;
  }

  abstain() {
    this.currentSelection = null;
    this.confirmedSelection = null; // Explicitly set to null
    this.abstained = true; // Mark as abstained
    return this;
  }

  cancelSelection() {
    this.confirmedSelection = null;
    return null;
  }

  clearSelection() {
    this.currentSelection = null;
    this.confirmedSelection = null;
    this.abstained = false;
  }

  // Get public state (safe to send to other players)
  getPublicState() {
    return {
      id: this.id,
      seatNumber: this.seatNumber,
      name: this.name,
      portrait: this.portrait,
      status: this.status,
      isAlive: this.isAlive,
      connected: this.connected,
      terminalConnected: this.terminalConnected,
      // Role only shown if dead
      role: this.status === PlayerStatus.DEAD ? this.role?.id : null,
      roleName: this.status === PlayerStatus.DEAD ? this.role?.name : null,
      roleColor: this.status === PlayerStatus.DEAD ? this.role?.color : null,
      roleTeam: this.status === PlayerStatus.DEAD ? this.role?.team : null,
      deathTimestamp: this.status === PlayerStatus.DEAD ? this.deathTimestamp : null,
    };
  }

  // Get private state (only for this player)
  getPrivateState(game) {
    return {
      ...this.getPublicState(),
      role: this.role?.id,
      roleName: this.role?.name,
      roleColor: this.role?.color,
      roleDescription: this.role?.description,
      team: this.role?.team,
      currentSelection: this.currentSelection,
      confirmedSelection: this.confirmedSelection,
      abstained: this.abstained,
      pendingEvents: [...this.pendingEvents],
      investigations: this.investigations,
      linkedTo: this.linkedTo,
      vigilanteUsed: this.vigilanteUsed,
      inventory: this.inventory,
      packInfo: game ? this.getPackInfo(game) : null,
      display: game ? this.getDisplayState(game) : null,
    };
  }

  // Get pack info (for werewolf team members)
  getPackInfo(game) {
    if (!this.role || this.role.team !== Team.WEREWOLF) {
      return null;
    }

    const packMembers = game
      .getAlivePlayers()
      .filter((p) => p.role.team === Team.WEREWOLF && p.id !== this.id)
      .map((p) => ({
        id: p.id,
        name: p.name,
        portrait: p.portrait,
        role: p.role.id,
        roleName: p.role.name,
        isAlpha: p.role.id === 'alpha',
        currentSelection: p.currentSelection,
        confirmedSelection: p.confirmedSelection,
      }));

    return {
      packMembers,
      playerRole: this.role.id,
      isAlpha: this.role.id === 'alpha',
    };
  }

  // === Display State (TinyScreen) ===

  /**
   * Get the display state for TinyScreen (3-line format)
   * @param {Game} game - The game instance
   * @param {Object} eventContext - Optional event context { eventId, eventName, description, allowAbstain }
   * @returns {Object} Display state with line1, line2, line3, leds
   */
  getDisplayState(game, eventContext = null) {
    const phase = game?.phase;
    const dayCount = game?.dayCount || 0;
    const hasActiveEvent = this.pendingEvents.size > 0;

    // Get current event info
    const activeEventId = hasActiveEvent ? [...this.pendingEvents][0] : null;
    const activeEvent = activeEventId ? game?.activeEvents?.get(activeEventId) : null;
    const eventName = activeEvent?.event?.name || eventContext?.eventName || null;

    // Build display based on state priority
    return this._buildDisplay(game, {
      phase,
      dayCount,
      hasActiveEvent,
      activeEventId,
      eventName,
      eventContext,
    });
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

    // Clear role reveal once player enters any event
    if (this.showIdleRole && hasActiveEvent) {
      this.showIdleRole = false;
    }

    // Priority-ordered state dispatch
    if (phase === GamePhase.LOBBY)          return this._displayLobby(getLine1);
    if (phase === GamePhase.GAME_OVER)      return this._displayGameOver(getLine1);
    if (!this.isAlive && !hasActiveEvent)    return this._displayDead(getLine1);
    if (this.abstained)                      return this._displayAbstained(getLine1, eventName, activeEventId);
    if (this.confirmedSelection)             return this._displayConfirmed(game, getLine1, eventName, activeEventId);
    if (hasActiveEvent && this.currentSelection)
      return this._displayEventWithSelection(game, ctx, getLine1, activeEventId, eventName);
    if (hasActiveEvent)
      return this._displayEventNoSelection(game, ctx, getLine1, activeEventId, eventName);

    const usableAbilities = this._getUsableAbilities();
    if (usableAbilities.length > 0 && this.isAlive)
      return this._displayAbilityMode(getLine1, phaseLed, usableAbilities);

    if (this.lastEventResult) return this._displayEventResult(getLine1, phaseLed);
    if (this.showIdleRole)    return this._displayGameStart(getLine1, phaseLed);
    return this._displayIdle(getLine1, phaseLed);
  }

  // --- Display state methods (called by _buildDisplay) ---

  _displayLobby(getLine1) {
    return this._display(
      { left: getLine1(), right: '' },
      { text: 'WAITING', style: DisplayStyle.NORMAL },
      { text: 'Game will begin soon' },
      { yes: LedState.OFF, no: LedState.OFF },
      StatusLed.LOBBY
    );
  }

  _displayGameOver(getLine1) {
    return this._display(
      { left: getLine1(), right: '' },
      { text: 'FINISHED', style: DisplayStyle.NORMAL },
      { text: 'Thanks for playing' },
      { yes: LedState.OFF, no: LedState.OFF },
      StatusLed.GAME_OVER
    );
  }

  _displayDead(getLine1) {
    return this._display(
      { left: getLine1(), right: Glyphs.SKULL },
      { text: 'SPECTATOR', style: DisplayStyle.NORMAL },
      { text: 'Watch the game unfold' },
      { yes: LedState.OFF, no: LedState.OFF },
      StatusLed.DEAD
    );
  }

  _displayAbstained(getLine1, eventName, activeEventId) {
    return this._display(
      { left: getLine1(eventName, activeEventId), right: Glyphs.X },
      { text: 'ABSTAINED', style: DisplayStyle.ABSTAINED },
      { text: 'Waiting for others' },
      { yes: LedState.OFF, no: LedState.OFF },
      StatusLed.ABSTAINED
    );
  }

  _displayConfirmed(game, getLine1, eventName, activeEventId) {
    const targetName = game?.getPlayer(this.confirmedSelection)?.name || 'Unknown';
    // Special display for pardon event - show "PARDONING {NAME}"
    const line2Text = activeEventId === 'pardon'
      ? `PARDONING ${targetName.toUpperCase()}`
      : targetName.toUpperCase();
    return this._display(
      { left: getLine1(eventName, activeEventId), right: Glyphs.LOCK },
      { text: line2Text, style: DisplayStyle.LOCKED },
      { text: 'Selection locked' },
      { yes: LedState.OFF, no: LedState.OFF },
      StatusLed.LOCKED
    );
  }

  _displayEventWithSelection(game, ctx, getLine1, activeEventId, eventName) {
    const targetName = game?.getPlayer(this.currentSelection)?.name || 'Unknown';
    const packHint = this._getPackHint(game, activeEventId);
    const canAbstain = ctx.eventContext?.allowAbstain !== false;
    const actions = getEventActions(activeEventId);

    // Special display for pardon event - show "PARDON {NAME}?"
    const line2Text = activeEventId === 'pardon'
      ? `PARDON ${targetName.toUpperCase()}?`
      : targetName.toUpperCase();

    return this._display(
      { left: getLine1(eventName, activeEventId), right: '' },
      { text: line2Text, style: DisplayStyle.NORMAL },
      packHint
        ? { left: actions.confirm, center: packHint, right: canAbstain ? actions.abstain : '' }
        : { left: actions.confirm, right: canAbstain ? actions.abstain : '' },
      { yes: LedState.BRIGHT, no: canAbstain ? LedState.DIM : LedState.OFF },
      StatusLed.VOTING
    );
  }

  _displayEventNoSelection(game, ctx, getLine1, activeEventId, eventName) {
    const packHint = this._getPackHint(game, activeEventId);
    const canAbstain = ctx.eventContext?.allowAbstain !== false;
    const actions = getEventActions(activeEventId);

    // Special display for pardon event - show condemned player's name
    if (activeEventId === 'pardon') {
      const condemnedName = game?.flows?.get('pardon')?.state?.condemnedName || 'Unknown';
      return this._display(
        { left: getLine1(eventName, activeEventId), right: '' },
        { text: `PARDON ${condemnedName.toUpperCase()}?`, style: DisplayStyle.NORMAL },
        { left: actions.confirm, right: actions.abstain },
        { yes: LedState.BRIGHT, no: LedState.DIM },
        StatusLed.VOTING
      );
    }

    return this._display(
      { left: getLine1(eventName, activeEventId), right: '' },
      { text: actions.prompt, style: DisplayStyle.WAITING },
      packHint
        ? { left: 'Use dial', center: packHint, right: canAbstain ? actions.abstain : '' }
        : { left: 'Use dial', right: canAbstain ? actions.abstain : '' },
      { yes: LedState.OFF, no: canAbstain ? LedState.DIM : LedState.OFF },
      StatusLed.VOTING
    );
  }

  _displayAbilityMode(getLine1, phaseLed, usableAbilities) {
    const ability = usableAbilities[0]; // Show first ability
    return this._display(
      { left: getLine1(), right: this._getInventoryGlyphs() },
      { text: `USE ${ability.id.toUpperCase()}?`, style: DisplayStyle.NORMAL },
      { left: `USE (${ability.uses}/${ability.maxUses})`, right: '' },
      { yes: LedState.DIM, no: LedState.OFF },
      phaseLed
    );
  }

  _displayEventResult(getLine1, phaseLed) {
    return this._display(
      { left: getLine1(), right: Glyphs.CHECK },
      { text: this.lastEventResult.message, style: DisplayStyle.NORMAL },
      { text: '' },
      { yes: LedState.OFF, no: LedState.OFF },
      phaseLed
    );
  }

  _displayGameStart(getLine1, phaseLed) {
    return this._display(
      { left: getLine1(), right: this._getInventoryGlyphs() + this._getRoleGlyph() },
      { text: this.role?.name?.toUpperCase() || 'READY', style: DisplayStyle.NORMAL },
      { text: this.tutorialTip || '[tip missing]' },
      { yes: LedState.OFF, no: LedState.OFF },
      phaseLed
    );
  }

  _displayIdle(getLine1, phaseLed) {
    return this._display(
      { left: getLine1(), right: this._getInventoryGlyphs() + this._getRoleGlyph() },
      { text: '', style: DisplayStyle.NORMAL },
      { text: this.tutorialTip || '[tip missing]' },
      { yes: LedState.OFF, no: LedState.OFF },
      phaseLed
    );
  }

  /**
   * Create a display state object
   */
  _display(line1, line2, line3, leds, statusLed) {
    return { line1, line2, line3, leds, statusLed };
  }

  /**
   * Build the standardized line1 left text
   * Format: #{seatNumber} {NAME/ROLE} > {PHASE} > {ACTION}
   * Examples:
   *   #8 PLAYER > LOBBY (default name, no role)
   *   #8 DEMI > LOBBY (custom name, no role)
   *   #8 WEREWOLF > DAY 1 (role assigned)
   *   #8 WEREWOLF > DAY 1 > VOTE
   *   #8 WEREWOLF > DAY 1 > DEAD
   *   #8 VILLAGER > DAY 1 > SHOOT (PISTOL)
   */
  _getLine1(phase, dayCount, eventName, eventId) {
    const playerNum = `#${this.seatNumber}`;

    // Determine what to show: role (if assigned) or player name (in lobby)
    let nameOrRole;
    if (this.role) {
      // Role assigned - show role name
      nameOrRole = this.role.name.toUpperCase();
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
      actionPart = ' :skull:';
    } else if (eventName) {
      actionPart = ` > ${eventName.toUpperCase()}`;
      // Add item name for item-triggered events
      if (eventId === 'shoot') {
        actionPart += ' (PISTOL)';
      } else if (eventId === 'investigate' && !this.role?.events?.investigate) {
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
   * Get inventory glyphs string
   */
  _getInventoryGlyphs() {
    return this.inventory
      .filter((item) => item.uses > 0 || item.maxUses === -1)
      .map((item) => ItemGlyphs[item.id] || '')
      .filter(Boolean)
      .join('');
  }

  /**
   * Get role glyph (for werewolves)
   */
  _getRoleGlyph() {
    if (!this.role) return '';
    if (this.role.id === 'alpha') return Glyphs.ALPHA;
    if (this.role.team === Team.WEREWOLF) return Glyphs.WOLF;
    return '';
  }

  /**
   * Get pack hint (most popular target among pack)
   */
  _getPackHint(game, eventId) {
    if (!this.role || this.role.team !== Team.WEREWOLF) return '';
    if (!['kill', 'hunt'].includes(eventId)) return '';

    // Count pack selections
    const tally = {};
    const packMembers = game.getAlivePlayers()
      .filter((p) => p.role.team === Team.WEREWOLF && p.id !== this.id);

    for (const member of packMembers) {
      if (member.currentSelection) {
        tally[member.currentSelection] = (tally[member.currentSelection] || 0) + 1;
      }
    }

    // Find most popular
    const entries = Object.entries(tally);
    if (entries.length === 0) return '';

    const [topTargetId] = entries.sort((a, b) => b[1] - a[1])[0];
    const topTarget = game.getPlayer(topTargetId);

    if (topTarget) {
      return `${Glyphs.WOLF} ${topTarget.name.toUpperCase()}`;
    }
    return '';
  }

  /**
   * Get usable abilities (items with startsEvent)
   */
  _getUsableAbilities() {
    return this.inventory.filter(
      (item) => item.startsEvent && (item.uses > 0 || item.maxUses === -1)
    );
  }

  // Inventory management
  addItem(itemDef) {
    // Check if player already has this item
    const existingItem = this.getItem(itemDef.id);

    if (existingItem) {
      // Add uses to existing item instead of creating duplicate
      existingItem.uses += itemDef.maxUses === -1 ? 0 : itemDef.maxUses;
    } else {
      // Add new item to inventory
      this.inventory.push({
        id: itemDef.id,
        uses: itemDef.maxUses,
        maxUses: itemDef.maxUses,
        startsEvent: itemDef.startsEvent || null, // Event to start when activated (idle-activatable)
      });
    }

    return this;
  }

  hasItem(itemId) {
    return this.inventory.some((item) => item.id === itemId);
  }

  getItem(itemId) {
    return this.inventory.find((item) => item.id === itemId) || null;
  }

  removeItem(itemId) {
    const index = this.inventory.findIndex((item) => item.id === itemId);
    if (index !== -1) {
      this.inventory.splice(index, 1);
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

    const message = JSON.stringify({ type, payload });
    let sentCount = 0;

    for (const ws of this.connections) {
      if (ws && ws.readyState === 1) {
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

  // Helper: Send updated private state to this player
  syncState(game) {
    return this.send(ServerMsg.PLAYER_STATE, this.getPrivateState(game));
  }

  // Add a new connection (supports multiple simultaneous connections)
  addConnection(ws) {
    if (!ws) return;

    // Don't add duplicates
    if (!this.connections.includes(ws)) {
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
