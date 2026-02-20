/**
 * Kunai.js - 光能飞刀
 * 机制：飞刀命中砖块后爆炸AOE，击杀的砖块也会连锁爆炸
 */
const Weapon = require('./Weapon');
const Config = require('../Config');
const Sound = require('../systems/SoundManager');

class Kunai extends Weapon {
  constructor() {
    super('kunai');
    this.knives = [];
    this.explosions = []; // 爆炸特效列表
  }

  update(dtMs, ctx) {
    const dt = dtMs / 16.67;
    this.timer += dtMs;

    // CD 由 speed 分支降低
    const cdMult = 1 - (this.branches.speed || 0) * 0.2; // 每级-20% CD
    const interval = this.def.interval * cdMult;

    if (this.timer >= interval) {
      this.timer = 0;
      this._fire(ctx);
    }

    const baseAttack = ctx.getBaseAttack ? ctx.getBaseAttack() : 1;
    const damage = this.getDamage(baseAttack);

    // 更新飞刀
    for (let i = this.knives.length - 1; i >= 0; i--) {
      const k = this.knives[i];
      k.x += k.vx * dt;
      k.y += k.vy * dt;
      k.life -= dtMs;
      k.tickTimer += dtMs;

      // 拖尾粒子
      k.trailTimer += dtMs;
      if (k.trailTimer >= 30) {
        k.trailTimer = 0;
        k.trail.push({ x: k.x, y: k.y, alpha: 1 });
        if (k.trail.length > 8) k.trail.shift();
      }
      // 衰减拖尾
      for (let t = k.trail.length - 1; t >= 0; t--) {
        k.trail[t].alpha -= 0.06 * dt;
        if (k.trail[t].alpha <= 0) k.trail.splice(t, 1);
      }

      if (k.tickTimer >= 50) { // 更频繁的碰撞检测
        k.tickTimer = 0;
        this._checkHit(k, damage, ctx);
      }

      // 出界移除
      if (k.life <= 0 || k.y < -30 || k.x < -30 || k.x > Config.SCREEN_WIDTH + 30 || k.y > Config.SCREEN_HEIGHT + 30) {
        this.knives.splice(i, 1);
      }
    }

    // 更新爆炸特效
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      const e = this.explosions[i];
      e.life -= dtMs;
      e.radius += e.expandSpeed * dt;
      if (e.life <= 0) {
        this.explosions.splice(i, 1);
      }
    }
  }

  _fire(ctx) {
    const count = 1 + (this.branches.count || 0);
    const scatterLv = this.branches.scatter || 0;
    const cx = ctx.launcher.getCenterX();
    const cy = ctx.launcher.y - 10;
    const baseSpeed = 6;

    // 散射角度更小一些，更聚拢
    const maxSpread = Math.PI / 10; // 约18度
    const totalSpread = scatterLv > 0
      ? maxSpread * scatterLv
      : (count > 1 ? Math.PI / 12 : 0); // 多刀默认小角度

    for (let i = 0; i < count; i++) {
      let angle = -Math.PI / 2; // 正上方
      if (count > 1) {
        angle = -Math.PI / 2 - totalSpread / 2 + (totalSpread / (count - 1)) * i;
      }
      const maxLife = 3000;
      this.knives.push({
        x: cx + (i - (count - 1) / 2) * 6,
        y: cy,
        vx: Math.cos(angle) * baseSpeed,
        vy: Math.sin(angle) * baseSpeed,
        pierce: this.branches.pierce || 0,
        life: maxLife,
        maxLife: maxLife,
        tickTimer: 0,
        hitSet: {},
        trail: [],
        trailTimer: 0,
      });
    }
    Sound.bulletShoot();
  }

  _checkHit(knife, damage, ctx) {
    const aoeRadius = this._getAoeRadius();
    const chainLv = this.branches.chain || 0;

    for (let j = 0; j < ctx.bricks.length; j++) {
      const brick = ctx.bricks[j];
      if (!brick.alive) continue;
      if (knife.hitSet[j]) continue;

      const bc = brick.getCenter();
      if (Math.abs(knife.x - bc.x) < brick.width / 2 + 8 &&
          Math.abs(knife.y - bc.y) < brick.height / 2 + 8) {
        knife.hitSet[j] = true;

        // 直接伤害
        ctx.damageBrick(brick, damage, 'kunai');

        // 爆炸AOE伤害
        this._explodeAt(knife.x, knife.y, aoeRadius, damage, ctx, chainLv);

        if (knife.pierce > 0) {
          knife.pierce--;
        } else {
          knife.life = 0; // 飞刀消失
        }
        return; // 一次碰撞只触发一次爆炸
      }
    }

    // Boss碰撞
    if (ctx.boss && ctx.boss.alive) {
      const bx = ctx.boss.getCenterX(), by = ctx.boss.getCenterY();
      if (Math.abs(knife.x - bx) < ctx.boss.width / 2 + 8 &&
          Math.abs(knife.y - by) < ctx.boss.height / 2 + 8) {
        ctx.damageBoss(damage);
        this._explodeAt(knife.x, knife.y, aoeRadius, damage, ctx, chainLv);
        if (knife.pierce > 0) { knife.pierce--; }
        else { knife.life = 0; }
      }
    }
  }

  /** 在指定位置产生爆炸，造成AOE伤害 */
  _explodeAt(x, y, radius, damage, ctx, chainLv) {
    // 视觉爆炸特效
    this.explosions.push({
      x: x, y: y,
      radius: radius * 0.15, // 从更小开始
      maxRadius: radius,
      expandSpeed: 2.0,      // 更快扩张
      life: 400, maxLife: 400, // 更长持续
      color: this.def.color,
      isChain: false,
    });

    // AOE范围内的砖块受到 60% 溅射伤害
    const splashDmg = Math.max(1, Math.floor(damage * 0.6));
    const killedBricks = [];

    for (let j = 0; j < ctx.bricks.length; j++) {
      const brick = ctx.bricks[j];
      if (!brick.alive) continue;
      const bc = brick.getCenter();
      const dx = bc.x - x, dy = bc.y - y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= radius) {
        const wasAlive = brick.alive;
        ctx.damageBrick(brick, splashDmg, 'kunai_aoe');
        // 记录被AOE击杀的砖块，用于连锁爆炸
        if (wasAlive && !brick.alive && chainLv > 0) {
          killedBricks.push({ x: bc.x, y: bc.y });
        }
      }
    }

    // Boss AOE
    if (ctx.boss && ctx.boss.alive) {
      const bx = ctx.boss.getCenterX(), by = ctx.boss.getCenterY();
      const dist = Math.sqrt((bx - x) ** 2 + (by - y) ** 2);
      if (dist <= radius) {
        ctx.damageBoss(splashDmg);
      }
    }

    // 连锁爆炸：被AOE击杀的砖块再次产生小爆炸
    if (chainLv > 0 && killedBricks.length > 0) {
      const chainRadius = radius * (0.5 + chainLv * 0.15);
      const chainDmg = Math.max(1, Math.floor(damage * 0.3 * chainLv));
      for (const kb of killedBricks) {
        // 延迟感的连锁爆炸视觉
        this.explosions.push({
          x: kb.x, y: kb.y,
          radius: chainRadius * 0.1,
          maxRadius: chainRadius,
          expandSpeed: 1.8,
          life: 350, maxLife: 350,
          color: '#FF6600', // 橙色连锁
          isChain: true,
        });
        // 连锁伤害
        for (let j = 0; j < ctx.bricks.length; j++) {
          const brick = ctx.bricks[j];
          if (!brick.alive) continue;
          const bc = brick.getCenter();
          const dist = Math.sqrt((bc.x - kb.x) ** 2 + (bc.y - kb.y) ** 2);
          if (dist <= chainRadius) {
            ctx.damageBrick(brick, chainDmg, 'kunai_chain');
          }
        }
      }
    }

    // 爆炸粒子特效
    if (ctx.particles) {
      ctx.particles.emitHitSpark(x, y, this.def.color);
    }
  }

  /** 获取AOE半径，受 aoe 分支影响 */
  _getAoeRadius() {
    const baseLv = this.branches.aoe || 0;
    return 35 + baseLv * 12; // 基础35px，每级+12
  }

  getRenderData() {
    return {
      knives: this.knives,
      explosions: this.explosions,
      color: this.def.color,
    };
  }

  getWingData(lcx, lcy) {
    return { type: 'kunai', color: this.def.color, x: lcx, y: lcy };
  }
}

module.exports = Kunai;
