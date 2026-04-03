export class SwapProjectile {
  constructor(scene, x, y, dirX, dirY, ownerPlayerId, stats = {}) {
    this.scene = scene;
    this.spellId = 'swap_projectile';
    this.ownerPlayerId = ownerPlayerId;
    this.x = x;
    this.y = y;
    this.alive = true;
    this.spawnTime = Date.now();
    this.swapped = false;

    const speed = stats.projectileSpeed || 350;
    this.radius = stats.projectileRadius || 6;
    this.lifetime = stats.projectileLifetime || 2000;
    this.damage = 0;
    this.knockback = 0;
    this.lifesteal = 0;

    const len = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
    this.velX = (dirX / len) * speed;
    this.velY = (dirY / len) * speed;

    this.orbitAngle = 0;
    this.graphics = scene.add.graphics();
    this.trail = [];
    this.draw();
  }

  update(delta) {
    if (!this.alive) return;
    const dt = delta / 1000;

    this.x += this.velX * dt;
    this.y += this.velY * dt;
    this.orbitAngle += dt * 8;

    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > 6) this.trail.shift();

    if (Date.now() - this.spawnTime > this.lifetime) {
      this.alive = false;
    }

    this.draw();
  }

  draw() {
    this.graphics.clear();

    // Trail
    this.trail.forEach((p, i) => {
      const alpha = (i / this.trail.length) * 0.3;
      this.graphics.fillStyle(0xcc44ff, alpha);
      this.graphics.fillCircle(p.x, p.y, this.radius * 0.5);
    });

    // Glow
    this.graphics.fillStyle(0xcc44ff, 0.25);
    this.graphics.fillCircle(this.x, this.y, this.radius * 2.5);

    // Core
    this.graphics.fillStyle(0xcc44ff, 1);
    this.graphics.fillCircle(this.x, this.y, this.radius);

    // Orbiting dot (swap indicator)
    const orbitR = this.radius * 2;
    const ox = this.x + Math.cos(this.orbitAngle) * orbitR;
    const oy = this.y + Math.sin(this.orbitAngle) * orbitR;
    this.graphics.fillStyle(0xff88ff, 0.8);
    this.graphics.fillCircle(ox, oy, 2);
  }

  /**
   * On hit: swap caster and target positions.
   * Returns -4 to signal GameScene to perform the swap.
   */
  checkHit(wizard) {
    if (!this.alive || !wizard.alive || this.swapped) return 0;
    if (wizard.playerId === this.ownerPlayerId) return 0;

    const dx = this.x - wizard.x;
    const dy = this.y - wizard.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < this.radius * 2 + wizard.radius) {
      this.swapped = true;
      this.targetPlayerId = wizard.playerId;
      this.alive = false;
      return -4; // signal swap
    }
    return 0;
  }

  serialize() {
    return {
      spellId: 'swap_projectile',
      x: this.x, y: this.y,
      velX: this.velX, velY: this.velY,
      ownerPlayerId: this.ownerPlayerId,
      alive: this.alive,
      radius: this.radius, lifesteal: 0,
      targetPlayerId: this.targetPlayerId,
    };
  }

  destroy() {
    this.graphics.destroy();
  }
}
