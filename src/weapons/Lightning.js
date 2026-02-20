/**
 * Lightning.js - lightning 武器
 */
const Weapon = require('./Weapon');
const Config = require('../Config');
const Sound = require('../systems/SoundManager');

class LightningWeapon extends Weapon {
  constructor() {
    super('lightning');
    this.bolts = [];
  }

  update(dtMs, ctx) {
    const dt = dtMs / 16.67;
    this.timer += dtMs;
    const interval = this.def.interval * Math.pow(0.8, this.branches.freq || 0);

    if (this.timer >= interval) {
      this.timer = 0;
      const times = 1 + (this.branches.storm || 0);
      for (let t = 0; t < times; t++) this._fire(ctx);
    }

    for (let i = this.bolts.length - 1; i >= 0; i--) {
      this.bolts[i].alpha -= 0.04 * dt;
      if (this.bolts[i].alpha <= 0) this.bolts.splice(i, 1);
    }
  }

  _fire(ctx) {
    const baseAttack = ctx.getBaseAttack ? ctx.getBaseAttack() : 1;
    const damage = this.getDamage(baseAttack);
    const aliveBricks = ctx.bricks.filter(b => b.alive);
    if (aliveBricks.length === 0 && !(ctx.boss && ctx.boss.alive)) return;

    const startX = ctx.launcher.getCenterX(), startY = ctx.launcher.y - 10;
    const points = [{ x: startX, y: startY }];
    const hit = new Set();
    let lastX = startX, lastY = startY;
    const chains = 1 + (this.branches.chains || 0);
    const overloadLv = this.branches.overload || 0;
    const paralyzeLv = this.branches.paralyze || 0;

    for (let c = 0; c < chains; c++) {
      let nearest = null, nearDist = Infinity;
      for (let i = 0; i < aliveBricks.length; i++) {
        if (hit.has(i)) continue;
        const bc = aliveBricks[i].getCenter();
        const dx = bc.x - lastX, dy = bc.y - lastY;
        const d = dx * dx + dy * dy;
        if (d < nearDist) { nearDist = d; nearest = { idx: i, brick: aliveBricks[i] }; }
      }
      if (!nearest) {
        if (ctx.boss && ctx.boss.alive && !hit.has('boss')) {
          hit.add('boss');
          points.push({ x: ctx.boss.getCenterX(), y: ctx.boss.getCenterY() });
          ctx.damageBoss(damage);
        }
        break;
      }
      hit.add(nearest.idx);
      const bc = nearest.brick.getCenter();
      points.push({ x: bc.x, y: bc.y });
      ctx.damageBrick(nearest.brick, damage, 'lightning');
      if (paralyzeLv > 0 && nearest.brick.alive) {
        nearest.brick.speedMult = Math.max(0.3, nearest.brick.speedMult * (1 - paralyzeLv * 0.15));
      }
      lastX = bc.x; lastY = bc.y;
      if (overloadLv > 0 && c === chains - 1) {
        this._explodeAt(bc.x, bc.y, 40, damage, ctx);
      }
    }

    if (points.length > 1) {
      this.bolts.push({ points: points, alpha: 1.0 });
      Sound.lightning();
    }
  }

  _explodeAt(cx, cy, radius, damage, ctx) {
    for (let i = 0; i < ctx.bricks.length; i++) {
      const brick = ctx.bricks[i];
      if (!brick.alive) continue;
      const bc = brick.getCenter();
      if (Math.sqrt((bc.x - cx) ** 2 + (bc.y - cy) ** 2) <= radius) {
        ctx.damageBrick(brick, Math.floor(damage * 0.5), 'lightning_aoe');
      }
    }
    if (ctx.particles) ctx.particles.emitBrickBreak(cx - 10, cy - 10, 20, 20, Config.NEON_YELLOW);
  }

  getRenderData() { return { bolts: this.bolts, color: this.def.color }; }
  getWingData(lcx, lcy) { return { type: 'lightning', color: this.def.color, x: lcx, y: lcy }; }
}

// ===== 追踪导弹 =====

module.exports = LightningWeapon;
