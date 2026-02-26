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
    const freqLv = this.branches.freq || 0;
    const interval = this.def.interval * Math.pow(0.8, freqLv);

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
    const baseDmg = this.getDamage(baseAttack);
    const pierceLv = this.branches.pierce || 0;
    const decayRate = Math.max(0, this.def.decayRate - pierceLv * 0.15);
    const maxPierce = this.def.basePierce + (this.branches.deepPierce || 0) * 3;
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
            dmg *= Math.pow(1 - decayRate, sh.hitCount - 1);
          }
          // 烈性反应：DOT加成
          if (dotExploitLv > 0 && brick.dotCount) {
            const dots = brick.dotCount();
            dmg *= (1 + dots * dotExploitLv * 0.2);
          }

          ctx.damageBrick(brick, dmg, 'armorPiercing', 'physical');

          // 碎甲标记
          if ((this.branches.shatter || 0) > 0) {
            brick.shatterMark = 3000; // 3秒
            brick.shatterBonus = 0.25;
          }

          // 冲击波：向两侧溅射
          if (shockwaveLv > 0) {
            this._triggerShockwave(brick, dmg * 0.3, ctx);
          }

          // 穿透上限
          if (sh.hitCount >= maxPierce) {
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
          else dmg *= Math.pow(1 - decayRate, sh.hitCount);
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
    const salvoLv = this.branches.salvo || 0;
    const totalShots = 1 + salvoLv;

    // 副翼位置：左侧始终有，右侧需要双管炮
    const offset = 20 + twinLv * 4;
    const sides = twinLv > 0 ? ['left', 'right'] : ['left'];
    const sideOffsets = {
      left: lcx - launcherW / 2 - offset,
      right: lcx + launcherW / 2 + offset,
    };

    this.salvoQueue = [];
    this.salvoTimer = 0;

    for (let s = 0; s < totalShots; s++) {
      for (const side of sides) {
        const colX = sideOffsets[side];
        if (s === 0) {
          this._launchShell(colX, side, ctx);
        } else {
          this.salvoQueue.push({ delay: s * 200, colX, side });
        }
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

  getRenderData(lcx, lcy) {
    return {
      shells: this.shells,
      shockwaves: this.shockwaves,
      color: this.def.color,
    };
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
