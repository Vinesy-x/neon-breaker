/**
 * Meteor.js - 轰炸机（原天降陨石重设计）
 *
 * 轰炸机从屏幕左/右侧飞入，水平穿越，沿途投弹地毯轰炸
 * 自动选砖块最密集的y行飞行
 */
const Weapon = require('./Weapon');
const Config = require('../Config');
const Sound = require('../systems/SoundManager');

class MeteorWeapon extends Weapon {
  constructor() {
    super('meteor');
    this.bombers = [];    // 飞行中的轰炸机
    this.bombs = [];      // 下落中的炸弹
    this.explosions = []; // 爆炸特效
    this.fireZones = [];  // 燃烧区域
  }

  update(dtMs, ctx) {
    const dt = dtMs / 16.67;
    this.timer += dtMs;
    const interval = this.def.interval; // CD由外部养成控制

    if (this.timer >= interval) {
      this.timer = 0;
      this._launchBomber(ctx);
    }

    const baseAttack = ctx.getBaseAttack ? ctx.getBaseAttack() : 1;
    const bombDmg = this.getDamage(baseAttack, ctx);
    const baseRadius = 28 * (1 + (this.branches.radius || 0) * 0.25);
    const napalmLv = this.branches.napalm || 0;
    const incendiaryLv = this.branches.incendiary || 0;
    const b52Lv = this.branches.b52 || 0;

    // ===== 更新轰炸机 =====
    for (let i = this.bombers.length - 1; i >= 0; i--) {
      const bomber = this.bombers[i];
      bomber.x += bomber.vx * dt;
      // 基于位置投弹：飞到下一个投弹点时投弹
      const shouldDrop = bomber.vx > 0
        ? (bomber.x >= bomber.nextDropX)
        : (bomber.x <= bomber.nextDropX);
      if (shouldDrop && bomber.bombsDropped < bomber.totalBombs) {
        bomber.bombsDropped++;
        // 下一个投弹点
        bomber.nextDropX += bomber.vx > 0 ? bomber.dropSpacing : -bomber.dropSpacing;

        // 所有炸弹从轰炸机机腹投下
        const bombX = bomber.x;
        const bombY = bomber.y + 5;
        this.bombs.push({
          x: bombX, y: bombY, vy: 1.5, startY: bombY, targetY: bomber.targetY,
          damage: bombDmg * (b52Lv > 0 ? 1.5 : 1),
          isLast: bomber.bombsDropped === bomber.totalBombs - 1,
          radius: baseRadius * (b52Lv > 0 ? 1.5 : 1),
          isMain: !bomber.isEscort,
        });

        // 地毯轰炸：额外炸弹也从机腹投下，目标y上下错开
        const carpetLv = this.branches.carpet || 0;
        if (carpetLv > 0) {
          for (let c = 1; c <= carpetLv; c++) {
            this.bombs.push({
              x: bombX + (Math.random() - 0.5) * 8,
              y: bombY, vy: 1.5,
              targetY: bomber.targetY - c * 24,
              damage: bombDmg * 0.7, radius: baseRadius * 0.8,
              isMain: !bomber.isEscort,
            });
            this.bombs.push({
              x: bombX + (Math.random() - 0.5) * 8,
              y: bombY, vy: 1.5,
              targetY: bomber.targetY + c * 24,
              damage: bombDmg * 0.7, radius: baseRadius * 0.8,
              isMain: !bomber.isEscort,
            });
          }
        }
      }

      // 飞出屏幕
      if ((bomber.vx > 0 && bomber.x > Config.SCREEN_WIDTH + 50) ||
          (bomber.vx < 0 && bomber.x < -50)) {
        this.bombers.splice(i, 1);
      }
    }

    // ===== 更新炸弹 =====
    for (let i = this.bombs.length - 1; i >= 0; i--) {
      const b = this.bombs[i];
      b.y += b.vy * dt;
      b.vy += 0.6 * dt; // 重力加速

      // 炸弹到达目标y或飞出屏幕
      if (b.y >= b.targetY || b.y > Config.SCREEN_HEIGHT + 20) {
        // 爆炸
        var isNuke = false;
        var nukeDmg = b.damage, nukeRadius = b.radius;
        if (ctx.saveManager && ctx.saveManager.hasWeaponPassive('meteor', 'nuke') && b.isLast) {
          isNuke = true; nukeDmg = b.damage * 5; nukeRadius = b.radius * 3;
        }
        this._explodeArea(b.x, b.targetY, isNuke ? nukeRadius : b.radius, isNuke ? nukeDmg : b.damage, ctx);
        this.explosions.push({ x: b.x, y: b.targetY, radius: b.radius * 0.6, alpha: 0.8, maxAlpha: 0.8 });
        if (this.explosions.length > 5) this.explosions.shift();
        Sound.missileExplode();

        if (b52Lv > 0) if (!ctx.shakeCooldown) { ctx.screenShake = Math.min((ctx.screenShake || 0) + 2 * 0.5, 6); ctx.shakeCooldown = 10; }
        else if (!ctx.shakeCooldown) { ctx.screenShake = Math.min((ctx.screenShake || 0) + 0.8 * 0.5, 6); ctx.shakeCooldown = 10; }

        // fireBomb被动：所有炸弹留小火区2秒
        if (ctx.saveManager && ctx.saveManager.hasWeaponPassive('meteor', 'fireBomb')) {
          var fbLife = 2000;
          // scorchEarth被动：×3
          if (ctx.saveManager.hasWeaponPassive('meteor', 'scorchEarth')) fbLife *= 3;
          if (this.fireZones.length < 12) {
            this.fireZones.push({
              x: b.x, y: b.targetY, radius: b.radius * 0.6,
              life: fbLife, maxLife: fbLife, tickTimer: 0,
              damage: b.damage * 0.2, isStrip: false,
            });
          }
        }

        // 凝固汽油 — 主轰炸机创建/扩展火焰带
        if (napalmLv > 0 && b.isMain) {
          // 找已有的同y火焰带
          let strip = this.fireZones.find(z =>
            z.isStrip && Math.abs(z.y - b.targetY) < 30 && z.life > 0
          );
          if (strip) {
            // 扩展：更新左右边界
            strip.leftX = Math.min(strip.leftX, b.x - 15);
            strip.rightX = Math.max(strip.rightX, b.x + 15);
            strip.stripWidth = strip.rightX - strip.leftX;
            strip.x = (strip.leftX + strip.rightX) / 2;
            strip.life = strip.maxLife; // 重置持续时间
          } else {
            // 清理快过期的火焰带，给新的腾位置
            const activeStrips = this.fireZones.filter(z => z.isStrip && z.life > 500);
            if (activeStrips.length < 4) {
              var baseLife = 3000 + (napalmLv - 1) * 1500;
              var scorchMult = (ctx.saveManager && ctx.saveManager.hasWeaponPassive('meteor', 'scorchEarth')) ? 3 : 1;
              const life = baseLife * scorchMult;
              this.fireZones.push({
                isStrip: true,
                leftX: b.x - 15, rightX: b.x + 15,
                x: b.x,
                y: b.targetY,
                stripWidth: 30,
                radius: 15,
                life: life,
                maxLife: life,
                tickTimer: 0,
                damage: b.damage * 0.3,
              });
            }
          }
        }

        this.bombs.splice(i, 1);
      }
    }

    // ===== 更新燃烧区域 =====
    // 燃烧风暴：合并相近的火区
    if (incendiaryLv > 0 && this.fireZones.length >= 2) {
      this._mergeFireZones();
    }

    for (let i = this.fireZones.length - 1; i >= 0; i--) {
      const z = this.fireZones[i];
      z.life -= dtMs;
      z.tickTimer += dtMs;
      if (z.tickTimer >= 500) {
        z.tickTimer = 0;
        const fireDmg = z.merged ? z.damage * 1.5 : z.damage;
        if (z.isStrip) {
          // 火焰带：矩形范围伤害
          this._damageStrip(z, fireDmg, ctx);
        } else {
          this._explodeArea(z.x, z.y, z.radius, fireDmg, ctx, 'bomber_napalm');
        }
      }
      if (z.life <= 0) this.fireZones.splice(i, 1);
    }

    // ===== 更新爆炸特效 =====
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      this.explosions[i].alpha -= 0.12;
      if (this.explosions[i].alpha <= 0) this.explosions.splice(i, 1);
    }
    while (this.explosions.length > 5) this.explosions.shift();
  }

  _launchBomber(ctx) {
    // 找砖块最密集的y行作为轰炸目标（限制最低高度，避免太高漏伤害）
    const minBombY = Config.SCREEN_HEIGHT * 0.25;
    const targetY = Math.max(this._findBestRow(ctx), minBombY);
    const fromLeft = Math.random() > 0.5;
    const escortLv = this.branches.escort || 0;
    const b52Lv = this.branches.b52 || 0;
    const bombsLv = this.branches.bombs || 0;
    // 基础投弹数由外部养成爽点控制
    var baseBombs = this.def.baseBombs;
    if (ctx && ctx.saveManager) {
      var ss = ctx.saveManager.getWeaponSweetSpot('meteor');
      if (ss !== null) baseBombs = ss;
    }
    var doubleMult = (ctx && ctx.saveManager && ctx.saveManager.hasWeaponPassive('meteor', 'doublePass')) ? 2 : 1;
    const totalBombs = Math.min((baseBombs + bombsLv * 2) * (b52Lv > 0 ? 2 : 1) * doubleMult, 30);

    // 轰炸机固定在目标行上方60px飞行
    const flyY = Math.max(targetY - 60, 40);
    const flyTimeMs = 2000;
    const speed = (Config.SCREEN_WIDTH + 80) / (flyTimeMs / 16.67);
    // 投弹按屏幕空间等分：投弹区域80%屏幕宽，每颗弹间距 = 区域宽 / (弹数+1)
    const dropZoneWidth = Config.SCREEN_WIDTH * 0.8;
    const dropSpacing = dropZoneWidth / (totalBombs + 1);
    const bomberData = {
      x: fromLeft ? -40 : Config.SCREEN_WIDTH + 40,
      y: flyY,
      vx: fromLeft ? speed : -speed,
      targetY: targetY,
      totalBombs: totalBombs,
      bombsDropped: 0,
      // 用距离触发投弹而非时间
      dropSpacing: dropSpacing,
      dropZoneStart: fromLeft ? Config.SCREEN_WIDTH * 0.1 : Config.SCREEN_WIDTH * 0.9,
      nextDropX: fromLeft
        ? Config.SCREEN_WIDTH * 0.1 + dropSpacing
        : Config.SCREEN_WIDTH * 0.9 - dropSpacing,
      isB52: b52Lv > 0,
      isEscort: false,
    };
    this.bombers.push(bomberData);

    // 护航编队 — 跟主机同高度，水平错开
    for (let e = 0; e < escortLv; e++) {
      const offsetY = (e + 1) * 25 * (e % 2 === 0 ? -1 : 1);
      const escortBombs = Math.ceil(totalBombs * 0.6);
      const escortSpacing = dropZoneWidth / (escortBombs + 1);
      this.bombers.push({
        x: bomberData.x + (fromLeft ? -30 : 30) * (e + 1),
        y: flyY + offsetY,
        vx: bomberData.vx,
        targetY: targetY + offsetY,
        totalBombs: escortBombs,
        bombsDropped: 0,
        dropSpacing: escortSpacing,
        dropZoneStart: bomberData.dropZoneStart,
        nextDropX: fromLeft
          ? Config.SCREEN_WIDTH * 0.1 + escortSpacing
          : Config.SCREEN_WIDTH * 0.9 - escortSpacing,
        isB52: false,
        isEscort: true,
      });
    }

    Sound.fireSurge();
  }

  _findBestRow(ctx) {
    if (!ctx.bricks || ctx.bricks.length === 0) {
      return Config.SCREEN_HEIGHT * 0.35;
    }
    // 统计每个y区间的砖块密度
    const bucketSize = 30;
    const buckets = {};
    for (const b of ctx.bricks) {
      if (!b.alive) continue;
      const key = Math.floor(b.y / bucketSize);
      buckets[key] = (buckets[key] || 0) + 1;
    }
    let bestKey = 0, bestCount = 0;
    for (const k in buckets) {
      if (buckets[k] > bestCount) { bestCount = buckets[k]; bestKey = parseInt(k); }
    }
    return bestKey * bucketSize + bucketSize / 2;
  }

  _damageStrip(zone, damage, ctx) {
    const halfW = zone.stripWidth / 2;
    const halfH = zone.radius;
    for (let i = 0; i < ctx.bricks.length; i++) {
      const brick = ctx.bricks[i];
      if (!brick.alive) continue;
      const bc = brick.getCenter();
      if (Math.abs(bc.x - zone.x) <= halfW && Math.abs(bc.y - zone.y) <= halfH) {
        ctx.damageBrick(brick, damage, 'bomber_napalm', 'fire');
      }
    }
    if (ctx.boss && ctx.boss.alive) {
      const dx = Math.abs(ctx.boss.getCenterX() - zone.x);
      const dy = Math.abs(ctx.boss.getCenterY() - zone.y);
      if (dx <= halfW && dy <= halfH) ctx.damageBoss(damage, 'bomber_napalm');
    }
  }

  _explodeArea(cx, cy, radius, damage, ctx, source) {
    source = source || 'bomber';
    for (let i = 0; i < ctx.bricks.length; i++) {
      const brick = ctx.bricks[i];
      if (!brick.alive) continue;
      const bc = brick.getCenter();
      const dx = bc.x - cx, dy = bc.y - cy;
      if (Math.sqrt(dx * dx + dy * dy) <= radius) {
        ctx.damageBrick(brick, damage, source, 'fire');
      }
    }
    if (ctx.boss && ctx.boss.alive) {
      const dx = ctx.boss.getCenterX() - cx, dy = ctx.boss.getCenterY() - cy;
      if (Math.sqrt(dx * dx + dy * dy) <= radius) {
        ctx.damageBoss(damage, source);
      }
    }
  }

  _mergeFireZones() {
    const mergeRadius = 50;
    for (let i = 0; i < this.fireZones.length; i++) {
      if (this.fireZones[i].merged) continue;
      for (let j = i + 1; j < this.fireZones.length; j++) {
        if (this.fireZones[j].merged) continue;
        const a = this.fireZones[i], b = this.fireZones[j];
        const dx = a.x - b.x, dy = a.y - b.y;
        if (Math.sqrt(dx * dx + dy * dy) < mergeRadius) {
          // 合并：保留第一个，扩大范围
          a.x = (a.x + b.x) / 2;
          a.y = (a.y + b.y) / 2;
          a.radius = Math.max(a.radius, b.radius) * 1.3;
          a.damage = Math.max(a.damage, b.damage);
          a.life = Math.max(a.life, b.life);
          a.merged = true;
          b.life = 0; // 标记待删除
        }
      }
    }
  }

  getRenderData() {
    return {
      bombers: this.bombers,
      bombs: this.bombs,
      explosions: this.explosions,
      fireZones: this.fireZones,
      color: this.def.color,
    };
  }

  getWingData(lcx, lcy) {
    return { type: 'bomber', color: this.def.color, x: lcx, y: lcy };
  }
}

module.exports = MeteorWeapon;
