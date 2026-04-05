// shared/theme.js
// Single source of truth for all named color constants.
// Import from here instead of hardcoding hex values in role/item definitions.

export const Colors = {
  // Role colors
  CIRCLE_BLUE: '#7eb8da',      // Nobody, Marked, Jailer (default circle)
  ALPHA_RED: '#f02121',        // Alpha (bright cell red)
  CELL_RED: '#c94c4c',         // Sleeper, Handler, Chemist, Fixer (also: HOSTILE slide style)
  SEEKER_PURPLE: '#9b7ed9',    // Seeker, Amateur
  MEDIC_GREEN: '#7ed9a6',      // Medic (also: POSITIVE slide style)
  HUNTER_TAN: '#d9a67e',       // Hunter
  VIGILANTE_BROWN: '#8b7355',  // Vigilante
  GOVERNOR_GOLD: '#d4af37',    // Governor/Judge (also: WARNING slide style)
  CUPID_PINK: '#e991c9',       // Cupid
  JESTER_ORANGE: '#e8a020',    // Jester
  JAILER_GRAY: '#8a8a8a',      // Jailer
}
