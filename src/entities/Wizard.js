import Phaser from 'phaser';

const WIZARD_RADIUS = 18;
const WIZARD_SPEED = 85;
const MAX_HEALTH = 100;
const FRICTION = 0.98; // High value = knockback carries far (Smash-style)
const FRICTION_THRESHOLD = 5; // Min velocity before knockback stops
const COOLDOWN_RING_RADIUS = 24;

// Wizard colors for up to 8 players
export const WIZARD_COLORS = [
  0x4fc3f7, // blue
  0xe94560, // red
  0x66bb6a, // green
  0xffa726, // orange
  0xab47bc, // purple
  0xffee58, // yellow
  0x26c6da, // cyan
  0xef5350, // pink-red
];

export class Wizard {
  constructor(scene, x, y, playerId, playerName, colorIndex, cosmetics) {
    this.scene = scene;
    this.playerId = playerId;
    this.playerName = playerName;
    this.health = MAX_HEALTH;
    this.maxHealth = MAX_HEALTH;
    this.alive = true;
    this.color = WIZARD_COLORS[colorIndex % WIZARD_COLORS.length];
    const defaults = { hat: 'classic', trail: 'none', eyes: 'normal', aura: 'none', mouth: 'none' };
    this.cosmetics = cosmetics ? { ...defaults, ...cosmetics } : defaults;
    this._trailPositions = [];

    // Movement
    this.inputDir = { x: 0, y: 0 }; // For WASD
    this.knockbackVel = { x: 0, y: 0 };

    // Cooldown visuals
    this.fireballCooldownPct = 0; // 0 = ready, 1 = just cast
    this.cooldownRingColor = 0xff6600; // default fireball orange
    this.blinkReady = true;
    this.blinkCooldownPct = 0; // 0 = ready, 1 = just cast
    this.blinkGlowAlpha = 0; // for the pulse effect

    // Slow effect (from Ice Shard)
    this.slowEffect = null; // { factor: 0.5, endTime: timestamp }

    // Kill credit tracking
    this.lastHitBy = null; // playerId of last player who damaged us
    this.knockbackResist = 0; // 0-1, reduces incoming knockback
    this.tethered = false; // true when being pulled by tether (disables friction)
    this.inGravity = false; // true when in gravity sphere pull (reduces friction)
    this.bonusSpeed = 0; // additional movement speed from arena upgrades
    this.sparkle = false; // secret sparkle effect
    this._sparkleTimer = 0;

    // Rush dash state
    this.dashing = false;
    this.dashDir = { x: 0, y: 0 };
    this.dashSpeed = 0;
    this.dashRemaining = 0;

    // Create wizard body (circle)
    this.graphics = scene.add.graphics();
    this.cooldownGraphics = scene.add.graphics();
    this.glowGraphics = scene.add.graphics();
    this.x = x;
    this.y = y;
    this.radius = WIZARD_RADIUS;

    // Name label
    this.nameText = scene.add.text(x, y - WIZARD_RADIUS - 14, playerName, {
      fontSize: '12px',
      color: '#ffffff',
      align: 'center',
    }).setOrigin(0.5);

    // Health bar
    this.healthBarBg = scene.add.graphics();
    this.healthBar = scene.add.graphics();

    this.draw();
  }

