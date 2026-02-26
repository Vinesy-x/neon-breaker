/**
 * CombatSystem.js - 战斗核心系统
 * 管理伤害计算、砖块/Boss受击、子弹发射、掉落物
 * 从 Game.js 提取
 */
const Config = require('../Config');
const Bullet = require('../Bullet');
const { generateDrops } = require('../PowerUp');
const Sound = require('./SoundManager');

class CombatSystem {
  constructor(game) {
    this.game = game;
  }

  /**
   * 砖块受伤
   * @param {Brick} brick - 目标砖块
   * @param {number} damage - 伤害值
   * @param {string} source - 伤害来源标识（用于统计）
   * @param {string} damageType - 伤害类型
   */
  damageBrick(brick, damage, source, damageType) {
    if (!brick.alive || (brick.type === 'stealth' && !brick.visible)) return;
    damageType = damageType || 'physical';
    
    // === 奇点引擎联动：能量伤害累积到黑洞 ===
    if (damageType === 'energy') {
      var gravityWell = this.game.upgrades.weapons.gravityWell;
      if (gravityWell) {
        var bc = brick.getCenter();
        gravityWell.accumulateEnergy(damage, bc.x, bc.y);
      }
    }
    
    // 冻结增伤
    var mult = brick.getDamageMult ? brick.getDamageMult(damageType) : 1.0;
    // 超导标记：感电砖受攻击额外能量伤害
    var shockBonus = 0;
    if (brick.shockStacks > 0 && this.game.upgrades.shipTree.shockMark > 0) {
      shockBonus = damage * 0.15 * brick.shockStacks;
    }
    var finalDmg = damage * mult + shockBonus;
    // 感电触发电弧（30%概率，防重入）
    if (brick.shockStacks > 0 && !brick._shockArcLock && Math.random() < 0.3) {
      brick._shockArcLock = true;
      this.game.elementSystem.triggerShockArc(brick, finalDmg * 0.25 * brick.shockStacks);
      brick._shockArcLock = false;
    }
    // 记录伤害统计
    const key = source || 'unknown';
    this.game.damageStats[key] = (this.game.damageStats[key] || 0) + finalDmg;
    if (brick.hit(finalDmg)) {
      Sound.brickBreak();
      this._onBrickDestroyed(brick);
    } else {
      Sound.brickHit();
      this.game.particles.emitHitSpark(brick.getCenter().x, brick.getCenter().y, brick.color);
    }
  }

  /**
   * Boss受伤
   * @param {number} damage - 伤害值
   * @param {string} source - 伤害来源标识
   */
  damageBoss(damage, source) {
    if (!this.game.boss || !this.game.boss.alive) return;
    const key = source || 'boss_hit';
    this.game.damageStats[key] = (this.game.damageStats[key] || 0) + damage;
    this.game.boss.hit(damage);
    Sound.brickHit();
    this.game.particles.emitBossHit(this.game.boss.getCenterX(), this.game.boss.getCenterY());
    this.game.score += Math.ceil(damage);
  }

