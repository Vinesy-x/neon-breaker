/**
 * GravityWell.js - 奇点引擎
 * 生成黑洞吸引砖块，tick伤害为主
 * negaEnergy分支解锁「黑洞」负能量体（圆形黑色白边），碰砖触发湮灭
 */

var Weapon = require('./Weapon');
const WB = require('../config/WeaponBalanceConfig');
var Config = require('../Config');

// --- 常量 ---
var BASE_RADIUS = WB.gravityWell.baseRadius;
var BASE_DURATION = WB.gravityWell.baseDuration;
var BASE_PULL = WB.gravityWell.basePull;
var TICK_INTERVAL = WB.gravityWell.tickInterval;
var PCT_HP_CAP_MULT = WB.gravityWell.pctHpCapMult;

class GravityWellWeapon extends Weapon {
  constructor() {
    super('gravityWell');
    this.timer = 0;
    this.wells = [];
    this.negaBricks = [];  // 「黑洞」负能量体
    this.particles = [];
    this.cooldown = 0;
  }

  update(dt, ctx) {
    var damageLv = this.getBranch('damage');
    var horizonLv = this.getBranch('horizon');
    var singularityLv = this.getBranch('singularity');
    var negaLv = this.getBranch('negaEnergy');
    var annihilateLv = this.getBranch('annihilate');
    var sustainLv = this.getBranch('sustain');
    var lensLv = this.getBranch('lens');
    var negaShieldLv = this.getBranch('negaShield');
    var baseAttack = ctx.getBaseAttack ? ctx.getBaseAttack() : 1;
    var basePct = this.def.basePct;

    // --- CD逻辑：场上有黑洞时不冷却，全部消失后才开始倒计时 ---
    // CD由爽点控制(base 14s, -0.8s/档)
    var interval = this.def.interval;
    if (ctx && ctx.saveManager) {
      var ss = ctx.saveManager.getWeaponSweetSpot('gravityWell');
      if (ss !== null) interval = ss;
    }
    interval = Math.max(interval, 3000);
    var binaryBonus = (ctx && ctx.saveManager && ctx.saveManager.hasWeaponPassive('gravityWell', 'binarySystem')) ? 1 : 0;
    var maxWells = 1 + binaryBonus;

    if (this.wells.length > 0) {
      this.cooldown = interval;
    } else {
      this.cooldown -= dt;
      if (this.cooldown <= 0 && this.wells.length < maxWells) {
        this.cooldown = interval;
        this._spawnWell(ctx, damageLv, singularityLv);
      }
    }

    // --- 更新黑洞 ---
    for (var i = this.wells.length - 1; i >= 0; i--) {
      var well = this.wells[i];
      well.timer -= dt;
      well.tickTimer -= dt;

      // 吸引砖块
      this._pullBricks(well, ctx);

      // 吸引黑洞体
      this._pullNegaBricks(well);

      // tick伤害
      if (well.tickTimer <= 0) {
        well.tickTimer += TICK_INTERVAL;
        this._tickDamage(well, ctx, basePct, baseAttack, horizonLv, singularityLv, lensLv, damageLv, sustainLv);
      }

      // 黑洞粒子
      if (Math.random() < 0.3) {
        var angle = Math.random() * Math.PI * 2;
        var dist = well.radius * (0.5 + Math.random() * 0.5);
        this.particles.push({
          x: well.x + Math.cos(angle) * dist,
          y: well.y + Math.sin(angle) * dist,
          tx: well.x, ty: well.y,
          speed: 1.5 + Math.random(),
          alpha: 0.6 + Math.random() * 0.4,
          color: Math.random() > 0.5 ? '#AA00FF' : '#7700CC',
          size: 1 + Math.random() * 2,
          type: 'pull'
        });
      }

      // sustain: 击败砖块延长持续时间（总延长量有上限）
      if (sustainLv > 0 && well._killCount > 0) {
        var extPerKill = WB.gravityWell.sustainBaseTime + (sustainLv - 1) * WB.gravityWell.sustainPerLv;
        var ext = well._killCount * extPerKill;
        var maxExt = well.duration; // 总延长上限 = 1倍原始持续时间（即最多活2倍）
        var remaining = maxExt - (well._totalExtended || 0);
        if (remaining > 0) {
          ext = Math.min(ext, remaining);
          well.timer += ext;
          well._totalExtended = (well._totalExtended || 0) + ext;
        }
        well._killCount = 0;
      }

      // 黑洞结束
      if (well.timer <= 0) {
        // negaEnergy分支：生成「黑洞」负能量体
        if (negaLv > 0 && well.energyAccum > 0) {
          var rate = negaLv * 0.10; // 10%/级
          var negaHp = well.energyAccum * rate;
          if (negaHp > 10) {
            // 优先叠加到附近已有的黑洞体
            var merged = false;
            for (var ni = 0; ni < this.negaBricks.length; ni++) {
              var existNb = this.negaBricks[ni];
              var ndx = existNb.x - well.x, ndy = existNb.y - well.y;
              if (ndx * ndx + ndy * ndy < well.radius * well.radius) {
                existNb.hp -= negaHp;
                existNb.flashTimer = 300;
                // 体积随能量增长（有上限）
                var newRadius = Math.min(existNb.radius * 1.1, 25);
                existNb.radius = newRadius;
                existNb.birthTime = ctx.elapsedMs;
                merged = true;
                break;
              }
            }
            if (!merged) {
              this._spawnNegaBrick(well.x, well.y, negaHp, ctx);
            }
          }
        }
        // 黑洞消失爆炸粒子
        for (var p = 0; p < 20; p++) {
          var a = Math.random() * Math.PI * 2;
          var spd = 1 + Math.random() * 3;
          this.particles.push({
            x: well.x, y: well.y,
            vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
            alpha: 0.8, decay: 0.02 + Math.random() * 0.02,
            color: Math.random() > 0.3 ? '#CC66FF' : '#FFFFFF',
            size: 2 + Math.random() * 3,
            type: 'burst'
          });
        }
        // singBurst被动：结束时爆炸累积伤害8%（范围=黑洞范围）
        if (ctx.saveManager && ctx.saveManager.hasWeaponPassive('gravityWell', 'singBurst') && well.energyAccum > 0) {
          var burstDmg = well.energyAccum * 0.08;
          var burstR = well.radius;
          for (var bi = 0; bi < ctx.bricks.length; bi++) {
            var bb = ctx.bricks[bi];
            if (!bb.alive) continue;
            var bbc = bb.getCenter();
            if (Math.sqrt((bbc.x - well.x) ** 2 + (bbc.y - well.y) ** 2) <= burstR) {
              ctx.damageBrick(bb, burstDmg, 'gravityWell_burst', 'energy');
            }
          }
          if (ctx.boss && ctx.boss.alive) {
            var bd = Math.sqrt((ctx.boss.getCenterX() - well.x) ** 2 + (ctx.boss.getCenterY() - well.y) ** 2);
            if (bd <= burstR) ctx.damageBoss(burstDmg, 'gravityWell_burst');
          }
          this.explosions = this.explosions || [];
          this.explosions.push({ x: well.x, y: well.y, radius: burstR, alpha: 1.0 });
        }
        this.wells.splice(i, 1);
      }
    }

    // --- 更新黑洞体 ---
    this._updateNegaBricks(dt, ctx, annihilateLv, negaShieldLv);

    // --- 更新粒子 ---
    this._updateParticles(dt);
  }

