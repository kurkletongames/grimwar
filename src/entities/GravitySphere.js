const WELL_DPS_PCT = 0.01; // 1% max HP per second drain while in pull radius

export class GravitySphere {
  constructor(scene, x, y, dirX, dirY, ownerPlayerId, stats = {}) {
    this.scene = scene;
    this.spellId = 'gravity_sphere';
    this.ownerPlayerId = ownerPlayerId;
    this.x = x;
    this.y = y;
    this.alive = true;
    this.spawnTime = Date.now();

    const speed = stats.speed || 120;
    this.damage = stats.damage || 5;
    this.radius = stats.radius || 8;
    this.pullStrength = stats.pullStrength || 140;
    this.pullRadius = stats.pullRadius || 110;
    this.lifetime = stats.lifetime || 6000;
    this.lifesteal = stats.lifesteal || 0;
    this.speed = speed;

    const len = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
    this.velX = (dirX / len) * speed;
    this.velY = (dirY / len) * speed;

    this.graphics = scene.add.graphics();
    this.trail = [];
    this.pulsePhase = 0;
    this.draw();
  }

  update(delta) {
    if (!this.alive) return;
    const dt = delta / 1000;

    this.x += this.velX * dt;
    this.y += this.velY * dt;
    this.pulsePhase += dt * 3;

    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > 5) this.trail.shift();

    if (Date.now() - this.spawnTime > this.lifetime) {
      this.alive = false;
    }

    this.draw();
  }

  draw() {
    this.graphics.clear();
    const elapsed = Date.now() - this.spawnTime;
    const lifePct = Math.max(0, 1 - elapsed / this.lifetime);
    const pulse = 0.85 + Math.sin(this.pulsePhase) * 0.15;

    // Trail
    this.trail.forEach((p, i) => {
      const alpha = (i / this.trail.length) * 0.2 * lifePct;
      const size = (i / this.trail.length) * this.radius * 0.6;
      this.graphics.fillStyle(0x9944ff, alpha);
      this.graphics.fillCircle(p.x, p.y, size);
    });

    // Pull radius AoE fill
    this.graphics.fillStyle(0x6622cc, 0.1 * lifePct);
    this.graphics.fillCircle(this.x, this.y, this.pullRadius * pulse);

    // Outer ring
    this.graphics.lineStyle(2, 0x9944ff, 0.35 * lifePct);
    this.graphics.strokeCircle(this.x, this.y, this.pullRadius * pulse);

    // Mid ring
    this.graphics.lineStyle(1.5, 0x9944ff, 0.25 * lifePct);
    this.graphics.strokeCircle(this.x, this.y, this.pullRadius * 0.6 * pulse);

    // Swirl lines (2 instead of 4 for performance)
    for (let i = 0; i < 2; i++) {
      const angle = this.pulsePhase * 0.8 + i * Math.PI;
      const outerR = this.pullRadius * 0.7 * pulse;
      const innerR = this.pullRadius * 0.2;
      this.graphics.lineStyle(1, 0x9944ff, 0.2 * lifePct);
      this.graphics.beginPath();
      this.graphics.moveTo(
        this.x + Math.cos(angle) * outerR,
        this.y + Math.sin(angle) * outerR,
      );
      this.graphics.lineTo(
        this.x + Math.cos(angle + 0.5) * innerR,
        this.y + Math.sin(angle + 0.5) * innerR,
      );
      this.graphics.strokePath();
    }

    // Core
    this.graphics.fillStyle(0x9944ff, 0.8 * lifePct);
    this.graphics.fillCircle(this.x, this.y, 6);

    // Bright center
    this.graphics.fillStyle(0xcc88ff, lifePct);
    this.graphics.fillCircle(this.x, this.y, 3);
  }

  checkHit() {
    return 0;
  }

  applyPull(wizards, delta) {
    if (!this.alive) return;
    const dt = delta / 1000;

    wizards.forEach((wizard) => {
      if (!wizard.alive) return;
      if (wizard.playerId === this.ownerPlayerId) return;

      const dx = this.x - wizard.x;
      const dy = this.y - wizard.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < this.pullRadius && dist > 5) {
        const factor = (1 - dist / this.pullRadius);
        const nx = dx / dist;
        const ny = dy / dist;

        // Mark wizard as in gravity (reduces friction in Wizard.update)
        wizard.inGravity = true;

        // Apply/refresh Vulnerable — persists 2s after leaving radius
        wizard.applyVulnerable(2000);

        // Strong pull — apply directly to knockback velocity
        const pullForce = this.pullStrength * (0.3 + factor * 0.7) * dt;
        wizard.knockbackVel.x += nx * pullForce;
        wizard.knockbackVel.y += ny * pullForce;

        // Also nudge position directly for an inescapable feel
        const directPull = this.pullStrength * 0.15 * factor * dt;
        wizard.x += nx * directPull;
        wizard.y += ny * directPull;

        // HP drain
        const drain = wizard.maxHealth * WELL_DPS_PCT * dt;
        wizard.takeDamage(drain);
      }
    });
  }

  serialize() {
    return {
      spellId: 'gravity_sphere',
      x: this.x, y: this.y,
      velX: this.velX, velY: this.velY,
      ownerPlayerId: this.ownerPlayerId,
      alive: this.alive,
      damage: this.damage, radius: this.radius,
      pullStrength: this.pullStrength,
      pullRadius: this.pullRadius,
      lifetime: this.lifetime,
      lifesteal: this.lifesteal,
      speed: this.speed,
    };
  }

  destroy() {
    this.graphics.destroy();
  }
}
