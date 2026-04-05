// server/DisplayStateBuilder.js
// Builds the display state object sent to player terminals (TinyScreen / ESP32).
// Extracted from Player.js to keep the Player model focused on game state.
//
// Usage:
//   new DisplayStateBuilder(player).build(game, eventContext, displayRole)

import {
  Team,
  GamePhase,
  RoleId,
  EventId,
  ItemId,
  LedState,
  DisplayStyle,
  StatusLed,
  IconState,
} from '../shared/constants.js'
import { getEvent } from './definitions/events.js'
import { getItem } from './definitions/items.js'

// Returns the best-fitting role name within maxChars: full name if it fits,
// otherwise shortName (truncated to maxChars if necessary).
function fitRoleName(role, maxChars) {
  const full = role.name.toUpperCase()
  if (full.length <= maxChars) return full
  return (role.shortName || role.name).toUpperCase().substring(0, maxChars)
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
}

function getEventActions(eventId) {
  return EVENT_ACTIONS[eventId] || { confirm: 'CONFIRM', abstain: 'ABSTAIN', prompt: 'SELECT SOMEONE' }
}

export class DisplayStateBuilder {
  constructor(player) {
    this.player = player
    // Temporary role override for this render pass (e.g. amateur displays as seeker)
    this.displayRoleOverride = null
  }

  /**
   * Build the display state for the player's current game situation.
   * @param {Game} game
   * @param {Object|null} eventContext - Optional { eventId, eventName, allowAbstain }
   * @param {Object|null} displayRole - Role override (e.g. disguised role)
   * @returns {Object} Display state with line1, line2, line3, leds, statusLed, icons
   */
  build(game, eventContext = null, displayRole = null) {
    const p = this.player
    const phase = game?.phase
    const dayCount = game?.dayCount || 0
    const hasActiveEvent = p.pendingEvents.size > 0

    // Get current event info
    const activeEventId = hasActiveEvent ? [...p.pendingEvents][0] : null
    const activeEvent = activeEventId ? game?.activeEvents?.get(activeEventId) : null
    // Use displayName when rendering for the player themselves (e.g. amateur's stumble → "Investigate")
    const eventName =
      (displayRole && activeEvent?.event?.displayName) ||
      activeEvent?.event?.name ||
      eventContext?.eventName ||
      null

    this.displayRoleOverride = displayRole
    try {
      return this._buildDisplay(game, {
        phase,
        dayCount,
        hasActiveEvent,
        activeEventId,
        eventName,
        eventContext,
      })
    } finally {
      this.displayRoleOverride = null
    }
  }

