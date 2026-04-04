/**
 * Categorized spell registry for arena mode shop.
 * Roguelike mode uses its own UPGRADES array in GameScene.
 */

// ---- Category metadata ----
export const SPELL_CATEGORIES = {
  fixed:        { slot: 0, label: 'Fixed',          color: 0xff6600 },
  bread_butter: { slot: 1, label: 'Bread & Butter', color: 0x44aaff },
  tricky:       { slot: 2, label: 'Tricky',         color: 0x44ff88 },
  power:        { slot: 3, label: 'Power',          color: 0xff4444 },
};

export const SLOT_KEYS = ['fixed', 'bread_butter', 'tricky', 'power'];
export const MAX_SPELL_SLOTS = 4;
export const MAX_TIER = 3;

// ---- Spell definitions ----
export const SPELL_DEFS = {
  // === SLOT 1: Fixed ===
  fireball: {
    id: 'fireball',
    name: 'Fireball',
    desc: 'Balanced fireball with solid damage and knockback.',
    category: 'fixed',
    color: 0xff6600,
    shopPrice: 0,
    baseCooldown: 2500,
    baseStats: {
      speed: 250, damage: 15, knockback: 700, radius: 8,
      multishot: 1, piercing: false, cooldownReduction: 0, lifesteal: 0, selfKnockback: 0,
    },
    tiers: {
      1: { title: 'Searing Flames', desc: 'Damage +5, Speed +20', price: 120,
           apply: (s) => { s.damage += 5; s.speed += 20; } },
      2: { title: 'Inferno', desc: 'Damage +5, KB +100, CD -200ms', price: 180,
           apply: (s) => { s.damage += 5; s.knockback += 100; s.cooldownReduction += 200; } },
      3: { title: 'Hellfire', desc: 'Damage +8, +1 Projectile, Piercing', price: 240,
           apply: (s) => { s.damage += 8; s.multishot += 1; s.piercing = true; } },
    },
  },

  // === SLOT 2: Bread & Butter ===
  homing_missile: {
    id: 'homing_missile',
    name: 'Homing Missile',
    desc: 'Gradually curves toward nearest enemy.',
    category: 'bread_butter',
    color: 0x44ccff,
    shopPrice: 150,
    baseCooldown: 2200,
    baseStats: {
      speed: 200, damage: 12, knockback: 500, radius: 6,
      turnRate: 0.8, lifetime: 4000, cooldownReduction: 0,
    },
    tiers: {
      1: { title: 'Guided', desc: 'Turn +0.3, Damage +3', price: 100,
           apply: (s) => { s.turnRate += 0.3; s.damage += 3; } },
      2: { title: 'Heat Seeker', desc: 'Turn +0.3, Speed +30, Life +500ms', price: 150,
           apply: (s) => { s.turnRate += 0.3; s.speed += 30; s.lifetime += 500; } },
      3: { title: 'Predator', desc: 'Damage +5, KB +150, CD -300ms', price: 200,
           apply: (s) => { s.damage += 5; s.knockback += 150; s.cooldownReduction += 300; } },
    },
  },

  ricochet: {
    id: 'ricochet',
    name: 'Ricochet',
    desc: 'Bounces between nearby players on hit.',
    category: 'bread_butter',
    color: 0x88ff44,
    shopPrice: 150,
    baseCooldown: 2000,
    baseStats: {
      speed: 280, damage: 10, knockback: 300, radius: 5,
      maxBounces: 2, bounceRange: 200, cooldownReduction: 0,
    },
    tiers: {
      1: { title: 'Rebound', desc: '+1 Bounce, Damage +3', price: 100,
           apply: (s) => { s.maxBounces += 1; s.damage += 3; } },
      2: { title: 'Ping Pong', desc: '+1 Bounce, Range +60, Speed +30', price: 150,
           apply: (s) => { s.maxBounces += 1; s.bounceRange += 60; s.speed += 30; } },
      3: { title: 'Chain Reaction', desc: '+1 Bounce, Damage +5, KB +150', price: 200,
           apply: (s) => { s.maxBounces += 1; s.damage += 5; s.knockback += 150; } },
    },
  },

  color_spray: {
    id: 'color_spray',
    name: 'Color Spray',
    desc: 'Short-range cone burst of small projectiles.',
    category: 'bread_butter',
    color: 0xff44ff,
    shopPrice: 150,
    baseCooldown: 2800,
    baseStats: {
      speed: 300, damage: 4, knockback: 200, radius: 4,
      projectileCount: 5, coneAngle: 0.6, lifetime: 600, cooldownReduction: 0,
    },
    tiers: {
      1: { title: 'Prismatic', desc: '+2 Projectiles, KB +50', price: 120,
           apply: (s) => { s.projectileCount += 2; s.knockback += 50; } },
      2: { title: 'Dazzle', desc: '+2 Projectiles, Damage +2, Cone +0.2', price: 180,
           apply: (s) => { s.projectileCount += 2; s.damage += 2; s.coneAngle += 0.2; } },
      3: { title: 'Kaleidoscope', desc: '+3 Projectiles, Damage +3, CD -400ms', price: 240,
           apply: (s) => { s.projectileCount += 3; s.damage += 3; s.cooldownReduction += 400; } },
    },
  },

  // === SLOT 3: Tricky ===
  tether: {
    id: 'tether',
    name: 'Tether',
    desc: 'Beam that links you to an enemy, pulling both together.',
    category: 'tricky',
    color: 0xff8844,
    shopPrice: 200,
    baseCooldown: 5000,
    baseStats: {
      speed: 350, damage: 5, radius: 5,
      tetherDuration: 4000, pullForce: 100, tetherRange: 280, cooldownReduction: 0,
    },
    tiers: {
      1: { title: 'Bind', desc: 'Duration +1s, Pull +25', price: 150,
           apply: (s) => { s.tetherDuration += 1000; s.pullForce += 25; } },
      2: { title: 'Iron Chain', desc: 'Duration +1s, Range +50, Pull +25', price: 225,
           apply: (s) => { s.tetherDuration += 1000; s.tetherRange += 50; s.pullForce += 25; } },
      3: { title: 'Tractor Beam', desc: 'Pull +40, Range +50, CD -800ms', price: 300,
           apply: (s) => { s.pullForce += 40; s.tetherRange += 50; s.cooldownReduction += 800; } },
    },
  },

  mirror_image: {
    id: 'mirror_image',
    name: 'Mirror Image',
    desc: 'Spawn a decoy that knockbacks enemies on contact.',
    category: 'tricky',
    color: 0x88aaff,
    shopPrice: 200,
    baseCooldown: 6000,
    baseStats: {
      decoySpeed: 150, decoyDuration: 3000,
      knockbackPulse: 600, pulseRadius: 60, cooldownReduction: 0,
    },
    tiers: {
      1: { title: 'Double Take', desc: 'Duration +1s, KB +150', price: 175,
           apply: (s) => { s.decoyDuration += 1000; s.knockbackPulse += 150; } },
      2: { title: 'Phantasm', desc: 'Speed +40, Pulse +20, Duration +1s', price: 250,
           apply: (s) => { s.decoySpeed += 40; s.pulseRadius += 20; s.decoyDuration += 1000; } },
      3: { title: 'Doppelganger', desc: 'KB +200, Pulse +20, CD -800ms', price: 325,
           apply: (s) => { s.knockbackPulse += 200; s.pulseRadius += 20; s.cooldownReduction += 800; } },
    },
  },

  vortex_wall: {
    id: 'vortex_wall',
    name: 'Vortex Wall',
    desc: 'Energy wall that deflects enemy projectiles.',
    category: 'tricky',
    color: 0x44ffcc,
    shopPrice: 200,
    baseCooldown: 7000,
    baseStats: {
      wallDuration: 3000, wallLength: 80, wallThickness: 12, cooldownReduction: 0,
    },
    tiers: {
      1: { title: 'Barrier', desc: 'Duration +1s, Length +20', price: 175,
           apply: (s) => { s.wallDuration += 1000; s.wallLength += 20; } },
      2: { title: 'Deflector', desc: 'Duration +1s, Length +20, CD -800ms', price: 250,
           apply: (s) => { s.wallDuration += 1000; s.wallLength += 20; s.cooldownReduction += 800; } },
      3: { title: 'Aegis', desc: 'Duration +1s, Length +30, Thick +6', price: 325,
           apply: (s) => { s.wallDuration += 1000; s.wallLength += 30; s.wallThickness += 6; } },
    },
  },

  // === SLOT 4: Power (existing) ===
  meteor: {
    id: 'meteor',
    name: 'Meteor',
    desc: 'Slow AoE explosion on impact.',
    category: 'power',
    color: 0xcc2200,
    shopPrice: 250,
    baseCooldown: 4000,
    baseStats: {
      speed: 150, damage: 25, knockback: 900, radius: 6,
      explosionRadius: 80, cooldownReduction: 0,
    },
    tiers: {
      1: { title: 'Infernal Impact', desc: 'Damage +8, Explosion +15', price: 200,
           apply: (s) => { s.damage += 8; s.explosionRadius += 15; } },
      2: { title: 'Widened Crater', desc: 'Explosion +20, KB +200, CD -400ms', price: 300,
           apply: (s) => { s.explosionRadius += 20; s.knockback += 200; s.cooldownReduction += 400; } },
      3: { title: 'Apocalypse', desc: 'Damage +12, Explosion +25, KB +300', price: 400,
           apply: (s) => { s.damage += 12; s.explosionRadius += 25; s.knockback += 300; } },
    },
  },

  gravity_sphere: {
    id: 'gravity_sphere',
    name: 'Gravity Sphere',
    desc: 'Creates a gravity well that pulls enemies in.',
    category: 'power',
    color: 0x9944ff,
    shopPrice: 250,
    baseCooldown: 5000,
    baseStats: {
      speed: 200, damage: 5, radius: 8,
      pullStrength: 120, pullRadius: 100, wellDuration: 3000, cooldownReduction: 0,
    },
    tiers: {
      1: { title: 'Singularity', desc: 'Pull +30, Radius +15', price: 225,
           apply: (s) => { s.pullStrength += 30; s.pullRadius += 15; } },
      2: { title: 'Event Horizon', desc: 'Duration +1s, Pull +30, Radius +20', price: 325,
           apply: (s) => { s.wellDuration += 1000; s.pullStrength += 30; s.pullRadius += 20; } },
      3: { title: 'Black Hole', desc: 'Duration +1.5s, Pull +40, CD -600ms', price: 425,
           apply: (s) => { s.wellDuration += 1500; s.pullStrength += 40; s.cooldownReduction += 600; } },
    },
  },

  lightning_bolt: {
    id: 'lightning_bolt',
    name: 'Lightning Bolt',
    desc: 'Very fast, low damage, short cooldown.',
    category: 'power',
    color: 0xffff44,
    shopPrice: 250,
    baseCooldown: 1200,
    baseStats: {
      speed: 500, damage: 8, knockback: 300, radius: 5, cooldownReduction: 0,
    },
    tiers: {
      1: { title: 'Overload', desc: 'Damage +4, Speed +60', price: 200,
           apply: (s) => { s.damage += 4; s.speed += 60; } },
      2: { title: 'Surge', desc: 'Damage +4, KB +150, CD -150ms', price: 300,
           apply: (s) => { s.damage += 4; s.knockback += 150; s.cooldownReduction += 150; } },
      3: { title: 'Thunderstorm', desc: 'Damage +6, KB +200, CD -200ms', price: 400,
           apply: (s) => { s.damage += 6; s.knockback += 200; s.cooldownReduction += 200; } },
    },
  },
};

