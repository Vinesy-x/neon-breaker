/**
 * Particle.js - 粒子特效（含新被动特效）
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

  emitBrickBreak(x, y, w, h, color) {
    const count = 8;
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= Config.PARTICLE_MAX) break;
      const px = x + Math.random() * w;
      const py = y + Math.random() * h;
      const vx = (Math.random() - 0.5) * 6;
      const vy = (Math.random() - 0.5) * 6 - 2;
      const size = 2 + Math.random() * 4;
      this.particles.push(new Particle(px, py, vx, vy, color, 25 + Math.random() * 15, size));
    }
  }

  emitBossHit(x, y) {
    const count = 12;
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= Config.PARTICLE_MAX) break;
      const vx = (Math.random() - 0.5) * 8;
      const vy = (Math.random() - 0.5) * 8;
      const color = Config.NEON_COLORS[Math.floor(Math.random() * Config.NEON_COLORS.length)];
      this.particles.push(new Particle(x, y, vx, vy, color, 20, 3));
    }
  }

  emitCombo(x, y, combo) {
    const count = 4 + Math.min(combo, 10);
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= Config.PARTICLE_MAX) break;
      const vx = (Math.random() - 0.5) * 4;
      const vy = -Math.random() * 4 - 1;
      this.particles.push(new Particle(x, y, vx, vy, Config.NEON_YELLOW, 20, 2));
    }
  }

  /** 连锁闪电粒子 */
  emitChainLightning(x1, y1, x2, y2) {
    const count = 6;
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= Config.PARTICLE_MAX) break;
      const t = i / count;
      const px = x1 + (x2 - x1) * t + (Math.random() - 0.5) * 10;
      const py = y1 + (y2 - y1) * t + (Math.random() - 0.5) * 10;
      this.particles.push(new Particle(px, py, 0, 0, Config.NEON_CYAN, 12, 2));
    }
  }

  /** 爆炸粒子 */
  emitExplosion(cx, cy, radius) {
    const count = 16;
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= Config.PARTICLE_MAX) break;
      const angle = (Math.PI * 2 / count) * i;
      const speed = 2 + Math.random() * 3;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      this.particles.push(new Particle(cx, cy, vx, vy, Config.NEON_ORANGE, 18, 3));
    }
  }

  /** 砖块前移预警粒子（底部闪烁） */
  emitAdvanceWarning(gameAreaWidth) {
    const count = 10;
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= Config.PARTICLE_MAX) break;
      const px = Math.random() * gameAreaWidth;
      this.particles.push(new Particle(px, 50, 0, 1, 'rgba(255,50,50,0.6)', 15, 2));
    }
  }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      this.particles[i].update(dt);
      if (!this.particles[i].alive) {
        this.particles.splice(i, 1);
      }
    }
  }

  clear() {
    this.particles = [];
  }
}

module.exports = { Particle, ParticleManager };
