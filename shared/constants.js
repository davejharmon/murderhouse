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
  PRE_ASSIGN_ROLE: 'preAssignRole',
  KICK_PLAYER: 'kickPlayer',
  KILL_PLAYER: 'killPlayer',
  REVIVE_PLAYER: 'revivePlayer',
  SET_PLAYER_PORTRAIT: 'setPlayerPortrait',
  GIVE_ITEM: 'giveItem',
  REMOVE_ITEM: 'removeItem',

  // Player presets
  SAVE_PLAYER_PRESETS: 'savePlayerPresets',
  LOAD_PLAYER_PRESETS: 'loadPlayerPresets',

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
};

export const EventId = {
  VOTE: 'vote',
  KILL: 'kill',
  PROTECT: 'protect',
  INVESTIGATE: 'investigate',
  SHOOT: 'shoot',
  HUNT: 'hunt',
  VIGIL: 'vigil',
  SUSPECT: 'suspect',
  CUSTOM_EVENT: 'customEvent',
  LINK: 'link',
};

export const ItemId = {
  PISTOL: 'pistol',
  PHONE: 'phone',
  CRYSTAL_BALL: 'crystalBall',
};

export const MIN_PLAYERS = 4;
export const MAX_PLAYERS = 10;

// Auto-advance delay for slides (in milliseconds)
export const AUTO_ADVANCE_DELAY = 3000; // 3 seconds

// Event timer duration (in milliseconds)
export const EVENT_TIMER_DURATION = 3000;

// Debug mode - enables testing tools
export const DEBUG_MODE = true;

// Available items (for host UI)
export const AVAILABLE_ITEMS = [ItemId.PISTOL, ItemId.PHONE, ItemId.CRYSTAL_BALL];

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
];

// Display glyphs for TinyScreen
// Format: :glyphId: in strings, rendered differently by React vs ESP
export const Glyphs = {
  PISTOL: ':pistol:',
  PHONE: ':phone:',
  CRYSTAL: ':crystal:',
  WOLF: ':wolf:',
  VILLAGE: ':village:',
  LOCK: ':lock:',
  CHECK: ':check:',
  X: ':x:',
  ALPHA: ':alpha:',
  PACK: ':pack:',
  SKULL: ':skull:',
};

// Item ID to glyph mapping
export const ItemGlyphs = {
  [ItemId.PISTOL]: Glyphs.PISTOL,
  [ItemId.PHONE]: Glyphs.PHONE,
  [ItemId.CRYSTAL_BALL]: Glyphs.CRYSTAL,
};

// LED states for physical buttons
export const LedState = {
  OFF: 'off',
  DIM: 'dim',
  BRIGHT: 'bright',
  PULSE: 'pulse',
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
};
