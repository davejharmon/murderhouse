// server/Player.js
// Player model - represents a player in the game

import {
  PlayerStatus,
  ServerMsg,
  Team,
  RoleId,
  EventId,
  ItemId,
} from '../shared/constants.js';
import { getItem } from './definitions/items.js';
import { DisplayStateBuilder } from './DisplayStateBuilder.js';

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
    return new DisplayStateBuilder(this).build(game, eventContext, displayRole);
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