  /**
   * Build the display object based on current state.
   * Priority-ordered dispatcher — each state extracted to its own method.
   */
  _buildDisplay(game, ctx) {
    const p = this.player
    const { phase, hasActiveEvent, activeEventId, eventName } = ctx

    const getLine1 = (evtName = null, evtId = null) =>
      this._getLine1(phase, ctx.dayCount, evtName, evtId)
    const phaseLed = phase === GamePhase.DAY ? StatusLed.DAY : StatusLed.NIGHT

    // Derive confirmed/abstained from single source of truth
    const activeResult = p.getActiveResult(game)
    const isAbstained = activeResult?.abstained ?? false
    const confirmedTargetId = activeResult && !activeResult.abstained ? activeResult.targetId : null

    // If player has confirmed/abstained on current event but has more pending events,
    // advance to the next unresolved event instead of showing the locked/abstained screen.
    let displayEventId = activeEventId
    let displayEventName = eventName
    let displayConfirmedId = confirmedTargetId
    let displayConfirmedNames = null
    let advancedToNext = false
    if ((isAbstained || confirmedTargetId) && p.pendingEvents.size > 1) {
      for (const eid of p.pendingEvents) {
        const inst = game?.activeEvents?.get(eid)
        if (inst && !(p.id in inst.results)) {
          displayEventId = eid
          const evt = inst.event
          displayEventName = (this.displayRoleOverride && evt?.displayName) || evt?.name || null
          advancedToNext = true
          break
        }
      }
      // All events resolved: collect all confirmed target names for summary display
      if (!advancedToNext) {
        const allTargetNames = []
        for (const eid of p.pendingEvents) {
          const inst = game?.activeEvents?.get(eid)
          if (inst && p.id in inst.results) {
            const tid = inst.results[p.id]
            if (tid) {
              const t = game.getPlayer(tid)
              if (t) allTargetNames.push(t.name.toUpperCase())
            }
          }
        }
        displayConfirmedId = '__summary__'
        displayConfirmedNames = allTargetNames
      }
    }

    // Calibration override — highest priority when active
    if (game._calibration?.playerIds.includes(String(p.id))) {
      return this._displayCalibration(game._calibration)
    }

    // Priority-ordered state dispatch
    if (phase === GamePhase.LOBBY) return this._displayLobby(getLine1)
    if (phase === GamePhase.GAME_OVER) return this._displayGameOver(getLine1)
    if (!p.isAlive && !hasActiveEvent) return this._displayDead(getLine1, ctx.dayCount, phase)

    // Only show confirmed/abstained if there's no next event to advance to
    if (!advancedToNext) {
      if (isAbstained) return this._displayAbstained(getLine1, displayEventName, displayEventId)
      if (displayConfirmedNames) {
        // Multi-event summary: show all confirmed targets
        const summaryText = displayConfirmedNames.join('  ')
        return this._display(
          { left: getLine1(), right: '' },
          { text: summaryText, style: DisplayStyle.LOCKED },
          { text: 'Selection locked' },
          { yes: LedState.OFF, no: LedState.OFF },
          StatusLed.LOCKED,
          { activeEventId: displayEventId }
        )
      }
      if (displayConfirmedId)
        return this._displayConfirmed(
          game,
          getLine1,
          displayEventName,
          displayEventId,
          displayConfirmedId
        )
    }

    // When advancing to next event, always show fresh target selection (no stale selection)
    if (advancedToNext)
      return this._displayEventNoSelection(game, ctx, getLine1, displayEventId, displayEventName)
    if (hasActiveEvent && p.currentSelection)
      return this._displayEventWithSelection(game, ctx, getLine1, displayEventId, displayEventName)
    if (hasActiveEvent)
      return this._displayEventNoSelection(game, ctx, getLine1, displayEventId, displayEventName)

    // Vote is active but player is excluded (novote, coward, or any other reason)
    if (
      p.isAlive &&
      game.activeEvents?.has(EventId.VOTE) &&
      !p.pendingEvents.has(EventId.VOTE)
    ) {
      return this._displayVoteLocked(getLine1)
    }

    if (p.lastEventResult) return this._displayEventResult(getLine1, phaseLed)

    // Coward: blank lines, just the label, no icons, yellow neopixel
    if (p.hasItem(ItemId.COWARD)) {
      const d = this._display(
        { left: '', right: '' },
        { text: 'COWARD', style: DisplayStyle.NORMAL },
        { text: '' },
        { yes: LedState.OFF, no: LedState.OFF },
        StatusLed.COWARD
      )
      d.icons = []
      return d
    }

    // Poisoned players don't know they're poisoned — no display notification

    // Dynamically compute packmate tip for cell members (reflects living members)
    if (p.role?.team === Team.CELL) {
      const packmates = game
        .getAlivePlayers()
        .filter((m) => m.id !== p.id && m.role.team === Team.CELL)
      const cellNames = [p.name, ...packmates.map((m) => m.name)].join(', ')
      if (packmates.length === 0) {
        p.tutorialTip = `CELL: ${p.name}`
      } else {
        // Non-alpha idle during KILL: show alpha's current/confirmed pick
        const killInstance = game.activeEvents?.get(EventId.KILL)
        if (killInstance && p.role.id !== RoleId.ALPHA) {
          const alpha = packmates.find((m) => m.role.id === RoleId.ALPHA)
          if (alpha) {
            const alphaResult = alpha.getActiveResult(game)
            const alphaPick =
              alphaResult && !alphaResult.abstained
                ? alphaResult.targetId
                : alpha.currentSelection
            if (alphaPick) {
              const targetName = game.getPlayer(alphaPick)?.name || 'Unknown'
              p.tutorialTip = `CELL: ${targetName.toUpperCase()}`
            } else {
              p.tutorialTip = `CELL: ${cellNames}`
            }
          } else {
            p.tutorialTip = `CELL: ${cellNames}`
          }
        } else {
          p.tutorialTip = `CELL: ${cellNames}`
        }
      }
    }

    return this._displayIdleScroll(getLine1, phaseLed, game)
  }

