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
    baseCooldown: 3750,
    baseStats: {
      speed: 250, damage: 15, knockback: 700, radius: 8,
      multishot: 1, piercing: false, cooldownReduction: 0, lifesteal: 0, selfKnockback: 0,
    },
    tiers: {
      1: { title: 'Searing Flames', desc: 'Damage +5, Speed +20', price: 75,
           apply: (s) => { s.damage += 5; s.speed += 20; } },
      2: { title: 'Inferno', desc: 'Damage +5, KB +100, CD -200ms', price: 125,
           apply: (s) => { s.damage += 5; s.knockback += 100; s.cooldownReduction += 200; } },
      3: { title: 'Hellfire', desc: 'Damage +8, +1 Projectile, Piercing', price: 175,
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
    baseCooldown: 3300,
    baseStats: {
      speed: 200, damage: 12, knockback: 500, radius: 6,
      turnRate: 0.4, lifetime: 4000, cooldownReduction: 0,
    },
    tiers: {
      1: { title: 'Guided', desc: 'Turn +0.15, Damage +3', price: 75,
           apply: (s) => { s.turnRate += 0.15; s.damage += 3; } },
      2: { title: 'Heat Seeker', desc: 'Turn +0.15, Speed +30, Life +500ms', price: 125,
           apply: (s) => { s.turnRate += 0.15; s.speed += 30; s.lifetime += 500; } },
      3: { title: 'Predator', desc: 'Damage +5, KB +150, CD -300ms', price: 175,
           apply: (s) => { s.damage += 5; s.knockback += 150; s.cooldownReduction += 300; } },
    },
  },

  ricochet: {
    id: 'ricochet',
    name: 'Ricochet',
    desc: 'Bounces up to 10 times. Each bounce deals more damage.',
    category: 'bread_butter',
    color: 0x88ff44,
    shopPrice: 150,
    baseCooldown: 2500,
    baseStats: {
      speed: 300, damage: 8, knockback: 250, radius: 5,
      maxBounces: 10, bounceRange: 280, bounceDmgBonus: 0.15, cooldownReduction: 0,
    },
    tiers: {
      1: { title: 'Rebound', desc: 'Damage +3, Bounce dmg +10%, Range +40', price: 75,
           apply: (s) => { s.damage += 3; s.bounceDmgBonus += 0.1; s.bounceRange += 40; } },
      2: { title: 'Ping Pong', desc: 'Damage +3, Speed +40, KB +100', price: 125,
           apply: (s) => { s.damage += 3; s.speed += 40; s.knockback += 100; } },
      3: { title: 'Chain Reaction', desc: 'Damage +4, Bounce dmg +15%, KB +150', price: 175,
           apply: (s) => { s.damage += 4; s.bounceDmgBonus += 0.15; s.knockback += 150; } },
    },
  },

  color_spray: {
    id: 'color_spray',
    name: 'Color Spray',
    desc: 'Short-range cone burst of small projectiles.',
    category: 'bread_butter',
    color: 0xff44ff,
    shopPrice: 150,
    baseCooldown: 4200,
    baseStats: {
      speed: 300, damage: 4, knockback: 200, radius: 4,
      projectileCount: 5, coneAngle: 0.6, lifetime: 600, cooldownReduction: 0,
    },
    tiers: {
      1: { title: 'Prismatic', desc: '+2 Projectiles, KB +50', price: 75,
           apply: (s) => { s.projectileCount += 2; s.knockback += 50; } },
      2: { title: 'Dazzle', desc: '+2 Projectiles, Damage +2, Cone +0.2', price: 125,
           apply: (s) => { s.projectileCount += 2; s.damage += 2; s.coneAngle += 0.2; } },
      3: { title: 'Kaleidoscope', desc: '+2 Projectiles, Damage +2, CD -400ms', price: 175,
           apply: (s) => { s.projectileCount += 2; s.damage += 2; s.cooldownReduction += 400; } },
    },
  },

  // === SLOT 3: Tricky ===
  tether: {
    id: 'tether',
    name: 'Tether',
    desc: 'Beam that links you to an enemy, pulling and draining them.',
    category: 'tricky',
    color: 0xff8844,
    shopPrice: 200,
    baseCooldown: 7500,
    baseStats: {
      speed: 350, damage: 0, radius: 5,
      tetherDuration: 6000, pullForce: 900, tetherRange: 300, tetherDrain: 0.08, cooldownReduction: 0,
    },
    tiers: {
      1: { title: 'Bind', desc: 'Duration +2s, Pull +100, Drain +2%', price: 75,
           apply: (s) => { s.tetherDuration += 2000; s.pullForce += 100; s.tetherDrain += 0.02; } },
      2: { title: 'Iron Chain', desc: 'Duration +2s, Pull +100, Range +60', price: 125,
           apply: (s) => { s.tetherDuration += 2000; s.pullForce += 100; s.tetherRange += 60; } },
      3: { title: 'Tractor Beam', desc: 'Pull +150, Drain +4%, CD -1000ms', price: 175,
           apply: (s) => { s.pullForce += 150; s.tetherDrain += 0.04; s.cooldownReduction += 1000; } },
    },
  },

  mirror_image: {
    id: 'mirror_image',
    name: 'Mirror Image',
    desc: 'Decoy clone that fires your fireball. Knockback pulse on contact.',
    category: 'tricky',
    color: 0x88aaff,
    shopPrice: 200,
    baseCooldown: 8000,
    baseStats: {
      decoySpeed: 160, decoyDuration: 4000,
      knockbackPulse: 750, pulseRadius: 70, cooldownReduction: 0,
    },
    tiers: {
      1: { title: 'Double Take', desc: 'Duration +1.5s, KB +200', price: 75,
           apply: (s) => { s.decoyDuration += 1500; s.knockbackPulse += 200; } },
      2: { title: 'Phantasm', desc: 'Speed +50, Pulse +20, Duration +1s, CD -600ms', price: 125,
           apply: (s) => { s.decoySpeed += 50; s.pulseRadius += 20; s.decoyDuration += 1000; s.cooldownReduction += 600; } },
      3: { title: 'Doppelganger', desc: 'KB +250, Pulse +25, CD -800ms', price: 175,
           apply: (s) => { s.knockbackPulse += 250; s.pulseRadius += 25; s.cooldownReduction += 800; } },
    },
  },

  vortex_wall: {
    id: 'vortex_wall',
    name: 'Vortex Wall',
    desc: 'Energy wall that deflects enemy projectiles.',
    category: 'tricky',
    color: 0x44ffcc,
    shopPrice: 200,
    baseCooldown: 8000,
    baseStats: {
      wallDuration: 4000, wallLength: 90, wallThickness: 14, cooldownReduction: 0,
    },
    tiers: {
      1: { title: 'Barrier', desc: 'Duration +1s, Length +20, CD -500ms', price: 75,
           apply: (s) => { s.wallDuration += 1000; s.wallLength += 20; s.cooldownReduction += 500; } },
      2: { title: 'Deflector', desc: 'Duration +1.5s, Length +25, CD -800ms', price: 125,
           apply: (s) => { s.wallDuration += 1500; s.wallLength += 25; s.cooldownReduction += 800; } },
      3: { title: 'Aegis', desc: 'Duration +1.5s, Length +30, Thick +6, CD -700ms', price: 175,
           apply: (s) => { s.wallDuration += 1500; s.wallLength += 30; s.wallThickness += 6; s.cooldownReduction += 700; } },
    },
  },

  // === SLOT 4: Power ===
  meteor: {
    id: 'meteor',
    name: 'Meteor',
    desc: 'Slow AoE explosion on impact.',
    category: 'power',
    color: 0xcc2200,
    shopPrice: 250,
    baseCooldown: 6000,
    baseStats: {
      speed: 150, damage: 35, knockback: 2000, radius: 28,
      explosionRadius: 110, cooldownReduction: 0,
    },
    tiers: {
      1: { title: 'Infernal Impact', desc: 'Damage +8, Explosion +15', price: 75,
           apply: (s) => { s.damage += 8; s.explosionRadius += 15; } },
      2: { title: 'Widened Crater', desc: 'Explosion +20, KB +200, CD -400ms', price: 125,
           apply: (s) => { s.explosionRadius += 20; s.knockback += 200; s.cooldownReduction += 400; } },
      3: { title: 'Apocalypse', desc: 'Damage +12, Explosion +25, KB +300', price: 175,
           apply: (s) => { s.damage += 12; s.explosionRadius += 25; s.knockback += 300; } },
    },
  },

  gravity_sphere: {
    id: 'gravity_sphere',
    name: 'Gravity Sphere',
    desc: 'Slow-moving orb that pulls and drains enemies as it travels.',
    category: 'power',
    color: 0x9944ff,
    shopPrice: 250,
    baseCooldown: 7000,
    baseStats: {
      speed: 120, damage: 15, radius: 8,
      pullStrength: 400, pullRadius: 140, lifetime: 6000, cooldownReduction: 0,
    },
    tiers: {
      1: { title: 'Singularity', desc: 'Damage +5, Pull +30, Radius +15', price: 75,
           apply: (s) => { s.damage += 5; s.pullStrength += 30; s.pullRadius += 15; } },
      2: { title: 'Event Horizon', desc: 'Damage +5, Lifetime +2s, Pull +30, Radius +15', price: 125,
           apply: (s) => { s.damage += 5; s.lifetime += 2000; s.pullStrength += 30; s.pullRadius += 15; } },
      3: { title: 'Black Hole', desc: 'Damage +8, Lifetime +2s, Pull +40, CD -800ms', price: 175,
           apply: (s) => { s.damage += 8; s.lifetime += 2000; s.pullStrength += 40; s.cooldownReduction += 800; } },
    },
  },

  lightning_bolt: {
    id: 'lightning_bolt',
    name: 'Lightning Strike',
    desc: 'AoE bolt strikes a target area after a brief delay with massive knockback.',
    category: 'power',
    color: 0xffff44,
    shopPrice: 250,
    baseCooldown: 5000,
    baseStats: {
      damage: 15, knockback: 3600, strikeRadius: 70, strikeDelay: 650, cooldownReduction: 0,
    },
    tiers: {
      1: { title: 'Overload', desc: 'Damage +5, KB +200, Radius +10', price: 75,
           apply: (s) => { s.damage += 5; s.knockback += 200; s.strikeRadius += 10; } },
      2: { title: 'Surge', desc: 'Damage +5, KB +300, CD -500ms', price: 125,
           apply: (s) => { s.damage += 5; s.knockback += 300; s.cooldownReduction += 500; } },
      3: { title: 'Thunderstorm', desc: 'Damage +8, KB +400, Radius +15', price: 175,
           apply: (s) => { s.damage += 8; s.knockback += 400; s.strikeRadius += 15; } },
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
    baseCooldown: 6000,
    baseStats: { blinkDistance: 120, cooldownReduction: 0 },
    tiers: null,
  },

  rush: {
    id: 'rush',
    name: 'Rush',
    desc: 'Dash in a line, knocking back anyone in the path.',
    color: 0xff8844,
    shopPrice: 150,
    baseCooldown: 6750,
    baseStats: {
      dashDistance: 180, knockback: 500, hitRadius: 25, cooldownReduction: 0,
    },
    tiers: {
      1: { title: 'Charge', desc: 'Distance +30, KB +100', price: 75,
           apply: (s) => { s.dashDistance += 30; s.knockback += 100; } },
      2: { title: 'Stampede', desc: 'Distance +30, KB +150, CD -400ms', price: 125,
           apply: (s) => { s.dashDistance += 30; s.knockback += 150; s.cooldownReduction += 400; } },
      3: { title: 'Juggernaut', desc: 'Distance +40, KB +200, Width +10', price: 175,
           apply: (s) => { s.dashDistance += 40; s.knockback += 200; s.hitRadius += 10; } },
    },
  },

  extended_blink: {
    id: 'extended_blink',
    name: 'Extended Blink',
    desc: 'Longer range, shorter cooldown blink.',
    color: 0x88ccff,
    shopPrice: 150,
    baseCooldown: 4500,
    baseStats: { blinkDistance: 200, cooldownReduction: 0 },
    tiers: {
      1: { title: 'Far Step', desc: 'Distance +40, CD -400ms', price: 75,
           apply: (s) => { s.blinkDistance += 40; s.cooldownReduction += 400; } },
      2: { title: 'Phase Walk', desc: 'Distance +50, CD -400ms', price: 125,
           apply: (s) => { s.blinkDistance += 50; s.cooldownReduction += 400; } },
      3: { title: 'Dimensional', desc: 'Distance +60, CD -500ms', price: 175,
           apply: (s) => { s.blinkDistance += 60; s.cooldownReduction += 500; } },
    },
  },

  swap: {
    id: 'swap',
    name: 'Swap',
    desc: 'Fire a projectile that swaps your position with the target.',
    color: 0xcc44ff,
    shopPrice: 150,
    baseCooldown: 7000,
    baseStats: {
      projectileSpeed: 380, projectileRadius: 7, projectileLifetime: 2500, cooldownReduction: 0,
    },
    tiers: {
      1: { title: 'Quick Swap', desc: 'Speed +60, CD -600ms', price: 75,
           apply: (s) => { s.projectileSpeed += 60; s.cooldownReduction += 600; } },
      2: { title: 'Long Swap', desc: 'Speed +60, Life +500ms, CD -600ms', price: 125,
           apply: (s) => { s.projectileSpeed += 60; s.projectileLifetime += 500; s.cooldownReduction += 600; } },
      3: { title: 'Dimension Rift', desc: 'Speed +80, Life +500ms, CD -800ms', price: 175,
           apply: (s) => { s.projectileSpeed += 80; s.projectileLifetime += 500; s.cooldownReduction += 800; } },
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
  { id: 'shop_hp', title: 'Fortify', desc: 'Max HP +15', price: 75, apply: (g) => { g.bonusHp += 15; } },
  { id: 'shop_speed', title: 'Swift Feet', desc: 'Movement speed +12', price: 75, apply: (g) => { g.bonusSpeed = (g.bonusSpeed || 0) + 12; } },
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
