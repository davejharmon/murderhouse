// shared/constants.js
// Core vocabulary shared between client and server

export const GamePhase = {
  LOBBY: 'lobby',
  DAY: 'day',
  NIGHT: 'night',
  GAME_OVER: 'gameOver',
};

export const Team = {
  VILLAGE: 'village',
  WEREWOLF: 'werewolf',
  NEUTRAL: 'neutral',
};

export const PlayerStatus = {
  ALIVE: 'alive',
  DEAD: 'dead',
  SPECTATOR: 'spectator',
};

// WebSocket message types - Server -> Client
export const ServerMsg = {
  WELCOME: 'welcome',
  ERROR: 'error',
  GAME_STATE: 'gameState',
  PLAYER_STATE: 'playerState',
  SLIDE: 'slide',
  SLIDE_QUEUE: 'slideQueue',
  EVENT_TIMER: 'eventTimer',
  PLAYER_LIST: 'playerList',
  EVENT_PROMPT: 'eventPrompt',
  EVENT_RESULT: 'eventResult',
  PHASE_CHANGE: 'phaseChange',
  LOG: 'log',
  GAME_PRESETS: 'gamePresets',
  GAME_PRESET_LOADED: 'gamePresetLoaded',
  HOST_SETTINGS: 'hostSettings',
  OPERATOR_STATE: 'operatorState',
  SCORES: 'scores',
};

// WebSocket message types - Client -> Server
export const ClientMsg = {
  // Connection
  JOIN: 'join',
  REJOIN: 'rejoin',
  
  // Player actions
  SET_NAME: 'setName',
  SELECT_UP: 'selectUp',
  SELECT_DOWN: 'selectDown',
  CONFIRM: 'confirm',
  CANCEL: 'cancel',
  ABSTAIN: 'abstain',
  USE_ITEM: 'useItem',
  IDLE_SCROLL_UP: 'idleScrollUp',
  IDLE_SCROLL_DOWN: 'idleScrollDown',
  
  // Host actions
  HOST_CONNECT: 'hostConnect',
  SCREEN_CONNECT: 'screenConnect',
  START_GAME: 'startGame',
  START_EVENT: 'startEvent',
  START_ALL_EVENTS: 'startAllEvents',
  CREATE_CUSTOM_EVENT: 'createCustomEvent',
  RESOLVE_EVENT: 'resolveEvent',
  RESOLVE_ALL_EVENTS: 'resolveAllEvents',
  SKIP_EVENT: 'skipEvent',
  RESET_EVENT: 'resetEvent',
  START_EVENT_TIMER: 'startEventTimer',
  NEXT_PHASE: 'nextPhase',
  END_GAME: 'endGame',
  RESET_GAME: 'resetGame',
  
  // Host slide controls
  NEXT_SLIDE: 'nextSlide',
  PREV_SLIDE: 'prevSlide',
  PUSH_SLIDE: 'pushSlide',
  CLEAR_SLIDES: 'clearSlides',
  
  // Host player management
  CHANGE_ROLE: 'changeRole',
  PRE_ASSIGN_ROLE: 'preAssignRole',
  RANDOMIZE_ROLES: 'randomizeRoles',
  KICK_PLAYER: 'kickPlayer',
  KILL_PLAYER: 'killPlayer',
  REVIVE_PLAYER: 'revivePlayer',
  SET_PLAYER_PORTRAIT: 'setPlayerPortrait',
  GIVE_ITEM: 'giveItem',
  REMOVE_ITEM: 'removeItem',

  // Tutorial slides
  PUSH_COMP_SLIDE: 'pushCompSlide',
  PUSH_ROLE_TIP_SLIDE: 'pushRoleTipSlide',
  PUSH_ITEM_TIP_SLIDE: 'pushItemTipSlide',

  // Game presets (named multi-slot)
  SAVE_GAME_PRESET: 'saveGamePreset',
  LOAD_GAME_PRESET: 'loadGamePreset',
  DELETE_GAME_PRESET: 'deleteGamePreset',
  LIST_GAME_PRESETS: 'listGamePresets',

  // Host settings
  SAVE_HOST_SETTINGS: 'saveHostSettings',
  SET_DEFAULT_PRESET: 'setDefaultPreset',

  // Heartbeat
  HEARTBEAT: 'heartbeat',
  PUSH_HEARTBEAT_SLIDE: 'pushHeartbeatSlide',

  // Operator terminal
  OPERATOR_JOIN: 'operatorJoin',
  OPERATOR_ADD: 'operatorAdd',
  OPERATOR_DELETE: 'operatorDelete',
  OPERATOR_READY: 'operatorReady',
  OPERATOR_UNREADY: 'operatorUnready',
  OPERATOR_SEND: 'operatorSend',

  // Scores
  SET_SCORE: 'setScore',
  PUSH_SCORE_SLIDE: 'pushScoreSlide',

  // Debug actions (only when DEBUG_MODE enabled)
  DEBUG_AUTO_SELECT: 'debugAutoSelect',
  DEBUG_AUTO_SELECT_ALL: 'debugAutoSelectAll',
};

