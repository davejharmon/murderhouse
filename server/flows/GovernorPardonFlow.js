// server/flows/GovernorPardonFlow.js
// Consolidated Judge pardon logic

import { RoleId, ItemId, SlideStyle } from '../../shared/constants.js';
import { InterruptFlow } from './InterruptFlow.js';
import { str } from '../strings.js';

/**
 * Judge Pardon Flow
 *
 * STATE MACHINE:
 *   idle -> active (vote condemns) -> pardoned OR executed -> idle
 *
 * TRIGGER: Vote event results in elimination AND judge/gavel holder exists
 *
 * STATE:
 *   - condemnedId: string      - Player facing execution
 *   - condemnedName: string    - Display name
 *   - voteEventId: string      - The vote that triggered this
 *   - voteResolution: object   - Cached resolution from vote
 *   - voteInstance: object     - The vote event instance
 *   - judgeIds: string[]       - Eligible pardoners (judge role or gavel item)
 *
 * FLOW:
 *   1. Vote resolves with elimination -> canTrigger() returns true
 *   2. trigger() called:
 *      - Store condemned player info and vote resolution
 *      - Push "CONDEMNED" slide
 *      - Create pardon event, send prompts to judges
 *   3. Judge selects:
 *      - If target = condemned: PARDON (player lives)
 *      - If abstain/skip: EXECUTE (player dies)
 *   4. cleanup() - reset state
 *
 * NOTES:
 *   - Gavel can pardon once per game (gavel item consumed)
 *   - Judge role can always pardon (no limit)
 *   - Only one judge needs to pardon
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

    // Check for judges or gavel holders (excluding cowards — they lose all actions)
    const judges = this.game.getAlivePlayers().filter((p) => {
      if (p.hasItem(ItemId.COWARD)) return false;
      return (
        p.role.id === RoleId.JUDGE ||
        (p.hasItem(ItemId.GAVEL) && p.canUseItem(ItemId.GAVEL))
      );
    });

    return judges.length > 0;
  }

  /**
   * Initialize the Judge pardon flow
   * @param {Object} context - { voteEventId, resolution, instance }
   * @returns {Object} - { interrupt: true, flowId: 'pardon' }
   */
  trigger(context) {
    const { voteEventId, resolution, instance } = context;
    const condemned = resolution.victim;

    const judges = this.game.getAlivePlayers().filter((p) => {
      if (p.hasItem(ItemId.COWARD)) return false;
      return (
        p.role.id === RoleId.JUDGE ||
        (p.hasItem(ItemId.GAVEL) && p.canUseItem(ItemId.GAVEL))
      );
    });

    this.phase = 'active';
    this.state = {
      condemnedId: condemned.id,
      condemnedName: condemned.name,
      voteEventId,
      voteResolution: resolution,
      voteInstance: instance,
      judgeIds: judges.map((g) => g.id),
    };

    // Remove vote from judges' pending events
    for (const judge of judges) {
      judge.pendingEvents.delete(voteEventId);
    }

    // Create the pardon event
    this.game._startFlowEvent(this.id, {
      name: str('events', 'judgePardon.name'),
      description: str('events', 'judgePardon.description'),
      verb: 'pardon',
      participants: this.state.judgeIds,
      getValidTargets: (playerId) => this.getValidTargets(playerId),
      allowAbstain: true,
      playerResolved: true, // Auto-resolve on selection
    });

    // Push condemned slide
    this.game.pushSlide(
      {
        type: 'death',
        playerId: condemned.id,
        title: str('slides', 'flow.condemnedTitle'),
        subtitle: str('slides', 'flow.condemnedSubtitle'),
        revealRole: false,
        style: SlideStyle.WARNING,
      },
      false // Don't jump - tally slide is already shown
    );

    this.game.addLog(str('log', 'judgeDecision', { name: condemned.getNameWithEmoji() }));

    return { interrupt: true, flowId: GovernorPardonFlow.id };
  }

  /**
   * Get participants (judges and gavel holders)
   * @returns {string[]}
   */
  getParticipants() {
    return this.state?.judgeIds || [];
  }

  /**
   * Get valid targets (only the condemned player, excluding self)
   * @param {string} playerId
   * @returns {Player[]}
   */
  getValidTargets(playerId) {
    if (!this.state) return [];
    if (!this.state.judgeIds.includes(playerId)) return [];

    // Cannot pardon yourself
    if (this.state.condemnedId === playerId) return [];

    const condemned = this.game.getPlayer(this.state.condemnedId);
    return condemned ? [condemned] : [];
  }

  /**
   * Handle judge's selection
   * Returns a structured result for Game._executeFlowResult() to process.
   * @param {string} judgeId
   * @param {string|null} targetId
   * @returns {Object|null}
   */
  onSelection(judgeId, targetId) {
    if (!this.state || !this.state.judgeIds.includes(judgeId)) {
      return null;
    }

    const judge = this.game.getPlayer(judgeId);
    const condemned = this.game.getPlayer(this.state.condemnedId);

    if (!judge || !condemned) {
      return { error: 'Invalid state' };
    }

    // Check gavel usage before resolve (canUseItem may change after state changes)
    const usesGavel = judge.hasItem(ItemId.GAVEL) && judge.canUseItem(ItemId.GAVEL);

    // Pardon = selected the condemned player
    const result = targetId === this.state.condemnedId
      ? this.resolvePardon(judge, condemned)
      : this.resolveExecution(judge, condemned);

    // Only consume gavel when actually used to pardon
    if (usesGavel && result.pardoned) {
      if (!result.consumeItems) result.consumeItems = [];
      result.consumeItems.push({ playerId: judgeId, itemId: ItemId.GAVEL });
    }

    return result;
  }

  /**
   * Pardon the condemned player
   * Returns a structured result for Game._executeFlowResult() to process.
   * @param {Player} judge
   * @param {Player} condemned
   * @returns {Object}
   */
  resolvePardon(judge, condemned) {
    this.phase = 'resolving';

    const message = str('log', 'pardoned', { judge: judge.getNameWithEmoji(), victim: condemned.getNameWithEmoji() });

    this.cleanup();

    return {
      success: true,
      pardoned: true,
      message,
      slides: [{
        slide: {
          type: 'death',
          playerId: condemned.id,
          title: str('slides', 'flow.pardonedTitle'),
          subtitle: str('slides', 'flow.pardonedSubtitle', { judge: judge.name, name: condemned.name }),
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
   * @param {Player} judge
   * @param {Player} condemned
   * @returns {Object}
   */
  resolveExecution(judge, condemned) {
    this.phase = 'resolving';

    const condemnedId = this.state.condemnedId;
    const voteResolution = this.state.voteResolution;
    const voteInstance = this.state.voteInstance;
    const message = str('log', 'notPardoned', { judge: judge.getNameWithEmoji(), victim: condemned.getNameWithEmoji() });

    // Build slides array: "NO PARDON" title, then execution death slide
    const slides = [
      {
        slide: {
          type: 'title',
          title: str('slides', 'flow.noPardonTitle'),
          subtitle: str('slides', 'flow.noPardonSubtitle', { name: condemned.name }),
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
   * A judge disconnected with no remaining connections.
   * If ALL judges are now disconnected, auto-execute (treat as abstain).
   * @param {Player} player
   * @returns {Object|null}
   */
  onPlayerDisconnect(player) {
    if (!this.state || !this.state.judgeIds.includes(player.id)) return null;
    // Only auto-execute if every judge has fully disconnected
    const anyStillConnected = this.state.judgeIds.some(gid => {
      if (gid === player.id) return false; // this one just disconnected
      const g = this.game.getPlayer(gid);
      return g && g.connections.length > 0;
    });
    if (anyStillConnected) return null;
    const condemned = this.game.getPlayer(this.state.condemnedId);
    const judge = player; // use disconnecting player as the "decider" for logging
    if (!condemned) { this.cleanup(); return null; }
    this.game.addLog(str('log', 'judgeDisconnected', { name: player.getNameWithEmoji() }));
    return this.resolveExecution(judge, condemned);
  }

  /**
   * Clean up flow state
   */
  cleanup() {
    // Clear pending events for judges
    if (this.state?.judgeIds) {
      for (const gid of this.state.judgeIds) {
        const judge = this.game.getPlayer(gid);
        if (judge) {
          judge.clearFromEvent(this.id);
        }
      }
    }

    // Clean up legacy interruptData (for backwards compatibility)
    this.game.interruptData = null;

    super.cleanup();
  }
}
