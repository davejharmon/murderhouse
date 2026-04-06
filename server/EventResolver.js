// server/EventResolver.js
// Manages the full event lifecycle: pending events, active events, timers, and resolution.
// Vote/custom-event tally logic lives in VoteResolver (Phase 3c).

import {
  GamePhase,
  ServerMsg,
  EventId,
  ItemId,
  SlideStyle,
} from '../shared/constants.js'
import { str } from './strings.js'
import { getEvent, getEventsForPhase } from './definitions/events.js'
import { getItem } from './definitions/items.js'
import { getRole } from './definitions/roles.js'
import { VoteResolver } from './VoteResolver.js'

export class EventResolver {
  constructor(game) {
    this.game = game
    this.pendingEvents = []
    this.activeEvents = new Map()
    this.eventTimers = new Map()
    this.eventResults = []
    this.customEventConfig = null
    this.vote = new VoteResolver(this)
  }

  reset() {
    // Clear any running event timers
    for (const { timeout } of this.eventTimers.values()) {
      clearTimeout(timeout)
    }
    this.eventTimers = new Map()
    this.pendingEvents = []
    this.activeEvents = new Map()
    this.eventResults = []
    this.customEventConfig = null
  }

  // Called by nextPhase() to clear per-phase event state without full reset
  clearForPhase() {
    this.activeEvents.clear()
    this.eventResults = []
  }

  // ── Pending event management ──────────────────────────────────────────────

  buildPendingEvents() {
    const phaseEvents = getEventsForPhase(this.game.phase)
    this.pendingEvents = []
    this.customEventConfig = null

    for (const event of phaseEvents) {
      if (event.playerInitiated) continue
      if (event.id === EventId.CUSTOM_EVENT) continue
      const participants = this.getEventParticipants(event.id)
      if (participants.length > 0) {
        this.pendingEvents.push(event.id)
      }
    }
  }

  /**
   * Get all participants for an event, combining role-based and item-based participants.
   */
  getEventParticipants(eventId) {
    const event = getEvent(eventId)
    if (!event) return []

    const roleParticipants = event.participants(this.game)

    const itemParticipants = this.game.getAlivePlayers().filter(player => {
      return player.inventory.some(
        item => item.startsEvent === eventId && (item.uses > 0 || item.maxUses === -1),
      )
    })

    const allParticipants = [...roleParticipants]
    for (const player of itemParticipants) {
      if (!allParticipants.find(p => p.id === player.id)) {
        allParticipants.push(player)
      }
    }

    return allParticipants.filter(p => !p.hasItem('coward'))
  }

  // ── Event startup ─────────────────────────────────────────────────────────

  startEvent(eventId) {
    if (eventId === EventId.CUSTOM_EVENT) {
      return this._startCustomEvent()
    }

    const event = getEvent(eventId)
    if (!event) {
      return { success: false, error: 'Event not found' }
    }

    this._assertValidEventDef(event, eventId)

    if (
      event.playerInitiated &&
      event.phase &&
      !event.phase.includes(this.game.phase)
    ) {
      return { success: false, error: `Not available during ${this.game.phase} phase` }
    }

    const participants = this.getEventParticipants(eventId)
    if (participants.length === 0) {
      return { success: false, error: 'No eligible participants' }
    }

    const eventInstance = {
      event,
      results: {},
      participants: participants.map(p => p.id),
      startedAt: Date.now(),
    }

    this.activeEvents.set(eventId, eventInstance)
    this.pendingEvents = this.pendingEvents.filter(id => id !== eventId)

    this._notifyEventParticipants(
      eventId,
      participants.map(p => p.id),
      player => event.validTargets(player, this.game),
      { eventName: event.name, description: event.description, allowAbstain: event.allowAbstain !== false },
    )

    this.game.addLog(str('log', 'eventStarted', { name: event.name }))

    if (eventId === EventId.SHOOT && participants.length > 0) {
      const shooter = participants[0]
      this.game.pushSlide(
        {
          type: 'title',
          title: str('slides', 'misc.drawTitle'),
          subtitle: str('slides', 'misc.drawSubtitle', { name: shooter.name }),
          style: SlideStyle.WARNING,
        },
        true,
      )
    }

    if (eventId === EventId.VOTE) {
      this.game.pushSlide(
        {
          type: 'gallery',
          title: str('slides', 'vote.slideTitle'),
          subtitle: str('events', 'vote.description'),
          playerIds: this.game.getAlivePlayers().map(p => p.id),
          targetsOnly: true,
          activeEventId: eventId,
          style: SlideStyle.NEUTRAL,
        },
        true,
      )
    }

    this.game.broadcastGameState()
    return { success: true }
  }

