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
    this.damage = stats.damage || 5;
    this.radius = stats.radius || 5;
    this.tetherDuration = stats.tetherDuration || 2500;
    this.pullForce = stats.pullForce || 80;
    this.tetherRange = stats.tetherRange || 250;
    this.lifesteal = stats.lifesteal || 0;
    this.speed = speed;

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
      // Positions are updated by GameScene via setCasterTarget
      if (this._casterPos && this._targetPos) {
        const elapsed = Date.now() - this.tetherStartTime;
        const lifePct = 1 - elapsed / this.tetherDuration;
        const alpha = Math.max(0.2, lifePct);

        // Chain segments
        const segs = 8;
        const dx = this._targetPos.x - this._casterPos.x;
        const dy = this._targetPos.y - this._casterPos.y;

        this.graphics.lineStyle(2, 0xff8844, alpha * 0.8);
        this.graphics.beginPath();
        for (let i = 0; i <= segs; i++) {
          const t = i / segs;
          const px = this._casterPos.x + dx * t;
          const py = this._casterPos.y + dy * t;
          // Add zigzag
          const offset = (i % 2 === 0 ? 1 : -1) * 4 * (1 - Math.abs(t - 0.5) * 2);
          const nx = -dy / (Math.sqrt(dx * dx + dy * dy) || 1);
          const ny = dx / (Math.sqrt(dx * dx + dy * dy) || 1);
          if (i === 0) this.graphics.moveTo(px + nx * offset, py + ny * offset);
          else this.graphics.lineTo(px + nx * offset, py + ny * offset);
        }
        this.graphics.strokePath();

        // Glow at endpoints
        this.graphics.fillStyle(0xff8844, alpha * 0.4);
        this.graphics.fillCircle(this._casterPos.x, this._casterPos.y, 8);
        this.graphics.fillCircle(this._targetPos.x, this._targetPos.y, 8);
      }
    }
  }

  setCasterTarget(casterPos, targetPos) {
    this._casterPos = casterPos;
    this._targetPos = targetPos;
    // Update our position to midpoint for serialization
    this.x = (casterPos.x + targetPos.x) / 2;
    this.y = (casterPos.y + targetPos.y) / 2;
  }

  applyTetherPull(caster, target, delta) {
    if (this.phase !== 'tethered' || !this.alive) return;
    const dt = delta / 1000;

    const dx = target.x - caster.x;
    const dy = target.y - caster.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;

    // Break if too far
    if (dist > this.tetherRange * 2) {
      this.alive = false;
      return;
    }

    const nx = dx / dist;
    const ny = dy / dist;
    const force = this.pullForce * dt;

    // Pull both toward each other
    caster.knockbackVel.x += nx * force;
    caster.knockbackVel.y += ny * force;
    target.knockbackVel.x -= nx * force;
    target.knockbackVel.y -= ny * force;

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
      const prevHealth = wizard.health;
      wizard.takeDamage(this.damage);
      const dealt = prevHealth - wizard.health;

      // Transition to tethered phase
      this.phase = 'tethered';
      this.targetPlayerId = wizard.playerId;
      this.tetherStartTime = Date.now();
      this.velX = 0;
      this.velY = 0;

      return dealt;
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
