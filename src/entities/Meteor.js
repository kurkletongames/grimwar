const LAND_DELAY = 600;   // ms before meteor lands after indicator appears
const ROLL_SPEED = 130;   // pixels/sec rolling speed after landing
const ROLL_LIFETIME = 3500; // ms the meteor rolls after landing

export class Meteor {
  constructor(scene, x, y, dirX, dirY, ownerPlayerId, stats = {}) {
    this.scene = scene;
    this.spellId = 'meteor';
    this.ownerPlayerId = ownerPlayerId;
    this.alive = true;
    this.spawnTime = Date.now();
    this.exploded = false;
    this.explosionTime = 0;

    this.damage = stats.damage || 25;
    this.knockback = stats.knockback || 900;
    this.radius = stats.radius || 28;
    this.explosionRadius = stats.explosionRadius || 100;
    this.lifesteal = stats.lifesteal || 0;
    this.hitTargets = new Set();

    // Phase: 'indicator' -> 'rolling' -> 'exploded'
    this.phase = 'indicator';
    this.landTime = Date.now() + LAND_DELAY;

    // Landing target: toward cursor, capped at max range
    const len = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
    const maxRange = 270;
    const landDist = Math.min(len, maxRange);
    this.landX = x + (dirX / len) * landDist;
    this.landY = y + (dirY / len) * landDist;

    // Position starts at landing target (indicator shows there)
    this.x = this.landX;
    this.y = this.landY;

    // Roll direction (same as cast direction)
    this.rollDirX = dirX / len;
    this.rollDirY = dirY / len;
    this.velX = 0;
    this.velY = 0;
    this.rollStartTime = 0;

    this.graphics = scene.add.graphics();
    this.explosionGraphics = scene.add.graphics();
    this.indicatorGraphics = scene.add.graphics();
    this.trail = [];
    this.draw();
  }

  update(delta) {
    if (!this.alive) return;
    const now = Date.now();

    if (this.phase === 'indicator') {
      // Waiting for landing
      if (now >= this.landTime) {
        this.phase = 'rolling';
        this.rollStartTime = now;
        this.velX = this.rollDirX * ROLL_SPEED;
        this.velY = this.rollDirY * ROLL_SPEED;
        this.indicatorGraphics.clear();
        // Landing impact — signal GameScene to apply AoE damage at landing spot
        this._landingImpact = true;
      }
      this.draw();
      return;
    }

    if (this.phase === 'exploded') {
      const elapsed = now - this.explosionTime;
      if (elapsed > 400) {
        this.alive = false;
      }
      this._drawExplosion(1 - elapsed / 400);
      return;
    }

    // Rolling phase
    const dt = delta / 1000;
    this.x += this.velX * dt;
    this.y += this.velY * dt;

    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > 6) this.trail.shift();

    if (now - this.rollStartTime > ROLL_LIFETIME) {
      this.explode();
    }