  draw() {
    const alpha = this.alive ? 1 : 0.3;
    this.graphics.setAlpha(alpha);
    this.nameText.setAlpha(alpha);
    this.healthBar.setAlpha(alpha);
    this.healthBarBg.setAlpha(alpha);
    this.cooldownGraphics.setAlpha(alpha);
    this.glowGraphics.setAlpha(alpha);

    // Blink ready glow (drawn behind wizard)
    this.glowGraphics.clear();
    if (this.alive && this.blinkGlowAlpha > 0) {
      this.glowGraphics.fillStyle(0x4fc3f7, this.blinkGlowAlpha * 0.3);
      this.glowGraphics.fillCircle(this.x, this.y, this.radius + 10);
      this.glowGraphics.fillStyle(0x4fc3f7, this.blinkGlowAlpha * 0.15);
      this.glowGraphics.fillCircle(this.x, this.y, this.radius + 18);
    }

    // Wizard body
    this.graphics.clear();

    // Slow indicator — blue overlay behind wizard
    if (this.slowEffect && Date.now() < this.slowEffect.endTime) {
      this.graphics.fillStyle(0x88ddff, 0.25);
      this.graphics.fillCircle(this.x, this.y, this.radius + 4);
    }

    this.graphics.fillStyle(this.color, 1);
    this.graphics.fillCircle(this.x, this.y, this.radius);

    // Aura (drawn behind body)
    const aura = this.cosmetics.aura;
    if (aura !== 'none' && this.alive) {
      const auraColors = { flame: 0xff4400, frost: 0x88ddff, dark: 0x442266, holy: 0xffdd44, electric: 0xffff44, nature: 0x44aa22 };
      const ac = auraColors[aura] || 0xffffff;
      const pulse = 0.7 + Math.sin((this._sparkleTimer || 0) * 2) * 0.3;
      this.graphics.fillStyle(ac, 0.1 * pulse);
      this.graphics.fillCircle(this.x, this.y, this.radius + 12);
      this.graphics.fillStyle(ac, 0.06 * pulse);
      this.graphics.fillCircle(this.x, this.y, this.radius + 20);
    }

    // Hat
    const hat = this.cosmetics.hat;
    if (hat === 'classic') {
      this.graphics.fillStyle(this.color, 0.8);
      this.graphics.fillTriangle(this.x - 12, this.y - 12, this.x + 12, this.y - 12, this.x, this.y - 32);
    } else if (hat === 'crown') {
      this.graphics.fillStyle(0xffd700, 0.9);
      this.graphics.fillRect(this.x - 10, this.y - 22, 20, 8);
      this.graphics.fillTriangle(this.x - 10, this.y - 22, this.x - 6, this.y - 22, this.x - 8, this.y - 30);
      this.graphics.fillTriangle(this.x - 2, this.y - 22, this.x + 2, this.y - 22, this.x, this.y - 32);
      this.graphics.fillTriangle(this.x + 6, this.y - 22, this.x + 10, this.y - 22, this.x + 8, this.y - 30);
    } else if (hat === 'horns') {
      this.graphics.fillStyle(0xcc2222, 0.9);
      this.graphics.fillTriangle(this.x - 14, this.y - 8, this.x - 8, this.y - 10, this.x - 16, this.y - 28);
      this.graphics.fillTriangle(this.x + 14, this.y - 8, this.x + 8, this.y - 10, this.x + 16, this.y - 28);
    } else if (hat === 'halo') {
      this.graphics.lineStyle(2, 0xffdd44, 0.8);
      this.graphics.strokeEllipse(this.x, this.y - 24, 22, 8);
    } else if (hat === 'tophat') {
      this.graphics.fillStyle(0x222222, 0.9);
      this.graphics.fillRect(this.x - 10, this.y - 20, 20, 6);
      this.graphics.fillRect(this.x - 7, this.y - 34, 14, 14);
    } else if (hat === 'beanie') {
      this.graphics.fillStyle(0x4488cc, 0.9);
      this.graphics.fillCircle(this.x, this.y - 16, 12);
      this.graphics.fillStyle(0xffffff, 0.8);
      this.graphics.fillCircle(this.x, this.y - 28, 4);
    } else if (hat === 'antenna') {
      this.graphics.lineStyle(2, 0x888888, 0.9);
      this.graphics.lineBetween(this.x, this.y - 16, this.x, this.y - 34);
      this.graphics.fillStyle(0x44ff44, 0.9);
      this.graphics.fillCircle(this.x, this.y - 36, 4);
    } else if (hat === 'mohawk') {
      this.graphics.fillStyle(0xff2288, 0.9);
      for (let i = 0; i < 5; i++) {
        const mx = this.x - 6 + i * 3;
        this.graphics.fillTriangle(mx - 2, this.y - 14, mx + 2, this.y - 14, mx, this.y - 28 - i);
      }
    } else if (hat === 'cat_ears') {
      this.graphics.fillStyle(this.color, 0.9);
      this.graphics.fillTriangle(this.x - 14, this.y - 10, this.x - 6, this.y - 10, this.x - 10, this.y - 26);
      this.graphics.fillTriangle(this.x + 14, this.y - 10, this.x + 6, this.y - 10, this.x + 10, this.y - 26);
      this.graphics.fillStyle(0xffaaaa, 0.7);
      this.graphics.fillTriangle(this.x - 12, this.y - 12, this.x - 8, this.y - 12, this.x - 10, this.y - 22);
      this.graphics.fillTriangle(this.x + 12, this.y - 12, this.x + 8, this.y - 12, this.x + 10, this.y - 22);
    } else if (hat === 'pirate') {
      this.graphics.fillStyle(0x222222, 0.9);
      this.graphics.fillTriangle(this.x - 14, this.y - 14, this.x + 14, this.y - 14, this.x, this.y - 30);
      this.graphics.fillRect(this.x - 14, this.y - 16, 28, 4);
      this.graphics.fillStyle(0xffffff, 0.8);
      this.graphics.fillCircle(this.x, this.y - 20, 3);
    } else if (hat === 'chef') {
      this.graphics.fillStyle(0xeeeeee, 0.9);
      this.graphics.fillCircle(this.x, this.y - 24, 12);
      this.graphics.fillRect(this.x - 8, this.y - 18, 16, 6);
    }

    // Eyes
    const eyes = this.cosmetics.eyes;
    if (eyes === 'normal' || eyes === 'angry') {
      this.graphics.fillStyle(0xffffff, 1);
      this.graphics.fillCircle(this.x - 6, this.y - 3, 4);
      this.graphics.fillCircle(this.x + 6, this.y - 3, 4);
      this.graphics.fillStyle(0x000000, 1);
      this.graphics.fillCircle(this.x - 5, this.y - 3, 2);
      this.graphics.fillCircle(this.x + 7, this.y - 3, 2);
      if (eyes === 'angry') {
        this.graphics.lineStyle(2, this.color, 0.9);
        this.graphics.lineBetween(this.x - 10, this.y - 8, this.x - 2, this.y - 6);
        this.graphics.lineBetween(this.x + 10, this.y - 8, this.x + 2, this.y - 6);
      }
    } else if (eyes === 'cyclops') {
      this.graphics.fillStyle(0xffffff, 1);
      this.graphics.fillCircle(this.x, this.y - 3, 6);
      this.graphics.fillStyle(0x000000, 1);
      this.graphics.fillCircle(this.x + 1, this.y - 3, 3);
    } else if (eyes === 'closed') {
      this.graphics.lineStyle(2, 0x000000, 0.8);
      this.graphics.lineBetween(this.x - 9, this.y - 3, this.x - 3, this.y - 3);
      this.graphics.lineBetween(this.x + 3, this.y - 3, this.x + 9, this.y - 3);
    } else if (eyes === 'glowing') {
      this.graphics.fillStyle(this.color, 0.4);
      this.graphics.fillCircle(this.x - 6, this.y - 3, 6);
      this.graphics.fillCircle(this.x + 6, this.y - 3, 6);
      this.graphics.fillStyle(0xffffff, 1);
      this.graphics.fillCircle(this.x - 6, this.y - 3, 3);
      this.graphics.fillCircle(this.x + 6, this.y - 3, 3);
    } else if (eyes === 'x_eyes') {
      this.graphics.lineStyle(2, 0x000000, 0.9);
      this.graphics.lineBetween(this.x - 8, this.y - 5, this.x - 4, this.y - 1);
      this.graphics.lineBetween(this.x - 4, this.y - 5, this.x - 8, this.y - 1);
      this.graphics.lineBetween(this.x + 4, this.y - 5, this.x + 8, this.y - 1);
      this.graphics.lineBetween(this.x + 8, this.y - 5, this.x + 4, this.y - 1);
    } else if (eyes === 'hearts') {
      this.graphics.fillStyle(0xff4488, 1);
      this.graphics.fillCircle(this.x - 7, this.y - 4, 3);
      this.graphics.fillCircle(this.x - 5, this.y - 4, 3);
      this.graphics.fillTriangle(this.x - 9, this.y - 3, this.x - 3, this.y - 3, this.x - 6, this.y + 1);
      this.graphics.fillCircle(this.x + 5, this.y - 4, 3);
      this.graphics.fillCircle(this.x + 7, this.y - 4, 3);
      this.graphics.fillTriangle(this.x + 3, this.y - 3, this.x + 9, this.y - 3, this.x + 6, this.y + 1);
    } else if (eyes === 'tiny') {
      this.graphics.fillStyle(0x000000, 1);
      this.graphics.fillCircle(this.x - 5, this.y - 3, 1.5);
      this.graphics.fillCircle(this.x + 5, this.y - 3, 1.5);
    } else if (eyes === 'wide') {
      this.graphics.fillStyle(0xffffff, 1);
      this.graphics.fillCircle(this.x - 6, this.y - 3, 6);
      this.graphics.fillCircle(this.x + 6, this.y - 3, 6);
      this.graphics.fillStyle(0x000000, 1);
      this.graphics.fillCircle(this.x - 5, this.y - 3, 2.5);
      this.graphics.fillCircle(this.x + 7, this.y - 3, 2.5);
    }

    // Mouth
    const mouth = this.cosmetics.mouth;
    if (mouth === 'smile') {
      this.graphics.lineStyle(1.5, 0x000000, 0.7);
      this.graphics.beginPath();
      this.graphics.arc(this.x, this.y + 4, 5, 0.2, Math.PI - 0.2, false);
      this.graphics.strokePath();
    } else if (mouth === 'grin') {
      this.graphics.lineStyle(1.5, 0x000000, 0.7);
      this.graphics.beginPath();
      this.graphics.arc(this.x, this.y + 3, 6, 0.1, Math.PI - 0.1, false);
      this.graphics.strokePath();
      this.graphics.fillStyle(0xffffff, 0.6);
      this.graphics.fillRect(this.x - 4, this.y + 5, 8, 2);
    } else if (mouth === 'frown') {
      this.graphics.lineStyle(1.5, 0x000000, 0.7);
      this.graphics.beginPath();
      this.graphics.arc(this.x, this.y + 10, 5, Math.PI + 0.2, -0.2, false);
      this.graphics.strokePath();
    } else if (mouth === 'fangs') {
      this.graphics.fillStyle(0xffffff, 0.9);
      this.graphics.fillTriangle(this.x - 4, this.y + 4, this.x - 2, this.y + 4, this.x - 3, this.y + 9);
      this.graphics.fillTriangle(this.x + 2, this.y + 4, this.x + 4, this.y + 4, this.x + 3, this.y + 9);
    } else if (mouth === 'tongue') {
      this.graphics.lineStyle(1.5, 0x000000, 0.6);
      this.graphics.lineBetween(this.x - 4, this.y + 5, this.x + 4, this.y + 5);
      this.graphics.fillStyle(0xff6688, 0.8);
      this.graphics.fillCircle(this.x, this.y + 9, 3);
    } else if (mouth === 'mustache') {
      this.graphics.fillStyle(0x443322, 0.8);
      this.graphics.beginPath();
      this.graphics.arc(this.x - 4, this.y + 4, 5, Math.PI + 0.3, -0.3, false);
      this.graphics.strokePath();
      this.graphics.beginPath();
      this.graphics.arc(this.x + 4, this.y + 4, 5, Math.PI + 0.3, -0.3, false);
      this.graphics.strokePath();
    }

    // Cosmetic trail
    if (this.cosmetics.trail !== 'none' && this.alive) {
      this._trailPositions.push({ x: this.x, y: this.y });
      if (this._trailPositions.length > 5) this._trailPositions.shift();
      const trailColors = { fire: 0xff4400, ice: 0x88ddff, shadow: 0x333355, poison: 0x44ff22, electric: 0xffff44, blood: 0xcc0000, gold: 0xffd700, void: 0x6622cc };
      this._trailPositions.forEach((p, i) => {
        const a = (i / this._trailPositions.length) * 0.3;
        const s = (i / this._trailPositions.length) * this.radius * 0.6;
        if (this.cosmetics.trail === 'rainbow') {
          const hue = [0xff0000, 0xff8800, 0xffff00, 0x00ff00, 0x0088ff][i % 5];
          this.graphics.fillStyle(hue, a);
        } else {
          this.graphics.fillStyle(trailColors[this.cosmetics.trail] || 0xffffff, a);
        }
        this.graphics.fillCircle(p.x, p.y, s);
      });
    }

    // Name
    this.nameText.setPosition(this.x, this.y - this.radius - 24);

    // Health bar
    const barWidth = 40;
    const barHeight = 4;
    const barY = this.y - this.radius - 10;

    this.healthBarBg.clear();
    this.healthBarBg.fillStyle(0x333333, 1);
    this.healthBarBg.fillRect(this.x - barWidth / 2, barY, barWidth, barHeight);

    this.healthBar.clear();
    const healthPct = this.health / this.maxHealth;
    const healthColor = healthPct > 0.5 ? 0x66bb6a : healthPct > 0.25 ? 0xffa726 : 0xe94560;
    this.healthBar.fillStyle(healthColor, 1);
    this.healthBar.fillRect(this.x - barWidth / 2, barY, barWidth * healthPct, barHeight);

    // Secret sparkle effect
    if (this.sparkle && this.alive) {
      this._sparkleTimer += 0.15;
      const sparkleColors = [0xffff44, 0xff88ff, 0x44ffff, 0xffffff, 0x88ff44];
      for (let i = 0; i < 4; i++) {
        const angle = this._sparkleTimer * 2 + i * Math.PI / 2;
        const dist = this.radius + 6 + Math.sin(this._sparkleTimer * 3 + i) * 4;
        const sx = this.x + Math.cos(angle) * dist;
        const sy = this.y + Math.sin(angle) * dist;
        const col = sparkleColors[Math.floor((this._sparkleTimer + i) % sparkleColors.length)];
        this.graphics.fillStyle(col, 0.7 + Math.sin(this._sparkleTimer * 5 + i * 2) * 0.3);
        this.graphics.fillCircle(sx, sy, 2);
      }
    }

    // Fireball cooldown ring
    this.cooldownGraphics.clear();
    if (this.alive) {
      const readyPct = 1 - this.fireballCooldownPct; // 0 = just cast, 1 = ready

      if (readyPct < 1) {
        // Background ring (dark)
        this.cooldownGraphics.lineStyle(2, 0x333333, 0.3);
        this.cooldownGraphics.strokeCircle(this.x, this.y, COOLDOWN_RING_RADIUS);

        // Fill arc showing progress
        if (readyPct > 0) {
          this.cooldownGraphics.lineStyle(2, this.cooldownRingColor, 0.7);
          this.cooldownGraphics.beginPath();
          const startAngle = -Math.PI / 2;
          const endAngle = startAngle + readyPct * Math.PI * 2;
          this.cooldownGraphics.arc(this.x, this.y, COOLDOWN_RING_RADIUS, startAngle, endAngle, false);
          this.cooldownGraphics.strokePath();
        }
      }

      // Blink cooldown arc (below wizard)
      const blinkArcY = this.y + this.radius + 10;
      const blinkArcR = 8;
      const blinkReadyPct = 1 - this.blinkCooldownPct;

      if (this.blinkReady) {
        // Ready — bright dot
        this.cooldownGraphics.fillStyle(0x4fc3f7, 0.9);
        this.cooldownGraphics.fillCircle(this.x, blinkArcY, 3);
      } else {
        // On cooldown — arc indicator
        this.cooldownGraphics.lineStyle(1.5, 0x333333, 0.3);
        this.cooldownGraphics.strokeCircle(this.x, blinkArcY, blinkArcR);

        if (blinkReadyPct > 0) {
          this.cooldownGraphics.lineStyle(1.5, 0x4fc3f7, 0.7);
          this.cooldownGraphics.beginPath();
          const bStart = -Math.PI / 2;
          const bEnd = bStart + blinkReadyPct * Math.PI * 2;
          this.cooldownGraphics.arc(this.x, blinkArcY, blinkArcR, bStart, bEnd, false);
          this.cooldownGraphics.strokePath();
        }
      }
    }
  }

