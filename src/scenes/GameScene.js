import Phaser from 'phaser';
import { network } from '../network/NetworkManager.js';
import { LobbyManager } from '../network/LobbyManager.js';
import { Arena, THEME_NAMES } from '../entities/Arena.js';
import { Wizard } from '../entities/Wizard.js';
import {
  Fireball,
  FIREBALL_COOLDOWN,
  BASE_FIREBALL_SPEED,
  BASE_FIREBALL_DAMAGE,
  BASE_FIREBALL_KNOCKBACK,
} from '../entities/Fireball.js';
import { LightningBolt } from '../entities/LightningBolt.js';
import { Meteor } from '../entities/Meteor.js';
import { GravitySphere } from '../entities/GravitySphere.js';
import { HomingMissile } from '../entities/HomingMissile.js';
import { Ricochet } from '../entities/Ricochet.js';
import { ColorSprayParticle } from '../entities/ColorSpray.js';
import { Tether } from '../entities/Tether.js';
import { MirrorImage } from '../entities/MirrorImage.js';
import { VortexWall } from '../entities/VortexWall.js';
import { SwapProjectile } from '../entities/SwapProjectile.js';
import { SPELL_DEFS, BLINK_DEFS, GLOBAL_UPGRADES, SPELL_CATEGORIES, SLOT_KEYS, SPELLS_BY_CATEGORY, BLINK_IDS, MAX_SPELL_SLOTS, MAX_TIER, createBaseSpellStats, createBaseBlinkStats, createBaseGlobalUpgrades } from '../data/SpellDefinitions.js';
import { GoldManager } from '../systems/GoldManager.js';
import { pickVoteOptions, tallyVotes, getModifier } from '../systems/RoundModifiers.js';
import { HazardManager } from '../systems/EnvironmentalHazards.js';

const TICK_RATE = 1000 / 30; // 30 ticks per second for smoother sync
const ROUND_END_DELAY = 2000; // ms before showing power-up screen
const DEFAULT_WINS_TO_WIN = 5;
const BLINK_DISTANCE = 120;
const BLINK_COOLDOWN = 12000; // ms

// Rarity: common (60%), rare (25%), epic (12%), legendary (3%)
const RARITY = {
  common:    { label: 'Common',    color: 0x888888, weight: 60 },
  rare:      { label: 'Rare',      color: 0x4fc3f7, weight: 25 },
  epic:      { label: 'Epic',      color: 0xab47bc, weight: 12 },
  legendary: { label: 'Legendary', color: 0xffa726, weight: 3 },
};

export const UPGRADES = [
  // ============ COMMON (60%) ============
  {
    id: 'damage_1', title: 'Searing Flames', desc: 'Fireball damage +5',
    rarity: 'common', apply: (u) => { u.damage += 5; },
  },
  {
    id: 'cooldown_1', title: 'Quick Hands', desc: 'Cooldown -300ms',
    rarity: 'common', apply: (u) => { u.cooldownReduction += 300; },
  },
  {
    id: 'hp_1', title: 'Tough Skin', desc: 'Max HP +15',
    rarity: 'common', apply: (u) => { u.bonusHp += 15; },
  },
  {
    id: 'blink_range_1', title: 'Long Step', desc: 'Blink distance +30',
    rarity: 'common', apply: (u) => { u.blinkDistance += 30; },
  },
  {
    id: 'radius_small', title: 'Wider Flames', desc: 'Fireball size +25%',
    rarity: 'common', apply: (u) => { u.radius = Math.round(u.radius * 1.25); },
  },

  // ============ RARE (25%) ============
  {
    id: 'multishot_1', title: 'Split Bolt', desc: '+1 additional fireball',
    rarity: 'rare', apply: (u) => { u.multishot += 1; },
  },
  {
    id: 'cooldown_2', title: 'Rapid Fire', desc: 'Cooldown -500ms',
    rarity: 'rare', apply: (u) => { u.cooldownReduction += 500; },
  },
  {
    id: 'lifesteal_1', title: 'Siphon', desc: 'Heal for 20% of damage dealt',
    rarity: 'rare', apply: (u) => { u.lifesteal += 0.2; },
  },
  {
    id: 'heavy_hitter', title: 'Heavy Hitter', desc: 'Damage +12, but fireball speed -60',
    rarity: 'rare', apply: (u) => { u.damage += 12; u.speed = Math.max(100, u.speed - 60); },
  },
  {
    id: 'adrenaline', title: 'Adrenaline', desc: 'Cooldown -600ms, but Max HP -15',
    rarity: 'rare', apply: (u) => { u.cooldownReduction += 600; u.bonusHp -= 15; },
  },
  {
    id: 'big_boi', title: 'Big Boi', desc: 'Fireball size x2, but speed -40',
    rarity: 'rare', apply: (u) => { u.radius *= 2; u.speed = Math.max(100, u.speed - 40); },
  },

  // ============ EPIC (12%) ============
  {
    id: 'blink_knockback', title: 'Aftershock', desc: 'Blink creates a knockback shockwave',
    rarity: 'epic', apply: (u) => { u.blinkKnockback += 900; },
  },
  {
    id: 'piercing', title: 'Piercing Flame', desc: 'Fireballs pass through all enemies',
    rarity: 'epic', apply: (u) => { u.piercing = true; },
  },
  {
    id: 'multishot_2', title: 'Tri-Shot', desc: '+2 additional fireballs',
    rarity: 'epic', apply: (u) => { u.multishot += 2; },
  },
  {
    id: 'paper_wizard', title: 'Paper Wizard', desc: 'Damage x2, but Max HP halved',
    rarity: 'epic', apply: (u) => { u.damage *= 2; u.bonusHp -= 50; },
  },
  {
    id: 'blood_magic', title: 'Blood Magic', desc: 'Cooldown -1000ms, but lose 8 HP per cast',
    rarity: 'epic', apply: (u) => { u.cooldownReduction += 1000; u.castHpCost = (u.castHpCost || 0) + 8; },
  },
  {
    id: 'unstable_core', title: 'Unstable Core', desc: 'Fireballs explode on hit (AoE), but self-knockback +200',
    rarity: 'epic', apply: (u) => { u.explosionOnHit = true; u.selfKnockback += 200; },
  },
  {
    id: 'sniper', title: 'Sniper', desc: 'Damage +20, Speed +100, but -1 projectile (min 1)',
    rarity: 'epic', apply: (u) => { u.damage += 20; u.speed += 100; u.multishot = Math.max(1, u.multishot - 1); },
  },
  {
    id: 'tank', title: 'Juggernaut', desc: 'Max HP +50, knockback resistance, but speed -30',
    rarity: 'epic', apply: (u) => { u.bonusHp += 50; u.knockbackResist = (u.knockbackResist || 0) + 0.4; u.speed = Math.max(100, u.speed - 30); },
  },
  {
    id: 'vampiric', title: 'Vampiric Pact', desc: 'Lifesteal +50%, but Max HP -20',
    rarity: 'epic', apply: (u) => { u.lifesteal += 0.5; u.bonusHp -= 20; },
  },

  // ============ LEGENDARY (3%) ============
  {
    id: 'multishot_3', title: 'Barrage', desc: '+3 fireballs in a wide spread',
    rarity: 'legendary', apply: (u) => { u.multishot += 3; },
  },
  {
    id: 'glass_cannon', title: 'Glass Cannon', desc: 'Damage +25, huge self-knockback when firing',
    rarity: 'legendary', apply: (u) => { u.damage += 25; u.selfKnockback += 300; },
  },
  {
    id: 'death_wish', title: 'Death Wish', desc: 'Damage x3, but Max HP set to 30',
    rarity: 'legendary', apply: (u) => { u.damage *= 3; u.bonusHp = -(100 - 30); },
  },
  {
    id: 'shotgun', title: 'Shotgun Blast', desc: '+5 projectiles, but range halved',
    rarity: 'legendary', apply: (u) => { u.multishot += 5; u.speed = Math.max(80, u.speed - 120); },
  },
  {
    id: 'meteor_strikes', title: 'Meteor Strikes', desc: 'All fireballs explode on hit with massive AoE',
    rarity: 'legendary', apply: (u) => { u.explosionOnHit = true; u.explosionRadius = (u.explosionRadius || 0) + 60; },
  },
  {
    id: 'ghostfire', title: 'Ghostfire', desc: 'Fireballs are invisible, piercing, but damage -5',
    rarity: 'legendary', apply: (u) => { u.invisible = true; u.piercing = true; u.damage = Math.max(3, u.damage - 5); },
  },
  {
    id: 'blink_assassin', title: 'Blink Assassin', desc: 'Blink cooldown halved, distance +80, huge shockwave',
    rarity: 'legendary', apply: (u) => { u.blinkCooldownMult = (u.blinkCooldownMult || 1) * 0.5; u.blinkDistance += 80; u.blinkKnockback += 1200; },
  },
  {
    id: 'berserker', title: 'Berserker', desc: 'The lower your HP, the faster you cast (up to 3x speed)',
    rarity: 'legendary', apply: (u) => { u.berserker = true; },
  },
  {
    id: 'mirror_shield', title: 'Mirror Shield', desc: 'Chance to reflect projectiles that hit you back at the attacker',
    rarity: 'legendary', apply: (u) => { u.reflectChance = (u.reflectChance || 0) + 0.3; },
  },
];

export class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  create() {
    this.arena = null;
    this.wizards = new Map();
    this.fireballs = [];
    this.gameStarted = false;
    this.roundOver = false;
    this.localPlayerId = '';
    this.lastTickTime = 0;
    this.lastFireballTime = 0;
    this.lastBlinkTime = 0;
    this.testMode = false;
    this.countdownActive = false;
    this._pendingTimers = [];
    this.botIds = [];
    this.botLastFireball = {};

    // Game mode: 'roguelike' or 'arena'
    this.gameMode = 'roguelike';
    this.draftRound = 0;
    this.draftTotal = 3; // number of draft picks in arena mode

    // Round & score tracking
    this.roundNumber = 0;
    this.scores = new Map(); // playerId -> round wins
    this.playerInfo = []; // saved from game start for respawning

    // Per-player cooldown timestamps (for visual indicators on all wizards)
    this.playerFireballTimes = new Map(); // playerId -> last cast time
    this.playerBlinkTimes = new Map(); // playerId -> last cast time
    this._blinkFxList = []; // track VFX graphics for cleanup
    this.winsToWin = DEFAULT_WINS_TO_WIN;

    // Per-player fireball upgrades (roguelike mode): { speed, damage, knockback }
    this.playerUpgrades = new Map();
    this.playerUpgradeHistory = new Map(); // playerId -> [upgradeId, ...]

    // Arena mode: per-player spell data
    this.playerSpellData = new Map(); // playerId -> { spells, activeSlot, spellUpgrades, globalUpgrades }
    this.goldManager = new GoldManager();
    this.spellCastTimes = new Map(); // 'playerId-spellId' -> last cast timestamp
    this.shopOpen = false;

    // Round modifiers (roguelike)
    this.activeModifier = null;
    this._modifierVotes = {};
    this._modifierOptions = [];

    // Kill/death tracking + bounty
    this.killStats = new Map(); // playerId -> { kills, deaths, streak }
    this.bountyTarget = null; // playerId of player with highest streak

    // Input — disable capture so HTML inputs (lobby name) still work
    this.keys = this.input.keyboard.addKeys({
      W: Phaser.Input.Keyboard.KeyCodes.W,
      A: Phaser.Input.Keyboard.KeyCodes.A,
      S: Phaser.Input.Keyboard.KeyCodes.S,
      D: Phaser.Input.Keyboard.KeyCodes.D,
      SPACE: Phaser.Input.Keyboard.KeyCodes.SPACE,
    }, false, false); // enableCapture=false — don't preventDefault on these keys

    this.input.on('pointerdown', (pointer) => {
      if (pointer.leftButtonDown()) {
        this._handleLeftClick(pointer);
      }
    });

    this.input.keyboard.on('keydown-SPACE', () => {
      this._handleBlink();
    });

    // Spell slot switching (arena mode, 1-4 keys)
    this.input.keyboard.on('keydown-ONE', () => this._switchSpell(0));
    this.input.keyboard.on('keydown-TWO', () => this._switchSpell(1));
    this.input.keyboard.on('keydown-THREE', () => this._switchSpell(2));
    this.input.keyboard.on('keydown-FOUR', () => this._switchSpell(3));

    // Secret sparkle (Shift+Q) — charges a giant cosmetic laser
    this._sparkleChargeStart = 0;
    this.input.keyboard.on('keydown-Q', (e) => {
      if (e.shiftKey) {
        const wizard = this.wizards.get(this.localPlayerId);
        if (!wizard) return;
        wizard.sparkle = !wizard.sparkle;
        if (wizard.sparkle) {
          this._sparkleChargeStart = Date.now();
        } else {
          this._sparkleChargeStart = 0;
        }
      }
    });

    this.game.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // Lobby
    this.lobby = new LobbyManager((data) => this._startGame(data));

