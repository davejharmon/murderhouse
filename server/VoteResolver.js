// server/VoteResolver.js
// Handles vote and custom-event resolution: tally slides, runoff rounds, flow interception.
// Created in Phase 3c, extracted from EventResolver.

import {
  EventId,
  ServerMsg,
  SlideStyle,
} from '../shared/constants.js'
import { str } from './strings.js'

export class VoteResolver {
  constructor(resolver) {
    // resolver = the EventResolver instance that owns this VoteResolver
    this.resolver = resolver
  }

  get game() { return this.resolver.game }

  // ── Tally slide builder ──────────────────────────────────────────────────

  buildTallySlide(eventId, results, event, outcome) {
    const tally = {}
    const voters = {}
    for (const [voterId, targetId] of Object.entries(results)) {
      if (targetId === null) continue
      tally[targetId] = (tally[targetId] || 0) + 1
      if (!voters[targetId]) voters[targetId] = []
      voters[targetId].push(voterId)
    }

    const maxVotes = Math.max(...Object.values(tally), 0)
    const frontrunners = Object.keys(tally).filter(id => tally[id] === maxVotes)
    const isTied = frontrunners.length > 1

    let title = isTied ? str('slides', 'vote.tallyTitleTied') : str('slides', 'vote.tallyTitle')
    let subtitle
    switch (outcome.type) {
      case 'runoff':
        subtitle = str('slides', 'vote.subtitleRunoff')
        break
      case 'random':
        subtitle = str('slides', 'vote.subtitleRandom')
        break
      case 'selected':
        subtitle = str('slides', 'vote.subtitleSelected', { name: outcome.selectedName })
        break
      case 'no-selection':
        subtitle = str('slides', 'vote.subtitleNoSelection')
        break
      default:
        subtitle = str('slides', 'vote.subtitleDefault', { count: Object.keys(tally).length })
    }

    return {
      type: 'voteTally',
      tally,
      voters,
      frontrunners,
      anonymousVoting: event.anonymousVoting ?? false,
      title,
      subtitle,
    }
  }

  // ── Two named resolution paths ───────────────────────────────────────────

  /**
   * Path 1 — Deferred: a flow (e.g. GovernorPardonFlow) intercepts the condemned
   * player before execution. Shows tally, cleans up voters, then hands off to the flow.
   */
  _resolveDeferred(eventId, instance, resolution, interceptingFlow) {
    const { event, results, participants } = instance

    const selectedName = resolution.victim?.name || 'Unknown'
    const tallySlide = this.buildTallySlide(eventId, results, event, { type: 'selected', selectedName })
    this.game.pushSlide(tallySlide, true)

    this.resolver.activeEvents.delete(eventId)
    for (const pid of participants) {
      const player = this.game.getPlayer(pid)
      if (player) {
        player.clearFromEvent(eventId)
        player.syncState(this.game)
      }
    }

    if (eventId === EventId.VOTE) {
      for (const p of this.game.getAlivePlayers()) {
        if (p.hasItem('novote')) this.game.consumeItem(p.id, 'novote')
      }
    }

    this.game.broadcastGameState()
    interceptingFlow.trigger({ voteEventId: eventId, resolution, instance })
    return { success: true, showingTally: true, awaitingPardon: true }
  }

  /**
   * Path 2 — Immediate: no flow intercepts; kill (or reward) is executed right away,
   * tally slide is shown, and win condition is checked.
   */
  _resolveImmediate(eventId, instance, resolution) {
    const { event, results, participants } = instance

    for (const pid of participants) {
      const player = this.game.getPlayer(pid)
      if (player) {
        player.clearFromEvent(eventId)
        player.syncState(this.game)
      }
    }

    this.resolver.activeEvents.delete(eventId)

    if (eventId === EventId.VOTE) {
      for (const p of this.game.getAlivePlayers()) {
        if (p.hasItem('novote')) this.game.consumeItem(p.id, 'novote')
      }
    }

    if (!resolution.silent) {
      this.resolver.eventResults.push(resolution)
      this.game.addLog(resolution.message)
    }

    if (resolution.outcome === 'eliminated' && resolution.victim) {
      this.game.killPlayer(resolution.victim.id, 'eliminated')
    }

    let outcomeInfo
    if (resolution.outcome === 'eliminated' && resolution.victim) {
      outcomeInfo = { type: 'selected', selectedName: resolution.victim.name }
    } else if (resolution.outcome === 'no-kill') {
      outcomeInfo = { type: 'no-selection' }
    } else if (resolution.tally && resolution.message?.includes('randomly')) {
      outcomeInfo = { type: 'random' }
    } else {
      outcomeInfo = {
        type: 'selected',
        selectedName: resolution.victim?.name || resolution.winner?.name || 'Unknown',
      }
    }

    const tallySlide = this.buildTallySlide(eventId, results, event, outcomeInfo)
    this.game.pushSlide(tallySlide, false)

    let resultSlideCount = 0
    if (resolution.slide) {
      if (resolution.slide.type === 'death') {
        const victimId = resolution.victim?.id
        const voterIds = victimId ? tallySlide.voters[victimId] || [] : []
        const slidesBefore = this.game.slideQueue.length
        this.game.queueDeathSlide({ ...resolution.slide, voterIds }, false)
        resultSlideCount = this.game.slideQueue.length - slidesBefore
      } else {
        this.game.pushSlide(resolution.slide, false)
        resultSlideCount = 1
      }
    }

    this.game.currentSlideIndex = this.game.slideQueue.length - resultSlideCount - 1
    this.game.broadcastSlides()

    const winner = this.game.checkWinCondition()
    if (winner) this.game.endGame(winner)

    this.game.broadcastGameState()
    return { success: true, resolution }
  }

