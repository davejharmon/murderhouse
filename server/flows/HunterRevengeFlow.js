// server/flows/HunterRevengeFlow.js
// Consolidated Hunter revenge logic

import { GamePhase, ServerMsg, SlideStyle } from '../../shared/constants.js';
import { InterruptFlow } from './InterruptFlow.js';

/**
 * Hunter Revenge Flow
 *
 * STATE MACHINE:
 *   idle -> active (hunter dies) -> resolving (target selected) -> idle
 *
 * TRIGGER: Hunter's onDeath passive returns { interrupt: true }
 *
 * STATE:
 *   - hunterId: string       - The dying hunter's ID
 *   - hunterName: string     - The hunter's display name
 *   - triggeredInPhase: GamePhase - DAY or NIGHT (affects messaging)
 *
 * FLOW:
 *   1. Hunter dies -> canTrigger() returns true
 *   2. trigger() called:
 *      - Set state with hunter info
 *      - Push "HUNTER'S REVENGE" slide
 *      - Create event, send prompts to hunter
 *   3. Hunter selects target -> onSelection() called
 *   4. resolve() called:
 *      - Kill target
 *      - Push "HUNTER JUSTICE" death slide
 *   5. cleanup() - reset state
 *
 * NOTES:
 *   - Hunter MUST choose a target (no abstain allowed)
 *   - Can trigger during DAY (vote) or NIGHT (kill)
 *   - Target is killed immediately, no protection applies
 */
export class HunterRevengeFlow extends InterruptFlow {
  static get id() {
    return 'hunterRevenge';
  }

  /**
   * Check if this flow should trigger
   * @param {Object} context - { player, cause, deathResult }
   * @returns {boolean}
   */
  canTrigger(context) {
    const { player, deathResult } = context;
    return (
      deathResult?.interrupt === true && player.role?.id === 'hunter'
    );
  }

  /**
   * Initialize the Hunter revenge flow
   * @param {Object} context - { player, cause, deathResult }
   * @returns {Object} - { interrupt: true, flowId: 'hunterRevenge' }
   */
  trigger(context) {
    const { player } = context;

    this.phase = 'active';
    this.state = {
      hunterId: player.id,
      hunterName: player.name,
      triggeredInPhase: this.game.phase,
      // Store pending slide to be pushed AFTER the death slide
      // (killPlayer triggers this flow before the death slide is pushed)
      pendingSlide: {
        type: 'title',
        title: "HUNTER'S REVENGE",
        subtitle: `${player.name} is choosing a target with their dying breath...`,
        playerId: player.id,
        style: SlideStyle.HOSTILE,
      },
    };

    // Create the event using Game's flow event helper
    this.game._startFlowEvent(this.id, {
      name: "Hunter's Revenge",
      description: 'Choose who to take with you.',
      verb: 'shoot',
      participants: [player.id],
      getValidTargets: (actorId) => this.getValidTargets(actorId),
      allowAbstain: false,
      playerResolved: false, // Host resolves, or auto-resolve on selection
    });

    this.game.addLog(`${player.name} was the Hunter and gets a revenge shot!`);

    return { interrupt: true, flowId: HunterRevengeFlow.id };
  }

  /**
   * Push the pending announcement slide (called after death slide is pushed)
   * Uses jumpTo=false so host sees death slide first, then advances to this
   */
  pushPendingSlide() {
    if (this.state?.pendingSlide) {
      this.game.pushSlide(this.state.pendingSlide, false);
      this.state.pendingSlide = null;
    }
  }

  /**
   * Get participants (just the dying hunter)
   * @returns {string[]}
   */
  getParticipants() {
    return this.state ? [this.state.hunterId] : [];
  }

  /**
   * Get valid targets for the hunter (anyone alive except themselves)
   * @param {string} playerId
   * @returns {Player[]}
   */
  getValidTargets(playerId) {
    if (!this.state || playerId !== this.state.hunterId) return [];
    return this.game
      .getAlivePlayers()
      .filter((p) => p.id !== this.state.hunterId);
  }

  /**
   * Handle hunter's target selection
   * @param {string} playerId
   * @param {string|null} targetId
   * @returns {Object|null}
   */
  onSelection(playerId, targetId) {
    if (!this.state || playerId !== this.state.hunterId) return null;

    // Hunter cannot abstain
    if (targetId === null) {
      return { error: 'Hunter must choose a target' };
    }

    // Validate target
    const validTargets = this.getValidTargets(playerId);
    if (!validTargets.find((t) => t.id === targetId)) {
      return { error: 'Invalid target' };
    }

    // Auto-resolve when hunter makes selection
    return this.resolve(targetId);
  }

  /**
   * Execute the revenge kill
   * @param {string} targetId - The victim's ID
   * @returns {Object}
   */
  resolve(targetId) {
    const hunter = this.game.getPlayer(this.state.hunterId);
    const victim = this.game.getPlayer(targetId);

    if (!victim) {
      return { success: false, error: 'Invalid target' };
    }

    this.phase = 'resolving';

    // Kill the target (this may trigger another hunter revenge if target is also hunter)
    this.game.killPlayer(victim.id, 'hunter');

    const isNight = this.state.triggeredInPhase === GamePhase.NIGHT;
    const teamDisplayNames = { village: 'VILLAGER', werewolf: 'WEREWOLF', neutral: 'INDEPENDENT' };
    const teamName = teamDisplayNames[victim.role?.team] || 'PLAYER';

    // Queue the death slide (queueDeathSlide handles nested hunter revenge automatically)
    this.game.queueDeathSlide(
      {
        type: 'death',
        playerId: victim.id,
        title: `${teamName} KILLED`,
        subtitle: `${victim.name} was killed in the ${isNight ? 'night' : 'day'}`,
        revealRole: true,
        style: SlideStyle.HOSTILE,
      },
      true // Jump to this slide
    );

    const result = {
      success: true,
      victim,
      message: `${hunter.getNameWithEmoji()} took ${victim.getNameWithEmoji()} down with them`,
    };

    this.game.addLog(result.message);

    this.cleanup();
    return result;
  }

  /**
   * Clean up flow state
   */
  cleanup() {
    super.cleanup();
    // Clear any pending events for the hunter (they're dead)
    if (this.state?.hunterId) {
      const hunter = this.game.getPlayer(this.state.hunterId);
      if (hunter) {
        hunter.pendingEvents.delete(this.id);
      }
    }
  }
}