  _spawnWell(ctx, damageLv, singularityLv) {
    var bricks = ctx.bricks || [];
    var bestX = ctx.gameWidth * 0.5;
    var bestY = ctx.gameHeight * 0.4;
    var bestCount = 0;
    // singularity 增加范围（原来damage加范围，现在改为singularity加）
    var radius = BASE_RADIUS + singularityLv * 20;

    for (var sy = 0; sy < 3; sy++) {
      for (var sx = 0; sx < 3; sx++) {
        var tx = ctx.gameWidth * (0.2 + sx * 0.3);
        var ty = ctx.gameHeight * (0.2 + sy * 0.15);
        var cnt = 0;
        for (var b = 0; b < bricks.length; b++) {
          var br = bricks[b];
          if (br.hp <= 0) continue;
          var dx = br.x - tx, dy = br.y - ty;
          if (dx * dx + dy * dy < radius * radius) cnt++;
        }
        if (cnt > bestCount) { bestCount = cnt; bestX = tx; bestY = ty; }
      }
    }

    // 持续时间固定5s + superHole被动
    var superMult = (ctx && ctx.saveManager && ctx.saveManager.hasWeaponPassive('gravityWell', 'superHole')) ? 2 : 1;
    var duration = BASE_DURATION * superMult;
    var gravX2 = (ctx && ctx.saveManager && ctx.saveManager.hasWeaponPassive('gravityWell', 'gravityX2')) ? 2 : 1;
    var pullStr = BASE_PULL * gravX2;

    this.wells.push({
      x: bestX,
      y: bestY,
      radius: radius,
      pullStr: pullStr,
      duration: duration,
      timer: duration,
      tickTimer: 0,
      energyAccum: 0,
      birthTime: ctx.elapsedMs,
      _pullCount: 0,
      _killCount: 0,
      _totalExtended: 0,
    });
  }