  // Start (or join) an event on behalf of a single player activating an item.
  startEventForPlayer(eventId, playerId) {
    const event = getEvent(eventId)
    if (!event) return { success: false, error: 'Event not found' }

    const player = this.game.getPlayer(playerId)
    if (!player || !player.isAlive) return { success: false, error: 'Player not eligible' }

    if (event.phase && !event.phase.includes(this.game.phase)) {
      return { success: false, error: `Not available during ${this.game.phase} phase` }
    }

    const notify = () => {
      this._notifyEventParticipants(
        eventId,
        [playerId],
        p => event.validTargets(p, this.game),
        { eventName: event.name, description: event.description, allowAbstain: event.allowAbstain !== false },
      )
      this.game.broadcastGameState()
    }

    if (this.activeEvents.has(eventId)) {
      const instance = this.activeEvents.get(eventId)
      if (!instance.participants.includes(playerId)) {
        instance.participants.push(playerId)
      }
      notify()
      return { success: true }
    }

    this._assertValidEventDef(event, eventId)
    const eventInstance = {
      event,
      results: {},
      participants: [playerId],
      startedAt: Date.now(),
    }
    this.activeEvents.set(eventId, eventInstance)
    this.pendingEvents = this.pendingEvents.filter(id => id !== eventId)
    notify()
    this.game.addLog(str('log', 'eventStarted', { name: event.name }))
    return { success: true }
  }

  startAllEvents() {
    const started = []
    for (const eventId of [...this.pendingEvents]) {
      const result = this.startEvent(eventId)
      if (result.success) {
        started.push(eventId)
      }
    }
    return { success: true, started }
  }

  /**
   * Start an event managed by an InterruptFlow.
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
    } = options

    const eventInstance = {
      event: {
        id: eventId,
        name,
        description,
        verb,
        validTargets: actor => getValidTargets(actor.id),
        allowAbstain,
        playerResolved,
      },
      results: {},
      participants,
      startedAt: Date.now(),
      managedByFlow: true,
    }

    this.activeEvents.set(eventId, eventInstance)

    this._notifyEventParticipants(
      eventId,
      participants,
      player => getValidTargets(player.id),
      { eventName: name, description, allowAbstain },
    )

    this.game.addLog(str('log', 'eventStarted', { name }))
    this.game.broadcastGameState()
    return { success: true }
  }

  /**
   * Create a custom event and add it to pending events.
   */
  createCustomEvent(config) {
    const validation = this.validateCustomEventConfig(config)
    if (!validation.valid) {
      return { success: false, error: validation.error }
    }

    if (this.game.phase !== GamePhase.DAY) {
      return { success: false, error: 'Custom events only available during DAY phase' }
    }

    if (this.activeEvents.has(EventId.CUSTOM_EVENT)) {
      return { success: false, error: 'Custom event already in progress' }
    }

    this.customEventConfig = config

    if (!this.pendingEvents.includes(EventId.CUSTOM_EVENT)) {
      this.pendingEvents.push(EventId.CUSTOM_EVENT)
    }

    this.game.broadcastGameState()
    return { success: true }
  }