  // ── Orchestrator ─────────────────────────────────────────────────────────

  /**
   * Entry point for VOTE and CUSTOM_EVENT resolution.
   * Resolves the event, then dispatches to _resolveDeferred (flow interception or
   * runoff tie) or _resolveImmediate (clear result, no flow).
   */
  showTallyAndDeferResolution(eventId, instance) {
    const { event, results } = instance

    const resolution = event.resolve(results, this.game)

    if (resolution.runoff === true) {
      const tallySlide = this.buildTallySlide(eventId, results, event, { type: 'runoff' })
      this.game.pushSlide(tallySlide, true)
      this.game.addLog(resolution.message)
      return this.triggerRunoff(eventId, resolution.frontrunners)
    }

    const flowContext = { voteEventId: eventId, resolution, instance }
    const interceptingFlow = [...this.game.flows.values()].find(
      f => f.constructor.hooks.includes('onVoteResolution') && f.canTrigger(flowContext),
    )

    if (interceptingFlow) {
      return this._resolveDeferred(eventId, instance, resolution, interceptingFlow)
    }

    return this._resolveImmediate(eventId, instance, resolution)
  }

  // ── Runoff management ────────────────────────────────────────────────────

  triggerRunoff(eventId, frontrunners) {
    const instance = this.resolver.activeEvents.get(eventId)
    if (!instance) {
      return { success: false, error: 'Event not active' }
    }

    instance.runoffCandidates = frontrunners
    instance.runoffRound = (instance.runoffRound || 0) + 1
    instance.results = {}

    let runoffSubtitle = 'Choose who to eliminate'
    if (eventId === EventId.CUSTOM_EVENT && instance.config) {
      const { rewardType, rewardParam } = instance.config
      if (rewardType === 'resurrection') runoffSubtitle = 'Choose who to resurrect'
      else if (rewardType === 'item') runoffSubtitle = `Choose who to give ${rewardParam}`
      else if (rewardType === 'role') runoffSubtitle = `Choose who to elect as ${rewardParam}`
    }

    if (instance.runoffRound >= 2) {
      runoffSubtitle = str('slides', 'vote.runoffFinalWarning')
    }

    this.game.pushSlide(
      {
        type: 'gallery',
        title: str('slides', 'vote.runoffTitle', { n: instance.runoffRound }),
        subtitle: runoffSubtitle,
        playerIds: instance.participants,
        targetsOnly: true,
        activeEventId: eventId,
        style: SlideStyle.NEUTRAL,
        activateRunoff: eventId,
      },
      false,
    )

    this.game.addLog(str('log', 'runoffRound', { name: instance.event.name, round: instance.runoffRound }))
    this.game.broadcastGameState()
    return { success: true, runoff: true }
  }

  _activateRunoff(eventId) {
    const instance = this.resolver.activeEvents.get(eventId)
    if (!instance) return

    const { event, participants } = instance

    for (const pid of participants) {
      const player = this.game.getPlayer(pid)
      if (player) player.clearSelection()
    }

    const runoffParticipants = participants
      .map(pid => this.game.getPlayer(pid))
      .filter(p => p)

    for (const player of runoffParticipants) {
      const targets = event.validTargets(player, this.game)

      if (targets.length === 1) {
        player.currentSelection = targets[0].id
      }

      const baseDescription = instance.config?.description || event.description
      const description = `RUNOFF VOTE (Round ${instance.runoffRound}): ${baseDescription}`

      player.send(ServerMsg.EVENT_PROMPT, {
        eventId,
        eventName: event.name,
        description,
        targets: targets.map(t => t.getPublicState()),
        allowAbstain: event.allowAbstain !== false,
      })
    }

    for (const pid of participants) {
      const player = this.game.getPlayer(pid)
      if (player) player.syncState(this.game)
    }
    this.game.broadcastGameState()
  }
}
