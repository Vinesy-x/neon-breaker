/**
 * Kunai.js - 冰爆弹
 * 机制：冰爆弹命中爆炸AOE，升级树丰富
 * - pierce: 穿透但只最后一击爆炸
 * - pierceBlast: 每次穿透都爆炸
 * - chain: 被击杀砖块连锁爆炸
 * - giant: 弹体+爆炸翻倍
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
    this.splitBombs = [];
  }

  update(dtMs, ctx) {
    const dt = dtMs / 16.67;
    this.timer += dtMs;

    const interval = this._getInterval(ctx);
    if (this.timer >= interval) {
      this.timer = 0;
      this._fire(ctx);
    }

    const baseAttack = ctx.getBaseAttack ? ctx.getBaseAttack() : 1;
    const baseDmg = this.getDamage(baseAttack, ctx);
    const damage = baseDmg * (this._countDmgMult || 1.0);

    for (let i = this.knives.length - 1; i >= 0; i--) {
      const k = this.knives[i];
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

    // 更新爆炸视觉（伤害已在创建时即时结算）
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      const e = this.explosions[i];
      e.life -= dtMs;
      e.radius += e.expandSpeed * dt;
      if (e.life <= 0) this.explosions.splice(i, 1);
    }

    // 更新分裂弹
    for (let i = this.splitBombs.length - 1; i >= 0; i--) {
      const sb = this.splitBombs[i];
      sb.vy += 0.15 * dt;
      sb.x += sb.vx * dt;
      sb.y += sb.vy * dt;
      sb.life -= dtMs;
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
        this._addExplosionVisual(sb.x, sb.y, sb.radius, 300, '#FF8800', false);
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
    const count = Math.ceil((1 + countLv) * (hasDoomBarrage ? 1.5 : 1));
    const saveManager = ctx.saveManager;
    const hasNoPenalty = saveManager && saveManager.hasWeaponPassive('kunai', 'countNoPenalty');
    this._countDmgMult = hasNoPenalty ? 1.0 : Math.pow(0.80, countLv);
    const cx = ctx.launcher.getCenterX();
    const cy = ctx.launcher.y - 10;
    const baseSpeed = 6;
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

  _getKnifeScale() {
    const aoeLv = this.branches.aoe || 0;
    const isGiant = (this.branches.giant || 0) > 0;
    let scale = 1.0 + aoeLv * 0.2;
    if (isGiant) scale *= 1.8;
    return scale;
  }

  _findNearest(knife, ctx) {
    let best = null, bestDist = 99999;
    for (const brick of ctx.bricks) {
      if (!brick.alive) continue;
      const bc = brick.getCenter();
      const dx = bc.x - knife.x, dy = bc.y - knife.y;
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
    const pierceBlast = (this.branches.pierceBlast || 0) > 0;
    const hitSize = 6 + (this._getKnifeScale() - 1) * 4;

    for (let j = 0; j < ctx.bricks.length; j++) {
      const brick = ctx.bricks[j];
      if (!brick.alive) continue;
      if (knife.hitSet[j]) continue;

      const bc = brick.getCenter();
      if (Math.abs(knife.x - bc.x) < brick.width / 2 + hitSize &&
          Math.abs(knife.y - bc.y) < brick.height / 2 + hitSize) {
        knife.hitSet[j] = true;

        var kDmg = damage;
        if (ctx.saveManager && ctx.saveManager.hasWeaponPassive('kunai', 'burnExploit') && brick.burnTimer > 0) kDmg *= 2.0;
        ctx.damageBrick(brick, kDmg, 'kunai', 'ice');
        if (ctx.buffSystem) {
          ctx.buffSystem.applyChill(brick, 1);
        }

        if (knife.pierce > 0) {
          knife.pierce--;
          knife.pierceCount = (knife.pierceCount || 0) + 1;
          const saveM = ctx.saveManager;
          const noDecay = saveM && saveM.hasWeaponPassive('kunai', 'pierceNoDecay');
          if (!noDecay) {
            knife.pierceMult = Math.max(0.2, 1 - knife.pierceCount * 0.2);
          }
          if (pierceBlast) {
            this._explodeAt(knife.x, knife.y, aoeRadius, damage * (knife.pierceMult || 1), ctx, chainLv);
          }
        } else {
          this._explodeAt(knife.x, knife.y, aoeRadius, damage, ctx, chainLv);
          knife.life = 0;
        }
        return;
      }
    }

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

  /** 纯视觉爆炸，硬上限15个 */
  _addExplosionVisual(x, y, maxRadius, life, color, isChain) {
    if (this.explosions.length >= 15) return;
    var shards = [];
    if (!isChain) {
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
    }
    this.explosions.push({
      x, y,
      radius: maxRadius * 0.15,
      maxRadius: maxRadius,
      expandSpeed: isChain ? 3.0 : 2.0,
      life: isChain ? 200 : life,
      maxLife: isChain ? 200 : life,
      color: color,
      isChain: isChain,
      shards: shards.length > 0 ? shards : undefined,
    });
  }

  /**
   * 爆炸 — 伤害即时结算，视觉异步
   * 连锁：半径封顶100px，最多3个，伤害×0.6衰减
   */
  _explodeAt(x, y, radius, damage, ctx, chainLv) {
    // 1. 视觉
    this._addExplosionVisual(x, y, radius, 400, this.def.color, false);

    // 2. 伤害即时结算
    const splashDmg = Math.max(0.1, damage * 0.55);
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
        if (ctx.saveManager && ctx.saveManager.hasWeaponPassive('kunai', 'burnExploit') && brick.burnTimer > 0) sDmg *= 2.0;
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

    // 3. 连锁爆炸 — 封顶+限数+衰减
    if (chainLv > 0 && killedBricks.length > 0) {
      const chainRadius = Math.min(radius * (0.8 + chainLv * 0.3), 100);
      const chainDmg = Math.max(0.1, damage * (chainLv * 0.5) * 0.6);
      const maxChains = 3;

      for (let ci = 0; ci < Math.min(killedBricks.length, maxChains); ci++) {
        const kb = killedBricks[ci];
        this._addExplosionVisual(kb.x, kb.y, chainRadius, 200, '#FF6600', true);
        for (let j = 0; j < ctx.bricks.length; j++) {
          const brick = ctx.bricks[j];
          if (!brick.alive) continue;
          const bc = brick.getCenter();
          const dist = Math.sqrt((bc.x - kb.x) ** 2 + (bc.y - kb.y) ** 2);
          if (dist <= chainRadius) {
            var cDmg = chainDmg;
            if (ctx.saveManager && ctx.saveManager.hasWeaponPassive('kunai', 'burnExploit') && brick.burnTimer > 0) cDmg *= 2.0;
            ctx.damageBrick(brick, cDmg, 'kunai_chain', 'fire');
          }
        }
      }
    }

    // 4. 分裂弹
    const splitLv = this.branches.splitBomb || 0;
    if (splitLv > 0 && this.splitBombs.length < 20) {
      const splitCount = 1 + splitLv;
      const splitDmg = damage * (WB.kunai.splitBombDmgPct || 0.18);
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

    // 5. burnChance被动：20%灼烧
    var hasBurnChance = ctx && ctx.saveManager && ctx.saveManager.hasWeaponPassive('kunai', 'burnChance');
    if (hasBurnChance) {
      for (var bi = 0; bi < ctx.bricks.length; bi++) {
        var bb = ctx.bricks[bi];
        if (!bb.alive) continue;
        var bc2 = bb.getCenter();
        if (Math.sqrt((bc2.x - x) ** 2 + (bc2.y - y) ** 2) <= radius && Math.random() < 0.3) {
          bb.burnTimer = Math.max(bb.burnTimer || 0, 3000);
          bb.burnDamage = damage * 0.2;
        }
      }
    }
    if (ctx.particles) ctx.particles.emitHitSpark(x, y, this.def.color);
  }

  _getAoeRadius() {
    var colW = 53;
    var baseR = (WB.kunai.aoeRadius || 1.2) * colW;
    const baseLv = this.branches.aoe || 0;
    const isGiant = (this.branches.giant || 0) > 0;
    let r = baseR + baseLv * (baseR * (WB.kunai.aoeRadiusScale || 0.3));
    if (isGiant) r *= 1.5;
    return r;
  }

  _getInterval(ctx) {
    if (ctx.saveManager) {
      var ss = ctx.saveManager.getWeaponSweetSpot('kunai');
      if (ss !== null) return Math.max(ss, 2400); // CD下限3000ms
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
