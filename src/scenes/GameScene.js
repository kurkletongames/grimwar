import Phaser from 'phaser';
import { network } from '../network/NetworkManager.js';
import { LobbyManager } from '../network/LobbyManager.js';
import { Arena } from '../entities/Arena.js';
import { Wizard } from '../entities/Wizard.js';
import {
  Fireball,
  FIREBALL_COOLDOWN,
  BASE_FIREBALL_SPEED,
  BASE_FIREBALL_DAMAGE,
  BASE_FIREBALL_KNOCKBACK,
} from '../entities/Fireball.js';

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
  // ---- Common ----
  {
    id: 'damage_1',
    title: 'Searing Flames',
    desc: 'Fireball damage +5',
    rarity: 'common',
    apply: (u) => { u.damage += 5; },
  },
  {
    id: 'speed_1',
    title: 'Swift Cast',
    desc: 'Fireball speed +40',
    rarity: 'common',
    apply: (u) => { u.speed += 40; },
  },
  {
    id: 'knockback_1',
    title: 'Concussive Blast',
    desc: 'Fireball knockback +150',
    rarity: 'common',
    apply: (u) => { u.knockback += 150; },
  },
  {
    id: 'cooldown_1',
    title: 'Quick Hands',
    desc: 'Fireball cooldown -300ms',
    rarity: 'common',
    apply: (u) => { u.cooldownReduction += 300; },
  },
  {
    id: 'hp_1',
    title: 'Tough Skin',
    desc: 'Max HP +15',
    rarity: 'common',
    apply: (u) => { u.bonusHp += 15; },
  },

  // ---- Rare ----
  {
    id: 'multishot_1',
    title: 'Split Bolt',
    desc: 'Fire 1 additional fireball in a spread',
    rarity: 'rare',
    apply: (u) => { u.multishot += 1; },
  },
  {
    id: 'radius_1',
    title: 'Meteor Size',
    desc: 'Fireball size +50%',
    rarity: 'rare',
    apply: (u) => { u.radius = Math.round(u.radius * 1.5); },
  },
  {
    id: 'blink_range',
    title: 'Phase Shift',
    desc: 'Blink distance +60',
    rarity: 'rare',
    apply: (u) => { u.blinkDistance += 60; },
  },
  {
    id: 'damage_2',
    title: 'Inferno',
    desc: 'Fireball damage +10',
    rarity: 'rare',
    apply: (u) => { u.damage += 10; },
  },
  {
    id: 'cooldown_2',
    title: 'Rapid Fire',
    desc: 'Fireball cooldown -500ms',
    rarity: 'rare',
    apply: (u) => { u.cooldownReduction += 500; },
  },
  {
    id: 'lifesteal_1',
    title: 'Siphon',
    desc: 'Heal for 20% of fireball damage dealt',
    rarity: 'rare',
    apply: (u) => { u.lifesteal += 0.2; },
  },
  {
    id: 'hp_2',
    title: 'Fortify',
    desc: 'Max HP +30',
    rarity: 'rare',
    apply: (u) => { u.bonusHp += 30; },
  },

  // ---- Epic ----
  {
    id: 'blink_knockback',
    title: 'Aftershock',
    desc: 'Blink leaves a shockwave that knocks back nearby enemies',
    rarity: 'epic',
    apply: (u) => { u.blinkKnockback += 900; },
  },
  {
    id: 'piercing',
    title: 'Piercing Flame',
    desc: 'Fireballs pass through enemies, hitting all in their path',
    rarity: 'epic',
    apply: (u) => { u.piercing = true; },
  },
  {
    id: 'multishot_2',
    title: 'Tri-Shot',
    desc: 'Fire 2 additional fireballs in a spread',
    rarity: 'epic',
    apply: (u) => { u.multishot += 2; },
  },
  {
    id: 'knockback_2',
    title: 'Gale Force',
    desc: 'Fireball knockback +400',
    rarity: 'epic',
    apply: (u) => { u.knockback += 400; },
  },
  {
    id: 'lifesteal_2',
    title: 'Soul Drain',
    desc: 'Heal for 40% of fireball damage dealt',
    rarity: 'epic',
    apply: (u) => { u.lifesteal += 0.4; },
  },

  // ---- Legendary ----
  {
    id: 'multishot_3',
    title: 'Barrage',
    desc: 'Fire 3 additional fireballs in a wide spread',
    rarity: 'legendary',
    apply: (u) => { u.multishot += 3; },
  },
  {
    id: 'glass_cannon',
    title: 'Glass Cannon',
    desc: 'Fireball damage +25, but you get knocked back when firing',
    rarity: 'legendary',
    apply: (u) => { u.damage += 25; u.selfKnockback += 300; },
  },
  {
    id: 'overcharge',
    title: 'Overcharge',
    desc: 'Fireball cooldown -800ms, speed +60, damage +8',
    rarity: 'legendary',
    apply: (u) => { u.cooldownReduction += 800; u.speed += 60; u.damage += 8; },
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

    // Round & score tracking
    this.roundNumber = 0;
    this.scores = new Map(); // playerId -> round wins
    this.playerInfo = []; // saved from game start for respawning

    // Per-player cooldown timestamps (for visual indicators on all wizards)
    this.playerFireballTimes = new Map(); // playerId -> last cast time
    this.playerBlinkTimes = new Map(); // playerId -> last cast time
    this._blinkFxList = []; // track VFX graphics for cleanup
    this.winsToWin = DEFAULT_WINS_TO_WIN;

    // Per-player fireball upgrades: { speed, damage, knockback }
    this.playerUpgrades = new Map();
    this.playerUpgradeHistory = new Map(); // playerId -> [upgradeId, ...]

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

    // Cleanup on scene shutdown
    this.events.on('shutdown', () => {
      this._cancelPendingTimers();
      network.onGameState = null;
      network.onPlayerInput = null;
      network.onShowUpgrades = null;
      network.onUpgradeStatus = null;
      network.onStartRound = null;
    });
  }

  _startGame(data) {
    this.gameStarted = true;
    this.localPlayerId = network.localPlayerId;
    this.testMode = data.testMode || false;
    this.playerInfo = data.players;
    this.botIds = [];
    this.botLastFireball = {};

    // Init scores, upgrades, and history
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
      });
      if (p.peerId.startsWith('bot-')) {
        this.botIds.push(p.peerId);
        this.botLastFireball[p.peerId] = 0;
      }
    });

    this.winsToWin = DEFAULT_WINS_TO_WIN;

    this.scene.launch('UIScene');

    const emitAndStart = () => {
      this.events.emit('game-started', {
        players: data.players,
        scores: Object.fromEntries(this.scores),
        winsToWin: this.winsToWin,
      });
      this._startRound();
    };

    // UIScene.create() is async on first launch — check if already active
    const uiScene = this.scene.get('UIScene');
    if (uiScene.scene.isActive()) {
      emitAndStart();
    } else {
      uiScene.events.once('create', emitAndStart);
    }
  }

  _cancelPendingTimers() {
    if (this._pendingTimers) {
      this._pendingTimers.forEach((t) => t.remove(false));
    }
    this._pendingTimers = [];
  }

  _startRound() {
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
    this.botIds.forEach((botId) => { this.botLastFireball[botId] = 0; });

    // Destroy lingering tween graphics
    if (this._blinkFxList) {
      this._blinkFxList.forEach((g) => { if (g && g.active) g.destroy(); });
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
    this.arena.startRound();

    // Spawn wizards
    const spawnRadius = 300;
    this.playerInfo.forEach((player, index) => {
      const angle = (index / this.playerInfo.length) * Math.PI * 2 - Math.PI / 2;
      const x = cx + Math.cos(angle) * spawnRadius;
      const y = cy + Math.sin(angle) * spawnRadius;
      const wizard = new Wizard(this, x, y, player.peerId, player.name, index);
      const upgrades = this.playerUpgrades.get(player.peerId);
      if (upgrades && upgrades.bonusHp > 0) {
        wizard.maxHealth += upgrades.bonusHp;
        wizard.health = wizard.maxHealth;
      }
      this.wizards.set(player.peerId, wizard);
    });

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
  }

  _getFireballCooldown(playerId) {
    const upgrades = this.playerUpgrades.get(playerId);
    const reduction = upgrades ? upgrades.cooldownReduction : 0;
    return Math.max(500, FIREBALL_COOLDOWN - reduction); // min 0.5s
  }

  _handleLeftClick(pointer) {
    if (!this.gameStarted || this.roundOver || this.countdownActive) return;

    const now = Date.now();
    const cd = this._getFireballCooldown(this.localPlayerId);
    if (now - this.lastFireballTime < cd) return;

    const wizard = this.wizards.get(this.localPlayerId);
    if (!wizard || !wizard.alive) return;

    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const dirX = worldPoint.x - wizard.x;
    const dirY = worldPoint.y - wizard.y;

    if (network.isHost) {
      this._spawnFireball(this.localPlayerId, wizard.x, wizard.y, dirX, dirY);
      this.lastFireballTime = now;
      this.events.emit('fireball-cast', now);
    } else {
      network.sendInput({ type: 'input', action: 'fireball', dirX, dirY });
      this.lastFireballTime = now;
      this.events.emit('fireball-cast', now);
    }
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

    // Self-knockback (Glass Cannon)
    if (stats.selfKnockback > 0) {
      const wizard = this.wizards.get(playerId);
      if (wizard && wizard.alive) {
        const len = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
        wizard.applyKnockback((-dirX / len) * stats.selfKnockback, (-dirY / len) * stats.selfKnockback);
      }
    }
  }

  _handleBlink() {
    if (!this.gameStarted || this.roundOver || this.countdownActive) return;

    const now = Date.now();
    if (now - this.lastBlinkTime < BLINK_COOLDOWN) return;

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

    const upgrades = this.playerUpgrades.get(playerId) || {};
    const blinkDist = upgrades.blinkDistance || BLINK_DISTANCE;
    const blinkKB = upgrades.blinkKnockback || 0;

    const len = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
    const nx = dirX / len;
    const ny = dirY / len;

    const oldX = wizard.x;
    const oldY = wizard.y;

    // Teleport
    wizard.x += nx * blinkDist;
    wizard.y += ny * blinkDist;

    // Knockback persists through blink — wizard keeps their momentum

    // Constrain to wall
    this.arena.constrainToWall(wizard);
    this.playerBlinkTimes.set(playerId, Date.now());

    // Blink knockback — push nearby enemies away from origin
    const shockwaveRange = 140;
    if (blinkKB > 0) {
      this.wizards.forEach((other) => {
        if (other.playerId === playerId || !other.alive) return;
        const dx = other.x - oldX;
        const dy = other.y - oldY;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        if (dist < shockwaveRange) {
          const pushNx = dx / dist;
          const pushNy = dy / dist;
          const force = blinkKB * (1 - dist / shockwaveRange);
          other.applyKnockback(pushNx * force, pushNy * force);
        }
      });

      // Visual shockwave at origin
      const shockwave = this.add.graphics();
      this._blinkFxList.push(shockwave);
      shockwave.lineStyle(3, 0x4fc3f7, 0.7);
      shockwave.strokeCircle(oldX, oldY, 10);
      this.tweens.add({
        targets: shockwave,
        scaleX: 4, scaleY: 4, alpha: 0,
        duration: 350,
        onComplete: () => { shockwave.destroy(); this._blinkFxList = this._blinkFxList.filter((g) => g !== shockwave); },
      });
    }

    // Afterimage at old position
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

  _executeLocalBlink(wizard, dirX, dirY) {
    const upgrades = this.playerUpgrades.get(wizard.playerId) || {};
    const blinkDist = upgrades.blinkDistance || BLINK_DISTANCE;

    const len = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
    const nx = dirX / len;
    const ny = dirY / len;

    const oldX = wizard.x;
    const oldY = wizard.y;

    wizard.x += nx * blinkDist;
    wizard.y += ny * blinkDist;

    this.arena.constrainToWall(wizard);

    // Afterimage
    const fx = this.add.graphics();
    fx.fillStyle(0x4fc3f7, 0.5);
    fx.fillCircle(oldX, oldY, wizard.radius);
    this.tweens.add({
      targets: fx,
      alpha: 0,
      duration: 300,
      onComplete: () => fx.destroy(),
    });

    wizard.draw();
  }

  _isFiniteNum(v) {
    return typeof v === 'number' && isFinite(v);
  }

  _handleRemoteInput(peerId, data) {
    if (!network.isHost) return;

    // Upgrade selection — handle before wizard alive check (wizards don't exist between rounds)
    if (data.action === 'upgrade') {
      if (typeof data.upgradeId === 'string') {
        this._receiveUpgradeChoice(peerId, data.upgradeId);
      }
      return;
    }

    const wizard = this.wizards.get(peerId);
    if (!wizard || !wizard.alive) return;

    switch (data.action) {
      case 'move-dir':
        if (!this._isFiniteNum(data.x) || !this._isFiniteNum(data.y)) return;
        wizard.setInput(data.x, data.y);
        break;
      case 'fireball':
        if (!this._isFiniteNum(data.dirX) || !this._isFiniteNum(data.dirY)) return;
        this._spawnFireball(peerId, wizard.x, wizard.y, data.dirX, data.dirY);
        break;
      case 'blink': {
        // Client sends target position; compute direction from host's authoritative wizard position
        if (!this._isFiniteNum(data.targetX) || !this._isFiniteNum(data.targetY)) return;
        const blinkDirX = data.targetX - wizard.x;
        const blinkDirY = data.targetY - wizard.y;
        this._executeBlink(peerId, blinkDirX, blinkDirY);
        break;
      }
    }
  }

  update(time, delta) {
    if (!this.gameStarted || this.roundOver || this.countdownActive) return;

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

    // Move fireballs locally using their velocity (no trail/lifetime — host handles that)
    const dt = delta / 1000;
    this.fireballs.forEach((fb) => {
      if (!fb.alive) return;
      fb.x += fb.velX * dt;
      fb.y += fb.velY * dt;
      fb.draw();
    });

    // Update cooldown visuals for local wizard
    const localWizard = this.wizards.get(this.localPlayerId);
    if (localWizard && localWizard.alive) {
      const now = Date.now();
      const fbElapsed = now - this.lastFireballTime;
      const localCd = this._getFireballCooldown(this.localPlayerId);
      const fbPct = this.lastFireballTime === 0 ? 0 : Math.max(0, 1 - fbElapsed / localCd);
      const blinkReady = this.lastBlinkTime === 0 || (now - this.lastBlinkTime) >= BLINK_COOLDOWN;
      localWizard.setCooldowns(fbPct, blinkReady);
    }

    this.arena.update(delta);
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
      } else if (nearestDist > 160) {
        const len = nearestDist || 1;
        bot.setInput(dx / len, dy / len);
      } else if (nearestDist < 80) {
        const len = nearestDist || 1;
        bot.setInput(-dx / len, -dy / len);
      } else {
        const len = nearestDist || 1;
        bot.setInput(-dy / len * 0.5, dx / len * 0.5);
      }

      if (now - (this.botLastFireball[botId] || 0) > FIREBALL_COOLDOWN + 200 + Math.random() * 800) {
        this._spawnFireball(botId, bot.x, bot.y, dx, dy);
        this.botLastFireball[botId] = now;
      }
    }
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

    this.arena.update(delta);

    const now = Date.now();
    this.wizards.forEach((wizard) => {
      wizard.update(delta);
      if (wizard.alive) this.arena.constrainToWall(wizard);

      // Update cooldown visuals for all wizards
      const lastFb = this.playerFireballTimes.get(wizard.playerId) || 0;
      const fbElapsed = now - lastFb;
      const playerCd = this._getFireballCooldown(wizard.playerId);
      const fbPct = lastFb === 0 ? 0 : Math.max(0, 1 - fbElapsed / playerCd);

      const lastBlink = this.playerBlinkTimes.get(wizard.playerId) || 0;
      const blinkElapsed = now - lastBlink;
      const blinkReady = lastBlink === 0 || blinkElapsed >= BLINK_COOLDOWN;

      wizard.setCooldowns(fbPct, blinkReady);
    });

    // Wizard-to-wizard collision (knockback transfer)
    this._checkWizardCollisions();

    this.fireballs.forEach((fb) => {
      fb.update(delta);
      this.wizards.forEach((wizard) => {
        const dealt = fb.checkHit(wizard);
        if (dealt > 0 && fb.lifesteal > 0) {
          const owner = this.wizards.get(fb.ownerPlayerId);
          if (owner && owner.alive) {
            owner.health = Math.min(owner.maxHealth, owner.health + dealt * fb.lifesteal);
          }
        }
      });
    });

    // Fireball-vs-fireball collision (different owners only, one destroys the other)
    for (let i = 0; i < this.fireballs.length; i++) {
      const a = this.fireballs[i];
      if (!a.alive) continue;
      for (let j = i + 1; j < this.fireballs.length; j++) {
        const b = this.fireballs[j];
        if (!b.alive) continue;
        if (a.ownerPlayerId === b.ownerPlayerId) continue;
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < a.radius + b.radius) {
          // Both fireballs destroy each other
          a.alive = false;
          b.alive = false;
        }
      }
    }

    // Destroy fireballs that hit the wall
    this.fireballs.forEach((fb) => {
      if (fb.alive && this.arena.isOutsideWall(fb.x, fb.y)) {
        fb.alive = false;
      }
    });

    this.fireballs = this.fireballs.filter((fb) => {
      if (!fb.alive) { fb.destroy(); return false; }
      return true;
    });

    this.arena.applyLavaDamage(this.wizards, delta);

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
    this._checkAllUpgradesPicked();
  }

  // Called when the local host player picks an upgrade
  submitLocalUpgrade(upgradeId) {
    this.applyUpgrade(this.localPlayerId, upgradeId);
    if (this._upgradesPending) {
      this._upgradesPending.delete(this.localPlayerId);
    }
    this._checkAllUpgradesPicked();
  }

  // Called when a client picks an upgrade (sends to host)
  sendUpgradeChoice(upgradeId) {
    network.sendInput({ type: 'input', action: 'upgrade', upgradeId });
  }

  _checkAllUpgradesPicked() {
    if (!this._upgradesPending || this._upgradesPending.size > 0) {
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

    // Brief delay then start
    this._pendingTimers.push(
      this.time.delayedCall(500, () => {
        this._startRound();
        if (!this.testMode) {
          network.broadcastToClients({ type: 'game-start-round' });
        }
      })
    );
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
    this._showPowerUpSelection();
  }

  getScores() {
    return Object.fromEntries(this.scores);
  }

  getPlayerInfo() {
    return this.playerInfo;
  }

  _broadcastGameState() {
    const state = {
      type: 'game-state',
      arena: this.arena.serialize(),
      wizards: Array.from(this.wizards.values()).map((w) => w.serialize()),
      fireballs: this.fireballs.map((fb) => fb.serialize()),
      scores: Object.fromEntries(this.scores),
    };
    network.broadcastToClients(state);
  }

  _applyGameState(data) {
    if (network.isHost || this.roundOver) return;

    if (this.arena && data.arena) this.arena.applyState(data.arena);

    if (data.wizards) {
      data.wizards.forEach((ws) => {
        const wizard = this.wizards.get(ws.playerId);
        if (wizard) wizard.applyState(ws);
      });
    }

    // Sync fireballs: match count and update positions instead of destroy/recreate
    const serverFbs = (data.fireballs || []).filter((f) => f.alive);
    // Remove excess local fireballs
    while (this.fireballs.length > serverFbs.length) {
      this.fireballs.pop().destroy();
    }
    // Update existing and create missing
    serverFbs.forEach((fbs, i) => {
      if (i < this.fireballs.length) {
        // Update existing fireball
        const fb = this.fireballs[i];
        fb.x = fbs.x;
        fb.y = fbs.y;
        fb.velX = fbs.velX;
        fb.velY = fbs.velY;
        fb.alive = fbs.alive;
        fb.draw();
      } else {
        // Create new fireball
        const fb = new Fireball(this, fbs.x, fbs.y, fbs.velX, fbs.velY, fbs.ownerPlayerId, {
          damage: fbs.damage,
          knockback: fbs.knockback,
          radius: fbs.radius,
          piercing: fbs.piercing,
        });
        fb.velX = fbs.velX;
        fb.velY = fbs.velY;
        this.fireballs.push(fb);
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
