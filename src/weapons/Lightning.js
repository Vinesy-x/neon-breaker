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
    this.explosions = [];
  }

  /** 闪电伤害 = baseAttack × basePct × (1 + damageLv × 0.5) */
  getDamage(baseAttack) {
    return Math.max(1, Math.floor(baseAttack * this.def.basePct * (1 + (this.branches.damage || 0) * 0.5)));
  }

  update(dtMs, ctx) {
    const dt = dtMs / 16.67;
    this.timer += dtMs;
    const interval = this.def.interval * Math.pow(0.8, this.branches.freq || 0);

    if (this.timer >= interval) {
      this.timer = 0;
      const times = 1 + (this.branches.storm || 0);
      for (let t = 0; t < times; t++) this._fire(ctx, 0);
    }

    // 闪电淡出
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      this.bolts[i].alpha -= 0.025 * dt;
      if (this.bolts[i].alpha <= 0) this.bolts.splice(i, 1);
    }

    // 爆炸淡出
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      this.explosions[i].alpha -= 0.05 * dt;
      if (this.explosions[i].alpha <= 0) this.explosions.splice(i, 1);
    }
  }

  _fire(ctx, echoDepth) {
    if (echoDepth > 3) return; // 防止无限回响

    const baseAttack = ctx.getBaseAttack ? ctx.getBaseAttack() : 1;
    const baseDamage = this.getDamage(baseAttack);
    const aliveBricks = ctx.bricks.filter(b => b.alive);
    if (aliveBricks.length === 0 && !(ctx.boss && ctx.boss.alive)) return;

    const startX = ctx.launcher.getCenterX(), startY = ctx.launcher.y - 10;
    const points = [{ x: startX, y: startY }];
    const hit = new Set();
    let lastX = startX, lastY = startY;

    const chains = 1 + (this.branches.chains || 0);
    const chargeLv = this.branches.charge || 0;   // 蓄能：每跳+25%伤害
    const shockLv = this.branches.shock || 0;     // 感电：DOT
    const echoLv = this.branches.echo || 0;       // 回响：链末端再次释放
    const overloadLv = this.branches.overload || 0;
    const paralyzeLv = this.branches.paralyze || 0;

    for (let c = 0; c < chains; c++) {
      // 蓄能：每次链跳伤害递增
      const chainMult = 1 + c * chargeLv * 0.25;
      const damage = Math.floor(baseDamage * chainMult);

      let nearest = null, nearDist = Infinity;
      for (let i = 0; i < aliveBricks.length; i++) {
        if (hit.has(i)) continue;
        const bc = aliveBricks[i].getCenter();
        const dx = bc.x - lastX, dy = bc.y - lastY;
        const d = dx * dx + dy * dy;
        if (d < nearDist) { nearDist = d; nearest = { idx: i, brick: aliveBricks[i] }; }
      }

      if (!nearest) {
        // 没有更多砖块，尝试打Boss
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

      // 麻痹：减速
      if (paralyzeLv > 0 && nearest.brick.alive) {
        nearest.brick.speedMult = Math.max(0.3, nearest.brick.speedMult * (1 - paralyzeLv * 0.15));
      }

      // 感电：DOT (通过ctx.addDot传递)
      if (shockLv > 0 && nearest.brick.alive && ctx.addDot) {
        const dotDamage = Math.floor(baseDamage * 0.3 * shockLv);
        ctx.addDot(nearest.brick, dotDamage, 2000, 'shock'); // 2秒DOT
      }

      lastX = bc.x; lastY = bc.y;

      // 链末端特效
      if (c === chains - 1) {
        // 超载：爆炸AOE
        if (overloadLv > 0) {
          this._explodeAt(bc.x, bc.y, 45, Math.floor(damage * 0.6), ctx);
        }
        // 回响：概率再次释放
        if (echoLv > 0 && Math.random() < echoLv * 0.2) {
          setTimeout(() => this._fire(ctx, echoDepth + 1), 150);
        }
      }
    }

    if (points.length > 1) {
      this.bolts.push({ points: points, alpha: 1.0 });
      Sound.lightning();
    }
  }

  _explodeAt(cx, cy, radius, damage, ctx) {
    this.explosions.push({ x: cx, y: cy, radius: radius, alpha: 1.0 });
    for (let i = 0; i < ctx.bricks.length; i++) {
      const brick = ctx.bricks[i];
      if (!brick.alive) continue;
      const bc = brick.getCenter();
      if (Math.sqrt((bc.x - cx) ** 2 + (bc.y - cy) ** 2) <= radius) {
        ctx.damageBrick(brick, damage, 'lightning_aoe');
      }
    }
    if (ctx.particles) ctx.particles.emitBrickBreak(cx - 10, cy - 10, 20, 20, this.def.color);
  }

  getRenderData() { return { bolts: this.bolts, explosions: this.explosions, color: this.def.color }; }
  getWingData(lcx, lcy) { return { type: 'lightning', color: this.def.color, x: lcx, y: lcy }; }
}

module.exports = LightningWeapon;
