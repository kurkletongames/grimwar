/**
 * Central spell registry: base stats, shop prices, and per-spell upgrade definitions.
 * Used by arena mode shop. Roguelike mode uses its own UPGRADES array in GameScene.
 */

export const SPELL_DEFS = {
  fireball: {
    id: 'fireball',
    name: 'Fireball',
    desc: 'Balanced fireball with solid damage and knockback.',
    color: 0xff6600,
    shopPrice: 0, // free — everyone starts with it
    baseCooldown: 2500,
    baseStats: {
      speed: 250,
      damage: 15,
      knockback: 700,
      radius: 8,
      multishot: 1,
      piercing: false,
      cooldownReduction: 0,
      lifesteal: 0,
      selfKnockback: 0,
    },
    upgrades: [
      { id: 'fb_dmg1', title: 'Searing Flames', desc: 'Damage +5', price: 100, apply: (s) => { s.damage += 5; } },
      { id: 'fb_speed1', title: 'Swift Cast', desc: 'Speed +40', price: 100, apply: (s) => { s.speed += 40; } },
      { id: 'fb_kb1', title: 'Concussive Blast', desc: 'Knockback +150', price: 150, apply: (s) => { s.knockback += 150; } },
      { id: 'fb_cd1', title: 'Quick Hands', desc: 'Cooldown -300ms', price: 200, apply: (s) => { s.cooldownReduction += 300; } },
      { id: 'fb_multi', title: 'Split Bolt', desc: '+1 projectile', price: 300, apply: (s) => { s.multishot += 1; } },
      { id: 'fb_pierce', title: 'Piercing Flame', desc: 'Passes through enemies', price: 400, maxStacks: 1, apply: (s) => { s.piercing = true; } },
      { id: 'fb_lifesteal', title: 'Siphon', desc: '+20% lifesteal', price: 350, apply: (s) => { s.lifesteal += 0.2; } },
    ],
  },

  ice_shard: {
    id: 'ice_shard',
    name: 'Ice Shard',
    desc: 'Slower projectile that slows enemies on hit.',
    color: 0x88ddff,
    shopPrice: 200,
    baseCooldown: 2000,
    baseStats: {
      speed: 180,
      damage: 10,
      knockback: 400,
      radius: 7,
      slowAmount: 0.5,
      slowDuration: 2000,
      cooldownReduction: 0,
    },
    upgrades: [
      { id: 'ice_dmg', title: 'Frostbite', desc: 'Damage +5', price: 100, apply: (s) => { s.damage += 5; } },
      { id: 'ice_slow_dur', title: 'Deep Freeze', desc: 'Slow duration +1s', price: 200, apply: (s) => { s.slowDuration += 1000; } },
      { id: 'ice_slow_str', title: 'Permafrost', desc: 'Slow strength +15%', price: 250, apply: (s) => { s.slowAmount += 0.15; } },
      { id: 'ice_cd', title: 'Rapid Chill', desc: 'Cooldown -250ms', price: 200, apply: (s) => { s.cooldownReduction += 250; } },
    ],
  },

  lightning_bolt: {
    id: 'lightning_bolt',
    name: 'Lightning Bolt',
    desc: 'Very fast, low damage, short cooldown.',
    color: 0xffff44,
    shopPrice: 250,
    baseCooldown: 1200,
    baseStats: {
      speed: 500,
      damage: 8,
      knockback: 300,
      radius: 5,
      cooldownReduction: 0,
    },
    upgrades: [
      { id: 'lt_dmg', title: 'Overload', desc: 'Damage +4', price: 100, apply: (s) => { s.damage += 4; } },
      { id: 'lt_cd', title: 'Surge', desc: 'Cooldown -200ms', price: 200, apply: (s) => { s.cooldownReduction += 200; } },
      { id: 'lt_kb', title: 'Thunderclap', desc: 'Knockback +200', price: 150, apply: (s) => { s.knockback += 200; } },
      { id: 'lt_speed', title: 'Chain Lightning', desc: 'Speed +80', price: 150, apply: (s) => { s.speed += 80; } },
    ],
  },

  meteor: {
    id: 'meteor',
    name: 'Meteor',
    desc: 'Slow AoE explosion on impact.',
    color: 0xcc2200,
    shopPrice: 350,
    baseCooldown: 4000,
    baseStats: {
      speed: 150,
      damage: 25,
      knockback: 900,
      radius: 6,
      explosionRadius: 80,
      cooldownReduction: 0,
    },
    upgrades: [
      { id: 'met_dmg', title: 'Infernal Impact', desc: 'Damage +8', price: 150, apply: (s) => { s.damage += 8; } },
      { id: 'met_aoe', title: 'Widened Crater', desc: 'Explosion radius +30', price: 250, apply: (s) => { s.explosionRadius += 30; } },
      { id: 'met_cd', title: 'Meteor Shower', desc: 'Cooldown -500ms', price: 300, apply: (s) => { s.cooldownReduction += 500; } },
      { id: 'met_kb', title: 'Seismic Force', desc: 'Knockback +300', price: 200, apply: (s) => { s.knockback += 300; } },
    ],
  },

  gravity_sphere: {
    id: 'gravity_sphere',
    name: 'Gravity Sphere',
    desc: 'Creates a gravity well that pulls enemies in.',
    color: 0x9944ff,
    shopPrice: 400,
    baseCooldown: 5000,
    baseStats: {
      speed: 200,
      damage: 5,
      radius: 8,
      pullStrength: 120,
      pullRadius: 100,
      wellDuration: 3000,
      cooldownReduction: 0,
    },
    upgrades: [
      { id: 'grav_pull', title: 'Singularity', desc: 'Pull strength +40', price: 200, apply: (s) => { s.pullStrength += 40; } },
      { id: 'grav_radius', title: 'Event Horizon', desc: 'Pull radius +30', price: 250, apply: (s) => { s.pullRadius += 30; } },
      { id: 'grav_dur', title: 'Temporal Rift', desc: 'Well duration +1.5s', price: 300, apply: (s) => { s.wellDuration += 1500; } },
      { id: 'grav_cd', title: 'Void Mastery', desc: 'Cooldown -600ms', price: 250, apply: (s) => { s.cooldownReduction += 600; } },
    ],
  },
};

/** Global (non-spell) upgrades available in arena shop */
export const GLOBAL_UPGRADES = [
  { id: 'shop_hp', title: 'Fortify', desc: 'Max HP +15', price: 150, apply: (g) => { g.bonusHp += 15; } },
  { id: 'shop_blink_range', title: 'Phase Shift', desc: 'Blink distance +60', price: 250, apply: (g) => { g.blinkDistance += 60; } },
  { id: 'shop_blink_kb', title: 'Aftershock', desc: 'Blink knockback +900', price: 350, maxStacks: 1, apply: (g) => { g.blinkKnockback += 900; } },
];

/** All spell IDs in display order */
export const SPELL_IDS = ['fireball', 'ice_shard', 'lightning_bolt', 'meteor', 'gravity_sphere'];

/** Max spell slots per player */
export const MAX_SPELL_SLOTS = 4;

/** Create a fresh spell stats object (copy of base stats) */
export function createBaseSpellStats(spellId) {
  const def = SPELL_DEFS[spellId];
  if (!def) return null;
  return { ...def.baseStats };
}

/** Create a fresh global upgrades object */
export function createBaseGlobalUpgrades() {
  return {
    bonusHp: 0,
    blinkKnockback: 0,
    blinkDistance: 120,
  };
}
