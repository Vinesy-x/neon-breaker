/**
 * CollisionSystem.js - 碰撞检测系统
 * 管理子弹碰撞、危险线检测、砖块融合
 * 从 Game.js 提取
 */
const Config = require('../Config');
const Sound = require('./SoundManager');

class CollisionSystem {
  constructor(game) {
    this.game = game;
  }

  /**
   * 更新所有子弹的移动和碰撞
   * @param {number} dt - 标准化帧间隔
   * @param {number} dtMs - 毫秒帧间隔
   */
  updateBullets(dt, dtMs) {
    var g = this.game;
    var critChance = g.saveManager.getCritBonus();
    var critMult = 2.0;

    for (var i = g.bullets.length - 1; i >= 0; i--) {
      var b = g.bullets[i];
      b.update(dt);
      if (b.isOutOfBounds(g.gameWidth, g.gameHeight)) { g.bullets.splice(i, 1); continue; }
      // 激光Boss的激光区域销毁子弹
      if (g.boss && g.boss.alive && g.boss.type === 'laser' && g.boss.isInLaserZone && g.boss.isInLaserZone(b.x, b.y)) {
        g.bullets.splice(i, 1); continue;
      }

      var rm = false;
      for (var j = 0; j < g.bricks.length; j++) {
        var bk = g.bricks[j];
        if (!bk.alive || (bk.type === 'stealth' && !bk.visible)) continue;
        if (b.collideBrick(bk)) {
          var cm = (Math.random() < critChance) ? critMult : 1;
          var finalDmg = Math.max(0.1, b.damage * cm);
          var bulletDmgType = b.element === 'fire' ? 'fire' : b.element === 'ice' ? 'ice' : b.element === 'thunder' ? 'energy' : 'physical';
          g.combat.damageBrick(bk, finalDmg, 'bullet', bulletDmgType);
          if (cm > 1) {
            Sound.crit();
            g._addFloatingText('暴击!', bk.getCenter().x, bk.getCenter().y - 10, Config.NEON_RED, 14);
          }
          // 元素效果
          if (b.element && bk.alive) {
            g.elementSystem.applyElement(b.element, bk, b.elementLv, finalDmg);
          }
          // 弹射反弹优先 → 穿透次之 → 消失
          if (b.ricochet > 0) {
            b.ricochet--;
            b.bounceCount++;
            b.damage *= (1 + b.bounceDmgMult);
            var bc3 = bk.getCenter();
            var dx = b.x - bc3.x, dy = b.y - bc3.y;
            if (Math.abs(dx) / (bk.width / 2) > Math.abs(dy) / (bk.height / 2)) {
              b.vx = -b.vx;
            } else {
              b.vy = -b.vy;
            }
          } else if (b.pierce > 0) {
            b.pierce--;
          } else {
            g.bullets.splice(i, 1); rm = true; break;
          }
        }
      }
      if (rm) continue;
      // Boss碰撞
      if (g.boss && g.boss.alive) {
        if (g.boss.type === 'guardian' && g.boss.hitShield && g.boss.hitShield(b.x, b.y, b.radius)) {
          g.bullets.splice(i, 1); Sound.brickHit(); continue;
        }
        if (b.collideBoss(g.boss)) {
          var bc2 = (Math.random() < critChance) ? critMult : 1;
          g.combat.damageBoss(b.damage * 3 * bc2, 'bullet');
          if (bc2 > 1) g._addFloatingText('暴击!', b.x, g.boss.y + g.boss.height + 10, Config.NEON_RED, 14);
          g.bullets.splice(i, 1);
        }
      }
    }
  }

  /**
   * 检查是否有砖块越过危险线
   * @returns {boolean}
   */
  checkDangerLine() {
    if (this.game._devInvincible) return false;
    var dy = this.game.gameHeight * Config.BRICK_DANGER_Y;
    for (var i = 0; i < this.game.bricks.length; i++) {
      if (this.game.bricks[i].alive && this.game.bricks[i].y + this.game.bricks[i].height >= dy) return true;
    }
    return false;
  }

  /**
   * 砖块融合：重叠面积>30%时合并，HP相加
   */
  mergeBricks() {
    var g = this.game;
    var merged = new Set();
    for (var i = 0; i < g.bricks.length; i++) {
      var a = g.bricks[i];
      if (!a.alive || merged.has(i) || a._noMerge) continue;

      for (var j = i + 1; j < g.bricks.length; j++) {
        var b = g.bricks[j];
        if (!b.alive || merged.has(j) || b._noMerge) continue;

        var overlapX = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
        var overlapY = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
        var overlapArea = overlapX * overlapY;
        var minArea = Math.min(a.width * a.height, b.width * b.height);

        if (overlapArea > minArea * 0.3) {
          var keeper, absorbed;
          if (a.y >= b.y) {
            keeper = a; absorbed = b;
            merged.add(j);
          } else {
            keeper = b; absorbed = a;
            merged.add(i);
          }

          keeper.hp += absorbed.hp;
          keeper.maxHp = Math.max(keeper.maxHp, keeper.hp);
          keeper.color = Config.BRICK_HP_COLORS[Math.min(Math.ceil(keeper.hp), 10)] || keeper.color;
          if (absorbed.shieldHp > 0) {
            keeper.shieldHp = (keeper.shieldHp || 0) + absorbed.shieldHp;
          }
          absorbed.alive = false;
          keeper.bonusExp = (keeper.bonusExp || 0) + g.expSystem.calcBrickExp(absorbed) + (absorbed.bonusExp || 0);

          if (g.particles) {
            var c = keeper.getCenter();
            g.particles.emitHitSpark(c.x, c.y, '#FFFFFF');
          }
        }
      }
    }
  }

  /**
   * 更新掉落物碰撞
   * @param {number} dt - 标准化帧间隔
   */
  updatePowerUps(dt) {
    var g = this.game;
    for (var i = g.powerUps.length - 1; i >= 0; i--) {
      var p = g.powerUps[i];
      var magnet = Config.DEV_MODE ? { x: g.launcher.getCenterX(), y: g.launcher.y } : null;
      p.update(dt, magnet);
      if (p.collideLauncher(g.launcher)) {
        g.combat.applyPowerUp(p);
        g.powerUps.splice(i, 1);
        continue;
      }
      if (p.isOutOfBounds(g.gameHeight)) g.powerUps.splice(i, 1);
    }
  }
}

module.exports = CollisionSystem;
