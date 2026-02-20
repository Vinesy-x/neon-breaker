/**
 * SpinBlade.js - spinBlade 武器
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
    const size = (12 + giantLv * 12);

    for (let i = this.blades.length - 1; i >= 0; i--) {
      const b = this.blades[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.angle += 0.15 * dt;
      b.life -= dtMs;
      b.size = size;

      // 弹墙反弹
      if (bounceLv > 0) {
        if (b.x < size || b.x > Config.SCREEN_WIDTH - size) { b.vx = -b.vx; b.x = Math.max(size, Math.min(b.x, Config.SCREEN_WIDTH - size)); }
        if (b.y < size || b.y > Config.SCREEN_HEIGHT * 0.75) { b.vy = -b.vy; }
      }

      // tick伤害
      b.tickTimer += dtMs;
      if (b.tickTimer >= (this.def.tickInterval || 200)) {
        b.tickTimer = 0;
        for (let j = 0; j < ctx.bricks.length; j++) {
          const brick = ctx.bricks[j];
          if (!brick.alive) continue;
          const bc = brick.getCenter();
          if (Math.abs(b.x - bc.x) < brick.width / 2 + size && Math.abs(b.y - bc.y) < brick.height / 2 + size) {
            ctx.damageBrick(brick, damage, 'spinBlade');
          }
        }
        if (ctx.boss && ctx.boss.alive) {
          if (Math.abs(b.x - ctx.boss.getCenterX()) < ctx.boss.width / 2 + size &&
              Math.abs(b.y - ctx.boss.getCenterY()) < ctx.boss.height / 2 + size) {
            ctx.damageBoss(damage, "spinblade");
          }
        }
      }

      if (b.life <= 0) this.blades.splice(i, 1);
    }
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
        angle: 0, life: durationMs, size: 12,
        tickTimer: 0,
      });
    }
    Sound.bulletShoot();
  }

  getRenderData() { return { blades: this.blades, color: this.def.color }; }
  getWingData(lcx, lcy) { return { type: 'spinBlade', color: this.def.color, x: lcx, y: lcy }; }
}

module.exports = SpinBlade;
