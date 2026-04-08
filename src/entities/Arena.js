const ARENA_MAX_RADIUS = 440;
const ARENA_MIN_RADIUS = 50;
const WALL_RADIUS = 480; // outer boundary wall
const SHRINK_RATE = 5.6; // pixels per second (30% slower)
const LAVA_DAMAGE_PCT = 0.08; // 8% of max health per second
const SHRINK_DELAY = 5000; // ms before arena starts shrinking

const THEMES = {
  standard: { lava: 0x8b0000, floor: 0x2a2a4a, border: 0xe94560, wall: 0x555577, ring: 0x3a3a5a },
  ice:      { lava: 0x1a3a5a, floor: 0x1a2a4a, border: 0x4fc3f7, wall: 0x445577, ring: 0x2a3a5a },
  volcanic: { lava: 0xaa2200, floor: 0x3a2020, border: 0xff6600, wall: 0x554433, ring: 0x4a2a2a },
  void:     { lava: 0x220044, floor: 0x1a0a2e, border: 0x9944ff, wall: 0x332255, ring: 0x2a1a3a },
};
export const THEME_NAMES = Object.keys(THEMES);

export class Arena {
  constructor(scene, centerX, centerY) {
    this.scene = scene;
    this.centerX = centerX;
    this.centerY = centerY;

    // Theme — set to standard, overridden by GameScene.setTheme()
    this.themeName = 'standard';
    this.theme = THEMES.standard;
    this.maxRadius = ARENA_MAX_RADIUS;
    this.currentRadius = ARENA_MAX_RADIUS;
    this.minRadius = ARENA_MIN_RADIUS;
    this.shrinkRate = SHRINK_RATE;
    this.shrinkDelay = SHRINK_DELAY;
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

  setTheme(themeName) {
    if (THEMES[themeName]) {
      this.themeName = themeName;
      this.theme = THEMES[themeName];
    }
  }

  startRound() {
    this.currentRadius = this.maxRadius;
    this.shrinking = false;
    this.roundStartTime = Date.now();
    this.draw();
  }

  update(delta) {
    // Start shrinking after delay
    if (!this.shrinking && Date.now() - this.roundStartTime > this.shrinkDelay) {
      this.shrinking = true;
    }

    if (this.shrinking && this.currentRadius > this.minRadius) {
      this.currentRadius -= this.shrinkRate * (delta / 1000);
      this.currentRadius = Math.max(this.currentRadius, this.minRadius);
    }

    this.draw();
  }

  draw() {
    const t = this.theme;
    const time = Date.now() / 1000;

    // Lava/hazard floor
    this.lavaGraphics.clear();
    const lavaAlpha = 0.7 + Math.sin(time * 2) * 0.1;
    this.lavaGraphics.fillStyle(t.lava, lavaAlpha);
    this.lavaGraphics.fillCircle(this.centerX, this.centerY, this.maxRadius + 20);

    // Lava highlights
    this.lavaGraphics.fillStyle(t.border, 0.15 + Math.sin(time * 3) * 0.08);
    this.lavaGraphics.fillCircle(
      this.centerX + Math.sin(time) * 30,
      this.centerY + Math.cos(time * 1.3) * 30,
      this.maxRadius * 0.6
    );

    // Arena floor (safe zone)
    this.arenaGraphics.clear();
    this.arenaGraphics.fillStyle(t.floor, 1);
    this.arenaGraphics.fillCircle(this.centerX, this.centerY, this.currentRadius);

    // Texture rings
    for (let r = this.currentRadius; r > 0; r -= 40) {
      this.arenaGraphics.lineStyle(1, t.ring, 0.3);
      this.arenaGraphics.strokeCircle(this.centerX, this.centerY, r);
    }

    // Center mark
    this.arenaGraphics.fillStyle(t.ring, 0.5);
    this.arenaGraphics.fillCircle(this.centerX, this.centerY, 15);

    // Border glow
    this.borderGraphics.clear();
    this.borderGraphics.lineStyle(3, t.border, 0.6 + Math.sin(time * 4) * 0.2);
    this.borderGraphics.strokeCircle(this.centerX, this.centerY, this.currentRadius);
    this.borderGraphics.lineStyle(6, t.border, 0.15);
    this.borderGraphics.strokeCircle(this.centerX, this.centerY, this.currentRadius + 3);

    // Outer wall
    this.wallGraphics.clear();
    this.wallGraphics.lineStyle(5, t.wall, 0.9);
    this.wallGraphics.strokeCircle(this.centerX, this.centerY, this.wallRadius);
    this.wallGraphics.lineStyle(2, t.wall, 0.4);
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

      // Convert knockback into tangential velocity (spin along wall)
      const dot = wizard.knockbackVel.x * nx + wizard.knockbackVel.y * ny;
      if (dot > 0) {
        // Remove the radial component (into the wall)
        wizard.knockbackVel.x -= dot * nx;
        wizard.knockbackVel.y -= dot * ny;

        // Boost the remaining tangential velocity to preserve energy
        const tangentSpeed = Math.sqrt(wizard.knockbackVel.x ** 2 + wizard.knockbackVel.y ** 2);
        const totalSpeed = Math.sqrt(tangentSpeed ** 2 + dot ** 2);
        if (tangentSpeed > 0.1) {
          const scale = totalSpeed / tangentSpeed * 0.85; // 85% energy preserved as spin
          wizard.knockbackVel.x *= scale;
          wizard.knockbackVel.y *= scale;
        } else {
          // No tangential component — push perpendicular (clockwise)
          wizard.knockbackVel.x = -ny * dot * 0.85;
          wizard.knockbackVel.y = nx * dot * 0.85;
        }
      }
      return true;
    }
    return false;
  }

  /**
   * Check if a position is outside the outer wall.
   */
  isOutsideWall(x, y) {
    const dx = x - this.centerX;
    const dy = y - this.centerY;
    return Math.sqrt(dx * dx + dy * dy) > this.wallRadius;
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
