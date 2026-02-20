/**
 * Kunai.js - 光能飞刀
 * 机制：飞刀命中爆炸AOE，升级树丰富
 * - pierce: 穿透但只最后一击爆炸
 * - pierceBlast: 每次穿透都爆炸
 * - homing: 轻微追踪最近砖块
 * - chain: 被击杀砖块连锁爆炸
 * - giant: 刀身+爆炸翻倍
 */
const Weapon = require('./Weapon');
const Config = require('../Config');
const Sound = require('../systems/SoundManager');

class Kunai extends Weapon {
  constructor() {
    super('kunai');
    this.knives = [];
    this.explosions = [];
  }

  update(dtMs, ctx) {
    const dt = dtMs / 16.67;
    this.timer += dtMs;

    const cdMult = 1 - (this.branches.speed || 0) * 0.2;
    const interval = this.def.interval * cdMult;

    if (this.timer >= interval) {
      this.timer = 0;
      this._fire(ctx);
    }

    const baseAttack = ctx.getBaseAttack ? ctx.getBaseAttack() : 1;
    const damage = this.getDamage(baseAttack);
    const homingLv = this.branches.homing || 0;

    for (let i = this.knives.length - 1; i >= 0; i--) {
      const k = this.knives[i];
      
      // 追踪逻辑
      if (homingLv > 0) {
        const target = this._findNearest(k, ctx);
        if (target) {
          const dx = target.x - k.x, dy = target.y - k.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 5) {
            const turnRate = 0.03 + homingLv * 0.025; // 每级增加转向力
            const targetAngle = Math.atan2(dy, dx);
            const curAngle = Math.atan2(k.vy, k.vx);
            let diff = targetAngle - curAngle;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            const newAngle = curAngle + diff * turnRate;
            const speed = Math.sqrt(k.vx * k.vx + k.vy * k.vy);
            k.vx = Math.cos(newAngle) * speed;
            k.vy = Math.sin(newAngle) * speed;
          }
        }
      }

      k.x += k.vx * dt;
      k.y += k.vy * dt;
      k.life -= dtMs;
      k.tickTimer += dtMs;

      // 拖尾
      k.trailTimer += dtMs;
      if (k.trailTimer >= 40) {
        k.trailTimer = 0;
        k.trail.push({ x: k.x, y: k.y, alpha: 1 });
        if (k.trail.length > 6) k.trail.shift();
      }
      for (let t = k.trail.length - 1; t >= 0; t--) {
        k.trail[t].alpha -= 0.06 * dt;
        if (k.trail[t].alpha <= 0) k.trail.splice(t, 1);
      }

      if (k.tickTimer >= 50) {
        k.tickTimer = 0;
        this._checkHit(k, damage, ctx);
      }

      if (k.life <= 0 || k.y < -30 || k.x < -30 ||
          k.x > Config.SCREEN_WIDTH + 30 || k.y > Config.SCREEN_HEIGHT + 30) {
        this.knives.splice(i, 1);
      }
    }

