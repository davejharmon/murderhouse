// server/definitions/events.js
// Declarative event definitions
// Events are actions that players can take during specific phases

import { GamePhase, Team } from '../../shared/constants.js';
import { getRole } from './roles.js';

/**
 * Event Definition Schema:
 * {
 *   id: string,              // Unique identifier
 *   name: string,            // Display name
 *   description: string,     // Shown to player when event is active
 *   phase: GamePhase[],      // Which phases this event can occur in
 *   priority: number,        // Resolution order (lower = earlier)
 *   
 *   // Who participates in this event
 *   participants: (game) => Player[],
 *   
 *   // Who can be targeted
 *   validTargets: (actor, game) => Player[],
 *   
 *   // How votes are aggregated
 *   aggregation: 'majority' | 'individual' | 'all',
 *   
 *   // Can the event resolve with no/partial responses?
 *   allowAbstain: boolean,
 *   
 *   // Resolution logic
 *   resolve: (results, game) => ResolveResult,
 *   
 *   // Slide to show when event resolves (optional)
 *   resultSlide?: (result, game) => Slide,
 * }
 */

const events = {
  vote: {
    id: 'vote',
    name: 'Vote',
    description: 'Choose who to eliminate.',
    phase: [GamePhase.DAY],
    priority: 50,

    participants: (game) => game.getAlivePlayers(),

    validTargets: (actor, game) => {
      // Check for runoff voting - only show runoff candidates
      const instance = game.activeEvents.get('vote');
      if (instance?.runoffCandidates && instance.runoffCandidates.length > 0) {
        return instance.runoffCandidates
          .map(id => game.getPlayer(id))
          .filter(p => p && p.id !== actor.id);
      }

      return game.getAlivePlayers().filter(p => p.id !== actor.id);
    },

    aggregation: 'majority',
    allowAbstain: true,

    resolve: (results, game) => {
      const instance = game.activeEvents.get('vote');
      const runoffRound = instance?.runoffRound || 0;

      // Count votes
      const tally = {};
      for (const [voterId, targetId] of Object.entries(results)) {
        if (targetId === null) continue; // Abstained
        tally[targetId] = (tally[targetId] || 0) + 1;
      }

      if (Object.keys(tally).length === 0) {
        return {
          success: true,
          outcome: 'no-kill',
          message: 'No one was eliminated.',
          slide: { type: 'title', title: 'NO ELIMINATION', subtitle: 'The village could not decide.' },
        };
      }

      // Find max votes
      const maxVotes = Math.max(...Object.values(tally));
      const frontrunners = Object.keys(tally).filter(id => tally[id] === maxVotes);

      if (frontrunners.length > 1) {
        // Tie detected
        if (runoffRound >= 3) {
          // After 3 runoffs, pick randomly
          const winnerId = frontrunners[Math.floor(Math.random() * frontrunners.length)];
          const eliminated = game.getPlayer(winnerId);
          game.killPlayer(eliminated.id, 'eliminated');

          return {
            success: true,
            outcome: 'eliminated',
            eliminated,
            tally,
            message: `After multiple runoffs, ${eliminated.name} was randomly selected for elimination.`,
            slide: {
              type: 'death',
              playerId: eliminated.id,
              title: 'ELIMINATED (TIE-BREAKER)',
              subtitle: eliminated.name,
              revealRole: true,
            },
          };
        }

        // Trigger runoff
        return {
          success: true,
          runoff: true,
          frontrunners,
          tally,
          message: `Vote tied. Starting runoff with ${frontrunners.length} candidates.`,
        };
      }

      const eliminated = game.getPlayer(frontrunners[0]);
      game.killPlayer(eliminated.id, 'eliminated');

      return {
        success: true,
        outcome: 'eliminated',
        eliminated,
        tally,
        message: `${eliminated.name} was eliminated.`,
        slide: {
          type: 'death',
          playerId: eliminated.id,
          title: 'ELIMINATED',
          subtitle: eliminated.name,
          revealRole: true,
        },
      };
    },
  },

  suspect: {
    id: 'suspect',
    name: 'Suspect',
    description: 'Who do you think is a werewolf?',
    phase: [GamePhase.NIGHT],
    priority: 80, // Low priority - just tracking
    
    participants: (game) => {
      return game.getAlivePlayers().filter(p => p.role.id === 'villager' || p.role.id === 'hunter');
    },
    
    validTargets: (actor, game) => {
      return game.getAlivePlayers().filter(p => p.id !== actor.id);
    },
    
    aggregation: 'individual',
    allowAbstain: true,
    
    resolve: (results, game) => {
      // Just record suspicions for potential scoring
      for (const [actorId, targetId] of Object.entries(results)) {
        if (targetId === null) continue;
        const actor = game.getPlayer(actorId);
        const target = game.getPlayer(targetId);
        if (!actor.suspicions) actor.suspicions = [];
        actor.suspicions.push({
          day: game.dayCount,
          targetId,
          wasCorrect: target.role.team === Team.WEREWOLF,
        });
      }
      return { success: true, silent: true };
    },
  },

  kill: {
    id: 'kill',
    name: 'Kill',
    description: 'Choose your victim.',
    phase: [GamePhase.NIGHT],
    priority: 60,
    
    participants: (game) => {
      return game.getAlivePlayers().filter(p => p.role.team === Team.WEREWOLF);
    },
    
    validTargets: (actor, game) => {
      return game.getAlivePlayers().filter(p => p.role.team !== Team.WEREWOLF);
    },
    
    aggregation: 'majority', // Werewolves vote together
    allowAbstain: false,
    
    resolve: (results, game) => {
      // Count werewolf votes
      const tally = {};
      for (const [voterId, targetId] of Object.entries(results)) {
        if (targetId === null) continue;
        tally[targetId] = (tally[targetId] || 0) + 1;
      }
      
      if (Object.keys(tally).length === 0) {
        return {
          success: true,
          outcome: 'no-kill',
          message: 'The werewolves chose not to kill.',
        };
      }
      
      // Find victim (ties resolved randomly)
      const maxVotes = Math.max(...Object.values(tally));
      const candidates = Object.keys(tally).filter(id => tally[id] === maxVotes);
      const victimId = candidates[Math.floor(Math.random() * candidates.length)];
      const victim = game.getPlayer(victimId);
      
      // Check protection
      if (victim.isProtected) {
        victim.isProtected = false;
        return {
          success: true,
          outcome: 'protected',
          targetId: victimId,
          message: `The werewolves attacked ${victim.name}, but they were protected!`,
          slide: { type: 'title', title: 'PROTECTED', subtitle: 'Someone was saved tonight.' },
        };
      }
      
      game.killPlayer(victim.id, 'werewolf');
      
      return {
        success: true,
        outcome: 'killed',
        victim,
        message: `${victim.name} was killed by werewolves.`,
        slide: {
          type: 'death',
          playerId: victim.id,
          title: 'MURDERED',
          subtitle: victim.name,
          revealRole: true,
        },
      };
    },
  },

  investigate: {
    id: 'investigate',
    name: 'Investigate',
    description: 'Choose someone to investigate.',
    phase: [GamePhase.NIGHT],
    priority: 30,
    
    participants: (game) => {
      return game.getAlivePlayers().filter(p => p.role.id === 'seer');
    },
    
    validTargets: (actor, game) => {
      return game.getAlivePlayers().filter(p => p.id !== actor.id);
    },
    
    aggregation: 'individual',
    allowAbstain: true,
    
    resolve: (results, game) => {
      const investigations = [];
      
      for (const [actorId, targetId] of Object.entries(results)) {
        if (targetId === null) continue;
        const seer = game.getPlayer(actorId);
        const target = game.getPlayer(targetId);
        const isEvil = target.role.team === Team.WEREWOLF;
        
        if (!seer.investigations) seer.investigations = [];
        seer.investigations.push({
          day: game.dayCount,
          targetId,
          targetName: target.name,
          isEvil,
        });
        
        investigations.push({
          seerId: actorId,
          targetId,
          targetName: target.name,
          isEvil,
          privateMessage: `${target.name} is ${isEvil ? 'EVIL' : 'INNOCENT'}.`,
        });
      }
      
      return {
        success: true,
        investigations,
        // Each seer gets a private result - handled by game
      };
    },
  },

  protect: {
    id: 'protect',
    name: 'Protect',
    description: 'Choose someone to protect tonight.',
    phase: [GamePhase.NIGHT],
    priority: 10, // First to resolve
    
    participants: (game) => {
      return game.getAlivePlayers().filter(p => p.role.id === 'doctor');
    },
    
    validTargets: (actor, game) => {
      // Can protect anyone alive, including self
      // Optional: prevent protecting same person twice
      return game.getAlivePlayers();
    },
    
    aggregation: 'individual',
    allowAbstain: true,
    
    resolve: (results, game) => {
      for (const [actorId, targetId] of Object.entries(results)) {
        if (targetId === null) continue;
        const target = game.getPlayer(targetId);
        target.isProtected = true;
        
        const doctor = game.getPlayer(actorId);
        doctor.lastProtected = targetId;
      }
      
      return {
        success: true,
        silent: true, // No public announcement
      };
    },
  },

  hunterRevenge: {
    id: 'hunterRevenge',
    name: 'Hunter\'s Revenge',
    description: 'Choose who to take with you.',
    phase: [GamePhase.DAY, GamePhase.NIGHT], // Can trigger in either
    priority: 100, // Immediate
    isInterrupt: true, // Pauses normal flow

    participants: (game) => {
      // Dynamically set when triggered
      return game.interruptData?.hunter ? [game.interruptData.hunter] : [];
    },

    validTargets: (actor, game) => {
      return game.getAlivePlayers().filter(p => p.id !== actor.id);
    },

    aggregation: 'individual',
    allowAbstain: false,

    resolve: (results, game) => {
      const [[hunterId, targetId]] = Object.entries(results);
      const hunter = game.getPlayer(hunterId);
      const victim = game.getPlayer(targetId);

      game.killPlayer(victim.id, 'hunter');

      return {
        success: true,
        victim,
        message: `${hunter.name} took ${victim.name} down with them!`,
        slide: {
          type: 'death',
          playerId: victim.id,
          title: 'REVENGE',
          subtitle: `${victim.name} was shot by the Hunter`,
          revealRole: true,
        },
      };
    },
  },

  shoot: {
    id: 'shoot',
    name: 'Shoot',
    description: 'Use your pistol to shoot someone.',
    phase: [GamePhase.DAY],
    priority: 40, // Before vote (50)

    participants: (game) => {
      // Players with a pistol that has uses remaining
      return game.getAlivePlayers().filter(p => p.hasItem('pistol') && p.canUseItem('pistol'));
    },

    validTargets: (actor, game) => {
      return game.getAlivePlayers().filter(p => p.id !== actor.id);
    },

    aggregation: 'individual',
    allowAbstain: true,

    // Immediate action on selection - execute and push slide right away
    onSelection: (shooterId, targetId, game) => {
      const shooter = game.getPlayer(shooterId);
      if (!shooter) return null;

      // Player abstained
      if (targetId === null) {
        return {
          message: `${shooter.name} chose not to shoot.`,
          slide: {
            type: 'title',
            title: 'NO SHOTS FIRED',
            subtitle: `${shooter.name} is keeping their powder dry... for now.`,
          },
        };
      }

      // Player shot someone - execute immediately
      const victim = game.getPlayer(targetId);
      if (!victim) return null;

      // Kill the victim
      game.killPlayer(victim.id, 'shot');

      // Consume the pistol use
      game.consumeItem(shooterId, 'pistol');

      return {
        message: `${shooter.name} shot ${victim.name} with a pistol!`,
        slide: {
          type: 'death',
          playerId: victim.id,
          shooterId: shooter.id,
          title: 'GUNSHOT',
          subtitle: `${shooter.name} shot ${victim.name}!`,
          revealRole: true,
        },
      };
    },

    resolve: (results, game) => {
      // All actions already executed in onSelection, just clean up
      return {
        success: true,
        silent: true, // No new slides or messages needed
      };
    },
  },

  customVote: {
    id: 'customVote',
    name: 'Custom Vote',
    description: 'Vote for a custom reward.',
    phase: [GamePhase.DAY],
    priority: 45, // Before vote (50), after shoot (40)

    participants: (game) => game.getAlivePlayers(),

    validTargets: (actor, game) => {
      const instance = game.activeEvents.get('customVote');

      // Check for runoff voting - only show runoff candidates
      if (instance?.runoffCandidates && instance.runoffCandidates.length > 0) {
        return instance.runoffCandidates
          .map(id => game.getPlayer(id))
          .filter(p => p);
      }

      // Check reward type from config
      if (instance?.config?.rewardType === 'resurrection') {
        // Only dead players are valid targets for resurrection
        return [...game.players.values()].filter(p => !p.isAlive);
      }

      // For item/role rewards, all alive players INCLUDING SELF
      return game.getAlivePlayers();
    },

    aggregation: 'majority',
    allowAbstain: true,

    resolve: (results, game) => {
      const instance = game.activeEvents.get('customVote');
      const config = instance?.config;
      const runoffRound = instance?.runoffRound || 0;

      if (!config) {
        return {
          success: false,
          message: 'Custom vote configuration missing',
        };
      }

      // Count votes
      const tally = {};
      for (const [voterId, targetId] of Object.entries(results)) {
        if (targetId === null) continue; // Abstained
        tally[targetId] = (tally[targetId] || 0) + 1;
      }

      if (Object.keys(tally).length === 0) {
        return {
          success: true,
          outcome: 'no-winner',
          message: 'No votes were cast.',
          slide: {
            type: 'title',
            title: 'NO WINNER',
            subtitle: config.description,
          },
        };
      }

      // Find winner
      const maxVotes = Math.max(...Object.values(tally));
      const frontrunners = Object.keys(tally).filter(id => tally[id] === maxVotes);

      if (frontrunners.length > 1) {
        // Tie detected
        if (runoffRound >= 3) {
          // After 3 runoffs, pick randomly
          const winnerId = frontrunners[Math.floor(Math.random() * frontrunners.length)];
          return resolveCustomVoteReward(winnerId, config, game, tally, true);
        }

        // Trigger runoff
        return {
          success: true,
          runoff: true,
          frontrunners,
          tally,
          message: `Custom vote tied. Starting runoff with ${frontrunners.length} candidates.`,
        };
      }

      return resolveCustomVoteReward(frontrunners[0], config, game, tally, false);
    },
  },
};