  _startCustomEvent() {
    const config = this.customEventConfig
    if (!config) {
      return { success: false, error: 'No custom event config found' }
    }

    if (this.activeEvents.has(EventId.CUSTOM_EVENT)) {
      return { success: false, error: 'Custom event already in progress' }
    }

    const event = getEvent(EventId.CUSTOM_EVENT)
    if (!event) {
      return { success: false, error: 'Custom event not found' }
    }

    const participants = this.getEventParticipants(EventId.CUSTOM_EVENT)
    if (participants.length === 0) {
      return { success: false, error: 'No eligible participants' }
    }

    const eventInstance = {
      event,
      results: {},
      participants: participants.map(p => p.id),
      startedAt: Date.now(),
      config,
      runoffCandidates: [],
      runoffRound: 0,
    }

    this.activeEvents.set(EventId.CUSTOM_EVENT, eventInstance)
    this.pendingEvents = this.pendingEvents.filter(id => id !== EventId.CUSTOM_EVENT)

    this._notifyEventParticipants(
      EventId.CUSTOM_EVENT,
      participants.map(p => p.id),
      player => event.validTargets(player, this.game),
      { eventName: event.name, description: config.description, allowAbstain: event.allowAbstain !== false },
    )

    this.game.addLog(str('log', 'customEventStarted', { description: config.description }))

    const customTargets = config.rewardType === 'resurrection'
      ? [...this.game.players.values()].filter(p => !p.isAlive)
      : this.game.getAlivePlayers()
    const rewardItemDef = config.rewardType === 'item' ? getItem(config.rewardParam) : null
    this.game.pushSlide(
      {
        type: 'gallery',
        title: config.rewardParam
          ? str('slides', 'vote.customTitleNamed', { reward: config.rewardParam.toUpperCase() })
          : str('slides', 'vote.customTitle'),
        subtitle: config.description,
        itemDescription: rewardItemDef?.description || null,
        playerIds: customTargets.map(p => p.id),
        targetsOnly: true,
        activeEventId: EventId.CUSTOM_EVENT,
        style: SlideStyle.NEUTRAL,
      },
      true,
    )

    this.customEventConfig = null
    this.game.broadcastGameState()
    return { success: true }
  }

  validateCustomEventConfig(config) {
    if (!config) {
      return { valid: false, error: 'Configuration required' }
    }

    const { rewardType, rewardParam, description } = config

    if (!['item', 'role', 'resurrection'].includes(rewardType)) {
      return { valid: false, error: 'Invalid reward type' }
    }

    if (rewardType === 'item') {
      const item = getItem(rewardParam)
      if (!item) return { valid: false, error: `Item '${rewardParam}' not found` }
    } else if (rewardType === 'role') {
      const role = getRole(rewardParam)
      if (!role) return { valid: false, error: `Role '${rewardParam}' not found` }
    }

    if (!description || description.trim() === '') {
      return { valid: false, error: 'Description required' }
    }

    return { valid: true }
  }

  // ── Selection recording ──────────────────────────────────────────────────

  recordSelection(playerId, targetId) {
    const player = this.game.getPlayer(playerId)
    if (!player) return { success: false, error: 'Player not found' }

    for (const [eventId, instance] of this.activeEvents) {
      if (instance.participants.includes(playerId) && !(playerId in instance.results)) {
        const effectiveTarget = targetId === '__decline__' ? null : targetId
        instance.results[playerId] = effectiveTarget

        if (instance.managedByFlow) {
          const flow = this.game.flows.get(eventId)
          if (flow) {
            const result = flow.onSelection(playerId, effectiveTarget)
            if (result) {
              this.game._executeFlowResult(result)
              this.game.broadcastGameState()
              return { success: true, eventId, flowResult: result }
            }
          }
          this.game.broadcastGameState()
          return { success: true, eventId }
        }

        if (this.game.shouldBroadcastPackState(eventId, player)) {
          this.game.broadcastPackState()
        }

        if (instance.event.onSelection) {
          const result = instance.event.onSelection(playerId, targetId, this.game)
          if (result?.slide) {
            if (result.slide.type === 'death') {
              this.game.queueDeathSlide(result.slide, true)
            } else {
              this.game.pushSlide(result.slide, true)
            }
          }
          if (result?.message) {
            this.game.addLog(result.message)
          }
        }

        if (instance.event.playerResolved) {
          this.resolveEvent(eventId)
        }

        this.checkEventTimersComplete()
        this.game.broadcastGameState()
        return { success: true, eventId }
      }
    }

    return { success: false, error: 'No active event for player' }
  }

