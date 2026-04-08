// server/SlideManager.js
// Manages the slide queue for the big screen display.

import {
  GamePhase,
  PlayerStatus,
  ServerMsg,
  ItemId,
  RoleId,
  SlideStyle,
  SlideType,
  Team,
  ITEM_DISPLAY,
} from '../shared/constants.js'
import { str } from './strings.js'
import { getRole } from './definitions/roles.js'
import { getItem } from './definitions/items.js'

// Ability color palette for role tutorial slides
const ABILITY_COLOR = {
  HOSTILE: '#c94c4c',   // Red — hurts (kill, hunt, vigil, block, clean, revenge)
  HELPFUL: '#7eb8da',   // Blue — helps (protect, investigate, pardon)
  NEUTRAL: '#d4af37',   // Yellow — fallback (vote, suspect, etc.)
}

export class SlideManager {
  constructor(game) {
    this.game = game
    this.slideQueue = []
    this.currentSlideIndex = -1
    this.slideIdCounter = 0
    this._heartrateSlidePlayerId = null
  }

  reset() {
    this.slideQueue = []
    this.currentSlideIndex = -1
    this._heartrateSlidePlayerId = null
    // slideIdCounter intentionally not reset — IDs are unique across the server lifetime
  }

  // Centralized death slide queuing — always splits into two slides:
  //   1. Identity slide: victim name in title (e.g. "MARK KILLED"), no role shown
  //   2. Role reveal slide: team name in title (e.g. "CIRCLE KILLED"), shows role
  queueDeathSlide(slide, jumpTo = true) {
    const victim = this.game.players.get(slide.playerId)
    const victimName = victim?.name ?? 'PLAYER'
    const lastWord = slide.title.split(' ').pop()
    const IDENTITY_VERBS = {
      [str('slides', 'death.suffixKilled')]: 'KILLED',
      [str('slides', 'death.suffixEliminated')]: 'ELIMINATED',
      [str('slides', 'death.suffixPoisoned')]: 'POISONED',
    }
    const action = IDENTITY_VERBS[lastWord] || lastWord
    const isRoleCleaned = victim?.isRoleCleaned ?? false
    const jesterWon = !!victim?.jesterWon

    // Slide 1: identity — shows who died, no role info
    const identitySlide = {
      ...slide,
      jesterWon,
      title: slide.identityTitle ?? `${victimName.toUpperCase()} ${action}`,
      subtitle: slide.identityTitle ? victimName : slide.subtitle,
      revealRole: false,
      revealText: undefined,
      identityTitle: undefined,
    }
    this.pushSlide(identitySlide, jumpTo)

    // Slide 2: role reveal — team name in title, shows role (or cleaned indicator)
    const remainingComposition = []
    for (const p of this.game.players.values()) {
      if (p.status === PlayerStatus.SPECTATOR) continue
      const isDead = p.status === PlayerStatus.DEAD
      const isCoward = p.isAlive && p.hasItem(ItemId.COWARD)
      remainingComposition.push({
        team: p.isRoleCleaned ? 'unknown' : (p.role?.team ?? 'citizens'),
        dim: isDead || isCoward,
      })
    }
    const roleSlide = {
      ...slide,
      jesterWon,
      title: isRoleCleaned ? `??? ${action}` : slide.title,
      identityTitle: undefined,
      remainingComposition,
    }
    this.pushSlide(roleSlide, false)

    // Check all flows for pending slides to queue after the death slide
    for (const flow of this.game.flows.values()) {
      const pendingSlide = flow.getPendingSlide()
      if (pendingSlide) {
        this.pushSlide({ ...pendingSlide, _slidePriority: 100, _flowSlide: true }, false)
      }
    }
  }

