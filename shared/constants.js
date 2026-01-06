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
  
  // Host actions
  HOST_CONNECT: 'hostConnect',
  SCREEN_CONNECT: 'screenConnect',
  START_GAME: 'startGame',
  START_EVENT: 'startEvent',
  START_ALL_EVENTS: 'startAllEvents',
  RESOLVE_EVENT: 'resolveEvent',
  RESOLVE_ALL_EVENTS: 'resolveAllEvents',
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

export const MIN_PLAYERS = 4;
export const MAX_PLAYERS = 9;