  // --- Display state methods ---

  _displayCalibration(cal) {
    const remaining = Math.max(0, Math.ceil((cal.startTime + cal.duration - Date.now()) / 1000))
    let line2Text, line3Text
    if (cal.phase === 'resting') {
      line2Text = `RESTING... ${remaining}s`
      line3Text = 'Sit still'
    } else if (cal.phase === 'elevated') {
      line2Text = `ELEVATED... ${remaining}s`
      line3Text = 'Breathe fast'
    } else {
      line2Text = 'COMPLETE'
      line3Text = 'Stand by'
    }
    return this._display(
      { left: 'CALIBRATION', right: '' },
      { text: line2Text, style: DisplayStyle.NORMAL },
      { text: line3Text },
      { yes: LedState.OFF, no: LedState.OFF },
      StatusLed.LOBBY
    )
  }

  _displayLobby(getLine1) {
    return this._display(
      { left: getLine1(), right: '' },
      { text: 'WAITING', style: DisplayStyle.NORMAL },
      { text: 'Game will begin soon' },
      { yes: LedState.OFF, no: LedState.OFF },
      StatusLed.LOBBY
    )
  }

  _displayGameOver() {
    const d = this._display(
      { left: '', right: '' },
      { text: 'GAME OVER', style: DisplayStyle.NORMAL },
      { text: '' },
      { yes: LedState.OFF, no: LedState.OFF },
      StatusLed.GAME_OVER
    )
    d.icons = [] // Hide icon column
    return d
  }

  _displayDead(getLine1, dayCount, phase) {
    const p = this.player
    // Red neopixel during the phase they die, off from the next phase onwards
    const diedThisPhase = p.deathDay === dayCount && p.deathPhase === phase
    const d = this._display(
      { left: '', right: '' },
      { text: 'DEAD', style: DisplayStyle.NORMAL },
      { text: '' },
      { yes: LedState.OFF, no: LedState.OFF },
      diedThisPhase ? StatusLed.DEAD : StatusLed.OFF
    )
    d.icons = []
    return d
  }

  _displayAbstained(getLine1, eventName, activeEventId) {
    return this._display(
      { left: getLine1(eventName, activeEventId), right: '' },
      { text: 'ABSTAINED', style: DisplayStyle.ABSTAINED },
      { text: 'Waiting for others' },
      { yes: LedState.OFF, no: LedState.OFF },
      StatusLed.ABSTAINED,
      { activeEventId }
    )
  }

  _displayConfirmed(game, getLine1, eventName, activeEventId, targetId) {
    const targetName = game?.getPlayer(targetId)?.name || 'Unknown'
    // Special display for specific events
    let line2Text
    if (activeEventId === 'pardon') {
      line2Text = `PARDONING ${targetName.toUpperCase()}`
    } else if (activeEventId === EventId.CLEAN) {
      line2Text = 'CLEANING UP'
    } else if (activeEventId === EventId.POISON) {
      line2Text = 'POISONING'
    } else {
      line2Text = targetName.toUpperCase()
    }
    // Show cell status alongside "Selection locked" for KILL/HUNT
    const packHint = this._getPackHint(game, activeEventId)
    const line3 = packHint
      ? { left: packHint.left, center: packHint.center, right: packHint.right }
      : { text: 'Selection locked' }
    return this._display(
      { left: getLine1(eventName, activeEventId), right: '' },
      { text: line2Text, style: DisplayStyle.LOCKED },
      line3,
      { yes: LedState.OFF, no: LedState.OFF },
      StatusLed.LOCKED,
      { activeEventId }
    )
  }