  // ── Timer management ─────────────────────────────────────────────────────

  startEventTimer(eventId, duration) {
    const instance = this.activeEvents.get(eventId)
    if (!instance) {
      return { success: false, error: 'Event not active' }
    }

    this.clearEventTimer(eventId)

    const timeout = setTimeout(() => {
      this.eventTimers.delete(eventId)
      this.resolveEvent(eventId, { force: true })
    }, duration)

    this.eventTimers.set(eventId, {
      timeout,
      endsAt: Date.now() + duration,
    })

    this.game.broadcast(ServerMsg.EVENT_TIMER, { eventId, duration })
    return { success: true }
  }

  startAllEventTimers(duration) {
    const eventIds = [...this.activeEvents.keys()]
    if (eventIds.length === 0) {
      return { success: false, error: 'No active events' }
    }

    const allParticipants = []
    for (const eventId of eventIds) {
      this.startEventTimer(eventId, duration)
      const instance = this.activeEvents.get(eventId)
      if (instance) {
        for (const pid of instance.participants) {
          if (!allParticipants.includes(pid)) allParticipants.push(pid)
        }
      }
    }

    this.game.pushSlide(
      {
        type: 'gallery',
        title: str('slides', 'misc.timesUpTitle'),
        subtitle: str('slides', 'misc.timesUpSubtitle'),
        playerIds: allParticipants,
        targetsOnly: true,
        timerEventId: eventIds[0],
        style: SlideStyle.WARNING,
      },
      true,
    )

    this.game.addLog(str('log', 'timerStarted', { count: eventIds.length }))
    return { success: true }
  }

  clearEventTimer(eventId) {
    const timer = this.eventTimers.get(eventId)
    if (timer) {
      clearTimeout(timer.timeout)
      this.eventTimers.delete(eventId)
      this.game.broadcast(ServerMsg.EVENT_TIMER, { eventId, duration: null })
    }
  }

  pauseEventTimers() {
    for (const [, timer] of this.eventTimers) {
      if (timer.paused) continue
      clearTimeout(timer.timeout)
      timer.remaining = Math.max(0, timer.endsAt - Date.now())
      timer.paused = true
      timer.timeout = null
    }
    this.game.broadcast(ServerMsg.EVENT_TIMER, { paused: true })
    return { success: true }
  }

  resumeEventTimers() {
    for (const [eventId, timer] of this.eventTimers) {
      if (!timer.paused) continue
      timer.paused = false
      timer.endsAt = Date.now() + timer.remaining
      timer.timeout = setTimeout(() => {
        this.clearEventTimer(eventId)
        this.resolveEvent(eventId, { force: true })
      }, timer.remaining)
    }
    for (const [eventId, timer] of this.eventTimers) {
      this.game.broadcast(ServerMsg.EVENT_TIMER, { eventId, duration: timer.remaining })
    }
    return { success: true }
  }

