export class HomingMissile {
  constructor(scene, x, y, dirX, dirY, ownerPlayerId, stats = {}) {
    this.scene = scene;
    this.spellId = 'homing_missile';
    this.ownerPlayerId = ownerPlayerId;
    this.x = x;
    this.y = y;
    this.alive = true;
    this.spawnTime = Date.now();

    const speed = stats.speed || 200;
    this.damage = stats.damage || 12;
    this.knockback = stats.knockback || 500;
    this.radius = stats.radius || 6;
    this.turnRate = stats.turnRate || 0.8;
    this.lifetime = stats.lifetime || 4000;
    this.lifesteal = stats.lifesteal || 0;
    this.speed = speed;

    const len = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
    this.angle = Math.atan2(dirY / len, dirX / len);
    this.velX = Math.cos(this.angle) * speed;
    this.velY = Math.sin(this.angle) * speed;

    this.targetWizards = null; // set by GameScene each frame

    this.graphics = scene.add.graphics();
    this.trail = [];
    this.draw();
  }

  setTargets(wizards) {
    this.targetWizards = wizards;
  }

  update(delta) {
    if (!this.alive) return;
    const dt = delta / 1000;

    // Find nearest enemy
    if (this.targetWizards) {
      let nearest = null;
      let nearestDist = Infinity;
      this.targetWizards.forEach((w) => {
        if (w.playerId === this.ownerPlayerId || !w.alive) return;
        const dx = w.x - this.x;
        const dy = w.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < nearestDist) { nearestDist = dist; nearest = w; }
      });

      if (nearest) {
        const targetAngle = Math.atan2(nearest.y - this.y, nearest.x - this.x);
        let angleDiff = targetAngle - this.angle;
        // Normalize to [-PI, PI]
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

        const maxTurn = this.turnRate * dt;
        if (Math.abs(angleDiff) < maxTurn) {
          this.angle = targetAngle;
        } else {
          this.angle += Math.sign(angleDiff) * maxTurn;
        }
      }
    }

    this.velX = Math.cos(this.angle) * this.speed;
    this.velY = Math.sin(this.angle) * this.speed;
    this.x += this.velX * dt;
    this.y += this.velY * dt;

    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > 5) this.trail.shift();

    if (Date.now() - this.spawnTime > this.lifetime) {
      this.alive = false;
    }

    this.draw();
  }

  draw() {
    this.graphics.clear();

    // Curved trail
    this.trail.forEach((p, i) => {
      const alpha = (i / this.trail.length) * 0.4;
      const size = (i / this.trail.length) * this.radius * 0.7;
      this.graphics.fillStyle(0x44ccff, alpha);
      this.graphics.fillCircle(p.x, p.y, size);
    });

    // Glow
    this.graphics.fillStyle(0x44ccff, 0.3);
    this.graphics.fillCircle(this.x, this.y, this.radius * 2);

    // Arrow shape pointing in travel direction
    const cos = Math.cos(this.angle);
    const sin = Math.sin(this.angle);
    const r = this.radius;

    this.graphics.fillStyle(0x44ccff, 1);
    this.graphics.fillTriangle(
      this.x + cos * r * 1.8, this.y + sin * r * 1.8,
      this.x - cos * r + sin * r, this.y - sin * r - cos * r,
      this.x - cos * r - sin * r, this.y - sin * r + cos * r,
    );

    // Bright center
    this.graphics.fillStyle(0xaaeeff, 1);
    this.graphics.fillCircle(this.x, this.y, this.radius * 0.3);
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
      spellId: 'homing_missile',
      x: this.x, y: this.y,
      velX: this.velX, velY: this.velY,
      angle: this.angle,
      ownerPlayerId: this.ownerPlayerId,
      alive: this.alive,
      damage: this.damage, knockback: this.knockback,
      radius: this.radius, lifesteal: this.lifesteal,
      turnRate: this.turnRate, speed: this.speed,
      lifetime: this.lifetime,
    };
  }

  destroy() {
    this.graphics.destroy();
  }
}
