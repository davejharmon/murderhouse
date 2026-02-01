// server/Game.js
// Core game state machine and logic

import {
  GamePhase,
  Team,
  PlayerStatus,
  ServerMsg,
  SlideStyle,
  MIN_PLAYERS,
  MAX_PLAYERS,
} from '../shared/constants.js';
import { Player, resetSeatCounter } from './Player.js';
import { getRole, roleDistribution } from './definitions/roles.js';
import { getEvent, getEventsForPhase } from './definitions/events.js';
import { getItem } from './definitions/items.js';
import { HunterRevengeFlow, GovernorPardonFlow } from './flows/index.js';

export class Game {
  constructor(broadcast) {
    this.broadcast = broadcast; // Function to send to all clients
    this.host = null;
    this.slideIdCounter = 0; // Unique ID counter for slides
    this.screen = null;
    this.playerCustomizations = new Map(); // Persist player names/portraits across resets

    // Initialize interrupt flows (these persist across resets)
    this.flows = new Map([
      [HunterRevengeFlow.id, new HunterRevengeFlow(this)],
      [GovernorPardonFlow.id, new GovernorPardonFlow(this)],
    ]);

    this.reset();
  }

  reset() {
    // Save player customizations before clearing (if players exist)
    if (this.players) {
      for (const [playerId, player] of this.players) {
        this.playerCustomizations.set(playerId, {
          name: player.name,
          portrait: player.portrait,
        });
      }
    }

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
    });
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
      (a, b) => a.seatNumber - b.seatNumber
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

    // Assign roles
    this.assignRoles();

    // Start day 1
    this.phase = GamePhase.DAY;
    this.dayCount = 1;

    // Send role reveals to each player
    for (const player of this.players.values()) {
      player.syncState(this);
    }

    // Build pending events for this phase
    this.buildPendingEvents();

    this.addLog('Game started — Day 1');
    this.pushSlide({
      type: 'gallery',
      title: 'DAY 1',
      subtitle: 'The game begins.',
      playerIds: this.getAlivePlayers().map(p => p.id),
      style: SlideStyle.NEUTRAL,
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
    // Clear protection and player event state
    for (const player of this.players.values()) {
      player.isProtected = false;
      player.clearSelection();
      player.pendingEvents.clear();
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
        playerIds: this.getAlivePlayers().map(p => p.id),
        style: SlideStyle.NEUTRAL,
      });
    } else if (this.phase === GamePhase.NIGHT) {
      this.phase = GamePhase.DAY;
      this.dayCount++;
      this.addLog(`Day ${this.dayCount} begins`);
      this.pushSlide({
        type: 'gallery',
        title: `DAY ${this.dayCount}`,
        subtitle: 'The sun rises.',
        playerIds: this.getAlivePlayers().map(p => p.id),
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
      if (event.id === 'customEvent') continue;

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
        (item) => item.startsEvent === eventId && item.uses > 0
      );
    });

    // Combine and deduplicate by player ID
    const allParticipants = [...roleParticipants];
    for (const player of itemParticipants) {
      if (!allParticipants.find((p) => p.id === player.id)) {
        allParticipants.push(player);
      }
    }

    return allParticipants;
  }

  startEvent(eventId) {
    // Special handling for customEvent - requires stored config
    if (eventId === 'customEvent') {
      return this._startCustomEvent();
    }

    const event = getEvent(eventId);
    if (!event) {
      return { success: false, error: 'Event not found' };
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
    if (eventId === 'shoot' && participants.length > 0) {
      const shooter = participants[0];
      this.pushSlide(
        {
          type: 'title',
          title: 'DRAW!',
          subtitle: `${shooter.name} is searching for a target...`,
          style: SlideStyle.WARNING,
        },
        true
      ); // Jump to this slide immediately
    }

    // Show slide when vote events start
    if (eventId === 'vote') {
      this.pushSlide(
        {
          type: 'title',
          title: 'ELIMINATION VOTE',
          subtitle: 'Choose who to eliminate',
          style: SlideStyle.NEUTRAL,
        },
        true
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
    if (this.activeEvents.has('customEvent')) {
      return { success: false, error: 'Custom event already in progress' };
    }

    // Store the config (replaces any existing pending config)
    this.customEventConfig = config;

    // Add to pending if not already there
    if (!this.pendingEvents.includes('customEvent')) {
      this.pendingEvents.push('customEvent');
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
    if (this.activeEvents.has('customEvent')) {
      return { success: false, error: 'Custom event already in progress' };
    }

    const event = getEvent('customEvent');
    if (!event) {
      return { success: false, error: 'Custom event not found' };
    }

    const participants = this.getEventParticipants('customEvent');
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

    this.activeEvents.set('customEvent', eventInstance);
    this.pendingEvents = this.pendingEvents.filter((id) => id !== 'customEvent');

    // Notify participants with custom description
    for (const player of participants) {
      player.pendingEvents.add('customEvent');
      player.clearSelection();

      const targets = event.validTargets(player, this);

      // Send updated player state so client clears abstained/confirmed flags
      player.syncState(this);

      player.send(ServerMsg.EVENT_PROMPT, {
        eventId: 'customEvent',
        eventName: event.name,
        description: config.description,
        targets: targets.map((t) => t.getPublicState()),
        allowAbstain: event.allowAbstain !== false,
      });
    }

    this.addLog(`Custom event started — ${config.description}`);

    // Show slide when custom event starts
    this.pushSlide(
      {
        type: 'title',
        title: 'CUSTOM EVENT',
        subtitle: config.description,
        style: SlideStyle.NEUTRAL,
      },
      true
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
        player.confirmedSelection = targetId;

        // Check if this event is managed by a flow
        if (instance.managedByFlow) {
          const flow = this.flows.get(eventId);
          if (flow) {
            const result = flow.onSelection(playerId, targetId);
            if (result) {
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
          error: `Waiting for ${
            participants.length - responded
          } more responses`,
        };
      }
    }

    // For vote/customEvent events, show tally slide first and defer resolution
    if (eventId === 'vote' || eventId === 'customEvent') {
      return this.showTallyAndDeferResolution(eventId, instance);
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
        player.pendingEvents.delete(eventId);
        player.clearSelection();

        // Check if player participated via an item (not just their role)
        // Only consume if they actually submitted a result (not abstained)
        if (results[pid] !== undefined && results[pid] !== null) {
          const grantingItem = player.inventory.find(
            (item) => item.startsEvent === eventId && item.uses > 0
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
    const sorted = [...this.activeEvents.entries()].sort(
      (a, b) => a[1].event.priority - b[1].event.priority
    );

    const results = [];
    for (const [eventId] of sorted) {
      const result = this.resolveEvent(eventId);
      results.push({ eventId, ...result });
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
        player.pendingEvents.delete(eventId);
        player.clearSelection();
      }
    }

    // Remove from active events
    this.activeEvents.delete(eventId);

    this.addLog(`${event.name} skipped`);
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
    const frontrunners = Object.keys(tally).filter(id => tally[id] === maxVotes);
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
      const tallySlide = this.buildTallySlide(eventId, results, event, { type: 'runoff' });
      this.pushSlide(tallySlide, true);
      this.addLog(resolution.message);
      return this.triggerRunoff(eventId, resolution.frontrunners);
    }

    // Check if governor pardon flow should trigger
    const pardonFlow = this.flows.get('pardon');
    if (pardonFlow.canTrigger({ voteEventId: eventId, resolution, instance })) {
      const selectedName = resolution.victim?.name || 'Unknown';
      const tallySlide = this.buildTallySlide(eventId, results, event, { type: 'selected', selectedName });
      this.pushSlide(tallySlide, true);

      // Remove vote from active events before starting pardon
      this.activeEvents.delete(eventId);
      this.broadcastGameState();

      // Start the pardon flow (handles execution, slides, cleanup)
      pardonFlow.trigger({ voteEventId: eventId, resolution, instance });
      return { success: true, showingTally: true, awaitingPardon: true };
    }

    // === Execute immediately (no deferred resolution) ===

    // Clear player event state
    for (const pid of participants) {
      const player = this.getPlayer(pid);
      if (player) {
        player.pendingEvents.delete(eventId);
        player.clearSelection();
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
      outcomeInfo = { type: 'selected', selectedName: resolution.victim?.name || 'Unknown' };
    }

    // Queue slides: tally first, then result
    const tallySlide = this.buildTallySlide(eventId, results, event, outcomeInfo);
    this.pushSlide(tallySlide, false);

    if (resolution.slide) {
      // Use queueDeathSlide for death slides (handles hunter revenge automatically)
      if (resolution.slide.type === 'death') {
        // Add voter IDs to death slide for vote results (shows who voted for elimination)
        const victimId = resolution.victim?.id;
        const voterIds = victimId ? tallySlide.voters[victimId] || [] : [];
        this.queueDeathSlide({ ...resolution.slide, voterIds }, false);
      } else {
        this.pushSlide(resolution.slide, false);
      }
    }

    // Jump to tally (host advances to see result)
    this.currentSlideIndex = this.slideQueue.length - (resolution.slide ? 2 : 1);
    this.broadcastSlides();

    // Check for linked deaths (already handled in killPlayer, but ensure it runs)
    // Note: killPlayer already calls checkLinkedDeaths()

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

    const { event, participants } = instance;

    // Set runoff state
    instance.runoffCandidates = frontrunners;
    instance.runoffRound = (instance.runoffRound || 0) + 1;
    instance.results = {}; // Clear previous votes

    // Clear player selections
    for (const pid of participants) {
      const player = this.getPlayer(pid);
      if (player) {
        player.clearSelection();
      }
    }

    // Re-notify participants with updated targets
    const runoffParticipants = participants
      .map((pid) => this.getPlayer(pid))
      .filter((p) => p);

    for (const player of runoffParticipants) {
      const targets = event.validTargets(player, this);

      // Auto-select if only one target
      if (targets.length === 1) {
        player.currentSelection = targets[0].id;
      }

      // Get description (use custom description if available)
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

    this.addLog(`${event.name} runoff — Round ${instance.runoffRound}`);
    this.broadcastGameState();

    return { success: true, runoff: true };
  }

  // === Win Conditions ===

  checkWinCondition() {
    const alive = this.getAlivePlayers();
    const werewolves = alive.filter((p) => p.role.team === Team.WEREWOLF);
    const villagers = alive.filter((p) => p.role.team === Team.VILLAGE);

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

    this.addLog(`Game over — ${winnerName} win!`);

    this.pushSlide({
      type: 'victory',
      winner,
      title: `${winnerName} WIN`,
      subtitle:
        winner === Team.VILLAGE
          ? 'All werewolves have been eliminated.'
          : 'The werewolves have taken over.',
      style: winner === Team.VILLAGE ? SlideStyle.POSITIVE : SlideStyle.HOSTILE,
    }, false); // Queue after death slide, don't jump to it

    this.broadcastGameState();
  }

  // === Death Handling ===

  killPlayer(playerId, cause) {
    const player = this.getPlayer(playerId);
    if (!player) return false;

    player.kill(cause);

    // Check for onDeath passives
    if (player.role.passives?.onDeath) {
      const deathResult = player.role.passives.onDeath(player, cause, this);

      // Check if any flow should trigger
      for (const flow of this.flows.values()) {
        if (flow.canTrigger({ player, cause, deathResult })) {
          flow.trigger({ player, cause, deathResult });
          break; // Only one interrupt flow at a time
        }
      }

      // Handle non-interrupt results (like Alpha promotion message)
      if (deathResult?.message && !deathResult.interrupt) {
        this.addLog(deathResult.message);
        // Broadcast pack state so all werewolves see new roles
        if (deathResult.message.includes('Alpha')) {
          this.broadcastPackState();
        }
      }
    }

    // Check linked deaths
    this.checkLinkedDeaths();

    return true;
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

  checkLinkedDeaths() {
    for (const player of this.players.values()) {
      if (player.linkedTo && player.isAlive) {
        const linked = this.getPlayer(player.linkedTo);
        if (linked && !linked.isAlive) {
          this.killPlayer(player.id, 'heartbreak');
          this.addLog(`${player.getNameWithEmoji()} died of heartbreak`);
          // Queue heartbreak death slide (queueDeathSlide handles hunter revenge automatically)
          this.queueDeathSlide(this.createDeathSlide(player, 'heartbreak'), false);
        }
      }
    }
  }

  // === Slide Management ===

  // Centralized death slide queuing - handles hunter revenge follow-up automatically
  queueDeathSlide(slide, jumpTo = true) {
    // Push the death slide
    this.pushSlide(slide, jumpTo);

    // Automatically queue hunter revenge announcement if flow is active
    const hunterFlow = this.flows.get('hunterRevenge');
    if (hunterFlow?.phase === 'active' && hunterFlow?.state?.pendingSlide) {
      hunterFlow.pushPendingSlide();
    }
  }

  // Create a death slide for a given cause (used when events don't provide custom slides)
  createDeathSlide(player, cause) {
    const teamDisplayNames = { village: 'VILLAGER', werewolf: 'WEREWOLF', neutral: 'INDEPENDENT' };
    const teamName = teamDisplayNames[player.role?.team] || 'PLAYER';

    const titles = {
      eliminated: `${teamName} ELIMINATED`,
      werewolf: `${teamName} MURDERED`,
      vigilante: `${teamName} KILLED`,
      shot: `${teamName} KILLED`,
      hunter: `${teamName} KILLED`,
      heartbreak: `${teamName} HEARTBROKEN`,
      host: `${teamName} REMOVED`,
    };

    const subtitles = {
      eliminated: player.name,
      werewolf: player.name,
      vigilante: `${player.name} was killed in the night`,
      shot: `${player.name} was shot`,
      hunter: `${player.name} was killed`,
      heartbreak: `${player.name} died of a broken heart`,
      host: `${player.name} was removed by the host`,
    };

    return {
      type: 'death',
      playerId: player.id,
      title: titles[cause] || `${teamName} DEAD`,
      subtitle: subtitles[cause] || player.name,
      revealRole: true,
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

    // Push current phase slide
    if (this.phase === GamePhase.DAY) {
      this.pushSlide({
        type: 'gallery',
        title: `DAY ${this.dayCount}`,
        subtitle: 'The sun rises.',
        playerIds: this.getAlivePlayers().map(p => p.id),
        style: SlideStyle.NEUTRAL,
      });
    } else if (this.phase === GamePhase.NIGHT) {
      this.pushSlide({
        type: 'gallery',
        title: `NIGHT ${this.dayCount}`,
        subtitle: 'Close your eyes... just kidding.',
        playerIds: this.getAlivePlayers().map(p => p.id),
        style: SlideStyle.NEUTRAL,
      });
    } else if (this.phase === GamePhase.LOBBY) {
      this.pushSlide({
        type: 'gallery',
        title: 'LOBBY',
        subtitle: 'Waiting for game to start',
        playerIds: [...this.players.values()].map(p => p.id),
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
      this.getGameState({ audience: 'host' })
    );

    // Screen gets public state
    this.sendToScreen(
      ServerMsg.GAME_STATE,
      publicState
    );
  }

  broadcastPlayerList() {
    const players = this.getPlayersBySeat().map((p) => p.getPublicState());
    this.broadcast(ServerMsg.PLAYER_LIST, players);
  }

  // Check if pack state should be broadcast for this event/player combination
  shouldBroadcastPackState(eventId, player) {
    return (
      (eventId === 'hunt' || eventId === 'kill') &&
      player?.role?.team === Team.WEREWOLF
    );
  }

  // Broadcast pack state to all werewolves (for real-time hunt updates)
  broadcastPackState() {
    const werewolves = this.getAlivePlayers().filter(
      (p) => p.role && p.role.team === Team.WEREWOLF
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

    if (this.screen) {
      this.sendToScreen(ServerMsg.SLIDE, currentSlide);
    }
  }

  sendToScreen(type, payload) {
    if (this.screen && this.screen.readyState === 1) {
      this.screen.send(JSON.stringify({ type, payload }));
    }
  }

  sendToHost(type, payload) {
    if (this.host && this.host.readyState === 1) {
      this.host.send(JSON.stringify({ type, payload }));
    }
  }

  // === State Getters ===

  getGameState({ audience = 'public' } = {}) {
    const players = this.getPlayersBySeat().map((p) => {
      if (audience === 'host') {
        return p.getPrivateState();
      }

      return p.getPublicState();
    });

    // Count total werewolves (both alive and dead)
    const totalWerewolves = [...this.players.values()].filter(
      (p) => p.role && p.role.team === Team.WEREWOLF
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
