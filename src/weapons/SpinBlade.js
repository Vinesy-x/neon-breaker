/**
 * SpinBlade.js - 等离子旋刃
 * 丢出旋转刃持续移动切割，可追踪/回旋/吸经验
 */
const Weapon = require('./Weapon');
const Config = require('../Config');
const Sound = require('../systems/SoundManager');

class SpinBlade extends Weapon {
  constructor() {
    super('spinBlade');
    this.blades = [];
  }

  update(dtMs, ctx) {
    const dt = dtMs / 16.67;
    this.timer += dtMs;
    const interval = this.def.interval;

    if (this.timer >= interval) {
      this.timer = 0;
      this._launch(ctx);
    }

    const baseAttack = ctx.getBaseAttack ? ctx.getBaseAttack() : 1;
    const damage = this.getDamage(baseAttack);
    const giantLv = this.branches.giant || 0;
    const bounceLv = this.branches.bounce || 0;
    const homingLv = this.branches.homing || 0;
    const returnLv = this.branches.return || 0;
    const vortexLv = this.branches.vortex || 0;
    const size = 12 + giantLv * 12;
    const lcx = ctx.launcher.getCenterX(), lcy = ctx.launcher.y;

    for (let i = this.blades.length - 1; i >= 0; i--) {
      const b = this.blades[i];

      // === 追踪逻辑 ===
      if (homingLv > 0 && !b.returning) {
        const target = this._findNearestBrick(b.x, b.y, ctx);
        if (target) {
          const dx = target.x - b.x, dy = target.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const homingStrength = 0.03 * homingLv;
          b.vx += (dx / dist) * homingStrength * dt;
          b.vy += (dy / dist) * homingStrength * dt;
          // 限速
          const spd = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
          const maxSpd = 5;
          if (spd > maxSpd) { b.vx *= maxSpd / spd; b.vy *= maxSpd / spd; }
        }
      }

      // === 回旋逻辑 ===
      if (returnLv > 0) {
        if (!b.returning && b.life < b.maxLife * 0.4) {
          b.returning = true;
        }
        if (b.returning) {
          const dx = lcx - b.x, dy = lcy - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 20) {
            this.blades.splice(i, 1);
            continue;
          }
          const returnSpd = 0.1;
          b.vx += (dx / dist) * returnSpd * dt;
          b.vy += (dy / dist) * returnSpd * dt;
        }
      }

      // 移动
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.angle += (0.15 + giantLv * 0.05) * dt;
      b.life -= dtMs;
      b.size = size;

      // === 漩涡吸经验 ===
      if (vortexLv > 0 && ctx.expSystem) {
        const vortexRange = 60 + vortexLv * 30;
        const orbs = ctx.expSystem.orbs;
        for (let o of orbs) {
          const dx = b.x - o.x, dy = b.y - o.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < vortexRange && dist > 5) {
            const pull = 0.15 * vortexLv;
            o.vx += (dx / dist) * pull;
            o.vy += (dy / dist) * pull;
          }
        }
      }

      // === 弹墙反弹 ===
      if (bounceLv > 0) {
        if (b.x < size || b.x > Config.SCREEN_WIDTH - size) {
          b.vx = -b.vx;
          b.x = Math.max(size, Math.min(b.x, Config.SCREEN_WIDTH - size));
        }
        if (b.y < Config.SAFE_TOP + size || b.y > Config.SCREEN_HEIGHT * 0.75) {
          b.vy = -b.vy;
        }
      }

      // === tick伤害 ===
      b.tickTimer += dtMs;
      if (b.tickTimer >= (this.def.tickInterval || 200)) {
        b.tickTimer = 0;
        const hitRadius = size + (giantLv > 0 ? 8 : 0);

        for (let j = 0; j < ctx.bricks.length; j++) {
          const brick = ctx.bricks[j];
          if (!brick.alive) continue;
          const bc = brick.getCenter();
          if (Math.abs(b.x - bc.x) < brick.width / 2 + hitRadius &&
              Math.abs(b.y - bc.y) < brick.height / 2 + hitRadius) {
            ctx.damageBrick(brick, damage, 'spinBlade');
          }
        }

        if (ctx.boss && ctx.boss.alive) {
          if (Math.abs(b.x - ctx.boss.getCenterX()) < ctx.boss.width / 2 + hitRadius &&
              Math.abs(b.y - ctx.boss.getCenterY()) < ctx.boss.height / 2 + hitRadius) {
            ctx.damageBoss(damage, 'spinBlade');
          }
        }
      }

      if (b.life <= 0) this.blades.splice(i, 1);
    }
  }

  _findNearestBrick(sx, sy, ctx) {
    let nearest = null, nearDist = Infinity;
    for (const brick of ctx.bricks) {
      if (!brick.alive) continue;
      const bc = brick.getCenter();
      const d = Math.sqrt((bc.x - sx) ** 2 + (bc.y - sy) ** 2);
      if (d < nearDist) { nearDist = d; nearest = { x: bc.x, y: bc.y }; }
    }
    return nearest;
  }

  _launch(ctx) {
    const count = 1 + (this.branches.count || 0);
    const speedMult = 1 + (this.branches.speed || 0) * 0.3;
    const durationMs = (3 + (this.branches.duration || 0)) * 1000;
    const cx = ctx.launcher.getCenterX(), cy = ctx.launcher.y - 20;

    for (let i = 0; i < count; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.6;
      const spd = 3 * speedMult;
      this.blades.push({
        x: cx + (i - (count - 1) / 2) * 15, y: cy,
        vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd,
        angle: 0, life: durationMs, maxLife: durationMs, size: 12,
        tickTimer: 0, returning: false,
        trail: [], // 拖尾点
      });
    }
    Sound.bulletShoot();
  }

  getRenderData() {
    return {
      blades: this.blades,
      color: this.def.color,
      vortexLv: this.branches.vortex || 0,
      giantLv: this.branches.giant || 0,
    };
  }

  getWingData(lcx, lcy) {
    return { type: 'spinBlade', color: this.def.color, x: lcx, y: lcy };
  }
}

module.exports = SpinBlade;
