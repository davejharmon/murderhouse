// client/src/components/slides/mockSlides.js
// Mock data for SlideEditor dev tool. Not used in production.
import { SlideType, SlideStyle, GamePhase, PlayerStatus } from '@shared/constants.js'

export const MOCK_PLAYERS = [
  { id: 1, name: 'Alice',   portrait: 'player1.png', status: PlayerStatus.ALIVE, roleTeam: 'village',  roleName: 'Villager',  roleColor: '#7eb8da', roleEmoji: '🧑', isCowering: false, hasNovote: false, heartbeat: { active: true, bpm: 88,  fake: false } },
  { id: 2, name: 'Bob',     portrait: 'player2.png', status: PlayerStatus.ALIVE, roleTeam: 'werewolf', roleName: 'Werewolf',  roleColor: '#c94c4c', roleEmoji: '🐺', isCowering: false, hasNovote: false, heartbeat: { active: true, bpm: 120, fake: false } },
  { id: 3, name: 'Carol',   portrait: 'player3.png', status: PlayerStatus.ALIVE, roleTeam: 'village',  roleName: 'Seer',      roleColor: '#c9a94c', roleEmoji: '🔮', isCowering: true,  hasNovote: false, heartbeat: { active: true, bpm: 72,  fake: false } },
  { id: 4, name: 'Dave',    portrait: 'player4.png', status: PlayerStatus.DEAD,  roleTeam: 'werewolf', roleName: 'Werewolf',  roleColor: '#c94c4c', roleEmoji: '🐺', isCowering: false, hasNovote: false, heartbeat: { active: false, bpm: 0,  fake: false }, deathTimestamp: 1000 },
  { id: 5, name: 'Eve',     portrait: 'player5.png', status: PlayerStatus.ALIVE, roleTeam: 'village',  roleName: 'Doctor',    roleColor: '#7ed9a6', roleEmoji: '💉', isCowering: false, hasNovote: true,  heartbeat: { active: true, bpm: 95,  fake: false } },
  { id: 6, name: 'Frank',   portrait: 'player6.png', status: PlayerStatus.ALIVE, roleTeam: 'neutral',  roleName: 'Jester',    roleColor: '#e8a020', roleEmoji: '🃏', isCowering: false, hasNovote: false, heartbeat: { active: true, bpm: 78,  fake: true  } },
]

export const MOCK_GAME_STATE_LOBBY = {
  phase: GamePhase.LOBBY,
  players: MOCK_PLAYERS,
  dayCount: 0,
  totalWerewolves: 2,
  heartbeatMode: false,
  heartbeatThreshold: 110,
  eventRespondents: {},
}

export const MOCK_GAME_STATE_DAY = {
  phase: GamePhase.DAY,
  players: MOCK_PLAYERS,
  dayCount: 2,
  totalWerewolves: 2,
  heartbeatMode: true,
  heartbeatThreshold: 110,
  eventRespondents: {},
}