  setCooldowns(fireballPct, blinkReady, blinkPct) {
    this.fireballCooldownPct = fireballPct;
    this.blinkCooldownPct = blinkPct || 0;

    // Trigger glow pulse when blink transitions from not-ready to ready
    if (blinkReady && !this.blinkReady) {
      this.blinkGlowAlpha = 1;
    }
    this.blinkReady = blinkReady;
  }

  setInput(dirX, dirY) {
    this.inputDir.x = dirX;
    this.inputDir.y = dirY;
  }

  applyKnockback(velX, velY) {
    const damagePct = 1 - (this.health / this.maxHealth);
    const scale = 1 + damagePct * 2;
    const resist = 1 - Math.min(0.8, this.knockbackResist);
    const modMult = this._modKnockbackMult || 1;
    const dir = this._modReverseKB ? -1 : 1;
    this.knockbackVel.x += velX * scale * resist * modMult * dir;
    this.knockbackVel.y += velY * scale * resist * modMult * dir;
  }

  takeDamage(amount) {
    if (!this.alive) return;
    this.health = Math.max(0, this.health - amount);
    if (this.health <= 0) {
      this.alive = false;
      this.tethered = false; // release tether on death
      this.inGravity = false;
    }
  }

  applySlow(factor, durationMs) {
    this.slowEffect = {
      factor: Math.max(0.1, 1 - factor), // factor=0.5 means 50% speed
      endTime: Date.now() + durationMs,
    };
  }

