// server/flows/GovernorPardonFlow.js
// Consolidated Governor pardon logic

import { SlideStyle } from '../../shared/constants.js';
import { InterruptFlow } from './InterruptFlow.js';

/**
 * Governor Pardon Flow
 *
 * STATE MACHINE:
 *   idle -> active (vote condemns) -> pardoned OR executed -> idle
 *
 * TRIGGER: Vote event results in elimination AND governor/phone holder exists
 *
 * STATE:
 *   - condemnedId: string      - Player facing execution
 *   - condemnedName: string    - Display name
 *   - voteEventId: string      - The vote that triggered this
 *   - voteResolution: object   - Cached resolution from vote
 *   - voteInstance: object     - The vote event instance
 *   - governorIds: string[]    - Eligible pardoners (governor role or phone item)
 *
 * FLOW:
 *   1. Vote resolves with elimination -> canTrigger() returns true
 *   2. trigger() called:
 *      - Store condemned player info and vote resolution
 *      - Push "CONDEMNED" slide
 *      - Create pardon event, send prompts to governors
 *   3. Governor selects:
 *      - If target = condemned: PARDON (player lives)
 *      - If abstain/skip: EXECUTE (player dies)
 *   4. cleanup() - reset state
 *
 * NOTES:
 *   - Phone can pardon once per game (phone item consumed)
 *   - Governor role can always pardon (no limit)
 *   - Only one governor needs to pardon
 *   - If no selection made, host can skip (executes)
 */
export class GovernorPardonFlow extends InterruptFlow {
  static get id() {
    return 'pardon';
  }

  static get hooks() {
    return ['onVoteResolution'];
  }

  /**
   * Check if this flow should trigger
   * @param {Object} context - { voteEventId, resolution, instance }
   * @returns {boolean}
   */
  canTrigger(context) {
    const { resolution } = context;

    // Only trigger on elimination
    if (resolution?.outcome !== 'eliminated' || !resolution.victim) {
      return false;
    }

    // Check for governors or phone holders
    const governors = this.game.getAlivePlayers().filter((p) => {
      return (
        p.role.id === 'governor' ||
        (p.hasItem('phone') && p.canUseItem('phone'))
      );
    });

    return governors.length > 0;
  }

  /**
   * Initialize the Governor pardon flow
   * @param {Object} context - { voteEventId, resolution, instance }
   * @returns {Object} - { interrupt: true, flowId: 'pardon' }
   */
  trigger(context) {
    const { voteEventId, resolution, instance } = context;
    const condemned = resolution.victim;

    const governors = this.game.getAlivePlayers().filter((p) => {
      return (
        p.role.id === 'governor' ||
        (p.hasItem('phone') && p.canUseItem('phone'))
      );
    });

    this.phase = 'active';
    this.state = {
      condemnedId: condemned.id,
      condemnedName: condemned.name,
      voteEventId,
      voteResolution: resolution,
      voteInstance: instance,
      governorIds: governors.map((g) => g.id),
    };

    // Remove vote from governors' pending events
    for (const governor of governors) {
      governor.pendingEvents.delete(voteEventId);
    }

    // Create the pardon event
    this.game._startFlowEvent(this.id, {
      name: 'Governor Pardon',
      description: 'Will you pardon this player from elimination?',
      verb: 'pardon',
      participants: this.state.governorIds,
      getValidTargets: (playerId) => this.getValidTargets(playerId),
      allowAbstain: true,
      playerResolved: true, // Auto-resolve on selection
    });

    // Push condemned slide
    this.game.pushSlide(
      {
        type: 'death',
        playerId: condemned.id,
        title: 'CONDEMNED',
        subtitle: 'Calling the governor...',
        revealRole: false,
        style: SlideStyle.WARNING,
      },
      false // Don't jump - tally slide is already shown
    );

    this.game.addLog(`${condemned.getNameWithEmoji()} awaits the Governor's decision`);

    return { interrupt: true, flowId: GovernorPardonFlow.id };
  }

  /**
   * Get participants (governors and phone holders)
   * @returns {string[]}
   */
  getParticipants() {
    return this.state?.governorIds || [];
  }