  _displayEventWithSelection(game, ctx, getLine1, activeEventId, eventName) {
    const p = this.player
    const targetName = game?.getPlayer(p.currentSelection)?.name || 'Unknown'
    const packHint = this._getPackHint(game, activeEventId)
    const canAbstain = ctx.eventContext?.allowAbstain !== false
    const actions = getEventActions(activeEventId)

    // Boolean toggle events: delegate to NoSelection display (same UX, both LEDs bright)
    if (actions.negPrompt || activeEventId === 'pardon') {
      return this._displayEventNoSelection(game, ctx, getLine1, activeEventId, eventName)
    }

    const line2Text = targetName.toUpperCase()

    const display = this._display(
      { left: getLine1(eventName, activeEventId), right: '' },
      { text: line2Text, style: DisplayStyle.NORMAL },
      packHint
        ? { left: packHint.left, center: packHint.center, right: packHint.right }
        : { left: actions.confirm, right: canAbstain ? actions.abstain : '' },
      { yes: LedState.BRIGHT, no: canAbstain ? LedState.DIM : LedState.OFF },
      StatusLed.VOTING,
      { activeEventId }
    )

    // Include target list so ESP32 can scroll locally without a server round-trip per tick
    const instance = game.activeEvents?.get(activeEventId)
    const validTargets = instance?.event?.validTargets?.(p, game) || []
    display.targetNames = validTargets.map((t) => t.name.toUpperCase())
    display.targetIds = validTargets.map((t) => t.id)
    display.selectionIndex = validTargets.findIndex((t) => t.id === p.currentSelection)
    return display
  }

