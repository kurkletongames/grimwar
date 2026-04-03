export class Ricochet {
  constructor(scene, x, y, dirX, dirY, ownerPlayerId, stats = {}) {
    this.scene = scene;
    this.spellId = 'ricochet';
    this.ownerPlayerId = ownerPlayerId;
    this.x = x;
    this.y = y;
    this.alive = true;
    this.spawnTime = Date.now();

    const speed = stats.speed || 280;
    this.damage = stats.damage || 10;
    this.knockback = stats.knockback || 300;
    this.radius = stats.radius || 5;
    this.maxBounces = stats.maxBounces || 2;
    this.bounceRange = stats.bounceRange || 200;
    this.lifesteal = stats.lifesteal || 0;
    this.speed = speed;

    this.bouncesRemaining = this.maxBounces;
    this.lastHitId = null;
    this.needsRedirect = false;
    this.lastHitWizard = null;

    const len = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
    this.velX = (dirX / len) * speed;
    this.velY = (dirY / len) * speed;

    this.graphics = scene.add.graphics();
    this.trail = [];
    this.draw();
  }

  update(delta) {
    if (!this.alive) return;
    const dt = delta / 1000;

    this.x += this.velX * dt;
    this.y += this.velY * dt;

    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > 8) this.trail.shift();

    if (Date.now() - this.spawnTime > 4000) {
      this.alive = false;
    }

    this.draw();
  }

  draw() {
    this.graphics.clear();

    // Trail with bounce indicators
    this.trail.forEach((p, i) => {
      const alpha = (i / this.trail.length) * 0.4;
      const size = (i / this.trail.length) * this.radius * 0.8;
      this.graphics.fillStyle(0x88ff44, alpha);
      this.graphics.fillCircle(p.x, p.y, size);
    });

    // Glow
    this.graphics.fillStyle(0x88ff44, 0.3);
    this.graphics.fillCircle(this.x, this.y, this.radius * 1.8);

    // Core
    this.graphics.fillStyle(0x88ff44, 1);
    this.graphics.fillCircle(this.x, this.y, this.radius);

    // Bright center
    this.graphics.fillStyle(0xccff88, 1);
    this.graphics.fillCircle(this.x, this.y, this.radius * 0.4);
  }

  checkHit(wizard) {
    if (!this.alive || !wizard.alive) return 0;
    // Skip the caster for DAMAGE (but can bounce TO caster)
    if (wizard.playerId === this.ownerPlayerId) return 0;
    // Don't re-hit the same target immediately
    if (wizard.playerId === this.lastHitId) return 0;

    const dx = this.x - wizard.x;
    const dy = this.y - wizard.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < this.radius * 2 + wizard.radius) {
      const prevHealth = wizard.health;
      wizard.takeDamage(this.damage);
      const dealt = prevHealth - wizard.health;

      const dirLen = Math.sqrt(this.velX ** 2 + this.velY ** 2) || 1;
      wizard.applyKnockback(
        (this.velX / dirLen) * this.knockback,
        (this.velY / dirLen) * this.knockback,
      );

      this.lastHitId = wizard.playerId;
      this.lastHitWizard = wizard;

      if (this.bouncesRemaining > 0) {
        this.needsRedirect = true;
      } else {
        this.alive = false;
      }
      return dealt;
    }
    return 0;
  }

  /**
   * Called by GameScene after checkHit when needsRedirect is true.
   * Finds nearest target and redirects toward them.
   */
  redirectToNearest(wizards) {
    if (!this.needsRedirect) return;
    this.needsRedirect = false;
    this.bouncesRemaining--;

    let nearest = null;
    let nearestDist = Infinity;
    wizards.forEach((w) => {
      if (!w.alive) return;
      if (w.playerId === this.lastHitId) return; // don't bounce back to same target
      const dx = w.x - this.x;
      const dy = w.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < this.bounceRange && dist < nearestDist) {
        nearestDist = dist;
        nearest = w;
      }
    });

    if (nearest) {
      const dx = nearest.x - this.x;
      const dy = nearest.y - this.y;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      this.velX = (dx / len) * this.speed;
      this.velY = (dy / len) * this.speed;
    } else {
      this.alive = false;
    }
  }

  serialize() {
    return {
      spellId: 'ricochet',
      x: this.x, y: this.y,
      velX: this.velX, velY: this.velY,
      ownerPlayerId: this.ownerPlayerId,
      alive: this.alive,
      damage: this.damage, knockback: this.knockback,
      radius: this.radius, lifesteal: this.lifesteal,
      bouncesRemaining: this.bouncesRemaining,
      lastHitId: this.lastHitId,
    };
  }

  destroy() {
    this.graphics.destroy();
  }
}
