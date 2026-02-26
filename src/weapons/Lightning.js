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
    return Math.max(0.1, baseAttack * this.def.basePct * (1 + (this.branches.damage || 0) * 0.5));
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

    const chains = 3 + (this.branches.chains || 0) * 2; // 基础3跳，升级+2
    const chargeLv = this.branches.charge || 0;   // 蓄能：每跳+25%伤害
    const shockLv = this.branches.shock || 0;     // 感电：DOT
    const echoLv = this.branches.echo || 0;       // 回响：链末端再次释放
    const overloadLv = this.branches.overload || 0;
    const paralyzeLv = this.branches.paralyze || 0;

    // === 奇点引擎联动：引力透镜增加跳距 ===
    let lensJumpBonus = 0;
    const gravityWell = ctx.upgrades && ctx.upgrades.weapons && ctx.upgrades.weapons.gravityWell;
    if (gravityWell) {
      const lensLv = gravityWell.getBranch('lens') || 0;
      if (lensLv > 0) {
        lensJumpBonus = 0.5 * lensLv; // 每级+50%跳距
      }
    }

    for (let c = 0; c < chains; c++) {
      // 蓄能：每次链跳伤害递增
      const chainMult = 1 + c * chargeLv * 0.25;
      const damage = Math.floor(baseDamage * chainMult);

      let nearest = null, bestScore = -Infinity;
      const dangerY = Config.SCREEN_HEIGHT * Config.BRICK_DANGER_Y;
      const baseJumpDist = 300 * (1 + lensJumpBonus); // 引力透镜加成跳距
      for (let i = 0; i < aliveBricks.length; i++) {
        if (hit.has(i)) continue;
        const bc = aliveBricks[i].getCenter();
        const dx = bc.x - lastX, dy = bc.y - lastY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        // 越靠前(y越大)分数越高，距离远的扣分
        const frontScore = bc.y / dangerY; // 0~1，越靠前越高
        const distPenalty = dist / baseJumpDist; // 距离惩罚（引力透镜放宽）
        const score = frontScore * 3 - distPenalty;
        if (score > bestScore) { bestScore = score; nearest = { idx: i, brick: aliveBricks[i] }; }
      }
      
      // === 奇点引擎联动：检测负能量砖块并充能 ===
      if (gravityWell && !nearest) {
        const negaBrick = this._findNearestNegaBrick(gravityWell, lastX, lastY, 300 * (1 + lensJumpBonus));
        if (negaBrick) {
          points.push({ x: negaBrick.x, y: negaBrick.y });
          gravityWell.damageNegaBrick(negaBrick, baseDamage * chainMult);
          lastX = negaBrick.x; lastY = negaBrick.y;
          continue; // 继续链跳
        }
      }

      if (!nearest) {
        // 没有更多砖块，尝试打Boss
        if (ctx.boss && ctx.boss.alive && !hit.has('boss')) {
          hit.add('boss');
          points.push({ x: ctx.boss.getCenterX(), y: ctx.boss.getCenterY() });
          ctx.damageBoss(damage, "lightning");
        }
        break;
      }

      hit.add(nearest.idx);
      const bc = nearest.brick.getCenter();
      points.push({ x: bc.x, y: bc.y });
      ctx.damageBrick(nearest.brick, damage, 'lightning', 'energy');

      // 麻痹：减速
      if (paralyzeLv > 0 && nearest.brick.alive) {
        nearest.brick.speedMult = Math.max(0.3, nearest.brick.speedMult * (1 - paralyzeLv * 0.15));
      }

      // 感电：DOT (通过ctx.addDot传递)
      if (shockLv > 0 && nearest.brick.alive && ctx.addDot) {
        const dotDamage = Math.floor(baseDamage * 0.2 * shockLv);
        ctx.addDot(nearest.brick, dotDamage, 3000, 'shock'); // 3秒DOT
      }

      lastX = bc.x; lastY = bc.y;

      // 链末端特效
      if (c === chains - 1) {
        // 超载：爆炸AOE
        if (overloadLv > 0) {
          this._explodeAt(bc.x, bc.y, 45, damage * 0.6, ctx);
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
        ctx.damageBrick(brick, damage, 'lightning_aoe', 'energy');
      }
    }
    if (ctx.particles) ctx.particles.emitBrickBreak(cx - 10, cy - 10, 20, 20, this.def.color);
  }

  /**
   * 寻找最近的负能量砖块（奇点引擎联动）
   */
  _findNearestNegaBrick(gravityWell, fromX, fromY, maxDist) {
    if (!gravityWell.negaBricks || gravityWell.negaBricks.length === 0) return null;
    let best = null, bestDist = Infinity;
    for (let i = 0; i < gravityWell.negaBricks.length; i++) {
      const nb = gravityWell.negaBricks[i];
      const dx = nb.x - fromX, dy = nb.y - fromY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < maxDist && dist < bestDist) {
        bestDist = dist;
        best = nb;
      }
    }
    return best;
  }

  getRenderData() { return { bolts: this.bolts, explosions: this.explosions, color: this.def.color }; }
  getWingData(lcx, lcy) { return { type: 'lightning', color: this.def.color, x: lcx, y: lcy }; }
}

module.exports = LightningWeapon;
