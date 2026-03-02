/**
 * Missile.js - 穿甲弹（原追踪导弹重设计）
 *
 * 从飞机侧翼发射，方向固定向上，贯穿同列砖块
 * 默认穿透5个砖块，衰减30%/个
 * 弹体随升级等级变大变猛
 */
const Weapon = require('./Weapon');
const Config = require('../Config');
const Sound = require('../systems/SoundManager');

class MissileWeapon extends Weapon {
  constructor() {
    super('missile');
    this.shells = [];      // 飞行中的穿甲弹
    this.shockwaves = [];  // 冲击波特效
    this.salvoQueue = [];  // 连射队列 { delay, colX, side }
    this.salvoTimer = 0;
  }

  update(dtMs, ctx) {
    const dt = dtMs / 16.67;
    this.timer += dtMs;
    const interval = this._getInterval(ctx);

    // 触发发射
    if (this.timer >= interval) {
      this.timer = 0;
      this._fire(ctx);
    }

    // 连射队列
    if (this.salvoQueue.length > 0) {
      this.salvoTimer += dtMs;
      while (this.salvoQueue.length > 0 && this.salvoTimer >= this.salvoQueue[0].delay) {
        const s = this.salvoQueue.shift();
        this._launchShell(s.colX, s.side, ctx);
      }
    }

    // 更新飞行中弹体
    const baseAttack = ctx.getBaseAttack ? ctx.getBaseAttack() : 1;
    const baseDmg = this.getDamage(baseAttack, ctx);
    const pierceLv = this.branches.pierce || 0;
    const decayRate = Math.max(0, this.def.decayRate - pierceLv * 0.15);
    // 基础穿透由外部养成爽点控制
    var basePierce = this.def.basePierce;
    var extraPierce = (ctx && ctx.saveManager && ctx.saveManager.hasWeaponPassive('missile', 'pierceBonus')) ? 3 : 0;
    const maxPierce = basePierce + (this.branches.deepPierce || 0) * 3 + extraPierce;
    const hyperLv = this.branches.hyperVelocity || 0;
    const dotExploitLv = this.branches.dotExploit || 0;
    const shockwaveLv = this.branches.shockwave || 0;
    const twinLv = this.branches.twinCannon || 0;

    for (let i = this.shells.length - 1; i >= 0; i--) {
      const sh = this.shells[i];
      sh.y -= sh.speed * dt;

      // 碰撞检测：纵向穿透
      for (let j = 0; j < ctx.bricks.length; j++) {
        const brick = ctx.bricks[j];
        if (!brick.alive || sh.hitSet.has(j)) continue;
        // 碰撞：弹体x在砖块范围内，y在砖块范围内
        if (sh.x >= brick.x - 2 && sh.x <= brick.x + brick.width + 2 &&
            sh.y >= brick.y && sh.y <= brick.y + brick.height) {
          sh.hitSet.add(j);
          sh.hitCount++;

          // 伤害计算
          let dmg = baseDmg;
          // 衰减 or 超速增益
          if (hyperLv > 0) {
            dmg *= Math.pow(1.2, sh.hitCount - 1); // 越打越疼
          } else {
            if (!(ctx.saveManager && ctx.saveManager.hasWeaponPassive('missile', 'pierceNoDecay')))
              dmg *= Math.pow(1 - decayRate, sh.hitCount - 1);
          }
          // 烈性反应：异常状态增伤（每种异常+1层，不叠层数）
          if (dotExploitLv > 0 && brick.debuffCount) {
            const debuffs = brick.debuffCount();
            dmg *= (1 + debuffs * dotExploitLv * 0.25);
          }

          // armorBreak被动：降防标记
          if (ctx.saveManager && ctx.saveManager.hasWeaponPassive('missile', 'armorBreak') && brick.alive) {
            brick._armorBreak = ctx.elapsedMs + 3000;
          }
          ctx.damageBrick(brick, dmg, 'armorPiercing', 'physical');

          // 碎甲标记
          if ((this.branches.shatter || 0) > 0) {
            brick.shatterMark = 3000; // 3秒
            brick.shatterBonus = 0.25;
          }

          // 冲击波：向两侧溅射
          if (shockwaveLv > 0) {
            var splashPct = (ctx.saveManager && ctx.saveManager.hasWeaponPassive('missile', 'shockwaveUp')) ? 1.0 : 0.3;
            this._triggerShockwave(brick, dmg * splashPct, ctx);
          }

          // 穿透上限
          if (sh.hitCount >= maxPierce) {
            // doomPierce被动：穿透满后全列爆炸
            if (sh.hitCount >= 10 && ctx.saveManager && ctx.saveManager.hasWeaponPassive('missile', 'doomPierce')) {
              for (var di = 0; di < ctx.bricks.length; di++) {
                var db = ctx.bricks[di];
                if (db.alive && Math.abs(db.getCenter().x - sh.x) < db.width) {
                  ctx.damageBrick(db, dmg * 2, 'missile_doom', 'fire');
                }
              }
            }
            this.shells.splice(i, 1);
            break;
          }
        }
      }

      // Boss碰撞
      if (ctx.boss && ctx.boss.alive && this.shells[i]) {
        const boss = ctx.boss;
        if (sh.x >= boss.x && sh.x <= boss.x + boss.width &&
            sh.y >= boss.y && sh.y <= boss.y + boss.height) {
          let dmg = baseDmg;
          if (hyperLv > 0) dmg *= Math.pow(1.2, sh.hitCount);
          else if (!(ctx.saveManager && ctx.saveManager.hasWeaponPassive('missile', 'pierceNoDecay')))
            dmg *= Math.pow(1 - decayRate, sh.hitCount);
          ctx.damageBoss(dmg, 'armorPiercing');
          sh.hitCount++;
          // 不移除，穿透Boss继续
        }
      }

      // 飞出屏幕
      if (this.shells[i] && sh.y < -20) {
        this.shells.splice(i, 1);
      }
    }

    // 更新冲击波特效
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.width += 6 * dt;
      sw.alpha -= 0.04 * dt;
      if (sw.alpha <= 0) this.shockwaves.splice(i, 1);
    }
  }

  _fire(ctx) {
    const lcx = ctx.launcher.getCenterX();
    const launcherW = ctx.launcher.width;
    const twinLv = this.branches.twinCannon || 0;
    // 齐射数由外部养成爽点控制（每5级+1发）
    var salvoCount = 1;
    if (ctx && ctx.saveManager) {
      var ss = ctx.saveManager.getWeaponSweetSpot('missile');
      if (ss !== null) salvoCount = ss;
    }
    const totalShots = salvoCount;

    // 发射位置：单管从中心，双管从两侧
    const offset = 20 + twinLv * 4;
    const sides = twinLv > 0 ? ['left', 'right'] : ['center'];
    const sideOffsets = {
      center: lcx,
      left: lcx - launcherW / 2 - offset,
      right: lcx + launcherW / 2 + offset,
    };

    this.salvoQueue = [];
    this.salvoTimer = 0;

    // 渐进扩列：每2发扩1列，最多4列
    var maxCols = Math.min(4, Math.ceil(totalShots / 2));
    var targetCols = this._findDensestColumns(maxCols, ctx, lcx);
    // 按密度分配弹数：第1列最多，依次递减
    var shellsPerCol = [];
    var remaining = totalShots;
    for (var ci = 0; ci < targetCols.length; ci++) {
      var share = Math.ceil(remaining / (targetCols.length - ci));
      shellsPerCol.push(share);
      remaining -= share;
    }
    // 发射：每列的弹有200ms间隔连射
    var globalDelay = 0;
    for (var ci = 0; ci < targetCols.length; ci++) {
      var colX = targetCols[ci];
      for (var si = 0; si < shellsPerCol[ci]; si++) {
        for (const side of sides) {
          if (globalDelay === 0) {
            this._launchShell(colX, side, ctx);
          } else {
            this.salvoQueue.push({ delay: globalDelay, colX: colX, side });
          }
        }
        globalDelay += 150; // 每发150ms间隔
      }
    }
  }

  _launchShell(colX, side, ctx) {
    const damageLv = this.branches.damage || 0;
    const salvoLv = this.branches.salvo || 0;
    const twinLv = this.branches.twinCannon || 0;
    const hyperLv = this.branches.hyperVelocity || 0;

    // 弹体表现进化
    let tier = 0; // 0=基础, 1=强化, 2=重型, 3=超速
    if (hyperLv > 0) tier = 3;
    else if (damageLv >= 4 || twinLv >= 1) tier = 2;
    else if (damageLv >= 2 || salvoLv >= 2) tier = 1;

    const lcy = ctx.launcher.y;
    this.shells.push({
      x: colX, y: lcy - 10,
      speed: 8 + tier * 1.5,
      hitCount: 0,
      hitSet: new Set(),
      tier: tier,
      side: side,
      trail: [],
    });
    Sound.bulletShoot();
  }

  _triggerShockwave(brick, damage, ctx) {
    const bc = brick.getCenter();
    // 对左右相邻砖块造成伤害
    for (let i = 0; i < ctx.bricks.length; i++) {
      const b = ctx.bricks[i];
      if (!b.alive || b === brick) continue;
      const c = b.getCenter();
      // 同行(y接近)且水平距离在一个砖块宽度内
      if (Math.abs(c.y - bc.y) < brick.height && Math.abs(c.x - bc.x) < brick.width * 2) {
        ctx.damageBrick(b, damage, 'armorPiercing_shockwave', 'physical');
      }
    }
    // 视觉特效
    this.shockwaves.push({
      x: bc.x, y: bc.y, width: 0, maxWidth: brick.width * 2, alpha: 0.8,
    });
  }

  /** 找砖块最密集的N列x坐标（按密度排序） */
  _findDensestColumns(n, ctx, fallbackX) {
    var colMap = {};
    for (var i = 0; i < ctx.bricks.length; i++) {
      var b = ctx.bricks[i];
      if (!b.alive) continue;
      var cx = Math.round(b.getCenter().x);
      var col = Math.round(cx / 53);
      if (!colMap[col]) colMap[col] = { x: cx, count: 0 };
      colMap[col].count++;
    }
    var cols = Object.values(colMap);
    cols.sort(function(a, b) { return b.count - a.count; });
    var result = [];
    for (var i = 0; i < Math.min(n, cols.length); i++) {
      result.push(cols[i].x);
    }
    // 不足n列用fallback填充
    while (result.length < n) result.push(fallbackX);
    return result;
  }

  getRenderData(lcx, lcy) {
    return {
      shells: this.shells,
      shockwaves: this.shockwaves,
      color: this.def.color,
    };
  }

  _getInterval(ctx) {
    return this.def.interval;
  }

  getWingData(lcx, lcy) {
    const twinLv = this.branches.twinCannon || 0;
    return {
      type: 'armorPiercing',
      color: this.def.color,
      x: lcx, y: lcy,
      twin: twinLv > 0,
      offset: 20 + twinLv * 4,
    };
  }
}

module.exports = MissileWeapon;
