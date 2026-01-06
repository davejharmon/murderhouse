// server/Game.js
// Core game state machine and logic

import { GamePhase, Team, PlayerStatus, ServerMsg, MIN_PLAYERS, MAX_PLAYERS } from '../shared/constants.js';
import { Player, resetSeatCounter } from './Player.js';
import { getRole, roleDistribution } from './definitions/roles.js';
import { getEvent, getEventsForPhase } from './definitions/events.js';

export class Game {
  constructor(broadcast) {
    this.broadcast = broadcast; // Function to send to all clients
    this.reset();
  }

  reset() {
    resetSeatCounter();
    this.players = new Map(); // id -> Player
    this.host = null; // Host WebSocket
    this.screen = null; // Big screen WebSocket
    
    this.phase = GamePhase.LOBBY;
    this.dayCount = 0;
    
    // Event management
    this.pendingEvents = []; // Events that can be started this phase
    this.activeEvents = new Map(); // eventId -> { event, results, participants }
    this.eventResults = []; // Results to reveal at end of phase
    
    // Slide queue for big screen
    this.slideQueue = [];
    this.currentSlideIndex = -1;
    
    // Interrupt handling (e.g., Hunter)
    this.interruptData = null;
    
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
    this.players.set(id, player);
    
    this.addLog(`${player.name} joined the game`);
    this.broadcastPlayerList();
    
    return { success: true, player };
  }

  removePlayer(id) {
    const player = this.players.get(id);
    if (!player) return { success: false, error: 'Player not found' };
    
    this.players.delete(id);
    this.addLog(`${player.name} left the game`);
    this.broadcastPlayerList();
    
    return { success: true };
  }

  getPlayer(id) {
    return this.players.get(id) || null;
  }

  getAlivePlayers() {
    return [...this.players.values()].filter(p => p.isAlive);
  }

  getPlayersBySeat() {
    return [...this.players.values()].sort((a, b) => a.seatNumber - b.seatNumber);
  }

  reconnectPlayer(id, ws) {
    const player = this.players.get(id);
    if (!player) return { success: false, error: 'Player not found' };
    
    player.setConnection(ws);
    this.addLog(`${player.name} reconnected`);
    
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

    // Assign roles
    this.assignRoles();
    
    // Start day 1
    this.phase = GamePhase.DAY;
    this.dayCount = 1;
    
    // Send role reveals to each player
    for (const player of this.players.values()) {
      player.send(ServerMsg.PLAYER_STATE, player.getPrivateState());
    }
    
    // Build pending events for this phase
    this.buildPendingEvents();
    
    this.addLog('Game started - Day 1');
    this.pushSlide({
      type: 'title',
      title: 'DAY 1',
      subtitle: 'The game begins.',
    });
    
    this.broadcastGameState();
    
    return { success: true };
  }

  assignRoles() {
    const playerCount = this.players.size;
    const distribution = roleDistribution[playerCount];
    
    if (!distribution) {
      throw new Error(`No role distribution for ${playerCount} players`);
    }
    
    // Shuffle distribution
    const shuffled = [...distribution].sort(() => Math.random() - 0.5);
    
    // Assign to players
    const playerList = this.getPlayersBySeat();
    for (let i = 0; i < playerList.length; i++) {
      const roleId = shuffled[i];
      const role = getRole(roleId);
      playerList[i].assignRole(role);
    }
  }

