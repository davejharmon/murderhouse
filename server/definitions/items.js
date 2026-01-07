// server/definitions/items.js
// Declarative item definitions
// Items can bestow events and abilities to players, similar to roles

/**
 * Item Definition Schema:
 * {
 *   id: string,           // Unique identifier
 *   name: string,         // Display name
 *   description: string,  // Flavor text shown to player
 *   maxUses: number,      // Maximum uses (-1 for unlimited)
 *
 *   // Events this item bestows (future: items could modify existing events)
 *   events: {
 *     [eventId]: {
 *       priority?: number,    // Lower = resolves first (default: 50)
 *       canTarget?: (player, target, game) => boolean,
 *       onResolve?: (player, target, game) => ResolveResult,
 *     }
 *   },
 *
 *   // Passive abilities triggered by game events
 *   passives: {
 *     onEquip?: (player, game) => void,
 *     onDayStart?: (player, game) => void,
 *     onNightStart?: (player, game) => void,
 *     onUnequip?: (player, game) => void,
 *   },
 * }
 */

const items = {
  pistol: {
    id: 'pistol',
    name: 'Pistol',
    description: 'A deadly weapon. One shot. Make it count.',
    maxUses: 1,
    events: {},
    passives: {},
  },

  phone: {
    id: 'phone',
    name: 'Phone',
    description: 'Call the governor for a one-time pardon. Use it wisely.',
    maxUses: 1,
    events: {},
    passives: {},
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
