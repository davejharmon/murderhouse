// server/PersistenceManager.js
// Handles loading/saving host settings, scores, and game presets to disk.
// Also computes and awards end-game scores.

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { ServerMsg, SlideType } from '../shared/constants.js'
import { str } from './strings.js'
import { buildRolePool, GAME_COMPOSITION } from './definitions/roles.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const GAME_PRESETS_PATH = path.join(__dirname, 'game-presets.json')
const HOST_SETTINGS_PATH = path.join(__dirname, 'host-settings.json')
const SCORES_PATH = path.join(__dirname, 'scores.json')

export class PersistenceManager {
  constructor(game) {
    this.game = game
    this._hostSettings = null
    this._gamePresets = []
    this._scores = new Map()
    this._preGameScores = null
  }

  loadAll() {
    this._loadHostSettingsFromDisk()
    this._loadGamePresetsFromDisk()
    this._loadScoresFromDisk()
  }

  capturePreGameScores() {
    this._preGameScores = new Map(this._scores)
  }

  // === Host Settings ===

  _loadHostSettingsFromDisk() {
    const defaults = {
      timerDuration: 30,
      autoAdvanceEnabled: false,
      heartbeatThreshold: 110,
      scoringConfig: { survived: 1, winningTeam: 1, bestInvestigator: 2 },
      heartbeatCalibration: {},
      heartbeatDisplayResting: 65,
      heartbeatDisplayElevated: 110,
      simsCanLose: false,
      heartbeatAddNoise: false,
      poisonKillsGeneric: false,
    }
    if (!fs.existsSync(HOST_SETTINGS_PATH)) {
      this._hostSettings = defaults
      return
    }
    try {
      this._hostSettings = { ...defaults, ...JSON.parse(fs.readFileSync(HOST_SETTINGS_PATH, 'utf-8')) }
    } catch (e) {
      console.error('[Server] Failed to load host settings:', e.message)
      this._hostSettings = defaults
    }
  }

  getHostSettings() {
    return { ...this._hostSettings }
  }

  saveHostSettings(settings) {
    this._hostSettings = { ...this._hostSettings, ...settings }
    fs.writeFileSync(HOST_SETTINGS_PATH, JSON.stringify(this._hostSettings, null, 2))
    this.game._sendToHost(ServerMsg.HOST_SETTINGS, this.getHostSettings())
  }

  setDefaultPreset(id) {
    const defaultPresetId = this._hostSettings.defaultPresetId === id ? null : id
    this.saveHostSettings({ defaultPresetId })
  }

  // === Scores ===

  _loadScoresFromDisk() {
    if (!fs.existsSync(SCORES_PATH)) {
      this._scores = new Map()
      return
    }
    try {
      const data = JSON.parse(fs.readFileSync(SCORES_PATH, 'utf-8'))
      this._scores = new Map(Object.entries(data).map(([k, v]) => [k, Number(v) || 0]))
    } catch (e) {
      console.error('[Server] Failed to load scores:', e.message)
      this._scores = new Map()
    }
  }

  _saveScoresToDisk() {
    const obj = Object.fromEntries(this._scores)
    fs.writeFileSync(SCORES_PATH, JSON.stringify(obj, null, 2))
  }

  setScore(name, score) {
    this._scores.set(name, score)
    this._saveScoresToDisk()
    this.sendScoresToHost()
  }

  getScoresForConnectedPlayers() {
    return [...this.game.players.values()]
      .filter(p => p.name)
      .map(p => ({ name: p.name, portrait: p.portrait, score: this._scores.get(p.name) ?? 0 }))
      .sort((a, b) => b.score - a.score)
  }

  getScoresObject() {
    return Object.fromEntries(this._scores)
  }

  sendScoresToHost() {
    this.game._sendToHost(ServerMsg.SCORES, { scores: this.getScoresObject() })
  }

  pushScoreSlide() {
    const entries = this.getScoresForConnectedPlayers()
    const slide = {
      type: SlideType.SCORES,
      title: str('slides', 'misc.scoreboardTitle'),
      entries,
    }
    if (this._preGameScores) {
      slide.previousEntries = [...this.game.players.values()]
        .filter(p => p.name)
        .map(p => ({ name: p.name, portrait: p.portrait, score: this._preGameScores.get(p.name) ?? 0 }))
        .sort((a, b) => b.score - a.score)
    }
    this.game.pushSlide(slide)
  }

  // === Game Presets ===

