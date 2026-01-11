// server/definitions/events.js
// Declarative event definitions
// Events are actions that players can take during specific phases

import { GamePhase, Team, SlideStyle } from '../../shared/constants.js';
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
 *
 * Resolution Result Pattern:
 * - All results must include { success: true/false }
 * - Lethal outcomes use { outcome: 'killed'|'eliminated', victim: Player }
 * - Non-lethal outcomes use { outcome: '...', target?: Player }
 *
 * Silent Flag Pattern:
 * - { silent: true } = No logging, no eventResults, no slides
 *   Use for: internal no-ops (player abstained, nothing happened)
 * - { silent: false } or omitted = Log message, add to eventResults
 *   Use for: actions that happened but don't need public display
 * - { slide: {...} } = Show slide on big screen
 *   Use for: public outcomes that players need to see
 */

const events = {
  vote: {
    id: 'vote',
    name: 'Vote',
    description: 'Choose who to eliminate.',
    verb: 'vote for',
    verbPastTense: 'voted for',
    phase: [GamePhase.DAY],
    priority: 50,
    anonymousVoting: false, // If true, show vote counts; if false, show voter portraits

    participants: (game) => game.getAlivePlayers(),

    validTargets: (actor, game) => {
      // Check for runoff voting - only show runoff candidates
      const instance = game.activeEvents.get('vote');
      if (instance?.runoffCandidates && instance.runoffCandidates.length > 0) {
        return instance.runoffCandidates
          .map((id) => game.getPlayer(id))
          .filter((p) => p && p.id !== actor.id);
      }

      return game.getAlivePlayers().filter((p) => p.id !== actor.id);
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
          slide: {
            type: 'title',
            title: 'NO ELIMINATION',
            subtitle: 'The village could not decide.',
            style: SlideStyle.NEUTRAL,
          },
        };
      }

      // Find max votes
      const maxVotes = Math.max(...Object.values(tally));
      const frontrunners = Object.keys(tally).filter(
        (id) => tally[id] === maxVotes
      );

      if (frontrunners.length > 1) {
        // Tie detected
        if (runoffRound >= 3) {
          // After 3 runoffs, pick randomly
          const winnerId =
            frontrunners[Math.floor(Math.random() * frontrunners.length)];
          const victim = game.getPlayer(winnerId);
          // Don't kill yet - let Game.js handle it after checking for governor

          const teamDisplayNames = { village: 'VILLAGER', werewolf: 'WEREWOLF', neutral: 'INDEPENDENT' };
          const teamName = teamDisplayNames[victim.role?.team] || 'PLAYER';
          return {
            success: true,
            outcome: 'eliminated',
            victim,
            tally,
            message: `After multiple runoffs, ${victim.name} was randomly selected for elimination.`,
            slide: {
              type: 'death',
              playerId: victim.id,
              title: `${teamName} ELIMINATED`,
              subtitle: victim.name,
              revealRole: true,
              style: SlideStyle.HOSTILE,
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

      const victim = game.getPlayer(frontrunners[0]);
      // Don't kill yet - let Game.js handle it after checking for governor

      const teamDisplayNames = { village: 'VILLAGER', werewolf: 'WEREWOLF', neutral: 'INDEPENDENT' };
      const teamName = teamDisplayNames[victim.role?.team] || 'PLAYER';
      return {
        success: true,
        outcome: 'eliminated',
        victim,
        tally,
        message: `${victim.name} was eliminated.`,
        slide: {
          type: 'death',
          playerId: victim.id,
          title: `${teamName} ELIMINATED`,
          subtitle: victim.name,
          revealRole: true,
          style: SlideStyle.HOSTILE,
        },
      };
    },
  },

  // Note: pardon has been migrated to server/flows/GovernorPardonFlow.js

  vigil: {
    id: 'vigil',
    name: 'Vigilante Kill',
    description: 'Choose someone to eliminate. This is your only shot.',
    verb: 'shoot',
    verbPastTense: 'shot',
    phase: [GamePhase.NIGHT],
    priority: 55,

    participants: (game) => {
      return game
        .getAlivePlayers()
        .filter((p) => p.role.id === 'vigilante' && !p.vigilanteUsed);
    },

    validTargets: (actor, game) => {
      return game.getAlivePlayers().filter((p) => p.id !== actor.id);
    },

    aggregation: 'individual',
    allowAbstain: true,

    resolve: (results, game) => {
      const kills = [];

      for (const [vigilanteId, targetId] of Object.entries(results)) {
        if (targetId === null) continue; // Abstain = keep ability

        const vigilante = game.getPlayer(vigilanteId);
        const target = game.getPlayer(targetId);

        if (!vigilante || !target) continue;

        // Mark as used
        vigilante.vigilanteUsed = true;

        // Check protection
        if (target.isProtected) {
          target.isProtected = false;
          kills.push({
            vigilanteId,
            vigilante,
            targetId,
            target,
            protected: true,
          });
          continue;
        }

        // Kill the target
        game.killPlayer(target.id, 'vigilante');

        const teamDisplayNames = { village: 'VILLAGER', werewolf: 'WEREWOLF', neutral: 'INDEPENDENT' };
        const teamName = teamDisplayNames[target.role?.team] || 'PLAYER';
        kills.push({
          vigilanteId,
          vigilante,
          targetId,
          target,
          killed: true,
          victim: target,
          slide: {
            type: 'death',
            playerId: target.id,
            title: `${teamName} KILLED`,
            subtitle: `${target.name} was killed in the night`,
            revealRole: true,
            style: SlideStyle.HOSTILE,
          },
        });
      }

      if (kills.length === 0) {
        return { success: true, silent: true };
      }

      const kill = kills[0];
      if (kill.protected) {
        return {
          success: true,
          outcome: 'protected',
          message: `${kill.target.getNameWithEmoji()} was protected`,
          slide: {
            type: 'title',
            title: 'PROTECTED',
            subtitle: 'Someone survived an attack tonight.',
            style: SlideStyle.POSITIVE,
          },
        };
      }

      return {
        success: true,
        outcome: 'killed',
        victim: kill.victim,
        message: `${kill.vigilante.getNameWithEmoji()} shot ${kill.target.getNameWithEmoji()}`,
        slide: kill.slide,
      };
    },
  },

  suspect: {
    id: 'suspect',
    name: 'Suspect',
    description: 'Who do you think is a werewolf?',
    verb: 'suspect',
    verbPastTense: 'suspected',
    phase: [GamePhase.NIGHT],
    priority: 80, // Low priority - just tracking

    participants: (game) => {
      return game
        .getAlivePlayers()
        .filter(
          (p) =>
            p.role.id === 'villager' ||
            p.role.id === 'hunter' ||
            p.role.id === 'vigilante' ||
            p.role.id === 'governor'
        );
    },

    validTargets: (actor, game) => {
      return game.getAlivePlayers().filter((p) => p.id !== actor.id);
    },

    aggregation: 'individual',
    allowAbstain: true,

    resolve: (results, game) => {
      const suspicions = [];

      // Record suspicions for potential scoring
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

        suspicions.push({ actor, target });
      }

      if (suspicions.length === 0) {
        return { success: true, silent: true };
      }

      const messages = suspicions.map(
        (s) =>
          `${s.actor.getNameWithEmoji()} suspects ${s.target.getNameWithEmoji()}`
      );

      return {
        success: true,
        message: messages.join(' '),
      };
    },
  },

  kill: {
    id: 'kill',
    name: 'Kill',
    description: 'Choose your victim.',
    verb: 'target',
    verbPastTense: 'targeted',
    phase: [GamePhase.NIGHT],
    priority: 60,

    participants: (game) => {
      return game
        .getAlivePlayers()
        .filter((p) => p.role.id === 'alpha'); // Only alphas
    },

    validTargets: (actor, game) => {
      return game
        .getAlivePlayers()
        .filter((p) => p.role.team !== Team.WEREWOLF);
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
        return { success: true, silent: true };
      }

      // Find victim (ties resolved randomly)
      const maxVotes = Math.max(...Object.values(tally));
      const candidates = Object.keys(tally).filter(
        (id) => tally[id] === maxVotes
      );
      const victimId =
        candidates[Math.floor(Math.random() * candidates.length)];
      const victim = game.getPlayer(victimId);

      // Check protection
      if (victim.isProtected) {
        victim.isProtected = false;
        return {
          success: true,
          outcome: 'protected',
          targetId: victimId,
          message: `${victim.getNameWithEmoji()} was protected`,
          slide: {
            type: 'title',
            title: 'PROTECTED',
            subtitle: 'Someone was saved tonight.',
            style: SlideStyle.POSITIVE,
          },
        };
      }

      game.killPlayer(victim.id, 'werewolf');

      const teamDisplayNames = { village: 'VILLAGER', werewolf: 'WEREWOLF', neutral: 'INDEPENDENT' };
      const teamName = teamDisplayNames[victim.role?.team] || 'PLAYER';
      return {
        success: true,
        outcome: 'killed',
        victim,
        message: `${victim.getNameWithEmoji()} was killed by werewolves`,
        slide: {
          type: 'death',
          playerId: victim.id,
          title: `${teamName} MURDERED`,
          subtitle: victim.name,
          revealRole: true,
          style: SlideStyle.HOSTILE,
        },
      };
    },
  },

  hunt: {
    id: 'hunt',
    name: 'Hunt',
    description: 'Suggest a target for the Alpha to hunt.',
    verb: 'suggest',
    verbPastTense: 'suggested',
    phase: [GamePhase.NIGHT],
    priority: 55, // Before kill (60)

    participants: (game) => {
      return game
        .getAlivePlayers()
        .filter((p) => p.role.id === 'werewolf'); // Only regular werewolves
    },

    validTargets: (actor, game) => {
      return game
        .getAlivePlayers()
        .filter((p) => p.role.team !== Team.WEREWOLF);
    },

    aggregation: 'individual', // Each werewolf suggests independently
    allowAbstain: true,

    resolve: (results, game) => {
      const suggestions = [];

      for (const [werewolfId, targetId] of Object.entries(results)) {
        if (targetId === null) continue;
        const werewolf = game.getPlayer(werewolfId);
        const target = game.getPlayer(targetId);

        suggestions.push({ werewolf, target });
      }

      if (suggestions.length === 0) {
        return { success: true, silent: true };
      }

      const messages = suggestions.map(
        (s) =>
          `${s.werewolf.getNameWithEmoji()} suggested ${s.target.getNameWithEmoji()}`
      );

      return {
        success: true,
        silent: true, // Don't show slides
        message: messages.join(' '),
      };
    },
  },

  investigate: {
    id: 'investigate',
    name: 'Investigate',
    description: 'Choose someone to investigate.',
    verb: 'investigate',
    verbPastTense: 'investigated',
    phase: [GamePhase.NIGHT],
    priority: 30,

    participants: (game) => {
      return game.getAlivePlayers().filter((p) => p.role.id === 'seer');
    },

    validTargets: (actor, game) => {
      return game.getAlivePlayers().filter((p) => p.id !== actor.id);
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
          seer,
          targetId,
          target,
          isEvil,
          privateMessage: `${target.name} is ${isEvil ? 'EVIL' : 'INNOCENT'}.`,
        });
      }

      if (investigations.length === 0) {
        return { success: true, silent: true };
      }

      // Log investigations
      const messages = investigations.map(
        (inv) =>
          `${inv.seer.getNameWithEmoji()} learned ${inv.target.getNameWithEmoji()} is ${
            inv.isEvil ? 'a WEREWOLF' : 'INNOCENT'
          }`
      );

      return {
        success: true,
        message: messages.join(' '),
        investigations,
      };
    },
  },

  protect: {
    id: 'protect',
    name: 'Protect',
    description: 'Choose someone to protect tonight.',
    verb: 'protect',
    verbPastTense: 'protected',
    phase: [GamePhase.NIGHT],
    priority: 10, // First to resolve

    participants: (game) => {
      return game.getAlivePlayers().filter((p) => p.role.id === 'doctor');
    },

    validTargets: (actor, game) => {
      // Can protect anyone alive, including self
      // Optional: prevent protecting same person twice
      return game.getAlivePlayers();
    },

    aggregation: 'individual',
    allowAbstain: true,

    resolve: (results, game) => {
      const protections = [];

      for (const [actorId, targetId] of Object.entries(results)) {
        if (targetId === null) continue;
        const target = game.getPlayer(targetId);
        const doctor = game.getPlayer(actorId);

        target.isProtected = true;
        doctor.lastProtected = targetId;

        protections.push({ doctor, target });
      }

      if (protections.length === 0) {
        return { success: true, silent: true };
      }

      // Log protections
      const messages = protections.map(
        (p) =>
          `${p.doctor.getNameWithEmoji()} protected ${p.target.getNameWithEmoji()}`
      );

      return {
        success: true,
        message: messages.join(' '),
        silent: false,
      };
    },
  },

  // Note: hunterRevenge has been migrated to server/flows/HunterRevengeFlow.js

  shoot: {
    id: 'shoot',
    name: 'Shoot',
    description: 'Use your pistol to shoot someone.',
    verb: 'shoot',
    verbPastTense: 'shot',
    phase: [GamePhase.DAY],
    priority: 40, // Before vote (50)
    playerInitiated: true, // Player triggers this event, not host
    playerResolved: true, // Player's selection auto-resolves the event

    participants: (game) => {
      // Players with a pistol that has uses remaining
      return game
        .getAlivePlayers()
        .filter((p) => p.hasItem('pistol') && p.canUseItem('pistol'));
    },

    validTargets: (actor, game) => {
      return game.getAlivePlayers().filter((p) => p.id !== actor.id);
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
          message: `${shooter.getNameWithEmoji()} chose not to shoot`,
          slide: {
            type: 'title',
            title: 'NO SHOTS FIRED',
            subtitle: `${shooter.name} is keeping their powder dry... for now.`,
            style: SlideStyle.NEUTRAL,
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

      const teamDisplayNames = { village: 'VILLAGER', werewolf: 'WEREWOLF', neutral: 'INDEPENDENT' };
      const teamName = teamDisplayNames[victim.role?.team] || 'PLAYER';
      return {
        message: `${shooter.getNameWithEmoji()} shot ${victim.getNameWithEmoji()}`,
        slide: {
          type: 'death',
          playerId: victim.id,
          shooterId: shooter.id,
          title: `${teamName} KILLED`,
          subtitle: `${shooter.name} shot ${victim.name}!`,
          revealRole: true,
          style: SlideStyle.HOSTILE,
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

  customEvent: {
    id: 'customEvent',
    name: 'Custom Event',
    description: 'Vote for a custom reward.',
    verb: 'vote for',
    verbPastTense: 'voted for',
    phase: [GamePhase.DAY],
    priority: 45, // Before vote (50), after shoot (40)
    anonymousVoting: false, // If true, show vote counts; if false, show voter portraits

    participants: (game) => game.getAlivePlayers(),

    validTargets: (actor, game) => {
      const instance = game.activeEvents.get('customEvent');

      // Check for runoff voting - only show runoff candidates
      if (instance?.runoffCandidates && instance.runoffCandidates.length > 0) {
        return instance.runoffCandidates
          .map((id) => game.getPlayer(id))
          .filter((p) => p);
      }

      // Check reward type from config
      if (instance?.config?.rewardType === 'resurrection') {
        // Only dead players are valid targets for resurrection
        return [...game.players.values()].filter((p) => !p.isAlive);
      }

      // For item/role rewards, all alive players INCLUDING SELF
      return game.getAlivePlayers();
    },

    aggregation: 'majority',
    allowAbstain: true,

    resolve: (results, game) => {
      const instance = game.activeEvents.get('customEvent');
      const config = instance?.config;
      const runoffRound = instance?.runoffRound || 0;

      if (!config) {
        return {
          success: false,
          message: 'Custom event configuration missing',
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
            style: SlideStyle.NEUTRAL,
          },
        };
      }

      // Find winner
      const maxVotes = Math.max(...Object.values(tally));
      const frontrunners = Object.keys(tally).filter(
        (id) => tally[id] === maxVotes
      );

      if (frontrunners.length > 1) {
        // Tie detected
        if (runoffRound >= 3) {
          // After 3 runoffs, pick randomly
          const winnerId =
            frontrunners[Math.floor(Math.random() * frontrunners.length)];
          return resolveCustomEventReward(winnerId, config, game, tally, true);
        }

        // Trigger runoff
        return {
          success: true,
          runoff: true,
          frontrunners,
          tally,
          message: `Custom event tied. Starting runoff with ${frontrunners.length} candidates.`,
        };
      }

      return resolveCustomEventReward(
        frontrunners[0],
        config,
        game,
        tally,
        false
      );
    },
  },
};

/**
 * Helper function to resolve custom vote rewards
 */
function resolveCustomEventReward(winnerId, config, game, tally, wasTie) {
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
      title: 'CUSTOM EVENT RESULT',
      subtitle: slideSubtitle,
      style: SlideStyle.NEUTRAL,
    },
  };
}

export function getEvent(eventId) {
  return events[eventId] || null;
}

export function getEventsForPhase(phase) {
  return Object.values(events)
    .filter((e) => e.phase.includes(phase) && !e.isInterrupt)
    .sort((a, b) => a.priority - b.priority);
}

export function getAllEvents() {
  return { ...events };
}

export default events;
