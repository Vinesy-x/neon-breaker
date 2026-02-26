/**
 * GravityWell.js - 奇点引擎
 * 生成黑洞吸引砖块，累积能量伤害，生成负能量砖块触发湮灭
 */

var Weapon = require('./Weapon');
var Config = require('../Config');

// --- 常量 ---
var BASE_RADIUS = 120;       // 基础吸引半径（100→120）
var BASE_DURATION = 5000;    // 基础持续时间 5s（4→5）
var BASE_PULL = 0.4;         // 基础吸力 px/帧（0.3→0.4）
var TICK_INTERVAL = 400;     // 伤害tick间隔（500→400，更频繁）
var NEGA_BASE_RATE = 0.1;    // 负能量基础转化率（0.2→0.1 nerf）
var NEGA_LIFETIME = 15000;   // 负能量砖块存活时间
var PCT_HP_CAP_MULT = 10;    // %HP伤害上限 = baseAttack × 10（20→10 nerf）
var NEGA_BRICK_SIZE = 1.5;   // 负能量砖块大小倍率

class GravityWellWeapon extends Weapon {
  constructor() {
    super('gravityWell');
    this.timer = 0; // 获得后立刻释放第一个黑洞
    this.wells = [];       // 场上的黑洞
    this.negaBricks = [];  // 负能量砖块
    this.particles = [];   // 粒子效果
    this.cooldown = 0;     // 冷却倒计时（黑洞结束后才开始）
  }