  isSlowed() {
    return this.slowEffect && Date.now() < this.slowEffect.endTime;
  }

  update(delta) {
    if (!this.alive) {
      this.draw();
      return;
    }

    const dt = delta / 1000;
    let moveX = 0;
    let moveY = 0;

    // Decay blink glow (one-time flash only)
    if (this.blinkGlowAlpha > 0) {
      this.blinkGlowAlpha -= dt * 2; // fade over ~0.5s
      if (this.blinkGlowAlpha < 0) this.blinkGlowAlpha = 0;
    }

    // Clear expired slow
    if (this.slowEffect && Date.now() >= this.slowEffect.endTime) {
      this.slowEffect = null;
    }

    // Rush dash movement (overrides WASD while active)
    if (this.dashing) {
      const dashMove = this.dashSpeed * dt;
      if (dashMove >= this.dashRemaining) {
        // Finish dash this frame
        this.x += this.dashDir.x * this.dashRemaining;
        this.y += this.dashDir.y * this.dashRemaining;
        this.dashRemaining = 0;
        this.dashing = false;
      } else {
        this.x += this.dashDir.x * dashMove;
        this.y += this.dashDir.y * dashMove;
        this.dashRemaining -= dashMove;
      }
    } else if (!this.tethered) {
      // WASD movement (disabled while tethered, reduced by slow effect)
      const speedMult = this.slowEffect ? this.slowEffect.factor : 1;
      if (this.inputDir.x !== 0 || this.inputDir.y !== 0) {
        const len = Math.sqrt(this.inputDir.x ** 2 + this.inputDir.y ** 2) || 1;
        const totalSpeed = (WIZARD_SPEED + this.bonusSpeed) * speedMult;
        moveX = (this.inputDir.x / len) * totalSpeed * dt;
        moveY = (this.inputDir.y / len) * totalSpeed * dt;
      }
    }

    // Apply knockback
    this.x += this.knockbackVel.x * dt;
    this.y += this.knockbackVel.y * dt;

    // Apply friction — reduced/disabled by tether and gravity
    if (this.tethered) {
      // No friction at all while tethered
    } else if (this.inGravity) {
      // Reduced friction while in gravity pull (harder to escape)
      this.knockbackVel.x *= 0.995;
      this.knockbackVel.y *= 0.995;
    } else {
      const fric = this._modFrictionOverride || FRICTION;
      this.knockbackVel.x *= fric;
      this.knockbackVel.y *= fric;
      if (Math.abs(this.knockbackVel.x) < FRICTION_THRESHOLD) this.knockbackVel.x = 0;
      if (Math.abs(this.knockbackVel.y) < FRICTION_THRESHOLD) this.knockbackVel.y = 0;
    }
    // Reset gravity flag each frame (set by GravitySphere.applyPull)
    this.inGravity = false;

    // Apply movement
    this.x += moveX;
    this.y += moveY;

    this.draw();
  }

