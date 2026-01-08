// server/definitions/roles.js
// Declarative role definitions
// Each role specifies its team, abilities, and event participation

import { Team } from '../../shared/constants.js';

/**
 * Role Definition Schema:
 * {
 *   id: string,           // Unique identifier
 *   name: string,         // Display name
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
    name: 'Villager',
    team: Team.VILLAGE,
    description: 'A simple villager trying to survive.',
    color: '#7eb8da',
    emoji: '👨‍🌾',
    events: {
      vote: {},
      suspect: {},
    },
    passives: {},
  },

  werewolf: {
    id: 'werewolf',
    name: 'Werewolf',
    team: Team.WEREWOLF,
    description: 'A creature of the night who hunts the innocent.',
    color: '#c94c4c',
    emoji: '🐺',
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
    passives: {},
  },

  seer: {
    id: 'seer',
    name: 'Seer',
    team: Team.VILLAGE,
    description: 'Blessed with visions, you can peer into souls.',
    color: '#9b7ed9',
    emoji: '🔮',
    events: {
      vote: {},
      investigate: {
        priority: 30, // Investigate happens early
        canTarget: (player, target, game) => {
          return target.id !== player.id;
        },
        onResolve: (player, target, game) => {
          const isEvil = target.role.team === Team.WEREWOLF;
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
    name: 'Doctor',
    team: Team.VILLAGE,
    description: 'Your medical expertise can save lives.',
    color: '#7ed9a6',
    emoji: '🧑‍⚕️',
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
    name: 'Hunter',
    team: Team.VILLAGE,
    description: 'When you die, you take someone with you.',
    color: '#d9a67e',
    emoji: '🔫',
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
    name: 'Vigilante',
    team: Team.VILLAGE,
    description: 'You can kill one person during the night. Choose wisely.',
    color: '#8b7355',
    emoji: '🤠',
    events: {
      vote: {},
      vigilanteKill: {
        priority: 55,
        canTarget: (player, target, game) => target.id !== player.id,
      },
    },
    passives: {},
  },

  governor: {
    id: 'governor',
    name: 'Governor',
    team: Team.VILLAGE,
    description:
      'You can pardon someone from elimination after votes are cast.',
    color: '#d4af37',
    emoji: '🎩',
    events: {
      vote: {},
    },
    passives: {},
  },

  cupid: {
    id: 'cupid',
    name: 'Cupid',
    team: Team.VILLAGE,
    description: 'You bind two souls together in love.',
    color: '#e991c9',
    emoji: '💘',
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
            message: `You are in love with ${lover2.name}. If they die, you die of heartbreak.`,
          });
          game.sendPrivate(lover2.id, {
            type: 'notification',
            message: `You are in love with ${lover1.name}. If they die, you die of heartbreak.`,
          });

          return { success: true };
        },
      },
    },
    passives: {},
  },
};

// Role distribution by player count
export const roleDistribution = {
  4: ['werewolf', 'seer', 'villager', 'villager'],
  5: ['werewolf', 'seer', 'villager', 'villager', 'villager'],
  6: ['werewolf', 'seer', 'doctor', 'villager', 'villager', 'villager'],
  7: [
    'werewolf',
    'werewolf',
    'seer',
    'doctor',
    'villager',
    'villager',
    'villager',
  ],
  8: [
    'werewolf',
    'werewolf',
    'seer',
    'doctor',
    'vigilante',
    'villager',
    'villager',
    'villager',
  ],
  9: [
    'werewolf',
    'werewolf',
    'seer',
    'doctor',
    'hunter',
    'vigilante',
    'governor',
    'villager',
    'villager',
  ],
  10: [
    'werewolf',
    'werewolf',
    'seer',
    'doctor',
    'hunter',
    'vigilante',
    'governor',
    'villager',
    'villager',
    'villager',
  ],
};

export function getRole(roleId) {
  return roles[roleId] || null;
}

export function getAllRoles() {
  return { ...roles };
}

export default roles;
