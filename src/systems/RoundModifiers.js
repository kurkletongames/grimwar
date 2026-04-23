/**
 * Round modifier definitions and voting logic for roguelike mode.
 */

export const MODIFIERS = [
  {
    id: 'none',
    name: 'No Modifier',
    desc: 'Standard round — no changes.',
    color: 0x888888,
    icon: '—',
  },
  {
    id: 'low_gravity',
    name: 'Low Gravity',
    desc: 'Knockback sends you flying. Everything is floaty.',
    color: 0x88ccff,
    icon: '🪶',
    knockbackMult: 2.5,
    frictionOverride: 0.995,
  },
  {
    id: 'speed_demon',
    name: 'Speed Demon',
    desc: 'Move 50% faster, cast 50% faster.',
    color: 0xffaa00,
    icon: '⚡',
    speedMult: 1.5,
    cooldownMult: 0.5,
  },
  {
    id: 'glass_round',
    name: 'Glass Round',
    desc: 'Everyone starts with 75 HP.',
    color: 0xff4444,
    icon: '💔',
    maxHpOverride: 75,
  },
  {
    id: 'sudden_death',
    name: 'Sudden Death',
    desc: 'Arena shrinks immediately and 3x faster.',
    color: 0xcc2200,
    icon: '💀',
    shrinkDelay: 0,
    shrinkRateMult: 3,
  },
  {
    id: 'big_head',
    name: 'Big Head Mode',
    desc: 'Wizards and projectiles are twice as big.',
    color: 0xff88ff,
    icon: '🎈',
    wizardRadiusMult: 2,
    projectileRadiusMult: 2,
  },
  {
    id: 'vampire',
    name: 'Vampire Round',
    desc: 'All damage heals the attacker for 30%.',
    color: 0xcc0044,
    icon: '🧛',
    globalLifesteal: 0.3,
  },
  {
    id: 'mirror_match',
    name: 'Mirror Match',
    desc: 'Knockback is reversed — pulls you toward the attacker.',
    color: 0x44ffcc,
    icon: '🪞',
    reverseKnockback: true,
  },
];

/** Pick N random unique modifiers (always includes 'none' as first option) */
export function pickVoteOptions(count = 3) {
  const pool = MODIFIERS.filter((m) => m.id !== 'none');
  const shuffled = pool.sort(() => Math.random() - 0.5);
  const picks = shuffled.slice(0, count - 1);
  return [MODIFIERS[0], ...picks]; // 'none' is always first option
}

/** Tally votes and return winning modifier ID. Ties broken randomly. */
export function tallyVotes(votes) {
  const counts = {};
  for (const modId of Object.values(votes)) {
    counts[modId] = (counts[modId] || 0) + 1;
  }
  let maxCount = 0;
  let winners = [];
  for (const [modId, count] of Object.entries(counts)) {
    if (count > maxCount) {
      maxCount = count;
      winners = [modId];
    } else if (count === maxCount) {
      winners.push(modId);
    }
  }
  return winners[Math.floor(Math.random() * winners.length)] || 'none';
}

/** Get modifier definition by ID */
export function getModifier(id) {
  return MODIFIERS.find((m) => m.id === id) || MODIFIERS[0];
}
