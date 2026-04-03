const LIFETIME = 2000;

export class LightningBolt {
  constructor(scene, x, y, dirX, dirY, ownerPlayerId, stats = {}) {
    this.scene = scene;
    this.spellId = 'lightning_bolt';
    this.ownerPlayerId = ownerPlayerId;
    this.x = x;
    this.y = y;
    this.alive = true;
    this.spawnTime = Date.now();

    const speed = stats.speed || 500;
    this.damage = stats.damage || 8;
    this.knockback = stats.knockback || 300;
    this.radius = stats.radius || 5;
    this.lifesteal = stats.lifesteal || 0;
    this.hitTargets = new Set();

    const len = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
    this.velX = (dirX / len) * speed;
    this.velY = (dirY / len) * speed;

    this.graphics = scene.add.graphics();
    this.trail = [];
    this.flickerOffset = 0;
    this.draw();
  }

  update(delta) {
    if (!this.alive) return;

    const dt = delta / 1000;
    this.x += this.velX * dt;
    this.y += this.velY * dt;

    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > 8) this.trail.shift();

    this.flickerOffset = (Math.random() - 0.5) * 4;

    if (Date.now() - this.spawnTime > LIFETIME) {
      this.alive = false;
    }

    this.draw();
  }

  draw() {
    this.graphics.clear();

    // Electric trail — jagged line segments
    if (this.trail.length > 1) {
      this.graphics.lineStyle(2, 0xffff44, 0.5);
      this.graphics.beginPath();
      this.trail.forEach((p, i) => {
        const jitter = (Math.random() - 0.5) * 6;
        const px = p.x + jitter;
        const py = p.y + jitter;
        if (i === 0) this.graphics.moveTo(px, py);
        else this.graphics.lineTo(px, py);
      });
      this.graphics.strokePath();
    }

    // Outer glow
    this.graphics.fillStyle(0xffff88, 0.3);
    this.graphics.fillCircle(this.x + this.flickerOffset, this.y + this.flickerOffset, this.radius * 2);

    // Core bolt
    this.graphics.fillStyle(0xffff44, 1);
    this.graphics.fillCircle(this.x, this.y, this.radius);

    // Bright center
    this.graphics.fillStyle(0xffffff, 1);
    this.graphics.fillCircle(this.x, this.y, this.radius * 0.4);
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

      this.alive = false;
      return dealt;
    }
    return 0;
  }

  serialize() {
    return {
      spellId: 'lightning_bolt',
      x: this.x,
      y: this.y,
      velX: this.velX,
      velY: this.velY,
      ownerPlayerId: this.ownerPlayerId,
      alive: this.alive,
      damage: this.damage,
      knockback: this.knockback,
      radius: this.radius,
      lifesteal: this.lifesteal,
    };
  }

  destroy() {
    this.graphics.destroy();
  }
}
