/**
 * SpinBlade.js - 等离子旋刃 v2.1
 * 定位：后排清扫器 — 弹墙反弹，在敌人后排持续移动切割
 * 天生弹墙，蓄势越久伤害越高
 */
const Weapon = require('./Weapon');
const Config = require('../Config');
const Sound = require('../systems/SoundManager');

class SpinBlade extends Weapon {
  constructor() {
    super('spinBlade');
    this.blades = [];
  }

  update(dtMs, ctx) {
    const dt = dtMs / 16.67;
    this.timer += dtMs;
    const interval = this.def.interval;

    if (this.timer >= interval) {
      this.timer = 0;
      this._launch(ctx);
    }

    const baseAttack = ctx.getBaseAttack ? ctx.getBaseAttack() : 1;
    const damage = this.getDamage(baseAttack);
    const giantLv = this.branches.giant || 0;
    const splitLv = this.branches.split || 0;
    const pierceLv = this.branches.pierce || 0;
    const rampLv = this.branches.ramp || 0;
    const bleedLv = this.branches.bleed || 0;
    const size = 12 + giantLv * 10;
    const bounceTop = Config.SAFE_TOP + 10;
    const bounceBottom = Config.SCREEN_HEIGHT * 0.72;

    for (let i = this.blades.length - 1; i >= 0; i--) {
      const b = this.blades[i];

      // 移动
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.angle += (0.15 + giantLv * 0.03) * dt;
      b.life -= dtMs;
      b.aliveMs += dtMs;
      b.size = size;

      // === 弹墙反弹（默认行为） ===
      if (b.x - size < 0) {
        b.vx = Math.abs(b.vx);
        b.x = size;
      } else if (b.x + size > Config.SCREEN_WIDTH) {
        b.vx = -Math.abs(b.vx);
        b.x = Config.SCREEN_WIDTH - size;
      }
      if (b.y - size < bounceTop) {
        b.vy = Math.abs(b.vy);
        b.y = bounceTop + size;
      } else if (b.y + size > bounceBottom) {
        b.vy = -Math.abs(b.vy);
        b.y = bounceBottom - size;
      }

      // === tick伤害 ===
      b.tickTimer += dtMs;
      if (b.tickTimer >= (this.def.tickInterval || 200)) {
        b.tickTimer = 0;
        const hitRadius = size + (giantLv > 0 ? 6 : 0);

        // 蓄势：存活每秒+10%伤害
        const rampMult = rampLv > 0 ? 1 + (b.aliveMs / 1000) * 0.10 * rampLv : 1;
        const tickDmg = damage * rampMult;

        // 贯穿：每tick可命中所有砖块 vs 默认只打1个
        const maxHits = pierceLv > 0 ? 999 : 1;
        let hitCount = 0;

        for (let j = 0; j < ctx.bricks.length; j++) {
          if (hitCount >= maxHits) break;
          const brick = ctx.bricks[j];
          if (!brick.alive) continue;
          const bc = brick.getCenter();
          if (Math.abs(b.x - bc.x) < brick.width / 2 + hitRadius &&
              Math.abs(b.y - bc.y) < brick.height / 2 + hitRadius) {
            ctx.damageBrick(brick, tickDmg, 'spinBlade');
            hitCount++;

            // 撕裂DOT
            if (bleedLv > 0 && brick.alive) {
              const dotDmg = damage * 0.20 * bleedLv;
              ctx.addDot(brick, dotDmg, 2000, 'bleed');
            }

            // 分裂：击杀时分裂小刃
            if (splitLv > 0 && !brick.alive && !b.isSplit) {
              this._spawnSplitBlades(b, splitLv);
            }
          }
        }

        // Boss判定
        if (ctx.boss && ctx.boss.alive) {
          if (Math.abs(b.x - ctx.boss.getCenterX()) < ctx.boss.width / 2 + hitRadius &&
              Math.abs(b.y - ctx.boss.getCenterY()) < ctx.boss.height / 2 + hitRadius) {
            ctx.damageBoss(tickDmg, 'spinBlade');
          }
        }
      }

      if (b.life <= 0) this.blades.splice(i, 1);
    }
  }

  _launch(ctx) {
    const count = 1 + (this.branches.count || 0);
    const speedMult = 1 + (this.branches.speed || 0) * 0.3;
    const durationMs = (4 + (this.branches.duration || 0)) * 1000;
    const cx = ctx.launcher.getCenterX(), cy = ctx.launcher.y - 20;

    for (let i = 0; i < count; i++) {
      // 向上发射，多刃扇形散开
      const spreadAngle = count > 1
        ? -Math.PI / 2 - 0.4 + (0.8 / (count - 1)) * i
        : -Math.PI / 2 + (Math.random() - 0.5) * 0.3;
      const spd = (2.5 + Math.random() * 0.5) * speedMult;

      this.blades.push({
        x: cx + (i - (count - 1) / 2) * 12,
        y: cy,
        vx: Math.cos(spreadAngle) * spd,
        vy: Math.sin(spreadAngle) * spd,
        angle: Math.random() * Math.PI * 2,
        life: durationMs,
        maxLife: durationMs,
        size: 12,
        tickTimer: 0,
        aliveMs: 0,
        isSplit: false,
      });
    }
    Sound.bulletShoot();
  }

  /** 分裂小刃 */
  _spawnSplitBlades(parent, splitLv) {
    const splitCount = 2 + splitLv;
    const splitDuration = parent.life * 0.5;
    if (splitDuration < 500) return;

    for (let s = 0; s < splitCount; s++) {
      const angle = (Math.PI * 2 / splitCount) * s + Math.random() * 0.3;
      this.blades.push({
        x: parent.x,
        y: parent.y,
        vx: Math.cos(angle) * 2.5,
        vy: Math.sin(angle) * 2.5,
        angle: Math.random() * Math.PI * 2,
        life: splitDuration,
        maxLife: splitDuration,
        size: parent.size * 0.6,
        tickTimer: 0,
        aliveMs: 0,
        isSplit: true,
      });
    }
  }

  getRenderData() {
    return {
      blades: this.blades,
      color: this.def.color,
      giantLv: this.branches.giant || 0,
      rampLv: this.branches.ramp || 0,
    };
  }

  getWingData(lcx, lcy) {
    return { type: 'spinBlade', color: this.def.color, x: lcx, y: lcy };
  }
}

module.exports = SpinBlade;
