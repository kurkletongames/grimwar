const ARENA_MAX_RADIUS = 440;
const ARENA_MIN_RADIUS = 50;
const WALL_RADIUS = 480; // outer boundary wall
const SHRINK_RATE = 8; // pixels per second
const LAVA_DAMAGE_PCT = 0.08; // 8% of max health per second
const SHRINK_DELAY = 5000; // ms before arena starts shrinking

export class Arena {
  constructor(scene, centerX, centerY) {
    this.scene = scene;
    this.centerX = centerX;
    this.centerY = centerY;
    this.maxRadius = ARENA_MAX_RADIUS;
    this.currentRadius = ARENA_MAX_RADIUS;
    this.minRadius = ARENA_MIN_RADIUS;
    this.shrinkRate = SHRINK_RATE;
    this.lavaDamagePct = LAVA_DAMAGE_PCT;
    this.wallRadius = WALL_RADIUS;
    this.shrinking = false;
    this.roundStartTime = 0;

    // Graphics layers
    this.lavaGraphics = scene.add.graphics();
    this.arenaGraphics = scene.add.graphics();
    this.borderGraphics = scene.add.graphics();
    this.wallGraphics = scene.add.graphics();

    this.draw();
  }

  startRound() {
    this.currentRadius = this.maxRadius;
    this.shrinking = false;
    this.roundStartTime = Date.now();
    this.draw();
  }

  update(delta) {
    // Start shrinking after delay
    if (!this.shrinking && Date.now() - this.roundStartTime > SHRINK_DELAY) {
      this.shrinking = true;
    }

    if (this.shrinking && this.currentRadius > this.minRadius) {
      this.currentRadius -= this.shrinkRate * (delta / 1000);
      this.currentRadius = Math.max(this.currentRadius, this.minRadius);
    }

    this.draw();
  }

  draw() {
    // Lava floor (full area behind the arena)
    this.lavaGraphics.clear();

    // Animated lava - create a pulsing effect
    const time = Date.now() / 1000;
    const lavaAlpha = 0.7 + Math.sin(time * 2) * 0.1;

    // Lava base
    this.lavaGraphics.fillStyle(0x8b0000, lavaAlpha);
    this.lavaGraphics.fillCircle(this.centerX, this.centerY, this.maxRadius + 20);

    // Lava highlights
    this.lavaGraphics.fillStyle(0xff4500, 0.3 + Math.sin(time * 3) * 0.15);
    this.lavaGraphics.fillCircle(
      this.centerX + Math.sin(time) * 30,
      this.centerY + Math.cos(time * 1.3) * 30,
      this.maxRadius * 0.6
    );
    this.lavaGraphics.fillStyle(0xff6600, 0.2 + Math.cos(time * 2.5) * 0.1);
    this.lavaGraphics.fillCircle(
      this.centerX + Math.cos(time * 0.7) * 50,
      this.centerY + Math.sin(time * 0.9) * 50,
      this.maxRadius * 0.4
    );

    // Arena floor (safe zone)
    this.arenaGraphics.clear();
    this.arenaGraphics.fillStyle(0x2a2a4a, 1);
    this.arenaGraphics.fillCircle(this.centerX, this.centerY, this.currentRadius);

    // Stone texture rings
    for (let r = this.currentRadius; r > 0; r -= 40) {
      this.arenaGraphics.lineStyle(1, 0x3a3a5a, 0.3);
      this.arenaGraphics.strokeCircle(this.centerX, this.centerY, r);
    }

    // Center mark
    this.arenaGraphics.fillStyle(0x3a3a6a, 0.5);
    this.arenaGraphics.fillCircle(this.centerX, this.centerY, 15);

    // Arena border glow
    this.borderGraphics.clear();
    this.borderGraphics.lineStyle(3, 0xe94560, 0.6 + Math.sin(time * 4) * 0.2);
    this.borderGraphics.strokeCircle(this.centerX, this.centerY, this.currentRadius);
    this.borderGraphics.lineStyle(6, 0xe94560, 0.15);
    this.borderGraphics.strokeCircle(this.centerX, this.centerY, this.currentRadius + 3);

    // Outer wall
    this.wallGraphics.clear();
    this.wallGraphics.lineStyle(5, 0x555577, 0.9);
    this.wallGraphics.strokeCircle(this.centerX, this.centerY, this.wallRadius);
    this.wallGraphics.lineStyle(2, 0x8888aa, 0.4);
    this.wallGraphics.strokeCircle(this.centerX, this.centerY, this.wallRadius + 3);
  }

  /**
   * Check if a position is outside the safe arena (on lava).
   */
  isOnLava(x, y) {
    const dx = x - this.centerX;
    const dy = y - this.centerY;
    return Math.sqrt(dx * dx + dy * dy) > this.currentRadius;
  }

  /**
   * Apply lava damage to wizards standing on lava.
   */
  applyLavaDamage(wizards, delta) {
    const dt = delta / 1000;
    wizards.forEach((wizard) => {
      if (wizard.alive && this.isOnLava(wizard.x, wizard.y)) {
        wizard.takeDamage(wizard.maxHealth * this.lavaDamagePct * dt);
      }
    });
  }

  /**
   * Clamp a wizard's position inside the outer wall. Returns true if the wizard hit the wall.
   */
  constrainToWall(wizard) {
    const dx = wizard.x - this.centerX;
    const dy = wizard.y - this.centerY;
    const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
    const maxDist = this.wallRadius - wizard.radius;

    if (dist > maxDist) {
      // Push back to wall edge
      const nx = dx / dist;
      const ny = dy / dist;
      wizard.x = this.centerX + nx * maxDist;
      wizard.y = this.centerY + ny * maxDist;

      // Kill knockback velocity along the wall normal (absorb the impact)
      const dot = wizard.knockbackVel.x * nx + wizard.knockbackVel.y * ny;
      if (dot > 0) {
        wizard.knockbackVel.x -= dot * nx;
        wizard.knockbackVel.y -= dot * ny;
      }
      return true;
    }
    return false;
  }

  serialize() {
    return {
      currentRadius: this.currentRadius,
      shrinking: this.shrinking,
    };
  }

  applyState(state) {
    this.currentRadius = state.currentRadius;
    this.shrinking = state.shrinking;
    this.draw();
  }

  destroy() {
    this.lavaGraphics.destroy();
    this.arenaGraphics.destroy();
    this.borderGraphics.destroy();
    this.wallGraphics.destroy();
  }
}