  serialize() {
    return {
      playerId: this.playerId,
      x: this.x,
      y: this.y,
      health: this.health,
      alive: this.alive,
      knockbackVel: { ...this.knockbackVel },
      dashing: this.dashing,
      dashDir: this.dashing ? { ...this.dashDir } : null,
      dashSpeed: this.dashing ? this.dashSpeed : 0,
      dashRemaining: this.dashing ? this.dashRemaining : 0,
    };
  }

  applyState(state) {
    // Smooth interpolation for position to avoid snapping
    const dx = state.x - this.x;
    const dy = state.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 200) {
      // Too far off — snap (teleport/blink happened)
      this.x = state.x;
      this.y = state.y;
    } else {
      // Lerp toward authoritative position
      this.x += dx * 0.3;
      this.y += dy * 0.3;
    }

    this.health = state.health;
    this.alive = state.alive;
    this.knockbackVel = { ...state.knockbackVel };

    // Sync dash state
    if (state.dashing && !this.dashing) {
      this.dashing = true;
      this.dashDir = state.dashDir ? { ...state.dashDir } : { x: 0, y: 0 };
      this.dashSpeed = state.dashSpeed || 0;
      this.dashRemaining = state.dashRemaining || 0;
    } else if (!state.dashing) {
      this.dashing = false;
    }
    this.draw();
  }

  destroy() {
    this.graphics.destroy();
    this.cooldownGraphics.destroy();
    this.glowGraphics.destroy();
    this.nameText.destroy();
    this.healthBar.destroy();
    this.healthBarBg.destroy();
  }
}
