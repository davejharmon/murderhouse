// server/definitions/roles.js
// Declarative role definitions
// Each role specifies its team, abilities, and event participation

import { Team, RoleId } from '../../shared/constants.js';

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
    tip: 'Good luck!',
    detailedTip: 'You have no special abilities. Good luck!',
    events: {
      vote: {},
      suspect: {},
    },
    passives: {},
  },

  alpha: {
    id: 'alpha',
    name: 'Alpha Werewolf',
    team: Team.WEREWOLF,
    description: 'The pack leader who makes the final kill.',
    color: '#f02121',
    emoji: '👑',
    tip: null, // Dynamic: shows packmate name
    detailedTip:
      'You are the pack leader. Each night, you choose who the wolves kill.',
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
          message: `${promoted.name} becomes the new Alpha!`,
        };
      },
    },
  },

  werewolf: {
    id: 'werewolf',
    name: 'Werewolf',
    team: Team.WEREWOLF,
    description: 'A member of the pack who hunts for the Alpha.',
    color: '#c94c4c',
    emoji: '🐺',
    tip: null, // Dynamic: shows packmate name
    detailedTip:
      'You hunt with the pack. Each night, suggest a target — the Alpha makes the final call.',
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
    name: 'Seer',
    team: Team.VILLAGE,
    description: 'Blessed with visions, you can peer into souls.',
    color: '#9b7ed9',
    emoji: '🔮',
    tip: 'Investigate each night',
    detailedTip:
      'Each night, investigate one player to learn if they are a werewolf.',
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
    tip: 'Protect someone each night',
    detailedTip:
      'Each night, choose one player to protect. You cannot choose the same target twice in a row.',
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
    tip: 'Revenge shot on death',
    detailedTip:
      'You have no night action, but when you die — by any cause — you take a revenge shot, killing one player of your choice. This trigger is automatic and cannot be prevented.',
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
    tip: 'One kill per game',
    detailedTip:
      'Once per game, you may kill a player at night. Use your one shot wisely.',
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
    name: 'Governor',
    team: Team.VILLAGE,
    description:
      'You can pardon someone from elimination after votes are cast.',
    color: '#d4af37',
    emoji: '🎩',
    tip: 'Pardon the condemned',
    detailedTip:
      'After a player is condemned by vote, you may pardon them — canceling the elimination. You have one pardon. Use it wiseley.',
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
    tip: 'Link two lovers',
    detailedTip:
      'At the start of the game, you link two players as lovers. If either dies, the other dies of heartbreak — regardless of team. Choose a pair that helps the village, or create chaos.',
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

  roleblocker: {
    id: 'roleblocker',
    name: 'Roleblocker',
    team: Team.WEREWOLF,
    description: "You silence the night. Block one player's ability.",
    color: '#c94c4c',

    emoji: '🚫',
    tip: null, // Dynamic: shows packmate names
    detailedTip:
      "Each night, choose a player to silence. Their night ability fails — and they won't know they were blocked. Neutralize the Doctor, Seer, or Vigilante at critical moments.",
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

  janitor: {
    id: 'janitor',
    name: 'Janitor',
    team: Team.WEREWOLF,
    description: "You clean up after the kill. The victim's role stays hidden.",
    color: '#c94c4c',
    emoji: '🧹',
    tip: null, // Dynamic: shows packmate names
    detailedTip:
      "Each night, choose whether to clean up. If you say YES and the Alpha kills, the victim's role stays hidden from everyone until the game ends. Use this to protect your pack from the Seer's deductions.",
    events: {
      vote: {},
      clean: { priority: 58 },
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
