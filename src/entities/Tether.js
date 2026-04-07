export class Tether {
  constructor(scene, x, y, dirX, dirY, ownerPlayerId, stats = {}) {
    this.scene = scene;
    this.spellId = 'tether';
    this.ownerPlayerId = ownerPlayerId;
    this.x = x;
    this.y = y;
    this.alive = true;
    this.spawnTime = Date.now();

    this.phase = 'travel'; // 'travel' or 'tethered'
    this.targetPlayerId = null;
    this.tetherStartTime = 0;

    const speed = stats.speed || 350;
    this.damage = 0; // no direct damage
    this.radius = stats.radius || 5;
    this.tetherDuration = stats.tetherDuration || 6000;
    this.pullForce = stats.pullForce || 160;
    this.tetherRange = stats.tetherRange || 300;
    this.tetherDrain = stats.tetherDrain || 0.05; // 5% max HP per second
    this.lifesteal = 0;
    this.speed = speed;
    this.knockback = 0;

    const len = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
    this.velX = (dirX / len) * speed;
    this.velY = (dirY / len) * speed;
    this.travelDist = 0;

    this.graphics = scene.add.graphics();
    this.trail = [];
    this.draw();
  }

  update(delta) {
    if (!this.alive) return;
    const dt = delta / 1000;

    if (this.phase === 'travel') {
      this.x += this.velX * dt;
      this.y += this.velY * dt;
      this.travelDist += this.speed * dt;

      this.trail.push({ x: this.x, y: this.y });
      if (this.trail.length > 6) this.trail.shift();

      if (this.travelDist > this.tetherRange) {
        this.alive = false;
      }
    } else {
      // Tethered phase — pull is applied by GameScene
      if (Date.now() - this.tetherStartTime > this.tetherDuration) {
        this.alive = false;
      }
    }

    this.draw();
  }

  draw() {
    this.graphics.clear();

    if (this.phase === 'travel') {
      // Trail
      this.trail.forEach((p, i) => {
        const alpha = (i / this.trail.length) * 0.3;
        this.graphics.fillStyle(0xff8844, alpha);
        this.graphics.fillCircle(p.x, p.y, this.radius * 0.6);
      });

      // Core
      this.graphics.fillStyle(0xff8844, 0.3);
      this.graphics.fillCircle(this.x, this.y, this.radius * 2);
      this.graphics.fillStyle(0xff8844, 1);
      this.graphics.fillCircle(this.x, this.y, this.radius);
    } else {
      // Tethered — draw beam between caster and target
      if (this._casterPos && this._targetPos) {
        const elapsed = Date.now() - this.tetherStartTime;
        const lifePct = Math.max(0, 1 - elapsed / this.tetherDuration);
        const alpha = Math.max(0.3, lifePct);

        const beamDx = this._targetPos.x - this._casterPos.x;
        const beamDy = this._targetPos.y - this._casterPos.y;
        const beamLen = Math.sqrt(beamDx * beamDx + beamDy * beamDy) || 1;

        // Main beam line
        this.graphics.lineStyle(3, 0xff8844, alpha * 0.8);
        this.graphics.beginPath();
        this.graphics.moveTo(this._casterPos.x, this._casterPos.y);
        this.graphics.lineTo(this._targetPos.x, this._targetPos.y);
        this.graphics.strokePath();

        // Animated energy pulses along beam (toward target)
        const pulseTime = (Date.now() % 600) / 600; // 0-1 cycling
        for (let p = 0; p < 3; p++) {
          const t = ((pulseTime + p / 3) % 1);
          const px = this._casterPos.x + beamDx * t;
          const py = this._casterPos.y + beamDy * t;
          this.graphics.fillStyle(0xffaa44, alpha * 0.6);
          this.graphics.fillCircle(px, py, 3);
        }

        // Glow at endpoints
        this.graphics.fillStyle(0xff8844, alpha * 0.4);
        this.graphics.fillCircle(this._casterPos.x, this._casterPos.y, 8);
        this.graphics.fillStyle(0xff4422, alpha * 0.5);
        this.graphics.fillCircle(this._targetPos.x, this._targetPos.y, 10);
      }
    }
  }

  setCasterTarget(casterPos, targetPos) {
    this._casterPos = casterPos;
    this._targetPos = targetPos;
    // Update position to midpoint for serialization
    this.x = (casterPos.x + targetPos.x) / 2;
    this.y = (casterPos.y + targetPos.y) / 2;
  }

  /**
   * Tractor beam: pull target toward caster.
   * Pull is STRONGER the further the target is from the caster.
   * Allows rotation: only pulls along the radial direction.
   */
  applyTetherPull(caster, target, delta) {
    if (this.phase !== 'tethered' || !this.alive) return;
    const dt = delta / 1000;

    const dx = caster.x - target.x;
    const dy = caster.y - target.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;

    // Break if too far
    if (dist > this.tetherRange * 2.5) {
      this.alive = false;
      return;
    }

    const nx = dx / dist;
    const ny = dy / dist;

    // Mark target as tethered (disables friction on their knockback)
    target.tethered = true;

    // Strong velocity pull — scales with distance, no friction to fight
    const distFactor = Math.min(3, dist / 60);
    const velPull = this.pullForce * distFactor * dt;
    target.knockbackVel.x += nx * velPull;
    target.knockbackVel.y += ny * velPull;

    // Direct position yank — bypasses everything
    const directPull = this.pullForce * 0.4 * distFactor * dt;
    target.x += nx * directPull;
    target.y += ny * directPull;

    // HP drain while tethered
    if (this.tetherDrain > 0) {
      const drain = target.maxHealth * this.tetherDrain * dt;
      target.takeDamage(drain);
    }

    this.setCasterTarget(
      { x: caster.x, y: caster.y },
      { x: target.x, y: target.y },
    );
  }

  checkHit(wizard) {
    if (!this.alive || !wizard.alive) return 0;
    if (wizard.playerId === this.ownerPlayerId) return 0;
    if (this.phase !== 'travel') return 0;

    const dx = this.x - wizard.x;
    const dy = this.y - wizard.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < this.radius * 2 + wizard.radius) {
      // No damage — just link
      this.phase = 'tethered';
      this.targetPlayerId = wizard.playerId;
      this.tetherStartTime = Date.now();
      this.velX = 0;
      this.velY = 0;
      return 0;
    }
    return 0;
  }

  serialize() {
    return {
      spellId: 'tether',
      x: this.x, y: this.y,
      velX: this.velX, velY: this.velY,
      ownerPlayerId: this.ownerPlayerId,
      alive: this.alive,
      damage: this.damage, radius: this.radius,
      lifesteal: this.lifesteal,
      phase: this.phase,
      targetPlayerId: this.targetPlayerId,
      tetherStartTime: this.tetherStartTime,
      tetherDuration: this.tetherDuration,
      pullForce: this.pullForce,
      tetherRange: this.tetherRange,
    };
  }

  destroy() {
    this.graphics.destroy();
  }
}
