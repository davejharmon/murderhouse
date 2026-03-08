// server/definitions/roles.js
// Declarative role definitions
// Each role specifies its team, abilities, and event participation

import { Team, RoleId } from '../../shared/constants.js';
import { str } from '../strings.js';

/**
 * Role Definition Schema:
 * {
 *   id: string,           // Unique identifier
 *   name: string,         // Full display name
 *   shortName?: string,   // Optional compact name for space-constrained displays
 *   team: Team,           // Which team this role belongs to
 *   description: string,  // Flavor text for reveal
 *   color: string,        // UI color for this role
 *
 *   // Events this role participates in (keys are event IDs)
 *   events: {
 *     [eventId]: {
 *       priority?: number,    // Lower = resolves first (default: 50)
 *       canTarget?: (player, target, game) => boolean,
 *       onResolve?: (player, target, game) => ResolveResult,
 *     }
 *   },
 *
 *   // Passive abilities triggered by game events
 *   passives: {
 *     onDeath?: (player, killer, game) => void,
 *     onNightStart?: (player, game) => void,
 *     onDayStart?: (player, game) => void,
 *   },
 *
 *   // Win condition override (if different from team)
 *   checkWin?: (player, game) => boolean | null,
 * }
 */

const roles = {
  nobody: {
    id: 'nobody',
    get name() { return str('roles', 'nobody.name') },
    team: Team.CIRCLE,
    get description() { return str('roles', 'nobody.description') },
    color: '#7eb8da',
    emoji: '👨‍🌾',
    get tip() { return str('roles', 'nobody.tip') },
    get detailedTip() { return str('roles', 'nobody.detailedTip') },
    events: {
      vote: {},
      suspect: {},
    },
    passives: {},
  },

  alpha: {
    id: 'alpha',
    get name() { return str('roles', 'alpha.name') },
    get shortName() { return str('roles', 'alpha.shortName') },
    team: Team.CELL,
    get description() { return str('roles', 'alpha.description') },
    color: '#f02121',
    emoji: '👑',
    tip: null, // Dynamic: shows packmate name
    get detailedTip() { return str('roles', 'alpha.detailedTip') },
    events: {
      vote: {},
      kill: {
        priority: 60, // Kills happen after protection
        canTarget: (player, target, game) => {
          // Can't target self or other cell members
          return target.id !== player.id && target.role.team !== Team.CELL;
        },
      },
    },
    passives: {
      onDeath: (player, killer, game) => {
        // Promote a living cell member to alpha: prefer sleepers, then any team member
        const alive = game.getAlivePlayers();
        const sleepers = alive.filter((p) => p.role.id === RoleId.SLEEPER);
        const candidates =
          sleepers.length > 0
            ? sleepers
            : alive.filter((p) => p.role.team === Team.CELL);

        if (candidates.length === 0) return null;

        const promoted =
          candidates[Math.floor(Math.random() * candidates.length)];
        const alphaRole = getRole(RoleId.ALPHA);
        promoted.assignRole(alphaRole);

        return {
          message: str('log', 'alphaPromoted', { name: promoted.name }),
        };
      },
    },
  },

  sleeper: {
    id: 'sleeper',
    get name() { return str('roles', 'sleeper.name') },
    team: Team.CELL,
    get description() { return str('roles', 'sleeper.description') },
    color: '#c94c4c',
    emoji: '🐺',
    tip: null, // Dynamic: shows packmate name
    get detailedTip() { return str('roles', 'sleeper.detailedTip') },
    events: {
      vote: {},
      hunt: {
        priority: 55, // Suggest targets before kill happens
        canTarget: (player, target, game) => {
          // Can't target self or other cell members
          return target.id !== player.id && target.role.team !== Team.CELL;
        },
      },
    },
    passives: {},
  },

  seeker: {
    id: 'seeker',
    get name() { return str('roles', 'seeker.name') },
    team: Team.CIRCLE,
    get description() { return str('roles', 'seeker.description') },
    color: '#9b7ed9',
    emoji: '🔮',
    get tip() { return str('roles', 'seeker.tip') },
    get detailedTip() { return str('roles', 'seeker.detailedTip') },
    events: {
      vote: {},
      investigate: {
        priority: 30, // Investigate happens early
        canTarget: (player, target, game) => {
          return target.id !== player.id;
        },
        onResolve: (player, target, game) => {
          const isEvil = target.role.team === Team.CELL || !!target.role.appearsGuilty;
          return {
            success: true,
            privateMessage: `${target.name} is ${
              isEvil ? 'CELL' : 'NOT CELL'
            }.`,
            data: { targetId: target.id, isEvil },
          };
        },
      },
    },
    passives: {},
  },

  medic: {
    id: 'medic',
    get name() { return str('roles', 'medic.name') },
    team: Team.CIRCLE,
    get description() { return str('roles', 'medic.description') },
    color: '#7ed9a6',
    emoji: '🧑‍⚕️',
    get tip() { return str('roles', 'medic.tip') },
    get detailedTip() { return str('roles', 'medic.detailedTip') },
    events: {
      vote: {},
      protect: {
        priority: 10, // Protection happens first
        canTarget: (player, target, game) => {
          // Optional: can't protect same person twice in a row
          // return player.lastProtected !== target.id;
          return true;
        },
        onResolve: (player, target, game) => {
          target.isProtected = true;
          player.lastProtected = target.id;
          return {
            success: true,
            privateMessage: `You are protecting ${target.name} tonight.`,
            data: { targetId: target.id },
          };
        },
      },
    },
    passives: {},
  },

  hunter: {
    id: 'hunter',
    get name() { return str('roles', 'hunter.name') },
    team: Team.CIRCLE,
    get description() { return str('roles', 'hunter.description') },
    color: '#d9a67e',
    emoji: '🔫',
    get tip() { return str('roles', 'hunter.tip') },
    get detailedTip() { return str('roles', 'hunter.detailedTip') },
    events: {
      vote: {},
      suspect: {},
    },
    passives: {
      onDeath: (player, killer, game) => {
        return {
          interrupt: true, // Pause for hunter to choose
          message: `${player.name} was the Hunter and gets a revenge shot!`,
        };
      },
    },
  },

  vigilante: {
    id: 'vigilante',
    get name() { return str('roles', 'vigilante.name') },
    team: Team.CIRCLE,
    get description() { return str('roles', 'vigilante.description') },
    color: '#8b7355',
    emoji: '🤠',
    get tip() { return str('roles', 'vigilante.tip') },
    get detailedTip() { return str('roles', 'vigilante.detailedTip') },
    events: {
      vote: {},
      vigil: {
        priority: 55,
        canTarget: (player, target, game) => target.id !== player.id,
      },
    },
    passives: {},
  },

  judge: {
    id: 'judge',
    get name() { return str('roles', 'judge.name') },
    team: Team.CIRCLE,
    get description() { return str('roles', 'judge.description') },
    color: '#d4af37',
    emoji: '🎩',
    get tip() { return str('roles', 'judge.tip') },
    get detailedTip() { return str('roles', 'judge.detailedTip') },
    events: {
      vote: {},
    },
    passives: {},
  },

  cupid: {
    id: 'cupid',
    get name() { return str('roles', 'cupid.name') },
    team: Team.CIRCLE,
    get description() { return str('roles', 'cupid.description') },
    color: '#e991c9',
    emoji: '💘',
    get tip() { return str('roles', 'cupid.tip') },
    get detailedTip() { return str('roles', 'cupid.detailedTip') },
    companions: [RoleId.CUPID], // Needs a second cupid for two lover pairs
    events: {
      vote: {},
      link: {
        priority: 1, // Happens at very start of game
        phase: 'setup', // Special phase - only runs once at game start
        targetCount: 2, // Selects two targets
        canTarget: (player, target, game) => {
          return target.id !== player.id;
        },
        onResolve: (player, targets, game) => {
          const [lover1, lover2] = targets;
          lover1.linkedTo = lover2.id;
          lover2.linkedTo = lover1.id;

          // Notify the lovers
          game.sendPrivate(lover1.id, {
            type: 'notification',
            message: str('roles', 'cupid.loverMsg', { name: lover2.name }),
          });
          game.sendPrivate(lover2.id, {
            type: 'notification',
            message: str('roles', 'cupid.loverMsg', { name: lover1.name }),
          });

          return { success: true };
        },
      },
    },
    passives: {},
  },

  handler: {
    id: 'handler',
    get name() { return str('roles', 'handler.name') },
    team: Team.CELL,
    get description() { return str('roles', 'handler.description') },
    color: '#c94c4c',
    emoji: '🚫',
    tip: null, // Dynamic: shows packmate names
    get detailedTip() { return str('roles', 'handler.detailedTip') },
    events: {
      vote: {},
      block: {
        priority: 5, // Resolves before all other night events
        canTarget: (player, target, game) => {
          return target.id !== player.id;
        },
      },
    },
    passives: {},
  },

  chemist: {
    id: 'chemist',
    get name() { return str('roles', 'chemist.name') },
    team: Team.CELL,
    get description() { return str('roles', 'chemist.description') },
    color: '#c94c4c',
    emoji: '🧪',
    tip: null, // Dynamic: shows packmate names
    get detailedTip() { return str('roles', 'chemist.detailedTip') },
    events: {
      vote: {},
      poison: { priority: 59 },
    },
    passives: {},
  },

  fixer: {
    id: 'fixer',
    get name() { return str('roles', 'fixer.name') },
    team: Team.CELL,
    get description() { return str('roles', 'fixer.description') },
    color: '#c94c4c',
    emoji: '🧹',
    tip: null, // Dynamic: shows packmate names
    get detailedTip() { return str('roles', 'fixer.detailedTip') },
    events: {
      vote: {},
      clean: { priority: 58 },
    },
    passives: {},
  },

  marked: {
    id: 'marked',
    get name() { return str('roles', 'marked.name') },
    team: Team.CIRCLE,
    get description() { return str('roles', 'marked.description') },
    color: '#7eb8da',
    emoji: '🪡',
    get tip() { return str('roles', 'marked.tip') },
    get detailedTip() { return str('roles', 'marked.detailedTip') },
    appearsGuilty: true, // Seeker (and Clue) report this player as EVIL
    // What the Marked sees on their own terminal — identical to the Nobody
    disguiseAs: {
      id: 'nobody',
      get name() { return str('roles', 'nobody.name') },
      color: '#7eb8da',
      emoji: '👨‍🌾',
      get description() { return str('roles', 'nobody.description') },
    },
    events: {
      vote: {},
      suspect: {},
    },
    passives: {},
  },

  jester: {
    id: 'jester',
    get name() { return str('roles', 'jester.name') },
    team: Team.NEUTRAL,
    get description() { return str('roles', 'jester.description') },
    color: '#e8a020',
    emoji: '🃏',
    get tip() { return str('roles', 'jester.tip') },
    get detailedTip() { return str('roles', 'jester.detailedTip') },
    events: {
      vote: {},
    },
    passives: {
      onDeath: (player, cause, game) => {
        if (cause !== 'eliminated') return null;
        player.jesterWon = true;
        return { message: str('log', 'jesterWins', { name: player.name }) };
      },
    },
  },

  amateur: {
    id: 'amateur',
    get name() { return str('roles', 'amateur.name') },
    team: Team.CIRCLE,
    get description() { return str('roles', 'amateur.description') },
    color: '#9b7ed9',
    emoji: '🥴',
    get tip() { return str('roles', 'amateur.tip') },
    get detailedTip() { return str('roles', 'amateur.detailedTip') },
    // What the amateur player sees on their own terminal — identical to the Seeker
    disguiseAs: {
      id: 'seeker',
      get name() { return str('roles', 'seeker.name') },
      color: '#9b7ed9',
      emoji: '🔮',
      get description() { return str('roles', 'seeker.description') },
    },
    events: {
      vote: {},
      stumble: {
        priority: 30,
        canTarget: (player, target, game) => target.id !== player.id,
      },
    },
    passives: {},
  },
};

