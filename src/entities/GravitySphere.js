const TRAVEL_LIFETIME = 3000;
const WELL_DPS_PCT = 0.04; // 4% max HP per second drain while in pull radius

export class GravitySphere {
  constructor(scene, x, y, dirX, dirY, ownerPlayerId, stats = {}) {
    this.scene = scene;
    this.spellId = 'gravity_sphere';
    this.ownerPlayerId = ownerPlayerId;
    this.x = x;
    this.y = y;
    this.alive = true;
    this.spawnTime = Date.now();

    this.phase = 'travel'; // 'travel' or 'well'
    this.wellStartTime = 0;

    const speed = stats.speed || 200;
    this.damage = stats.damage || 5;
    this.radius = stats.radius || 8;
    this.pullStrength = stats.pullStrength || 120;
    this.pullRadius = stats.pullRadius || 100;
    this.wellDuration = stats.wellDuration || 3000;
    this.lifesteal = stats.lifesteal || 0;
    this.hitTargets = new Set();

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

    if (this.phase === 'travel') {
      this.x += this.velX * dt;
      this.y += this.velY * dt;

      this.trail.push({ x: this.x, y: this.y });
      if (this.trail.length > 8) this.trail.shift();

      if (Date.now() - this.spawnTime > TRAVEL_LIFETIME) {
        this._becomeWell();
      }
    } else {
      // Well phase
      this.pulsePhase += dt * 3;
      if (Date.now() - this.wellStartTime > this.wellDuration) {
        this.alive = false;
      }
    }

    this.draw();
  }

  _becomeWell() {
    this.phase = 'well';
    this.wellStartTime = Date.now();
    this.velX = 0;
    this.velY = 0;
    this.trail = [];
  }

  draw() {
    this.graphics.clear();

    if (this.phase === 'travel') {
      // Trail
      this.trail.forEach((p, i) => {
        const alpha = (i / this.trail.length) * 0.3;
        const size = (i / this.trail.length) * this.radius * 0.7;
        this.graphics.fillStyle(0x9944ff, alpha);
        this.graphics.fillCircle(p.x, p.y, size);
      });

      // AoE range indicator (faint circle showing pull radius)
      this.graphics.lineStyle(1, 0x9944ff, 0.12);
      this.graphics.strokeCircle(this.x, this.y, this.pullRadius);

      // Outer glow
      this.graphics.fillStyle(0x9944ff, 0.3);
      this.graphics.fillCircle(this.x, this.y, this.radius * 2);

      // Core
      this.graphics.fillStyle(0x9944ff, 1);
      this.graphics.fillCircle(this.x, this.y, this.radius);

      // Bright center
      this.graphics.fillStyle(0xcc88ff, 1);
      this.graphics.fillCircle(this.x, this.y, this.radius * 0.4);
    } else {
      // Well phase — pulsing gravity field
      const elapsed = Date.now() - this.wellStartTime;
      const lifePct = Math.max(0, 1 - elapsed / this.wellDuration);
      const pulse = 0.85 + Math.sin(this.pulsePhase) * 0.15;

      // Outer pull radius — the main AoE circle
      this.graphics.fillStyle(0x6622cc, 0.1 * lifePct);
      this.graphics.fillCircle(this.x, this.y, this.pullRadius * pulse);

      // Outer ring
      this.graphics.lineStyle(2, 0x9944ff, 0.35 * lifePct);
      this.graphics.strokeCircle(this.x, this.y, this.pullRadius * pulse);

      // Mid ring
      this.graphics.lineStyle(1.5, 0x9944ff, 0.25 * lifePct);
      this.graphics.strokeCircle(this.x, this.y, this.pullRadius * 0.6 * pulse);

      // Inner ring
      this.graphics.lineStyle(1, 0xcc88ff, 0.3 * lifePct);
      this.graphics.strokeCircle(this.x, this.y, this.pullRadius * 0.3 * pulse);

      // Swirl lines (rotating inward spiral effect)
      const numLines = 4;
      for (let i = 0; i < numLines; i++) {
        const angle = this.pulsePhase * 0.8 + (i / numLines) * Math.PI * 2;
        const outerR = this.pullRadius * 0.8 * pulse;
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
  }

  /**
   * During travel: triggers well on contact with enemy.
   * During well: no direct hit damage (pull + drain is applied by applyPull).
   */
  checkHit(wizard) {
    if (!this.alive || !wizard.alive) return 0;
    if (wizard.playerId === this.ownerPlayerId) return 0;

    if (this.phase === 'travel') {
      const dx = this.x - wizard.x;
      const dy = this.y - wizard.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < this.radius * 2 + wizard.radius) {
        // Small impact damage then become well
        const prevHealth = wizard.health;
        wizard.takeDamage(this.damage);
        const dealt = prevHealth - wizard.health;
        this._becomeWell();
        return dealt;
      }
    }
    return 0;
  }

  /**
   * Apply gravitational pull and HP drain to all enemies in range.
   * Called by GameScene each frame during well phase.
   */
  applyPull(wizards, delta) {
    if (this.phase !== 'well' || !this.alive) return;

    const dt = delta / 1000;

    wizards.forEach((wizard) => {
      if (!wizard.alive) return;
      if (wizard.playerId === this.ownerPlayerId) return;

      const dx = this.x - wizard.x;
      const dy = this.y - wizard.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < this.pullRadius && dist > 5) {
        // Pull strength increases closer to center
        const factor = (1 - dist / this.pullRadius);
        const pullForce = this.pullStrength * factor * dt;
        const nx = dx / dist;
        const ny = dy / dist;

        wizard.knockbackVel.x += nx * pullForce;
        wizard.knockbackVel.y += ny * pullForce;

        // HP drain while in the pull zone
        const drain = wizard.maxHealth * WELL_DPS_PCT * dt;
        wizard.takeDamage(drain);
      }
    });
  }

  serialize() {
    return {
      spellId: 'gravity_sphere',
      x: this.x,
      y: this.y,
      velX: this.velX,
      velY: this.velY,
      ownerPlayerId: this.ownerPlayerId,
      alive: this.alive,
      damage: this.damage,
      radius: this.radius,
      pullStrength: this.pullStrength,
      pullRadius: this.pullRadius,
      wellDuration: this.wellDuration,
      phase: this.phase,
      wellStartTime: this.wellStartTime,
      lifesteal: this.lifesteal,
    };
  }

  destroy() {
    this.graphics.destroy();
  }
}
