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
  constructor(scene, x, y, playerId, playerName, colorIndex) {
    this.scene = scene;
    this.playerId = playerId;
    this.playerName = playerName;
    this.health = MAX_HEALTH;
    this.maxHealth = MAX_HEALTH;
    this.alive = true;
    this.color = WIZARD_COLORS[colorIndex % WIZARD_COLORS.length];

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

    // Hat (triangle on top)
    this.graphics.fillStyle(this.color, 0.8);
    this.graphics.fillTriangle(
      this.x - 12, this.y - 12,
      this.x + 12, this.y - 12,
      this.x, this.y - 32
    );

    // Eyes
    this.graphics.fillStyle(0xffffff, 1);
    this.graphics.fillCircle(this.x - 6, this.y - 3, 4);
    this.graphics.fillCircle(this.x + 6, this.y - 3, 4);
    this.graphics.fillStyle(0x000000, 1);
    this.graphics.fillCircle(this.x - 5, this.y - 3, 2);
    this.graphics.fillCircle(this.x + 7, this.y - 3, 2);

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
    // Smash Bros-style: knockback scales with damage taken (lower health = more knockback)
    const damagePct = 1 - (this.health / this.maxHealth); // 0 at full HP, 1 at 0 HP
    const scale = 1 + damagePct * 2; // 1x at full HP, up to 3x at low HP
    const resist = 1 - Math.min(0.8, this.knockbackResist); // max 80% reduction
    this.knockbackVel.x += velX * scale * resist;
    this.knockbackVel.y += velY * scale * resist;
  }

  takeDamage(amount) {
    if (!this.alive) return;
    this.health = Math.max(0, this.health - amount);
    if (this.health <= 0) {
      this.alive = false;
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
    } else {
      // WASD movement (reduced by slow effect)
      const speedMult = this.slowEffect ? this.slowEffect.factor : 1;
      if (this.inputDir.x !== 0 || this.inputDir.y !== 0) {
        const len = Math.sqrt(this.inputDir.x ** 2 + this.inputDir.y ** 2) || 1;
        moveX = (this.inputDir.x / len) * WIZARD_SPEED * speedMult * dt;
        moveY = (this.inputDir.y / len) * WIZARD_SPEED * speedMult * dt;
      }
    }

    // Apply knockback
    this.x += this.knockbackVel.x * dt;
    this.y += this.knockbackVel.y * dt;

    // Apply friction (skip if tethered — no friction during tether pull)
    if (!this.tethered) {
      this.knockbackVel.x *= FRICTION;
      this.knockbackVel.y *= FRICTION;
      if (Math.abs(this.knockbackVel.x) < FRICTION_THRESHOLD) this.knockbackVel.x = 0;
      if (Math.abs(this.knockbackVel.y) < FRICTION_THRESHOLD) this.knockbackVel.y = 0;
    }

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