  nextPhase() {
    // Clear protection
    for (const player of this.players.values()) {
      player.isProtected = false;
      player.clearSelection();
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
        type: 'title',
        title: `NIGHT ${this.dayCount}`,
        subtitle: 'Close your eyes... just kidding.',
      });
    } else if (this.phase === GamePhase.NIGHT) {
      this.phase = GamePhase.DAY;
      this.dayCount++;
      this.addLog(`Day ${this.dayCount} begins`);
      this.pushSlide({
        type: 'title',
        title: `DAY ${this.dayCount}`,
        subtitle: 'The sun rises.',
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
    
    for (const event of phaseEvents) {
      const participants = event.participants(this);
      if (participants.length > 0) {
        this.pendingEvents.push(event.id);
      }
    }
  }

  // === Event Management ===

  startEvent(eventId) {
    const event = getEvent(eventId);
    if (!event) {
      return { success: false, error: 'Event not found' };
    }
    
    const participants = event.participants(this);
    if (participants.length === 0) {
      return { success: false, error: 'No eligible participants' };
    }
    
    // Create active event instance
    const eventInstance = {
      event,
      results: {}, // playerId -> targetId
      participants: participants.map(p => p.id),
      startedAt: Date.now(),
    };
    
    this.activeEvents.set(eventId, eventInstance);
    this.pendingEvents = this.pendingEvents.filter(id => id !== eventId);
    
    // Notify participants
    for (const player of participants) {
      player.pendingEvents.add(eventId);
      player.clearSelection();
      
      const targets = event.validTargets(player, this);
      
      player.send(ServerMsg.EVENT_PROMPT, {
        eventId,
        eventName: event.name,
        description: event.description,
        targets: targets.map(t => t.getPublicState()),
      });
    }
    
    this.addLog(`${event.name} event started`);
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

  recordSelection(playerId, targetId) {
    const player = this.getPlayer(playerId);
    if (!player) return { success: false, error: 'Player not found' };
    
    // Find which active event this player is in
    for (const [eventId, instance] of this.activeEvents) {
      if (instance.participants.includes(playerId)) {
        instance.results[playerId] = targetId;
        player.confirmedSelection = targetId;
        
        this.broadcastGameState();
        return { success: true, eventId };
      }
    }
    
    return { success: false, error: 'No active event for player' };
  }

  resolveEvent(eventId) {
    const instance = this.activeEvents.get(eventId);
    if (!instance) {
      return { success: false, error: 'Event not active' };
    }
    
    const { event, results, participants } = instance;
    
    // Check if all required responses are in
    if (!event.allowAbstain) {
      const responded = Object.keys(results).length;
      if (responded < participants.length) {
        return { 
          success: false, 
          error: `Waiting for ${participants.length - responded} more responses` 
        };
      }
    }
    
    // Resolve the event
    const resolution = event.resolve(results, this);
    
    // Clear player event state
    for (const pid of participants) {
      const player = this.getPlayer(pid);
      if (player) {
        player.pendingEvents.delete(eventId);
        player.clearSelection();
      }
    }
    
    // Handle resolution
    this.activeEvents.delete(eventId);
    
    if (!resolution.silent) {
      this.eventResults.push(resolution);
      this.addLog(resolution.message);
    }
    
    // Push result slide if defined
    if (resolution.slide) {
      this.pushSlide(resolution.slide);
    }
    
    // Send private results (e.g., seer investigations)
    if (resolution.investigations) {
      for (const inv of resolution.investigations) {
        const seer = this.getPlayer(inv.seerId);
        if (seer) {
          seer.send(ServerMsg.EVENT_RESULT, {
            eventId: 'investigate',
            message: inv.privateMessage,
            data: inv,
          });
        }
      }
    }
    
    // Check for linked death (Cupid lovers)
    this.checkLinkedDeaths();
    
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
    const sorted = [...this.activeEvents.entries()]
      .sort((a, b) => a[1].event.priority - b[1].event.priority);
    
    const results = [];
    for (const [eventId] of sorted) {
      const result = this.resolveEvent(eventId);
      results.push({ eventId, ...result });
    }
    
    return { success: true, results };
  }

  // === Win Conditions ===

  checkWinCondition() {
    const alive = this.getAlivePlayers();
    const werewolves = alive.filter(p => p.role.team === Team.WEREWOLF);
    const villagers = alive.filter(p => p.role.team === Team.VILLAGE);
    
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
    
    const winnerName = winner === Team.VILLAGE ? 'VILLAGERS' : 'WEREWOLVES';
    const color = winner === Team.VILLAGE ? '#7eb8da' : '#c94c4c';
    
    this.addLog(`Game over - ${winnerName} win!`);
    
    this.pushSlide({
      type: 'victory',
      winner,
      title: `${winnerName} WIN`,
      subtitle: winner === Team.VILLAGE 
        ? 'All werewolves have been eliminated.'
        : 'The werewolves have taken over.',
      color,
    });
    
    this.broadcastGameState();
  }

  // === Death Handling ===

  killPlayer(playerId, cause) {
    const player = this.getPlayer(playerId);
    if (!player) return false;
    
    player.kill(cause);
    this.addLog(`${player.name} died (${cause})`);
    
    // Check for Hunter passive
    if (player.role.id === 'hunter' && player.role.passives?.onDeath) {
      const result = player.role.passives.onDeath(player, cause, this);
      if (result?.interrupt) {
        this.interruptData = { hunter: player };
        this.startEvent('hunterRevenge');
      }
    }
    
    // Check linked deaths
    this.checkLinkedDeaths();
    
    return true;
  }

  checkLinkedDeaths() {
    for (const player of this.players.values()) {
      if (player.linkedTo && player.isAlive) {
        const linked = this.getPlayer(player.linkedTo);
        if (linked && !linked.isAlive) {
          this.killPlayer(player.id, 'heartbreak');
          this.addLog(`${player.name} died of a broken heart`);
        }
      }
    }
  }

  // === Slide Management ===

  pushSlide(slide, jumpTo = false) {
    const slideWithId = { ...slide, id: Date.now() };
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
    }
  }

  prevSlide() {
    if (this.currentSlideIndex > 0) {
      this.currentSlideIndex--;
      this.broadcastSlides();
    }
  }

  clearSlides() {
    this.slideQueue = [];
    this.currentSlideIndex = -1;
    this.broadcastSlides();
  }

  getCurrentSlide() {
    if (this.currentSlideIndex >= 0 && this.currentSlideIndex < this.slideQueue.length) {
      return this.slideQueue[this.currentSlideIndex];
    }
    return null;
  }

  // === Broadcasting ===

  broadcastGameState() {
    const state = this.getPublicGameState();
    this.broadcast(ServerMsg.GAME_STATE, state);
    
    // Also send private state to each player
    for (const player of this.players.values()) {
      player.send(ServerMsg.PLAYER_STATE, player.getPrivateState());
    }
  }

  broadcastPlayerList() {
    const players = this.getPlayersBySeat().map(p => p.getPublicState());
    this.broadcast(ServerMsg.PLAYER_LIST, players);
  }

  broadcastSlides() {
    const slideData = {
      queue: this.slideQueue,
      currentIndex: this.currentSlideIndex,
      current: this.getCurrentSlide(),
    };
    this.broadcast(ServerMsg.SLIDE_QUEUE, slideData);
    
    if (this.screen) {
      this.sendToScreen(ServerMsg.SLIDE, this.getCurrentSlide());
    }
  }

  sendToScreen(type, payload) {
    if (this.screen && this.screen.readyState === 1) {
      this.screen.send(JSON.stringify({ type, payload }));
    }
  }

  // === State Getters ===

  getPublicGameState() {
    return {
      phase: this.phase,
      dayCount: this.dayCount,
      players: this.getPlayersBySeat().map(p => p.getPublicState()),
      pendingEvents: this.pendingEvents,
      activeEvents: [...this.activeEvents.keys()],
      eventParticipants: this.getEventParticipantMap(),
      eventProgress: this.getEventProgressMap(),
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
