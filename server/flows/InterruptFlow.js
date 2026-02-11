// server/flows/InterruptFlow.js
// Base class for complex interrupt-based game flows

/**
 * InterruptFlow - Base class for complex multi-step game flows
 *
 * Flows encapsulate logic that would otherwise be scattered across multiple files.
 * Each flow manages its own state machine and provides a single place to understand
 * the complete lifecycle of a complex game feature.
 *
 * LIFECYCLE:
 *   canTrigger(context) - Check if this flow should activate
 *   trigger(context)    - Initialize flow, set state, push slides, start event
 *   onSelection(pid,tid)- Handle player action during flow
 *   resolve()           - Execute final effects
 *   cleanup()           - Reset state, remove from activeEvents
 *
 * PHASES:
 *   'idle'      - Flow is not active
 *   'active'    - Flow is running, waiting for player input
 *   'resolving' - Flow is executing final effects
 *
 * USAGE:
 *   Subclasses must implement:
 *   - static get id()     - Unique identifier for this flow
 *   - canTrigger(context) - When should this flow activate?
 *   - trigger(context)    - How to start the flow
 *   - onSelection(pid,tid)- How to handle player choices
 *   - resolve(...)        - How to execute final effects
 *   - getParticipants()   - Who can act in this flow?
 *   - getValidTargets(pid)- What are valid targets for a participant?
 */
export class InterruptFlow {
  constructor(game) {
    this.game = game;
    this.state = null;
    this.phase = 'idle';
  }

  /**
   * Unique identifier for this flow (used as event ID)
   * @returns {string}
   */
  static get id() {
    throw new Error('Subclass must implement static id getter');
  }

  /**
   * Game hooks this flow responds to (e.g., 'onDeath', 'onVoteResolution')
   * @returns {string[]}
   */
  static get hooks() {
    return [];
  }

  /**
   * Instance accessor for the flow ID
   * @returns {string}
   */
  get id() {
    return this.constructor.id;
  }

  /**
   * Check if this flow should trigger given the context
   * @param {Object} context - Trigger context (varies by flow type)
   * @returns {boolean}
   */
  canTrigger(context) {
    return false;
  }

  /**
   * Initialize and start the flow
   * @param {Object} context - Trigger context
   * @returns {Object} Result with { interrupt: boolean, flowId: string }
   */
  trigger(context) {
    throw new Error('Subclass must implement trigger()');
  }

  /**
   * Handle a player's selection during this flow
   * @param {string} playerId - The player making the selection
   * @param {string|null} targetId - The selected target (null for abstain)
   * @returns {Object|null} Result object or null if selection not handled
   */
  onSelection(playerId, targetId) {
    return null;
  }

  /**
   * Execute the final resolution of the flow
   * @param {...any} args - Flow-specific arguments
   * @returns {Object} Resolution result
   */
  resolve(...args) {
    throw new Error('Subclass must implement resolve()');
  }

  /**
   * Clean up flow state after completion
   */
  cleanup() {
    this.state = null;
    this.phase = 'idle';
    // Remove from activeEvents if still present
    if (this.game.activeEvents.has(this.id)) {
      this.game.activeEvents.delete(this.id);
    }
  }

  /**
   * Get the list of player IDs who can participate in this flow
   * @returns {string[]}
   */
  getParticipants() {
    return [];
  }

  /**
   * Get valid targets for a participant
   * @param {string} playerId - The participant
   * @returns {Player[]}
   */
  getValidTargets(playerId) {
    return [];
  }

  /**
   * Return (and clear) any pending slide queued by this flow.
   * Called by Game.queueDeathSlide() after pushing a death slide.
   * @returns {Object|null} Slide object or null
   */
  getPendingSlide() {
    return null;
  }

  /**
   * Check if this flow is currently active
   * @returns {boolean}
   */
  isActive() {
    return this.phase === 'active' || this.phase === 'resolving';
  }
}