// One mock per SlideType
export const MOCK_SLIDES = {
  [SlideType.TITLE]: {
    id: 'mock-title',
    type: SlideType.TITLE,
    title: 'THE VILLAGE WAKES',
    subtitle: 'Day 2 begins',
    playerId: 1,
  },

  [`${SlideType.TITLE}_noPlayer`]: {
    id: 'mock-title-noplayer',
    type: SlideType.TITLE,
    title: 'NIGHT FALLS',
    subtitle: 'Werewolves hunt',
  },

  [SlideType.PLAYER_REVEAL]: {
    id: 'mock-player-reveal',
    type: SlideType.PLAYER_REVEAL,
    title: 'VOTED OUT',
    subtitle: 'The village has spoken',
    playerId: 3,
    revealRole: true,
    style: SlideStyle.HOSTILE,
    voterIds: [1, 2, 5],
  },

  [`${SlideType.PLAYER_REVEAL}_jester`]: {
    id: 'mock-player-reveal-jester',
    type: SlideType.PLAYER_REVEAL,
    title: 'JESTER WINS',
    playerId: 6,
    revealRole: true,
    jesterWon: true,
    style: SlideStyle.WARNING,
  },

  [SlideType.VOTE_TALLY]: {
    id: 'mock-vote-tally',
    type: SlideType.VOTE_TALLY,
    title: 'VOTES',
    tally: { 3: 3, 5: 2, 1: 1 },
    voters: { 3: [1, 2, 4], 5: [3, 6], 1: [5] },
    frontrunners: [3],
    anonymousVoting: false,
  },

  [`${SlideType.VOTE_TALLY}_anon`]: {
    id: 'mock-vote-tally-anon',
    type: SlideType.VOTE_TALLY,
    title: 'ANONYMOUS VOTE',
    tally: { 3: 3, 5: 2 },
    voters: {},
    frontrunners: [3],
    anonymousVoting: true,
  },

  [SlideType.GALLERY]: {
    id: 'mock-gallery',
    type: SlideType.GALLERY,
    title: 'GATHERING',
    subtitle: 'All players present',
    playerIds: [1, 2, 3, 5, 6],
    targetsOnly: false,
  },

  [`${SlideType.GALLERY}_targetsOnly`]: {
    id: 'mock-gallery-targets',
    type: SlideType.GALLERY,
    title: 'CHOOSE YOUR TARGET',
    playerIds: [1, 3, 5],
    targetsOnly: true,
    activeEventId: 'vote',
  },

  [`${SlideType.GALLERY}_timer`]: {
    id: 'mock-gallery-timer',
    type: SlideType.GALLERY,
    title: 'VOTE NOW',
    subtitle: 'Time is running out',
    playerIds: [1, 2, 3, 5, 6],
    timerEventId: 'vote',
  },

  [SlideType.COUNTDOWN]: {
    id: 'mock-countdown',
    type: SlideType.COUNTDOWN,
    title: 'DELIBERATE',
    seconds: 30,
    subtitle: 'Discuss before voting',
  },

  [SlideType.DEATH]: {
    id: 'mock-death',
    type: SlideType.DEATH,
    title: 'ELIMINATED',
    subtitle: 'Carol',
    playerId: 3,
    revealRole: true,
    style: SlideStyle.HOSTILE,
    remainingComposition: [
      { team: 'village', dim: false },
      { team: 'village', dim: false },
      { team: 'werewolf', dim: false },
      { team: 'werewolf', dim: true },
    ],
  },

  [`${SlideType.DEATH}_coward`]: {
    id: 'mock-death-coward',
    type: SlideType.DEATH,
    title: 'FLED THE VILLAGE',
    subtitle: 'Carol',
    playerId: 3,
    coward: true,
    style: SlideStyle.WARNING,
    revealText: 'Seer — fled in shame',
  },

  [SlideType.VICTORY]: {
    id: 'mock-victory',
    type: SlideType.VICTORY,
    title: 'VILLAGE WINS',
    subtitle: 'The werewolves have been defeated',
    style: SlideStyle.POSITIVE,
    winners: [
      { id: 1, name: 'Alice', portrait: 'player1.png', isAlive: true,  roleColor: '#7eb8da', roleName: 'Villager' },
      { id: 3, name: 'Carol', portrait: 'player3.png', isAlive: false, roleColor: '#c9a94c', roleName: 'Seer'     },
      { id: 5, name: 'Eve',   portrait: 'player5.png', isAlive: true,  roleColor: '#7ed9a6', roleName: 'Doctor'   },
    ],
  },

  [`${SlideType.VICTORY}_werewolf`]: {
    id: 'mock-victory-wolf',
    type: SlideType.VICTORY,
    title: 'WEREWOLVES WIN',
    subtitle: 'The village has fallen',
    style: SlideStyle.HOSTILE,
    winners: [
      { id: 2, name: 'Bob',  portrait: 'player2.png', isAlive: true, roleColor: '#c94c4c', roleName: 'Werewolf' },
    ],
  },

  [SlideType.COMPOSITION]: {
    id: 'mock-composition',
    type: SlideType.COMPOSITION,
    title: 'GAME SETUP',
    roles: [
      { roleId: 'werewolf', roleName: 'Werewolf', roleEmoji: '🐺', team: 'werewolf', count: 2 },
      { roleId: 'villager', roleName: 'Villager', roleEmoji: '🧑', team: 'village',  count: 3 },
      { roleId: 'seer',     roleName: 'Seer',     roleEmoji: '🔮', team: 'village',  count: 1 },
      { roleId: 'doctor',   roleName: 'Doctor',   roleEmoji: '💉', team: 'village',  count: 1 },
    ],
    teamCounts: { unassigned: 1 },
  },

  [SlideType.ROLE_TIP]: {
    id: 'mock-role-tip',
    type: SlideType.ROLE_TIP,
    title: 'YOUR ROLE',
    roleId: 'seer',
    roleName: 'Seer',
    roleEmoji: '🔮',
    roleColor: '#c9a94c',
    team: 'village',
    detailedTip: 'Each night you may investigate one player to learn their team alignment.',
    abilities: [
      { label: 'INVESTIGATE', color: '#7eb8da' },
    ],
  },

  [`${SlideType.ROLE_TIP}_werewolf`]: {
    id: 'mock-role-tip-wolf',
    type: SlideType.ROLE_TIP,
    title: 'YOUR ROLE',
    roleId: 'werewolf',
    roleName: 'Werewolf',
    roleEmoji: '🐺',
    roleColor: '#c94c4c',
    team: 'werewolf',
    detailedTip: 'Each night you and your pack choose one player to eliminate.',
    abilities: [
      { label: 'KILL', color: '#c94c4c' },
    ],
  },

  [SlideType.ITEM_TIP]: {
    id: 'mock-item-tip',
    type: SlideType.ITEM_TIP,
    title: 'YOU FOUND AN ITEM',
    itemId: 'pistol',
    itemName: 'Pistol',
    itemEmoji: '🔫',
    maxUses: 1,
    itemDescription: 'During the day you may shoot one player, eliminating them immediately.',
  },

  [`${SlideType.ITEM_TIP}_passive`]: {
    id: 'mock-item-tip-passive',
    type: SlideType.ITEM_TIP,
    title: 'YOU HAVE AN ITEM',
    itemId: 'clue',
    itemName: 'Clue',
    itemEmoji: '🔍',
    maxUses: -1,
    itemDescription: 'Passively grants you participation in the Seer investigation each night.',
  },

  [SlideType.OPERATOR]: {
    id: 'mock-operator',
    type: SlideType.OPERATOR,
    title: 'TRANSMISSION RECEIVED',
    words: ['THE', 'WOLF', 'WALKS', 'AMONG', 'YOU'],
  },

  [SlideType.SCORES]: {
    id: 'mock-scores',
    type: SlideType.SCORES,
    title: 'SCOREBOARD',
    entries: [
      { name: 'Alice', portrait: 'player1.png', score: 12 },
      { name: 'Bob',   portrait: 'player2.png', score: 9  },
      { name: 'Carol', portrait: 'player3.png', score: 7  },
      { name: 'Dave',  portrait: 'player4.png', score: 4  },
    ],
  },

  [`${SlideType.SCORES}_empty`]: {
    id: 'mock-scores-empty',
    type: SlideType.SCORES,
    title: 'SCOREBOARD',
    entries: [],
  },

  [SlideType.HEARTBEAT]: {
    id: 'mock-heartbeat',
    type: SlideType.HEARTBEAT,
    title: 'MONITORING',
    subtitle: 'Vitals are elevated',
    playerId: 2,
    playerName: 'Bob',
    portrait: 'player2.png',
    bpm: 120,
    fake: false,
  },

  [`${SlideType.HEARTBEAT}_lost`]: {
    id: 'mock-heartbeat-lost',
    type: SlideType.HEARTBEAT,
    title: 'MONITORING',
    playerId: 4,
    playerName: 'Dave',
    portrait: 'player4.png',
    bpm: 0,
    fake: false,
  },

  [`${SlideType.HEARTBEAT}_debug`]: {
    id: 'mock-heartbeat-debug',
    type: SlideType.HEARTBEAT,
    title: 'MONITORING',
    playerId: 6,
    playerName: 'Frank',
    portrait: 'player6.png',
    bpm: 78,
    fake: true,
  },
}

