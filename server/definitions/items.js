// server/definitions/items.js
// Declarative item definitions
// Items are capabilities/modifiers - they declare what they grant,
// and events/flows query for item holders.

/**
 * Item Definition Schema:
 * {
 *   id: string,           // Unique identifier
 *   name: string,         // Display name
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
    startsEvent: 'shoot', // Idle-activatable: starts the shoot event
  },

  phone: {
    id: 'phone',
    name: 'Phone',
    description: 'Call the governor for a one-time pardon. Use it wisely.',
    maxUses: 1,
    grantsAbility: 'pardon', // Situational: GovernorPardonFlow checks for this
  },

  crystalBall: {
    id: 'crystalBall',
    name: 'Crystal Ball',
    description: 'Peer into a soul to learn their true nature.',
    maxUses: 1,
    startsEvent: 'investigate', // Grants seer's investigate ability
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
