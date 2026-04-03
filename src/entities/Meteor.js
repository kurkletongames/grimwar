const LIFETIME = 5000;

export class Meteor {
  constructor(scene, x, y, dirX, dirY, ownerPlayerId, stats = {}) {
    this.scene = scene;
    this.spellId = 'meteor';
    this.ownerPlayerId = ownerPlayerId;
    this.x = x;
    this.y = y;
    this.alive = true;
    this.spawnTime = Date.now();
    this.exploded = false;
    this.explosionTime = 0;

    const speed = stats.speed || 150;
    this.damage = stats.damage || 25;
    this.knockback = stats.knockback || 900;
    this.radius = stats.radius || 6;
    this.explosionRadius = stats.explosionRadius || 80;
    this.lifesteal = stats.lifesteal || 0;
    this.hitTargets = new Set();

    const len = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
    this.velX = (dirX / len) * speed;
    this.velY = (dirY / len) * speed;

    this.graphics = scene.add.graphics();
    this.explosionGraphics = scene.add.graphics();
    this.trail = [];
    this.draw();
  }

  update(delta) {
    if (!this.alive) return;

    if (this.exploded) {
      // Explosion visual fades out over 400ms
      const elapsed = Date.now() - this.explosionTime;
      if (elapsed > 400) {
        this.alive = false;
      }
      this._drawExplosion(1 - elapsed / 400);
      return;
    }

    const dt = delta / 1000;
    this.x += this.velX * dt;
    this.y += this.velY * dt;

    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > 8) this.trail.shift();

    // Lifetime — explode at end of life
    if (Date.now() - this.spawnTime > LIFETIME) {
      this.explode();
    }

    this.draw();
  }

  draw() {
    this.graphics.clear();
    if (this.exploded) return;

    // Smoke trail
    this.trail.forEach((p, i) => {
      const alpha = (i / this.trail.length) * 0.3;
      const size = (i / this.trail.length) * this.radius;
      this.graphics.fillStyle(0x555555, alpha);
      this.graphics.fillCircle(p.x, p.y, size * 1.5);
    });

    // Outer glow — molten
    this.graphics.fillStyle(0xcc2200, 0.4);
    this.graphics.fillCircle(this.x, this.y, this.radius * 2.5);

    // Core
    this.graphics.fillStyle(0xcc2200, 1);
    this.graphics.fillCircle(this.x, this.y, this.radius * 1.5);

    // Hot center
    this.graphics.fillStyle(0xff8800, 1);
    this.graphics.fillCircle(this.x, this.y, this.radius * 0.7);
  }

  _drawExplosion(alpha) {
    this.explosionGraphics.clear();
    if (alpha <= 0) return;

    // Shockwave ring
    this.explosionGraphics.lineStyle(3, 0xff6600, alpha * 0.8);
    this.explosionGraphics.strokeCircle(this.x, this.y, this.explosionRadius * (1.2 - alpha * 0.2));

    // Fire fill
    this.explosionGraphics.fillStyle(0xff4400, alpha * 0.3);
    this.explosionGraphics.fillCircle(this.x, this.y, this.explosionRadius * (1 - alpha * 0.3));

    // Bright center
    this.explosionGraphics.fillStyle(0xffaa00, alpha * 0.6);
    this.explosionGraphics.fillCircle(this.x, this.y, this.explosionRadius * 0.3);
  }

  /**
   * Trigger the AoE explosion. Called by GameScene when a hit is detected
   * or when the projectile reaches end of life.
   */
  explode() {
    if (this.exploded) return;
    this.exploded = true;
    this.explosionTime = Date.now();
    this.velX = 0;
    this.velY = 0;
    this.graphics.clear();
  }

  /**
   * Apply explosion damage to all wizards in radius.
   * Called by GameScene after explode() — returns array of { wizard, dealt } for lifesteal etc.
   */
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
        // Damage falls off with distance
        const falloff = 1 - Math.min(1, dist / this.explosionRadius);
        const dmg = Math.round(this.damage * (0.4 + 0.6 * falloff));

        const prevHealth = wizard.health;
        wizard.takeDamage(dmg);
        const dealt = prevHealth - wizard.health;

        // Knockback away from center
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

  /**
   * Standard projectile hit check — triggers explosion on contact.
   * Returns 0 because damage is applied via applyExplosionDamage.
   */
  checkHit(wizard) {
    if (!this.alive || this.exploded || !wizard.alive) return 0;
    if (wizard.playerId === this.ownerPlayerId) return 0;

    const dx = this.x - wizard.x;
    const dy = this.y - wizard.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < this.radius * 2 + wizard.radius) {
      this.explode();
      return -1; // signal to GameScene to call applyExplosionDamage
    }
    return 0;
  }

  serialize() {
    return {
      spellId: 'meteor',
      x: this.x,
      y: this.y,
      velX: this.velX,
      velY: this.velY,
      ownerPlayerId: this.ownerPlayerId,
      alive: this.alive,
      damage: this.damage,
      knockback: this.knockback,
      radius: this.radius,
      explosionRadius: this.explosionRadius,
      exploded: this.exploded,
      lifesteal: this.lifesteal,
      hitTargets: Array.from(this.hitTargets),
    };
  }

  destroy() {
    this.graphics.destroy();
    this.explosionGraphics.destroy();
  }
}
