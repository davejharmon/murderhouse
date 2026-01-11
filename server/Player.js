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
} from '../shared/constants.js';

let nextSeatNumber = 1;

export class Player {
  constructor(id, ws = null) {
    this.id = id;
    this.seatNumber = nextSeatNumber++;
    this.ws = ws;

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

    // History
    this.investigations = [];
    this.suspicions = [];
    this.lastProtected = null;

    // Role-specific state
    this.vigilanteUsed = false;

    // Inventory
    this.inventory = []; // Array of { id, uses, maxUses }

    // Connection
    this.connected = ws !== null;
    this.lastSeen = Date.now();
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
   * Build the display object based on current state
   */
  _buildDisplay(game, ctx) {
    const { phase, dayCount, hasActiveEvent, activeEventId, eventName } = ctx;

    // === LOBBY ===
    if (phase === GamePhase.LOBBY) {
      return this._display(
        { left: 'LOBBY', right: '' },
        { text: 'WAITING', style: DisplayStyle.NORMAL },
        { text: 'Game will begin soon' },
        { yes: LedState.OFF, no: LedState.OFF }
      );
    }

    // === GAME OVER ===
    if (phase === GamePhase.GAME_OVER) {
      return this._display(
        { left: 'GAME OVER', right: '' },
        { text: 'FINISHED', style: DisplayStyle.NORMAL },
        { text: 'Thanks for playing' },
        { yes: LedState.OFF, no: LedState.OFF }
      );
    }

    // === DEAD (no active event) ===
    if (!this.isAlive && !hasActiveEvent) {
      return this._display(
        { left: 'ELIMINATED', right: Glyphs.SKULL },
        { text: 'SPECTATOR', style: DisplayStyle.NORMAL },
        { text: 'Watch the game unfold' },
        { yes: LedState.OFF, no: LedState.OFF }
      );
    }

    // === ABSTAINED ===
    if (this.abstained) {
      return this._display(
        { left: this._getContextLine(phase, dayCount, eventName), right: Glyphs.X },
        { text: 'ABSTAINED', style: DisplayStyle.ABSTAINED },
        { text: 'Waiting for others' },
        { yes: LedState.OFF, no: LedState.OFF }
      );
    }

    // === CONFIRMED SELECTION ===
    if (this.confirmedSelection) {
      const targetName = game?.getPlayer(this.confirmedSelection)?.name || 'Unknown';
      // Special display for pardon event
      const line2Text = activeEventId === 'pardon' ? 'PARDONED' : targetName.toUpperCase();
      return this._display(
        { left: this._getContextLine(phase, dayCount, eventName), right: Glyphs.LOCK },
        { text: line2Text, style: DisplayStyle.LOCKED },
        { text: 'Selection locked' },
        { yes: LedState.OFF, no: LedState.OFF }
      );
    }

    // === EVENT ACTIVE WITH SELECTION ===
    if (hasActiveEvent && this.currentSelection) {
      const targetName = game?.getPlayer(this.currentSelection)?.name || 'Unknown';
      const packHint = this._getPackHint(game, activeEventId);
      const canAbstain = ctx.eventContext?.allowAbstain !== false;

      // Special display for pardon event - show PARDON? instead of target name
      const line2Text = activeEventId === 'pardon' ? 'PARDON?' : targetName.toUpperCase();

      return this._display(
        { left: this._getContextLine(phase, dayCount, eventName), right: packHint },
        { text: line2Text, style: DisplayStyle.NORMAL },
        { text: canAbstain ? 'YES confirm \u2022 NO abstain' : 'YES to confirm' },
        { yes: LedState.BRIGHT, no: canAbstain ? LedState.DIM : LedState.OFF }
      );
    }

    // === EVENT ACTIVE NO SELECTION ===
    if (hasActiveEvent) {
      const packHint = this._getPackHint(game, activeEventId);
      const canAbstain = ctx.eventContext?.allowAbstain !== false;

      return this._display(
        { left: this._getContextLine(phase, dayCount, eventName), right: packHint },
        { text: 'SELECT TARGET', style: DisplayStyle.WAITING },
        { text: 'Swipe to choose' },
        { yes: LedState.OFF, no: canAbstain ? LedState.DIM : LedState.OFF }
      );
    }

    // === ABILITY MODE (idle with usable items) ===
    const usableAbilities = this._getUsableAbilities();
    if (usableAbilities.length > 0 && this.isAlive) {
      const ability = usableAbilities[0]; // Show first ability
      return this._display(
        { left: this._getPhaseLabel(phase, dayCount), right: this._getInventoryGlyphs() },
        { text: `USE ${ability.id.toUpperCase()}?`, style: DisplayStyle.NORMAL },
        { text: `YES to use \u2022 ${ability.uses}/${ability.maxUses}` },
        { yes: LedState.DIM, no: LedState.OFF }
      );
    }

    // === IDLE STATE ===
    const roleLabel = this.role?.name?.toUpperCase() || 'PLAYER';
    const idleTip = phase === GamePhase.DAY
      ? 'Discuss and vote'
      : 'Waiting...';

    return this._display(
      { left: this._getPhaseLabel(phase, dayCount), right: this._getInventoryGlyphs() + this._getRoleGlyph() },
      { text: roleLabel, style: DisplayStyle.NORMAL },
      { text: idleTip },
      { yes: LedState.OFF, no: LedState.OFF }
    );
  }

  /**
   * Create a display state object
   */
  _display(line1, line2, line3, leds) {
    return { line1, line2, line3, leds };
  }

  /**
   * Get the context line (role + event name)
   */
  _getContextLine(phase, dayCount, eventName) {
    const roleLabel = this.role?.name?.toUpperCase() || 'PLAYER';
    if (eventName) {
      return `${roleLabel} > ${eventName.toUpperCase()}`;
    }
    return this._getPhaseLabel(phase, dayCount);
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
      return `${Glyphs.PACK}${topTarget.name.toUpperCase()}`;
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

  // Send message to this player
  send(type, payload) {
    if (this.ws && this.ws.readyState === 1) {
      this.ws.send(JSON.stringify({ type, payload }));
      return true;
    }
    console.log(`[Player ${this.id}] Failed to send ${type}: ws=${!!this.ws}, readyState=${this.ws?.readyState}`);
    return false;
  }

  // Helper: Send updated private state to this player
  syncState(game) {
    const sent = this.send(ServerMsg.PLAYER_STATE, this.getPrivateState(game));
    if (!sent) {
      console.log(`[Player ${this.id}] syncState failed - ws not connected`);
    }
    return sent;
  }

  // Update connection
  setConnection(ws) {
    console.log(`[Player ${this.id}] setConnection called, ws=${!!ws}, readyState=${ws?.readyState}`);
    this.ws = ws;
    this.connected = ws !== null;
    this.lastSeen = Date.now();
  }
}

// Reset seat counter (for new games)
export function resetSeatCounter() {
  nextSeatNumber = 1;
}