  /**
   * 砖块被摧毁后的处理
   * @param {Brick} brick - 被摧毁的砖块
   */
  _onBrickDestroyed(brick) {
    var g = this.game;
    var c = brick.getCenter();
    g.particles.emitBrickBreak(brick.x, brick.y, brick.width, brick.height, brick.color);
    if (brick.maxHp >= 3) g.screenShake = Math.min(g.screenShake + 2, 8);
    g.combo++;
    g.comboTimer = 0;
    if (g.combo > g.maxCombo) g.maxCombo = g.combo;
    g.score += Math.floor(Config.COMBO_SCORE_BASE * brick.maxHp * (1 + Math.floor(g.combo / 5) * 0.5));
    g.bricksDestroyed++;
    if (g.combo > 1 && g.combo % 5 === 0) {
      Sound.combo(g.combo);
      g._addFloatingText(g.combo + ' COMBO!', c.x, c.y - 10, Config.NEON_YELLOW, 14 + Math.min(g.combo, 12));
      g.particles.emitCombo(c.x, c.y, g.combo);
    }
    if (brick.type === 'split' && !brick.isSplitChild) {
      var BrickFactory = require('../BrickFactory');
      g.bricks = g.bricks.concat(BrickFactory.spawnSplitChildren(brick));
    }
    g.expSystem.spawnOrbs(c.x, c.y, g.expSystem.calcBrickExp(brick) + (brick.bonusExp || 0), g.saveManager.getExpMultiplier());
    var drops = generateDrops(c.x, c.y, g.lastCrateTime, g.elapsedMs);
    for (var i = 0; i < drops.items.length; i++) g.powerUps.push(drops.items[i]);
    if (drops.crateDropped) g.lastCrateTime = g.elapsedMs;

    // 引燃蔓延
    g.dotSystem.spreadFire(brick, c.x, c.y);

    // 碎冰迸射：冻结砖被毁，碎裂伤害周围
    if (brick.frozen && g.upgrades.shipTree.iceShatter > 0) {
      var iceDmg = brick.maxHp * 0.06 * g.upgrades.shipTree.iceShatter;
      for (var ii = 0; ii < g.bricks.length; ii++) {
        var ib = g.bricks[ii];
        if (!ib.alive) continue;
        var ic = ib.getCenter();
        var id2 = Math.sqrt((ic.x - c.x) * (ic.x - c.x) + (ic.y - c.y) * (ic.y - c.y));
        if (id2 < 50) {
          this.damageBrick(ib, Math.max(0.1, iceDmg), 'ice_shatter', 'ice');
          g.particles.emitHitSpark(ic.x, ic.y, '#44DDFF');
        }
      }
    }
  }

  /**
   * 发射子弹
   */
  fireBullets() {
    var g = this.game;
    var sp = g.upgrades.getSpreadBonus();
    var count = 1 + sp;
    var spread = count > 1 ? (count - 1) * 0.12 : 0;
    var cx = g.launcher.getCenterX(), sy = g.launcher.y - 5;
    var bulletCoef = 1.0;
    var dmg = Math.max(0.1, g.getBaseAttack() * bulletCoef * g.upgrades.getAttackMult());
    var pierce = g.upgrades.getPierceCount();
    var element = g.upgrades.getElementType();
    var elementLv = g.upgrades.getElementLevel();

    for (var i = 0; i < count; i++) {
      if (g.bullets.length >= Config.BULLET_MAX) break;
      var a = count > 1 ? -Math.PI / 2 - spread / 2 + (spread / (count - 1)) * i : -Math.PI / 2;
      var bul = new Bullet(cx, sy, Math.cos(a) * Config.BULLET_SPEED, Math.sin(a) * Config.BULLET_SPEED, dmg);
      bul.pierce = pierce;
      bul.element = element;
      bul.elementLv = elementLv;
      // 反弹系统
      var wallBounceLv = g.upgrades.shipTree.wallBounce || 0;
      var ricochetLv = g.upgrades.shipTree.ricochet || 0;
      if (wallBounceLv > 0) {
        bul.wallBounce = wallBounceLv + 1;
        bul.bounceDmgMult = 0.25;
      }
      if (ricochetLv > 0) {
        bul.ricochet = ricochetLv;
      }
      g.bullets.push(bul);
    }
    g.launcher.muzzleFlash = 3;
    if (g.launcher.getFireInterval() > 120) Sound.bulletShoot();
  }

  /**
   * 掉落物效果
   * @param {PowerUp} pu - 掉落物
   */
  applyPowerUp(pu) {
    var g = this.game;
    if (pu.type === 'coin') {
      var v = Math.floor(g.saveManager.getCoinMultiplier());
      g.coinsEarned += v;
      g._addFloatingText('+' + v, pu.x, pu.y, '#FFD700', 12);
    } else if (pu.type === 'skillCrate') {
      Sound.powerUp();
      g._addFloatingText('技能宝箱!', pu.x, pu.y, Config.NEON_PINK, 16);
      if (!g._devPauseLevelUp) g._triggerChoice('crate');
    }
  }
}

module.exports = CombatSystem;
