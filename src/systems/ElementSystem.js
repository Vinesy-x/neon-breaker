/**
 * ElementSystem.js - 元素效果系统
 * 管理火/冰/雷三种元素弹的效果施加
 * 从 Game.js 提取
 */
const Config = require('../Config');
const Sound = require('./SoundManager');

class ElementSystem {
  constructor(game) {
    this.game = game;
  }

  /**
   * 施加火焰元素效果
   * @param {Brick} brick - 目标砖块
   * @param {number} elementLv - 元素等级
   */
  applyFire(brick, elementLv) {
    if (!brick.alive) return;
    var c = brick.getCenter();
    var dotDmg = Math.max(0.1, this.game.getBaseAttack() * 0.3 * elementLv);
    var duration = 1000 + elementLv * 500;
    this.game.dotSystem.add({
      brickRef: brick, x: c.x, y: c.y,
      damage: dotDmg, remaining: duration, tickMs: 500, tickTimer: 0,
      type: 'fire',
    });
    this.game.particles.emitHitSpark(c.x, c.y, '#FF4400');
  }

  /**
   * 施加冰冻元素效果
   * @param {Brick} brick - 目标砖块
   * @param {number} elementLv - 元素等级
   */
  applyIce(brick, elementLv) {
    if (!brick.alive || brick.frozen) return;
    brick.iceStacks = Math.min(5, (brick.iceStacks || 0) + 1);
    brick.iceDuration = 5000;
    // speedMult 由 Brick.updateStatus() 根据 iceStacks 自动计算（每层-10%）
    // 冰封禁锢：叠满5层冻结
    if (brick.iceStacks >= 5 && this.game.upgrades.shipTree.iceFreeze > 0) {
      brick.frozen = true;
      brick.frozenTimer = 2000 + this.game.upgrades.shipTree.iceFreeze * 500;
      brick.speedMult = 0;
    }
    this.game.particles.emitHitSpark(brick.getCenter().x, brick.getCenter().y, '#44DDFF');
  }

  /**
   * 施加雷电元素效果
   * @param {Brick} brick - 目标砖块
   * @param {number} elementLv - 元素等级
   * @param {number} bulletDmg - 子弹伤害（用于电弧伤害计算）
   */
  applyThunder(brick, elementLv, bulletDmg) {
    if (!brick.alive) return;
    // 附加感电状态
    brick.shockStacks = Math.min(3, (brick.shockStacks || 0) + 1);
    brick.shockDuration = 5000;
    // 立即电弧（温和版：最多2跳）
    var c = brick.getCenter();
    var chainCount = Math.min(elementLv, 2);
    var chainDmg = Math.max(0.1, bulletDmg * 0.2);  // 0.3→0.2 雷电链弧削弱
    var hit = new Set();
    var lastX = c.x, lastY = c.y;
    for (var ch = 0; ch < chainCount; ch++) {
      var nearest = null, nearDist = Infinity;
      for (var j = 0; j < this.game.bricks.length; j++) {
        if (!this.game.bricks[j].alive || hit.has(j)) continue;
        if (this.game.bricks[j] === brick) continue;
        var bc = this.game.bricks[j].getCenter();
        var d = (bc.x - lastX) * (bc.x - lastX) + (bc.y - lastY) * (bc.y - lastY);
        if (d < nearDist && d < 10000) { nearDist = d; nearest = { idx: j, brick: this.game.bricks[j] }; }
      }
      if (!nearest) break;
      hit.add(nearest.idx);
      var nc = nearest.brick.getCenter();
      // 被电弧击中的也附加感电
      nearest.brick.shockStacks = Math.min(3, (nearest.brick.shockStacks || 0) + 1);
      nearest.brick.shockDuration = 5000;
      this.game.combat.damageBrick(nearest.brick, chainDmg, 'shock_chain', 'energy');
      this.game.particles.emitHitSpark(nc.x, nc.y, '#FFF050');
      // 雷暴领域：电弧路径留电场
      if (this.game.upgrades.shipTree.shockField > 0) {
        this.game.dotSystem.add({
          brickRef: nearest.brick, x: nc.x, y: nc.y,
          damage: Math.max(0.1, this.game.getBaseAttack() * 0.1 * this.game.upgrades.shipTree.shockField),
          remaining: 3000, tickMs: 500, tickTimer: 0,
          type: 'shock_field',
        });
      }
      lastX = nc.x; lastY = nc.y;
    }
    if (chainCount > 0) Sound.lightning();
  }

  /**
   * 触发感电电弧（砖块受击时概率触发）
   * @param {Brick} sourceBrick - 感电源砖块
   * @param {number} damage - 电弧伤害
   */
  triggerShockArc(sourceBrick, damage) {
    var c = sourceBrick.getCenter();
    var hitCount = 0;
    for (var j = 0; j < this.game.bricks.length; j++) {
      var bk = this.game.bricks[j];
      if (!bk.alive || bk === sourceBrick) continue;
      var bc = bk.getCenter();
      var dist = Math.sqrt((bc.x - c.x) * (bc.x - c.x) + (bc.y - c.y) * (bc.y - c.y));
      if (dist < 100) {
        this.game.combat.damageBrick(bk, Math.max(0.1, damage), 'shock_arc', 'energy');
        this.game.particles.emitHitSpark(bc.x, bc.y, '#FFF050');
        hitCount++;
        if (hitCount >= 1) break; // 每次只电1个
      }
    }
  }

  /**
   * 根据元素类型施加效果
   * @param {string} element - 'fire' | 'ice' | 'thunder'
   * @param {Brick} brick - 目标砖块
   * @param {number} elementLv - 元素等级
   * @param {number} bulletDmg - 子弹伤害（雷电用）
   */
  applyElement(element, brick, elementLv, bulletDmg) {
    switch (element) {
      case 'fire': this.applyFire(brick, elementLv); break;
      case 'ice': this.applyIce(brick, elementLv); break;
      case 'thunder': this.applyThunder(brick, elementLv, bulletDmg); break;
    }
  }
}

module.exports = ElementSystem;