    // Network
    network.onGameState = (data) => this._applyGameState(data);
    network.onPlayerInput = (peerId, data) => this._handleRemoteInput(peerId, data);
    network.onShowUpgrades = (data) => {
      if (data.winnerId === this.localPlayerId) {
        this.events.emit('winner-skip-upgrade');
      } else {
        this.events.emit('show-powerup-selection', {
          currentUpgrades: Object.fromEntries(this.playerUpgrades),
        });
      }
    };
    network.onUpgradeStatus = (data) => {
      this.events.emit('upgrade-waiting', {
        remaining: data.waiting.length,
        total: data.total,
      });
    };
    network.onStartRound = () => {
      this._startRound();
    };

    // Roguelike: sync other players' upgrades to this client
    network.onUpgradeApplied = (data) => {
      if (data.peerId && data.upgradeId) {
        // Skip if this is our own upgrade (already applied locally in _selectUpgrade)
        if (data.peerId === this.localPlayerId) return;
        this.applyUpgrade(data.peerId, data.upgradeId);
      }
    };

    // Modifier vote messages (roguelike, client side)
    network.onShowModifierVote = (data) => {
      this.events.emit('show-modifier-vote', data);
    };
    network.onModifierResult = (data) => {
      this.activeModifier = data.modifier;
      this.events.emit('modifier-result', data);
    };

    // Laser VFX from other players
    network.onLaser = (data) => {
      if (data && this._isFiniteNum(data.x) && this._isFiniteNum(data.y)) {
        this._drawLaser(data.x, data.y, data.nx, data.ny);
      }
    };

    // Shop messages (arena mode, client side)
    network.onShowShop = (data) => {
      this.shopOpen = true;
      if (data.gold) this.goldManager.applyState(data.gold);
      if (data.playerSpellData) this._applyAllSpellData(data.playerSpellData);
      this.events.emit('show-shop', data);
    };
    network.onShopClosed = () => {
      this.shopOpen = false;
      this.events.emit('shop-closed');
    };
    network.onShopUpdate = (data) => {
      if (data.gold) this.goldManager.applyState(data.gold);
      if (data.playerSpellData) this._applyAllSpellData(data.playerSpellData);
      this.events.emit('shop-update', data);
    };
    network.onShopReadyUpdate = (data) => {
      this.events.emit('shop-ready-update', data);
    };

    // Host: handle player reconnection
    network.onPlayerReconnected = (peerId, name) => {
      if (!network.isHost) return;
      // Send them the current game state immediately so they sync up
      this._broadcastGameState();
    };

