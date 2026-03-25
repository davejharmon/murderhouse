// shared/constants.js
// Core vocabulary shared between client and server

export const GamePhase = {
  LOBBY: 'lobby',
  DAY: 'day',
  NIGHT: 'night',
  GAME_OVER: 'gameOver',
};

export const Team = {
  CIRCLE: 'circle',
  CELL: 'cell',
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
  LOG: 'log',           // Full snapshot (sent on initial connect)
  LOG_APPEND: 'logAppend', // Incremental — one or more new entries
  GAME_PRESETS: 'gamePresets',
  GAME_PRESET_LOADED: 'gamePresetLoaded',
  HOST_SETTINGS: 'hostSettings',
  OPERATOR_STATE: 'operatorState',
  SCORES: 'scores',
  CALIBRATION_STATE: 'calibrationState',
  HEARTRATE_MONITOR: 'heartrateMonitor',
  UPDATE_FIRMWARE: 'updateFirmware',
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
  SELECT_TO: 'selectTo',  // Set selection by explicit targetId (no response sent back)
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
  TOGGLE_HEARTBEAT_MODE: 'toggleHeartbeatMode',
  TOGGLE_FAKE_HEARTBEATS: 'toggleFakeHeartbeats',

  // Heartbeat calibration
  START_CALIBRATION: 'startCalibration',
  START_SINGLE_CALIBRATION: 'startSingleCalibration',
  STOP_CALIBRATION: 'stopCalibration',
  SAVE_CALIBRATION: 'saveCalibration',
  TOGGLE_PLAYER_HEARTBEAT: 'togglePlayerHeartbeat',
  SET_PLAYER_CALIBRATION: 'setPlayerCalibration',
  TOGGLE_PLAYER_SIMULATED: 'togglePlayerSimulated',

  // Operator terminal
  OPERATOR_JOIN: 'operatorJoin',
  OPERATOR_ADD: 'operatorAdd',
  OPERATOR_DELETE: 'operatorDelete',
  OPERATOR_READY: 'operatorReady',
  OPERATOR_UNREADY: 'operatorUnready',
  OPERATOR_CLEAR: 'operatorClear',
  OPERATOR_SEND: 'operatorSend',

  // Scores
  SET_SCORE: 'setScore',
  PUSH_SCORE_SLIDE: 'pushScoreSlide',

  // Firmware
  TRIGGER_FIRMWARE_UPDATE: 'triggerFirmwareUpdate',

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
  SCORE_UPDATE: 'scoreUpdate',
  BEST_SUSPECT: 'bestSuspect',
};

export const SlideStyle = {
  HOSTILE: 'hostile',     // Red - cell actions, eliminations, attacks
  POSITIVE: 'positive',   // Green - saves, pardons, protections, circle benefits
  NEUTRAL: 'neutral',     // Blue/default - generic game info, phase changes
  WARNING: 'warning',     // Yellow - mysterious actions, third faction (future use)
};

// Slide style color mappings
export const SlideStyleColors = {
  [SlideStyle.HOSTILE]: '#c94c4c',   // Red (cell color)
  [SlideStyle.POSITIVE]: '#7ed9a6',  // Green (medic color)
  [SlideStyle.NEUTRAL]: '#7eb8da',   // Blue (circle color)
  [SlideStyle.WARNING]: '#d4af37',   // Gold/yellow (judge color)
};

export const RoleId = {
  NOBODY: 'nobody',
  ALPHA: 'alpha',
  SLEEPER: 'sleeper',
  SEEKER: 'seeker',
  MEDIC: 'medic',
  HUNTER: 'hunter',
  VIGILANTE: 'vigilante',
  JUDGE: 'judge',
  CUPID: 'cupid',
  HANDLER: 'handler',
  FIXER: 'fixer',
  CHEMIST: 'chemist',
  AMATEUR: 'amateur',
  MARKED: 'marked',
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
  GAVEL: 'gavel',
  CLUE: 'clue',
  COWARD: 'coward',
  MARKED: 'marked',
  PROSPECT: 'prospect',
  HARDENED: 'hardened',
  NOVOTE: 'novote',
};

// Display info for roles (used by host UI for tutorial slide buttons)
export const ROLE_DISPLAY = {
  [RoleId.NOBODY]:      { name: 'Nobody',       emoji: '👨‍🌾' },
  [RoleId.ALPHA]:       { name: 'Alpha',        emoji: '👑' },
  [RoleId.SLEEPER]:     { name: 'Sleeper',      emoji: '🐺' },
  [RoleId.SEEKER]:      { name: 'Seeker',       emoji: '🔮' },
  [RoleId.MEDIC]:       { name: 'Medic',        emoji: '🧑‍⚕️' },
  [RoleId.HUNTER]:      { name: 'Hunter',       emoji: '🔫' },
  [RoleId.VIGILANTE]:   { name: 'Vigilante',    emoji: '🤠' },
  [RoleId.JUDGE]:       { name: 'Judge',         emoji: '🎩' },
  [RoleId.CUPID]:       { name: 'Cupid',        emoji: '💘' },
  [RoleId.HANDLER]:     { name: 'Handler',      emoji: '🚫' },
  [RoleId.FIXER]:       { name: 'Fixer',        emoji: '🧹' },
  [RoleId.CHEMIST]:     { name: 'Chemist',      emoji: '🧪' },
  [RoleId.AMATEUR]:     { name: 'Amateur',      emoji: '🥴' },
  [RoleId.MARKED]:      { name: 'Marked',       emoji: '🪡' },
  [RoleId.JESTER]:      { name: 'Jester',       emoji: '🃏' },
};

