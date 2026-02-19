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
    for (let i = 0; i < 16; i++) {
      this._add(
        x + Math.random() * w, y + Math.random() * h,
        (Math.random() - 0.5) * 9, (Math.random() - 0.5) * 9 - 3,
        color, 25 + Math.random() * 18, 2 + Math.random() * 5
      );
    }
    // 额外白色闪光碎片
    for (let i = 0; i < 4; i++) {
      this._add(
        x + w / 2, y + h / 2,
        (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12,
        '#FFFFFF', 10, 1 + Math.random() * 2
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
    const count = 6 + Math.min(combo, 16);
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 / count) * i;
      const speed = 3 + Math.random() * 3;
      this._add(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed - 2, Config.NEON_YELLOW, 22, 2 + Math.random() * 2);
    }
    // 爆发光环
    if (combo >= 10) {
      for (let i = 0; i < 8; i++) {
        const angle = (Math.PI * 2 / 8) * i;
        this._add(x, y, Math.cos(angle) * 6, Math.sin(angle) * 6, '#FFFFFF', 15, 3);
      }
    }
  }

  emitHitSpark(x, y, color) {
    for (let i = 0; i < 6; i++) {
      this._add(x, y, (Math.random() - 0.5) * 5, (Math.random() - 0.5) * 5, color || '#FFFFFF', 12, 2);
    }
    // 冲击波小环（白色向外扩散）
    this._add(x, y, 0, 0, 'rgba(255,255,255,0.5)', 8, 6);
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
