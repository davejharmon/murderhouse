// server/definitions/events.js
// Declarative event definitions
// Events are actions that players can take during specific phases

import {
  GamePhase,
  Team,
  RoleId,
  EventId,
  ItemId,
  SlideStyle,
  SlideType,
} from '../../shared/constants.js';
import { getRole } from './roles.js';
import { str } from '../strings.js';

/** Map team to display name for slides/messages */
function getTeamDisplayName(role) {
  if (role?.id === RoleId.JESTER) return str('slides', 'death.teamJester');
  const names = {
    village: str('slides', 'death.teamVillager'),
    werewolf: str('slides', 'death.teamWerewolf'),
    neutral: str('slides', 'death.teamNeutral'),
  };
  return names[role?.team] || str('slides', 'death.teamUnknown');
}

/** Count votes from results map, skipping abstentions */
function tallyVotes(results) {
  const tally = {};
  for (const [, targetId] of Object.entries(results)) {
    if (targetId === null) continue;
    tally[targetId] = (tally[targetId] || 0) + 1;
  }
  const isEmpty = Object.keys(tally).length === 0;
  const maxVotes = isEmpty ? 0 : Math.max(...Object.values(tally));
  const frontrunners = Object.keys(tally).filter(
    (id) => tally[id] === maxVotes,
  );
  return { tally, maxVotes, frontrunners, isEmpty };
}

/** Check if frontrunners tie should trigger runoff or random tiebreak.
 *  Returns runoff result, tieBreaker result, or null (clear winner). */
function checkRunoff(frontrunners, tally, runoffRound, eventName) {
  if (frontrunners.length <= 1) return null;
  if (runoffRound >= 3) {
    const winnerId =
      frontrunners[Math.floor(Math.random() * frontrunners.length)];
    return { tieBreaker: true, winnerId, tally };
  }
  return {
    success: true,
    runoff: true,
    frontrunners,
    tally,
    message: str('log', 'voteRunoffStarted', { event: eventName, count: frontrunners.length }),
  };
}

