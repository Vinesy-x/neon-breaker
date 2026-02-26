/**
 * Blizzard.js → 白磷弹（Phosphor Bomb）
 * 从天而降的白磷弹，落地爆炸 + 区域燃烧 + 引燃蔓延
 */
const Weapon = require('./Weapon');
const Config = require('../Config');
const Sound = require('../systems/SoundManager');

class BlizzardWeapon extends Weapon {
  constructor() {
    super('blizzard');
    this.bombs = [];      // 下落中的白磷弹
    this.fireZones = [];  // 地面燃烧区域
    this.sparks = [];     // 火花/余烬粒子
  }

  getDamage(baseAttack) {
    return Math.max(0.1, baseAttack * this.def.basePct * (1 + (this.branches.damage || 0) * 0.5));
  }

  update(dtMs, ctx) {
    const dt = dtMs / 16.67;
    this.timer += dtMs;
    const interval = this.def.interval * Math.pow(0.85, this.branches.freq || 0);

    if (this.timer >= interval) {
      this.timer = 0;
      this._launch(ctx);
    }

    const baseAttack = ctx.getBaseAttack ? ctx.getBaseAttack() : 1;
    const damage = this.getDamage(baseAttack);
    const slowLv = this.branches.slow || 0;
    const frostbiteLv = this.branches.frostbite || 0;
    const shatterLv = this.branches.shatter || 0;

    // ===== 更新下落中的炸弹 =====
    for (let i = this.bombs.length - 1; i >= 0; i--) {
      const b = this.bombs[i];
      b.y += b.vy * dt;
      b.vy += 0.5 * dt; // 加速下坠

      // 拖尾粒子
      b.trailTimer = (b.trailTimer || 0) + dtMs;
      if (b.trailTimer >= 60) {
        b.trailTimer = 0;
        this.sparks.push({
          x: b.x + (Math.random() - 0.5) * 4,
          y: b.y + 3,
          vx: (Math.random() - 0.5) * 0.3,
          vy: -0.3 - Math.random() * 0.3,
          alpha: 0.8,
          size: 1.5 + Math.random() * 1.5,
          color: Math.random() > 0.5 ? '#FFEE88' : '#FFAA44',
          decay: 0.04 + Math.random() * 0.02,
        });
      }

      // 到达目标高度 → 爆炸
      if (b.y >= b.targetY) {
        this._explode(b, damage, ctx);
        this.bombs.splice(i, 1);
      }
    }

    // ===== 更新燃烧区域 =====
    for (let i = this.fireZones.length - 1; i >= 0; i--) {
      const z = this.fireZones[i];
      z.life -= dtMs;
      z.tickTimer += dtMs;
      z.flickerPhase = (z.flickerPhase || 0) + dtMs * 0.008;

      // 持续伤害tick
      if (z.tickTimer >= z.tickMs) {
        z.tickTimer -= z.tickMs;
        this._burnTick(z, damage, slowLv, frostbiteLv, ctx);
      }

      // 火焰粒子
      z.sparkTimer = (z.sparkTimer || 0) + dtMs;
      if (z.sparkTimer >= 150) {
        z.sparkTimer -= 150;
        this._emitFireParticle(z);
      }

      // 蔓延引燃：区域内被击杀的砖块周边再点燃
      if (shatterLv > 0 && z.life > 500) {
        z.spreadTimer = (z.spreadTimer || 0) + dtMs;
        if (z.spreadTimer >= 1500) {
          z.spreadTimer = 0;
          this._trySpread(z, damage * 0.5, ctx);
        }
      }

      if (z.life <= 0) {
        // 最终爆燃
        if (shatterLv > 0) {
          this._finalBurst(z, damage * (0.6 + shatterLv * 0.3), ctx);
        }
        this.fireZones.splice(i, 1);
      }
    }

    // ===== 更新粒子（硬上限60） =====
    while (this.sparks.length > 60) this.sparks.shift();
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i];
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vy -= 0.02 * dt;
      s.alpha -= s.decay * dt;
      if (s.alpha <= 0) this.sparks.splice(i, 1);
    }
  }

  _launch(ctx) {
    const count = 1 + (this.branches.count || 0);
    const targets = this._findTargets(ctx, count);

    for (let i = 0; i < targets.length; i++) {
      this.bombs.push({
        x: targets[i].x + (Math.random() - 0.5) * 20,
        y: -20,
        targetX: targets[i].x,
        targetY: targets[i].y,
        vy: 2 + Math.random() * 1.5,
        trailTimer: 0,
      });
    }
    Sound.blizzard();
  }

  _findTargets(ctx, count) {
    const aliveBricks = ctx.bricks.filter(b => b.alive);
    if (aliveBricks.length === 0) {
      const results = [];
      for (let i = 0; i < count; i++) {
        results.push({
          x: 30 + Math.random() * (Config.SCREEN_WIDTH - 60),
          y: Config.BRICK_TOP_OFFSET + Math.random() * (Config.SCREEN_HEIGHT * 0.4),
        });
      }
      return results;
    }

    const results = [];
    const used = new Set();
    for (let n = 0; n < count; n++) {
      let bestScore = -1, bestIdx = 0;
      for (let i = 0; i < aliveBricks.length; i++) {
        if (used.has(i)) continue;
        const bc = aliveBricks[i].getCenter();
        let nearby = 0;
        for (let j = 0; j < aliveBricks.length; j++) {
          const oc = aliveBricks[j].getCenter();
          const d = Math.sqrt((bc.x - oc.x) ** 2 + (bc.y - oc.y) ** 2);
          if (d < 80) nearby++;
        }
        if (nearby > bestScore) { bestScore = nearby; bestIdx = i; }
      }
      used.add(bestIdx);
      const bc = aliveBricks[bestIdx].getCenter();
      results.push({ x: bc.x, y: bc.y });
    }
    return results;
  }

  _explode(bomb, damage, ctx) {
    const baseRadius = 50 * (1 + (this.branches.radius || 0) * 0.25);
    const duration = 4000 + (this.branches.duration || 0) * 1500;
    const permafrostLv = this.branches.permafrost || 0;
    const tickMs = permafrostLv > 0 ? Math.max(250, 400 - permafrostLv * 60) : 400;

    // 落地即时AOE伤害
    const impactR = baseRadius * 0.8;
    for (let i = 0; i < ctx.bricks.length; i++) {
      const brick = ctx.bricks[i];
      if (!brick.alive) continue;
      const bc = brick.getCenter();
      if (Math.sqrt((bc.x - bomb.targetX) ** 2 + (bc.y - bomb.targetY) ** 2) <= impactR) {
        ctx.damageBrick(brick, damage * 1.5, 'blizzard', 'fire');
      }
    }
    if (ctx.boss && ctx.boss.alive) {
      if (Math.sqrt((ctx.boss.getCenterX() - bomb.targetX) ** 2 + (ctx.boss.getCenterY() - bomb.targetY) ** 2) <= impactR) {
        ctx.damageBoss(damage * 1.5, 'blizzard');
      }
    }

    // 创建燃烧区域
    this.fireZones.push({
      x: bomb.targetX,
      y: bomb.targetY,
      radius: baseRadius,
      life: duration,
      maxLife: duration,
      tickMs: tickMs,
      tickTimer: 0,
      sparkTimer: 0,
      spreadTimer: 0,
      flickerPhase: Math.random() * Math.PI * 2,
    });

    // 爆炸溅射火花
    for (let i = 0; i < 12; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 2;
      const colors = ['#FFFFFF', '#FFEE88', '#FFAA44', '#FF6622'];
      this.sparks.push({
        x: bomb.targetX,
        y: bomb.targetY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1,
        alpha: 1.0,
        size: 2 + Math.random() * 2.5,
        color: colors[Math.floor(Math.random() * colors.length)],
        decay: 0.025 + Math.random() * 0.02,
      });
    }

    if (ctx.particles) ctx.particles.emitBrickBreak(bomb.targetX - 15, bomb.targetY - 15, 30, 30, '#FF8833');
    ctx.screenShake = Math.min((ctx.screenShake || 0) + 3, 8);
    Sound.blizzardShatter();
  }

  _burnTick(zone, damage, slowLv, frostbiteLv, ctx) {
    const r = zone.radius;
    for (let i = 0; i < ctx.bricks.length; i++) {
      const brick = ctx.bricks[i];
      if (!brick.alive) continue;
      const bc = brick.getCenter();
      if (Math.sqrt((bc.x - zone.x) ** 2 + (bc.y - zone.y) ** 2) > r) continue;

      ctx.damageBrick(brick, damage, 'blizzard', 'fire');

      if (slowLv > 0 && brick.alive) {
        brick.speedMult = Math.max(0.1, brick.speedMult * (1 - slowLv * 0.15));
      }
      if (frostbiteLv > 0 && brick.alive && ctx.addDot) {
        ctx.addDot(brick, Math.max(0.1, damage * 0.08 * frostbiteLv), 2000, 'frostbite');
      }
    }
    if (ctx.boss && ctx.boss.alive) {
      if (Math.sqrt((ctx.boss.getCenterX() - zone.x) ** 2 + (ctx.boss.getCenterY() - zone.y) ** 2) <= r) {
        ctx.damageBoss(damage, 'blizzard');
      }
    }
  }

  _trySpread(zone, damage, ctx) {
    // 引燃蔓延：在燃烧区域边缘找到砖块，有概率生成小型子火焰
    const edgeBricks = [];
    for (let i = 0; i < ctx.bricks.length; i++) {
      const brick = ctx.bricks[i];
      if (!brick.alive) continue;
      const bc = brick.getCenter();
      const dist = Math.sqrt((bc.x - zone.x) ** 2 + (bc.y - zone.y) ** 2);
      if (dist > zone.radius && dist < zone.radius * 1.8) {
        edgeBricks.push(bc);
      }
    }
    if (edgeBricks.length > 0 && Math.random() < 0.35) {
      const target = edgeBricks[Math.floor(Math.random() * edgeBricks.length)];
      // 检查该位置是否已有火焰
      let tooClose = false;
      for (let j = 0; j < this.fireZones.length; j++) {
        const fz = this.fireZones[j];
        if (Math.sqrt((fz.x - target.x) ** 2 + (fz.y - target.y) ** 2) < 30) {
          tooClose = true; break;
        }
      }
      if (!tooClose) {
        this.fireZones.push({
          x: target.x, y: target.y,
          radius: zone.radius * 0.5,
          life: 1500, maxLife: 1500,
          tickMs: zone.tickMs, tickTimer: 0,
          sparkTimer: 0, spreadTimer: 99999, // 子火焰不再蔓延
          flickerPhase: Math.random() * Math.PI * 2,
        });
        // 引燃火花
        for (let k = 0; k < 5; k++) {
          const a = Math.random() * Math.PI * 2;
          this.sparks.push({
            x: target.x, y: target.y,
            vx: Math.cos(a) * 1, vy: Math.sin(a) * 1 - 0.5,
            alpha: 0.8, size: 2 + Math.random() * 2,
            color: Math.random() > 0.5 ? '#FFEE88' : '#FF6622',
            decay: 0.035,
          });
        }
      }
    }
  }

  _finalBurst(zone, damage, ctx) {
    const r = zone.radius * 1.3;
    for (let i = 0; i < ctx.bricks.length; i++) {
      const brick = ctx.bricks[i];
      if (!brick.alive) continue;
      const bc = brick.getCenter();
      if (Math.sqrt((bc.x - zone.x) ** 2 + (bc.y - zone.y) ** 2) <= r) {
        ctx.damageBrick(brick, damage, 'blizzard_shatter', 'fire');
      }
    }
    if (ctx.boss && ctx.boss.alive) {
      if (Math.sqrt((ctx.boss.getCenterX() - zone.x) ** 2 + (ctx.boss.getCenterY() - zone.y) ** 2) <= r) {
        ctx.damageBoss(damage, 'blizzard_shatter');
      }
    }
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2;
      this.sparks.push({
        x: zone.x, y: zone.y,
        vx: Math.cos(a) * (1.5 + Math.random() * 1.5),
        vy: Math.sin(a) * (1.5 + Math.random() * 1.5) - 1,
        alpha: 1.0, size: 2.5 + Math.random() * 2.5,
        color: ['#FFFFFF', '#FFEE88', '#FF6622'][Math.floor(Math.random() * 3)],
        decay: 0.025,
      });
    }
    ctx.screenShake = Math.min((ctx.screenShake || 0) + 2, 6);
  }

  _emitFireParticle(zone) {
    if (this.sparks.length >= 55) return; // 快满了就不发
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * zone.radius * 0.6;
    const colors = ['#FFFFFF', '#FFEE88', '#FFAA44', '#FF6622'];
    this.sparks.push({
      x: zone.x + Math.cos(angle) * dist,
      y: zone.y + Math.sin(angle) * dist,
      vx: (Math.random() - 0.5) * 0.3,
      vy: -1.0 - Math.random() * 1.0,
      alpha: 0.7 + Math.random() * 0.3,
      size: 2 + Math.random() * 2,
      color: colors[Math.floor(Math.random() * colors.length)],
      decay: 0.035 + Math.random() * 0.02, // 更快衰减
    });
  }

  getRenderData() {
    return { bombs: this.bombs, fireZones: this.fireZones, sparks: this.sparks, color: this.def.color };
  }

  getWingData(lcx, lcy) {
    return { type: 'blizzard', color: this.def.color, x: lcx, y: lcy };
  }
}

module.exports = BlizzardWeapon;
