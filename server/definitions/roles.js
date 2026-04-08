// server/definitions/roles.js
// Declarative role definitions
// Each role specifies its team, abilities, and event participation

import { Team, RoleId } from '../../shared/constants.js';
import { str } from '../strings.js';
import { Colors } from '../../shared/theme.js';

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
  citizen: {
    id: 'citizen',
    get name() { return str('roles', 'citizen.name') },
    team: Team.CITIZENS,
    get description() { return str('roles', 'citizen.description') },
    color: Colors.CIRCLE_BLUE,
    emoji: '👨‍🌾',
    get tip() { return str('roles', 'citizen.tip') },
    get detailedTip() { return str('roles', 'citizen.detailedTip') },
    events: {
      vote: {},
      suspect: {},
    },
    passives: {},
  },

  elder: {
    id: 'elder',
    get name() { return str('roles', 'elder.name') },
    get shortName() { return str('roles', 'elder.shortName') },
    team: Team.CHILDREN,
    get description() { return str('roles', 'elder.description') },
    color: Colors.ALPHA_RED,
    emoji: '👑',
    tip: null, // Dynamic: shows packmate name
    get detailedTip() { return str('roles', 'elder.detailedTip') },
    events: {
      vote: {},
      kill: {
        priority: 60, // Kills happen after protection
        canTarget: (player, target, game) => {
          // Can't target self or other cell members
          return target.id !== player.id && target.role.team !== Team.CHILDREN;
        },
      },
    },
    passives: {
      onDeath: (player, killer, game) => {
        // Promote a living cell member to elder: prefer children, then any team member
        const alive = game.getAlivePlayers();
        const children = alive.filter((p) => p.role.id === RoleId.CHILD);
        const candidates =
          children.length > 0
            ? children
            : alive.filter((p) => p.role.team === Team.CHILDREN);

        if (candidates.length === 0) return null;

        const promoted =
          candidates[Math.floor(Math.random() * candidates.length)];
        const elderRole = getRole(RoleId.ELDER);
        promoted.assignRole(elderRole);

        return {
          message: str('log', 'elderPromoted', { name: promoted.name }),
        };
      },
    },
  },

  child: {
    id: 'child',
    get name() { return str('roles', 'child.name') },
    team: Team.CHILDREN,
    get description() { return str('roles', 'child.description') },
    color: Colors.CELL_RED,
    emoji: '🐺',
    tip: null, // Dynamic: shows packmate name
    get detailedTip() { return str('roles', 'child.detailedTip') },
    events: {
      vote: {},
      hunt: {
        priority: 55, // Suggest targets before kill happens
        canTarget: (player, target, game) => {
          // Can't target self or other cell members
          return target.id !== player.id && target.role.team !== Team.CHILDREN;
        },
      },
    },
    passives: {},
  },

  detective: {
    id: 'detective',
    get name() { return str('roles', 'detective.name') },
    team: Team.CITIZENS,
    get description() { return str('roles', 'detective.description') },
    color: Colors.SEEKER_PURPLE,
    emoji: '🔮',
    get tip() { return str('roles', 'detective.tip') },
    get detailedTip() { return str('roles', 'detective.detailedTip') },
    events: {
      vote: {},
      investigate: {
        priority: 30, // Investigate happens early
        canTarget: (player, target, game) => {
          return target.id !== player.id;
        },
        onResolve: (player, target, game) => {
          const isEvil = target.role.team === Team.CHILDREN || !!target.role.appearsGuilty;
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

  doctor: {
    id: 'doctor',
    get name() { return str('roles', 'doctor.name') },
    team: Team.CITIZENS,
    get description() { return str('roles', 'doctor.description') },
    color: Colors.MEDIC_GREEN,
    emoji: '🧑‍⚕️',
    get tip() { return str('roles', 'doctor.tip') },
    get detailedTip() { return str('roles', 'doctor.detailedTip') },
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

  paranoid: {
    id: 'paranoid',
    get name() { return str('roles', 'paranoid.name') },
    team: Team.CITIZENS,
    get description() { return str('roles', 'paranoid.description') },
    color: Colors.HUNTER_TAN,
    emoji: '🔫',
    get tip() { return str('roles', 'paranoid.tip') },
    get detailedTip() { return str('roles', 'paranoid.detailedTip') },
    events: {
      vote: {},
      suspect: {},
    },
    passives: {
      onDeath: (player, killer, game) => {
        return {
          interrupt: true, // Pause for paranoid to choose
          message: `${player.name} was the Paranoid and gets a revenge shot!`,
        };
      },
    },
  },

  vigilante: {
    id: 'vigilante',
    get name() { return str('roles', 'vigilante.name') },
    team: Team.CITIZENS,
    get description() { return str('roles', 'vigilante.description') },
    color: Colors.VIGILANTE_BROWN,
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

  governor: {
    id: 'governor',
    get name() { return str('roles', 'governor.name') },
    team: Team.CITIZENS,
    get description() { return str('roles', 'governor.description') },
    color: Colors.GOVERNOR_GOLD,
    emoji: '🎩',
    get tip() { return str('roles', 'governor.tip') },
    get detailedTip() { return str('roles', 'governor.detailedTip') },
    events: {
      vote: {},
    },
    passives: {},
  },

  lover: {
    id: 'lover',
    get name() { return str('roles', 'lover.name') },
    team: Team.CITIZENS,
    get description() { return str('roles', 'lover.description') },
    color: Colors.CUPID_PINK,
    emoji: '💘',
    get tip() { return str('roles', 'lover.tip') },
    get detailedTip() { return str('roles', 'lover.detailedTip') },
    companions: [RoleId.LOVER], // Needs a second lover for two lover pairs
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
            message: str('roles', 'lover.loverMsg', { name: lover2.name }),
          });
          game.sendPrivate(lover2.id, {
            type: 'notification',
            message: str('roles', 'lover.loverMsg', { name: lover1.name }),
          });

          return { success: true };
        },
      },
    },
    passives: {},
  },

  silent: {
    id: 'silent',
    get name() { return str('roles', 'silent.name') },
    team: Team.CHILDREN,
    get description() { return str('roles', 'silent.description') },
    color: Colors.CELL_RED,
    emoji: '🚫',
    tip: null, // Dynamic: shows packmate names
    get detailedTip() { return str('roles', 'silent.detailedTip') },
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

  bitter: {
    id: 'bitter',
    get name() { return str('roles', 'bitter.name') },
    team: Team.CHILDREN,
    get description() { return str('roles', 'bitter.description') },
    color: Colors.CELL_RED,
    emoji: '🧪',
    tip: null, // Dynamic: shows packmate names
    get detailedTip() { return str('roles', 'bitter.detailedTip') },
    events: {
      vote: {},
      poison: { priority: 59 },
    },
    passives: {},
  },

  hidden: {
    id: 'hidden',
    get name() { return str('roles', 'hidden.name') },
    team: Team.CHILDREN,
    get description() { return str('roles', 'hidden.description') },
    color: Colors.CELL_RED,
    emoji: '🧹',
    tip: null, // Dynamic: shows packmate names
    get detailedTip() { return str('roles', 'hidden.detailedTip') },
    events: {
      vote: {},
      clean: { priority: 58 },
    },
    passives: {},
  },

  marked: {
    id: 'marked',
    get name() { return str('roles', 'marked.name') },
    team: Team.CITIZENS,
    get description() { return str('roles', 'marked.description') },
    color: Colors.CIRCLE_BLUE,
    emoji: '🪡',
    get tip() { return str('roles', 'marked.tip') },
    get detailedTip() { return str('roles', 'marked.detailedTip') },
    appearsGuilty: true, // Detective (and Clue) report this player as EVIL
    // What the Marked sees on their own terminal — identical to the Citizen
    disguiseAs: {
      id: 'citizen',
      get name() { return str('roles', 'citizen.name') },
      color: Colors.CIRCLE_BLUE,
      emoji: '👨‍🌾',
      get description() { return str('roles', 'citizen.description') },
    },
    events: {
      vote: {},
      suspect: {},
    },
    passives: {},
  },

  trickster: {
    id: 'trickster',
    get name() { return str('roles', 'trickster.name') },
    team: Team.OUTSIDER,
    get description() { return str('roles', 'trickster.description') },
    color: Colors.JESTER_ORANGE,
    emoji: '🃏',
    get tip() { return str('roles', 'trickster.tip') },
    get detailedTip() { return str('roles', 'trickster.detailedTip') },
    events: {
      vote: {},
    },
    passives: {
      onDeath: (player, cause, game) => {
        if (cause !== 'eliminated') return null;
        player.jesterWon = true;
        return { message: str('log', 'tricksterWins', { name: player.name }) };
      },
    },
  },

  wildcard: {
    id: 'wildcard',
    get name() { return str('roles', 'wildcard.name') },
    team: Team.CITIZENS,
    get description() { return str('roles', 'wildcard.description') },
    color: Colors.SEEKER_PURPLE,
    emoji: '🥴',
    get tip() { return str('roles', 'wildcard.tip') },
    get detailedTip() { return str('roles', 'wildcard.detailedTip') },
    // What the wildcard player sees on their own terminal — identical to the Detective
    disguiseAs: {
      id: 'detective',
      get name() { return str('roles', 'detective.name') },
      color: Colors.SEEKER_PURPLE,
      emoji: '🔮',
      get description() { return str('roles', 'detective.description') },
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

  jailer: {
    id: 'jailer',
    get name() { return str('roles', 'jailer.name') },
    team: Team.CITIZENS,
    get description() { return str('roles', 'jailer.description') },
    color: Colors.JAILER_GRAY,
    emoji: '🔒',
    get tip() { return str('roles', 'jailer.tip') },
    get detailedTip() { return str('roles', 'jailer.detailedTip') },
    events: {
      vote: {},
      jail: {
        priority: 3, // Before block (5) and protect (10)
        canTarget: (player, target, game) => target.id !== player.id,
      },
    },
    passives: {},
  },
};

// Explicit role composition keyed by player count
// Each value is the list of required special roles; remaining slots become citizens
export const GAME_COMPOSITION = {
  4: [RoleId.ELDER, RoleId.DETECTIVE],
  5: [RoleId.ELDER, RoleId.DETECTIVE],
  6: [RoleId.ELDER, RoleId.DETECTIVE, RoleId.DOCTOR],
  7: [RoleId.ELDER, RoleId.CHILD, RoleId.DETECTIVE, RoleId.DOCTOR],
  8: [
    RoleId.ELDER,
    RoleId.CHILD,
    RoleId.DETECTIVE,
    RoleId.DOCTOR,
    RoleId.VIGILANTE,
  ],
  9: [
    RoleId.ELDER,
    RoleId.CHILD,
    RoleId.SILENT,
    RoleId.DETECTIVE,
    RoleId.DOCTOR,
    RoleId.VIGILANTE,
    RoleId.PARANOID,
  ],
  10: [
    RoleId.ELDER,
    RoleId.CHILD,
    RoleId.SILENT,
    RoleId.DETECTIVE,
    RoleId.DOCTOR,
    RoleId.VIGILANTE,
    RoleId.PARANOID,
    RoleId.GOVERNOR,
  ],
};

// Build a role pool for a given player count from GAME_COMPOSITION, padded with citizens
export function buildRolePool(playerCount) {
  const composition = GAME_COMPOSITION[playerCount];
  if (!composition)
    throw new Error(`No composition for ${playerCount} players`);
  const pool = [...composition];
  while (pool.length < playerCount) pool.push(RoleId.CITIZEN);
  return pool;
}

export function getRole(roleId) {
  return roles[roleId] || null;
}

export function getAllRoles() {
  return { ...roles };
}

export default roles;