export const SlideType = {
  TITLE: 'title',
  PLAYER_REVEAL: 'playerReveal',
  VOTE_TALLY: 'voteTally',
  GALLERY: 'gallery',
  COUNTDOWN: 'countdown',
  DEATH: 'death',
  VICTORY: 'victory',
  COMPOSITION: 'composition',
  ROLE_TIP: 'roleTip',
  ITEM_TIP: 'itemTip',
  HEARTBEAT: 'heartbeat',
  OPERATOR: 'operator',
  SCORES: 'scores',
};

export const SlideStyle = {
  HOSTILE: 'hostile',     // Red - werewolf actions, eliminations, attacks
  POSITIVE: 'positive',   // Green - saves, pardons, protections, village benefits
  NEUTRAL: 'neutral',     // Blue/default - generic game info, phase changes
  WARNING: 'warning',     // Yellow - mysterious actions, third faction (future use)
};

// Slide style color mappings
export const SlideStyleColors = {
  [SlideStyle.HOSTILE]: '#c94c4c',   // Red (werewolf color)
  [SlideStyle.POSITIVE]: '#7ed9a6',  // Green (doctor color)
  [SlideStyle.NEUTRAL]: '#7eb8da',   // Blue (village color)
  [SlideStyle.WARNING]: '#d4af37',   // Gold/yellow (governor color)
};

export const RoleId = {
  VILLAGER: 'villager',
  ALPHA: 'alpha',
  WEREWOLF: 'werewolf',
  SEER: 'seer',
  DOCTOR: 'doctor',
  HUNTER: 'hunter',
  VIGILANTE: 'vigilante',
  GOVERNOR: 'governor',
  CUPID: 'cupid',
  ROLEBLOCKER: 'roleblocker',
  JANITOR: 'janitor',
  POISONER: 'poisoner',
  DRUNK: 'drunk',
  TANNER: 'tanner',
  JESTER: 'jester',
};

export const EventId = {
  VOTE: 'vote',
  BLOCK: 'block',
  KILL: 'kill',
  PROTECT: 'protect',
  INVESTIGATE: 'investigate',
  SHOOT: 'shoot',
  HUNT: 'hunt',
  VIGIL: 'vigil',
  SUSPECT: 'suspect',
  CUSTOM_EVENT: 'customEvent',
  LINK: 'link',
  CLEAN: 'clean',
  POISON: 'poison',
  STUMBLE: 'stumble',
};

export const ItemId = {
  PISTOL: 'pistol',
  PHONE: 'phone',
  CLUE: 'clue',
  COWARD: 'coward',
  TANNED: 'tanned',
  PROSPECT: 'prospect',
  BARRICADE: 'barricade',
  NOVOTE: 'novote',
};

// Display info for roles (used by host UI for tutorial slide buttons)
export const ROLE_DISPLAY = {
  [RoleId.VILLAGER]:    { name: 'Villager',     emoji: '👨‍🌾' },
  [RoleId.ALPHA]:       { name: 'Alpha',        emoji: '👑' },
  [RoleId.WEREWOLF]:    { name: 'Werewolf',     emoji: '🐺' },
  [RoleId.SEER]:        { name: 'Seer',         emoji: '🔮' },
  [RoleId.DOCTOR]:      { name: 'Doctor',       emoji: '🧑‍⚕️' },
  [RoleId.HUNTER]:      { name: 'Hunter',       emoji: '🔫' },
  [RoleId.VIGILANTE]:   { name: 'Vigilante',    emoji: '🤠' },
  [RoleId.GOVERNOR]:    { name: 'Governor',     emoji: '🎩' },
  [RoleId.CUPID]:       { name: 'Cupid',        emoji: '💘' },
  [RoleId.ROLEBLOCKER]: { name: 'Roleblocker',  emoji: '🚫' },
  [RoleId.JANITOR]:     { name: 'Janitor',      emoji: '🧹' },
  [RoleId.POISONER]:    { name: 'Poisoner',     emoji: '🧪' },
  [RoleId.DRUNK]:       { name: 'Drunk',        emoji: '🥴' },
  [RoleId.TANNER]:      { name: 'Tanner',       emoji: '🪡' },
  [RoleId.JESTER]:      { name: 'Jester',       emoji: '🃏' },
};

export const MIN_PLAYERS = 4;
export const MAX_PLAYERS = 10;

// Auto-advance delay for slides (in milliseconds)
export const AUTO_ADVANCE_DELAY = 3000; // 3 seconds

// Debug mode - enables testing tools
export const DEBUG_MODE = true;

