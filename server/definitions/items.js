// server/definitions/items.js
// Declarative item definitions
// Items are capabilities/modifiers - they declare what they grant,
// and events/flows query for item holders.

import { EventId } from '../../shared/constants.js';

/**
 * Item Definition Schema:
 * {
 *   id: string,           // Unique identifier
 *   name: string,         // Full display name
 *   shortName?: string,   // Optional compact name for space-constrained displays
 *   description: string,  // Flavor text shown to player
 *   maxUses: number,      // Maximum uses (-1 for unlimited)
 *
 *   // Activation model (mutually exclusive):
 *   startsEvent?: string,    // Event ID to start when player activates (idle-activatable)
 *   grantsAbility?: string,  // Ability ID that flows/events check for (situational)
 * }
 *
 * Idle-activatable items (startsEvent):
 *   - Appear in player's ability selector when idle
 *   - Player triggers the linked event directly
 *   - Example: pistol -> starts 'shoot' event
 *
 * Situational items (grantsAbility):
 *   - Don't appear in idle ability selector
 *   - Flows/events check if player has the ability
 *   - Example: phone -> grants 'pardon' ability, checked by GovernorPardonFlow
 */

const items = {
  pistol: {
    id: 'pistol',
    name: 'Pistol',
    description: 'A deadly weapon. One shot. Make it count.',
    maxUses: 1,
    startsEvent: EventId.SHOOT, // Idle-activatable: starts the shoot event
  },

  phone: {
    id: 'phone',
    name: 'Phone',
    description: 'Call the governor for a one-time pardon. Use it wisely.',
    maxUses: 1,
    grantsAbility: 'pardon', // Situational: GovernorPardonFlow checks for this
  },

  clue: {
    id: 'clue',
    name: 'Clue',
    description: 'A mysterious lead. Investigate one player to learn their alignment.',
    maxUses: 1,
    startsEvent: EventId.INVESTIGATE, // Grants seer's investigate ability
  },

  tanned: {
    id: 'tanned',
    name: 'Tanned',
    description: 'A hidden curse. You appear guilty when investigated.',
    maxUses: -1, // Passive: always active while held
    hidden: true, // Not shown on player console or icon slots
    grantsAbility: 'appearsGuilty', // Checked by investigate/stumble events
  },

  prospect: {
    id: 'prospect',
    name: 'Prospect',
    description: 'A hidden mark. If killed by werewolves, join their pack instead of dying.',
    maxUses: -1, // Passive: consumed on trigger
    hidden: true, // Not shown on player console or icon slots
    grantsAbility: 'prospect', // Checked by killPlayer in Game.js
  },

  coward: {
    id: 'coward',
    name: "The Coward's Way Out",
    shortName: 'Coward',
    description: 'You hide from danger. No attacks can reach you — but you cannot act.',
    maxUses: -1, // Passive: always active while held
    grantsAbility: 'coward', // Checked by Game.getEventParticipants and event validTargets
  },
};

/**
 * Get item definition by ID
 */
export function getItem(itemId) {
  return items[itemId] || null;
}

/**
 * Get all item definitions
 */
export function getAllItems() {
  return Object.values(items);
}

export { items };