  _pullBricks(well, ctx) {
    var bricks = ctx.bricks || [];
    for (var i = 0; i < bricks.length; i++) {
      var b = bricks[i];
      if (b.hp <= 0) continue;
      var dx = well.x - b.x;
      var dy = well.y - b.y;
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < well.radius && dist > 5) {
        var force = well.pullStr * (1 - dist / well.radius);
        b.x += (dx / dist) * force;
        // siphon被动：引力范围内受伤+20%
        if (ctx.saveManager && ctx.saveManager.hasWeaponPassive('gravityWell', 'siphon')) {
          b._siphonMark = ctx.elapsedMs + 500;
        }
        b.y += (dy / dist) * force;
        b._noMerge = true;
        b._noMergeTimer = 500;
      }
    }
  }

  _pullNegaBricks(well) {
    for (var i = 0; i < this.negaBricks.length; i++) {
      var nb = this.negaBricks[i];
      var dx = well.x - nb.x;
      var dy = well.y - nb.y;
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < well.radius && dist > 5) {
        var force = well.pullStr * 0.8 * (1 - dist / well.radius);
        nb.x += (dx / dist) * force;
        nb.y += (dy / dist) * force * 0.3;
      }
    }
  }

  _tickDamage(well, ctx, basePct, baseAttack, horizonLv, singularityLv, lensLv, damageLv, sustainLv) {
    var bricks = ctx.bricks || [];
    var lensMult = 1 + lensLv * 0.12;
    // 统计当前在引力范围内的砖块数（用于singularity加成）
    var pullCount = 0;
    for (var pc = 0; pc < bricks.length; pc++) {
      if (bricks[pc].hp <= 0) continue;
      var pdx = bricks[pc].x - well.x, pdy = bricks[pc].y - well.y;
      if (pdx * pdx + pdy * pdy < well.radius * well.radius) pullCount++;
    }
    var shopMult = 1.0;
    if (ctx && ctx.saveManager) {
      shopMult = ctx.saveManager.getWeaponDmgMultiplier(this.key);
    }
    // damage分支：纯伤害加成 +15%/级
    var damageMult = 1 + damageLv * 0.50;
    // singularity: 每个在范围内的砖块 +10%/级 tick伤害
    var pullBonus = 1;
    if (singularityLv > 0 && pullCount > 0) {
      pullBonus = Math.min(1.5, 1 + pullCount * singularityLv * 0.02); // 硬上限+50%
    }

    for (var i = 0; i < bricks.length; i++) {
      var b = bricks[i];
      if (b.hp <= 0) continue;
      var dx = b.x - well.x, dy = b.y - well.y;
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > well.radius) continue;

      // 基础tick伤害 = baseAttack × basePct% × shopMult × lensMult × damageMult
      var dmg = baseAttack * (basePct / 100) * shopMult * lensMult * damageMult * pullBonus;


      // horizon（事件视界）：距中心越近伤害越高
      // Lv1: 中心+50% 边缘+0%; Lv2: 中心+100% 边缘+0%
      if (horizonLv > 0) {
        var distRatio = dist / well.radius; // 0=中心, 1=边缘
        var horizonMult = 1 + horizonLv * 0.5 * (1 - distRatio);
        dmg *= horizonMult;
      }

      var wasAlive = b.hp > 0;
      ctx.damageBrick(b, dmg, 'gravityWell', 'energy');
      if (wasAlive && b.hp <= 0) well._killCount = (well._killCount || 0) + 1;
      well.energyAccum += dmg;
    }

  }

  accumulateEnergy(amount, brickX, brickY) {
    for (var i = 0; i < this.wells.length; i++) {
      var w = this.wells[i];
      var dx = brickX - w.x, dy = brickY - w.y;
      if (dx * dx + dy * dy < w.radius * w.radius) {
        w.energyAccum += amount;
      }
    }
  }

  damageNegaBrick(negaBrick, amount) {
    negaBrick.hp -= amount;
    negaBrick.flashTimer = 200;
  }

  _spawnNegaBrick(x, y, negaHp, ctx) {
    // 圆形「黑洞」负能量体，半径15px
    this.negaBricks.push({
      x: x,
      y: y,
      hp: -negaHp,
      radius: 15,        // 圆形半径
      width: 30,          // 碰撞用
      height: 30,
      birthTime: ctx.elapsedMs,
      lifetime: Infinity, // 永久存活
      flashTimer: 0,
      vortexAngle: 0,
    });
  }

  _updateNegaBricks(dt, ctx, annihilateLv, negaShieldLv) {
    var bricks = ctx.bricks || [];
    var now = ctx.elapsedMs;

    for (var i = this.negaBricks.length - 1; i >= 0; i--) {
      var nb = this.negaBricks[i];

      // 漩涡动画
      nb.vortexAngle += dt * 0.003;

      // 闪白衰减
      if (nb.flashTimer > 0) nb.flashTimer -= dt;

      // 超出屏幕消失
      if (nb.y > ctx.gameHeight + 50) {
        this.negaBricks.splice(i, 1);
        continue;
      }

      // 碰撞检测：圆形黑洞体 vs 普通砖块
      for (var j = 0; j < bricks.length; j++) {
        var b = bricks[j];
        if (b.hp <= 0) continue;
        var bw = b.width || 30, bh = b.height || 14;
        // 圆形 vs AABB 简易碰撞
        var closestX = Math.max(b.x - bw * 0.5, Math.min(nb.x, b.x + bw * 0.5));
        var closestY = Math.max(b.y - bh * 0.5, Math.min(nb.y, b.y + bh * 0.5));
        var ddx = nb.x - closestX, ddy = nb.y - closestY;
        if (ddx * ddx + ddy * ddy < nb.radius * nb.radius) {
          this._annihilate(nb, b, ctx, annihilateLv, negaShieldLv);
          if (nb.hp >= 0) break;
        }
      }

      // 负能量耗尽
      if (nb.hp >= 0) {
        this._negaBrickExpire(nb);
        this.negaBricks.splice(i, 1);
      }
    }
  }

  _annihilate(negaBrick, brick, ctx, annihilateLv, negaShieldLv) {
    var absNega = Math.abs(negaBrick.hp);
    var dmg = Math.min(absNega, brick.hp); // 湮灭伤害 = min(负能量, 砖HP)，无折扣

    // 扣血
    ctx.damageBrick(brick, dmg, 'negaBrick', 'energy');

    // negaShield分支：湮灭时概率只受50%消耗
    var consume = dmg;
    if (negaShieldLv > 0) {
      var shieldChance = negaShieldLv * 0.2; // 20%/级
      if (Math.random() < shieldChance) {
        consume = dmg * 0.5; // 只消耗50%
        // 护盾触发粒子
        for (var sp = 0; sp < 6; sp++) {
          var sa = Math.random() * Math.PI * 2;
          this.particles.push({
            x: negaBrick.x, y: negaBrick.y,
            vx: Math.cos(sa) * 2, vy: Math.sin(sa) * 2,
            alpha: 0.8, decay: 0.04,
            color: '#00CCFF',
            size: 2,
            type: 'burst'
          });
        }
      }
    }
    negaBrick.hp += consume;

    // 湮灭闪光粒子
    for (var p = 0; p < 12; p++) {
      var a = Math.random() * Math.PI * 2;
      var spd = 1.5 + Math.random() * 2.5;
      this.particles.push({
        x: brick.x, y: brick.y,
        vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
        alpha: 1.0, decay: 0.03 + Math.random() * 0.02,
        color: Math.random() > 0.4 ? '#FFFFFF' : '#CC88FF',
        size: 2 + Math.random() * 3,
        type: 'burst'
      });
    }

    // 湮灭冲击（annihilate分支）：额外造成20%范围能量伤害
    if (annihilateLv > 0) {
      var splashRange = 60 + annihilateLv * 20;
      var splashDmg = dmg * 0.2; // 湮灭伤害的20%
      var bricks = ctx.bricks || [];
      for (var i = 0; i < bricks.length; i++) {
        var other = bricks[i];
        if (other === brick || other.hp <= 0) continue;
        var dx = other.x - brick.x, dy = other.y - brick.y;
        if (dx * dx + dy * dy < splashRange * splashRange) {
          ctx.damageBrick(other, splashDmg, 'negaBrick_splash', 'energy');
        }
      }

      // 冲击波粒子
      for (var p = 0; p < 10; p++) {
        var a = (Math.PI * 2 / 10) * p;
        var spd = 2 + Math.random() * 2;
        this.particles.push({
          x: brick.x, y: brick.y,
          vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
          alpha: 0.8, decay: 0.03,
          color: Math.random() > 0.5 ? '#CC88FF' : '#FFFFFF',
          size: 2 + Math.random() * 2,
          type: 'burst'
        });
      }
    }

    // 屏幕震动
    if (dmg > 100) {
      if (!ctx.shakeCooldown) { ctx.screenShake = Math.min((ctx.screenShake || 0) + Math.min(dmg / 500, 3), 6); ctx.shakeCooldown = 10; }
    }
  }

  _negaBrickExpire(nb) {
    for (var p = 0; p < 8; p++) {
      var a = Math.random() * Math.PI * 2;
      this.particles.push({
        x: nb.x, y: nb.y,
        vx: Math.cos(a) * 1.5, vy: Math.sin(a) * 1.5,
        alpha: 0.5, decay: 0.03,
        color: '#7744AA',
        size: 2,
        type: 'burst'
      });
    }
  }

  _updateParticles(dt) {
    for (var i = this.particles.length - 1; i >= 0; i--) {
      var p = this.particles[i];
      if (p.type === 'pull') {
        var dx = p.tx - p.x, dy = p.ty - p.y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 3) {
          this.particles.splice(i, 1);
          continue;
        }
        p.x += (dx / dist) * p.speed;
        p.y += (dy / dist) * p.speed;
        p.alpha -= 0.01;
      } else {
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= p.decay;
      }
      if (p.alpha <= 0) this.particles.splice(i, 1);
    }
    if (this.particles.length > 80) this.particles.length = 80;
  }

  isInWell(bx, by) {
    for (var i = 0; i < this.wells.length; i++) {
      var w = this.wells[i];
      var dx = bx - w.x, dy = by - w.y;
      if (dx * dx + dy * dy < w.radius * w.radius) return true;
    }
    return false;
  }

  getNegaBrickAt(x, y) {
    for (var i = 0; i < this.negaBricks.length; i++) {
      var nb = this.negaBricks[i];
      var dx = x - nb.x, dy = y - nb.y;
      if (dx * dx + dy * dy < nb.radius * nb.radius) {
        return nb;
      }
    }
    return null;
  }

  getRenderData() {
    return {
      wells: this.wells,
      negaBricks: this.negaBricks,
      particles: this.particles,
    };
  }
}

module.exports = GravityWellWeapon;
