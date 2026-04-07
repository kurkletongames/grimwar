/**
 * Lightning Strike — AoE ground indicator followed by a bolt that deals massive knockback.
 * Phases: 'indicator' (shows target circle) → 'strike' (damage + knockback) → dead
 */
export class LightningBolt {
  constructor(scene, x, y, dirX, dirY, ownerPlayerId, stats = {}) {
    this.scene = scene;
    this.spellId = 'lightning_bolt';
    this.ownerPlayerId = ownerPlayerId;
    this.alive = true;
    this.spawnTime = Date.now();

    this.damage = stats.damage || 15;
    this.knockback = stats.knockback || 1200;
    this.strikeRadius = stats.strikeRadius || 70;
    this.strikeDelay = stats.strikeDelay || 500;
    this.lifesteal = stats.lifesteal || 0;
    this.radius = 0; // not a normal projectile for collision
    this.hitTargets = new Set();

    // Target location: some distance ahead in cast direction
    const len = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
    const strikeDist = 160;
    this.x = x + (dirX / len) * strikeDist;
    this.y = y + (dirY / len) * strikeDist;
    this.velX = 0;
    this.velY = 0;

    this.phase = 'indicator'; // 'indicator' → 'strike' → dead
    this.strikeTime = Date.now() + this.strikeDelay;
    this.struck = false;

    this.graphics = scene.add.graphics();
    this.draw();
  }

  update(delta) {
    if (!this.alive) return;
    const now = Date.now();

    if (this.phase === 'indicator') {
      if (now >= this.strikeTime) {
        this.phase = 'strike';
        this.struck = true;
      }
      this.draw();
      return;
    }

    if (this.phase === 'strike') {
      // Strike visual lasts 300ms then die
      if (now - this.strikeTime > 300) {
        this.alive = false;
      }
      this.draw();
    }
  }

  draw() {
    this.graphics.clear();

    if (this.phase === 'indicator') {
      const elapsed = Date.now() - this.spawnTime;
      const progress = Math.min(1, elapsed / this.strikeDelay);
      const pulse = 0.8 + Math.sin(elapsed * 0.015) * 0.2;

      // Warning circle on ground
      this.graphics.lineStyle(2, 0xffff44, 0.3 + progress * 0.5);
      this.graphics.strokeCircle(this.x, this.y, this.strikeRadius * pulse);

      // Fill getting more intense
      this.graphics.fillStyle(0xffff44, 0.05 + progress * 0.1);
      this.graphics.fillCircle(this.x, this.y, this.strikeRadius * pulse);

      // Center crosshair
      const cr = 8;
      this.graphics.lineStyle(1, 0xffff88, 0.4 + progress * 0.4);
      this.graphics.beginPath();
      this.graphics.moveTo(this.x - cr, this.y);
      this.graphics.lineTo(this.x + cr, this.y);
      this.graphics.moveTo(this.x, this.y - cr);
      this.graphics.lineTo(this.x, this.y + cr);
      this.graphics.strokePath();
      return;
    }

    if (this.phase === 'strike') {
      const elapsed = Date.now() - this.strikeTime;
      const alpha = Math.max(0, 1 - elapsed / 300);

      // Bright flash fill
      this.graphics.fillStyle(0xffff88, alpha * 0.4);
      this.graphics.fillCircle(this.x, this.y, this.strikeRadius);

      // Electric ring expanding
      this.graphics.lineStyle(3, 0xffff44, alpha * 0.9);
      this.graphics.strokeCircle(this.x, this.y, this.strikeRadius * (0.5 + (1 - alpha) * 0.5));

      // Inner flash
      this.graphics.fillStyle(0xffffff, alpha * 0.8);
      this.graphics.fillCircle(this.x, this.y, this.strikeRadius * 0.2);

      // Lightning bolt line from above (visual only)
      this.graphics.lineStyle(4, 0xffff44, alpha);
      this.graphics.beginPath();
      this.graphics.moveTo(this.x + (Math.random() - 0.5) * 10, this.y - 200);
      const segs = 5;
      for (let i = 1; i <= segs; i++) {
        const t = i / segs;
        const jx = (Math.random() - 0.5) * 30 * (1 - t);
        this.graphics.lineTo(this.x + jx, this.y - 200 + t * 200);
      }
      this.graphics.strokePath();
    }
  }

  /**
   * Applies AoE damage when strike lands.
   * Called by GameScene when phase transitions to 'strike'.
   * Returns array of { wizard, dealt } like Meteor.
   */
  applyStrikeDamage(wizards) {
    const hits = [];
    wizards.forEach((wizard) => {
      if (!wizard.alive) return;
      if (wizard.playerId === this.ownerPlayerId) return;
      if (this.hitTargets.has(wizard.playerId)) return;

      const dx = this.x - wizard.x;
      const dy = this.y - wizard.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < this.strikeRadius + wizard.radius) {
        this.hitTargets.add(wizard.playerId);
        const falloff = 1 - Math.min(1, dist / this.strikeRadius);
        const dmg = Math.round(this.damage * (0.5 + 0.5 * falloff));

        const prevHealth = wizard.health;
        wizard.takeDamage(dmg);
        const dealt = prevHealth - wizard.health;

        // Knockback away from center — massive
        const kbDir = dist > 0 ? { x: -dx / dist, y: -dy / dist } : { x: 0, y: -1 };
        wizard.applyKnockback(
          kbDir.x * this.knockback * falloff,
          kbDir.y * this.knockback * falloff,
        );

        hits.push({ wizard, dealt });
      }
    });
    return hits;
  }

  // Lightning strike doesn't use normal projectile hit — damage is via applyStrikeDamage
  checkHit() {
    return 0;
  }

  serialize() {
    return {
      spellId: 'lightning_bolt',
      x: this.x, y: this.y,
      velX: 0, velY: 0,
      ownerPlayerId: this.ownerPlayerId,
      alive: this.alive,
      damage: this.damage, knockback: this.knockback,
      strikeRadius: this.strikeRadius, strikeDelay: this.strikeDelay,
      radius: 0, lifesteal: this.lifesteal,
      phase: this.phase, strikeTime: this.strikeTime,
      hitTargets: Array.from(this.hitTargets),
    };
  }

  destroy() {
    this.graphics.destroy();
  }
}