// Use pixel glyph icons instead of native emoji on Screen slides
export const USE_PIXEL_GLYPHS = true;

// Available items (for host UI)
export const AVAILABLE_ITEMS = [ItemId.PISTOL, ItemId.PHONE, ItemId.CLUE, ItemId.COWARD, ItemId.TANNED, ItemId.PROSPECT, ItemId.BARRICADE, ItemId.NOVOTE];

// Display info for items (used by host dashboard)
export const ITEM_DISPLAY = {
  [ItemId.PISTOL]:  { name: 'Pistol',  emoji: '🔫', description: 'A deadly weapon. One shot during the day. Make it count.' },
  [ItemId.PHONE]:   { name: 'Phone',   emoji: '📱', description: 'Call the Governor for a one-time pardon after a vote condemns someone.' },
  [ItemId.CLUE]:    { name: 'Clue',    emoji: '🔎', description: 'A mysterious lead. Investigate one player to learn their alignment.' },
  [ItemId.COWARD]:  { name: 'Coward',  emoji: '🏳️', description: 'You hide from danger. No attacks can reach you — but you cannot act or be voted for.' },
  [ItemId.TANNED]:   { name: 'Tanned',   emoji: '🪡', description: 'Hidden curse. This player appears EVIL when investigated by the Seer or Clue.' },
  [ItemId.PROSPECT]:  { name: 'Prospect',  emoji: '🐾', description: 'Hidden mark. If killed by werewolves, join their pack instead of dying.' },
  [ItemId.BARRICADE]: { name: 'Barricade', emoji: '🛡️', description: 'A sturdy defense. The next time you would die, the barricade breaks instead.' },
  [ItemId.NOVOTE]: { name: 'No Vote', emoji: '🚷', description: 'Hidden restraint. This player cannot vote in the next elimination vote.' },
};

// Available roles (for host pre-assignment UI)
export const AVAILABLE_ROLES = [
  RoleId.VILLAGER,
  RoleId.ALPHA,
  RoleId.WEREWOLF,
  RoleId.SEER,
  RoleId.DOCTOR,
  RoleId.HUNTER,
  RoleId.VIGILANTE,
  RoleId.GOVERNOR,
  RoleId.CUPID,
  RoleId.ROLEBLOCKER,
  RoleId.JANITOR,
  RoleId.POISONER,
  RoleId.DRUNK,
  RoleId.TANNER,
  RoleId.JESTER,
];

// LED states for physical buttons
export const LedState = {
  OFF: 'off',
  DIM: 'dim',
  BRIGHT: 'bright',
};

// Status LED states for neopixel (game state indicator)
export const StatusLed = {
  LOBBY: 'lobby',
  DAY: 'day',
  NIGHT: 'night',
  VOTING: 'voting',
  LOCKED: 'locked',
  ABSTAINED: 'abstained',
  DEAD: 'dead',
  GAME_OVER: 'gameOver',
};

// Icon column states
export const IconState = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  EMPTY: 'empty',
};

// Display line styles
export const DisplayStyle = {
  NORMAL: 'normal',
  LOCKED: 'locked',
  ABSTAINED: 'abstained',
  WAITING: 'waiting',
  CRITICAL: 'critical',
};

// Operator terminal word library
export const OPERATOR_WORDS = {
  WARNINGS: ['BEWARE', 'TRUST', 'IGNORE', 'WATCH', 'LISTEN', 'REMEMBER', 'FORGET', 'SUSPECT'],
  SUBJECTS: ['THE', 'LOUD', 'QUIET', 'KIND', 'SCARED', 'ANGRY', 'CLEVER', 'COWARDLY', 'BRAVE',
             'BLESSED', 'LUCKY', 'UNLUCKY', 'LEFT', 'RIGHT', 'MEAN', 'SHOUTY', 'STRANGE',
             'ONE', 'THEM', 'ALL', 'NONE', 'FIRST', 'LAST'],
  STATE:    ['LIES', 'KNOWS', 'HIDES', 'PROTECTS', 'HUNTS', 'IS', 'NOT', 'SOON', 'LATE', 'TOO',
             'SAFE', 'LOST', 'WRONG', 'STUPID', 'LYING', 'CRAZY', 'WILL', 'DIE', 'LIVE',
             'WIN', 'LOSE', 'NEXT', 'WANTS', 'HATES', 'THIS', 'THAT', 'CHANGES', 'STARTS', 'ENDS'],
  CHAOS:    ['YIKES', 'SORRY', 'BYE', 'HELLO', 'HELP', 'NO', 'YES', 'MAYBE', 'RED', 'DARK',
             'SOON', 'ALWAYS', 'NEVER', 'DAVE'],
};

// Category order for dial cycling (READY is special — not a word list)
export const OPERATOR_CATEGORIES = ['WARNINGS', 'SUBJECTS', 'STATE', 'CHAOS', 'READY'];