/**
 * Helper function to resolve custom vote rewards
 */
function resolveCustomVoteReward(winnerId, config, game, tally, wasTie) {
  const winner = game.getPlayer(winnerId);

  if (!winner) {
    return {
      success: false,
      message: 'Winner not found',
    };
  }

  let message = '';
  let slideSubtitle = winner.name;

  switch (config.rewardType) {
    case 'item':
      game.giveItem(winner.id, config.rewardParam);
      message = `${winner.name} received ${config.rewardParam}!`;
      slideSubtitle = `${winner.name} received ${config.rewardParam}`;
      break;

    case 'role':
      const newRole = getRole(config.rewardParam);
      if (newRole) {
        winner.assignRole(newRole);
        message = `${winner.name} became ${newRole.name}!`;
        slideSubtitle = `${winner.name} is now ${newRole.name}`;
      }
      break;

    case 'resurrection':
      if (!winner.isAlive) {
        game.revivePlayer(winner.id, 'vote');
        message = `${winner.name} was resurrected!`;
        slideSubtitle = `${winner.name} returns from the dead`;
      } else {
        message = `${winner.name} was chosen but is already alive.`;
      }
      break;
  }

  if (wasTie) {
    message = `After multiple runoffs, tie broken randomly. ${message}`;
  }

  return {
    success: true,
    outcome: 'reward-given',
    winner,
    tally,
    message,
    slide: {
      type: 'voteTally',
      tally,
      title: 'CUSTOM VOTE RESULT',
      subtitle: slideSubtitle,
    },
  };
}

export function getEvent(eventId) {
  return events[eventId] || null;
}

export function getEventsForPhase(phase) {
  return Object.values(events)
    .filter(e => e.phase.includes(phase) && !e.isInterrupt)
    .sort((a, b) => a.priority - b.priority);
}

export function getAllEvents() {
  return { ...events };
}

export default events;