    // Cleanup on scene shutdown
    this.events.on('shutdown', () => {
      this._cancelPendingTimers();
      network.onGameState = null;
      network.onPlayerInput = null;
      network.onShowUpgrades = null;
      network.onUpgradeStatus = null;
      network.onStartRound = null;
      network.onUpgradeApplied = null;
      network.onShowModifierVote = null;
      network.onModifierResult = null;
      network.onLaser = null;
      network.onShowShop = null;
      network.onShopClosed = null;
      network.onShopUpdate = null;
      network.onShopReadyUpdate = null;
      network.onPlayerReconnected = null;
    });
  }

  _startGame(data) {
    // Reconnecting client — just restore local ID, game state will sync via onGameState
    if (data.reconnect) {
      this.gameStarted = true;
      this.localPlayerId = network.localPlayerId;
      this.gameMode = data.gameMode || 'roguelike';
      this.playerInfo = data.players;

      // Init any missing player data structures (won't overwrite existing)
      data.players.forEach((p) => {
        if (!this.scores.has(p.peerId)) this.scores.set(p.peerId, 0);
        if (!this.playerUpgradeHistory.has(p.peerId)) this.playerUpgradeHistory.set(p.peerId, []);
        if (!this.playerUpgrades.has(p.peerId)) {
          this.playerUpgrades.set(p.peerId, {
            speed: BASE_FIREBALL_SPEED,
            damage: BASE_FIREBALL_DAMAGE,
            knockback: BASE_FIREBALL_KNOCKBACK,
            multishot: 1,
            piercing: false,
            cooldownReduction: 0,
            radius: 8,
            blinkKnockback: 0,
            blinkDistance: BLINK_DISTANCE,
            lifesteal: 0,
            bonusHp: 0,
            selfKnockback: 0,
          });
        }
      });

      // Arena mode: init missing spell data and gold for reconnecting player
      if (this.gameMode === 'arena') {
        data.players.forEach((p) => {
          if (!this.playerSpellData.has(p.peerId)) {
            this.playerSpellData.set(p.peerId, {
              slots: { fixed: 'fireball', bread_butter: null, tricky: null, power: null },
              activeSlot: 'fixed',
              spellUpgrades: { fireball: createBaseSpellStats('fireball') },
              spellTiers: { fireball: 0 },
              blinkId: 'default_blink',
              blinkStats: createBaseBlinkStats('default_blink'),
              blinkTier: 0,
              globalUpgrades: createBaseGlobalUpgrades(),
              purchasedUpgrades: [],
            });
          }
        });
        if (!this.goldManager.gold.has(this.localPlayerId)) {
          this.goldManager.gold.set(this.localPlayerId, 0);
        }
      }

      // Launch UIScene for the reconnected client
      this.scene.launch('UIScene');

      const emitReconnect = () => {
        this.events.emit('game-started', {
          players: data.players,
          scores: Object.fromEntries(this.scores),
          winsToWin: this.winsToWin,
          gameMode: this.gameMode,
        });
      };

      const uiScene = this.scene.get('UIScene');
      if (uiScene.scene.isActive()) {
        emitReconnect();
      } else {
        uiScene.events.once('create', emitReconnect);
      }
      return;
    }

    this.gameStarted = true;
    this.localPlayerId = network.localPlayerId;
    this.testMode = data.testMode || false;
    this.gameMode = data.gameMode || 'roguelike';
    this.playerInfo = data.players;
    this.botIds = [];
    this.botLastFireball = {};
    this.draftRound = 0;

    // Init scores, upgrades, and history
    const playerIds = data.players.map((p) => p.peerId);
    this.goldManager.init(playerIds);

    data.players.forEach((p) => {
      this.scores.set(p.peerId, 0);
      this.playerUpgradeHistory.set(p.peerId, []);
      this.playerUpgrades.set(p.peerId, {
        speed: BASE_FIREBALL_SPEED,
        damage: BASE_FIREBALL_DAMAGE,
        knockback: BASE_FIREBALL_KNOCKBACK,
        multishot: 1,
        piercing: false,
        cooldownReduction: 0,
        radius: 8,
        blinkKnockback: 0,
        blinkDistance: BLINK_DISTANCE,
        lifesteal: 0,
        bonusHp: 0,
        selfKnockback: 0,
        // New roguelike properties
        castHpCost: 0,
        explosionOnHit: false,
        explosionRadius: 0,
        knockbackResist: 0,
        invisible: false,
        blinkCooldownMult: 1,
        berserker: false,
        reflectChance: 0,
      });

      // Arena mode spell data (category-based slots)
      this.playerSpellData.set(p.peerId, {
        slots: { fixed: 'fireball', bread_butter: null, tricky: null, power: null },
        activeSlot: 'fixed',
        spellUpgrades: { fireball: createBaseSpellStats('fireball') },
        spellTiers: { fireball: 0 },
        blinkId: 'default_blink',
        blinkStats: createBaseBlinkStats('default_blink'),
        blinkTier: 0,
        globalUpgrades: createBaseGlobalUpgrades(),
        purchasedUpgrades: [],
      });

      if (p.peerId.startsWith('bot-')) {
        this.botIds.push(p.peerId);
        this.botLastFireball[p.peerId] = 0;
      }
    });

    this.winsToWin = DEFAULT_WINS_TO_WIN;

    // Init kill stats
    data.players.forEach((p) => {
      this.killStats.set(p.peerId, { kills: 0, deaths: 0, streak: 0 });
    });

    this.scene.launch('UIScene');

    const emitAndStart = () => {
      this.events.emit('game-started', {
        players: data.players,
        scores: Object.fromEntries(this.scores),
        winsToWin: this.winsToWin,
        gameMode: this.gameMode,
      });

      if (this.gameMode === 'arena') {
        // Arena mode: open shop before round 1 with starting gold
        this._startShopPhase(null);
      } else {
        this._startRound();
      }
    };

    // UIScene.create() is async on first launch — check if already active
    const uiScene = this.scene.get('UIScene');
    if (uiScene.scene.isActive()) {
      emitAndStart();
    } else {
      uiScene.events.once('create', emitAndStart);
    }
  }

  // ---- Arena Shop Phase ----

  _startShopPhase(winnerId) {
    this.shopOpen = true;
    this._shopReadyPlayers = new Set();
    this._shopStartTime = Date.now();
    this._shopDuration = 30000; // 30s

    // Award gold
    this.goldManager.awardRoundGold(winnerId);

    // Test mode: infinite gold for the human player
    if (this.testMode) {
      this.goldManager.gold.set(this.localPlayerId, 99999);
    }

    // Bots auto-buy in test mode (before emitting shop event to avoid double-render)
    if (this.testMode) {
      this._suppressShopBroadcast = true;
      for (const botId of this.botIds) {
        this._botShopBuy(botId);
        this._shopReadyPlayers.add(botId);
      }
      this._suppressShopBroadcast = false;
    }

    const shopData = {
      gold: this.goldManager.serialize(),
      playerSpellData: this._serializeAllSpellData(),
      shopDuration: this._shopDuration,
    };

    // Emit shop event locally
    this.events.emit('show-shop', shopData);

    // Tell clients to open shop
    if (!this.testMode) {
      network.broadcastToClients({ type: 'show-shop', ...shopData });
    }

    // 30s shop timer
    this._shopTimer = this.time.delayedCall(this._shopDuration, () => {
      this._closeShop();
    });
    this._pendingTimers.push(this._shopTimer);
  }

  _handleShopReady(peerId) {
    if (!this._shopReadyPlayers) return;
    this._shopReadyPlayers.add(peerId);

    // Broadcast ready status
    const humanCount = this.playerInfo.filter((p) => !p.peerId.startsWith('bot-')).length;
    const readyHumans = this.playerInfo.filter((p) => !p.peerId.startsWith('bot-') && this._shopReadyPlayers.has(p.peerId)).length;

    this.events.emit('shop-ready-update', { ready: readyHumans, total: humanCount });
    if (!this.testMode) {
      network.broadcastToClients({ type: 'shop-ready-update', ready: readyHumans, total: humanCount });
    }

    // Check if all human players are ready
    const allReady = this.playerInfo.every((p) =>
      p.peerId.startsWith('bot-') || this._shopReadyPlayers.has(p.peerId)
    );
    if (allReady) {
      this._closeShop();
    }
  }

  submitShopReady() {
    if (network.isHost) {
      this._handleShopReady(this.localPlayerId);
    } else {
      network.sendInput({ type: 'input', action: 'shop-ready' });
    }
  }

  _closeShop() {
    this.shopOpen = false;
    if (this._shopTimer) {
      this._shopTimer.remove(false);
      this._shopTimer = null;
    }

    this.events.emit('shop-closed');
    if (!this.testMode) {
      network.broadcastToClients({ type: 'shop-closed' });
    }

    // Start next round
    this._pendingTimers.push(
      this.time.delayedCall(500, () => {
        this._startRound();
        if (!this.testMode) {
          network.broadcastToClients({ type: 'game-start-round' });
        }
      })
    );
  }

  _handleShopBuySpell(peerId, spellId) {
    const def = SPELL_DEFS[spellId];
    if (!def) return;
    const data = this.playerSpellData.get(peerId);
    if (!data) return;
    const category = def.category;
    if (category === 'fixed') return;

    if (!this.goldManager.spend(peerId, def.shopPrice)) return;

    // Remove old spell data if replacing
    const oldSpell = data.slots[category];
    if (oldSpell) {
      delete data.spellUpgrades[oldSpell];
      delete data.spellTiers[oldSpell];
    }

    // Set new spell in category slot
    data.slots[category] = spellId;
    data.spellUpgrades[spellId] = createBaseSpellStats(spellId);
    data.spellTiers[spellId] = 0;

    this._broadcastShopState();
  }

  _handleShopBuyTier(peerId, spellId) {
    const data = this.playerSpellData.get(peerId);
    if (!data) return;

    const isBlink = !!BLINK_DEFS[spellId];
    const def = SPELL_DEFS[spellId] || BLINK_DEFS[spellId];
    if (!def || !def.tiers) return;

    const currentTier = isBlink ? data.blinkTier : (data.spellTiers[spellId] || 0);
    const nextTier = currentTier + 1;
    if (nextTier > MAX_TIER) return;

    const tierDef = def.tiers[nextTier];
    if (!tierDef) return;
    if (!this.goldManager.spend(peerId, tierDef.price)) return;

    if (isBlink) {
      tierDef.apply(data.blinkStats);
      data.blinkTier = nextTier;
    } else {
      tierDef.apply(data.spellUpgrades[spellId]);
      data.spellTiers[spellId] = nextTier;
    }

    data.purchasedUpgrades.push(`${spellId}_t${nextTier}`);
    this._broadcastShopState();
  }

  _handleShopBuyBlink(peerId, blinkId) {
    const def = BLINK_DEFS[blinkId];
    if (!def || blinkId === 'default_blink') return;
    const data = this.playerSpellData.get(peerId);
    if (!data) return;
    if (!this.goldManager.spend(peerId, def.shopPrice)) return;

    data.blinkId = blinkId;
    data.blinkStats = createBaseBlinkStats(blinkId);
    data.blinkTier = 0;

    this._broadcastShopState();
  }

  _handleShopBuyGlobal(peerId, upgradeId) {
    const data = this.playerSpellData.get(peerId);
    if (!data) return;
    const globalUpg = GLOBAL_UPGRADES.find((u) => u.id === upgradeId);
    if (!globalUpg) return;
    // Calculate scaled price based on previous purchases
    const timesBought = data.purchasedUpgrades.filter((id) => id === upgradeId).length;
    const actualPrice = globalUpg.price + (globalUpg.priceIncrease || 0) * timesBought;
    if (!this.goldManager.spend(peerId, actualPrice)) return;
    globalUpg.apply(data.globalUpgrades);
    data.purchasedUpgrades.push(upgradeId);
    this._broadcastShopState();
  }

  // Host processes local shop purchases
  submitShopBuySpell(spellId) {
    this._handleShopBuySpell(this.localPlayerId, spellId);
  }

  submitShopBuyTier(spellId) {
    this._handleShopBuyTier(this.localPlayerId, spellId);
  }

  submitShopBuyBlink(blinkId) {
    this._handleShopBuyBlink(this.localPlayerId, blinkId);
  }

  submitShopBuyGlobal(upgradeId) {
    this._handleShopBuyGlobal(this.localPlayerId, upgradeId);
  }

  // Send shop purchase to host (client)
  sendShopBuySpell(spellId) {
    network.sendInput({ type: 'input', action: 'shop-buy-spell', spellId });
  }

  sendShopBuyTier(spellId) {
    network.sendInput({ type: 'input', action: 'shop-buy-tier', spellId });
  }

  sendShopBuyBlink(blinkId) {
    network.sendInput({ type: 'input', action: 'shop-buy-blink', blinkId });
  }

  sendShopBuyGlobal(upgradeId) {
    network.sendInput({ type: 'input', action: 'shop-buy-global', upgradeId });
  }

  _broadcastShopState() {
    if (this._suppressShopBroadcast) return;
    const state = {
      type: 'shop-update',
      gold: this.goldManager.serialize(),
      playerSpellData: this._serializeAllSpellData(),
    };
    if (!this.testMode) {
      network.broadcastToClients(state);
    }
    this.events.emit('shop-update', state);
  }

  _serializeAllSpellData() {
    const result = {};
    this.playerSpellData.forEach((data, pid) => {
      result[pid] = {
        slots: { ...data.slots },
        activeSlot: data.activeSlot,
        spellUpgrades: JSON.parse(JSON.stringify(data.spellUpgrades)),
        spellTiers: { ...data.spellTiers },
        blinkId: data.blinkId,
        blinkStats: { ...data.blinkStats },
        blinkTier: data.blinkTier,
        globalUpgrades: { ...data.globalUpgrades },
        purchasedUpgrades: [...data.purchasedUpgrades],
      };
    });
    return result;
  }

  _applyAllSpellData(data) {
    for (const [pid, d] of Object.entries(data)) {
      this.playerSpellData.set(pid, {
        slots: { ...d.slots },
        activeSlot: d.activeSlot,
        spellUpgrades: JSON.parse(JSON.stringify(d.spellUpgrades)),
        spellTiers: { ...(d.spellTiers || {}) },
        blinkId: d.blinkId || 'default_blink',
        blinkStats: d.blinkStats ? { ...d.blinkStats } : createBaseBlinkStats(d.blinkId || 'default_blink'),
        blinkTier: d.blinkTier || 0,
        globalUpgrades: { ...d.globalUpgrades },
        purchasedUpgrades: [...(d.purchasedUpgrades || [])],
      });
    }
  }

  getPlayerSpellData() {
    return this._serializeAllSpellData();
  }

  getGold() {
    return this.goldManager.serialize();
  }

  // ---- Round Modifier Voting (roguelike) ----

  _startModifierVote() {
    this._modifierOptions = pickVoteOptions(3);
    this._modifierVotes = {};
    this._modifierVoteResolved = false;

    const voteData = {
      options: this._modifierOptions.map((m) => ({ id: m.id, name: m.name, desc: m.desc, color: m.color, icon: m.icon })),
    };

    this.events.emit('show-modifier-vote', voteData);
    if (!this.testMode) {
      network.broadcastToClients({ type: 'show-modifier-vote', ...voteData });
    }

    // Auto-resolve after 10s no matter what
    this._modifierVoteTimeout = setTimeout(() => {
      this._resolveModifierVote();
    }, 10000);
  }

  _handleModifierVote(peerId, modifierId) {
    if (this._modifierVoteResolved) return;
    if (!this._modifierOptions.find((m) => m.id === modifierId)) return;
    this._modifierVotes[peerId] = modifierId;

    // In test mode, resolve immediately when the human votes (bots don't need to vote)
    if (this.testMode) {
      this._resolveModifierVote();
      return;
    }

    // In multiplayer, check if all humans voted
    const allVoted = this.playerInfo.every((p) =>
      p.peerId.startsWith('bot-') || this._modifierVotes[p.peerId]
    );
    if (allVoted) this._resolveModifierVote();
  }

  submitModifierVote(modifierId) {
    if (network.isHost) {
      this._handleModifierVote(this.localPlayerId, modifierId);
    } else {
      network.sendInput({ type: 'input', action: 'modifier-vote', modifierId });
    }
  }

  _resolveModifierVote() {
    if (this._modifierVoteResolved) return; // prevent double-resolve
    this._modifierVoteResolved = true;

    if (this._modifierVoteTimeout) {
      clearTimeout(this._modifierVoteTimeout);
      this._modifierVoteTimeout = null;
    }

    // If no votes, default to 'none'
    const winnerId = Object.keys(this._modifierVotes).length > 0
      ? tallyVotes(this._modifierVotes) : 'none';
    this.activeModifier = getModifier(winnerId);

    this.events.emit('modifier-result', { modifier: this.activeModifier });
    if (!this.testMode) {
      network.broadcastToClients({ type: 'modifier-result', modifier: {
        id: this.activeModifier.id, name: this.activeModifier.name,
        desc: this.activeModifier.desc, color: this.activeModifier.color, icon: this.activeModifier.icon,
      }});
    }

    // Brief pause to show result, then start round
    setTimeout(() => {
      this._startRound();
      if (!this.testMode) {
        network.broadcastToClients({ type: 'game-start-round' });
      }
    }, 1500);
  }

  _cancelPendingTimers() {
    if (this._pendingTimers) {
      this._pendingTimers.forEach((t) => t.remove(false));
    }
    this._pendingTimers = [];
  }

  _startRound() {
    console.log('[GrimWar] _startRound called, round:', this.roundNumber + 1);
    try {
    this._cancelPendingTimers();
    this.roundNumber++;
    this.roundOver = false;
    this.roundScoreAwarded = false;
    this.countdownActive = true;
    this.lastFireballTime = 0;
    this.lastBlinkTime = 0;

    // Reset per-player cooldown tracking
    this.playerFireballTimes.clear();
    this.playerBlinkTimes.clear();
    this.spellCastTimes.clear();
    this.shopOpen = false;
    this.botIds.forEach((botId) => { this.botLastFireball[botId] = 0; });

    // Kill all active tweens and destroy lingering VFX graphics
    this.tweens.killAll();
    if (this._blinkFxList) {
      this._blinkFxList.forEach((g) => { try { if (g && g.active) g.destroy(); } catch (e) {} });
    }
    this._blinkFxList = [];

    // Clean up old entities
    this.fireballs.forEach((fb) => fb.destroy());
    this.fireballs = [];
    this.wizards.forEach((w) => w.destroy());
    this.wizards.clear();

    // Create/reset arena
    const cx = this.cameras.main.width / 2;
    const cy = this.cameras.main.height / 2;
    if (this.arena) this.arena.destroy();
    this.arena = new Arena(this, cx, cy);
    // Deterministic theme based on round number (same on host + all clients)
    // Roguelike: cycle themes each round. Arena: always standard.
    if (this.gameMode === 'arena') {
      this.arena.setTheme('standard');
    } else {
      this.arena.setTheme(THEME_NAMES[(this.roundNumber - 1) % THEME_NAMES.length]);
    }
    this.arena.startRound();

    // Environmental hazards (roguelike only — host spawns, all render)
    if (this.hazardManager) this.hazardManager.destroy();
    this.hazardManager = null;
    if (this.gameMode === 'roguelike') {
      this.hazardManager = new HazardManager(this);
      if (!network.isHost) {
        // Clients don't spawn hazards, only render from synced state
        this.hazardManager.nextSpawnTime = Infinity;
      }
    }

    // Spawn wizards
    const spawnRadius = 300;
    this.playerInfo.forEach((player, index) => {
      const angle = (index / this.playerInfo.length) * Math.PI * 2 - Math.PI / 2;
      const x = cx + Math.cos(angle) * spawnRadius;
      const y = cy + Math.sin(angle) * spawnRadius;
      const wizard = new Wizard(this, x, y, player.peerId, player.name, index, player.cosmetics);
      let bonusHp = 0;
      if (this.gameMode === 'arena') {
        const spellData = this.playerSpellData.get(player.peerId);
        bonusHp = spellData ? spellData.globalUpgrades.bonusHp || 0 : 0;
      } else {
        const upgrades = this.playerUpgrades.get(player.peerId);
        bonusHp = upgrades ? upgrades.bonusHp || 0 : 0;
      }
      if (bonusHp !== 0) {
        wizard.maxHealth = Math.max(20, wizard.maxHealth + bonusHp);
        wizard.health = wizard.maxHealth;
      }
      // Apply arena speed bonus
      if (this.gameMode === 'arena') {
        const spellData = this.playerSpellData.get(player.peerId);
        const bonusSpeed = spellData ? spellData.globalUpgrades.bonusSpeed || 0 : 0;
        if (bonusSpeed > 0) wizard.bonusSpeed = bonusSpeed;
      }
      // Apply roguelike knockback resistance
      if (this.gameMode !== 'arena') {
        const upgrades = this.playerUpgrades.get(player.peerId);
        if (upgrades && upgrades.knockbackResist) {
          wizard.knockbackResist = upgrades.knockbackResist;
        }
      }
      this.wizards.set(player.peerId, wizard);
    });

    // Apply active round modifier
    const mod = this.activeModifier;
    if (mod && mod.id !== 'none' && this.gameMode === 'roguelike') {
      // Glass Round: override HP
      if (mod.maxHpOverride) {
        this.wizards.forEach((w) => {
          w.maxHealth = mod.maxHpOverride;
          w.health = w.maxHealth;
        });
      }
      // Big Head Mode: double wizard radius
      if (mod.wizardRadiusMult) {
        this.wizards.forEach((w) => { w.radius *= mod.wizardRadiusMult; });
      }
      // Speed Demon: boost wizard speed
      if (mod.speedMult) {
        this.wizards.forEach((w) => { w.bonusSpeed += 85 * (mod.speedMult - 1); });
      }
      // Low Gravity / Mirror Match: store on wizards
      if (mod.knockbackMult) {
        this.wizards.forEach((w) => { w._modKnockbackMult = mod.knockbackMult; });
      }
      if (mod.frictionOverride) {
        this.wizards.forEach((w) => { w._modFrictionOverride = mod.frictionOverride; });
      }
      if (mod.reverseKnockback) {
        this.wizards.forEach((w) => { w._modReverseKB = true; });
      }
      // Sudden Death: modify arena
      if (mod.shrinkDelay !== undefined) {
        this.arena.shrinkDelay = mod.shrinkDelay;
      }
      if (mod.shrinkRateMult) {
        this.arena.shrinkRate *= mod.shrinkRateMult;
      }
    }

    this.events.emit('round-start', this.roundNumber);

    // 3-second countdown
    this.events.emit('countdown', 3);
    this._pendingTimers.push(
      this.time.delayedCall(1000, () => this.events.emit('countdown', 2)),
      this.time.delayedCall(2000, () => this.events.emit('countdown', 1)),
      this.time.delayedCall(3000, () => {
        this.countdownActive = false;
        this.events.emit('countdown', 0);
      }),
    );
    console.log('[GrimWar] _startRound complete, arena:', !!this.arena, 'wizards:', this.wizards.size);
    } catch (e) {
      console.error('[GrimWar] _startRound CRASHED:', e);
    }
  }

  _getFireballCooldown(playerId) {
    const upgrades = this.playerUpgrades.get(playerId);
    const reduction = upgrades ? upgrades.cooldownReduction : 0;
    let cd = Math.max(500, FIREBALL_COOLDOWN - reduction);

    // Berserker: cast faster at low HP (up to 3x at 0 HP)
    if (upgrades && upgrades.berserker) {
      const wizard = this.wizards.get(playerId);
      if (wizard && wizard.alive) {
        const hpPct = wizard.health / wizard.maxHealth;
        const speedMult = 1 + (1 - hpPct) * 2; // 1x at full, 3x at 0
        cd = Math.max(300, cd / speedMult);
      }
    }

    // Speed Demon modifier: halve cooldowns
    if (this.activeModifier && this.activeModifier.cooldownMult) {
      cd = Math.max(250, cd * this.activeModifier.cooldownMult);
    }

    return cd;
  }

  // ---- Arena mode spell helpers ----

  _getActiveSpellId(playerId) {
    const data = this.playerSpellData.get(playerId);
    if (!data) return 'fireball';
    return data.slots[data.activeSlot] || 'fireball';
  }

  _getSpellCooldown(playerId, spellId) {
    if (this.gameMode !== 'arena') {
      return this._getFireballCooldown(playerId);
    }
    const data = this.playerSpellData.get(playerId);
    if (!data) return 2500;
    const spellStats = data.spellUpgrades[spellId];
    const def = SPELL_DEFS[spellId];
    if (!def) return 2500;
    const reduction = spellStats ? spellStats.cooldownReduction || 0 : 0;
    return Math.max(400, def.baseCooldown - reduction);
  }

  _getBlinkCooldown(playerId) {
    if (this.gameMode !== 'arena') {
      const upgrades = this.playerUpgrades.get(playerId);
      const mult = upgrades ? upgrades.blinkCooldownMult || 1 : 1;
      return Math.max(2000, BLINK_COOLDOWN * mult);
    }
    const data = this.playerSpellData.get(playerId);
    if (!data) return 4000;
    const def = BLINK_DEFS[data.blinkId] || BLINK_DEFS.default_blink;
    const reduction = data.blinkStats ? data.blinkStats.cooldownReduction || 0 : 0;
    return Math.max(800, def.baseCooldown - reduction);
  }

  _getSpellCastTimeKey(playerId, spellId) {
    return `${playerId}-${spellId}`;
  }

  _switchSpell(slotIndex) {
    if (this.gameMode !== 'arena') return;
    const category = SLOT_KEYS[slotIndex];
    if (!category) return;
    const data = this.playerSpellData.get(this.localPlayerId);
    if (!data || !data.slots[category]) return; // no spell in that slot
    data.activeSlot = category;
    this.events.emit('spell-switched', {
      activeSlot: category,
      spellId: data.slots[category],
      slots: data.slots,
    });
  }

  _getStatsForSpell(playerId, spellId) {
    if (this.gameMode !== 'arena') {
      return this.playerUpgrades.get(playerId) || {};
    }
    const data = this.playerSpellData.get(playerId);
    if (!data || !data.spellUpgrades[spellId]) {
      return createBaseSpellStats(spellId) || {};
    }
    return data.spellUpgrades[spellId];
  }

  _spawnProjectile(playerId, spellId, x, y, dirX, dirY) {
    const stats = this._getStatsForSpell(playerId, spellId);

    // Color Spray: spawns multiple particles in a cone (special case)
    if (spellId === 'color_spray') {
      const count = stats.projectileCount || 5;
      const cone = stats.coneAngle || 0.6;
      const baseAngle = Math.atan2(dirY, dirX);
      for (let i = 0; i < count; i++) {
        const offset = count === 1 ? 0 : -cone / 2 + (cone / (count - 1)) * i;
        const angle = baseAngle + offset;
        this.fireballs.push(new ColorSprayParticle(this, x, y, Math.cos(angle), Math.sin(angle), playerId, stats));
      }
      const castKey = this._getSpellCastTimeKey(playerId, spellId);
      this.spellCastTimes.set(castKey, Date.now());
      this.playerFireballTimes.set(playerId, Date.now());
      return;
    }

    // Vortex Wall: placed in front of caster (special case)
    if (spellId === 'vortex_wall') {
      const len = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
      const nx = dirX / len;
      const ny = dirY / len;
      const placeX = x + nx * 60;
      const placeY = y + ny * 60;
      this.fireballs.push(new VortexWall(this, placeX, placeY, nx, ny, playerId, stats));
      const castKey = this._getSpellCastTimeKey(playerId, spellId);
      this.spellCastTimes.set(castKey, Date.now());
      this.playerFireballTimes.set(playerId, Date.now());
      return;
    }

    // Mirror Image: spawns a decoy (special case)
    if (spellId === 'mirror_image') {
      // Pass caster color index
      const playerIdx = this.playerInfo.findIndex((p) => p.peerId === playerId);
      const enrichedStats = { ...stats, _colorIndex: playerIdx >= 0 ? playerIdx : 0 };
      this.fireballs.push(new MirrorImage(this, x, y, dirX, dirY, playerId, enrichedStats));
      const castKey = this._getSpellCastTimeKey(playerId, spellId);
      this.spellCastTimes.set(castKey, Date.now());
      this.playerFireballTimes.set(playerId, Date.now());
      return;
    }

    const count = stats.multishot || 1;

    const spawnOne = (fdx, fdy) => {
      switch (spellId) {
        case 'lightning_bolt':
          return new LightningBolt(this, x, y, fdx, fdy, playerId, stats);
        case 'meteor':
          return new Meteor(this, x, y, fdx, fdy, playerId, stats);
        case 'gravity_sphere':
          return new GravitySphere(this, x, y, fdx, fdy, playerId, stats);
        case 'homing_missile':
          return new HomingMissile(this, x, y, fdx, fdy, playerId, stats);
        case 'ricochet':
          return new Ricochet(this, x, y, fdx, fdy, playerId, stats);
        case 'tether':
          return new Tether(this, x, y, fdx, fdy, playerId, stats);
        case 'swap_projectile':
          return new SwapProjectile(this, x, y, fdx, fdy, playerId, stats);
        case 'fireball':
        default:
          return new Fireball(this, x, y, fdx, fdy, playerId, stats);
      }
    };

    if (count <= 1) {
      this.fireballs.push(spawnOne(dirX, dirY));
    } else {
      const baseAngle = Math.atan2(dirY, dirX);
      const spreadAngle = Math.PI / 6;
      for (let i = 0; i < count; i++) {
        const offset = -spreadAngle / 2 + (spreadAngle / (count - 1)) * i;
        const angle = baseAngle + offset;
        this.fireballs.push(spawnOne(Math.cos(angle), Math.sin(angle)));
      }
    }

    const castKey = this._getSpellCastTimeKey(playerId, spellId);
    this.spellCastTimes.set(castKey, Date.now());
    this.playerFireballTimes.set(playerId, Date.now());

    // Self-knockback (Glass Cannon in roguelike, or if stats have it)
    if (stats.selfKnockback > 0) {
      const wizard = this.wizards.get(playerId);
      if (wizard) {
        const len = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
        wizard.applyKnockback(
          -(dirX / len) * stats.selfKnockback,
          -(dirY / len) * stats.selfKnockback,
        );
      }
    }

    // Mirror Image: also fire from clone toward cursor position
    if (this.gameMode === 'arena' && spellId === 'fireball') {
      // Compute cursor world position from wizard pos + direction
      const cursorX = x + dirX;
      const cursorY = y + dirY;
      for (const fb of this.fireballs) {
        if (fb.spellId === 'mirror_image' && fb.ownerPlayerId === playerId && fb.alive) {
          // Direction from clone to cursor
          const cloneDirX = cursorX - fb.x;
          const cloneDirY = cursorY - fb.y;
          const cloneFireball = new Fireball(this, fb.x, fb.y, cloneDirX, cloneDirY, playerId, stats);
          this.fireballs.push(cloneFireball);
          break;
        }
      }
    }
  }

  _handleLeftClick(pointer) {
    if (!this.gameStarted || this.roundOver || this.countdownActive) return;
    if (this.shopOpen) return;

    const now = Date.now();
    const spellId = this.gameMode === 'arena'
      ? this._getActiveSpellId(this.localPlayerId)
      : 'fireball';
    const cd = this._getSpellCooldown(this.localPlayerId, spellId);
    const castKey = this._getSpellCastTimeKey(this.localPlayerId, spellId);
    const lastCast = this.spellCastTimes.get(castKey) || 0;
    if (now - lastCast < cd) return;

    const wizard = this.wizards.get(this.localPlayerId);
    if (!wizard || !wizard.alive) return;

    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const dirX = worldPoint.x - wizard.x;
    const dirY = worldPoint.y - wizard.y;

    if (network.isHost) {
      if (this.gameMode === 'arena') {
        this._spawnProjectile(this.localPlayerId, spellId, wizard.x, wizard.y, dirX, dirY);
      } else {
        this._spawnFireball(this.localPlayerId, wizard.x, wizard.y, dirX, dirY);
      }
    } else {
      network.sendInput({ type: 'input', action: 'cast', spellId, dirX, dirY });
    }

    // Update all cooldown trackers
    this.spellCastTimes.set(castKey, now);
    this.lastFireballTime = now;
    this.events.emit('fireball-cast', now);
  }

  _spawnFireball(playerId, x, y, dirX, dirY) {
    const stats = this.playerUpgrades.get(playerId) || {};
    const count = stats.multishot || 1;

    if (count <= 1) {
      const fireball = new Fireball(this, x, y, dirX, dirY, playerId, stats);
      this.fireballs.push(fireball);
    } else {
      // Spread projectiles evenly across a 30-degree arc
      const baseAngle = Math.atan2(dirY, dirX);
      const spreadAngle = (Math.PI / 6); // 30 degrees total
      for (let i = 0; i < count; i++) {
        const offset = count === 1 ? 0 : -spreadAngle / 2 + (spreadAngle / (count - 1)) * i;
        const angle = baseAngle + offset;
        const fdx = Math.cos(angle);
        const fdy = Math.sin(angle);
        const fireball = new Fireball(this, x, y, fdx, fdy, playerId, stats);
        this.fireballs.push(fireball);
      }
    }
    this.playerFireballTimes.set(playerId, Date.now());

    // Big Head Mode: double projectile radius
    if (this.activeModifier && this.activeModifier.projectileRadiusMult) {
      const mult = this.activeModifier.projectileRadiusMult;
      this.fireballs.forEach((fb) => {
        if (fb.ownerPlayerId === playerId && fb.radius) {
          fb.radius *= mult;
        }
      });
    }

    // Self-knockback (Glass Cannon)
    if (stats.selfKnockback > 0) {
      const wizard = this.wizards.get(playerId);
      if (wizard && wizard.alive) {
        const len = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
        wizard.applyKnockback((-dirX / len) * stats.selfKnockback, (-dirY / len) * stats.selfKnockback);
      }
    }

    // Blood Magic: HP cost per cast
    if (stats.castHpCost > 0) {
      const wizard = this.wizards.get(playerId);
      if (wizard && wizard.alive) {
        wizard.health = Math.max(1, wizard.health - stats.castHpCost);
      }
    }
  }

  _handleBlink() {
    if (!this.gameStarted || this.roundOver || this.countdownActive) return;

    const now = Date.now();
    const blinkCd = this._getBlinkCooldown(this.localPlayerId);
    if (now - this.lastBlinkTime < blinkCd) return;

    const wizard = this.wizards.get(this.localPlayerId);
    if (!wizard || !wizard.alive) return;

    // Blink toward cursor
    const pointer = this.input.activePointer;
    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const targetX = worldPoint.x;
    const targetY = worldPoint.y;

    // Compute direction from local position for local feedback
    const dirX = targetX - wizard.x;
    const dirY = targetY - wizard.y;

    if (network.isHost) {
      this._executeBlink(this.localPlayerId, dirX, dirY);
    } else {
      // Execute blink locally for immediate visual feedback
      this._executeLocalBlink(wizard, dirX, dirY);
      // Send target position so host computes direction from authoritative position
      network.sendInput({ type: 'input', action: 'blink', targetX, targetY });
    }
    this.lastBlinkTime = now;
    this.events.emit('blink-cast', now);
  }

  _executeBlink(playerId, dirX, dirY) {
    const wizard = this.wizards.get(playerId);
    if (!wizard || !wizard.alive) return;

    // Arena mode: dispatch to variant
    if (this.gameMode === 'arena') {
      const spellData = this.playerSpellData.get(playerId);
      const blinkId = spellData ? spellData.blinkId : 'default_blink';
      const bStats = spellData ? spellData.blinkStats : {};

      switch (blinkId) {
        case 'rush':
          this._executeRush(playerId, dirX, dirY, bStats);
          return;
        case 'swap':
          this._executeSwap(playerId, dirX, dirY, bStats);
          return;
        case 'extended_blink':
          this._executeDefaultBlink(wizard, dirX, dirY, bStats.blinkDistance || 180, 0);
          return;
        default:
          this._executeDefaultBlink(wizard, dirX, dirY, bStats.blinkDistance || BLINK_DISTANCE, 0);
          return;
      }
    }

    // Roguelike mode: standard blink
    const upgrades = this.playerUpgrades.get(playerId) || {};
    const blinkDist = upgrades.blinkDistance || BLINK_DISTANCE;
    const blinkKB = upgrades.blinkKnockback || 0;
    this._executeDefaultBlink(wizard, dirX, dirY, blinkDist, blinkKB);
  }

  _executeDefaultBlink(wizard, dirX, dirY, blinkDist, blinkKB) {
    const playerId = wizard.playerId;
    const len = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
    const nx = dirX / len;
    const ny = dirY / len;

    const oldX = wizard.x;
    const oldY = wizard.y;

    wizard.x += nx * blinkDist;
    wizard.y += ny * blinkDist;

    this.arena.constrainToWall(wizard);
    this.playerBlinkTimes.set(playerId, Date.now());

    // Blink knockback shockwave — pushes from BOTH origin AND destination
    if (blinkKB > 0) {
      const shockwaveRange = 140;
      const shockPoints = [{ x: oldX, y: oldY }, { x: wizard.x, y: wizard.y }];
      const hitByShockwave = new Set();

      shockPoints.forEach((pt) => {
        this.wizards.forEach((other) => {
          if (other.playerId === playerId || !other.alive || hitByShockwave.has(other.playerId)) return;
          const dx = other.x - pt.x;
          const dy = other.y - pt.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          if (dist < shockwaveRange) {
            hitByShockwave.add(other.playerId);
            const force = blinkKB * (1 - dist / shockwaveRange);
            other.applyKnockback((dx / dist) * force, (dy / dist) * force);
          }
        });

        // VFX at each point
        const shockwave = this.add.graphics();
        this._blinkFxList.push(shockwave);
        shockwave.lineStyle(3, 0x4fc3f7, 0.7);
        shockwave.strokeCircle(pt.x, pt.y, 10);
        this.tweens.add({
          targets: shockwave,
          scaleX: 5, scaleY: 5, alpha: 0, duration: 400,
          onComplete: () => { shockwave.destroy(); this._blinkFxList = this._blinkFxList.filter((g) => g !== shockwave); },
        });
      });
    }

    // Afterimage
    const fx = this.add.graphics();
    this._blinkFxList.push(fx);
    fx.fillStyle(0x4fc3f7, 0.5);
    fx.fillCircle(oldX, oldY, wizard.radius);
    this.tweens.add({
      targets: fx, alpha: 0, duration: 300,
      onComplete: () => { fx.destroy(); this._blinkFxList = this._blinkFxList.filter((g) => g !== fx); },
    });

    wizard.draw();
  }

  _executeRush(playerId, dirX, dirY, blinkStats) {
    const wizard = this.wizards.get(playerId);
    if (!wizard || !wizard.alive) return;

    const len = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
    const nx = dirX / len;
    const ny = dirY / len;
    const dashDist = blinkStats.dashDistance || 180;
    const dashSpeed = 450; // pixels/sec — slow enough to react to

    // Start the animated dash
    wizard.dashing = true;
    wizard.dashDir = { x: nx, y: ny };
    wizard.dashSpeed = dashSpeed;
    wizard.dashRemaining = dashDist;
    wizard._rushOwnerId = playerId;
    wizard._rushKnockback = blinkStats.knockback || 500;
    wizard._rushHitRadius = blinkStats.hitRadius || 25;
    wizard._rushHitPlayers = new Set();

    this.playerBlinkTimes.set(playerId, Date.now());
  }

  _executeSwap(playerId, dirX, dirY, blinkStats) {
    // Swap fires a projectile — spawn it into the fireballs array
    const wizard = this.wizards.get(playerId);
    if (!wizard || !wizard.alive) return;

    const proj = new SwapProjectile(this, wizard.x, wizard.y, dirX, dirY, playerId, blinkStats);
    this.fireballs.push(proj);
    this.playerBlinkTimes.set(playerId, Date.now());
  }

  _executeLocalBlink(wizard, dirX, dirY) {
    let blinkDist = BLINK_DISTANCE;

    // Arena: handle variant-specific local prediction
    if (this.gameMode === 'arena') {
      const spellData = this.playerSpellData.get(wizard.playerId);
      const blinkId = spellData ? spellData.blinkId : 'default_blink';
      const bStats = spellData ? spellData.blinkStats : {};

      if (blinkId === 'rush') {
        const len = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
        wizard.dashing = true;
        wizard.dashDir = { x: dirX / len, y: dirY / len };
        wizard.dashSpeed = 450;
        wizard.dashRemaining = bStats.dashDistance || 180;
        wizard._rushHitPlayers = new Set();
        return;
      }

      if (blinkId === 'swap') {
        return;
      }

      blinkDist = bStats.blinkDistance || BLINK_DISTANCE;
    } else {
      const upgrades = this.playerUpgrades.get(wizard.playerId) || {};
      blinkDist = upgrades.blinkDistance || BLINK_DISTANCE;
    }

    const len = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
    const nx = dirX / len;
    const ny = dirY / len;

    const oldX = wizard.x;
    const oldY = wizard.y;

    wizard.x += nx * blinkDist;
    wizard.y += ny * blinkDist;

    this.arena.constrainToWall(wizard);

    // Afterimage (tracked for cleanup)
    const fx = this.add.graphics();
    this._blinkFxList.push(fx);
    fx.fillStyle(0x4fc3f7, 0.5);
    fx.fillCircle(oldX, oldY, wizard.radius);
    this.tweens.add({
      targets: fx,
      alpha: 0,
      duration: 300,
      onComplete: () => { fx.destroy(); this._blinkFxList = this._blinkFxList.filter((g) => g !== fx); },
    });

    wizard.draw();
  }

  _isFiniteNum(v) {
    return typeof v === 'number' && isFinite(v);
  }

  _handleRemoteInput(peerId, data) {
    if (!network.isHost) return;
    if (!data || typeof data.action !== 'string') return;

    // Rate limiting
    if (!this._rateLimits) this._rateLimits = new Map();
    const rateKey = `${peerId}-${data.action}`;
    const now = Date.now();
    const lastTime = this._rateLimits.get(rateKey) || 0;
    const limits = { 'move-dir': 16, 'fireball': 200, 'cast': 200, 'blink': 500 };
    const minInterval = limits[data.action] || 100;
    if (now - lastTime < minInterval) return;
    this._rateLimits.set(rateKey, now);

    // Upgrade selection — handle before wizard alive check
    if (data.action === 'upgrade') {
      if (typeof data.upgradeId === 'string') {
        this._receiveUpgradeChoice(peerId, data.upgradeId);
      }
      return;
    }

    // Shop purchases (arena mode) — also before wizard check
    if (data.action === 'shop-buy-spell') {
      if (typeof data.spellId === 'string') this._handleShopBuySpell(peerId, data.spellId);
      return;
    }
    if (data.action === 'shop-buy-tier') {
      if (typeof data.spellId === 'string') this._handleShopBuyTier(peerId, data.spellId);
      return;
    }
    if (data.action === 'shop-buy-blink') {
      if (typeof data.blinkId === 'string') this._handleShopBuyBlink(peerId, data.blinkId);
      return;
    }
    if (data.action === 'shop-buy-global') {
      if (typeof data.upgradeId === 'string') this._handleShopBuyGlobal(peerId, data.upgradeId);
      return;
    }
    if (data.action === 'shop-ready') {
      this._handleShopReady(peerId);
      return;
    }
    if (data.action === 'modifier-vote') {
      if (typeof data.modifierId === 'string') this._handleModifierVote(peerId, data.modifierId);
      return;
    }

    const wizard = this.wizards.get(peerId);
    if (!wizard || !wizard.alive) return;

    switch (data.action) {
      case 'move-dir':
        if (!this._isFiniteNum(data.x) || !this._isFiniteNum(data.y)) return;
        // Clamp to [-1, 1]
        wizard.setInput(Math.max(-1, Math.min(1, data.x)), Math.max(-1, Math.min(1, data.y)));
        break;
      case 'fireball': {
        if (!this._isFiniteNum(data.dirX) || !this._isFiniteNum(data.dirY)) return;
        // Enforce cooldown on host
        const fbCd = this._getFireballCooldown(peerId);
        const lastFb = this.playerFireballTimes.get(peerId) || 0;
        if (now - lastFb < fbCd) return;
        this._spawnFireball(peerId, wizard.x, wizard.y, data.dirX, data.dirY);
        break;
      }
      case 'cast': {
        if (!this._isFiniteNum(data.dirX) || !this._isFiniteNum(data.dirY)) return;
        const spellId = data.spellId || 'fireball';
        // Validate spell ownership in arena mode
        if (this.gameMode === 'arena') {
          const sd = this.playerSpellData.get(peerId);
          if (sd) {
            const owned = Object.values(sd.slots).filter(Boolean);
            if (spellId !== 'fireball' && !owned.includes(spellId)) return;
          }
          // Enforce cooldown on host
          const castCd = this._getSpellCooldown(peerId, spellId);
          const castKey = this._getSpellCastTimeKey(peerId, spellId);
          const lastCast = this.spellCastTimes.get(castKey) || 0;
          if (now - lastCast < castCd) return;
          this._spawnProjectile(peerId, spellId, wizard.x, wizard.y, data.dirX, data.dirY);
        } else {
          const cd = this._getFireballCooldown(peerId);
          const last = this.playerFireballTimes.get(peerId) || 0;
          if (now - last < cd) return;
          this._spawnFireball(peerId, wizard.x, wizard.y, data.dirX, data.dirY);
        }
        break;
      }
      case 'blink': {
        if (!this._isFiniteNum(data.targetX) || !this._isFiniteNum(data.targetY)) return;
        // Enforce blink cooldown on host
        const blinkCd = this._getBlinkCooldown(peerId);
        const lastBlink = this.playerBlinkTimes.get(peerId) || 0;
        if (now - lastBlink < blinkCd) return;
        const blinkDirX = data.targetX - wizard.x;
        const blinkDirY = data.targetY - wizard.y;
        this._executeBlink(peerId, blinkDirX, blinkDirY);
        break;
      }
      case 'laser': {
        // Client fired a cosmetic laser — draw it on host and forward to all clients
        if (this._isFiniteNum(data.x) && this._isFiniteNum(data.y) && this._isFiniteNum(data.nx) && this._isFiniteNum(data.ny)) {
          this._drawLaser(data.x, data.y, data.nx, data.ny);
          network.broadcastToClients({ type: 'laser', x: data.x, y: data.y, nx: data.nx, ny: data.ny });
        }
        break;
      }
    }
  }

  update(time, delta) {
    if (!this.gameStarted || this.roundOver || this.countdownActive || !this.arena) return;

    // Cap delta to prevent huge jumps
    delta = Math.min(delta, 50);

    this._processLocalInput();

    if (network.isHost) {
      this._hostUpdate(delta);
      if (time - this.lastTickTime > TICK_RATE) {
        this._broadcastGameState();
        this.lastTickTime = time;
      }
    } else {
      this._clientUpdate(delta);
    }

    // Secret sparkle laser — fires after 3s of charging
    const localWiz = this.wizards.get(this.localPlayerId);
    if (localWiz && localWiz.sparkle && this._sparkleChargeStart > 0 && !this._sparkleLaserFired) {
      const chargeTime = Date.now() - this._sparkleChargeStart;
      if (chargeTime >= 3000) {
        this._sparkleLaserFired = true;
        const pointer = this.input.activePointer;
        const worldPt = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
        const dx = worldPt.x - localWiz.x;
        const dy = worldPt.y - localWiz.y;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;

        this._drawLaser(localWiz.x, localWiz.y, dx / len, dy / len);

        // Broadcast to all other players
        if (network.isHost && !this.testMode) {
          network.broadcastToClients({ type: 'laser', x: localWiz.x, y: localWiz.y, nx: dx / len, ny: dy / len });
        } else if (!network.isHost) {
          // Client sends to host, host forwards to others
          network.sendInput({ type: 'input', action: 'laser', x: localWiz.x, y: localWiz.y, nx: dx / len, ny: dy / len });
        }

        // Reset sparkle after laser
        setTimeout(() => {
          this._sparkleLaserFired = false;
          const wiz = this.wizards.get(this.localPlayerId);
          if (wiz) wiz.sparkle = false;
          this._sparkleChargeStart = 0;
        }, 1500);
      }
    }
    if (localWiz && !localWiz.sparkle) {
      this._sparkleLaserFired = false;
    }

    this.arena.draw();
  }

  _processLocalInput() {
    const dirX = (this.keys.D.isDown ? 1 : 0) - (this.keys.A.isDown ? 1 : 0);
    const dirY = (this.keys.S.isDown ? 1 : 0) - (this.keys.W.isDown ? 1 : 0);

    if (network.isHost) {
      const wizard = this.wizards.get(this.localPlayerId);
      if (wizard && wizard.alive) wizard.setInput(dirX, dirY);
    } else {
      network.sendInput({ type: 'input', action: 'move-dir', x: dirX, y: dirY });
    }
  }

  _clientUpdate(delta) {
    // Run local simulation so things move smoothly between host state updates
    this.wizards.forEach((wizard) => {
      wizard.update(delta);
    });

    // Clean up dead projectiles on client side
    this.fireballs = this.fireballs.filter((fb) => {
      if (!fb.alive) { fb.destroy(); return false; }
      return true;
    });

    // Move fireballs locally using their velocity (no trail/lifetime — host handles that)
    const dt = delta / 1000;
    this.fireballs.forEach((fb) => {
      fb.x += fb.velX * dt;
      fb.y += fb.velY * dt;

      // Client-side tether beam position update
      if (fb.spellId === 'tether' && fb.phase === 'tethered' && fb.targetPlayerId) {
        const caster = this.wizards.get(fb.ownerPlayerId);
        const target = this.wizards.get(fb.targetPlayerId);
        if (caster && target && fb.setCasterTarget) {
          fb.setCasterTarget({ x: caster.x, y: caster.y }, { x: target.x, y: target.y });
        }
      }

      fb.draw();
    });

    // Update cooldown visuals for local wizard
    const localWizard = this.wizards.get(this.localPlayerId);
    if (localWizard && localWizard.alive) {
      const now = Date.now();
      const fbElapsed = now - this.lastFireballTime;
      const localCd = this._getFireballCooldown(this.localPlayerId);
      const fbPct = this.lastFireballTime === 0 ? 0 : Math.max(0, 1 - fbElapsed / localCd);
      const localBlinkCd = this._getBlinkCooldown(this.localPlayerId);
      const blinkElapsed = now - this.lastBlinkTime;
      const blinkPct = this.lastBlinkTime === 0 ? 0 : Math.max(0, 1 - blinkElapsed / localBlinkCd);
      const blinkReady = this.lastBlinkTime === 0 || blinkElapsed >= localBlinkCd;
      localWizard.setCooldowns(fbPct, blinkReady, blinkPct);
    }

    this.arena.update(delta);
  }

  _botShopBuy(botId) {
    const data = this.playerSpellData.get(botId);
    if (!data) return;
    const gold = this.goldManager.getGold(botId);

    // Try to fill empty category slots
    for (const cat of ['bread_butter', 'tricky', 'power']) {
      if (!data.slots[cat]) {
        const options = SPELLS_BY_CATEGORY[cat];
        const affordable = options.filter((id) => SPELL_DEFS[id].shopPrice <= gold);
        if (affordable.length > 0) {
          const pick = affordable[Math.floor(Math.random() * affordable.length)];
          this._handleShopBuySpell(botId, pick);
          return;
        }
      }
    }

    // Try to buy a tier upgrade for an owned spell
    const owned = Object.values(data.slots).filter(Boolean);
    const upgradeable = owned.filter((sid) => {
      const def = SPELL_DEFS[sid];
      if (!def || !def.tiers) return false;
      const tier = data.spellTiers[sid] || 0;
      if (tier >= MAX_TIER) return false;
      const nextTier = def.tiers[tier + 1];
      return nextTier && nextTier.price <= this.goldManager.getGold(botId);
    });
    if (upgradeable.length > 0) {
      const pick = upgradeable[Math.floor(Math.random() * upgradeable.length)];
      this._handleShopBuyTier(botId, pick);
    }
  }

  _updateBots() {
    const now = Date.now();
    for (const botId of this.botIds) {
      const bot = this.wizards.get(botId);
      if (!bot || !bot.alive) continue;

      let nearest = null;
      let nearestDist = Infinity;
      this.wizards.forEach((w) => {
        if (w.playerId === botId || !w.alive) return;
        const dx = w.x - bot.x;
        const dy = w.y - bot.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < nearestDist) { nearestDist = dist; nearest = w; }
      });

      if (!nearest) continue;

      const dx = nearest.x - bot.x;
      const dy = nearest.y - bot.y;

      if (this.arena.isOnLava(bot.x, bot.y)) {
        const tcx = this.arena.centerX - bot.x;
        const tcy = this.arena.centerY - bot.y;
        const len = Math.sqrt(tcx * tcx + tcy * tcy) || 1;
        bot.setInput(tcx / len, tcy / len);
      } else if (nearestDist > 180) {
        const len = nearestDist || 1;
        bot.setInput(dx / len, dy / len);
      } else if (nearestDist < 70) {
        const len = nearestDist || 1;
        bot.setInput(-dx / len, -dy / len);
      } else {
        // Mid range: mix strafe with periodic approach/retreat to break circling
        const len = nearestDist || 1;
        const strafeDir = ((botId.charCodeAt(4) || 0) % 2 === 0) ? 1 : -1; // consistent per bot
        const phase = Math.sin(now * 0.002 + (botId.charCodeAt(4) || 0)); // oscillate over ~3s
        const strafeFactor = 0.5 + phase * 0.3;
        const approachFactor = phase * 0.6; // positive = approach, negative = retreat
        const mx = (dx / len) * approachFactor + (-dy / len) * strafeFactor * strafeDir;
        const my = (dy / len) * approachFactor + (dx / len) * strafeFactor * strafeDir;
        const mLen = Math.sqrt(mx * mx + my * my) || 1;
        bot.setInput(mx / mLen, my / mLen);
      }

      if (this.gameMode === 'arena') {
        const spellId = this._getActiveSpellId(botId);
        const cd = this._getSpellCooldown(botId, spellId);
        const castKey = this._getSpellCastTimeKey(botId, spellId);
        const lastCast = this.spellCastTimes.get(castKey) || 0;
        if (now - lastCast > cd + 200 + Math.random() * 800) {
          this._spawnProjectile(botId, spellId, bot.x, bot.y, dx, dy);
        }
      } else {
        if (now - (this.botLastFireball[botId] || 0) > FIREBALL_COOLDOWN + 200 + Math.random() * 800) {
          this._spawnFireball(botId, bot.x, bot.y, dx, dy);
          this.botLastFireball[botId] = now;
        }
      }
    }
  }

  _drawLaser(x, y, nx, ny) {
    const laser = this.add.graphics();
    laser.setDepth(15);
    const beamLen = 2000;
    const beamWidth = 60;
    const colors = [0xff0000, 0xff8800, 0xffff00, 0x00ff00, 0x0088ff, 0x8800ff, 0xff00ff];

    for (let c = 0; c < colors.length; c++) {
      const offset = (c - 3) * (beamWidth / colors.length);
      const perpX = -ny * offset;
      const perpY = nx * offset;
      laser.lineStyle(beamWidth / colors.length + 2, colors[c], 0.7);
      laser.beginPath();
      laser.moveTo(x + perpX, y + perpY);
      laser.lineTo(x + perpX + nx * beamLen, y + perpY + ny * beamLen);
      laser.strokePath();
    }
    laser.lineStyle(8, 0xffffff, 0.9);
    laser.beginPath();
    laser.moveTo(x, y);
    laser.lineTo(x + nx * beamLen, y + ny * beamLen);
    laser.strokePath();

    this.tweens.add({
      targets: laser, alpha: 0, duration: 1500,
      onComplete: () => laser.destroy(),
    });
  }

  _onWizardKill(killerId, victim) {
    if (!killerId || !victim) return;
    // Prevent double-counting the same death in one frame
    if (this._killedThisFrame && this._killedThisFrame.has(victim.playerId)) return;
    if (this._killedThisFrame) this._killedThisFrame.add(victim.playerId);

    // Gold (arena only)
    if (this.gameMode === 'arena') {
      this.goldManager.awardKillGold(killerId);
    }

    // Track kills/deaths
    const killerStats = this.killStats.get(killerId);
    const victimStats = this.killStats.get(victim.playerId);
    if (killerStats) { killerStats.kills++; killerStats.streak++; }
    if (victimStats) { victimStats.deaths++; victimStats.streak = 0; }

    // Bounty: killing the bounty target gives bonus gold
    if (this.gameMode === 'arena' && this.bountyTarget === victim.playerId) {
      this.goldManager.gold.set(killerId, (this.goldManager.getGold(killerId) || 0) + 100);
      this.bountyTarget = null;
    }

    // Update bounty target (highest streak >= 3)
    let maxStreak = 2;
    let newBounty = null;
    this.killStats.forEach((stats, pid) => {
      if (stats.streak > maxStreak) { maxStreak = stats.streak; newBounty = pid; }
    });
    this.bountyTarget = newBounty;

    // Death burst VFX (using tweens for auto-cleanup)
    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2;
      const dist = 40 + Math.random() * 50;
      const particle = this.add.graphics();
      const size = 3 + Math.random() * 3;
      particle.fillStyle(victim.color, 0.9);
      particle.fillCircle(victim.x, victim.y, size);
      this.tweens.add({
        targets: particle,
        x: Math.cos(angle) * dist,
        y: Math.sin(angle) * dist,
        alpha: 0,
        scaleX: 0.3,
        scaleY: 0.3,
        duration: 400 + Math.random() * 200,
        onComplete: () => particle.destroy(),
      });
    }

    // Emit kill event for UI
    const killerName = this.playerInfo.find((p) => p.peerId === killerId)?.name || 'Unknown';
    const victimName = victim.playerName;
    this.events.emit('player-kill', { killerName, victimName, killerId, victimId: victim.playerId });
  }

  _checkWizardCollisions() {
    const wizardList = Array.from(this.wizards.values()).filter((w) => w.alive);
    for (let i = 0; i < wizardList.length; i++) {
      for (let j = i + 1; j < wizardList.length; j++) {
        const a = wizardList[i];
        const b = wizardList[j];

        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const minDist = a.radius + b.radius;

        if (dist >= minDist) continue;

        // Separate overlapping wizards
        const overlap = minDist - dist;
        const nx = dx / dist;
        const ny = dy / dist;
        a.x -= nx * overlap * 0.5;
        a.y -= ny * overlap * 0.5;
        b.x += nx * overlap * 0.5;
        b.y += ny * overlap * 0.5;

        // Transfer knockback: if one wizard is being knocked back, push the other
        const aSpeed = Math.sqrt(a.knockbackVel.x ** 2 + a.knockbackVel.y ** 2);
        const bSpeed = Math.sqrt(b.knockbackVel.x ** 2 + b.knockbackVel.y ** 2);
        const transferRatio = 0.7;

        if (aSpeed > 50) {
          // A is moving fast, push B along collision normal
          const push = aSpeed * transferRatio;
          b.knockbackVel.x += nx * push;
          b.knockbackVel.y += ny * push;
          // Dampen A
          a.knockbackVel.x *= 0.4;
          a.knockbackVel.y *= 0.4;
        }

        if (bSpeed > 50) {
          // B is moving fast, push A along collision normal
          const push = bSpeed * transferRatio;
          a.knockbackVel.x -= nx * push;
          a.knockbackVel.y -= ny * push;
          // Dampen B
          b.knockbackVel.x *= 0.4;
          b.knockbackVel.y *= 0.4;
        }
      }
    }
  }

  _hostUpdate(delta) {
    if (this.testMode) this._updateBots();
    if (!this.arena) return;
    this._killedThisFrame = new Set(); // prevent double kill credit

    this.arena.update(delta);

    // Environmental hazards
    if (this.hazardManager) {
      this.hazardManager.update(delta, this.wizards, this.arena);
    }

    const now = Date.now();
    this.wizards.forEach((wizard) => {
      wizard.update(delta);
      if (wizard.alive) this.arena.constrainToWall(wizard);

      // Rush dash collision detection (while dashing)
      if (wizard.dashing && wizard.alive) {
        const rushKb = wizard._rushKnockback || 500;
        const rushHitR = wizard._rushHitRadius || 25;
        const rushHit = wizard._rushHitPlayers || new Set();

        this.wizards.forEach((other) => {
          if (other.playerId === wizard.playerId || !other.alive || rushHit.has(other.playerId)) return;
          const dx = other.x - wizard.x;
          const dy = other.y - wizard.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < rushHitR + other.radius) {
            rushHit.add(other.playerId);
            const pushLen = dist > 0 ? dist : 1;
            other.applyKnockback((dx / pushLen) * rushKb, (dy / pushLen) * rushKb);
          }
        });

        // Afterimage every few frames
        if (!wizard._rushTrailTime || Date.now() - wizard._rushTrailTime > 50) {
          wizard._rushTrailTime = Date.now();
          const fx = this.add.graphics();
          this._blinkFxList.push(fx);
          fx.fillStyle(0xff8844, 0.25);
          fx.fillCircle(wizard.x, wizard.y, wizard.radius);
          this.tweens.add({
            targets: fx, alpha: 0, duration: 250,
            onComplete: () => { fx.destroy(); this._blinkFxList = this._blinkFxList.filter((g) => g !== fx); },
          });
        }
      }

      // Update cooldown visuals for all wizards
      let fbPct, ringColor;
      if (this.gameMode === 'arena') {
        const activeSpell = this._getActiveSpellId(wizard.playerId);
        const castKey = this._getSpellCastTimeKey(wizard.playerId, activeSpell);
        const lastCast = this.spellCastTimes.get(castKey) || 0;
        const spellCd = this._getSpellCooldown(wizard.playerId, activeSpell);
        const elapsed = now - lastCast;
        fbPct = lastCast === 0 ? 0 : Math.max(0, 1 - elapsed / spellCd);
        ringColor = SPELL_DEFS[activeSpell]?.color || 0xff6600;
      } else {
        const lastFb = this.playerFireballTimes.get(wizard.playerId) || 0;
        const fbElapsed = now - lastFb;
        const playerCd = this._getFireballCooldown(wizard.playerId);
        fbPct = lastFb === 0 ? 0 : Math.max(0, 1 - fbElapsed / playerCd);
        ringColor = 0xff6600;
      }

      const lastBlink = this.playerBlinkTimes.get(wizard.playerId) || 0;
      const blinkElapsed = now - lastBlink;
      const blinkCdForPlayer = this._getBlinkCooldown(wizard.playerId);
      const blinkPct = lastBlink === 0 ? 0 : Math.max(0, 1 - blinkElapsed / blinkCdForPlayer);
      const blinkReady = lastBlink === 0 || blinkElapsed >= blinkCdForPlayer;

      wizard.cooldownRingColor = ringColor;
      wizard.setCooldowns(fbPct, blinkReady, blinkPct);
    });

    // Wizard-to-wizard collision (knockback transfer)
    this._checkWizardCollisions();

    // Vortex Wall deflection pass (before normal collisions)
    const vortexWalls = this.fireballs.filter((fb) => fb.spellId === 'vortex_wall' && fb.alive);
    if (vortexWalls.length > 0) {
      this.fireballs.forEach((fb) => {
        if (!fb.alive || fb.spellId === 'vortex_wall' || fb.spellId === 'mirror_image' || fb.spellId === 'lightning_bolt') return;
        for (const wall of vortexWalls) {
          if (wall.checkDeflect(fb)) break;
        }
      });
    }

    this.fireballs.forEach((fb) => {
      fb.update(delta);

      // HomingMissile: set targets each frame
      if (fb.spellId === 'homing_missile' && fb.alive && fb.setTargets) {
        fb.setTargets(this.wizards);
      }

      // GravitySphere: apply pull while traveling
      if (fb.spellId === 'gravity_sphere' && fb.alive) {
        fb.applyPull(this.wizards, delta);
      }

      // Lightning Strike: apply AoE damage when strike phase begins
      if (fb.spellId === 'lightning_bolt' && fb.phase === 'strike' && fb.struck && fb.alive) {
        fb.struck = false; // only apply once
        const hits = fb.applyStrikeDamage(this.wizards);
        hits.forEach(({ wizard: w, dealt: d }) => {
          if (d > 0) {
            w.lastHitBy = fb.ownerPlayerId;
            if (fb.lifesteal > 0) {
              const owner = this.wizards.get(fb.ownerPlayerId);
              if (owner && owner.alive) {
                owner.health = Math.min(owner.maxHealth, owner.health + d * fb.lifesteal);
              }
            }
          }
        });
      }

      // Meteor: landing impact AoE when it first lands
      if (fb.spellId === 'meteor' && fb._landingImpact) {
        fb._landingImpact = false;
        const landingHits = fb.applyExplosionDamage(this.wizards);
        // Reset hitTargets so the rolling meteor can hit them again on final explosion
        fb.hitTargets.clear();
        landingHits.forEach(({ wizard: w, dealt: d }) => {
          if (d > 0) w.lastHitBy = fb.ownerPlayerId;
        });
      }

      // Tether: apply pull during tethered phase
      if (fb.spellId === 'tether' && fb.phase === 'tethered') {
        const caster = this.wizards.get(fb.ownerPlayerId);
        const target = this.wizards.get(fb.targetPlayerId);
        if (fb.alive && caster && target && caster.alive && target.alive) {
          fb.applyTetherPull(caster, target, delta);
        } else {
          fb.alive = false;
          // Release tethered target
          if (target) target.tethered = false;
        }
      }

      // Mirror Image: check if pending pulse on expiry
      if (fb.spellId === 'mirror_image' && fb._pendingPulse && !fb.alive) {
        fb.applyPulse(this.wizards);
        fb._pendingPulse = false;
      }

      this.wizards.forEach((wizard) => {
        // Mirror Shield: chance to reflect projectile before hit check
        if (fb.alive && wizard.alive && wizard.playerId !== fb.ownerPlayerId && fb.spellId === 'fireball') {
          const wizUpg = this.playerUpgrades.get(wizard.playerId);
          if (wizUpg && wizUpg.reflectChance > 0) {
            const dx = fb.x - wizard.x;
            const dy = fb.y - wizard.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < (fb.radius || 8) * 2 + wizard.radius && Math.random() < wizUpg.reflectChance) {
              fb.velX = -fb.velX;
              fb.velY = -fb.velY;
              fb.ownerPlayerId = wizard.playerId;
              fb.hitTargets?.clear();
              return; // forEach return — skips this wizard's checkHit
            }
          }
        }

        const wasAlive = wizard.alive;
        const dealt = fb.checkHit(wizard);
        if (dealt === -1 && fb.spellId === 'meteor') {
          const hits = fb.applyExplosionDamage(this.wizards);
          hits.forEach(({ wizard: w, dealt: d }) => {
            if (d > 0) {
              w.lastHitBy = fb.ownerPlayerId;
              if (fb.lifesteal > 0) {
                const owner = this.wizards.get(fb.ownerPlayerId);
                if (owner && owner.alive) {
                  owner.health = Math.min(owner.maxHealth, owner.health + d * fb.lifesteal);
                }
              }
              // Each explosion victim tracked independently (not using wasAlive from trigger wizard)
              if (!w.alive) {
                this._onWizardKill(fb.ownerPlayerId, w);
              }
            }
          });
        } else if (dealt === -3 && fb.spellId === 'mirror_image') {
          fb.applyPulse(this.wizards);
          fb._pendingPulse = false;
        } else if (dealt === -4 && fb.spellId === 'swap_projectile') {
          const caster = this.wizards.get(fb.ownerPlayerId);
          const target = this.wizards.get(fb.targetPlayerId);
          if (caster && target) {
            const tmpX = caster.x, tmpY = caster.y;
            caster.x = target.x; caster.y = target.y;
            target.x = tmpX; target.y = tmpY;
            caster.draw(); target.draw();
          }
        } else if (dealt > 0) {
          // Track last hit for lava kill credit
          wizard.lastHitBy = fb.ownerPlayerId;

          // Lifesteal (from upgrade + vampire modifier)
          const totalLifesteal = (fb.lifesteal || 0) + (this.activeModifier?.globalLifesteal || 0);
          if (totalLifesteal > 0) {
            const owner = this.wizards.get(fb.ownerPlayerId);
            if (owner && owner.alive) {
              owner.health = Math.min(owner.maxHealth, owner.health + dealt * totalLifesteal);
            }
          }

          // Explosion on hit (roguelike upgrade)
          const upgrades = this.playerUpgrades.get(fb.ownerPlayerId);
          if (upgrades && upgrades.explosionOnHit && fb.spellId === 'fireball') {
            const aoeR = upgrades.explosionRadius || 50;
            this.wizards.forEach((w) => {
              if (!w.alive || w.playerId === fb.ownerPlayerId || w.playerId === wizard.playerId) return;
              const adx = fb.x - w.x;
              const ady = fb.y - w.y;
              const adist = Math.sqrt(adx * adx + ady * ady);
              if (adist < aoeR + w.radius) {
                const falloff = 1 - Math.min(1, adist / aoeR);
                const aoeDmg = Math.round(dealt * 0.5 * falloff);
                if (aoeDmg > 0) {
                  w.takeDamage(aoeDmg);
                  w.lastHitBy = fb.ownerPlayerId;
                  const pushLen = adist > 0 ? adist : 1;
                  w.applyKnockback((-adx / pushLen) * fb.knockback * 0.5 * falloff, (-ady / pushLen) * fb.knockback * 0.5 * falloff);
                }
              }
            });
            // Explosion VFX (tracked for cleanup)
            const fx = this.add.graphics();
            this._blinkFxList.push(fx);
            fx.lineStyle(2, 0xff6600, 0.6);
            fx.strokeCircle(fb.x, fb.y, 5);
            this.tweens.add({ targets: fx, scaleX: aoeR / 5, scaleY: aoeR / 5, alpha: 0, duration: 300,
              onComplete: () => { fx.destroy(); this._blinkFxList = this._blinkFxList.filter((g) => g !== fx); } });
          }

          // Kill credit + effects
          if (wasAlive && !wizard.alive) {
            this._onWizardKill(fb.ownerPlayerId, wizard);
          }
        }
      });

      // Ricochet: redirect after hit
      if (fb.spellId === 'ricochet' && fb.needsRedirect) {
        fb.redirectToNearest(this.wizards);
      }
    });

    // Projectile-vs-projectile collision (different owners only)
    const noCollideSpells = new Set(['tether', 'vortex_wall', 'mirror_image', 'gravity_sphere', 'swap_projectile', 'lightning_bolt']);
    for (let i = 0; i < this.fireballs.length; i++) {
      const a = this.fireballs[i];
      if (!a.alive || noCollideSpells.has(a.spellId)) continue;
      if (a.spellId === 'tether' && a.phase === 'tethered') continue;
      if (a.spellId === 'meteor' && a.phase === 'indicator') continue;
      for (let j = i + 1; j < this.fireballs.length; j++) {
        const b = this.fireballs[j];
        if (!b.alive || noCollideSpells.has(b.spellId)) continue;
        if (b.spellId === 'tether' && b.phase === 'tethered') continue;
        if (b.spellId === 'meteor' && b.phase === 'indicator') continue;
        if (a.ownerPlayerId === b.ownerPlayerId) continue;
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < (a.radius || 5) + (b.radius || 5)) {
          // Ricochet bounces off projectiles instead of being destroyed
          if (a.spellId === 'ricochet' && a.bouncesRemaining > 0) {
            a.bouncesRemaining--;
            a.velX = -a.velX; a.velY = -a.velY; // reverse direction
            b.alive = false; // destroy the other projectile
          } else if (b.spellId === 'ricochet' && b.bouncesRemaining > 0) {
            b.bouncesRemaining--;
            b.velX = -b.velX; b.velY = -b.velY;
            a.alive = false;
          } else {
            a.alive = false;
            b.alive = false;
          }
        }
      }
    }

    // Destroy projectiles that hit the wall (skip stationary AoE spells)
    const skipWallCheck = new Set(['lightning_bolt', 'vortex_wall']);
    this.fireballs.forEach((fb) => {
      if (fb.alive && !skipWallCheck.has(fb.spellId) && this.arena.isOutsideWall(fb.x, fb.y)) {
        fb.alive = false;
      }
    });

    this.fireballs = this.fireballs.filter((fb) => {
      if (!fb.alive) { fb.destroy(); return false; }
      return true;
    });

    // Track pre-lava alive state for kill credit
    const preLavaAlive = new Map();
    if (this.gameMode === 'arena') {
      this.wizards.forEach((w) => preLavaAlive.set(w.playerId, w.alive));
    }

    this.arena.applyLavaDamage(this.wizards, delta);

    // Award kill gold if someone died to lava and had a lastHitBy
    this.wizards.forEach((w) => {
      if (preLavaAlive.get(w.playerId) && !w.alive && w.lastHitBy) {
        this._onWizardKill(w.lastHitBy, w);
      }
    });

    // Check round end
    const aliveWizards = Array.from(this.wizards.values()).filter((w) => w.alive);
    if (aliveWizards.length <= 1 && this.wizards.size > 1) {
      this.roundOver = true;

      // Redraw all wizards so dead ones visually fade out this frame
      this.wizards.forEach((w) => w.draw());

      const winner = aliveWizards[0];
      const winnerName = winner ? winner.playerName : 'No one';

      if (winner && !this.roundScoreAwarded) {
        this.roundScoreAwarded = true;
        this.scores.set(winner.playerId, (this.scores.get(winner.playerId) || 0) + 1);
        this._roundWinnerId = winner.playerId;
      } else {
        this._roundWinnerId = null;
      }

      if (!this.testMode) this._broadcastGameState();

      // Check if someone won the whole game
      const winnerScore = winner ? this.scores.get(winner.playerId) : 0;
      const isGameOver = winnerScore >= this.winsToWin;

      // Brief pause before announcing winner
      this._pendingTimers.push(
        this.time.delayedCall(500, () => {
          this.events.emit('round-over', {
            winnerName,
            scores: Object.fromEntries(this.scores),
            winsToWin: this.winsToWin,
            isGameOver,
          });

          if (isGameOver) {
            this.events.emit('game-over', {
              winnerName,
              scores: Object.fromEntries(this.scores),
              winsToWin: this.winsToWin,
            });
          } else if (this.gameMode === 'arena') {
            // Arena mode: open shop between rounds
            this._pendingTimers.push(
              this.time.delayedCall(ROUND_END_DELAY, () => {
                this._startShopPhase(this._roundWinnerId);
              })
            );
          } else {
            this._pendingTimers.push(
              this.time.delayedCall(ROUND_END_DELAY, () => {
                this._showPowerUpSelection();
              })
            );
          }
        })
      );
    }
  }

  _showPowerUpSelection() {
    this._upgradesPending = new Set();
    this._upgradeTimerStart = Date.now();
    const winnerId = this._roundWinnerId;

    // Bots pick immediately (skip the winner bot)
    if (this.testMode) {
      for (const botId of this.botIds) {
        if (botId !== winnerId) {
          this._applyRandomBotUpgrade(botId);
        }
      }
    }

    // Track which human players still need to pick (skip the winner)
    this.playerInfo.forEach((p) => {
      if (!p.peerId.startsWith('bot-') && p.peerId !== winnerId) {
        this._upgradesPending.add(p.peerId);
      }
    });

    // Show selection UI locally (for host, unless host is the winner)
    if (this.localPlayerId !== winnerId) {
      this.events.emit('show-powerup-selection', {
        currentUpgrades: Object.fromEntries(this.playerUpgrades),
      });
    } else {
      // Winner sees a waiting screen instead
      this.events.emit('winner-skip-upgrade');
    }

    // Tell clients to show their selection UI (or skip if they're the winner)
    if (!this.testMode) {
      network.broadcastToClients({ type: 'show-upgrades', winnerId });
    }

    // If no one needs to pick (e.g. test mode with winner as only human), skip
    if (this._upgradesPending.size === 0) {
      this._checkAllUpgradesPicked();
      return;
    }

    // Start the 30s auto-pick timer
    this._upgradeAutoPickTimer = this.time.delayedCall(30000, () => {
      this._autoPickForRemaining();
    });
    this._pendingTimers.push(this._upgradeAutoPickTimer);
  }

  _receiveUpgradeChoice(peerId, upgradeId) {
    if (!this._upgradesPending || !this._upgradesPending.has(peerId)) return;
    this.applyUpgrade(peerId, upgradeId);
    this._upgradesPending.delete(peerId);

    // Broadcast to all clients so they update their local playerUpgrades
    if (!this.testMode) {
      network.broadcastToClients({ type: 'upgrade-applied', peerId, upgradeId });
    }

    this._checkAllUpgradesPicked();
  }

  // Called when the local host player picks an upgrade
  submitLocalUpgrade(upgradeId) {
    this.applyUpgrade(this.localPlayerId, upgradeId);
    if (this._upgradesPending) {
      this._upgradesPending.delete(this.localPlayerId);
    }

    // Broadcast host's own upgrade to clients
    if (!this.testMode) {
      network.broadcastToClients({ type: 'upgrade-applied', peerId: this.localPlayerId, upgradeId });
    }

    this._checkAllUpgradesPicked();
  }

  // Called when a client picks an upgrade (sends to host)
  sendUpgradeChoice(upgradeId) {
    network.sendInput({ type: 'input', action: 'upgrade', upgradeId });
  }

  _checkAllUpgradesPicked() {
    if (!this._upgradesPending) return;
    if (this._upgradesPending.size > 0) {
      // Broadcast waiting status to clients
      if (!this.testMode) {
        network.broadcastToClients({
          type: 'upgrade-status',
          waiting: Array.from(this._upgradesPending),
          total: this.playerInfo.filter((p) => !p.peerId.startsWith('bot-')).length,
        });
      }
      this.events.emit('upgrade-waiting', {
        remaining: this._upgradesPending.size,
        total: this.playerInfo.filter((p) => !p.peerId.startsWith('bot-')).length,
      });
      return;
    }

    // Everyone has picked — cancel timer and start next round
    if (this._upgradeAutoPickTimer) {
      this._upgradeAutoPickTimer.remove(false);
    }
    this.events.emit('upgrade-waiting', { remaining: 0, total: 0 });

    // In roguelike mode, go to modifier vote before starting round
    // Use setTimeout since roundOver=true freezes Phaser timers
    if (this.gameMode === 'roguelike' && this.roundNumber > 0) {
      setTimeout(() => this._startModifierVote(), 500);
    } else {
      setTimeout(() => {
        this._startRound();
        if (!this.testMode) {
          network.broadcastToClients({ type: 'game-start-round' });
        }
      }, 500);
    }
  }

  _autoPickForRemaining() {
    if (!this._upgradesPending) return;
    const allIds = UPGRADES.map((u) => u.id);
    for (const peerId of this._upgradesPending) {
      const pick = allIds[Math.floor(Math.random() * allIds.length)];
      this.applyUpgrade(peerId, pick);
    }
    this._upgradesPending.clear();
    this._checkAllUpgradesPicked();
  }

  _applyRandomBotUpgrade(botId) {
    const allIds = UPGRADES.map((u) => u.id);
    const pick = allIds[Math.floor(Math.random() * allIds.length)];
    this.applyUpgrade(botId, pick);
  }

  applyUpgrade(playerId, upgradeId) {
    const upgrades = this.playerUpgrades.get(playerId);
    if (!upgrades) return;
    const def = UPGRADES.find((u) => u.id === upgradeId);
    if (!def) return;
    def.apply(upgrades);
    const history = this.playerUpgradeHistory.get(playerId);
    if (history) history.push(upgradeId);
  }

  getUpgradeHistory() {
    return Object.fromEntries(this.playerUpgradeHistory);
  }

  startNextRound() {
    this._startRound();
  }

  extendGame() {
    this.winsToWin += 2;
    this.events.emit('game-extended', { winsToWin: this.winsToWin });
    if (this.gameMode === 'arena') {
      this._startShopPhase(this._roundWinnerId);
    } else {
      this._showPowerUpSelection();
    }
  }

  getScores() {
    return Object.fromEntries(this.scores);
  }

  getPlayerInfo() {
    return this.playerInfo;
  }

  _createProjectileFromState(fbs) {
    const spellId = fbs.spellId || 'fireball';
    switch (spellId) {
      case 'lightning_bolt': {
        const p = new LightningBolt(this, fbs.x, fbs.y, 0, 0, fbs.ownerPlayerId, fbs);
        if (fbs.phase) p.phase = fbs.phase;
        if (fbs.strikeTime) p.strikeTime = fbs.strikeTime;
        if (fbs.hitTargets) p.hitTargets = new Set(fbs.hitTargets);
        p.struck = false; // don't re-trigger strike on restore
        return p;
      }
      case 'meteor': {
        const p = new Meteor(this, fbs.x, fbs.y, fbs.rollDirX || fbs.velX || 0, fbs.rollDirY || fbs.velY || 0, fbs.ownerPlayerId, fbs);
        // Override position and state from serialized data
        p.x = fbs.x;
        p.y = fbs.y;
        p.velX = fbs.velX || 0;
        p.velY = fbs.velY || 0;
        if (fbs.phase) {
          p.phase = fbs.phase;
          if (fbs.landTime) p.landTime = fbs.landTime;
          if (fbs.rollStartTime) p.rollStartTime = fbs.rollStartTime;
          if (fbs.landX !== undefined) p.landX = fbs.landX;
          if (fbs.landY !== undefined) p.landY = fbs.landY;
        }
        if (fbs.exploded) { p.phase = 'exploded'; p.exploded = true; p.explosionTime = Date.now(); }
        if (fbs.hitTargets) { p.hitTargets = new Set(fbs.hitTargets); }
        return p;
      }
      case 'gravity_sphere': {
        const p = new GravitySphere(this, fbs.x, fbs.y, fbs.velX || 0, fbs.velY || 0, fbs.ownerPlayerId, fbs);
        p.velX = fbs.velX || 0;
        p.velY = fbs.velY || 0;
        return p;
      }
      case 'homing_missile': {
        const p = new HomingMissile(this, fbs.x, fbs.y, fbs.velX || 0, fbs.velY || 0, fbs.ownerPlayerId, fbs);
        if (fbs.angle !== undefined) p.angle = fbs.angle;
        p.velX = fbs.velX || 0;
        p.velY = fbs.velY || 0;
        return p;
      }
      case 'ricochet': {
        const p = new Ricochet(this, fbs.x, fbs.y, fbs.velX || 0, fbs.velY || 0, fbs.ownerPlayerId, fbs);
        p.velX = fbs.velX || 0;
        p.velY = fbs.velY || 0;
        if (fbs.bouncesRemaining !== undefined) p.bouncesRemaining = fbs.bouncesRemaining;
        if (fbs.bounceCount !== undefined) p.bounceCount = fbs.bounceCount;
        if (fbs.lastHitId) p.lastHitId = fbs.lastHitId;
        return p;
      }
      case 'color_spray': {
        const p = new ColorSprayParticle(this, fbs.x, fbs.y, fbs.velX || 0, fbs.velY || 0, fbs.ownerPlayerId, fbs);
        p.velX = fbs.velX || 0;
        p.velY = fbs.velY || 0;
        return p;
      }
      case 'tether': {
        const p = new Tether(this, fbs.x, fbs.y, fbs.velX || 0, fbs.velY || 0, fbs.ownerPlayerId, fbs);
        p.velX = fbs.velX || 0;
        p.velY = fbs.velY || 0;
        if (fbs.phase === 'tethered') {
          p.phase = 'tethered';
          p.targetPlayerId = fbs.targetPlayerId;
          p.tetherStartTime = fbs.tetherStartTime;
        }
        return p;
      }
      case 'mirror_image': {
        const p = new MirrorImage(this, fbs.x, fbs.y, fbs.velX || 0, fbs.velY || 0, fbs.ownerPlayerId, fbs);
        p.velX = fbs.velX || 0;
        p.velY = fbs.velY || 0;
        return p;
      }
      case 'vortex_wall': {
        const p = new VortexWall(this, fbs.x, fbs.y, fbs.normalX || 1, fbs.normalY || 0, fbs.ownerPlayerId, fbs);
        return p;
      }
      case 'swap_projectile': {
        const p = new SwapProjectile(this, fbs.x, fbs.y, fbs.velX || 0, fbs.velY || 0, fbs.ownerPlayerId, fbs);
        p.velX = fbs.velX || 0;
        p.velY = fbs.velY || 0;
        if (fbs.targetPlayerId) p.targetPlayerId = fbs.targetPlayerId;
        return p;
      }
      case 'fireball':
      default: {
        const p = new Fireball(this, fbs.x, fbs.y, fbs.velX || 0, fbs.velY || 0, fbs.ownerPlayerId, fbs);
        p.velX = fbs.velX || 0;
        p.velY = fbs.velY || 0;
        return p;
      }
    }
  }

  _broadcastGameState() {
    const killStatsObj = {};
    this.killStats.forEach((v, k) => { killStatsObj[k] = v; });

    const state = {
      type: 'game-state',
      arena: this.arena.serialize(),
      wizards: Array.from(this.wizards.values()).map((w) => w.serialize()),
      fireballs: this.fireballs.map((fb) => fb.serialize()),
      scores: Object.fromEntries(this.scores),
      killStats: killStatsObj,
      bountyTarget: this.bountyTarget,
      hazards: this.hazardManager ? this.hazardManager.serialize() : [],
    };
    network.broadcastToClients(state);
  }

  _applyGameState(data) {
    if (network.isHost) return;

    // Sync scores from host
    if (data.scores) {
      for (const [pid, score] of Object.entries(data.scores)) {
        this.scores.set(pid, score);
      }
    }

    // Sync kill stats, bounty, hazards
    if (data.killStats) {
      for (const [pid, stats] of Object.entries(data.killStats)) {
        this.killStats.set(pid, stats);
      }
    }
    if (data.bountyTarget !== undefined) this.bountyTarget = data.bountyTarget;
    if (data.hazards && this.hazardManager) {
      this.hazardManager.applyState(data.hazards);
    }

    if (this.roundOver) return;

    if (this.arena && data.arena) this.arena.applyState(data.arena);

    if (data.wizards) {
      data.wizards.forEach((ws) => {
        const wizard = this.wizards.get(ws.playerId);
        if (wizard) wizard.applyState(ws);
      });
    }

    // Sync projectiles: destroy all and recreate from server state
    // (simpler and more correct than trying to match types/indices)
    const serverFbs = (data.fireballs || []).filter((f) => f.alive || (f.spellId === 'meteor' && f.exploded));
    // Remove excess local projectiles
    while (this.fireballs.length > serverFbs.length) {
      this.fireballs.pop().destroy();
    }
    // Update existing and create missing
    serverFbs.forEach((fbs, i) => {
      if (i < this.fireballs.length && (this.fireballs[i].spellId || 'fireball') === (fbs.spellId || 'fireball')) {
        // Update existing projectile of same type
        const fb = this.fireballs[i];
        fb.x = fbs.x;
        fb.y = fbs.y;
        if (fbs.velX !== undefined) fb.velX = fbs.velX;
        if (fbs.velY !== undefined) fb.velY = fbs.velY;
        fb.alive = fbs.alive;
        if (fbs.phase !== undefined) fb.phase = fbs.phase;
        if (fbs.exploded !== undefined) fb.exploded = fbs.exploded;
        fb.draw();
      } else {
        // Type mismatch or new — destroy old and create correct type
        if (i < this.fireballs.length) {
          this.fireballs[i].destroy();
        }
        const fb = this._createProjectileFromState(fbs);
        if (i < this.fireballs.length) {
          this.fireballs[i] = fb;
        } else {
          this.fireballs.push(fb);
        }
      }
    });

    if (data.scores) {
      Object.entries(data.scores).forEach(([id, wins]) => this.scores.set(id, wins));
    }

    const aliveWizards = Array.from(this.wizards.values()).filter((w) => w.alive);
    if (aliveWizards.length <= 1 && this.wizards.size > 1 && !this.roundOver) {
      this.roundOver = true;
      const winner = aliveWizards[0];
      this.events.emit('round-over', {
        winnerName: winner ? winner.playerName : 'No one',
        scores: Object.fromEntries(this.scores),
        winsToWin: this.winsToWin,
      });
    }
  }
}
