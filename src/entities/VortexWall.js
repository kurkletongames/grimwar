export class VortexWall {
  constructor(scene, x, y, normalX, normalY, ownerPlayerId, stats = {}) {
    this.scene = scene;
    this.spellId = 'vortex_wall';
    this.ownerPlayerId = ownerPlayerId;
    this.x = x;
    this.y = y;
    this.alive = true;
    this.spawnTime = Date.now();

    this.wallDuration = stats.wallDuration || 3000;
    this.wallLength = stats.wallLength || 80;
    this.wallThickness = stats.wallThickness || 12;
    this.lifesteal = stats.lifesteal || 0;
    this.damage = 0;
    this.knockback = 0;
    this.radius = 0; // not a standard projectile

    // Wall orientation: normal points in cast direction, wall is perpendicular
    this.normalX = normalX;
    this.normalY = normalY;
    // Wall endpoints: perpendicular to normal
    this.tangentX = -normalY;
    this.tangentY = normalX;

    this.velX = 0;
    this.velY = 0;

    this.pulsePhase = 0;
    this._deflected = new Set();

    this.graphics = scene.add.graphics();
    this.draw();
  }

  update(delta) {
    if (!this.alive) return;
    const dt = delta / 1000;
    this.pulsePhase += dt * 3;

    if (Date.now() - this.spawnTime > this.wallDuration) {
      this.alive = false;
    }

    this.draw();
  }

  draw() {
    this.graphics.clear();

    const elapsed = Date.now() - this.spawnTime;
    const fadeOut = Math.max(0, Math.min(1, (this.wallDuration - elapsed) / 500));
    const alphaPulse = 0.85 + Math.sin(this.pulsePhase) * 0.15;
    const alpha = fadeOut * alphaPulse;

    const halfLen = this.wallLength / 2;
    const x1 = this.x + this.tangentX * halfLen;
    const y1 = this.y + this.tangentY * halfLen;
    const x2 = this.x - this.tangentX * halfLen;
    const y2 = this.y - this.tangentY * halfLen;

    // Glow
    this.graphics.lineStyle(this.wallThickness + 8, 0x44ffcc, alpha * 0.15);
    this.graphics.beginPath();
    this.graphics.moveTo(x1, y1);
    this.graphics.lineTo(x2, y2);
    this.graphics.strokePath();

    // Core wall
    this.graphics.lineStyle(this.wallThickness, 0x44ffcc, alpha * 0.7);
    this.graphics.beginPath();
    this.graphics.moveTo(x1, y1);
    this.graphics.lineTo(x2, y2);
    this.graphics.strokePath();

    // Bright center line
    this.graphics.lineStyle(2, 0xaaffee, alpha);
    this.graphics.beginPath();
    this.graphics.moveTo(x1, y1);
    this.graphics.lineTo(x2, y2);
    this.graphics.strokePath();

    // Arrow indicators at ends
    const arrowSize = 5;
    this.graphics.fillStyle(0x44ffcc, alpha * 0.6);
    this.graphics.fillTriangle(
      x1, y1,
      x1 + this.normalX * arrowSize, y1 + this.normalY * arrowSize,
      x1 - this.normalX * arrowSize, y1 - this.normalY * arrowSize,
    );
    this.graphics.fillTriangle(
      x2, y2,
      x2 + this.normalX * arrowSize, y2 + this.normalY * arrowSize,
      x2 - this.normalX * arrowSize, y2 - this.normalY * arrowSize,
    );
  }

  /**
   * Check if a projectile should be deflected by this wall.
   * Returns true if deflected.
   */
  checkDeflect(projectile) {
    if (!this.alive || projectile.ownerPlayerId === this.ownerPlayerId) return false;
    if (projectile.spellId === 'vortex_wall') return false;
    if (this._deflected.has(projectile)) return false;

    // Check if projectile is within the wall's bounding area
    // Project projectile position onto wall's local coordinate system
    const dx = projectile.x - this.x;
    const dy = projectile.y - this.y;

    // Distance along wall normal (how far from the wall plane)
    const normalDist = dx * this.normalX + dy * this.normalY;
    if (Math.abs(normalDist) > this.wallThickness / 2 + (projectile.radius || 5)) return false;

    // Distance along wall tangent (how far along the wall)
    const tangentDist = dx * this.tangentX + dy * this.tangentY;
    if (Math.abs(tangentDist) > this.wallLength / 2) return false;

    // Deflect: reflect velocity across wall normal
    const velDotNormal = projectile.velX * this.normalX + projectile.velY * this.normalY;
    projectile.velX -= 2 * velDotNormal * this.normalX;
    projectile.velY -= 2 * velDotNormal * this.normalY;

    // Update angle for homing missiles so the deflection sticks
    if (projectile.spellId === 'homing_missile' && projectile.angle !== undefined) {
      projectile.angle = Math.atan2(projectile.velY, projectile.velX);
    }

    // Change ownership so it can now hit the original caster's enemies
    projectile.ownerPlayerId = this.ownerPlayerId;

    this._deflected.add(projectile);
    return true;
  }

  // VortexWall doesn't hit wizards directly
  checkHit() {
    return 0;
  }

  serialize() {
    return {
      spellId: 'vortex_wall',
      x: this.x, y: this.y,
      velX: 0, velY: 0,
      ownerPlayerId: this.ownerPlayerId,
      alive: this.alive,
      lifesteal: this.lifesteal,
      normalX: this.normalX, normalY: this.normalY,
      wallDuration: this.wallDuration,
      wallLength: this.wallLength,
      wallThickness: this.wallThickness,
    };
  }

  destroy() {
    this._deflected.clear();
    this.graphics.destroy();
  }
}
