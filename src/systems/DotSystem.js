/**
 * DotSystem.js - DOT(持续伤害)系统
 * 管理所有持续伤害效果：灼烧、感电、通用DOT
 * 从 Game.js 提取
 */

class DotSystem {
  constructor(game) {
    this.game = game;
    this.dots = []; // 替代原 game.burnDots
  }

  /** 重置所有DOT */
  reset() {
    this.dots = [];
  }

  /**
   * DOT类型 → 伤害类型映射
   * 新增DOT类型时在此注册，不再硬编码
   */
  static DAMAGE_TYPE_MAP = {
    fire: 'fire',
    fire_dot: 'fire',
    fire_explosion: 'fire',
    shock: 'energy',
    shock_field: 'energy',
    generic: 'physical',
  };

  /** 根据DOT type 获取伤害类型 */
  static getDamageType(dotType) {
    return DotSystem.DAMAGE_TYPE_MAP[dotType] || 'physical';
  }

  /**
   * 添加一个DOT效果
   * @param {object} dot - { brickRef, x, y, damage, remaining, tickMs, tickTimer, type, damageType? }
   */
  add(dot) {
    // 如果没有显式指定 damageType，从映射表推导
    if (!dot.damageType) {
      dot.damageType = DotSystem.getDamageType(dot.type);
    }
    this.dots.push(dot);
  }

  /**
   * 通用DOT接口（供武器技能使用）
   * @param {Brick} brick - 目标砖块
   * @param {number} damage - 每tick伤害
   * @param {number} duration - 持续时间(ms)
   * @param {string} type - DOT类型标识
   */
  addDot(brick, damage, duration, type) {
    if (!brick || !brick.alive) return;
    var c = brick.getCenter();
    this.add({
      brickRef: brick, x: c.x, y: c.y,
      damage: Math.max(0.1, damage), remaining: duration, tickMs: 500, tickTimer: 0,
      type: type || 'generic',
    });
  }

  /**
   * 检查砖块是否有指定类型的DOT
   * @param {Brick} brick
   * @param {string} type
   * @returns {boolean}
   */
  hasDot(brick, type) {
    for (var i = 0; i < this.dots.length; i++) {
      if (this.dots[i].brickRef === brick && this.dots[i].type === type) return true;
    }
    return false;
  }

  /**
   * 每帧更新所有DOT
   * @param {number} dtMs - 帧间隔(ms)
   */
  update(dtMs) {
    for (var i = this.dots.length - 1; i >= 0; i--) {
      var dot = this.dots[i];
      dot.remaining -= dtMs;
      dot.tickTimer += dtMs;
      if (dot.tickTimer >= dot.tickMs) {
        dot.tickTimer -= dot.tickMs;
        if (dot.brickRef && dot.brickRef.alive) {
          this.game.combat.damageBrick(dot.brickRef, dot.damage,
            dot.type || 'fire_dot', dot.damageType || DotSystem.getDamageType(dot.type));
        }
      }
      if (dot.remaining <= 0 || !dot.brickRef || !dot.brickRef.alive) {
        // 余烬爆破：灼烧自然结束且砖块还活着时爆炸
        if (dot.remaining <= 0 && dot.brickRef && dot.brickRef.alive
          && dot.type === 'fire' && this.game.upgrades.shipTree.fireExplosion > 0) {
          this._emberExplosion(dot);
        }
        this.dots.splice(i, 1);
      }
    }
  }

  /**
   * 余烬爆破：灼烧自然结束时的范围爆炸
   * @param {object} dot - 即将结束的火焰DOT
   */
  _emberExplosion(dot) {
    var ec = dot.brickRef.getCenter();
    var aoeDmg = Math.max(0.1, this.game.getBaseAttack() * 0.3 * this.game.upgrades.shipTree.fireExplosion);
    for (var ei = 0; ei < this.game.bricks.length; ei++) {
      var eb = this.game.bricks[ei];
      if (!eb.alive || eb === dot.brickRef) continue;
      var ebc = eb.getCenter();
      var ed = Math.sqrt((ebc.x - ec.x) * (ebc.x - ec.x) + (ebc.y - ec.y) * (ebc.y - ec.y));
      if (ed < 60) {
        this.game.combat.damageBrick(eb, aoeDmg, 'fire_explosion', 'fire');
      }
    }
    this.game.particles.emitHitSpark(ec.x, ec.y, '#FF8844');
  }

  /**
   * 引燃蔓延：灼烧砖块被毁时火扩散到相邻砖块
   * @param {Brick} brick - 被毁的砖块
   * @param {number} cx - 砖块中心x
   * @param {number} cy - 砖块中心y
   */
  spreadFire(brick, cx, cy) {
    if (this.game.upgrades.shipTree.fireSpread <= 0) return;

    var hasBurn = false;
    for (var bi = this.dots.length - 1; bi >= 0; bi--) {
      if (this.dots[bi].brickRef === brick && this.dots[bi].type === 'fire') {
        hasBurn = true;
        break;
      }
    }
    if (!hasBurn) return;

    var spreadDmg = Math.max(0.1, this.game.getBaseAttack() * 0.15 * this.game.upgrades.shipTree.fireSpread);
    for (var ni = 0; ni < this.game.bricks.length; ni++) {
      var nb = this.game.bricks[ni];
      if (!nb.alive) continue;
      var nc2 = nb.getCenter();
      var nd = Math.sqrt((nc2.x - cx) * (nc2.x - cx) + (nc2.y - cy) * (nc2.y - cy));
      if (nd < 80) {
        this.dots.push({
          brickRef: nb, x: nc2.x, y: nc2.y,
          damage: spreadDmg, remaining: 1500, tickMs: 500, tickTimer: 0,
          type: 'fire',
        });
        this.game.particles.emitHitSpark(nc2.x, nc2.y, '#FF4400');
      }
    }
  }
}

module.exports = DotSystem;