  _displayEventNoSelection(game, ctx, getLine1, activeEventId, eventName) {
    const p = this.player
    const packHint = this._getPackHint(game, activeEventId)
    const canAbstain = ctx.eventContext?.allowAbstain !== false
    const actions = getEventActions(activeEventId)

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
      )
      display.targetNames = [actions.prompt, actions.negPrompt]
      display.targetIds = [p.id, '__decline__']
      display.selectionIndex = 0
      return display
    }

    // Pardon toggle: same pattern — dial swaps PARDON/EXECUTE
    if (activeEventId === 'pardon') {
      const condemnedId = game?.flows?.get('pardon')?.state?.condemnedId || ''
      const condemnedName = game?.flows?.get('pardon')?.state?.condemnedName || 'Unknown'
      const display = this._display(
        { left: getLine1(eventName, activeEventId), right: '' },
        { text: `PARDON ${condemnedName.toUpperCase()}?`, style: DisplayStyle.NORMAL },
        { left: actions.confirm, right: actions.abstain },
        { yes: LedState.BRIGHT, no: LedState.BRIGHT },
        StatusLed.VOTING,
        { activeEventId }
      )
      display.targetNames = [
        `PARDON ${condemnedName.toUpperCase()}?`,
        `EXECUTE ${condemnedName.toUpperCase()}`,
      ]
      display.targetIds = [condemnedId, '__decline__']
      display.selectionIndex = 0
      return display
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
    )

    // Include target list so ESP32 can render the first selection locally without a round-trip
    const instance = game.activeEvents?.get(activeEventId)
    const validTargets = instance?.event?.validTargets?.(p, game) || []
    display.targetNames = validTargets.map((t) => t.name.toUpperCase())
    display.targetIds = validTargets.map((t) => t.id)
    display.selectionIndex = -1
    return display
  }

  _displayVoteLocked(getLine1) {
    return this._display(
      { left: getLine1('Vote', EventId.VOTE), right: '' },
      { text: 'VOTE LOCKED', style: DisplayStyle.CRITICAL },
      { text: 'Better luck next time' },
      { yes: LedState.OFF, no: LedState.OFF },
      StatusLed.LOCKED
    )
  }

  _displayEventResult(getLine1, phaseLed) {
    const result = this.player.lastEventResult
    const style = result.critical ? DisplayStyle.CRITICAL : DisplayStyle.NORMAL
    return this._display(
      { left: getLine1(), right: '' },
      { text: result.message, style },
      { text: result.detail || '' },
      { yes: LedState.OFF, no: LedState.OFF },
      phaseLed
    )
  }

  _displayIdleScroll(getLine1, phaseLed, game) {
    const p = this.player
    const idx = p.idleScrollIndex

    // Determine line2/line3 content based on which slot is highlighted
    let line2Text = ''
    let line2Style = DisplayStyle.NORMAL
    let line3 = { text: '' }
    let leds = { yes: LedState.OFF, no: LedState.OFF }

    if (idx === 0) {
      // Role slot - show role name and tip (use display override if set)
      const displayRole = this.displayRoleOverride || p.role
      line2Text = displayRole ? fitRoleName(displayRole, 23) : 'READY'
      line3 = { text: p.tutorialTip || '' }
      if (p.roleRevealPending) {
        line2Style = DisplayStyle.CRITICAL
        p.roleRevealPending = false // Flash once, then clear
      }
    } else {
      // Item slots (1 or 2)
      const itemIndex = idx - 1
      const inventoryItem = this._getIconSlotItem(itemIndex)
      if (inventoryItem) {
        if (inventoryItem.startsEvent) {
          // Check if the linked event is available in the current phase
          const linkedEvent = game ? getEvent(inventoryItem.startsEvent) : null
          const phaseOk = !linkedEvent?.phase || linkedEvent.phase.includes(game?.phase)
          const usesLabel =
            inventoryItem.maxUses === -1
              ? 'UNLIMITED'
              : `(${inventoryItem.uses}/${inventoryItem.maxUses})`
          if (phaseOk) {
            // Usable item — activatable now
            line2Text = `USE ${inventoryItem.id.toUpperCase()}?`
            line3 = { left: usesLabel, right: '' }
            leds = { yes: LedState.DIM, no: LedState.OFF }
          } else {
            // Item exists but not usable in this phase — show description
            const itemDef = getItem(inventoryItem.id)
            line2Text = (itemDef?.name || inventoryItem.id).toUpperCase()
            const desc = itemDef?.description || ''
            line3 = { text: desc.length > 42 ? desc.substring(0, 40) + '..' : desc }
          }
        } else {
          // Non-activatable item (gavel, etc.)
          line2Text = inventoryItem.id.toUpperCase()
          line3 = { text: 'Passive item' }
        }
      } else {
        // Empty slot
        line2Text = ''
        line3 = { text: 'Empty slot' }
      }
    }

    return this._display(
      { left: getLine1(), right: '' },
      { text: line2Text, style: line2Style },
      line3,
      leds,
      phaseLed
    )
  }

  /**
   * Create a display state object.
   */
  _display(line1, line2, line3, leds, statusLed, { activeEventId = null } = {}) {
    const p = this.player
    // Guard: warn if display strings exceed terminal limits (256px / font width)
    // Line 1/3 small font = 6px → 42 chars, Line 2 large font = 10px → 25 chars
    const MAX_SMALL = 42
    const MAX_LARGE = 25
    const l1Left = line1?.left || ''
    const l1Right = line1?.right || ''
    const l2Text = line2?.text || ''
    const l3Text = line3?.text || ''
    const l3Left = line3?.left || ''
    const l3Center = line3?.center || ''
    const l3Right = line3?.right || ''
    const l1Len = l1Left.length + l1Right.length
    const l3Len = l3Text ? l3Text.length : l3Left.length + l3Center.length + l3Right.length
    if (l1Len > MAX_SMALL)
      console.error(
        `[Player ${p.id}] Line 1 overflow (${l1Len}/${MAX_SMALL}): "${l1Left}" + "${l1Right}"`
      )
    if (l2Text.length > MAX_LARGE)
      console.error(
        `[Player ${p.id}] Line 2 overflow (${l2Text.length}/${MAX_LARGE}): "${l2Text}"`
      )
    if (l3Len > MAX_SMALL)
      console.error(
        `[Player ${p.id}] Line 3 overflow (${l3Len}/${MAX_SMALL}): text="${l3Text}" left="${l3Left}" center="${l3Center}" right="${l3Right}"`
      )

    return {
      line1,
      line2,
      line3,
      leds,
      statusLed,
      icons: this._buildIcons(activeEventId),
      idleScrollIndex: p.idleScrollIndex,
    }
  }

  /**
   * Build the standardized line1 left text.
   * Format: #{seatNumber} {NAME/ROLE} > {PHASE} > {ACTION}
   */
  _getLine1(phase, dayCount, eventName, eventId) {
    const p = this.player
    const playerNum = `#${p.seatNumber}`

    // Determine what to show: role (if assigned) or player name (in lobby)
    let nameOrRole
    if (p.role) {
      // Role assigned - show role name (use display override if set, e.g. amateur → seeker)
      const displayRole = this.displayRoleOverride || p.role
      nameOrRole = fitRoleName(displayRole, 12)
    } else {
      // No role - show custom name if set, otherwise "PLAYER"
      const defaultName = `Player ${p.seatNumber}`
      if (p.name && p.name !== defaultName) {
        nameOrRole = p.name.toUpperCase()
      } else {
        nameOrRole = 'PLAYER'
      }
    }
    nameOrRole = nameOrRole.substring(0, 12) // Truncate long names

    // Build phase part
    let phasePart
    if (phase === GamePhase.LOBBY) {
      phasePart = 'LOBBY'
    } else if (phase === GamePhase.GAME_OVER) {
      phasePart = 'GAME OVER'
    } else {
      phasePart = this._getPhaseLabel(phase, dayCount)
    }

    // Build action part
    let actionPart = ''
    if (!p.isAlive) {
      actionPart = ' > DEAD'
    } else if (eventName) {
      actionPart = ` > ${eventName.toUpperCase()}`
      // Add item name for item-triggered events
      if (eventId === EventId.SHOOT) {
        actionPart += ' (PISTOL)'
      } else if (eventId === EventId.INVESTIGATE && !p.role?.events?.investigate) {
        // Crystal ball investigate (player doesn't have investigate from role)
        actionPart += ' (CRYSTAL)'
      }
    }

    return `${playerNum} ${nameOrRole} > ${phasePart}${actionPart}`
  }

  _getPhaseLabel(phase, dayCount) {
    if (phase === GamePhase.DAY) return `DAY ${dayCount}`
    if (phase === GamePhase.NIGHT) return `NIGHT ${dayCount}`
    return phase?.toUpperCase() || ''
  }

  /**
   * Build the 3-slot icon array for the icon column.
   * Slot 0: role (or skull if dead)
   * Slots 1-2: first two inventory items (or empty)
   */
  _buildIcons(activeEventId = null) {
    const p = this.player
    // During an active event, highlight the icon for the source of that event
    let highlightSlot = p.idleScrollIndex
    if (activeEventId) {
      const itemIdx = p.inventory.findIndex(
        (item) => item.startsEvent === activeEventId && (item.maxUses === -1 || item.uses > 0)
      )
      highlightSlot = itemIdx >= 0 ? itemIdx + 1 : 0 // +1 because slot 0 is role
    }

    // Slot 0: role icon (use display override if set, e.g. amateur → seeker glyph)
    let slot0
    if (!p.isAlive) {
      slot0 = { id: 'skull', state: IconState.INACTIVE }
    } else if (p.role) {
      const displayRole = this.displayRoleOverride || p.role
      slot0 = {
        id: displayRole.id,
        state: highlightSlot === 0 ? IconState.ACTIVE : IconState.INACTIVE,
      }
    } else {
      slot0 = { id: 'empty', state: IconState.EMPTY }
    }

    // Slots 1-2: inventory items
    const slot1 = this._buildItemIcon(0, highlightSlot === 1)
    const slot2 = this._buildItemIcon(1, highlightSlot === 2)

    return [slot0, slot1, slot2]
  }

  _buildItemIcon(itemIndex, isActive) {
    const item = this._getIconSlotItem(itemIndex)
    if (!item) {
      return { id: 'empty', state: IconState.EMPTY }
    }
    const hasUses = item.maxUses === -1 || item.uses > 0
    return {
      id: item.id,
      state: isActive ? IconState.ACTIVE : hasUses ? IconState.INACTIVE : IconState.EMPTY,
    }
  }

  _getIconSlotItem(slotIndex) {
    const inv = this.player.inventory
    if (!inv || slotIndex >= inv.length) return null
    return inv[slotIndex]
  }

  /**
   * Build cell pack status for line3 during night events.
   * Returns { left, center, right } or null if not a cell member / no active event.
   *   left:   Fixer cleanup status (+/- CLEANUP)
   *   center: Sleeper majority suggestion (target name) or Alpha's pick
   *   right:  Chemist poison status (+/- POISON)
   */
  _getPackHint(game, eventId) {
    const p = this.player
    if (!p.role || p.role.team !== Team.CELL) return null
    if (!game.activeEvents?.has(eventId)) return null

    const packMembers = game
      .getAlivePlayers()
      .filter((m) => m.role.team === Team.CELL && m.id !== p.id)

    // --- Center: suggestion/target ---
    let center = ''
    if (p.role.id !== RoleId.ALPHA) {
      // Non-alpha: show Alpha's KILL target
      const killInstance = game.activeEvents.get(EventId.KILL)
      if (killInstance) {
        const alpha = packMembers.find((m) => m.role.id === RoleId.ALPHA)
        if (alpha) {
          const alphaPick =
            alpha.id in killInstance.results
              ? killInstance.results[alpha.id]
              : alpha.currentSelection
          if (alphaPick) {
            const target = game.getPlayer(alphaPick)
            center = target ? target.name.toUpperCase() : ''
          }
        }
      }
    } else {
      // Alpha: tally majority target from HUNT (sleeper suggestions)
      const huntInstance = game.activeEvents.get(EventId.SUGGEST)
      if (huntInstance) {
        const tally = {}
        for (const pid of huntInstance.participants) {
          const member = game.getPlayer(pid)
          if (!member || member.id === p.id) continue
          const pick =
            pid in huntInstance.results ? huntInstance.results[pid] : member.currentSelection
          if (pick && pick !== '__decline__') tally[pick] = (tally[pick] || 0) + 1
        }
        const entries = Object.entries(tally)
        if (entries.length > 0) {
          const [topTargetId] = entries.sort((a, b) => b[1] - a[1])[0]
          const topTarget = game.getPlayer(topTargetId)
          center = topTarget ? topTarget.name.toUpperCase() : ''
        }
      }
    }

    // --- Left: Fixer cleanup status ---
    let left = ''
    const cleanInstance = game.activeEvents.get(EventId.CLEAN)
    if (cleanInstance) {
      const fixer = game.getAlivePlayers().find((m) => m.role.id === RoleId.FIXER)
      if (fixer) {
        const fixerResult = fixer.id in cleanInstance.results
        const fixerYes = fixerResult && cleanInstance.results[fixer.id] !== null
        left = fixerResult ? (fixerYes ? '+CLEANUP' : '-CLEANUP') : 'CLEANUP?'
      }
    }

    // --- Right: Chemist poison status ---
    let right = ''
    const poisonInstance = game.activeEvents.get(EventId.POISON)
    if (poisonInstance) {
      const chemist = game.getAlivePlayers().find((m) => m.role.id === RoleId.CHEMIST)
      if (chemist) {
        const chemistResult = chemist.id in poisonInstance.results
        const chemistYes = chemistResult && poisonInstance.results[chemist.id] !== null
        right = chemistResult ? (chemistYes ? '+POISON' : '-POISON') : 'POISON?'
      }
    }

    if (!left && !center && !right) return null
    return { left, center, right }
  }
}