// ---- Blink variant definitions ----
export const BLINK_DEFS = {
  default_blink: {
    id: 'default_blink',
    name: 'Blink',
    desc: 'Standard short-range teleport.',
    color: 0x4fc3f7,
    shopPrice: 0,
    baseCooldown: 4000,
    baseStats: { blinkDistance: 120, cooldownReduction: 0 },
    tiers: null,
  },

  rush: {
    id: 'rush',
    name: 'Rush',
    desc: 'Dash in a line, knocking back anyone in the path.',
    color: 0xff8844,
    shopPrice: 150,
    baseCooldown: 4500,
    baseStats: {
      dashDistance: 180, knockback: 500, hitRadius: 25, cooldownReduction: 0,
    },
    tiers: {
      1: { title: 'Charge', desc: 'Distance +30, KB +100', price: 150,
           apply: (s) => { s.dashDistance += 30; s.knockback += 100; } },
      2: { title: 'Stampede', desc: 'Distance +30, KB +150, CD -400ms', price: 225,
           apply: (s) => { s.dashDistance += 30; s.knockback += 150; s.cooldownReduction += 400; } },
      3: { title: 'Juggernaut', desc: 'Distance +40, KB +200, Width +10', price: 300,
           apply: (s) => { s.dashDistance += 40; s.knockback += 200; s.hitRadius += 10; } },
    },
  },

  extended_blink: {
    id: 'extended_blink',
    name: 'Extended Blink',
    desc: 'Longer range blink with reduced cooldown.',
    color: 0x88ccff,
    shopPrice: 150,
    baseCooldown: 3500,
    baseStats: { blinkDistance: 180, cooldownReduction: 0 },
    tiers: {
      1: { title: 'Far Step', desc: 'Distance +40, CD -300ms', price: 150,
           apply: (s) => { s.blinkDistance += 40; s.cooldownReduction += 300; } },
      2: { title: 'Phase Walk', desc: 'Distance +40, CD -300ms', price: 225,
           apply: (s) => { s.blinkDistance += 40; s.cooldownReduction += 300; } },
      3: { title: 'Dimensional', desc: 'Distance +50, CD -400ms', price: 300,
           apply: (s) => { s.blinkDistance += 50; s.cooldownReduction += 400; } },
    },
  },

  swap: {
    id: 'swap',
    name: 'Swap',
    desc: 'Fire a projectile that swaps your position with the target.',
    color: 0xcc44ff,
    shopPrice: 150,
    baseCooldown: 6000,
    baseStats: {
      projectileSpeed: 350, projectileRadius: 6, projectileLifetime: 2000, cooldownReduction: 0,
    },
    tiers: {
      1: { title: 'Quick Swap', desc: 'Speed +50, CD -500ms', price: 175,
           apply: (s) => { s.projectileSpeed += 50; s.cooldownReduction += 500; } },
      2: { title: 'Long Swap', desc: 'Speed +50, Life +500ms, CD -500ms', price: 250,
           apply: (s) => { s.projectileSpeed += 50; s.projectileLifetime += 500; s.cooldownReduction += 500; } },
      3: { title: 'Dimension Rift', desc: 'Speed +80, Life +500ms, CD -600ms', price: 325,
           apply: (s) => { s.projectileSpeed += 80; s.projectileLifetime += 500; s.cooldownReduction += 600; } },
    },
  },
};

// ---- Lookup helpers ----
export const SPELLS_BY_CATEGORY = {
  fixed:        ['fireball'],
  bread_butter: ['homing_missile', 'ricochet', 'color_spray'],
  tricky:       ['tether', 'mirror_image', 'vortex_wall'],
  power:        ['meteor', 'gravity_sphere', 'lightning_bolt'],
};

export const BLINK_IDS = ['rush', 'extended_blink', 'swap'];

/** Global (non-spell) upgrades available in arena shop */
export const GLOBAL_UPGRADES = [
  { id: 'shop_hp', title: 'Fortify', desc: 'Max HP +15', price: 150, apply: (g) => { g.bonusHp += 15; } },
];

/** Create a fresh spell stats object (copy of base stats) */
export function createBaseSpellStats(spellId) {
  const def = SPELL_DEFS[spellId];
  if (!def) return null;
  return { ...def.baseStats };
}

/** Create a fresh blink stats object */
export function createBaseBlinkStats(blinkId) {
  const def = BLINK_DEFS[blinkId];
  if (!def) return null;
  return { ...def.baseStats };
}

/** Create a fresh global upgrades object */
export function createBaseGlobalUpgrades() {
  return { bonusHp: 0 };
}