export const MIN_PLAYERS = 4;
export const MAX_PLAYERS = 10;

// Auto-advance delay for slides (in milliseconds)
export const AUTO_ADVANCE_DELAY = 3000; // 3 seconds

// Debug mode - enables testing tools
// Auto-enabled outside production; set NODE_ENV=production to disable
export const DEBUG_MODE = process.env.NODE_ENV !== 'production';

// Use pixel glyph icons instead of native emoji on Screen slides
export const USE_PIXEL_GLYPHS = true;

// Available items (for host UI)
export const AVAILABLE_ITEMS = [ItemId.PISTOL, ItemId.GAVEL, ItemId.CLUE, ItemId.COWARD, ItemId.MARKED, ItemId.PROSPECT, ItemId.HARDENED, ItemId.NOVOTE];

// Display info for items (used by host dashboard)
export const ITEM_DISPLAY = {
  [ItemId.PISTOL]:  { name: 'Pistol',  emoji: '🔫', description: 'A deadly weapon. One shot during the day. Make it count.' },
  [ItemId.GAVEL]:   { name: 'Gavel',   emoji: '⚖️', description: 'Invoke the Judge for a one-time pardon after a vote condemns someone.' },
  [ItemId.CLUE]:    { name: 'Clue',    emoji: '🔎', description: 'A mysterious lead. Investigate one player to learn their alignment.' },
  [ItemId.COWARD]:  { name: 'Coward',  emoji: '🏳️', description: 'You hide from danger. No attacks can reach you — but you cannot act or be voted for.' },
  [ItemId.MARKED]:   { name: 'Marked',   emoji: '🪡', description: 'Hidden curse. This player appears EVIL when investigated by the Seeker or Clue.' },
  [ItemId.PROSPECT]:  { name: 'Prospect',  emoji: '🐾', description: 'Hidden mark. If killed by the Cell, join them instead of dying.' },
  [ItemId.HARDENED]: { name: 'Hardened', emoji: '🛡️', description: 'A sturdy defense. The next time you would die, it absorbs the blow instead.' },
  [ItemId.NOVOTE]: { name: 'No Vote', emoji: '🚷', description: 'Hidden restraint. This player cannot vote in the next elimination vote.' },
};

// Available roles (for host pre-assignment UI)
export const AVAILABLE_ROLES = [
  RoleId.NOBODY,
  RoleId.ALPHA,
  RoleId.SLEEPER,
  RoleId.SEEKER,
  RoleId.MEDIC,
  RoleId.HUNTER,
  RoleId.VIGILANTE,
  RoleId.JUDGE,
  RoleId.CUPID,
  RoleId.HANDLER,
  RoleId.FIXER,
  RoleId.CHEMIST,
  RoleId.AMATEUR,
  RoleId.MARKED,
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
  WARNINGS:  ['BEWARE', 'TRUST', 'IGNORE', 'WATCH', 'LISTEN', 'REMEMBER', 'FORGET', 'SUSPECT', 'WARNED'],
  SUBJECTS:  ['THE', 'LOUD', 'QUIET', 'KIND', 'SCARED', 'ANGRY', 'CLEVER', 'COWARDLY', 'BRAVE',
              'BLESSED', 'LUCKY', 'UNLUCKY', 'LEFT', 'RIGHT', 'MEAN', 'SHOUTY', 'STRANGE',
              'ONE', 'THEM', 'ALL', 'NONE', 'FIRST', 'LAST',
              'GOOD', 'EVIL', 'REAL', 'FAKE', 'GUILTY', 'INNOCENT', 'OBVIOUS', 'ALONE', 'TRUE'],
  STATE:     ['LIES', 'KNOWS', 'HIDES', 'PROTECTS', 'HUNTS', 'IS', 'NOT', 'SOON', 'LATE', 'TOO',
              'SAFE', 'LOST', 'WRONG', 'STUPID', 'LYING', 'CRAZY', 'WILL', 'DIE', 'LIVE',
              'WIN', 'LOSE', 'NEXT', 'WANTS', 'HATES', 'THIS', 'THAT', 'CHANGES', 'STARTS', 'ENDS',
              'SAW', 'HEARD', 'TOLD', 'VOTED', 'SAVED', 'KILLED', 'CHOSE', 'FEARS', 'TRUSTS', 'LIED',
              'WAS', 'WERE', 'HAS', 'HAVE', 'DID', 'DOES', 'ONLY', 'EVEN', 'JUST', 'ALREADY', 'AGAIN', 'STILL'],
  CHAOS:     ['YIKES', 'SORRY', 'BYE', 'HELLO', 'HELP', 'NO', 'YES', 'MAYBE', 'RED', 'DARK',
              'SOON', 'ALWAYS', 'NEVER', 'DAVE',
              'OOPS', 'RIP', 'WELP', 'FINALLY', 'ANYWAY', 'HONESTLY', 'OBVIOUSLY', 'WHOOPS', 'THANKS'],
  PRONOUNS:  ['HE', 'SHE', 'THEY', 'YOU', 'I', 'WE', 'US', 'MY', 'YOUR', 'HIS', 'HER', 'IT',
              'A', 'AN', 'AND', 'BUT', 'OR', 'SO'],
  NOUNS:     ['WOLF', 'KILL', 'VOTE', 'NIGHT', 'DAY', 'TOWN', 'TRUTH', 'LIAR', 'KILLER', 'TEAM'],
};

// Category order for dial cycling (READY is special — not a word list)
export const OPERATOR_CATEGORIES = ['WARNINGS', 'SUBJECTS', 'STATE', 'CHAOS', 'PRONOUNS', 'NOUNS', 'READY'];
