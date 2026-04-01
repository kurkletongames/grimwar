const BASE_FIREBALL_SPEED = 250;
const BASE_FIREBALL_RADIUS = 8;
const BASE_FIREBALL_DAMAGE = 15;
const BASE_FIREBALL_KNOCKBACK = 700;
const FIREBALL_LIFETIME = 4000; // ms
const FIREBALL_COOLDOWN = 2500; // ms

export { FIREBALL_COOLDOWN, BASE_FIREBALL_SPEED, BASE_FIREBALL_DAMAGE, BASE_FIREBALL_KNOCKBACK };

export class Fireball {
  constructor(scene, x, y, dirX, dirY, ownerPlayerId, stats = {}) {
    this.scene = scene;
    this.ownerPlayerId = ownerPlayerId;
    this.x = x;
    this.y = y;
    this.alive = true;
    this.spawnTime = Date.now();

    const speed = stats.speed || BASE_FIREBALL_SPEED;
    this.damage = stats.damage || BASE_FIREBALL_DAMAGE;
    this.knockback = stats.knockback || BASE_FIREBALL_KNOCKBACK;
    this.radius = stats.radius || BASE_FIREBALL_RADIUS;
    this.piercing = stats.piercing || false;
    this.lifesteal = stats.lifesteal || 0;
    this.hitTargets = new Set(); // track already-hit wizards for piercing

    // Normalize direction
    const len = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
    this.velX = (dirX / len) * speed;
    this.velY = (dirY / len) * speed;

    // Graphics
    this.graphics = scene.add.graphics();

    // Particle trail
    this.trail = [];
    this.draw();
  }

  update(delta) {
    if (!this.alive) return;

    const dt = delta / 1000;
    this.x += this.velX * dt;
    this.y += this.velY * dt;

    // Add trail particle
    this.trail.push({ x: this.x, y: this.y, alpha: 1 });
    if (this.trail.length > 12) this.trail.shift();

    // Lifetime check
    if (Date.now() - this.spawnTime > FIREBALL_LIFETIME) {
      this.alive = false;
    }

    this.draw();
  }

  draw() {
    this.graphics.clear();

    // Trail
    this.trail.forEach((p, i) => {
      const alpha = (i / this.trail.length) * 0.5;
      const size = (i / this.trail.length) * this.radius;
      this.graphics.fillStyle(0xff6600, alpha);
      this.graphics.fillCircle(p.x, p.y, size);
    });

    // Main fireball - outer glow
    this.graphics.fillStyle(0xff4400, 0.4);
    this.graphics.fillCircle(this.x, this.y, this.radius * 2);

    // Core
    this.graphics.fillStyle(0xff6600, 1);
    this.graphics.fillCircle(this.x, this.y, this.radius);

    // Bright center
    this.graphics.fillStyle(0xffaa00, 1);
    this.graphics.fillCircle(this.x, this.y, this.radius * 0.5);
  }

  /**
   * Check collision with a wizard. Returns damage dealt (0 if no hit) for lifesteal.
   */
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
      const knockX = (this.velX / dirLen) * this.knockback;
      const knockY = (this.velY / dirLen) * this.knockback;
      wizard.applyKnockback(knockX, knockY);

      if (this.piercing) {
        this.hitTargets.add(wizard.playerId);
      } else {
        this.alive = false;
      }
      return dealt;
    }
    return 0;
  }

  serialize() {
    return {
      x: this.x,
      y: this.y,
      velX: this.velX,
      velY: this.velY,
      ownerPlayerId: this.ownerPlayerId,
      alive: this.alive,
      damage: this.damage,
      knockback: this.knockback,
      radius: this.radius,
      piercing: this.piercing,
    };
  }

  destroy() {
    this.graphics.destroy();
  }
}
