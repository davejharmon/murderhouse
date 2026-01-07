// server/Player.js
// Player model - represents a player in the game

import { PlayerStatus, ServerMsg } from '../shared/constants.js';

let nextSeatNumber = 1;

export class Player {
  constructor(id, ws = null) {
    this.id = id;
    this.seatNumber = nextSeatNumber++;
    this.ws = ws;

    // Identity
    this.name = `Player ${this.seatNumber}`;
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
    };
  }

  // Get private state (only for this player)
  getPrivateState() {
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
    };
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
    return false;
  }

  // Helper: Send updated private state to this player
  syncState() {
    return this.send(ServerMsg.PLAYER_STATE, this.getPrivateState());
  }

  // Update connection
  setConnection(ws) {
    this.ws = ws;
    this.connected = ws !== null;
    this.lastSeen = Date.now();
  }
}

// Reset seat counter (for new games)
export function resetSeatCounter() {
  nextSeatNumber = 1;
}
