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
  villager: {
    id: 'villager',
    get name() { return str('roles', 'villager.name') },
    team: Team.VILLAGE,
    get description() { return str('roles', 'villager.description') },
    color: '#7eb8da',
    emoji: '👨‍🌾',
    get tip() { return str('roles', 'villager.tip') },
    get detailedTip() { return str('roles', 'villager.detailedTip') },
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
    team: Team.WEREWOLF,
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
          // Can't target self or other werewolves
          return target.id !== player.id && target.role.team !== Team.WEREWOLF;
        },
      },
    },
    passives: {
      onDeath: (player, killer, game) => {
        // Promote a living pack member to alpha: prefer werewolves, then any team member
        const alive = game.getAlivePlayers();
        const werewolves = alive.filter((p) => p.role.id === RoleId.WEREWOLF);
        const candidates =
          werewolves.length > 0
            ? werewolves
            : alive.filter((p) => p.role.team === Team.WEREWOLF);

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

  werewolf: {
    id: 'werewolf',
    get name() { return str('roles', 'werewolf.name') },
    team: Team.WEREWOLF,
    get description() { return str('roles', 'werewolf.description') },
    color: '#c94c4c',
    emoji: '🐺',
    tip: null, // Dynamic: shows packmate name
    get detailedTip() { return str('roles', 'werewolf.detailedTip') },
    events: {
      vote: {},
      hunt: {
        priority: 55, // Suggest targets before kill happens
        canTarget: (player, target, game) => {
          // Can't target self or other werewolves
          return target.id !== player.id && target.role.team !== Team.WEREWOLF;
        },
      },
    },
    passives: {},
  },

  seer: {
    id: 'seer',
    get name() { return str('roles', 'seer.name') },
    team: Team.VILLAGE,
    get description() { return str('roles', 'seer.description') },
    color: '#9b7ed9',
    emoji: '🔮',
    get tip() { return str('roles', 'seer.tip') },
    get detailedTip() { return str('roles', 'seer.detailedTip') },
    events: {
      vote: {},
      investigate: {
        priority: 30, // Investigate happens early
        canTarget: (player, target, game) => {
          return target.id !== player.id;
        },
        onResolve: (player, target, game) => {
          const isEvil = target.role.team === Team.WEREWOLF || !!target.role.appearsGuilty;
          return {
            success: true,
            privateMessage: `${target.name} is ${
              isEvil ? 'a WEREWOLF' : 'NOT a werewolf'
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
    team: Team.VILLAGE,
    get description() { return str('roles', 'doctor.description') },
    color: '#7ed9a6',
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

  hunter: {
    id: 'hunter',
    get name() { return str('roles', 'hunter.name') },
    team: Team.VILLAGE,
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
    team: Team.VILLAGE,
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

  governor: {
    id: 'governor',
    get name() { return str('roles', 'governor.name') },
    team: Team.VILLAGE,
    get description() { return str('roles', 'governor.description') },
    color: '#d4af37',
    emoji: '🎩',
    get tip() { return str('roles', 'governor.tip') },
    get detailedTip() { return str('roles', 'governor.detailedTip') },
    events: {
      vote: {},
    },
    passives: {},
  },

  cupid: {
    id: 'cupid',
    get name() { return str('roles', 'cupid.name') },
    team: Team.VILLAGE,
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

  roleblocker: {
    id: 'roleblocker',
    get name() { return str('roles', 'roleblocker.name') },
    team: Team.WEREWOLF,
    get description() { return str('roles', 'roleblocker.description') },
    color: '#c94c4c',
    emoji: '🚫',
    tip: null, // Dynamic: shows packmate names
    get detailedTip() { return str('roles', 'roleblocker.detailedTip') },
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

  poisoner: {
    id: 'poisoner',
    get name() { return str('roles', 'poisoner.name') },
    team: Team.WEREWOLF,
    get description() { return str('roles', 'poisoner.description') },
    color: '#c94c4c',
    emoji: '🧪',
    tip: null, // Dynamic: shows packmate names
    get detailedTip() { return str('roles', 'poisoner.detailedTip') },
    events: {
      vote: {},
      poison: { priority: 59 },
    },
    passives: {},
  },

  janitor: {
    id: 'janitor',
    get name() { return str('roles', 'janitor.name') },
    team: Team.WEREWOLF,
    get description() { return str('roles', 'janitor.description') },
    color: '#c94c4c',
    emoji: '🧹',
    tip: null, // Dynamic: shows packmate names
    get detailedTip() { return str('roles', 'janitor.detailedTip') },
    events: {
      vote: {},
      clean: { priority: 58 },
    },
    passives: {},
  },

  tanner: {
    id: 'tanner',
    get name() { return str('roles', 'tanner.name') },
    team: Team.VILLAGE,
    get description() { return str('roles', 'tanner.description') },
    color: '#7eb8da',
    emoji: '🪡',
    get tip() { return str('roles', 'tanner.tip') },
    get detailedTip() { return str('roles', 'tanner.detailedTip') },
    appearsGuilty: true, // Seer (and Clue) report this player as EVIL
    // What the Tanner sees on their own terminal — identical to the Villager
    disguiseAs: {
      id: 'villager',
      get name() { return str('roles', 'villager.name') },
      color: '#7eb8da',
      emoji: '👨‍🌾',
      get description() { return str('roles', 'villager.description') },
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

  drunk: {
    id: 'drunk',
    get name() { return str('roles', 'drunk.name') },
    team: Team.VILLAGE,
    get description() { return str('roles', 'drunk.description') },
    color: '#9b7ed9',
    emoji: '🥴',
    get tip() { return str('roles', 'drunk.tip') },
    get detailedTip() { return str('roles', 'drunk.detailedTip') },
    // What the drunk player sees on their own terminal — identical to the Seer
    disguiseAs: {
      id: 'seer',
      get name() { return str('roles', 'seer.name') },
      color: '#9b7ed9',
      emoji: '🔮',
      get description() { return str('roles', 'seer.description') },
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
// Each value is the list of required special roles; remaining slots become villagers
export const GAME_COMPOSITION = {
  4: [RoleId.ALPHA, RoleId.SEER],
  5: [RoleId.ALPHA, RoleId.SEER],
  6: [RoleId.ALPHA, RoleId.SEER, RoleId.DOCTOR],
  7: [RoleId.ALPHA, RoleId.WEREWOLF, RoleId.SEER, RoleId.DOCTOR],
  8: [
    RoleId.ALPHA,
    RoleId.WEREWOLF,
    RoleId.SEER,
    RoleId.DOCTOR,
    RoleId.VIGILANTE,
  ],
  9: [
    RoleId.ALPHA,
    RoleId.WEREWOLF,
    RoleId.ROLEBLOCKER,
    RoleId.SEER,
    RoleId.DOCTOR,
    RoleId.VIGILANTE,
    RoleId.HUNTER,
  ],
  10: [
    RoleId.ALPHA,
    RoleId.WEREWOLF,
    RoleId.ROLEBLOCKER,
    RoleId.SEER,
    RoleId.DOCTOR,
    RoleId.VIGILANTE,
    RoleId.HUNTER,
    RoleId.GOVERNOR,
  ],
};

// Build a role pool for a given player count from GAME_COMPOSITION, padded with villagers
export function buildRolePool(playerCount) {
  const composition = GAME_COMPOSITION[playerCount];
  if (!composition)
    throw new Error(`No composition for ${playerCount} players`);
  const pool = [...composition];
  while (pool.length < playerCount) pool.push(RoleId.VILLAGER);
  return pool;
}

export function getRole(roleId) {
  return roles[roleId] || null;
}

export function getAllRoles() {
  return { ...roles };
}

export default roles;