    // 更新爆炸
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      const e = this.explosions[i];
      e.life -= dtMs;
      e.radius += e.expandSpeed * dt;
      if (e.life <= 0) this.explosions.splice(i, 1);
    }
  }

  _fire(ctx) {
    const count = 1 + (this.branches.count || 0);
    const cx = ctx.launcher.getCenterX();
    const cy = ctx.launcher.y - 10;
    const baseSpeed = 6;
    const isGiant = (this.branches.giant || 0) > 0;

    const maxSpread = Math.PI / 10;
    const totalSpread = count > 1 ? Math.PI / 12 : 0;

    for (let i = 0; i < count; i++) {
      let angle = -Math.PI / 2;
      if (count > 1) {
        angle = -Math.PI / 2 - totalSpread / 2 + (totalSpread / (count - 1)) * i;
      }
      this.knives.push({
        x: cx + (i - (count - 1) / 2) * 6,
        y: cy,
        vx: Math.cos(angle) * baseSpeed,
        vy: Math.sin(angle) * baseSpeed,
        pierce: this.branches.pierce || 0,
        life: 3000,
        maxLife: 3000,
        tickTimer: 0,
        hitSet: {},
        trail: [],
        trailTimer: 0,
        scale: this._getKnifeScale(),
      });
    }
    Sound.bulletShoot();
  }

  /** 刀身大小随 aoe + giant 缩放 */
  _getKnifeScale() {
    const aoeLv = this.branches.aoe || 0;
    const isGiant = (this.branches.giant || 0) > 0;
    let scale = 1.0 + aoeLv * 0.2; // 每级aoe +20%大小
    if (isGiant) scale *= 1.8;      // 巨刀再×1.8
    return scale;
  }

  _findNearest(knife, ctx) {
    let best = null, bestDist = 99999;
    for (const brick of ctx.bricks) {
      if (!brick.alive) continue;
      const bc = brick.getCenter();
      const dx = bc.x - knife.x, dy = bc.y - knife.y;
      // 只追踪前方的砖块（飞行方向的半球）
      const dot = dx * knife.vx + dy * knife.vy;
      if (dot < 0) continue;
      const dist = dx * dx + dy * dy;
      if (dist < bestDist) { bestDist = dist; best = bc; }
    }
    return best;
  }

  _checkHit(knife, damage, ctx) {
    const aoeRadius = this._getAoeRadius();
    const chainLv = this.branches.chain || 0;
    const pierceLv = this.branches.pierce || 0;
    const pierceBlast = (this.branches.pierceBlast || 0) > 0;
    const hitSize = 6 + (this._getKnifeScale() - 1) * 4; // 碰撞体随刀身变大

    for (let j = 0; j < ctx.bricks.length; j++) {
      const brick = ctx.bricks[j];
      if (!brick.alive) continue;
      if (knife.hitSet[j]) continue;

      const bc = brick.getCenter();
      if (Math.abs(knife.x - bc.x) < brick.width / 2 + hitSize &&
          Math.abs(knife.y - bc.y) < brick.height / 2 + hitSize) {
        knife.hitSet[j] = true;

        // 直接伤害
        ctx.damageBrick(brick, damage, 'kunai');

        if (knife.pierce > 0) {
          knife.pierce--;
          // 有穿透爆炸 → 每次穿透都炸
          if (pierceBlast) {
            this._explodeAt(knife.x, knife.y, aoeRadius, damage, ctx, chainLv);
          }
          // 没有穿透爆炸 → 穿透时不爆炸，只造成直接伤害
        } else {
          // 最后一击（无穿透或穿透用完）→ 必定爆炸
          this._explodeAt(knife.x, knife.y, aoeRadius, damage, ctx, chainLv);
          knife.life = 0;
        }
        return;
      }
    }

    // Boss
    if (ctx.boss && ctx.boss.alive) {
      const bx = ctx.boss.getCenterX(), by = ctx.boss.getCenterY();
      if (Math.abs(knife.x - bx) < ctx.boss.width / 2 + hitSize &&
          Math.abs(knife.y - by) < ctx.boss.height / 2 + hitSize) {
        ctx.damageBoss(damage, "kunai");
        if (knife.pierce > 0) {
          knife.pierce--;
          if (pierceBlast) {
            this._explodeAt(knife.x, knife.y, aoeRadius, damage, ctx, chainLv);
          }
        } else {
          this._explodeAt(knife.x, knife.y, aoeRadius, damage, ctx, chainLv);
          knife.life = 0;
        }
      }
    }
  }

  _explodeAt(x, y, radius, damage, ctx, chainLv) {
    // 限制爆炸数量
    if (this.explosions.length >= 10) this.explosions.shift();
    this.explosions.push({
      x, y,
      radius: radius * 0.15,
      maxRadius: radius,
      expandSpeed: 2.0,
      life: 400, maxLife: 400,
      color: this.def.color,
      isChain: false,
    });

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
        if (wasAlive && !brick.alive && chainLv > 0) {
          killedBricks.push({ x: bc.x, y: bc.y });
        }
      }
    }

    if (ctx.boss && ctx.boss.alive) {
      const bx = ctx.boss.getCenterX(), by = ctx.boss.getCenterY();
      const dist = Math.sqrt((bx - x) ** 2 + (by - y) ** 2);
      if (dist <= radius) ctx.damageBoss(splashDmg, "kunai_aoe");
    }

    // 连锁爆炸
    if (chainLv > 0 && killedBricks.length > 0) {
      const chainRadius = radius * (0.5 + chainLv * 0.15);
      const chainDmg = Math.max(1, Math.floor(damage * 0.3 * chainLv));
      for (const kb of killedBricks) {
        this.explosions.push({
          x: kb.x, y: kb.y,
          radius: chainRadius * 0.1,
          maxRadius: chainRadius,
          expandSpeed: 1.8,
          life: 350, maxLife: 350,
          color: '#FF6600',
          isChain: true,
        });
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

    if (ctx.particles) ctx.particles.emitHitSpark(x, y, this.def.color);
  }

  _getAoeRadius() {
    const baseLv = this.branches.aoe || 0;
    const isGiant = (this.branches.giant || 0) > 0;
    let r = 35 + baseLv * 12;
    if (isGiant) r *= 2;
    return r;
  }

  getRenderData() {
    return { knives: this.knives, explosions: this.explosions, color: this.def.color };
  }

  getWingData(lcx, lcy) {
    return { type: 'kunai', color: this.def.color, x: lcx, y: lcy };
  }
}

module.exports = Kunai;