  cancelEventTimers() {
    for (const [, timer] of this.eventTimers) {
      if (timer?.timeout) clearTimeout(timer.timeout)
    }
    this.eventTimers.clear()
    this.game.broadcast(ServerMsg.EVENT_TIMER, { cancelled: true, duration: null })

    const participants = []
    for (const [, instance] of this.activeEvents) {
      for (const pid of instance.participants) {
        if (!participants.includes(pid)) participants.push(pid)
      }
    }
    if (participants.length > 0) {
      this.game.pushSlide({
        type: 'gallery',
        title: this.game.phase === GamePhase.DAY
          ? str('slides', 'phase.dayN.title', { n: this.game.dayCount })
          : str('slides', 'phase.nightN.title', { n: this.game.dayCount }),
        subtitle: '',
        playerIds: participants,
        style: SlideStyle.NEUTRAL,
      })
    }
    this.game.broadcastGameState()
    return { success: true }
  }

  checkEventTimersComplete() {
    for (const [eventId] of this.eventTimers) {
      const instance = this.activeEvents.get(eventId)
      if (!instance) continue
      const { participants, results } = instance
      if (Object.keys(results).length >= participants.length) {
        this.clearEventTimer(eventId)
        this.resolveEvent(eventId)
      }
    }
  }

  // ── Shared event startup helper ──────────────────────────────────────────

  _notifyEventParticipants(eventId, participantIds, getTargets, prompt) {
    for (const pid of participantIds) {
      const player = this.game.getPlayer(pid)
      if (!player) continue
      player.pendingEvents.add(eventId)
      player.clearSelection()
      player.lastEventResult = null
      const targets = getTargets(player)
      if (targets.length === 1) {
        player.currentSelection = targets[0].id
      }
      player.syncState(this.game)
      player.send(ServerMsg.EVENT_PROMPT, {
        eventId,
        targets: targets.map(t => t.getPublicState()),
        ...prompt,
      })
    }
  }

  // ── Event definition validation ──────────────────────────────────────────

  _assertValidEventDef(event, eventId) {
    const VALID_AGGREGATIONS = new Set(['majority', 'individual', 'all'])
    const errors = []
    if (typeof event.resolve !== 'function')     errors.push('resolve must be a function')
    if (typeof event.participants !== 'function') errors.push('participants must be a function')
    if (typeof event.validTargets !== 'function') errors.push('validTargets must be a function')
    if (!VALID_AGGREGATIONS.has(event.aggregation)) {
      errors.push(`aggregation must be one of: ${[...VALID_AGGREGATIONS].join(', ')} (got: ${event.aggregation})`)
    }
    if (errors.length > 0) {
      throw new Error(`[Game] Invalid event definition for "${eventId}": ${errors.join('; ')}`)
    }
  }

  // ── resolveEvent helpers ─────────────────────────────────────────────────

  _checkResponsesComplete(force, event, results, participants) {
    if (force || event.allowAbstain) return null
    const pending = participants.length - Object.keys(results).length
    return pending > 0 ? `Waiting for ${pending} more responses` : null
  }

  _applyRoleblocks(results, eventId) {
    if (eventId === EventId.BLOCK) return []
    const blocked = []
    for (const actorId of Object.keys(results)) {
      const actor = this.game.getPlayer(actorId)
      if (actor?.isRoleblocked) {
        const originalTargetId = results[actorId]
        if (originalTargetId !== null) {
          blocked.push({ actorId, originalTargetId })
        }
        results[actorId] = null
      }
    }
    return blocked
  }

  _cleanupParticipants(participants, eventId, results) {
    for (const pid of participants) {
      const player = this.game.getPlayer(pid)
      if (!player) continue
      player.syncState(this.game)
      player.clearFromEvent(eventId)
      if (results[pid] !== undefined && results[pid] !== null) {
        const grantingItem = player.inventory.find(
          item => item.startsEvent === eventId && item.uses > 0,
        )
        if (grantingItem) this.game.consumeItem(pid, grantingItem.id)
      }
    }
  }

