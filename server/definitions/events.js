// server/definitions/events.js
// Declarative event definitions
// Events are actions that players can take during specific phases

import { GamePhase, Team } from '../../shared/constants.js';

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
      return game.getAlivePlayers().filter(p => p.id !== actor.id);
    },
    
    aggregation: 'majority',
    allowAbstain: true,
    
    resolve: (results, game) => {
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
        // Tie - could trigger tiebreaker or random
        return {
          success: true,
          outcome: 'tie',
          message: 'The vote was tied.',
          tiedPlayers: frontrunners.map(id => game.getPlayer(id)),
          tally,
          slide: { type: 'voteTally', tally, title: 'DEADLOCK', subtitle: 'No majority reached.' },
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
};

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