// Explicit role composition keyed by player count
// Each value is the list of required special roles; remaining slots become nobodies
export const GAME_COMPOSITION = {
  4: [RoleId.ALPHA, RoleId.SEEKER],
  5: [RoleId.ALPHA, RoleId.SEEKER],
  6: [RoleId.ALPHA, RoleId.SEEKER, RoleId.MEDIC],
  7: [RoleId.ALPHA, RoleId.SLEEPER, RoleId.SEEKER, RoleId.MEDIC],
  8: [
    RoleId.ALPHA,
    RoleId.SLEEPER,
    RoleId.SEEKER,
    RoleId.MEDIC,
    RoleId.VIGILANTE,
  ],
  9: [
    RoleId.ALPHA,
    RoleId.SLEEPER,
    RoleId.HANDLER,
    RoleId.SEEKER,
    RoleId.MEDIC,
    RoleId.VIGILANTE,
    RoleId.HUNTER,
  ],
  10: [
    RoleId.ALPHA,
    RoleId.SLEEPER,
    RoleId.HANDLER,
    RoleId.SEEKER,
    RoleId.MEDIC,
    RoleId.VIGILANTE,
    RoleId.HUNTER,
    RoleId.JUDGE,
  ],
};

// Build a role pool for a given player count from GAME_COMPOSITION, padded with nobodies
export function buildRolePool(playerCount) {
  const composition = GAME_COMPOSITION[playerCount];
  if (!composition)
    throw new Error(`No composition for ${playerCount} players`);
  const pool = [...composition];
  while (pool.length < playerCount) pool.push(RoleId.NOBODY);
  return pool;
}

export function getRole(roleId) {
  return roles[roleId] || null;
}

export function getAllRoles() {
  return { ...roles };
}

export default roles;