  // Create a death slide for a given cause (used when events don't provide custom slides)
  createDeathSlide(player, cause) {
    const teamNames = {
      citizens: str('slides', 'death.teamCircle'),
      children: str('slides', 'death.teamCell'),
      outsider: str('slides', 'death.teamNeutral'),
    }
    const teamName = player.role?.id === RoleId.TRICKSTER
      ? str('slides', 'death.teamJester')
      : (teamNames[player.role?.team] || str('slides', 'death.teamUnknown'))

    const killed = str('slides', 'death.suffixKilled')
    const titles = {
      eliminated: `${teamName} ${str('slides', 'death.suffixEliminated')}`,
      children:   `${teamName} ${killed}`,
      vigilante:  `${teamName} ${killed}`,
      shot:       `${teamName} ${killed}`,
      paranoid:   `${teamName} ${killed}`,
      heartbreak: `${teamName} ${str('slides', 'death.suffixHeartbroken')}`,
      host:       `${teamName} ${str('slides', 'death.suffixRemoved')}`,
      poison:     `${teamName} ${killed}`,
    }

    const subtitles = {
      eliminated: player.name,
      children:   player.name,
      vigilante:  player.name,
      shot:       str('slides', 'death.subtitleShot',        { name: player.name }),
      paranoid:   str('slides', 'death.subtitleHunter',      { name: player.name }),
      heartbreak: str('slides', 'death.subtitleHeartbreak',  { name: player.name }),
      host:       str('slides', 'death.subtitleHost',        { name: player.name }),
      poison:     str('slides', 'death.subtitlePoison',      { name: player.name }),
    }

    return {
      type: 'death',
      playerId: player.id,
      title: titles[cause] || `${teamName} ${str('slides', 'death.suffixDead')}`,
      subtitle: subtitles[cause] || player.name,
      revealRole: true,
      hostKill: cause === 'host',
      style: SlideStyle.HOSTILE,
      skipProtected: true,
    }
  }

  pushSlide(slide, jumpTo = true) {
    const slideWithId = { ...slide, id: `slide-${++this.slideIdCounter}` }
    this.slideQueue.push(slideWithId)

    if (this.currentSlideIndex === -1 || jumpTo) {
      this.currentSlideIndex = this.slideQueue.length - 1
    }

    this.broadcastSlides()
  }

  nextSlide() {
    if (this.currentSlideIndex < this.slideQueue.length - 1) {
      this.currentSlideIndex++
      this.broadcastSlides()
      this._onSlideActivated()
    }
  }

  prevSlide() {
    if (this.currentSlideIndex > 0) {
      this.currentSlideIndex--
      this.broadcastSlides()
    }
  }

  _onSlideActivated() {
    const slide = this.slideQueue[this.currentSlideIndex]
    if (!slide) return

    if (slide.activateRunoff) {
      this.game._activateRunoff(slide.activateRunoff)
      delete slide.activateRunoff // Only fire once
    }
  }

  clearSlides() {
    this.slideQueue = []
    this.currentSlideIndex = -1

    if (this.game.phase === GamePhase.DAY) {
      this.pushSlide({
        type: 'gallery',
        title: str('slides', 'phase.dayN.title', { n: this.game.dayCount }),
        subtitle: str('slides', 'phase.dayN.subtitle'),
        playerIds: this.game.getAlivePlayers().map(p => p.id),
        style: SlideStyle.NEUTRAL,
      })
    } else if (this.game.phase === GamePhase.NIGHT) {
      this.pushSlide({
        type: 'gallery',
        title: str('slides', 'phase.nightN.title', { n: this.game.dayCount }),
        subtitle: str('slides', 'phase.nightN.subtitle'),
        playerIds: this.game.getAlivePlayers().map(p => p.id),
        style: SlideStyle.NEUTRAL,
      })
    } else if (this.game.phase === GamePhase.LOBBY) {
      this.pushSlide({
        type: 'gallery',
        title: str('slides', 'phase.lobby.title'),
        subtitle: str('slides', 'phase.lobby.subtitle'),
        playerIds: [...this.game.players.values()].map(p => p.id),
        style: SlideStyle.NEUTRAL,
      })
    }
  }

  getCurrentSlide() {
    if (this.currentSlideIndex >= 0 && this.currentSlideIndex < this.slideQueue.length) {
      return this.slideQueue[this.currentSlideIndex]
    }
    return null
  }

  broadcastSlides() {
    const currentSlide = this.getCurrentSlide()
    const slideData = {
      queue: this.slideQueue,
      currentIndex: this.currentSlideIndex,
      current: currentSlide,
    }
    this.game.broadcast(ServerMsg.SLIDE_QUEUE, slideData)
    this.game.sendToScreen(ServerMsg.SLIDE, currentSlide)

    // Enable/disable heartrate monitor for heartbeat slide subjects
    const newSlidePlayerId = (currentSlide?.type === SlideType.HEARTBEAT)
      ? currentSlide.playerId : null

    if (newSlidePlayerId !== this._heartrateSlidePlayerId) {
      // Disable previous slide subject (unless still needed by HB mode/calibration)
      if (this._heartrateSlidePlayerId) {
        const prev = this.game.getPlayer(this._heartrateSlidePlayerId)
        if (prev?.terminalConnected && !this.game.heartbeatMode && !this.game._calibration) {
          prev.send(ServerMsg.HEARTRATE_MONITOR, { enabled: false })
        }
      }
      // Enable new slide subject
      if (newSlidePlayerId) {
        const player = this.game.getPlayer(newSlidePlayerId)
        if (player?.terminalConnected) {
          player.send(ServerMsg.HEARTRATE_MONITOR, { enabled: true })
        }
      }
      this._heartrateSlidePlayerId = newSlidePlayerId
    }
  }

