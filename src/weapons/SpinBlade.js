/**
 * SpinBlade.js - 回旋刃 v3.1
 * 定位：后排清扫器 — 单个大旋刃智能追踪高密度区域
 * 横向滑动为主，持续时间结束后才进入冷却
 */
const Weapon = require('./Weapon');
const Config = require('../Config');
const Sound = require('../systems/SoundManager');

class SpinBlade extends Weapon {
  constructor() {
    super('spinBlade');
    this.blades = [];
    this.shockwaves = [];
    this.cooldownTimer = 99999; // 开局直接发射
    this.isOnCooldown = true;
  }

  update(dtMs, ctx) {
    const dt = dtMs / 16.67;

    // === 冷却机制：持续时间结束后才进入冷却 ===
    // 没有活跃旋刃时开始冷却计时
    if (this.blades.length === 0) {
      if (!this.isOnCooldown) {
        // 旋刃刚消失，开始冷却
        this.isOnCooldown = true;
        this.cooldownTimer = 0;
      } else {
        // 冷却中
        this.cooldownTimer += dtMs;
        if (this.cooldownTimer >= this.def.interval) {
          this._launch(ctx);
          this.isOnCooldown = false;
        }
      }
    }

    const baseAttack = ctx.getBaseAttack ? ctx.getBaseAttack() : 1;
    const damage = this.getDamage(baseAttack, ctx);
    const giantLv = this.branches.giant || 0;
    const pierceLv = this.branches.pierce || 0;
    const rampLv = this.branches.ramp || 0;
    const shockwaveLv = this.branches.shockwave || 0;
    const lingerLv = this.branches.linger || 0;
    const splitLv = this.branches.split || 0;
    const superLv = this.branches.superBlade || 0;
    const bleedLv = this.branches.bleed || 0;

    const size = 20 + giantLv * 10;
    const bounceTop = Config.SAFE_TOP + 10;
    const bounceBottom = Config.SCREEN_HEIGHT * 0.88;
    const tickInterval = superLv > 0
      ? Math.floor((this.def.tickInterval || 250) / 2)
      : (this.def.tickInterval || 250);

    for (let i = this.blades.length - 1; i >= 0; i--) {
      const b = this.blades[i];

      // === 滞留状态 ===
      if (b.lingering) {
        b.lingerTimer -= dtMs;
        b.angle += 0.25 * dt;
        b.size = size * (0.8 + Math.sin(b.lingerTimer * 0.005) * 0.2);
        if (b.lingerTimer <= 0) {
          this.blades.splice(i, 1);
          continue;
        }
      } else {
        // === 阶段1：快速上冲到顶部 ===
        if (!b.reachedTop) {
          b.x += b.vx * dt;
          b.y += b.vy * dt;
          b.angle += 0.2 * dt;
          var isEternal = ctx.saveManager && ctx.saveManager.hasWeaponPassive('spinBlade', 'eternal') && !b.isSplit;
          if (!isEternal) b.life -= dtMs;
          b.aliveMs += dtMs;
          b.size = size;

          // 撞到顶部，切换到横向模式
          if (b.y - size < bounceTop) {
            b.y = bounceTop + size;
            b.reachedTop = true;
            b.vx = (Math.random() > 0.5 ? 1 : -1) * 1.5; // 开始横向
            b.vy = 0.2; // 轻微向下
          }
        } else {
          // === 阶段2：智能追踪横向清扫 ===
          const steer = this._calcSteer(b, ctx.bricks, size);
          b.vx += steer.x * dt * 0.03;
          b.vy += steer.y * dt * 0.015;

          // 限制垂直速度
          const maxVy = 0.6;
          if (Math.abs(b.vy) > maxVy) b.vy = Math.sign(b.vy) * maxVy;
          // 保持水平速度
          const minVx = 0.8;
          if (Math.abs(b.vx) < minVx) b.vx = Math.sign(b.vx || 1) * minVx;

          b.x += b.vx * dt;
          b.y += b.vy * dt;
          b.angle += (0.1 + giantLv * 0.02) * dt;
          b.life -= dtMs;
          b.aliveMs += dtMs;
          b.size = size;
        }

        // === 弹墙反弹 ===
        let bounced = false;
        if (b.x - size < 0) {
          b.vx = Math.abs(b.vx); b.x = size; bounced = true;
        } else if (b.x + size > Config.SCREEN_WIDTH) {
          b.vx = -Math.abs(b.vx); b.x = Config.SCREEN_WIDTH - size; bounced = true;
        }
        if (b.reachedTop) {
          if (b.y - size < bounceTop) {
            b.vy = Math.abs(b.vy) * 0.3; b.y = bounceTop + size; bounced = true;
          } else if (b.y + size > bounceBottom) {
            b.vy = -Math.abs(b.vy) * 0.3; b.y = bounceBottom - size; bounced = true;
          }
        }

        // 回旋斩
        if (bounced && shockwaveLv > 0) {
          const swRadius = 30 + shockwaveLv * 20;
          const swDmg = damage * (0.4 + shockwaveLv * 0.3);
          this.shockwaves.push({
            x: b.x, y: b.y, radius: 0, maxRadius: swRadius,
            damage: swDmg, speed: 3 + shockwaveLv, hit: false,
          });
        }

        // === 寿命结束 ===
        if (b.life <= 0 && !b.isSplit) {
          if (lingerLv > 0) {
            b.lingering = true;
            b.lingerTimer = 2000 * lingerLv;
            b.vx = 0; b.vy = 0;
            continue;
          } else if (splitLv > 0) {
            this._spawnSplitBlades(b, splitLv);
          }
          // rebirth被动：50%概率重生
          if (ctx.saveManager && ctx.saveManager.hasWeaponPassive('spinBlade', 'rebirth') && Math.random() < 0.5) {
            b.life = b.maxLife * 0.5;
            b.vx = -b.vx; b.vy = -b.vy; // 反弹
            continue;
          }
          this.blades.splice(i, 1);
          continue;
        } else if (b.life <= 0) {
          this.blades.splice(i, 1);
          continue;
        }
      }

      // === tick伤害 ===
      b.tickTimer += dtMs;
      if (b.tickTimer >= tickInterval) {
        b.tickTimer = 0;
        const hitRadius = b.size + (giantLv > 0 ? 4 : 0);
        var rampUpBonus = (ctx.saveManager && ctx.saveManager.hasWeaponPassive('spinBlade', 'rampUp')) ? 0.1 : 0;
        var rampCap = (ctx.saveManager && ctx.saveManager.hasWeaponPassive('spinBlade', 'bladeFury')) ? 2.0 : 1.0;
        const rampRaw = (b.aliveMs / 1000) * (rampLv > 0 ? 0.12 * rampLv : 0) + (b.aliveMs / 1000) * rampUpBonus;
        const rampMult = 1 + Math.min(rampRaw, rampCap);
        const tickDmg = damage * rampMult;
        // 默认贯穿：每tick打所有砖块，pierce分支增加伤害
        var sharpBonus = 0; // sharpEdge已删除
        const pierceDmgMult = pierceLv > 0 ? (1.3 + sharpBonus) : (1 + sharpBonus);

        for (let j = 0; j < ctx.bricks.length; j++) {
          const brick = ctx.bricks[j];
          if (!brick.alive) continue;
          const bc = brick.getCenter();
          if (Math.abs(b.x - bc.x) < brick.width / 2 + hitRadius &&
              Math.abs(b.y - bc.y) < brick.height / 2 + hitRadius) {
            ctx.damageBrick(brick, tickDmg * pierceDmgMult, 'spinBlade', 'physical');
            // 撕裂DOT
            if (bleedLv > 0 && brick.alive) {
              const dotDmg = damage * 0.15 * bleedLv;
              ctx.addDot(brick, dotDmg, 2000, 'bleed');
            }
          }
        }
        if (ctx.boss && ctx.boss.alive) {
          if (Math.abs(b.x - ctx.boss.getCenterX()) < ctx.boss.width / 2 + hitRadius &&
              Math.abs(b.y - ctx.boss.getCenterY()) < ctx.boss.height / 2 + hitRadius) {
            ctx.damageBoss(tickDmg, 'spinBlade');
          }
        }
      }
    }

    // === 更新回旋斩 ===
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.radius += sw.speed * dt;
      if (!sw.hit) {
        sw.hit = true;
        for (let j = 0; j < ctx.bricks.length; j++) {
          const brick = ctx.bricks[j];
          if (!brick.alive) continue;
          const bc = brick.getCenter();
          if (Math.sqrt((bc.x - sw.x) ** 2 + (bc.y - sw.y) ** 2) <= sw.maxRadius) {
            ctx.damageBrick(brick, sw.damage, 'spinBlade_sw', 'physical');
          }
        }
        if (ctx.boss && ctx.boss.alive) {
          if (Math.sqrt((ctx.boss.getCenterX() - sw.x) ** 2 + (ctx.boss.getCenterY() - sw.y) ** 2) <= sw.maxRadius) {
            ctx.damageBoss(sw.damage, 'spinBlade_sw');
          }
        }
      }
      if (sw.radius >= sw.maxRadius) this.shockwaves.splice(i, 1);
    }
  }

  /** 计算转向力：朝砖块密度高的方向偏移 */
  _calcSteer(blade, bricks, size) {
    let sumX = 0, sumY = 0, count = 0;
    const detectRange = 200;

    for (const brick of bricks) {
      if (!brick.alive) continue;
      const bc = brick.getCenter();
      const dx = bc.x - blade.x;
      const dy = bc.y - blade.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < detectRange && dist > 5) {
        // 距离越近权重越高
        const weight = 1 - dist / detectRange;
        sumX += dx * weight;
        sumY += dy * weight;
        count++;
      }
    }

    if (count === 0) return { x: 0, y: 0 };
    return { x: sumX / count, y: sumY / count };
  }

  _launch(ctx) {
    const cx = ctx.launcher.getCenterX();
    const cy = ctx.launcher.y - 30; // 从飞机上方发射
    // 基础持续时间由外部养成爽点控制
    var baseDur = 10;
    if (ctx && ctx.saveManager) {
      var ss = ctx.saveManager.getWeaponSweetSpot('spinBlade');
      if (ss !== null) baseDur = ss;
    }
    const durationMs = (baseDur + (this.branches.duration || 0) * 2) * 1000;
    // 水平带点随机
    const hDir = Math.random() > 0.5 ? 1 : -1;

    this.blades.push({
      x: cx,
      y: cy,
      vx: hDir * 0.5, // 轻微水平
      vy: -3.5, // 快速向上冲
      angle: Math.random() * Math.PI * 2,
      life: durationMs, maxLife: durationMs, size: 14,
      tickTimer: 0, aliveMs: 0, isSplit: false,
      lingering: false, lingerTimer: 0,
      reachedTop: false, // 标记是否到达顶部
    });
    Sound.bulletShoot();
  }

  _spawnSplitBlades(parent, splitLv) {
    const splitCount = 2 + splitLv; // 3-4个
    const splitDuration = 5000 + splitLv * 1500; // 5-8秒
    for (let s = 0; s < splitCount; s++) {
      // 分裂刃水平散开
      const angle = (Math.PI * 2 / splitCount) * s + Math.random() * 0.3;
      this.blades.push({
        x: parent.x, y: parent.y,
        vx: Math.cos(angle) * 1.5,
        vy: Math.sin(angle) * 0.5,
        angle: Math.random() * Math.PI * 2,
        life: splitDuration, maxLife: splitDuration,
        size: parent.size * 0.75, // 75%大小
        tickTimer: 0, aliveMs: parent.aliveMs, isSplit: true,
        lingering: false, lingerTimer: 0, reachedTop: true,
      });
    }
  }

  getRenderData() {
    return {
      blades: this.blades,
      shockwaves: this.shockwaves,
      color: this.def.color,
      giantLv: this.branches.giant || 0,
      rampLv: this.branches.ramp || 0,
      superLv: this.branches.superBlade || 0,
    };
  }

  getWingData(lcx, lcy) {
    return { type: 'spinBlade', color: this.def.color, x: lcx, y: lcy };
  }
}

module.exports = SpinBlade;