// Which slides appear in the editor list and what variants they have
export const SLIDE_EDITOR_LIST = [
  {
    label: 'Fallback',
    type: 'fallback',
    variants: [
      { label: 'Lobby',    key: 'fallback_lobby', gameState: MOCK_GAME_STATE_LOBBY },
      { label: 'Day',      key: 'fallback_day',   gameState: MOCK_GAME_STATE_DAY   },
    ],
  },
  {
    label: 'Title',
    type: SlideType.TITLE,
    variants: [
      { label: 'With Portrait', key: SlideType.TITLE              },
      { label: 'No Portrait',   key: `${SlideType.TITLE}_noPlayer` },
    ],
  },
  {
    label: 'Player Reveal',
    type: SlideType.PLAYER_REVEAL,
    variants: [
      { label: 'Normal', key: SlideType.PLAYER_REVEAL            },
      { label: 'Jester', key: `${SlideType.PLAYER_REVEAL}_jester` },
    ],
  },
  {
    label: 'Vote Tally',
    type: SlideType.VOTE_TALLY,
    variants: [
      { label: 'Named',     key: SlideType.VOTE_TALLY        },
      { label: 'Anonymous', key: `${SlideType.VOTE_TALLY}_anon` },
    ],
  },
  {
    label: 'Gallery',
    type: SlideType.GALLERY,
    variants: [
      { label: 'Standard',      key: SlideType.GALLERY                   },
      { label: 'Targets Only',  key: `${SlideType.GALLERY}_targetsOnly`  },
      { label: 'Timer',         key: `${SlideType.GALLERY}_timer`        },
    ],
  },
  {
    label: 'Countdown',
    type: SlideType.COUNTDOWN,
    variants: [
      { label: 'Default', key: SlideType.COUNTDOWN },
    ],
  },
  {
    label: 'Death',
    type: SlideType.DEATH,
    variants: [
      { label: 'Normal', key: SlideType.DEATH           },
      { label: 'Coward', key: `${SlideType.DEATH}_coward` },
    ],
  },
  {
    label: 'Victory',
    type: SlideType.VICTORY,
    variants: [
      { label: 'Village', key: SlideType.VICTORY             },
      { label: 'Wolf',    key: `${SlideType.VICTORY}_werewolf` },
    ],
  },
  {
    label: 'Composition',
    type: SlideType.COMPOSITION,
    variants: [
      { label: 'Default', key: SlideType.COMPOSITION },
    ],
  },
  {
    label: 'Role Tip',
    type: SlideType.ROLE_TIP,
    variants: [
      { label: 'Village',  key: SlideType.ROLE_TIP             },
      { label: 'Werewolf', key: `${SlideType.ROLE_TIP}_werewolf` },
    ],
  },
  {
    label: 'Item Tip',
    type: SlideType.ITEM_TIP,
    variants: [
      { label: 'Single Use', key: SlideType.ITEM_TIP           },
      { label: 'Passive',    key: `${SlideType.ITEM_TIP}_passive` },
    ],
  },
  {
    label: 'Operator',
    type: SlideType.OPERATOR,
    variants: [
      { label: 'Default', key: SlideType.OPERATOR },
    ],
  },
  {
    label: 'Scores',
    type: SlideType.SCORES,
    variants: [
      { label: 'With Data', key: SlideType.SCORES        },
      { label: 'Empty',     key: `${SlideType.SCORES}_empty` },
    ],
  },
  {
    label: 'Heartbeat',
    type: SlideType.HEARTBEAT,
    variants: [
      { label: 'Active',      key: SlideType.HEARTBEAT            },
      { label: 'Signal Lost', key: `${SlideType.HEARTBEAT}_lost`  },
      { label: 'Debug',       key: `${SlideType.HEARTBEAT}_debug` },
    ],
  },
]

// Which SLIDE_STRINGS keys are shown per slide type in the editor
export const SLIDE_STRING_KEYS = {
  fallback:                  ['fallback'],
  [SlideType.TITLE]:         [],
  [SlideType.PLAYER_REVEAL]: [],
  [SlideType.VOTE_TALLY]:    [],
  [SlideType.GALLERY]:       ['gallery'],
  [SlideType.COUNTDOWN]:     [],
  [SlideType.DEATH]:         ['death', 'gallery'],
  [SlideType.VICTORY]:       [],
  [SlideType.COMPOSITION]:   ['composition'],
  [SlideType.ROLE_TIP]:      ['roleTip'],
  [SlideType.ITEM_TIP]:      ['roleTip'],
  [SlideType.OPERATOR]:      [],
  [SlideType.SCORES]:        ['scores'],
  [SlideType.HEARTBEAT]:     ['heartbeat'],
}
