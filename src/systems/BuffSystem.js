/**
 * BuffSystem.js - 通用Buff系统 v1.0
 * 
 * 统一管理灼烧/冰缓/冻结/感电的叠加、消退、触发
 * 武器和飞机只负责调用 applyXxx()，不关心具体效果逻辑
 * 
 * 所有数值来自 BuffConfig.js
 */
const BC = require('../config/BuffConfig');

class BuffSystem {
  constructor(game) {
    this.game = game;
  }

  // =========================================================
  //  公开接口 —— 武器/飞机调这些
  // =========================================================

  /**
   * 叠加灼烧
   * @param {Brick|Boss} target - 目标
   * @param {number} stacks - 叠加层数（默认1）
   */
  applyBurn(target, stacks) {
    if (!target || !target.alive) return;
    stacks = stacks || 1;
    var b = this._ensureBuff(target, 'burn');
    b.stacks = Math.min(BC.burn.maxStacks, b.stacks + stacks);
    // 重置消退计时（新叠加刷新）
    b.decayTimer = BC.burn.decayInterval;
  }

  /**
   * 叠加冰缓
   * @param {Brick|Boss} target - 目标
   * @param {number} stacks - 叠加层数（默认1）
   */
  applyChill(target, stacks) {
    if (!target || !target.alive) return;
    stacks = stacks || 1;
    var b = this._ensureBuff(target, 'chill');
    // 冻结过程中不叠加冰缓（但记录，解冻后不触发新冻结）
    if (target._frozen) return;
    b.stacks = Math.min(BC.chill.maxStacks, b.stacks + stacks);
    b.decayTimer = BC.chill.decayInterval;
    // 满层 → 转化冻结
    if (BC.chill.freezeOnMax && b.stacks >= BC.chill.maxStacks) {
      this._triggerFreeze(target);
    }
  }

  /**
   * 叠加感电
   * @param {Brick|Boss} target - 目标
   * @param {number} stacks - 叠加层数（默认1）
   */
  applyShock(target, stacks) {
    if (!target || !target.alive) return;
    stacks = stacks || 1;
    var b = this._ensureBuff(target, 'shock');
    b.stacks = Math.min(BC.shock.maxStacks, b.stacks + stacks);
    b.decayTimer = BC.shock.decayInterval;
  }

  /**
   * 能量伤害命中时调用 —— 判定是否触发电弧
   * @param {Brick|Boss} target - 被命中的目标
   * @param {number} damage - 本次伤害值
   */
  onEnergyHit(target, damage) {
    if (!target || !target.alive) return;
    var b = this._getBuff(target, 'shock');
    if (!b || b.stacks <= 0) return;
    var chance = b.stacks * BC.shock.arcChancePerStack;
    if (Math.random() < chance) {
      this._triggerArc(target, damage);
    }
  }

  /**
   * 获取目标的冰缓减速乘数
   * @returns {number} 0~1，1=无减速
   */
  getSlowMult(target) {
    if (target._frozen) return 0;
    var b = this._getBuff(target, 'chill');
    if (!b || b.stacks <= 0) return 1;
    return Math.max(0, 1 - b.stacks * BC.chill.slowPerStack);
  }

  /**
   * 获取冻结增伤乘数
   * @param {string} damageType - 伤害类型
   * @returns {number} 1 或 1+bonus
   */
  getFreezeDamageMult(target, damageType) {
    if (!target._frozen) return 1;
    if (damageType === 'ice') return 1 + BC.freeze.iceDamageBonus;
    return 1;
  }

  /**
   * 查询buff层数
   */
  getStacks(target, buffType) {
    var b = this._getBuff(target, buffType);
    return b ? b.stacks : 0;
  }

  /**
   * 目标是否冻结
   */
  isFrozen(target) {
    return !!target._frozen;
  }

  // =========================================================
  //  每帧更新
  // =========================================================

  /**
   * @param {number} dtMs - 帧间隔(ms)
   * @param {Array} targets - 所有砖块+boss的数组
   */
  update(dtMs, targets) {
    for (var i = 0; i < targets.length; i++) {
      var t = targets[i];
      if (!t.alive) continue;
      this._updateBurn(t, dtMs);
      this._updateChill(t, dtMs);
      this._updateFreeze(t, dtMs);
      this._updateShock(t, dtMs);
    }
  }

  // =========================================================
  //  内部 —— Buff存储
  // =========================================================

  _ensureBuff(target, type) {
    if (!target._buffs) target._buffs = {};
    if (!target._buffs[type]) {
      target._buffs[type] = { stacks: 0, tickTimer: 0, decayTimer: 0 };
    }
    return target._buffs[type];
  }

  _getBuff(target, type) {
    return target._buffs ? target._buffs[type] : null;
  }

  // =========================================================
  //  内部 —— 灼烧
  // =========================================================

  _updateBurn(target, dtMs) {
    var b = this._getBuff(target, 'burn');
    if (!b || b.stacks <= 0) return;

    // tick伤害
    b.tickTimer += dtMs;
    while (b.tickTimer >= BC.burn.tickInterval) {
      b.tickTimer -= BC.burn.tickInterval;
      var hp = target.hp || target.maxHp || 1;
      var dmgPerStack = hp * BC.burn.damagePerStack;
      // Boss减伤
      if (target.isBoss) dmgPerStack *= (1 - BC.burn.bossReduction);
      var totalDmg = dmgPerStack * b.stacks;
      if (totalDmg > 0 && this.game.combat) {
        this.game.combat.damageBrick(target, totalDmg, 'burn', 'fire');
      }
    }

    // 消退
    b.decayTimer -= dtMs;
    while (b.decayTimer <= 0 && b.stacks > 0) {
      b.stacks = Math.max(0, b.stacks - BC.burn.decayAmount);
      b.decayTimer += BC.burn.decayInterval;
    }
    if (b.stacks <= 0) {
      // 余烬爆破：灼烧自然消退时爆炸AOE
      if (this.game.upgrades && this.game.upgrades.shipTree.fireExplosion > 0) {
        this._emberExplosion(target);
      }
      b.tickTimer = 0; b.decayTimer = 0;
    }
  }

