/**
 * Particle.js - 粒子特效系统
 */
const Config = require('./Config');

class Particle {
  constructor(x, y, vx, vy, color, life, size) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.color = color;
    this.life = life || 30;
    this.maxLife = this.life;
    this.size = size || 3;
    this.alive = true;
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;
    if (this.life <= 0) this.alive = false;
  }

  getAlpha() {
    return Math.max(0, this.life / this.maxLife);
  }
}

class ParticleManager {
  constructor() {
    this.particles = [];
  }

  _add(x, y, vx, vy, color, life, size) {
    if (this.particles.length >= Config.PARTICLE_MAX) return;
    this.particles.push(new Particle(x, y, vx, vy, color, life, size));
  }

  emitBrickBreak(x, y, w, h, color) {
    for (let i = 0; i < 10; i++) {
      this._add(
        x + Math.random() * w, y + Math.random() * h,
        (Math.random() - 0.5) * 7, (Math.random() - 0.5) * 7 - 2,
        color, 22 + Math.random() * 15, 2 + Math.random() * 4
      );
    }
  }

  emitBossHit(x, y) {
    for (let i = 0; i < 12; i++) {
      const color = Config.NEON_COLORS[Math.floor(Math.random() * Config.NEON_COLORS.length)];
      this._add(x, y, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8, color, 20, 3);
    }
  }

  emitCombo(x, y, combo) {
    const count = 4 + Math.min(combo, 12);
    for (let i = 0; i < count; i++) {
      this._add(x, y, (Math.random() - 0.5) * 5, -Math.random() * 5 - 1, Config.NEON_YELLOW, 20, 2);
    }
  }

  emitHitSpark(x, y, color) {
    for (let i = 0; i < 4; i++) {
      this._add(x, y, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4, color || '#FFFFFF', 10, 2);
    }
  }

  emitAdvanceWarning(gameAreaWidth) {
    for (let i = 0; i < 8; i++) {
      this._add(Math.random() * gameAreaWidth, 50, 0, 1, 'rgba(255,50,50,0.6)', 15, 2);
    }
  }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      this.particles[i].update(dt);
      if (!this.particles[i].alive) this.particles.splice(i, 1);
    }
  }

  clear() { this.particles = []; }
}

module.exports = { Particle, ParticleManager };
