const LIFETIME = 3500;

export class IceShard {
  constructor(scene, x, y, dirX, dirY, ownerPlayerId, stats = {}) {
    this.scene = scene;
    this.spellId = 'ice_shard';
    this.ownerPlayerId = ownerPlayerId;
    this.x = x;
    this.y = y;
    this.alive = true;
    this.spawnTime = Date.now();

    const speed = stats.speed || 180;
    this.damage = stats.damage || 10;
    this.knockback = stats.knockback || 400;
    this.radius = stats.radius || 7;
    this.slowAmount = stats.slowAmount || 0.5;
    this.slowDuration = stats.slowDuration || 2000;
    this.lifesteal = stats.lifesteal || 0;
    this.hitTargets = new Set();

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

    this.trail.push({ x: this.x, y: this.y, alpha: 1 });
    if (this.trail.length > 10) this.trail.shift();

    if (Date.now() - this.spawnTime > LIFETIME) {
      this.alive = false;
    }

    this.draw();
  }

  draw() {
    this.graphics.clear();

    // Icy trail
    this.trail.forEach((p, i) => {
      const alpha = (i / this.trail.length) * 0.4;
      const size = (i / this.trail.length) * this.radius * 0.8;
      this.graphics.fillStyle(0x88ddff, alpha);
      this.graphics.fillCircle(p.x, p.y, size);
    });

    // Outer glow
    this.graphics.fillStyle(0x88ddff, 0.3);
    this.graphics.fillCircle(this.x, this.y, this.radius * 1.8);

    // Core — diamond shape
    const r = this.radius;
    const angle = Math.atan2(this.velY, this.velX);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    this.graphics.fillStyle(0x88ddff, 1);
    this.graphics.fillTriangle(
      this.x + cos * r * 1.5, this.y + sin * r * 1.5,
      this.x - sin * r * 0.6, this.y + cos * r * 0.6,
      this.x + sin * r * 0.6, this.y - cos * r * 0.6,
    );

    // Bright center
    this.graphics.fillStyle(0xccf0ff, 1);
    this.graphics.fillCircle(this.x, this.y, this.radius * 0.3);
  }

  checkHit(wizard) {
    if (!this.alive || !wizard.alive) return 0;
    if (wizard.playerId === this.ownerPlayerId) return 0;
    if (this.hitTargets.has(wizard.playerId)) return 0;

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

      // Apply slow effect
      wizard.applySlow(this.slowAmount, this.slowDuration);

      this.alive = false;
      return dealt;
    }
    return 0;
  }

  serialize() {
    return {
      spellId: 'ice_shard',
      x: this.x,
      y: this.y,
      velX: this.velX,
      velY: this.velY,
      ownerPlayerId: this.ownerPlayerId,
      alive: this.alive,
      damage: this.damage,
      knockback: this.knockback,
      radius: this.radius,
      slowAmount: this.slowAmount,
      slowDuration: this.slowDuration,
      lifesteal: this.lifesteal,
    };
  }

  destroy() {
    this.graphics.destroy();
  }
}
