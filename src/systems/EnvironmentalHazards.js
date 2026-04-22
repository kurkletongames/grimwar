/**
 * Environmental hazards that spawn randomly during roguelike rounds.
 * Host-authoritative: host spawns/updates hazards, clients see via state sync.
 */

const SPAWN_INTERVAL_MIN = 8000;
const SPAWN_INTERVAL_MAX = 15000;

export class HazardManager {
  constructor(scene) {
    this.scene = scene;
    this.hazards = [];
    this.lastSpawnTime = 0;
    this.nextSpawnTime = 0;
    this.graphics = scene.add.graphics();
    this._scheduleNext();
  }

  _scheduleNext() {
    this.nextSpawnTime = Date.now() + SPAWN_INTERVAL_MIN + Math.random() * (SPAWN_INTERVAL_MAX - SPAWN_INTERVAL_MIN);
  }

  update(delta, wizards, arena) {
    const now = Date.now();

    // Spawn new hazard
    if (now >= this.nextSpawnTime && this.hazards.length < 2) {
      this._spawnRandom(arena);
      this._scheduleNext();
    }

    // Update active hazards
    const dt = delta / 1000;
    this.hazards.forEach((h) => h.update(dt, wizards));
    this.hazards = this.hazards.filter((h) => h.alive);

    this.draw();
  }

  _spawnRandom(arena) {
    const types = ['fire_geyser', 'ice_patch', 'wind_gust', 'meteor_shower'];
    const type = types[Math.floor(Math.random() * types.length)];
    const cx = arena.centerX;
    const cy = arena.centerY;
    const r = arena.currentRadius * 0.7;

    switch (type) {
      case 'fire_geyser': {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * r;
        this.hazards.push(new FireGeyser(cx + Math.cos(angle) * dist, cy + Math.sin(angle) * dist));
        break;
      }
      case 'ice_patch': {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * r;
        this.hazards.push(new IcePatch(cx + Math.cos(angle) * dist, cy + Math.sin(angle) * dist));
        break;
      }
      case 'wind_gust': {
        const angle = Math.random() * Math.PI * 2;
        this.hazards.push(new WindGust(angle, this.scene));
        break;
      }
      case 'meteor_shower': {
        for (let i = 0; i < 3 + Math.floor(Math.random() * 3); i++) {
          const angle = Math.random() * Math.PI * 2;
          const dist = Math.random() * r;
          this.hazards.push(new MeteorImpact(cx + Math.cos(angle) * dist, cy + Math.sin(angle) * dist));
        }
        break;
      }
    }
  }

  draw() {
    this.graphics.clear();
    this.hazards.forEach((h) => h.draw(this.graphics));
  }

  destroy() {
    this.hazards = [];
    this.graphics.destroy();
  }

  serialize() {
    return this.hazards.map((h) => ({
      type: h.type, x: h.x, y: h.y, phase: h.phase,
      startTime: h.startTime, angle: h.angle, radius: h.radius,
    }));
  }

  /** Client-side: recreate hazards from serialized host state */
  applyState(data) {
    if (!data || !Array.isArray(data)) return;
    this.hazards = data.map((h) => {
      switch (h.type) {
        case 'fire_geyser': { const g = new FireGeyser(h.x, h.y); g.startTime = h.startTime; g.phase = h.phase; return g; }
        case 'ice_patch': { const g = new IcePatch(h.x, h.y); g.startTime = h.startTime; return g; }
        case 'wind_gust': { const g = new WindGust(h.angle, this.scene); g.startTime = h.startTime; return g; }
        case 'meteor_impact': { const g = new MeteorImpact(h.x, h.y); g.startTime = h.startTime; g.phase = h.phase; return g; }
        default: return null;
      }
    }).filter(Boolean);
    this.draw();
  }
}

// ---- Fire Geyser ----
class FireGeyser {
  constructor(x, y) {
    this.type = 'fire_geyser';
    this.x = x; this.y = y;
    this.alive = true;
    this.startTime = Date.now();
    this.phase = 'warning'; // 'warning' → 'erupting' → dead
    this.radius = 60;
    this.damage = 15;
    this.knockback = 800;
    this.hitTargets = new Set();
  }

