// server/flows/GovernorPardonFlow.js
// Consolidated Governor pardon logic

import { ServerMsg, SlideStyle } from '../../shared/constants.js';
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

    // Consume phone if used
    if (governor.hasItem('phone') && governor.canUseItem('phone')) {
      this.game.consumeItem(governorId, 'phone');
    }

    // Pardon = selected the condemned player
    if (targetId === this.state.condemnedId) {
      return this.resolvePardon(governor, condemned);
    } else {
      // Abstain or skip = execute
      return this.resolveExecution(governor, condemned);
    }
  }

  /**
   * Pardon the condemned player
   * @param {Player} governor
   * @param {Player} condemned
   * @returns {Object}
   */
  resolvePardon(governor, condemned) {
    this.phase = 'resolving';

    // Push pardon slide
    this.game.pushSlide(
      {
        type: 'death',
        playerId: condemned.id,
        title: 'PARDONED',
        subtitle: `${condemned.name} was not eliminated`,
        revealRole: false,
        style: SlideStyle.POSITIVE,
      },
      true // Jump to this slide
    );

    const result = {
      success: true,
      pardoned: true,
      message: `${governor.getNameWithEmoji()} pardoned ${condemned.getNameWithEmoji()}`,
    };

    this.game.addLog(result.message);

    this.cleanup();
    return result;
  }

  /**
   * Execute the condemned player
   * @param {Player} governor
   * @param {Player} condemned
   * @returns {Object}
   */
  resolveExecution(governor, condemned) {
    this.phase = 'resolving';

    // Remember queue position before adding slides
    const noPardonSlideIndex = this.game.slideQueue.length;

    // Push "no pardon" slide
    this.game.pushSlide(
      {
        type: 'title',
        title: 'NO PARDON',
        subtitle: `${condemned.name}'s fate is sealed`,
        style: SlideStyle.HOSTILE,
      },
      false
    );

    // Execute the elimination (this triggers hunter revenge if applicable)
    this.game.killPlayer(this.state.condemnedId, 'eliminated');

    // Queue execution death slide (queueDeathSlide handles hunter revenge automatically)
    if (this.state.voteResolution?.slide) {
      // Get voter IDs from the original vote instance
      const voterIds = Object.entries(this.state.voteInstance?.results || {})
        .filter(([, targetId]) => targetId === this.state.condemnedId)
        .map(([voterId]) => voterId);
      this.game.queueDeathSlide(
        { ...this.state.voteResolution.slide, voterIds },
        false
      );
    }

    // Jump to "NO PARDON" slide
    this.game.currentSlideIndex = noPardonSlideIndex;
    this.game.broadcastSlides();

    const result = {
      success: true,
      pardoned: false,
      message: `${governor.getNameWithEmoji()} condemned ${condemned.getNameWithEmoji()}`,
    };

    this.game.addLog(result.message);

    this.cleanup();
    return result;
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