  _commitResolution(eventId, resolution) {
    this.activeEvents.delete(eventId)
    this.clearEventTimer(eventId)
    if (!resolution.silent) {
      this.eventResults.push(resolution)
      this.game.addLog(resolution.message)
    }
    if (resolution.slide) {
      const jumpTo = resolution.immediateSlide !== false
      if (resolution.slide.type === 'death') {
        this.game.queueDeathSlide(resolution.slide, jumpTo)
      } else {
        this.game.pushSlide(resolution.slide, jumpTo)
      }
    }
  }

  _dispatchPrivateResults(resolution) {
    if (!resolution.investigations) return
    for (const inv of resolution.investigations) {
      const seeker = this.game.getPlayer(inv.seekerId)
      if (seeker) {
        seeker.lastEventResult = { message: inv.privateMessage, critical: true }
        seeker.send(ServerMsg.EVENT_RESULT, {
          eventId: EventId.INVESTIGATE,
          message: inv.privateMessage,
          data: inv,
        })
      }
    }
  }

  // ── Main resolve ─────────────────────────────────────────────────────────

  resolveEvent(eventId, { force = false } = {}) {
    const instance = this.activeEvents.get(eventId)
    if (!instance) return { success: false, error: 'Event not active' }

    const { event, results, participants } = instance

    const responseError = this._checkResponsesComplete(force, event, results, participants)
    if (responseError) return { success: false, error: responseError }

    if (eventId === EventId.VOTE || eventId === EventId.CUSTOM_EVENT) {
      return this.vote.showTallyAndDeferResolution(eventId, instance)
    }

    const blockedPairs = this._applyRoleblocks(results, eventId)

    const ROLEBLOCK_VERBS = {
      [EventId.KILL]: 'kill',
      [EventId.VIGIL]: 'shoot',
      [EventId.PROTECT]: 'protect',
      [EventId.INVESTIGATE]: 'investigate',
      [EventId.CLEAN]: 'clean',
      [EventId.POISON]: 'poison',
      [EventId.JAIL]: 'jail',
      [EventId.INJECT]: 'inject',
    }
    const roleblockVerb = ROLEBLOCK_VERBS[eventId]
    if (roleblockVerb && blockedPairs.length > 0) {
      for (const { actorId, originalTargetId } of blockedPairs) {
        const actor = this.game.getPlayer(actorId)
        const target = this.game.getPlayer(originalTargetId)
        if (actor && target) {
          this.game.addLog(str('log', 'roleblockFailed', {
            name: actor.getNameWithEmoji(), verb: roleblockVerb, target: target.getNameWithEmoji(),
          }))
        }
      }
    }

    const resolution = event.resolve(results, this.game)

    if (resolution.runoff === true) {
      this.game.addLog(resolution.message)
      return this.vote.triggerRunoff(eventId, resolution.frontrunners)
    }

    this._cleanupParticipants(participants, eventId, results)
    this._commitResolution(eventId, resolution)
    this._dispatchPrivateResults(resolution)

    if (this.game.phase === GamePhase.NIGHT) {
      this.game._processPoisonDeaths()
    }

    const winner = this.game.checkWinCondition()
    if (winner) this.game.endGame(winner)

    this.game.broadcastGameState()
    return { success: true, resolution }
  }

