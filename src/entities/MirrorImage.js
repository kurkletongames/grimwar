import { WIZARD_COLORS } from './Wizard.js';

export class MirrorImage {
  constructor(scene, x, y, dirX, dirY, ownerPlayerId, stats = {}) {
    this.scene = scene;
    this.spellId = 'mirror_image';
    this.ownerPlayerId = ownerPlayerId;
    this.x = x;
    this.y = y;
    this.alive = true;
    this.spawnTime = Date.now();
    this.hasPulsed = false;

    this.decoySpeed = stats.decoySpeed || 150;
    this.decoyDuration = stats.decoyDuration || 3000;
    this.knockbackPulse = stats.knockbackPulse || 600;
    this.pulseRadius = stats.pulseRadius || 60;
    this.lifesteal = stats.lifesteal || 0;
    this.radius = 18; // same as wizard
    this.damage = 0;
    this.knockback = 0;

    const len = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
    this.velX = (dirX / len) * this.decoySpeed;
    this.velY = (dirY / len) * this.decoySpeed;

    // Get caster's color for visual matching
    this.casterColorIndex = stats._colorIndex ?? stats.casterColorIndex ?? 0;
    this.color = WIZARD_COLORS[this.casterColorIndex % WIZARD_COLORS.length];

    this.shimmerPhase = 0;
    this.graphics = scene.add.graphics();
    this.draw();
  }

  update(delta) {
    if (!this.alive) return;
    const dt = delta / 1000;

    this.x += this.velX * dt;
    this.y += this.velY * dt;
    this.shimmerPhase += dt * 4;

    // Expire and pulse
    if (Date.now() - this.spawnTime > this.decoyDuration) {
      if (!this.hasPulsed) {
        this.hasPulsed = true;
        // Signal GameScene to apply pulse
        this._pendingPulse = true;
      }
      this.alive = false;
    }

    this.draw();
  }

  draw() {
    this.graphics.clear();

    const shimmer = 0.4 + Math.sin(this.shimmerPhase) * 0.15;

    // Ghost glow
    this.graphics.fillStyle(this.color, shimmer * 0.3);
    this.graphics.fillCircle(this.x, this.y, this.radius + 6);

    // Body (semi-transparent wizard silhouette)
    this.graphics.fillStyle(this.color, shimmer);
    this.graphics.fillCircle(this.x, this.y, this.radius);

    // Hat
    this.graphics.fillStyle(this.color, shimmer * 0.8);
    this.graphics.fillTriangle(
      this.x - 12, this.y - 12,
      this.x + 12, this.y - 12,
      this.x, this.y - 32,
    );

    // Eyes
    this.graphics.fillStyle(0xffffff, shimmer);
    this.graphics.fillCircle(this.x - 6, this.y - 3, 3);
    this.graphics.fillCircle(this.x + 6, this.y - 3, 3);
  }

  /**
   * On contact with enemy wizard, pulse and die.
   */
  checkHit(wizard) {
    if (!this.alive || !wizard.alive || this.hasPulsed) return 0;
    if (wizard.playerId === this.ownerPlayerId) return 0;

    const dx = this.x - wizard.x;
    const dy = this.y - wizard.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < this.radius + wizard.radius) {
      this.hasPulsed = true;
      this._pendingPulse = true;
      this.alive = false;
      return -3; // signal to GameScene to call applyPulse
    }
    return 0;
  }

  /**
   * Apply knockback pulse to all enemies in range.
   * Called by GameScene.
   */
  applyPulse(wizards) {
    wizards.forEach((w) => {
      if (!w.alive || w.playerId === this.ownerPlayerId) return;
      const dx = w.x - this.x;
      const dy = w.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < this.pulseRadius) {
        const falloff = 1 - dist / this.pulseRadius;
        const nx = dist > 0 ? dx / dist : 0;
        const ny = dist > 0 ? dy / dist : -1;
        w.applyKnockback(nx * this.knockbackPulse * falloff, ny * this.knockbackPulse * falloff);
      }
    });
  }

  serialize() {
    return {
      spellId: 'mirror_image',
      x: this.x, y: this.y,
      velX: this.velX, velY: this.velY,
      ownerPlayerId: this.ownerPlayerId,
      alive: this.alive,
      lifesteal: this.lifesteal,
      decoySpeed: this.decoySpeed, decoyDuration: this.decoyDuration,
      knockbackPulse: this.knockbackPulse, pulseRadius: this.pulseRadius,
      casterColorIndex: this.casterColorIndex,
    };
  }

  destroy() {
    this.graphics.destroy();
  }
}