  _loadGamePresetsFromDisk() {
    if (!fs.existsSync(GAME_PRESETS_PATH)) {
      this._gamePresets = []
      return
    }
    try {
      const data = JSON.parse(fs.readFileSync(GAME_PRESETS_PATH, 'utf-8'))
      this._gamePresets = data.presets || []
    } catch (e) {
      console.error('[Server] Failed to load game presets:', e.message)
      this._gamePresets = []
    }
  }

  _saveGamePresetsToDisk() {
    fs.writeFileSync(GAME_PRESETS_PATH, JSON.stringify({ presets: this._gamePresets }, null, 2))
  }

  getGamePresets() {
    return { presets: this._gamePresets }
  }

  saveGamePreset(name, timerDuration, autoAdvanceEnabled, fakeHeartbeats = false, overwriteId = null) {
    const players = {}
    for (const [id, cust] of this.game.playerCustomizations) {
      if (cust.name || cust.portrait) {
        players[id] = { name: cust.name, portrait: cust.portrait }
      }
    }
    for (const player of this.game.players.values()) {
      players[player.id] = { name: player.name, portrait: player.portrait }
    }

    const playerCount = this.game.players.size
    const hasPreAssigned = [...this.game.players.values()].some(p => p.preAssignedRole)
    let roleMode, rolePool, roleAssignments
    if (hasPreAssigned) {
      roleMode = 'assigned'
      roleAssignments = {}
      for (const player of this.game.getPlayersBySeat()) {
        if (player.preAssignedRole) roleAssignments[player.id] = player.preAssignedRole
      }
      rolePool = null
    } else if (playerCount >= 4 && GAME_COMPOSITION[playerCount]) {
      roleMode = 'random'
      rolePool = buildRolePool(playerCount)
      roleAssignments = null
    } else {
      roleMode = 'random'
      rolePool = null
      roleAssignments = null
    }

    if (overwriteId) {
      const index = this._gamePresets.findIndex(p => p.id === overwriteId)
      if (index !== -1) {
        this._gamePresets[index] = {
          ...this._gamePresets[index],
          name, players, roleMode, rolePool, roleAssignments, timerDuration, autoAdvanceEnabled, fakeHeartbeats,
        }
        this._saveGamePresetsToDisk()
        this.game.addLog(str('log', 'presetUpdated', { name }))
        return this._gamePresets[index]
      }
    }

    const preset = {
      id: String(Date.now()),
      name: name.trim() || 'Unnamed Preset',
      created: Date.now(),
      players,
      roleMode,
      rolePool,
      roleAssignments,
      timerDuration,
      autoAdvanceEnabled,
      fakeHeartbeats,
    }

    this._gamePresets.push(preset)
    this._saveGamePresetsToDisk()
    this.game.addLog(str('log', 'presetSaved', { name: preset.name }))
    return preset
  }

  loadGamePreset(id) {
    const preset = this._gamePresets.find(p => p.id === id)
    if (!preset) return null

    for (const [playerId, data] of Object.entries(preset.players)) {
      const existing = this.game.playerCustomizations.get(playerId) || {}
      this.game.playerCustomizations.set(playerId, {
        ...existing,
        name: data.name,
        portrait: data.portrait,
      })
      const player = this.game.players.get(playerId)
      if (player) {
        player.name = data.name
        player.portrait = data.portrait
      }
    }

    for (const [pid, cust] of this.game.playerCustomizations) {
      this.game.playerCustomizations.set(pid, { ...cust, preAssignedRole: null })
    }
    for (const player of this.game.players.values()) {
      player.preAssignedRole = null
    }

    const roleMode = preset.roleMode || 'random'
    if (roleMode === 'assigned' && preset.roleAssignments) {
      for (const [seatId, roleId] of Object.entries(preset.roleAssignments)) {
        const cust = this.game.playerCustomizations.get(seatId) || {}
        this.game.playerCustomizations.set(seatId, { ...cust, preAssignedRole: roleId })
        const player = this.game.players.get(seatId)
        if (player) player.preAssignedRole = roleId
      }
      this.game.presetRolePool = null
    } else {
      this.game.presetRolePool = preset.rolePool || null
    }

    this.saveHostSettings({
      timerDuration: preset.timerDuration,
      autoAdvanceEnabled: preset.autoAdvanceEnabled,
      lastLoadedPresetId: preset.id,
    })

    const wantFake = preset.fakeHeartbeats ?? false
    if (wantFake !== this.game._fakeHeartbeats) {
      if (wantFake) {
        this.game._fakeHeartbeats = true
        this.game._fakeHeartbeatSimState = {}
        this.game._fakeHeartbeatTimer = setInterval(() => this.game._tickFakeHeartbeats(), 1500)
      } else {
        this.game._fakeHeartbeats = false
        clearInterval(this.game._fakeHeartbeatTimer)
        this.game._fakeHeartbeatTimer = null
        for (const player of this.game.players.values()) {
          if (player.heartbeat?.fake) {
            player.heartbeat = { bpm: 0, active: false, fake: false, lastUpdate: Date.now() }
          }
        }
      }
    }

    if (this.game.players.size > 0) {
      this.game.broadcastPlayerList()
      this.game.broadcastGameState()
    }
    this.game.addLog(str('log', 'presetLoaded', { name: preset.name }))
    return { timerDuration: preset.timerDuration, autoAdvanceEnabled: preset.autoAdvanceEnabled }
  }

