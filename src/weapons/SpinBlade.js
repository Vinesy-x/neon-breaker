/**
 * SpinBlade.js - 等离子旋刃 v3
 * 定位：后排清扫器 — 单个大旋刃弹墙切割
 * 慢速、大体积、高伤害，滞留/分裂互斥终结效果
 */
const Weapon = require('./Weapon');
const Config = require('../Config');
const Sound = require('../systems/SoundManager');

class SpinBlade extends Weapon {
  constructor() {
    super('spinBlade');
    this.blades = [];
    this.shockwaves = [];
  }

  update(dtMs, ctx) {
    const dt = dtMs / 16.67;
    this.timer += dtMs;

    if (this.timer >= this.def.interval) {
      this.timer = 0;
      this._launch(ctx);
    }

    const baseAttack = ctx.getBaseAttack ? ctx.getBaseAttack() : 1;
    const damage = this.getDamage(baseAttack);
    const giantLv = this.branches.giant || 0;
    const pierceLv = this.branches.pierce || 0;
    const rampLv = this.branches.ramp || 0;
    const shockwaveLv = this.branches.shockwave || 0;
    const lingerLv = this.branches.linger || 0;
    const splitLv = this.branches.split || 0;
    const superLv = this.branches.superBlade || 0;

    const size = 14 + giantLv * 8;
    const bounceTop = Config.SAFE_TOP + 10;
    const bounceBottom = Config.SCREEN_HEIGHT * 0.72;
    // 超级旋刃：tick频率翻倍
    const tickInterval = superLv > 0
      ? Math.floor((this.def.tickInterval || 250) / 2)
      : (this.def.tickInterval || 250);

    for (let i = this.blades.length - 1; i >= 0; i--) {
      const b = this.blades[i];

      // === 滞留状态：原地旋转不移动 ===
      if (b.lingering) {
        b.lingerTimer -= dtMs;
        b.angle += 0.25 * dt; // 快速旋转
        b.size = size * (0.8 + Math.sin(b.lingerTimer * 0.005) * 0.2); // 呼吸效果
        if (b.lingerTimer <= 0) {
          this.blades.splice(i, 1);
          continue;
        }
      } else {
        // 移动
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.angle += (0.1 + giantLv * 0.02) * dt;
        b.life -= dtMs;
        b.aliveMs += dtMs;
        b.size = size;

        // === 弹墙反弹 ===
        let bounced = false;
        if (b.x - size < 0) {
          b.vx = Math.abs(b.vx); b.x = size; bounced = true;
        } else if (b.x + size > Config.SCREEN_WIDTH) {
          b.vx = -Math.abs(b.vx); b.x = Config.SCREEN_WIDTH - size; bounced = true;
        }
        if (b.y - size < bounceTop) {
          b.vy = Math.abs(b.vy); b.y = bounceTop + size; bounced = true;
        } else if (b.y + size > bounceBottom) {
          b.vy = -Math.abs(b.vy); b.y = bounceBottom - size; bounced = true;
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

        // === 寿命结束：触发终结效果 ===
        if (b.life <= 0 && !b.isSplit) {
          // 滞留优先（互斥：有滞留就不分裂）
          if (lingerLv > 0) {
            b.lingering = true;
            b.lingerTimer = 2000 * lingerLv;
            b.vx = 0; b.vy = 0;
            continue; // 不删除，进入滞留
          } else if (splitLv > 0) {
            this._spawnSplitBlades(b, splitLv);
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
        const rampMult = rampLv > 0 ? 1 + (b.aliveMs / 1000) * 0.12 * rampLv : 1;
        const tickDmg = damage * rampMult;
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
            ctx.damageBrick(brick, sw.damage, 'spinBlade_sw');
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

  _launch(ctx) {
    const cx = ctx.launcher.getCenterX(), cy = ctx.launcher.y - 20;
    const durationMs = (5 + (this.branches.duration || 0) * 1.5) * 1000;
    // 向上发射，带轻微随机偏转
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.4;
    const spd = 1.8;

    this.blades.push({
      x: cx, y: cy,
      vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd,
      angle: Math.random() * Math.PI * 2,
      life: durationMs, maxLife: durationMs, size: 14,
      tickTimer: 0, aliveMs: 0, isSplit: false,
      lingering: false, lingerTimer: 0,
    });
    Sound.bulletShoot();
  }

  _spawnSplitBlades(parent, splitLv) {
    const splitCount = 2 + (splitLv - 1);
    const splitDuration = 2500 + splitLv * 500;
    for (let s = 0; s < splitCount; s++) {
      const angle = (Math.PI * 2 / splitCount) * s + Math.random() * 0.5;
      this.blades.push({
        x: parent.x, y: parent.y,
        vx: Math.cos(angle) * 1.5, vy: Math.sin(angle) * 1.5,
        angle: Math.random() * Math.PI * 2,
        life: splitDuration, maxLife: splitDuration,
        size: parent.size * 0.6,
        tickTimer: 0, aliveMs: parent.aliveMs, isSplit: true,
        lingering: false, lingerTimer: 0,
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
