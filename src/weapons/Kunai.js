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
const WB = require('../config/WeaponBalanceConfig');
const Config = require('../Config');
const Sound = require('../systems/SoundManager');

class Kunai extends Weapon {
  constructor() {
    super('kunai');
    this.knives = [];
    this.explosions = [];
    this.splitBombs = []; // 分裂弹小寒冰弹
  }

  update(dtMs, ctx) {
    const dt = dtMs / 16.67;
    this.timer += dtMs;

    // CD由外部养成控制（WeaponShopDefs爽点属性），不再有speed分支
    const interval = this._getInterval(ctx);

    if (this.timer >= interval) {
      this.timer = 0;
      this._fire(ctx);
    }

    const baseAttack = ctx.getBaseAttack ? ctx.getBaseAttack() : 1;
    const baseDmg = this.getDamage(baseAttack, ctx);
    const damage = baseDmg * (this._countDmgMult || 1.0);
    const homingLv = 0; // 制导已移除

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

    // 更新分裂弹
    for (let i = this.splitBombs.length - 1; i >= 0; i--) {
      const sb = this.splitBombs[i];
      sb.vy += 0.15 * dt; // 重力
      sb.x += sb.vx * dt;
      sb.y += sb.vy * dt;
      sb.life -= dtMs;
      // 碰砖或超时就爆炸
      let exploded = false;
      if (sb.life <= 0) { exploded = true; }
      else {
        for (let j = 0; j < ctx.bricks.length; j++) {
          const brick = ctx.bricks[j];
          if (!brick.alive) continue;
          const bc = brick.getCenter();
          if (Math.abs(sb.x - bc.x) < brick.width / 2 + 8 &&
              Math.abs(sb.y - bc.y) < brick.height / 2 + 8) {
            exploded = true;
            break;
          }
        }
      }
      if (exploded) {
        // 小爆炸
        this.explosions.push({
          x: sb.x, y: sb.y,
          radius: sb.radius * 0.2, maxRadius: sb.radius,
          expandSpeed: 1.5, life: 300, maxLife: 300,
          color: '#FF8800', isChain: false,
        });
        // AOE伤害
        for (let j = 0; j < ctx.bricks.length; j++) {
          const brick = ctx.bricks[j];
          if (!brick.alive) continue;
          const bc = brick.getCenter();
          const dist = Math.sqrt((bc.x - sb.x) ** 2 + (bc.y - sb.y) ** 2);
          if (dist <= sb.radius) {
            ctx.damageBrick(brick, sb.damage, 'kunai_split', 'fire');
          }
        }
        if (ctx.boss && ctx.boss.alive) {
          const bx = ctx.boss.getCenterX(), by = ctx.boss.getCenterY();
          if (Math.sqrt((bx - sb.x) ** 2 + (by - sb.y) ** 2) <= sb.radius) {
            ctx.damageBoss(sb.damage, 'kunai_split');
          }
        }
        this.splitBombs.splice(i, 1);
      }
    }
  }