  /**
   * Get valid targets (only the condemned player, excluding self)
   * @param {string} playerId
   * @returns {Player[]}
   */
  getValidTargets(playerId) {
    if (!this.state) return [];
    if (!this.state.governorIds.includes(playerId)) return [];

    // Cannot pardon yourself
    if (this.state.condemnedId === playerId) return [];

    const condemned = this.game.getPlayer(this.state.condemnedId);
    return condemned ? [condemned] : [];
  }

  /**
   * Handle governor's selection
   * Returns a structured result for Game._executeFlowResult() to process.
   * @param {string} governorId
   * @param {string|null} targetId
   * @returns {Object|null}
   */
  onSelection(governorId, targetId) {
    if (!this.state || !this.state.governorIds.includes(governorId)) {
      return null;
    }

    const governor = this.game.getPlayer(governorId);
    const condemned = this.game.getPlayer(this.state.condemnedId);

    if (!governor || !condemned) {
      return { error: 'Invalid state' };
    }

    // Check phone usage before resolve (canUseItem may change after state changes)
    const usesPhone = governor.hasItem('phone') && governor.canUseItem('phone');

    // Pardon = selected the condemned player
    const result = targetId === this.state.condemnedId
      ? this.resolvePardon(governor, condemned)
      : this.resolveExecution(governor, condemned);

    // Add phone consumption to the result
    if (usesPhone) {
      if (!result.consumeItems) result.consumeItems = [];
      result.consumeItems.push({ playerId: governorId, itemId: 'phone' });
    }

    return result;
  }

  /**
   * Pardon the condemned player
   * Returns a structured result for Game._executeFlowResult() to process.
   * @param {Player} governor
   * @param {Player} condemned
   * @returns {Object}
   */
  resolvePardon(governor, condemned) {
    this.phase = 'resolving';

    const message = `${governor.getNameWithEmoji()} pardoned ${condemned.getNameWithEmoji()}`;

    this.cleanup();

    return {
      success: true,
      pardoned: true,
      message,
      slides: [{
        slide: {
          type: 'death',
          playerId: condemned.id,
          title: 'PARDONED',
          subtitle: `${condemned.name} was not eliminated`,
          revealRole: false,
          style: SlideStyle.POSITIVE,
        },
        jumpTo: true,
        isDeath: false,
      }],
      log: message,
    };
  }

  /**
   * Execute the condemned player
   * Returns a structured result for Game._executeFlowResult() to process.
   * @param {Player} governor
   * @param {Player} condemned
   * @returns {Object}
   */
  resolveExecution(governor, condemned) {
    this.phase = 'resolving';

    const condemnedId = this.state.condemnedId;
    const voteResolution = this.state.voteResolution;
    const voteInstance = this.state.voteInstance;
    const message = `${governor.getNameWithEmoji()} condemned ${condemned.getNameWithEmoji()}`;

    // Build slides array: "NO PARDON" title, then execution death slide
    const slides = [
      {
        slide: {
          type: 'title',
          title: 'NO PARDON',
          subtitle: `${condemned.name}'s fate is sealed`,
          style: SlideStyle.HOSTILE,
        },
        jumpTo: false,
        isDeath: false,
      },
    ];

    if (voteResolution?.slide) {
      const voterIds = Object.entries(voteInstance?.results || {})
        .filter(([, targetId]) => targetId === condemnedId)
        .map(([voterId]) => voterId);
      slides.push({
        slide: { ...voteResolution.slide, voterIds },
        jumpTo: false,
        isDeath: true,
      });
    }

    this.cleanup();

    return {
      success: true,
      pardoned: false,
      message,
      kills: [{ playerId: condemnedId, cause: 'eliminated' }],
      slides,
      jumpToSlide: 0, // Jump to the "NO PARDON" slide
      log: message,
    };
  }

  /**
   * Clean up flow state
   */
  cleanup() {
    // Clear pending events for governors
    if (this.state?.governorIds) {
      for (const gid of this.state.governorIds) {
        const governor = this.game.getPlayer(gid);
        if (governor) {
          governor.pendingEvents.delete(this.id);
          governor.clearSelection();
        }
      }
    }

    // Clean up legacy interruptData (for backwards compatibility)
    this.game.interruptData = null;

    super.cleanup();
  }
}
