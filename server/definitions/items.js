// server/definitions/items.js
// Declarative item definitions
// Items are capabilities/modifiers - they declare what they grant,
// and events/flows query for item holders.

import { EventId } from '../../shared/constants.js';
import { str } from '../strings.js';

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
 *
 * Item consumption timing:
 *   IMMEDIATE  — consumed as soon as the player activates/selects
 *                (player-initiated items like pistol: consumeItem called inside the event's resolve)
 *   ON_RESOLVE — consumed when the event resolves via _cleanupParticipants
 *                (participation-granting items like clue: item.startsEvent === eventId && uses > 0)
 *   ON_TRIGGER — consumed when a passive condition fires, regardless of the event lifecycle
 *                (passive items like coward, barricade, novote: consumed inside killPlayer / vote logic)
 */

const items = {
  pistol: {
    id: 'pistol',
    get name() { return str('items', 'pistol.name') },
    get description() { return str('items', 'pistol.description') },
    maxUses: 1,
    startsEvent: EventId.SHOOT, // Idle-activatable: starts the shoot event
  },

  phone: {
    id: 'phone',
    get name() { return str('items', 'phone.name') },
    get description() { return str('items', 'phone.description') },
    maxUses: 1,
    grantsAbility: 'pardon', // Situational: GovernorPardonFlow checks for this
  },

  clue: {
    id: 'clue',
    get name() { return str('items', 'clue.name') },
    get description() { return str('items', 'clue.description') },
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
    get name() { return str('items', 'coward.name') },
    get shortName() { return str('items', 'coward.shortName') },
    get description() { return str('items', 'coward.description') },
    maxUses: -1, // Passive: always active while held
    grantsAbility: 'coward', // Checked by Game.getEventParticipants and event validTargets
  },

  barricade: {
    id: 'barricade',
    get name() { return str('items', 'barricade.name') },
    get description() { return str('items', 'barricade.description') },
    maxUses: 1, // Passive: consumed on first death absorption
    grantsAbility: 'barricade', // Checked by killPlayer in Game.js
  },

  novote: {
    id: 'novote',
    name: 'No Vote',
    shortName: 'NoVote',
    description: 'A silent restraint. You may not participate in the next elimination vote.',
    maxUses: 1, // Passive: consumed when vote resolves
    hidden: true, // Not shown on player console or icon slots
    grantsAbility: 'novote', // Checked by vote.participants in events.js
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
