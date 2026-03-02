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
    this._echoQueue = []; // 回响延迟队列 [{fireAt, depth}]
  }

  /** 闪电伤害 = baseAttack × basePct × (1 + damageLv × 0.5) */
  getDamage(baseAttack, ctx) {
    var shopMult = 1.0;
    if (ctx && ctx.saveManager) shopMult = ctx.saveManager.getWeaponDmgMultiplier('lightning');
    return Math.max(0.1, baseAttack * this.def.basePct * shopMult * (1 + (this.branches.damage || 0) * 0.5) * (this._dualDmgMult || 1.0));
  }

  update(dtMs, ctx) {
    // thorGod被动：每60秒全屏闪电（读配置thorInterval）
    if (ctx && ctx.saveManager && ctx.saveManager.hasWeaponPassive('lightning', 'thorGod')) {
      this._thorTimer = (this._thorTimer || 0) + dtMs;
      var thorCD = (this.def.thorInterval || 60000);
      if (this._thorTimer >= thorCD) {
        this._thorTimer = 0;
        // 全屏闪电：对所有砖块造成1次伤害
        var thorDmg = this.getDamage(ctx.getBaseAttack(), ctx) * 1;
        for (var ti = 0; ti < ctx.bricks.length; ti++) {
          if (ctx.bricks[ti].alive) ctx.damageBrick(ctx.bricks[ti], thorDmg, 'lightning_thor', 'energy');
        }
        // 全屏闪光效果
        this.bolts.push({ points: [{x:0,y:0},{x:ctx.gameWidth,y:ctx.gameHeight}], alpha: 2.0, isThor: true });
      }
    }
    // 处理回响延迟队列（基于游戏时间而非真实时间）
    for (var ei = this._echoQueue.length - 1; ei >= 0; ei--) {
      if (ctx.elapsedMs >= this._echoQueue[ei].fireAt) {
        var eq = this._echoQueue.splice(ei, 1)[0];
        this._fire(ctx, eq.depth);
      }
    }
    const dt = dtMs / 16.67;
    this.timer += dtMs;
    // CD由外部养成控制
    const interval = this._getInterval(ctx);

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
    const baseDamage = this.getDamage(baseAttack, ctx);
    const aliveBricks = ctx.bricks.filter(b => b.alive);
    if (aliveBricks.length === 0 && !(ctx.boss && ctx.boss.alive)) return;

    const startX = ctx.launcher.getCenterX(), startY = ctx.launcher.y - 10;
    const points = [{ x: startX, y: startY }];
    const hit = new Set();
    let lastX = startX, lastY = startY;

    // 基础链数由外部养成爽点控制，战斗分支额外+2/级
    const baseChains = this._getBaseChains(ctx);
    const chains = baseChains + (this.branches.chains || 0) * 2;
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
      // chainNoDecay被动：每跳伤害+5%
      const hasChainBoost = ctx && ctx.saveManager && ctx.saveManager.hasWeaponPassive('lightning', 'chainNoDecay');
      const chainMult = (1 + c * chargeLv * 0.25) * (hasChainBoost ? (1 + c * 0.05) : 1.0);
      const damage = Math.round(baseDamage * chainMult * 10) / 10;

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
      // shockMark被动：受伤+15%
      if (ctx.saveManager && ctx.saveManager.hasWeaponPassive('lightning', 'shockMark') && nearest.brick.alive) {
        nearest.brick._shockMark = ctx.elapsedMs + 3000; // 标记3秒
      }
      ctx.damageBrick(nearest.brick, damage, 'lightning', 'energy');

      // 麻痹：叠加感电（通过BuffSystem）
      if (paralyzeLv > 0 && nearest.brick.alive && ctx.buffSystem) {
        ctx.buffSystem.applyShock(nearest.brick, paralyzeLv);
      }

      // 感电：统一走BuffSystem（电弧触发+穿甲弹烈性反应）
      if (shockLv > 0 && nearest.brick.alive && ctx.buffSystem) {
        ctx.buffSystem.applyShock(nearest.brick, shockLv);
      }

      lastX = bc.x; lastY = bc.y;

      // 链末端特效
      if (c === chains - 1) {
        // residualField被动：留电场持续伤害2秒
        if (ctx.saveManager && ctx.saveManager.hasWeaponPassive('lightning', 'residualField') && ctx.addDot) {
          // 电场对附近砖块持续伤
          for (let ei = 0; ei < aliveBricks.length; ei++) {
            var ebc = aliveBricks[ei].getCenter();
            if (Math.sqrt((ebc.x - bc.x) ** 2 + (ebc.y - bc.y) ** 2) <= 60) {
              ctx.addDot(aliveBricks[ei], Math.round(baseDamage * 0.15 * 10) / 10, 2000, 'electric_field');
            }
          }
        }
        // 超载：爆炸AOE
        if (overloadLv > 0) {
          this._explodeAt(bc.x, bc.y, 45, damage * 0.6, ctx);
        }
        // 回响：概率再次释放
        if (echoLv > 0 && Math.random() < echoLv * 0.2) {
          this._echoQueue.push({ fireAt: ctx.elapsedMs + 150, depth: echoDepth + 1 });
        }
      }
    }

    if (points.length > 1) {
      this.bolts.push({ points: points, alpha: 1.0 });
      Sound.lightning();
    }

    // dualChain被动：第2道闪电
    if (echoDepth === 0 && ctx.saveManager && ctx.saveManager.hasWeaponPassive('lightning', 'dualChain')) {
      if (!this._dualFired) {
        this._dualDmgMult = 0.5;
        this._dualFired = true;
        this._fire(ctx, 1); // depth=1 防止无限
        this._dualDmgMult = 1.0;
        this._dualFired = false;
      }
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

  _getInterval(ctx) {
    if (ctx.saveManager) {
      // 闪电链没有CD爽点，用默认interval
      // CD由外部养成的其他途径（如被动）控制
    }
    return this.def.interval;
  }

  _getBaseChains(ctx) {
    // 爽点属性：链数，基础3，每5级+1
    if (ctx.saveManager) {
      var ss = ctx.saveManager.getWeaponSweetSpot('lightning');
      if (ss !== null) return ss;
    }
    return 3;
  }

  getRenderData() { return { bolts: this.bolts, explosions: this.explosions, color: this.def.color }; }
  getWingData(lcx, lcy) { return { type: 'lightning', color: this.def.color, x: lcx, y: lcy }; }
}

module.exports = LightningWeapon;
