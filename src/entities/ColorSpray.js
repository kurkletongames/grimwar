/**
 * A single particle from the Color Spray spell.
 * Multiple of these are spawned in a cone by _spawnProjectile.
 */
const COLORS = [0xff44ff, 0xff88ff, 0xcc44ff];

export class ColorSprayParticle {
  constructor(scene, x, y, dirX, dirY, ownerPlayerId, stats = {}) {
    this.scene = scene;
    this.spellId = 'color_spray';
    this.ownerPlayerId = ownerPlayerId;
    this.x = x;
    this.y = y;
    this.alive = true;
    this.spawnTime = Date.now();

    const speed = stats.speed || 300;
    this.damage = stats.damage || 4;
    this.knockback = stats.knockback || 200;
    this.radius = stats.radius || 4;
    this.lifetime = stats.lifetime || 600;
    this.lifesteal = stats.lifesteal || 0;

    // Pick a random color variant
    this.color = COLORS[Math.floor(Math.random() * COLORS.length)];

    const len = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
    // Add slight random speed variation
    const speedVar = speed * (0.85 + Math.random() * 0.3);
    this.velX = (dirX / len) * speedVar;
    this.velY = (dirY / len) * speedVar;

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
    if (this.trail.length > 4) this.trail.shift();

    if (Date.now() - this.spawnTime > this.lifetime) {
      this.alive = false;
    }

    this.draw();
  }

  draw() {
    this.graphics.clear();

    // Short trail
    this.trail.forEach((p, i) => {
      const alpha = (i / this.trail.length) * 0.3;
      this.graphics.fillStyle(this.color, alpha);
      this.graphics.fillCircle(p.x, p.y, this.radius * 0.5);
    });

    // Glow
    this.graphics.fillStyle(this.color, 0.3);
    this.graphics.fillCircle(this.x, this.y, this.radius * 1.5);

    // Core
    this.graphics.fillStyle(this.color, 1);
    this.graphics.fillCircle(this.x, this.y, this.radius);
  }

  checkHit(wizard) {
    if (!this.alive || !wizard.alive) return 0;
    if (wizard.playerId === this.ownerPlayerId) return 0;

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

      this.alive = false;
      return dealt;
    }
    return 0;
  }

  serialize() {
    return {
      spellId: 'color_spray',
      x: this.x, y: this.y,
      velX: this.velX, velY: this.velY,
      ownerPlayerId: this.ownerPlayerId,
      alive: this.alive,
      damage: this.damage, knockback: this.knockback,
      radius: this.radius, lifesteal: this.lifesteal,
    };
  }

  destroy() {
    this.graphics.destroy();
  }
}