/** Get runoff candidates from active event instance, or null */
function getRunoffTargets(eventId, game) {
  const instance = game.activeEvents.get(eventId);
  return instance?.runoffCandidates?.length > 0
    ? instance.runoffCandidates
    : null;
}

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
    get name() { return str('events', 'vote.name') },
    get description() { return str('events', 'vote.description') },
    verb: 'vote for',
    verbPastTense: 'voted for',
    phase: [GamePhase.DAY],
    priority: 50,
    anonymousVoting: false, // If true, show vote counts; if false, show voter portraits

    participants: (game) => game.getAlivePlayers().filter((p) => !p.hasItem(ItemId.NOVOTE)),

    validTargets: (actor, game) => {
      const runoffTargets = getRunoffTargets(EventId.VOTE, game);
      if (runoffTargets) {
        return runoffTargets
          .map((id) => game.getPlayer(id))
          .filter((p) => p && p.id !== actor.id && !p.hasItem(ItemId.COWARD));
      }

      return game.getAlivePlayers().filter((p) => p.id !== actor.id && !p.hasItem(ItemId.COWARD));
    },

    aggregation: 'majority',
    allowAbstain: true,

    resolve: (results, game) => {
      const instance = game.activeEvents.get(EventId.VOTE);
      const runoffRound = instance?.runoffRound || 0;

      const { tally, frontrunners, isEmpty } = tallyVotes(results);

      if (isEmpty) {
        return {
          success: true,
          outcome: 'no-kill',
          message: str('log', 'voteNoElimination'),
          slide: {
            type: 'title',
            title: str('slides', 'vote.noElimTitle'),
            subtitle: str('slides', 'vote.noElimSubtitle'),
            style: SlideStyle.NEUTRAL,
          },
        };
      }

      const runoffResult = checkRunoff(
        frontrunners,
        tally,
        runoffRound,
        str('events', 'vote.name'),
      );
      if (runoffResult) {
        if (runoffResult.tieBreaker) {
          const victim = game.getPlayer(runoffResult.winnerId);
          // Don't kill yet - let Game.js handle it after checking for governor
          const teamName = getTeamDisplayName(victim.role);
          return {
            success: true,
            outcome: 'eliminated',
            victim,
            tally,
            message: str('log', 'voteRandomSelected', { name: victim.name }),
            slide: {
              type: 'death',
              playerId: victim.id,
              title: `${teamName} ${str('slides', 'death.suffixEliminated')}`,
              subtitle: victim.name,
              revealRole: true,
              style: SlideStyle.HOSTILE,
            },
          };
        }
        return runoffResult;
      }

      const victim = game.getPlayer(frontrunners[0]);
      // Don't kill yet - let Game.js handle it after checking for governor
      const teamName = getTeamDisplayName(victim.role);
      return {
        success: true,
        outcome: 'eliminated',
        victim,
        tally,
        message: str('log', 'voteEliminated', { name: victim.name }),
        slide: {
          type: 'death',
          playerId: victim.id,
          title: `${teamName} ${str('slides', 'death.suffixEliminated')}`,
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
    get name() { return str('events', 'vigil.name') },
    get description() { return str('events', 'vigil.description') },
    verb: 'shoot',
    verbPastTense: 'shot',
    phase: [GamePhase.NIGHT],
    priority: 55,

    participants: (game) => {
      return game
        .getAlivePlayers()
        .filter((p) => p.role.id === RoleId.VIGILANTE && !p.vigilanteUsed);
    },

    validTargets: (actor, game) => {
      return game.getAlivePlayers().filter((p) => p.id !== actor.id && !p.hasItem(ItemId.COWARD));
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

        // Skip if already dead (killed by another event this round)
        if (!target.isAlive) continue;

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

        const teamName = getTeamDisplayName(target.role);
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
            title: `${teamName} ${str('slides', 'death.suffixKilled')}`,
            subtitle: target.name,
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
          message: str('log', 'vigilanteProtected', { name: kill.vigilante.getNameWithEmoji(), target: kill.target.getNameWithEmoji() }),
        };
      }

      return {
        success: true,
        outcome: 'killed',
        victim: kill.victim,
        message: str('log', 'vigilanteShoots', { name: kill.vigilante.getNameWithEmoji(), target: kill.target.getNameWithEmoji() }),
        slide: kill.slide,
      };
    },
  },

  suspect: {
    id: 'suspect',
    get name() { return str('events', 'suspect.name') },
    get description() { return str('events', 'suspect.description') },
    verb: 'suspect',
    verbPastTense: 'suspected',
    phase: [GamePhase.NIGHT],
    priority: 80, // Low priority - just tracking

    participants: (game) => {
      return game
        .getAlivePlayers()
        .filter(
          (p) =>
            p.role.id === RoleId.VILLAGER ||
            p.role.id === RoleId.TANNER ||
            p.role.id === RoleId.HUNTER ||
            p.role.id === RoleId.GOVERNOR,
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
        (s) => str('log', 'hunterSuspected', { name: s.actor.getNameWithEmoji(), target: s.target.getNameWithEmoji() }),
      );

      return {
        success: true,
        message: messages.join(' '),
      };
    },
  },

  poison: {
    id: 'poison',
    get name() { return str('events', 'poison.name') },
    get description() { return str('events', 'poison.description') },
    verb: 'poison',
    verbPastTense: 'poisoned',
    phase: [GamePhase.NIGHT],
    priority: 59, // Just before kill (60)

    participants: (game) => {
      return game.getAlivePlayers().filter((p) => p.role.id === RoleId.POISONER);
    },

    validTargets: (actor, game) => [actor], // Self-target: YES/NO choice

    aggregation: 'individual',
    allowAbstain: true, // NO = abstain

    resolve: (results, game) => {
      for (const [actorId] of Object.entries(results)) {
        const result = results[actorId];
        if (result === null) continue; // NO
        const poisoner = game.getPlayer(actorId);
        if (poisoner?.isRoleblocked) continue; // Blocked — ability fails silently
        game.poisonerActing = true;
      }
      if (game.poisonerActing) {
        return {
          success: true,
          message: str('log', 'poisonerActing'),
          silent: false,
        };
      }
      return { success: true, silent: true };
    },
  },

  clean: {
    id: 'clean',
    get name() { return str('events', 'clean.name') },
    get description() { return str('events', 'clean.description') },
    verb: 'clean',
    verbPastTense: 'cleaned',
    phase: [GamePhase.NIGHT],
    priority: 58,

    participants: (game) => {
      return game.getAlivePlayers().filter((p) => p.role.id === RoleId.JANITOR);
    },

    validTargets: (actor, game) => [actor], // Self-target: YES/NO choice

    aggregation: 'individual',
    allowAbstain: true,

    resolve: (results, game) => {
      for (const [actorId, targetId] of Object.entries(results)) {
        if (targetId === null) continue; // Abstain = NO
        game.janitorCleaning = true;
      }
      if (game.janitorCleaning) {
        return {
          success: true,
          message: str('log', 'janitorActing'),
          silent: false,
        };
      }
      return { success: true, silent: true };
    },
  },

  kill: {
    id: 'kill',
    get name() { return str('events', 'kill.name') },
    get description() { return str('events', 'kill.description') },
    verb: 'target',
    verbPastTense: 'targeted',
    phase: [GamePhase.NIGHT],
    priority: 60,

    participants: (game) => {
      return game.getAlivePlayers().filter((p) => p.role.id === RoleId.ALPHA); // Only alphas
    },

    validTargets: (actor, game) => {
      return game
        .getAlivePlayers()
        .filter((p) => p.role.team !== Team.WEREWOLF && !p.hasItem(ItemId.COWARD));
    },

    aggregation: 'majority', // Werewolves vote together
    allowAbstain: false,

    resolve: (results, game) => {
      const { tally, frontrunners, isEmpty } = tallyVotes(results);

      if (isEmpty) {
        game.poisonerActing = false; // No target — poisoner's action wasted
        return { success: true, silent: true };
      }

      // Find victim (ties resolved randomly)
      const victimId =
        frontrunners[Math.floor(Math.random() * frontrunners.length)];
      const victim = game.getPlayer(victimId);

      // Skip if already dead (killed by another event this round)
      if (!victim.isAlive) {
        game.poisonerActing = false;
        return { success: true, silent: true };
      }

      // Poisoner intercepts the kill — replace with delayed poison
      if (game.poisonerActing) {
        game.poisonerActing = false;

        // Doctor protection on the same night cancels the poison
        if (victim.isProtected) {
          victim.isProtected = false;
          return {
            success: true,
            silent: true,
            message: str('log', 'playerSavedPoison', { name: victim.getNameWithEmoji() }),
          };
        }

        // Apply poison state — victim dies at end of next night
        victim.isPoisoned = true;
        victim.poisonedAt = game.dayCount;
        const poisoner = [...game.players.values()].find((p) => p.role?.id === RoleId.POISONER && p.isAlive);
        return {
          success: true,
          outcome: 'poisoned',
          message: poisoner
            ? str('log', 'poisonerPoisoned', { actor: poisoner.getNameWithEmoji(), name: victim.getNameWithEmoji() })
            : str('log', 'poisonedPlayer', { name: victim.getNameWithEmoji() }),
        };
      }

      // Check protection (normal kill path)
      if (victim.isProtected) {
        victim.isProtected = false;
        const attackers = Object.entries(results)
          .filter(([, tid]) => tid !== null)
          .map(([aid]) => game.getPlayer(aid))
          .filter(Boolean);
        const actorStr = attackers.length === 1
          ? attackers[0].getNameWithEmoji()
          : 'The pack';
        return {
          success: true,
          outcome: 'protected',
          targetId: victimId,
          message: str('log', 'killProtected', { actor: actorStr, name: victim.getNameWithEmoji() }),
        };
      }

      const killResult = game.killPlayer(victim.id, 'werewolf');

      // BARRICADE: attack was absorbed — victim survives silently
      if (killResult === 'barricaded') {
        return { success: true, outcome: 'barricaded', silent: true };
      }

      // PROSPECT: victim was recruited instead of killed
      if (victim.isAlive) {
        return {
          success: true,
          outcome: 'recruited',
          message: str('log', 'playerRecruited', { name: victim.getNameWithEmoji() }),
        };
      }

      // Check if janitor is cleaning
      const cleaned = game.janitorCleaning;
      if (cleaned) {
        victim.isRoleCleaned = true;
        game.janitorCleaning = false;
      }

      const teamName = cleaned ? str('slides', 'death.teamUnknown') : getTeamDisplayName(victim.role);
      return {
        success: true,
        outcome: 'killed',
        victim,
        message: str('log', 'killedByWolves', { name: victim.getNameWithEmoji() }),
        slide: {
          type: 'death',
          playerId: victim.id,
          title: `${teamName} ${str('slides', 'death.suffixKilled')}`,
          subtitle: victim.name,
          revealRole: true,
          revealText: cleaned ? str('slides', 'misc.janitorReveal') : null,
          style: SlideStyle.HOSTILE,
        },
      };
    },
  },

  hunt: {
    id: 'hunt',
    get name() { return str('events', 'hunt.name') },
    get description() { return str('events', 'hunt.description') },
    verb: 'suggest',
    verbPastTense: 'suggested',
    phase: [GamePhase.NIGHT],
    priority: 55, // Before kill (60)

    participants: (game) => {
      return game
        .getAlivePlayers()
        .filter((p) => p.role.id === RoleId.WEREWOLF); // Only regular werewolves
    },

    validTargets: (actor, game) => {
      return game
        .getAlivePlayers()
        .filter((p) => p.role.team !== Team.WEREWOLF && !p.hasItem(ItemId.COWARD));
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
          `${s.werewolf.getNameWithEmoji()} suggested ${s.target.getNameWithEmoji()}`,
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
    get name() { return str('events', 'investigate.name') },
    get description() { return str('events', 'investigate.description') },
    verb: 'investigate',
    verbPastTense: 'investigated',
    phase: [GamePhase.NIGHT],
    priority: 30,

    participants: (game) => {
      return game.getAlivePlayers().filter((p) => p.role.id === RoleId.SEER);
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
        const isEvil = target.role.team === Team.WEREWOLF || !!target.role.appearsGuilty || target.hasItem(ItemId.TANNED);

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
          privateMessage: str('events', isEvil ? 'investigate.resultEvil' : 'investigate.resultInnocent', { name: target.name }),
        });
      }

      if (investigations.length === 0) {
        return { success: true, silent: true };
      }

      // Log investigations
      const messages = investigations.map(
        (inv) => str('log', 'seerInvestigated', { seer: inv.seer.getNameWithEmoji(), target: inv.target.getNameWithEmoji(), result: inv.isEvil ? 'a WEREWOLF' : 'INNOCENT' }),
      );

      return {
        success: true,
        message: messages.join(' '),
        investigations,
      };
    },
  },

  stumble: {
    id: 'stumble',
    get name() { return str('events', 'stumble.name') },
    displayName: 'Investigate', // What the drunk player's terminal shows (they think they're a seer)
    get description() { return str('events', 'stumble.description') },
    verb: 'investigate',
    verbPastTense: 'investigated',
    phase: [GamePhase.NIGHT],
    priority: 30,

    participants: (game) => {
      return game.getAlivePlayers().filter((p) => p.role.id === RoleId.DRUNK);
    },

    validTargets: (actor, game) => {
      return game.getAlivePlayers().filter((p) => p.id !== actor.id && !p.hasItem(ItemId.COWARD));
    },

    aggregation: 'individual',
    allowAbstain: true,

    resolve: (results, game) => {
      const investigations = [];
      const DRUNK_ACTIONS = ['investigate', 'kill', 'protect', 'block'];

      for (const [actorId, targetId] of Object.entries(results)) {
        if (targetId === null) continue;
        const actor = game.getPlayer(actorId);
        const target = game.getPlayer(targetId);

        // Pick a random action and execute it covertly
        const action = DRUNK_ACTIONS[Math.floor(Math.random() * DRUNK_ACTIONS.length)];

        if (action === 'kill') {
          if (target.isProtected) {
            target.isProtected = false;
          } else if (target.isAlive) {
            game.killPlayer(target.id, 'drunk');
            game.queueDeathSlide({
              type: 'death',
              playerId: target.id,
              title: `${getTeamDisplayName(target.role)} ${str('slides', 'death.suffixKilled')}`,
              subtitle: target.name,
              revealRole: true,
              style: SlideStyle.HOSTILE,
            }, true);
          }
        } else if (action === 'protect') {
          target.isProtected = true;
        } else if (action === 'block') {
          target.isRoleblocked = true;
        }
        // 'investigate' → no side effect

        game.addLog(`🥴 ${actor.name} (Drunk) rolled: ${action} → ${target.name}`); // Debug log, not in catalog

        // Real investigate (25%) returns accurate result; other actions always show INNOCENT
        const isEvil = action === 'investigate'
          ? (target.role.team === Team.WEREWOLF || !!target.role.appearsGuilty || target.hasItem(ItemId.TANNED))
          : false;

        if (!actor.investigations) actor.investigations = [];
        actor.investigations.push({
          day: game.dayCount,
          targetId,
          targetName: target.name,
          isEvil,
        });

        investigations.push({
          seerId: actorId,
          seer: actor,
          targetId,
          target,
          isEvil,
          privateMessage: str('events', isEvil ? 'investigate.resultEvil' : 'investigate.resultInnocent', { name: target.name }),
        });
      }

      if (investigations.length === 0) {
        return { success: true, silent: true };
      }

      return {
        success: true,
        message: str('log', 'stumbleCompleted'),
        investigations,
      };
    },
  },

  block: {
    id: 'block',
    get name() { return str('events', 'block.name') },
    get description() { return str('events', 'block.description') },
    verb: 'block',
    verbPastTense: 'blocked',
    phase: [GamePhase.NIGHT],
    priority: 5, // Resolves before all other night events

    participants: (game) => {
      return game
        .getAlivePlayers()
        .filter((p) => p.role.id === RoleId.ROLEBLOCKER);
    },

    validTargets: (actor, game) => {
      return game.getAlivePlayers().filter((p) => p.id !== actor.id);
    },

    aggregation: 'individual',
    allowAbstain: true,

    resolve: (results, game) => {
      const blocks = [];

      for (const [actorId, targetId] of Object.entries(results)) {
        if (targetId === null) continue;
        const target = game.getPlayer(targetId);
        const blocker = game.getPlayer(actorId);
        target.isRoleblocked = true;
        blocks.push({ blocker, target });
      }

      if (blocks.length === 0) {
        return { success: true, silent: true };
      }

      const messages = blocks.map(
        (b) => str('log', 'roleblockerBlocked', { blocker: b.blocker.getNameWithEmoji(), target: b.target.getNameWithEmoji() }),
      );

      return {
        success: true,
        message: messages.join(', '),
        silent: false,
      };
    },
  },

  protect: {
    id: 'protect',
    get name() { return str('events', 'protect.name') },
    get description() { return str('events', 'protect.description') },
    verb: 'protect',
    verbPastTense: 'protected',
    phase: [GamePhase.NIGHT],
    priority: 10, // First to resolve

    participants: (game) => {
      return game.getAlivePlayers().filter((p) => p.role.id === RoleId.DOCTOR);
    },

    validTargets: (actor, game) => {
      // Can protect anyone alive, including self
      // Cannot protect the same person twice in a row
      return game.getAlivePlayers().filter((p) => p.id !== actor.lastProtected);
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
        (p) => str('log', 'doctorProtected', { doctor: p.doctor.getNameWithEmoji(), target: p.target.getNameWithEmoji() }),
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
    get name() { return str('events', 'shoot.name') },
    get description() { return str('events', 'shoot.description') },
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
        .filter((p) => p.hasItem(ItemId.PISTOL) && p.canUseItem(ItemId.PISTOL));
    },

    validTargets: (actor, game) => {
      return game.getAlivePlayers().filter((p) => p.id !== actor.id && !p.hasItem(ItemId.COWARD));
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
          message: str('log', 'shooterAbstains', { name: shooter.getNameWithEmoji() }),
          slide: {
            type: 'title',
            title: str('slides', 'misc.noShotsTitle'),
            subtitle: str('slides', 'misc.noShotsSubtitle', { name: shooter.name }),
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
      game.consumeItem(shooterId, ItemId.PISTOL);

      const teamName = getTeamDisplayName(victim.role);
      return {
        message: str('log', 'shooterShoots', { name: shooter.getNameWithEmoji(), target: victim.getNameWithEmoji() }),
        slide: {
          type: 'death',
          playerId: victim.id,
          shooterId: shooter.id,
          title: `${teamName} ${str('slides', 'death.suffixKilled')}`,
          identityTitle: `${shooter.name} shot ${victim.name}!`,
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
    get name() { return str('events', 'customEvent.name') },
    get description() { return str('events', 'customEvent.description') },
    verb: 'vote for',
    verbPastTense: 'voted for',
    phase: [GamePhase.DAY],
    priority: 45, // Before vote (50), after shoot (40)
    anonymousVoting: false, // If true, show vote counts; if false, show voter portraits

    participants: (game) => game.getAlivePlayers(),

    validTargets: (actor, game) => {
      const instance = game.activeEvents.get(EventId.CUSTOM_EVENT);

      // Check for runoff voting - only show runoff candidates
      const runoffTargets = getRunoffTargets(EventId.CUSTOM_EVENT, game);
      if (runoffTargets) {
        return runoffTargets.map((id) => game.getPlayer(id)).filter((p) => p);
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
      const instance = game.activeEvents.get(EventId.CUSTOM_EVENT);
      const config = instance?.config;
      const runoffRound = instance?.runoffRound || 0;

      if (!config) {
        return {
          success: false,
          message: 'Custom event configuration missing',
        };
      }

      const { tally, frontrunners, isEmpty } = tallyVotes(results);

      if (isEmpty) {
        return {
          success: true,
          outcome: 'no-winner',
          message: str('log', 'customNoVotes'),
          slide: {
            type: 'title',
            title: str('slides', 'vote.noWinnerTitle'),
            subtitle: config.description,
            style: SlideStyle.NEUTRAL,
          },
        };
      }

      const runoffResult = checkRunoff(
        frontrunners,
        tally,
        runoffRound,
        str('events', 'customEvent.name'),
      );
      if (runoffResult) {
        if (runoffResult.tieBreaker) {
          return resolveCustomEventReward(
            runoffResult.winnerId,
            config,
            game,
            tally,
            true,
          );
        }
        return runoffResult;
      }

      return resolveCustomEventReward(
        frontrunners[0],
        config,
        game,
        tally,
        false,
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
      message = str('log', 'customReward', { name: winner.name, reward: config.rewardParam });
      slideSubtitle = `${winner.name} received ${config.rewardParam}`;
      break;

    case 'role':
      const newRole = getRole(config.rewardParam);
      if (newRole) {
        winner.assignRole(newRole);
        message = str('log', 'customRoleChange', { name: winner.name, role: newRole.name });
        slideSubtitle = `${winner.name} is now ${newRole.name}`;
      }
      break;

    case 'resurrection':
      if (!winner.isAlive) {
        game.revivePlayer(winner.id, 'vote');
        message = str('log', 'customRevived', { name: winner.name });
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
      type: SlideType.PLAYER_REVEAL,
      playerId: winnerId,
      title: str('slides', 'vote.customResultTitle'),
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