  resolveAllEvents() {
    const sorted = [...this.activeEvents.entries()].sort(
      (a, b) => a[1].event.priority - b[1].event.priority,
    )

    const slidesBefore = this.game.slideQueue.length

    const results = []
    for (const [eventId] of sorted) {
      const result = this.resolveEvent(eventId)
      results.push({ eventId, ...result })
    }

    if (this.game.phase === GamePhase.NIGHT) {
      this.game._processPoisonDeaths()
    }

    const newSlides = this.game.slideQueue.slice(slidesBefore)
    if (newSlides.length > 0 && this.game.currentSlideIndex > slidesBefore) {
      this.game.currentSlideIndex = slidesBefore
    }
    const deathSlides = newSlides.filter(s => s.type === 'death' || s._flowSlide || s._slidePriority)
    const tailSlides = newSlides.filter(s => s.type !== 'death' && !s._flowSlide && !s._slidePriority)
    if (deathSlides.length > 2) {
      const groups = []
      let cur = []
      for (const slide of deathSlides) {
        if (cur.length > 0 && slide.playerId && cur[0].playerId && slide.playerId !== cur[0].playerId
            && !slide._flowSlide) {
          groups.push(cur)
          cur = []
        }
        cur.push(slide)
      }
      if (cur.length > 0) groups.push(cur)

      if (groups.length >= 2) {
        const groupPriority = g => Math.max(...g.map(s => s._slidePriority ?? 0))
        for (let i = groups.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1))
          if (groupPriority(groups[i]) === groupPriority(groups[j])) {
            ;[groups[i], groups[j]] = [groups[j], groups[i]]
          }
        }
        groups.sort((a, b) => groupPriority(a) - groupPriority(b))
        this.game.slideQueue.splice(slidesBefore, newSlides.length, ...groups.flat(), ...tailSlides)
        this.game.broadcastSlides()
      }
    }

    if (this.game.phase === GamePhase.NIGHT && this.game.slideQueue.length === this.game._nightStartSlideCount) {
      this.game.pushSlide({
        type: 'title',
        title: str('slides', 'phase.timePasses.title'),
        subtitle: str('slides', 'phase.timePasses.subtitle'),
        style: SlideStyle.NEUTRAL,
      })
    }

    return { success: true, results }
  }

  skipEvent(eventId) {
    const instance = this.activeEvents.get(eventId)
    if (!instance) {
      return { success: false, error: 'Event not active' }
    }

    const { event, participants } = instance

    for (const pid of participants) {
      const player = this.game.getPlayer(pid)
      if (player) player.clearFromEvent(eventId)
    }

    this.activeEvents.delete(eventId)
    this.clearEventTimer(eventId)

    this.game.addLog(str('log', 'eventSkipped', { name: event.name }))
    this.game.broadcastGameState()
    return { success: true }
  }

  resetEvent(eventId) {
    const instance = this.activeEvents.get(eventId)
    if (!instance) {
      return { success: false, error: 'Event not active' }
    }

    const { event, participants } = instance

    for (const pid of participants) {
      const player = this.game.getPlayer(pid)
      if (player) player.clearFromEvent(eventId)
    }

    this.activeEvents.delete(eventId)
    this.clearEventTimer(eventId)
    this.pendingEvents.push(eventId)

    this.game.addLog(str('log', 'eventReset', { name: event.name }))
    this.game.broadcastGameState()
    return { success: true }
  }

  // Vote tally, runoff, and deferred resolution live in this.vote (VoteResolver).
  // _activateRunoff proxy kept for the SlideManager → Game._activateRunoff call chain.
  _activateRunoff(eventId) { return this.vote._activateRunoff(eventId) }

  // ── State getters (used by getGameState) ─────────────────────────────────

  getEventParticipantMap() {
    const map = {}
    for (const [eventId, instance] of this.activeEvents) {
      map[eventId] = instance.participants
    }
    return map
  }

  getEventProgressMap() {
    const map = {}
    for (const [eventId, instance] of this.activeEvents) {
      const responded = Object.keys(instance.results).length
      map[eventId] = {
        responded,
        total: instance.participants.length,
        complete: responded === instance.participants.length,
      }
    }
    return map
  }

  getEventMetadataMap() {
    const map = {}
    for (const [eventId, instance] of this.activeEvents) {
      map[eventId] = {
        playerResolved: instance.event.playerResolved || false,
        playerInitiated: instance.event.playerInitiated || false,
      }
    }
    return map
  }

  getEventRespondentsMap() {
    const map = {}
    for (const [eventId, instance] of this.activeEvents) {
      map[eventId] = Object.keys(instance.results)
    }
    return map
  }
}
