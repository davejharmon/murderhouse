// server/Player.js
// Player model - represents a player in the game

import {
  PlayerStatus,
  ServerMsg,
  Team,
  GamePhase,
  RoleId,
  EventId,
  LedState,
  DisplayStyle,
  StatusLed,
  IconState,
} from '../shared/constants.js';

// Action labels for each event type (confirm action / abstain action / select prompt)
const EVENT_ACTIONS = {
  [EventId.VOTE]:         { confirm: 'VOTE',    abstain: 'ABSTAIN', prompt: 'VOTE FOR SOMEONE' },
  pardon:                 { confirm: 'PARDON',  abstain: 'CONDEMN', prompt: 'PARDON' },
  [EventId.HUNT]:         { confirm: 'KILL',    abstain: 'ABSTAIN', prompt: 'SUGGEST SOMEONE' },
  [EventId.KILL]:         { confirm: 'KILL',    abstain: 'ABSTAIN', prompt: 'TARGET SOMEONE' },
  [EventId.INVESTIGATE]:  { confirm: 'REVEAL',  abstain: 'ABSTAIN', prompt: 'INVESTIGATE SOMEONE' },
  [EventId.PROTECT]:      { confirm: 'PROTECT', abstain: 'ABSTAIN', prompt: 'PROTECT SOMEONE' },
  [EventId.SHOOT]:        { confirm: 'SHOOT',   abstain: 'ABSTAIN', prompt: 'SHOOT SOMEONE' },
  [EventId.SUSPECT]:      { confirm: 'SUSPECT', abstain: 'ABSTAIN', prompt: 'SUSPECT SOMEONE' },
  [EventId.BLOCK]:        { confirm: 'BLOCK',   abstain: 'ABSTAIN', prompt: 'BLOCK SOMEONE' },
  [EventId.CLEAN]:        { confirm: 'YES',     abstain: 'NO',      prompt: 'CLEAN UP?' },
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

    // Inventory
    this.inventory = []; // Array of { id, uses, maxUses }

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
    return this.currentSelection;
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
      // Role only shown if dead and not cleaned by janitor
      role: showRole ? this.role?.id : null,
      roleName: showRole ? this.role?.name : null,
      roleColor: showRole ? this.role?.color : null,
      roleTeam: showRole ? this.role?.team : null,
      deathTimestamp: isDead ? this.deathTimestamp : null,
    };
  }

  // Get private state (only for this player)
  getPrivateState(game) {
    const activeResult = this.getActiveResult(game);
    return {
      ...this.getPublicState(),
      role: this.role?.id,
      roleName: this.role?.name,
      roleColor: this.role?.color,
      roleDescription: this.role?.description,
      team: this.role?.team,
      preAssignedRole: this.preAssignedRole,
      currentSelection: this.currentSelection,
      confirmedSelection: (activeResult && !activeResult.abstained) ? activeResult.targetId : null,
      abstained: activeResult?.abstained ?? false,
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

    // Derive confirmed/abstained from single source of truth
    const activeResult = this.getActiveResult(game);
    const isAbstained = activeResult?.abstained ?? false;
    const confirmedTargetId = (activeResult && !activeResult.abstained) ? activeResult.targetId : null;

    // Priority-ordered state dispatch
    if (phase === GamePhase.LOBBY)          return this._displayLobby(getLine1);
    if (phase === GamePhase.GAME_OVER)      return this._displayGameOver(getLine1);
    if (!this.isAlive && !hasActiveEvent)    return this._displayDead(getLine1);
    if (isAbstained)                         return this._displayAbstained(getLine1, eventName, activeEventId);
    if (confirmedTargetId)                   return this._displayConfirmed(game, getLine1, eventName, activeEventId, confirmedTargetId);
    if (hasActiveEvent && this.currentSelection)
      return this._displayEventWithSelection(game, ctx, getLine1, activeEventId, eventName);
    if (hasActiveEvent)
      return this._displayEventNoSelection(game, ctx, getLine1, activeEventId, eventName);

    if (this.lastEventResult) return this._displayEventResult(getLine1, phaseLed);

    // Dynamically compute packmate tip for werewolves (reflects living members)
    if (this.role?.team === Team.WEREWOLF) {
      const packmates = game.getAlivePlayers().filter(
        (p) => p.id !== this.id && p.role.team === Team.WEREWOLF,
      );
      if (packmates.length === 0) {
        this.tutorialTip = 'Lone wolf';
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
              this.tutorialTip = `PACK: ${targetName.toUpperCase()}`;
            } else {
              this.tutorialTip = `PACK: ${packmates.map((p) => p.name).join(', ')}`;
            }
          } else {
            this.tutorialTip = `PACK: ${packmates.map((p) => p.name).join(', ')}`;
          }
        } else {
          this.tutorialTip = `PACK: ${packmates.map((p) => p.name).join(', ')}`;
        }
      }
    }

    return this._displayIdleScroll(getLine1, phaseLed);
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
      { left: getLine1(), right: '' },
      { text: 'SPECTATOR', style: DisplayStyle.NORMAL },
      { text: 'Watch the game unfold' },
      { yes: LedState.OFF, no: LedState.OFF },
      StatusLed.DEAD
    );
  }

  _displayAbstained(getLine1, eventName, activeEventId) {
    return this._display(
      { left: getLine1(eventName, activeEventId), right: '' },
      { text: 'ABSTAINED', style: DisplayStyle.ABSTAINED },
      { text: 'Waiting for others' },
      { yes: LedState.OFF, no: LedState.OFF },
      StatusLed.ABSTAINED
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
    } else {
      line2Text = targetName.toUpperCase();
    }
    // Show pack hint alongside "Selection locked" for KILL/HUNT
    const packHint = this._getPackHint(game, activeEventId);
    const line3 = packHint
      ? { left: 'Selection locked', center: packHint }
      : { text: 'Selection locked' };
    return this._display(
      { left: getLine1(eventName, activeEventId), right: '' },
      { text: line2Text, style: DisplayStyle.LOCKED },
      line3,
      { yes: LedState.OFF, no: LedState.OFF },
      StatusLed.LOCKED
    );
  }

  _displayEventWithSelection(game, ctx, getLine1, activeEventId, eventName) {
    const targetName = game?.getPlayer(this.currentSelection)?.name || 'Unknown';
    const packHint = this._getPackHint(game, activeEventId);
    const canAbstain = ctx.eventContext?.allowAbstain !== false;
    const actions = getEventActions(activeEventId);

    // Special display for specific events
    let line2Text;
    if (activeEventId === 'pardon') {
      line2Text = `PARDON ${targetName.toUpperCase()}?`;
    } else if (activeEventId === EventId.CLEAN) {
      line2Text = 'CLEAN UP?';
    } else {
      line2Text = targetName.toUpperCase();
    }

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

  _displayEventResult(getLine1, phaseLed) {
    return this._display(
      { left: getLine1(), right: '' },
      { text: this.lastEventResult.message, style: DisplayStyle.NORMAL },
      { text: '' },
      { yes: LedState.OFF, no: LedState.OFF },
      phaseLed
    );
  }

  _displayIdleScroll(getLine1, phaseLed) {
    const icons = this._buildIcons();
    const idx = this.idleScrollIndex;
    const slot = icons[idx];

    // Determine line2/line3 content based on which slot is highlighted
    let line2Text = '';
    let line3 = { text: '' };
    let leds = { yes: LedState.OFF, no: LedState.OFF };

    if (idx === 0) {
      // Role slot - show role name and tip
      line2Text = this.role?.name?.toUpperCase() || 'READY';
      line3 = { text: this.tutorialTip || '' };
    } else {
      // Item slots (1 or 2)
      const itemIndex = idx - 1;
      const inventoryItem = this._getIconSlotItem(itemIndex);
      if (inventoryItem) {
        if (inventoryItem.startsEvent) {
          // Usable item
          const usesLabel = inventoryItem.maxUses === -1
            ? 'UNLIMITED'
            : `(${inventoryItem.uses}/${inventoryItem.maxUses})`;
          line2Text = `USE ${inventoryItem.id.toUpperCase()}?`;
          line3 = { left: usesLabel, right: '' };
          leds = { yes: LedState.DIM, no: LedState.OFF };
        } else {
          // Non-activatable item (phone, etc.)
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
      { text: line2Text, style: DisplayStyle.NORMAL },
      line3,
      leds,
      phaseLed
    );
  }

  /**
   * Create a display state object
   */
  _display(line1, line2, line3, leds, statusLed) {
    return {
      line1, line2, line3, leds, statusLed,
      icons: this._buildIcons(),
      idleScrollIndex: this.idleScrollIndex,
    };
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
  _buildIcons() {
    const idx = this.idleScrollIndex;

    // Slot 0: role icon
    let slot0;
    if (!this.isAlive) {
      slot0 = { id: 'skull', state: IconState.INACTIVE };
    } else if (this.role) {
      slot0 = { id: this.role.id, state: idx === 0 ? IconState.ACTIVE : IconState.INACTIVE };
    } else {
      slot0 = { id: 'empty', state: IconState.EMPTY };
    }

    // Slots 1-2: inventory items
    const slot1 = this._buildItemIcon(0, idx === 1);
    const slot2 = this._buildItemIcon(1, idx === 2);

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
  _getPackHint(game, eventId) {
    if (!this.role || this.role.team !== Team.WEREWOLF) return '';
    if (!game.activeEvents?.has(EventId.KILL)) return '';

    const packMembers = game.getAlivePlayers()
      .filter((p) => p.role.team === Team.WEREWOLF && p.id !== this.id);

    if (packMembers.length === 0) return '';

    // Non-alpha: show alpha's specific pick
    if (this.role.id !== RoleId.ALPHA) {
      const alpha = packMembers.find(p => p.role.id === RoleId.ALPHA);
      if (!alpha) return '';
      const alphaResult = alpha.getActiveResult(game);
      const alphaPick = (alphaResult && !alphaResult.abstained) ? alphaResult.targetId : alpha.currentSelection;
      if (!alphaPick) return '';
      const target = game.getPlayer(alphaPick);
      return target ? target.name.toUpperCase() : '';
    }

    // Alpha: tally packmates' confirmedSelection ?? currentSelection
    const tally = {};
    for (const member of packMembers) {
      const result = member.getActiveResult(game);
      const pick = (result && !result.abstained) ? result.targetId : member.currentSelection;
      if (pick) {
        tally[pick] = (tally[pick] || 0) + 1;
      }
    }

    const entries = Object.entries(tally);
    if (entries.length === 0) return '';

    const [topTargetId] = entries.sort((a, b) => b[1] - a[1])[0];
    const topTarget = game.getPlayer(topTargetId);
    return topTarget ? topTarget.name.toUpperCase() : '';
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
      // Clamp idle scroll index if it now points past available slots
      const maxSlot = this.inventory.length; // slots 1..N map to inventory 0..N-1
      if (this.idleScrollIndex > maxSlot) {
        this.idleScrollIndex = 0;
      }
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