  deleteGamePreset(id) {
    const index = this._gamePresets.findIndex(p => p.id === id)
    if (index === -1) return false
    const name = this._gamePresets[index].name
    this._gamePresets.splice(index, 1)
    this._saveGamePresetsToDisk()
    this.game.addLog(str('log', 'presetDeleted', { name }))
    return true
  }

  // === End-game scoring ===

  awardEndGameScores(winner) {
    const config = this._hostSettings.scoringConfig
    if (!config) return

    const allPlayers = [...this.game.players.values()].filter(p => p.name)
    const toSlidePlayer = (p) => ({ id: p.id, name: p.name, portrait: p.portrait })

    const survivedPlayers = []
    const winningPlayers = []

    for (const player of allPlayers) {
      let points = 0
      const survived = config.survived && (player.isAlive || player.deathDay === this.game.dayCount)
      const onWinningTeam = config.winningTeam && player.role.team === winner

      if (survived) {
        points += config.survived
        survivedPlayers.push(toSlidePlayer(player))
      }
      if (onWinningTeam) {
        points += config.winningTeam
        winningPlayers.push(toSlidePlayer(player))
      }

      if (points > 0) {
        const current = this._scores.get(player.name) ?? 0
        this._scores.set(player.name, current + points)
        const reasons = []
        if (survived) reasons.push(str('slides', 'scoring.survivedLabel'))
        if (onWinningTeam) reasons.push(str('slides', 'scoring.winningTeamLabel'))
        this.game.addLog(str('log', 'scoreAwarded', {
          name: player.getNameWithEmoji(), points, reason: reasons.join(', '),
        }))
      }
    }

    const groups = []
    if (winningPlayers.length > 0) {
      groups.push({ label: str('slides', 'scoring.winningTeamLabel'), players: winningPlayers, points: config.winningTeam })
    }
    if (survivedPlayers.length > 0) {
      groups.push({ label: str('slides', 'scoring.survivedLabel'), players: survivedPlayers, points: config.survived })
    }
    if (groups.length > 0) {
      this.game.pushSlide({
        type: SlideType.SCORE_UPDATE,
        title: str('slides', 'scoring.updateTitle'),
        groups,
      }, false)
    }

    if (config.bestInvestigator) {
      let bestCount = 0
      let fewestWrong = Infinity
      let bestPlayers = []

      for (const player of allPlayers) {
        const suspicions = player.suspicions || []
        const correct = suspicions.filter(s => s.wasCorrect).length
        const wrong = suspicions.filter(s => !s.wasCorrect).length
        if (correct < 1) continue
        if (correct > bestCount || (correct === bestCount && wrong < fewestWrong)) {
          bestCount = correct
          fewestWrong = wrong
          bestPlayers = [player]
        } else if (correct === bestCount && wrong === fewestWrong) {
          bestPlayers.push(player)
        }
      }

      for (const player of bestPlayers) {
        const current = this._scores.get(player.name) ?? 0
        this._scores.set(player.name, current + config.bestInvestigator)
        const total = (player.suspicions || []).length
        this.game.addLog(str('log', 'scoreBestSuspect', {
          name: player.getNameWithEmoji(), points: config.bestInvestigator, correct: bestCount, total,
        }))

        const suspects = (player.suspicions || []).map(s => {
          const target = this.game.getPlayer(s.targetId)
          return {
            name: target?.name || 'Unknown',
            portrait: target?.portrait || 'default.png',
            wasCorrect: s.wasCorrect,
          }
        })

        this.game.pushSlide({
          type: SlideType.BEST_SUSPECT,
          title: str('slides', 'scoring.bestSuspectTitle'),
          winner: toSlidePlayer(player),
          suspects,
          points: config.bestInvestigator,
        }, false)
      }
    }

    this._saveScoresToDisk()
    this.sendScoresToHost()
  }
}
