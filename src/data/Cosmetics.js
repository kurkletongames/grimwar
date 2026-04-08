/**
 * Predetermined cosmetic options for wizard customization.
 * All options are from this safe list — no arbitrary user input.
 */

export const HAT_STYLES = [
  { id: 'classic', name: 'Classic', desc: 'The standard wizard hat' },
  { id: 'crown', name: 'Crown', desc: 'A royal crown' },
  { id: 'horns', name: 'Horns', desc: 'Demonic horns' },
  { id: 'halo', name: 'Halo', desc: 'An angelic halo' },
  { id: 'tophat', name: 'Top Hat', desc: 'A dapper top hat' },
  { id: 'beanie', name: 'Beanie', desc: 'A cozy beanie' },
  { id: 'antenna', name: 'Antenna', desc: 'An alien antenna' },
  { id: 'mohawk', name: 'Mohawk', desc: 'A spiky mohawk' },
  { id: 'cat_ears', name: 'Cat Ears', desc: 'Cute cat ears' },
  { id: 'pirate', name: 'Pirate Hat', desc: 'Yarr!' },
  { id: 'chef', name: 'Chef Hat', desc: 'Tall and white' },
  { id: 'none', name: 'No Hat', desc: 'Bald wizard' },
];

export const TRAIL_STYLES = [
  { id: 'none', name: 'None', desc: 'No trail' },
  { id: 'fire', name: 'Fire Trail', desc: 'Fiery trail', color: 0xff4400 },
  { id: 'ice', name: 'Ice Trail', desc: 'Frosty trail', color: 0x88ddff },
  { id: 'shadow', name: 'Shadow Trail', desc: 'Dark afterimages', color: 0x333355 },
  { id: 'rainbow', name: 'Rainbow Trail', desc: 'Colorful rainbow' },
  { id: 'poison', name: 'Poison Trail', desc: 'Toxic green mist', color: 0x44ff22 },
  { id: 'electric', name: 'Electric Trail', desc: 'Sparking trail', color: 0xffff44 },
  { id: 'blood', name: 'Blood Trail', desc: 'Crimson trail', color: 0xcc0000 },
  { id: 'gold', name: 'Gold Trail', desc: 'Shimmering gold', color: 0xffd700 },
  { id: 'void', name: 'Void Trail', desc: 'Dark purple void', color: 0x6622cc },
];

export const EYE_STYLES = [
  { id: 'normal', name: 'Normal', desc: 'Standard eyes' },
  { id: 'angry', name: 'Angry', desc: 'Furrowed brow' },
  { id: 'cyclops', name: 'Cyclops', desc: 'One big eye' },
  { id: 'closed', name: 'Zen', desc: 'Eyes closed' },
  { id: 'glowing', name: 'Glowing', desc: 'Glowing eyes' },
  { id: 'x_eyes', name: 'X Eyes', desc: 'X marks the spot' },
  { id: 'hearts', name: 'Heart Eyes', desc: 'In love' },
  { id: 'tiny', name: 'Tiny', desc: 'Beady little eyes' },
  { id: 'wide', name: 'Wide', desc: 'Shocked expression' },
];

export const AURA_STYLES = [
  { id: 'none', name: 'None', desc: 'No aura' },
  { id: 'flame', name: 'Flame Aura', desc: 'Flickering flames around you', color: 0xff4400 },
  { id: 'frost', name: 'Frost Aura', desc: 'Icy mist surrounds you', color: 0x88ddff },
  { id: 'dark', name: 'Dark Aura', desc: 'Dark energy swirls', color: 0x442266 },
  { id: 'holy', name: 'Holy Aura', desc: 'Radiant golden glow', color: 0xffdd44 },
  { id: 'electric', name: 'Electric Aura', desc: 'Crackling electricity', color: 0xffff44 },
  { id: 'nature', name: 'Nature Aura', desc: 'Leaves swirl around you', color: 0x44aa22 },
];


export const MOUTH_STYLES = [
  { id: 'none', name: 'None', desc: 'No mouth visible' },
  { id: 'smile', name: 'Smile', desc: 'A friendly smile' },
  { id: 'grin', name: 'Grin', desc: 'A cheeky grin' },
  { id: 'frown', name: 'Frown', desc: 'Not happy' },
  { id: 'fangs', name: 'Fangs', desc: 'Vampire fangs' },
  { id: 'tongue', name: 'Tongue', desc: 'Sticking tongue out' },
  { id: 'mustache', name: 'Mustache', desc: 'Distinguished mustache' },
];

/** Default cosmetic loadout */
export function defaultCosmetics() {
  return { hat: 'classic', trail: 'none', eyes: 'normal', aura: 'none', mouth: 'none' };
}

/** Validate cosmetics object against preset lists — rejects anything not in the lists */
export function validateCosmetics(cosmetics) {
  const valid = defaultCosmetics();
  if (cosmetics && typeof cosmetics === 'object') {
    if (HAT_STYLES.find((h) => h.id === cosmetics.hat)) valid.hat = cosmetics.hat;
    if (TRAIL_STYLES.find((t) => t.id === cosmetics.trail)) valid.trail = cosmetics.trail;
    if (EYE_STYLES.find((e) => e.id === cosmetics.eyes)) valid.eyes = cosmetics.eyes;
    if (AURA_STYLES.find((a) => a.id === cosmetics.aura)) valid.aura = cosmetics.aura;
    if (MOUTH_STYLES.find((m) => m.id === cosmetics.mouth)) valid.mouth = cosmetics.mouth;
  }
  return valid;
}