  update(dt, wizards) {
    const elapsed = Date.now() - this.startTime;
    if (this.phase === 'warning' && elapsed > 1000) {
      this.phase = 'erupting';
      // Apply damage
      wizards.forEach((w) => {
        if (!w.alive || this.hitTargets.has(w.playerId)) return;
        const dx = w.x - this.x;
        const dy = w.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < this.radius + w.radius) {
          this.hitTargets.add(w.playerId);
          w.takeDamage(this.damage);
          w.lastHitBy = null; // environmental damage
          const len = dist > 0 ? dist : 1;
          w.applyKnockback((dx / len) * this.knockback, (dy / len) * this.knockback);
        }
      });
    }
    if (this.phase === 'erupting' && elapsed > 1500) {
      this.alive = false;
    }
  }

  draw(g) {
    const elapsed = Date.now() - this.startTime;
    if (this.phase === 'warning') {
      const progress = Math.min(1, elapsed / 1000);
      const pulse = 0.7 + Math.sin(elapsed * 0.015) * 0.3;
      g.lineStyle(2, 0xff4400, 0.3 + progress * 0.5);
      g.strokeCircle(this.x, this.y, this.radius * pulse);
      g.fillStyle(0xff2200, 0.05 + progress * 0.1);
      g.fillCircle(this.x, this.y, this.radius * pulse);
    } else if (this.phase === 'erupting') {
      const eruptElapsed = elapsed - 1000;
      const alpha = Math.max(0, 1 - eruptElapsed / 500);
      g.fillStyle(0xff4400, alpha * 0.4);
      g.fillCircle(this.x, this.y, this.radius * 1.2);
      g.fillStyle(0xffaa00, alpha * 0.6);
      g.fillCircle(this.x, this.y, this.radius * 0.5);
      g.lineStyle(3, 0xff6600, alpha);
      g.strokeCircle(this.x, this.y, this.radius * (1 + (1 - alpha) * 0.5));
    }
  }
}

// ---- Ice Patch ----
class IcePatch {
  constructor(x, y) {
    this.type = 'ice_patch';
    this.x = x; this.y = y;
    this.alive = true;
    this.startTime = Date.now();
    this.phase = 'active';
    this.radius = 80;
    this.duration = 6000;
  }

  update(dt, wizards) {
    if (Date.now() - this.startTime > this.duration) {
      this.alive = false;
      return;
    }
    // Apply ice friction to wizards standing on it
    wizards.forEach((w) => {
      if (!w.alive) return;
      const dx = w.x - this.x;
      const dy = w.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < this.radius) {
        w.inGravity = true; // reuse the reduced friction flag (0.999)
      }
    });
  }

  draw(g) {
    const elapsed = Date.now() - this.startTime;
    const lifePct = Math.max(0, 1 - elapsed / this.duration);
    g.fillStyle(0x88ddff, 0.12 * lifePct);
    g.fillCircle(this.x, this.y, this.radius);
    g.lineStyle(1.5, 0x88ddff, 0.25 * lifePct);
    g.strokeCircle(this.x, this.y, this.radius);
    // Inner sparkle
    g.fillStyle(0xccf0ff, 0.15 * lifePct);
    g.fillCircle(this.x, this.y, this.radius * 0.5);
  }
}

// ---- Wind Gust ----
class WindGust {
  constructor(angle, scene) {
    this.type = 'wind_gust';
    this.x = 0; this.y = 0;
    this.angle = angle;
    this.scene = scene;
    this.alive = true;
    this.startTime = Date.now();
    this.phase = 'active';
    this.duration = 2000;
    this.force = 1500;
  }