  _fire(ctx) {
    const countLv = this.branches.count || 0;
    var hasDoomBarrage = ctx && ctx.saveManager && ctx.saveManager.hasWeaponPassive('kunai', 'doomBarrage');
    const count = (1 + countLv) * (hasDoomBarrage ? 2 : 1);
    // 弹数惩罚：每发-20%（被动countNoPenalty可解除）
    const saveManager = ctx.saveManager;
    const hasNoPenalty = saveManager && saveManager.hasWeaponPassive('kunai', 'countNoPenalty');
    this._countDmgMult = hasNoPenalty ? 1.0 : Math.max(0.2, 1 - countLv * 0.2);
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
        var kDmg = damage;
        if (ctx.saveManager && ctx.saveManager.hasWeaponPassive('kunai', 'burnExploit') && brick.burnTimer > 0) kDmg *= 1.5;
        ctx.damageBrick(brick, kDmg, 'kunai', 'physical');

        if (knife.pierce > 0) {
          knife.pierce--;
          knife.pierceCount = (knife.pierceCount || 0) + 1;
          // 穿透衰减20%/个（被动pierceNoDecay可解除）
          const saveM = ctx.saveManager;
          const noDecay = saveM && saveM.hasWeaponPassive('kunai', 'pierceNoDecay');
          if (!noDecay) {
            var hasPierceNoDecay = ctx && ctx.saveManager && ctx.saveManager.hasWeaponPassive('kunai', 'pierceNoDecay');
            knife.pierceMult = hasPierceNoDecay ? 1 : Math.max(0.2, 1 - knife.pierceCount * 0.2);
          }
          // 有穿透爆炸 → 每次穿透都炸
          if (pierceBlast) {
            this._explodeAt(knife.x, knife.y, aoeRadius, damage * (knife.pierceMult || 1), ctx, chainLv);
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
    // 生成冰晶碎片粒子(8个)
    var shards = [];
    for (var si = 0; si < 8; si++) {
      var angle = (si / 8) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
      var spd = 2.5 + Math.random() * 2.5;
      shards.push({
        x: 0, y: 0,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        size: 3 + Math.random() * 4,
        rot: Math.random() * Math.PI * 2,
        rotSpd: (Math.random() - 0.5) * 0.3,
      });
    }
    this.explosions.push({
      x, y,
      radius: radius * 0.15,
      maxRadius: radius,
      expandSpeed: 2.0,
      life: 400, maxLife: 400,
      color: this.def.color,
      isChain: false,
      shards: shards,
    });

    const splashDmg = Math.max(0.1, damage * 0.6);
    const killedBricks = [];

    for (let j = 0; j < ctx.bricks.length; j++) {
      const brick = ctx.bricks[j];
      if (!brick.alive) continue;
      const bc = brick.getCenter();
      const dx = bc.x - x, dy = bc.y - y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= radius) {
        const wasAlive = brick.alive;
        var sDmg = splashDmg;
        if (ctx.saveManager && ctx.saveManager.hasWeaponPassive('kunai', 'burnExploit') && brick.burnTimer > 0) sDmg *= 1.5;
        ctx.damageBrick(brick, sDmg, 'kunai_aoe', 'fire');
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
      const chainRadius = radius * (0.8 + chainLv * 0.3);
      // 连锁爆炸：初始-50%，每级+50%（Lv1=50%，Lv2=100%，Lv3=150%）
      const chainDmg = Math.max(0.1, damage * (chainLv * 0.5));
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
            var cDmg = chainDmg;
            if (ctx.saveManager && ctx.saveManager.hasWeaponPassive('kunai', 'burnExploit') && brick.burnTimer > 0) cDmg *= 1.5;
            ctx.damageBrick(brick, cDmg, 'kunai_chain', 'fire');
          }
        }
      }
    }

    // 分裂弹：爆炸后产生小寒冰弹
    const splitLv = this.branches.splitBomb || 0;
    if (splitLv > 0 && this.splitBombs.length < 20) {
      const splitCount = 1 + splitLv; // Lv1=2, Lv2=3, Lv3=4
      const splitDmg = damage * 0.25;
      for (let s = 0; s < splitCount; s++) {
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.8;
        const spd = 3 + Math.random() * 2;
        this.splitBombs.push({
          x: x, y: y,
          vx: Math.cos(angle) * spd,
          vy: Math.sin(angle) * spd,
          damage: splitDmg,
          life: 800,
          maxLife: 800,
          radius: radius * 0.5,
        });
      }
    }

    // burnChance被动：20%灼烧
    var hasBurnChance = ctx && ctx.saveManager && ctx.saveManager.hasWeaponPassive('kunai', 'burnChance');
    if (hasBurnChance) {
      for (var bi = 0; bi < ctx.bricks.length; bi++) {
        var bb = ctx.bricks[bi];
        if (!bb.alive) continue;
        var bc2 = bb.getCenter();
        if (Math.sqrt((bc2.x - x) ** 2 + (bc2.y - y) ** 2) <= radius && Math.random() < 0.2) {
          bb.burnTimer = Math.max(bb.burnTimer || 0, 3000);
          bb.burnDamage = damage * 0.1;
        }
      }
    }
    if (ctx.particles) ctx.particles.emitHitSpark(x, y, this.def.color);
  }

  _getAoeRadius() {
    // 列宽单位转像素: colW ≈ (screenW - padding*(cols+1)) / cols + padding
    var colW = 53; // ~53px per column width on 375px screen
    var baseR = (WB.kunai.aoeRadius || 1.2) * colW;
    const baseLv = this.branches.aoe || 0;
    const isGiant = (this.branches.giant || 0) > 0;
    let r = baseR + baseLv * (baseR * (WB.kunai.aoeRadiusScale || 0.3));
    if (isGiant) r *= 2;
    return r;
  }

  _getInterval(ctx) {
    // CD由外部养成的爽点属性控制
    if (ctx.saveManager) {
      var ss = ctx.saveManager.getWeaponSweetSpot('kunai');
      if (ss !== null) return ss;
    }
    return this.def.interval;
  }

  getRenderData() {
    return { knives: this.knives, explosions: this.explosions, splitBombs: this.splitBombs, color: this.def.color };
  }

  getWingData(lcx, lcy) {
    return { type: 'kunai', color: this.def.color, x: lcx, y: lcy };
  }
}

module.exports = Kunai;