    this.draw();
  }

  draw() {
    this.graphics.clear();
    this.indicatorGraphics.clear();

    if (this.phase === 'indicator') {
      // Pulsing landing circle
      const elapsed = Date.now() - this.spawnTime;
      const pulse = 0.5 + Math.sin(elapsed * 0.01) * 0.3;
      const progress = Math.min(1, elapsed / LAND_DELAY);

      // AoE range circle
      this.indicatorGraphics.lineStyle(2, 0xcc2200, 0.3 + progress * 0.4);
      this.indicatorGraphics.strokeCircle(this.landX, this.landY, this.explosionRadius * pulse);

      // Fill
      this.indicatorGraphics.fillStyle(0xcc2200, 0.08 + progress * 0.12);
      this.indicatorGraphics.fillCircle(this.landX, this.landY, this.explosionRadius * pulse);

      // Center crosshair
      this.indicatorGraphics.lineStyle(1, 0xff4400, 0.5 + progress * 0.3);
      this.indicatorGraphics.strokeCircle(this.landX, this.landY, 5);

      // Shadow growing
      this.indicatorGraphics.fillStyle(0x000000, 0.15 * progress);
      this.indicatorGraphics.fillCircle(this.landX, this.landY, this.radius * (1 + progress));
      return;
    }

    if (this.phase === 'exploded') return;

    // Rolling meteor — massive boulder
    // Smoke/fire trail
    this.trail.forEach((p, i) => {
      const alpha = (i / this.trail.length) * 0.35;
      const size = (i / this.trail.length) * this.radius * 0.9;
      this.graphics.fillStyle(0x442200, alpha);
      this.graphics.fillCircle(p.x, p.y, size * 1.3);
      this.graphics.fillStyle(0xff4400, alpha * 0.5);
      this.graphics.fillCircle(p.x, p.y, size * 0.6);
    });

    // Heat glow (large)
    this.graphics.fillStyle(0xff2200, 0.15);
    this.graphics.fillCircle(this.x, this.y, this.radius * 2.2);

    // Outer molten ring
    this.graphics.fillStyle(0xcc2200, 0.4);
    this.graphics.fillCircle(this.x, this.y, this.radius * 1.4);

    // Core boulder
    this.graphics.fillStyle(0x881100, 1);
    this.graphics.fillCircle(this.x, this.y, this.radius);

    // Cracks/hot surface
    this.graphics.fillStyle(0xcc4400, 0.8);
    this.graphics.fillCircle(this.x - this.radius * 0.3, this.y - this.radius * 0.2, this.radius * 0.4);
    this.graphics.fillStyle(0xff6600, 0.9);
    this.graphics.fillCircle(this.x + this.radius * 0.2, this.y + this.radius * 0.15, this.radius * 0.3);

    // Hot center glow
    this.graphics.fillStyle(0xff8800, 1);
    this.graphics.fillCircle(this.x, this.y, this.radius * 0.35);

    // AoE range indicator (faint)
    this.graphics.lineStyle(1, 0xcc2200, 0.1);
    this.graphics.strokeCircle(this.x, this.y, this.explosionRadius);
  }

  _drawExplosion(alpha) {
    this.explosionGraphics.clear();
    if (alpha <= 0) return;

    // Massive shockwave ring
    this.explosionGraphics.lineStyle(5, 0xff6600, alpha * 0.9);
    this.explosionGraphics.strokeCircle(this.x, this.y, this.explosionRadius * (1.3 - alpha * 0.3));

    // Inner shockwave
    this.explosionGraphics.lineStyle(3, 0xffaa00, alpha * 0.6);
    this.explosionGraphics.strokeCircle(this.x, this.y, this.explosionRadius * 0.6 * (1.2 - alpha * 0.2));

    // Fire fill
    this.explosionGraphics.fillStyle(0xff4400, alpha * 0.35);
    this.explosionGraphics.fillCircle(this.x, this.y, this.explosionRadius * (1 - alpha * 0.3));

    this.explosionGraphics.fillStyle(0xffaa00, alpha * 0.6);
    this.explosionGraphics.fillCircle(this.x, this.y, this.explosionRadius * 0.3);
  }

  explode() {
    if (this.exploded) return;
    this.phase = 'exploded';
    this.exploded = true;
    this.explosionTime = Date.now();
    this.velX = 0;
    this.velY = 0;
    this.graphics.clear();
  }

  applyExplosionDamage(wizards) {
    const hits = [];
    wizards.forEach((wizard) => {
      if (!wizard.alive) return;
      if (wizard.playerId === this.ownerPlayerId) return;
      if (this.hitTargets.has(wizard.playerId)) return;

      const dx = this.x - wizard.x;
      const dy = this.y - wizard.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < this.explosionRadius + wizard.radius) {
        this.hitTargets.add(wizard.playerId);
        const falloff = 1 - Math.min(1, dist / this.explosionRadius);
        const dmg = Math.round(this.damage * (0.4 + 0.6 * falloff));

        const prevHealth = wizard.health;
        wizard.takeDamage(dmg);
        const dealt = prevHealth - wizard.health;

        const kbDir = dist > 0 ? { x: -dx / dist, y: -dy / dist } : { x: 0, y: -1 };
        wizard.applyKnockback(
          kbDir.x * this.knockback * falloff,
          kbDir.y * this.knockback * falloff,
        );

        hits.push({ wizard, dealt });
      }
    });
    return hits;
  }

  checkHit(wizard) {
    if (!this.alive || this.exploded || !wizard.alive) return 0;
    if (this.phase === 'indicator') return 0; // can't hit during indicator
    if (wizard.playerId === this.ownerPlayerId) return 0;

    const dx = this.x - wizard.x;
    const dy = this.y - wizard.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < this.radius * 2 + wizard.radius) {
      this.explode();
      return -1;
    }
    return 0;
  }

  serialize() {
    return {
      spellId: 'meteor',
      x: this.x, y: this.y,
      velX: this.velX, velY: this.velY,
      ownerPlayerId: this.ownerPlayerId,
      alive: this.alive,
      damage: this.damage, knockback: this.knockback,
      radius: this.radius, explosionRadius: this.explosionRadius,
      exploded: this.exploded, phase: this.phase,
      landX: this.landX, landY: this.landY,
      rollDirX: this.rollDirX, rollDirY: this.rollDirY,
      landTime: this.landTime, rollStartTime: this.rollStartTime,
      lifesteal: this.lifesteal,
      hitTargets: Array.from(this.hitTargets),
    };
  }

  destroy() {
    this.graphics.destroy();
    this.explosionGraphics.destroy();
    this.indicatorGraphics.destroy();
  }
}