  update(dt, ctx) {
    var damageLv = this.getBranch('damage');
    var horizonLv = this.getBranch('horizon');
    var singularityLv = this.getBranch('singularity');
    var negaLv = this.getBranch('negaEnergy');
    var darkMatterLv = this.getBranch('darkMatter');
    var annihilateLv = this.getBranch('annihilate');
    var freqLv = this.getBranch('freq');
    var countLv = this.getBranch('count');
    var lensLv = this.getBranch('lens');
    var baseAttack = ctx.getBaseAttack ? ctx.getBaseAttack() : 1;
    var basePct = this.def.basePct;
    var now = Date.now();

    // --- CD逻辑：场上有黑洞时不冷却，全部消失后才开始倒计时 ---
    var interval = this.def.interval - freqLv * 2000;
    interval = Math.max(interval, 3000);
    var maxWells = 1 + countLv;

    if (this.wells.length > 0) {
      // 有黑洞存活，不计冷却
      this.cooldown = interval;
    } else {
      // 没有黑洞，倒计冷却
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

      // 吸引负能量砖块
      this._pullNegaBricks(well);

      // tick伤害
      if (well.tickTimer <= 0) {
        well.tickTimer += TICK_INTERVAL;
        this._tickDamage(well, ctx, basePct, baseAttack, horizonLv, singularityLv, lensLv);
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

      // 黑洞结束
      if (well.timer <= 0) {
        // 生成负能量砖块
        if (negaLv > 0 && well.energyAccum > 0) {
          var rate = NEGA_BASE_RATE + negaLv * 0.1;
          var negaHp = well.energyAccum * rate;
          if (negaHp > 10) {
            this._spawnNegaBrick(well.x, well.y, negaHp, darkMatterLv);
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
        this.wells.splice(i, 1);
      }
    }

    // --- 更新负能量砖块 ---
    this._updateNegaBricks(dt, ctx, annihilateLv, darkMatterLv);

    // --- 更新粒子 ---
    this._updateParticles(dt);
  }

  _spawnWell(ctx, damageLv, singularityLv) {
    // 找砖块最密集的区域
    var bricks = ctx.bricks || [];
    var bestX = ctx.gameWidth * 0.5;
    var bestY = ctx.gameHeight * 0.4;
    var bestCount = 0;
    var radius = BASE_RADIUS + damageLv * 12;

    // 采样几个位置，选砖块最多的
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

    var duration = BASE_DURATION + singularityLv * 1500;
    var pullStr = BASE_PULL * (1 + damageLv * 0.2);

    this.wells.push({
      x: bestX,
      y: bestY,
      radius: radius,
      pullStr: pullStr,
      duration: duration,
      timer: duration,
      tickTimer: 0,
      energyAccum: 0,
      birthTime: Date.now(),
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
        b.y += (dy / dist) * force;
        // 标记禁止融合
        b._noMerge = true;
        b._noMergeTimer = 500; // 500ms内禁止融合
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

  _tickDamage(well, ctx, basePct, baseAttack, horizonLv, singularityLv, lensLv) {
    var bricks = ctx.bricks || [];
    var lensMult = 1 + lensLv * 0.12;

    for (var i = 0; i < bricks.length; i++) {
      var b = bricks[i];
      if (b.hp <= 0) continue;
      var dx = b.x - well.x, dy = b.y - well.y;
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > well.radius) continue;

      // 基础tick伤害
      var dmg = baseAttack * (basePct / 100) * lensMult;

      // 中心30px伤害翻倍（奇点）
      if (singularityLv > 0 && dist < 30) {
        dmg *= 2;
      }

      // 百分比HP伤害（事件视界）
      if (horizonLv > 0) {
        var pctDmg = b.maxHp * 0.02 * horizonLv;
        pctDmg = Math.min(pctDmg, baseAttack * PCT_HP_CAP_MULT);
        ctx.damageBrick(b, pctDmg, 'gravityWell_pctHp', 'energy');
        well.energyAccum += pctDmg;
      }

      ctx.damageBrick(b, dmg, 'gravityWell', 'energy');
      well.energyAccum += dmg;
    }
  }

  // 外部调用：其他武器对黑洞范围内砖块造成能量伤害时累积
  accumulateEnergy(amount, brickX, brickY) {
    for (var i = 0; i < this.wells.length; i++) {
      var w = this.wells[i];
      var dx = brickX - w.x, dy = brickY - w.y;
      if (dx * dx + dy * dy < w.radius * w.radius) {
        w.energyAccum += amount;
      }
    }
  }

  // 外部调用：能量伤害打到负能量砖块时充能
  damageNegaBrick(negaBrick, amount) {
    negaBrick.hp -= amount; // hp是负数，变得更负
    negaBrick.flashTimer = 200; // 闪白反馈
  }

  _spawnNegaBrick(x, y, negaHp, darkMatterLv) {
    var sizeMult = NEGA_BRICK_SIZE + darkMatterLv * 0.3;
    var lifetime = darkMatterLv >= 2 ? Infinity : NEGA_LIFETIME;
    this.negaBricks.push({
      x: x,
      y: y,
      hp: -negaHp,
      width: 30 * sizeMult,
      height: 20 * sizeMult,
      birthTime: Date.now(),
      lifetime: lifetime,
      sizeMult: sizeMult,
      flashTimer: 0,
      vortexAngle: 0,
    });
  }

  _updateNegaBricks(dt, ctx, annihilateLv, darkMatterLv) {
    var bricks = ctx.bricks || [];
    var now = Date.now();

    for (var i = this.negaBricks.length - 1; i >= 0; i--) {
      var nb = this.negaBricks[i];

      // 漩涡动画
      nb.vortexAngle += dt * 0.003;

      // 闪白衰减
      if (nb.flashTimer > 0) nb.flashTimer -= dt;

      // 超时消失
      if (nb.lifetime !== Infinity && now - nb.birthTime > nb.lifetime) {
        this._negaBrickExpire(nb);
        this.negaBricks.splice(i, 1);
        continue;
      }

      // 超出屏幕消失
      if (nb.y > ctx.gameHeight + 50) {
        this.negaBricks.splice(i, 1);
        continue;
      }

      // 碰撞检测：负能量砖块 vs 普通砖块
      var nbLeft = nb.x - nb.width * 0.5;
      var nbRight = nb.x + nb.width * 0.5;
      var nbTop = nb.y - nb.height * 0.5;
      var nbBot = nb.y + nb.height * 0.5;

      for (var j = 0; j < bricks.length; j++) {
        var b = bricks[j];
        if (b.hp <= 0) continue;
        var bw = b.width || 30, bh = b.height || 14;
        var bLeft = b.x - bw * 0.5, bRight = b.x + bw * 0.5;
        var bTop = b.y - bh * 0.5, bBot = b.y + bh * 0.5;

        // AABB碰撞
        if (nbRight > bLeft && nbLeft < bRight && nbBot > bTop && nbTop < bBot) {
          this._annihilate(nb, b, ctx, annihilateLv);
          if (nb.hp >= 0) break; // 负能量耗尽
        }
      }

      // 负能量耗尽
      if (nb.hp >= 0) {
        this._negaBrickExpire(nb);
        this.negaBricks.splice(i, 1);
      }
    }
  }

  _annihilate(negaBrick, brick, ctx, annihilateLv) {
    var absNega = Math.abs(negaBrick.hp);
    var dmg = Math.min(absNega, brick.hp);

    // 扣血
    ctx.damageBrick(brick, dmg, 'negaBrick', 'energy');
    negaBrick.hp += dmg; // 负值趋近0

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

    // 湮灭链溅射
    if (annihilateLv > 0) {
      var splashRange = 50 + annihilateLv * 15;  // 范围也砍
      var splashDmg = dmg * 0.05 * annihilateLv;  // 0.1 → 0.05 继续削
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
      for (var p = 0; p < 8; p++) {
        var a = (Math.PI * 2 / 8) * p;
        this.particles.push({
          x: brick.x, y: brick.y,
          vx: Math.cos(a) * 3, vy: Math.sin(a) * 3,
          alpha: 0.6, decay: 0.04,
          color: '#AA44FF',
          size: 2,
          type: 'burst'
        });
      }
    }

    // 屏幕震动
    if (dmg > 100) {
      ctx.screenShake = Math.min((ctx.screenShake || 0) + Math.min(dmg / 500, 6), 12);
    }
  }

  _negaBrickExpire(nb) {
    // 消失时释放少量粒子
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
        // 向目标拉近
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
        // 爆发粒子
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= p.decay;
      }
      if (p.alpha <= 0) this.particles.splice(i, 1);
    }
    // 粒子上限
    if (this.particles.length > 80) this.particles.length = 80;
  }

  // 检查一个砖块是否在黑洞范围内（供其他武器查询）
  isInWell(bx, by) {
    for (var i = 0; i < this.wells.length; i++) {
      var w = this.wells[i];
      var dx = bx - w.x, dy = by - w.y;
      if (dx * dx + dy * dy < w.radius * w.radius) return true;
    }
    return false;
  }

  // 检查目标是否是负能量砖块（供离子射线等查询）
  getNegaBrickAt(x, y) {
    for (var i = 0; i < this.negaBricks.length; i++) {
      var nb = this.negaBricks[i];
      var hw = nb.width * 0.5, hh = nb.height * 0.5;
      if (x > nb.x - hw && x < nb.x + hw && y > nb.y - hh && y < nb.y + hh) {
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
