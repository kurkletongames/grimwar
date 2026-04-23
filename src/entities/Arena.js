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

    // Arena floor — radial gradient for depth (outer = floor color, center glows theme accent)
    this.arenaGraphics.clear();
    this.arenaGraphics.fillStyle(t.floor, 1);
    this.arenaGraphics.fillCircle(this.centerX, this.centerY, this.currentRadius);
    // Mid-ring brighter wash
    this.arenaGraphics.fillStyle(t.ring, 0.35);
    this.arenaGraphics.fillCircle(this.centerX, this.centerY, this.currentRadius * 0.75);
    // Inner spotlight — theme accent tint
    this.arenaGraphics.fillStyle(t.border, 0.1);
    this.arenaGraphics.fillCircle(this.centerX, this.centerY, this.currentRadius * 0.5);
    this.arenaGraphics.fillStyle(t.border, 0.08);
    this.arenaGraphics.fillCircle(this.centerX, this.centerY, this.currentRadius * 0.3);

    // Texture rings (slightly bolder)
    for (let r = this.currentRadius; r > 0; r -= 40) {
      this.arenaGraphics.lineStyle(1, t.ring, 0.45);
      this.arenaGraphics.strokeCircle(this.centerX, this.centerY, r);
    }

    // Runic summoning circle — rotates slowly, pulses in opacity
    const runePulse = 0.5 + Math.sin(time * 1.2) * 0.2;
    const runeRot = time * 0.3;
    const innerR = 36;
    const outerR = 52;
    this.arenaGraphics.lineStyle(1.5, t.border, runePulse * 0.7);
    this.arenaGraphics.strokeCircle(this.centerX, this.centerY, innerR);
    this.arenaGraphics.lineStyle(1, t.border, runePulse * 0.5);
    this.arenaGraphics.strokeCircle(this.centerX, this.centerY, outerR);
    // Tick marks on outer ring — 8 evenly spaced, rotating
    for (let i = 0; i < 8; i++) {
      const a = runeRot + (i * Math.PI) / 4;
      const tickStart = outerR - 4;
      const tickEnd = outerR + 4;
      this.arenaGraphics.lineStyle(1.5, t.border, runePulse * 0.8);
      this.arenaGraphics.lineBetween(
        this.centerX + Math.cos(a) * tickStart,
        this.centerY + Math.sin(a) * tickStart,
        this.centerX + Math.cos(a) * tickEnd,
        this.centerY + Math.sin(a) * tickEnd,
      );
    }

    // Center mark
    this.arenaGraphics.fillStyle(t.border, 0.4 + Math.sin(time * 2) * 0.15);
    this.arenaGraphics.fillCircle(this.centerX, this.centerY, 6);
    this.arenaGraphics.fillStyle(t.ring, 0.6);
    this.arenaGraphics.fillCircle(this.centerX, this.centerY, 3);

    // Border glow — multi-layer rim
    this.borderGraphics.clear();
    const borderPulse = 0.6 + Math.sin(time * 4) * 0.2;
    // Main crisp border
    this.borderGraphics.lineStyle(3, t.border, borderPulse);
    this.borderGraphics.strokeCircle(this.centerX, this.centerY, this.currentRadius);
    // Soft outer halo
    this.borderGraphics.lineStyle(6, t.border, 0.2);
    this.borderGraphics.strokeCircle(this.centerX, this.centerY, this.currentRadius + 3);
    this.borderGraphics.lineStyle(10, t.border, 0.08);
    this.borderGraphics.strokeCircle(this.centerX, this.centerY, this.currentRadius + 7);
    // Thin inner highlight line
    this.borderGraphics.lineStyle(1, t.ring, 0.6);
    this.borderGraphics.strokeCircle(this.centerX, this.centerY, this.currentRadius - 2);

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
      themeName: this.themeName,
    };
  }

  applyState(state) {
    this.currentRadius = state.currentRadius;
    this.shrinking = state.shrinking;
    if (state.themeName && state.themeName !== this.themeName) {
      this.setTheme(state.themeName);
    }
    this.draw();
  }

  destroy() {
    this.lavaGraphics.destroy();
    this.arenaGraphics.destroy();
    this.borderGraphics.destroy();
    this.wallGraphics.destroy();
  }
}
