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
  NEXT_PHASE: 'nextPhase',
  END_GAME: 'endGame',
  RESET_GAME: 'resetGame',
  
  // Host slide controls
  NEXT_SLIDE: 'nextSlide',
  PREV_SLIDE: 'prevSlide',
  PUSH_SLIDE: 'pushSlide',
  CLEAR_SLIDES: 'clearSlides',
  
  // Host player management
  KICK_PLAYER: 'kickPlayer',
  KILL_PLAYER: 'killPlayer',
  REVIVE_PLAYER: 'revivePlayer',
  SET_PLAYER_PORTRAIT: 'setPlayerPortrait',
  GIVE_ITEM: 'giveItem',
  REMOVE_ITEM: 'removeItem',

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

export const MIN_PLAYERS = 4;
export const MAX_PLAYERS = 10;

// Auto-advance delay for slides (in milliseconds)
export const AUTO_ADVANCE_DELAY = 3000; // 3 seconds

// Debug mode - enables testing tools
export const DEBUG_MODE = true;

// Available items (for host UI)
export const AVAILABLE_ITEMS = ['pistol', 'phone', 'crystalBall'];

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
  pistol: Glyphs.PISTOL,
  phone: Glyphs.PHONE,
  crystalBall: Glyphs.CRYSTAL,
};

// LED states for physical buttons
export const LedState = {
  OFF: 'off',
  DIM: 'dim',
  BRIGHT: 'bright',
  PULSE: 'pulse',
};

// Display line styles
export const DisplayStyle = {
  NORMAL: 'normal',
  LOCKED: 'locked',
  ABSTAINED: 'abstained',
  WAITING: 'waiting',
};