  // =========================================================
  //  内部 —— 冰缓
  // =========================================================

  _updateChill(target, dtMs) {
    if (target._frozen) return; // 冻结中不消退冰缓
    var b = this._getBuff(target, 'chill');
    if (!b || b.stacks <= 0) return;

    b.decayTimer -= dtMs;
    while (b.decayTimer <= 0 && b.stacks > 0) {
      b.stacks = Math.max(0, b.stacks - BC.chill.decayAmount);
      b.decayTimer += BC.chill.decayInterval;
    }
    if (b.stacks <= 0) { b.decayTimer = 0; }
  }

  // =========================================================
  //  内部 —— 冻结
  // =========================================================

  _triggerFreeze(target) {
    // 冻结中免疫
    if (target._frozen) return;

    // 清除冰缓
    if (BC.chill.clearOnFreeze) {
      var cb = this._getBuff(target, 'chill');
      if (cb) { cb.stacks = 0; cb.decayTimer = 0; }
    }

    // 计算持续时间（Boss衰减）
    var dur = BC.freeze.duration;
    if (target.isBoss) {
      var count = target._freezeCount || 0;
      dur *= Math.pow(1 - BC.freeze.bossDecayPerFreeze, count);
      target._freezeCount = count + 1;
    }

    target._frozen = true;
    target._freezeTimer = dur;

    // 粒子特效
    if (this.game.particles && target.getCenter) {
      var c = target.getCenter();
      this.game.particles.emitHitSpark(c.x, c.y, '#88EEFF');
    }
  }

  _updateFreeze(target, dtMs) {
    if (!target._frozen) return;
    target._freezeTimer -= dtMs;
    if (target._freezeTimer <= 0) {
      target._frozen = false;
      target._freezeTimer = 0;
    }
  }

  // =========================================================
  //  内部 —— 感电
  // =========================================================

  _updateShock(target, dtMs) {
    var b = this._getBuff(target, 'shock');
    if (!b || b.stacks <= 0) return;

    b.decayTimer -= dtMs;
    while (b.decayTimer <= 0 && b.stacks > 0) {
      b.stacks = Math.max(0, b.stacks - BC.shock.decayAmount);
      b.decayTimer += BC.shock.decayInterval;
    }
    if (b.stacks <= 0) { b.decayTimer = 0; }
  }

  /**
   * 余烬爆破：灼烧完全消退时的范围爆炸
   */
  _emberExplosion(target) {
    if (!target.getCenter || !this.game.bricks) return;
    var ec = target.getCenter();
    var lv = this.game.upgrades.shipTree.fireExplosion || 1;
    var aoeDmg = Math.max(0.1, (target.maxHp || 1) * 0.05 * lv);
    for (var i = 0; i < this.game.bricks.length; i++) {
      var eb = this.game.bricks[i];
      if (!eb.alive || eb === target) continue;
      var ebc = eb.getCenter();
      var ed = Math.sqrt((ebc.x - ec.x) * (ebc.x - ec.x) + (ebc.y - ec.y) * (ebc.y - ec.y));
      if (ed < 60) {
        if (this.game.combat) this.game.combat.damageBrick(eb, aoeDmg, 'fire_explosion', 'fire');
      }
    }
    if (this.game.particles) this.game.particles.emitHitSpark(ec.x, ec.y, '#FF8844');
  }

  /**
   * 电弧：对周围随机1块砖造成溅射伤害
   */
  _triggerArc(source, triggerDamage) {
    if (!this.game.bricks) return;
    var sc = source.getCenter ? source.getCenter() : { x: source.x, y: source.y };
    var arcDmg = triggerDamage * BC.shock.arcDamageRatio;
    if (arcDmg < 0.1) arcDmg = 0.1;

    // 收集范围内候选
    var candidates = [];
    var range2 = BC.shock.arcRange * BC.shock.arcRange;
    for (var i = 0; i < this.game.bricks.length; i++) {
      var bk = this.game.bricks[i];
      if (!bk.alive || bk === source) continue;
      var bc = bk.getCenter();
      var d2 = (bc.x - sc.x) * (bc.x - sc.x) + (bc.y - sc.y) * (bc.y - sc.y);
      if (d2 <= range2) candidates.push(bk);
    }
    if (candidates.length === 0) return;

    // 随机选目标
    var count = Math.min(BC.shock.arcTargets, candidates.length);
    for (var t = 0; t < count; t++) {
      var idx = Math.floor(Math.random() * candidates.length);
      var hit = candidates.splice(idx, 1)[0];
      // 造成能量伤害
      if (this.game.combat) {
        this.game.combat.damageBrick(hit, arcDmg, 'shock_arc', BC.shock.arcDamageType);
      }
      // 粒子
      if (this.game.particles && hit.getCenter) {
        var hc = hit.getCenter();
        this.game.particles.emitHitSpark(hc.x, hc.y, '#FFF050');
      }
      // 电弧连锁感电
      if (Math.random() < BC.shock.arcShockChance) {
        this.applyShock(hit, BC.shock.arcShockStacks);
      }
    }
  }
}

module.exports = BuffSystem;