  // === Lobby Tutorial Slides ===

  pushCompSlide() {
    const players = [...this.game.players.values()]
    const assigned = players.filter(p => p.preAssignedRole || p.role)
    if (assigned.length === 0) {
      return { success: false, error: 'No roles assigned' }
    }

    const roleCounts = {}
    const teamCounts = { citizens: 0, children: 0 }
    for (const player of assigned) {
      const roleDef = getRole(player.preAssignedRole) || player.role
      if (!roleDef) continue
      if (!roleCounts[roleDef.id]) {
        roleCounts[roleDef.id] = {
          roleId: roleDef.id,
          roleName: roleDef.name,
          roleEmoji: roleDef.emoji,
          roleColor: roleDef.color,
          team: roleDef.team,
          count: 0,
        }
      }
      roleCounts[roleDef.id].count++
      if (roleDef.team === Team.CITIZENS) teamCounts.citizens++
      else if (roleDef.team === Team.CHILDREN) teamCounts.children++
    }

    const unassigned = players.length - assigned.length

    this.pushSlide({
      type: SlideType.COMPOSITION,
      title: str('slides', 'misc.compositionTitle'),
      playerIds: players.map(p => p.id),
      roles: Object.values(roleCounts),
      teamCounts: { ...teamCounts, unassigned },
      style: SlideStyle.NEUTRAL,
    })

    this.game.addLog(str('log', 'compositionPushed'))
    return { success: true }
  }

  pushRoleTipSlide(roleId) {
    const roleDef = getRole(roleId)
    if (!roleDef) {
      return { success: false, error: 'Unknown role' }
    }

    this.pushSlide({
      type: SlideType.ROLE_TIP,
      title: str('slides', 'misc.roleTipTitle'),
      roleId: roleDef.id,
      roleName: roleDef.name,
      roleEmoji: roleDef.emoji,
      roleColor: roleDef.color,
      team: roleDef.team,
      abilities: this._getRoleAbilities(roleDef),
      detailedTip: roleDef.detailedTip || roleDef.description,
      style: roleDef.team === Team.CHILDREN ? SlideStyle.HOSTILE : SlideStyle.NEUTRAL,
    })

    this.game.addLog(str('log', 'roleTipPushed', { role: roleDef.name }))
    return { success: true }
  }

  pushItemTipSlide(itemId) {
    const itemDef = getItem(itemId)
    if (!itemDef) {
      return { success: false, error: 'Unknown item' }
    }

    const display = ITEM_DISPLAY[itemId] || {}
    this.pushSlide({
      type: SlideType.ITEM_TIP,
      title: str('slides', 'misc.itemTipTitle'),
      itemId: itemDef.id,
      itemName: itemDef.name,
      itemEmoji: display.emoji || '📦',
      itemDescription: itemDef.description,
      maxUses: itemDef.maxUses,
      style: SlideStyle.WARNING,
    })

    this.game.addLog(str('log', 'itemTipPushed', { item: itemDef.name }))
    return { success: true }
  }

  // Derive display ability labels from a role's events (and passives/flows)
  _getRoleAbilities(roleDef) {
    const abilityColors = {
      vote: ABILITY_COLOR.NEUTRAL,
      kill: ABILITY_COLOR.HOSTILE,
      hunt: ABILITY_COLOR.HOSTILE,
      vigil: ABILITY_COLOR.HOSTILE,
      block: ABILITY_COLOR.HOSTILE,
      clean: ABILITY_COLOR.HOSTILE,
      revenge: ABILITY_COLOR.HOSTILE,
      protect: ABILITY_COLOR.HELPFUL,
      investigate: ABILITY_COLOR.HELPFUL,
      pardon: ABILITY_COLOR.HELPFUL,
    }

    const abilities = Object.keys(roleDef.events || {}).map(e => ({
      label: e.toUpperCase(),
      color: abilityColors[e] || ABILITY_COLOR.NEUTRAL,
    }))

    const passiveAbilities = {
      [RoleId.PARANOID]: [{ label: 'REVENGE', color: abilityColors.revenge }],
      [RoleId.GOVERNOR]: [{ label: 'PARDON', color: abilityColors.pardon }],
    }
    const extras = passiveAbilities[roleDef.id] || []

    return [...abilities, ...extras]
  }
}