  update(dt, wizards) {
    if (Date.now() - this.startTime > this.duration) {
      this.alive = false;
      return;
    }
    const fx = Math.cos(this.angle) * this.force * dt;
    const fy = Math.sin(this.angle) * this.force * dt;
    wizards.forEach((w) => {
      if (!w.alive) return;
      w.knockbackVel.x += fx;
      w.knockbackVel.y += fy;
    });
  }

  draw(g) {
    // Wind arrows drawn at screen center (this is a global effect)
    // Minimal visual — just a directional indicator
    const elapsed = Date.now() - this.startTime;
    const alpha = Math.max(0, 1 - elapsed / this.duration) * 0.4;
    const cam = this.scene.cameras.main;
    const cx = cam.scrollX + cam.width / 2;
    const cy = cam.scrollY + cam.height / 2;
    for (let i = 0; i < 5; i++) {
      const offset = (elapsed * 0.3 + i * 80) % 400 - 200;
      const perpX = -Math.sin(this.angle);
      const perpY = Math.cos(this.angle);
      const ax = cx + Math.cos(this.angle) * offset + perpX * (i - 2) * 60;
      const ay = cy + Math.sin(this.angle) * offset + perpY * (i - 2) * 60;
      g.lineStyle(2, 0xaaaaaa, alpha);
      g.beginPath();
      g.moveTo(ax, ay);
      g.lineTo(ax + Math.cos(this.angle) * 30, ay + Math.sin(this.angle) * 30);
      g.strokePath();
      // Arrow head
      const tipX = ax + Math.cos(this.angle) * 30;
      const tipY = ay + Math.sin(this.angle) * 30;
      g.fillStyle(0xaaaaaa, alpha);
      g.fillTriangle(
        tipX, tipY,
        tipX - Math.cos(this.angle - 0.4) * 8, tipY - Math.sin(this.angle - 0.4) * 8,
        tipX - Math.cos(this.angle + 0.4) * 8, tipY - Math.sin(this.angle + 0.4) * 8,
      );
    }
  }
}

// ---- Meteor Impact (single small meteor from Meteor Shower) ----
class MeteorImpact {
  constructor(x, y) {
    this.type = 'meteor_impact';
    this.x = x; this.y = y;
    this.alive = true;
    this.startTime = Date.now();
    this.phase = 'warning'; // 'warning' → 'impact' → dead
    this.radius = 40;
    this.damage = 10;
    this.knockback = 500;
    this.hitTargets = new Set();
  }

  update(dt, wizards) {
    const elapsed = Date.now() - this.startTime;
    if (this.phase === 'warning' && elapsed > 800) {
      this.phase = 'impact';
      wizards.forEach((w) => {
        if (!w.alive || this.hitTargets.has(w.playerId)) return;
        const dx = w.x - this.x;
        const dy = w.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < this.radius + w.radius) {
          this.hitTargets.add(w.playerId);
          w.takeDamage(this.damage);
          w.lastHitBy = null;
          const len = dist > 0 ? dist : 1;
          w.applyKnockback((dx / len) * this.knockback, (dy / len) * this.knockback);
        }
      });
    }
    if (this.phase === 'impact' && elapsed > 1200) {
      this.alive = false;
    }
  }

  draw(g) {
    const elapsed = Date.now() - this.startTime;
    if (this.phase === 'warning') {
      const progress = Math.min(1, elapsed / 800);
      g.lineStyle(1.5, 0xcc2200, 0.2 + progress * 0.4);
      g.strokeCircle(this.x, this.y, this.radius * (0.8 + progress * 0.2));
      g.fillStyle(0xcc2200, 0.04 + progress * 0.08);
      g.fillCircle(this.x, this.y, this.radius);
    } else if (this.phase === 'impact') {
      const impactElapsed = elapsed - 800;
      const alpha = Math.max(0, 1 - impactElapsed / 400);
      g.fillStyle(0xff4400, alpha * 0.3);
      g.fillCircle(this.x, this.y, this.radius);
      g.lineStyle(2, 0xff6600, alpha * 0.8);
      g.strokeCircle(this.x, this.y, this.radius * (1 + (1 - alpha) * 0.3));
    }
  }
}
