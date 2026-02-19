/**
 * WeaponSystem.js - 武器技能系统（向僵尸开炮式）
 * 每个武器有独立视觉实体，自动攻击砖块
 * 射击模式：武器围绕发射器运作
 */
const Config = require('./Config');
const Sound = require('./SoundManager');

// ===== 武器基类 =====
class Weapon {
  constructor(key, level) {
    this.key = key;
    this.level = level;
    this.evolved = false;
    this.def = Config.WEAPONS[key];
    this.timer = 0;
  }

  getStats() {
    if (this.evolved) return this.def.evolve;
    return this.def.levels[Math.min(this.level - 1, this.def.levels.length - 1)];
  }

  levelUp() {
    if (this.level < this.def.maxLevel) {
      this.level++;
    }
  }

  evolve() {
    this.evolved = true;
  }

  update(dtMs, ctx) {
    // override in subclass
  }
}

// ===== 等离子刃 - 环绕发射器旋转 =====
class OrbitBlade extends Weapon {
  constructor(level) {
    super('orbitBlade', level);
    this.angle = 0;
  }

  update(dtMs, ctx) {
    const stats = this.getStats();
    const speed = stats.speed || 0.05;
    this.angle += speed * (dtMs / 16.67);

    const launcherCx = ctx.launcher.getCenterX();
    const launcherCy = ctx.launcher.y;
    const count = stats.count || 1;

    for (let i = 0; i < count; i++) {
      const a = this.angle + (Math.PI * 2 / count) * i;
      const bx = launcherCx + Math.cos(a) * stats.radius;
      const by = launcherCy + Math.sin(a) * stats.radius;

      for (let j = 0; j < ctx.bricks.length; j++) {
        const brick = ctx.bricks[j];
        if (!brick.alive) continue;
        const bc = brick.getCenter();
        const dx = bx - bc.x;
        const dy = by - bc.y;
        if (Math.abs(dx) < brick.width / 2 + 8 && Math.abs(dy) < brick.height / 2 + 8) {
          ctx.damageBrick(brick, stats.damage, 'orbitBlade');
        }
      }

      if (ctx.boss && ctx.boss.alive) {
        const dx = bx - ctx.boss.getCenterX();
        const dy = by - ctx.boss.getCenterY();
        if (Math.abs(dx) < ctx.boss.width / 2 + 10 && Math.abs(dy) < ctx.boss.height / 2 + 10) {
          ctx.damageBoss(stats.damage);
        }
      }
    }
  }

  getRenderData(launcherCx, launcherCy) {
    const stats = this.getStats();
    const count = stats.count || 1;
    const blades = [];
    for (let i = 0; i < count; i++) {
      const a = this.angle + (Math.PI * 2 / count) * i;
      blades.push({
        x: launcherCx + Math.cos(a) * stats.radius,
        y: launcherCy + Math.sin(a) * stats.radius,
        angle: a,
      });
    }
    return { blades, color: this.evolved ? this.def.evolve.color : this.def.color };
  }
}

// ===== 烈焰涌动 - 火焰波从发射器向上扩散 =====
class FireSurge extends Weapon {
  constructor(level) {
    super('fireSurge', level);
    this.waves = [];
  }

  update(dtMs, ctx) {
    const stats = this.getStats();
    this.timer += dtMs;

    if (this.timer >= stats.interval) {
      this.timer = 0;
      Sound.fireSurge();
      const w = Config.SCREEN_WIDTH * (stats.width || 0.5);
      this.waves.push({
        x: ctx.launcher.getCenterX(),
        y: ctx.launcher.y,
        width: w,
        alpha: 1.0,
        damage: stats.damage,
        hit: {},
      });
    }

    for (let i = this.waves.length - 1; i >= 0; i--) {
      const wave = this.waves[i];
      wave.y -= 4 * (dtMs / 16.67);
      wave.alpha -= 0.015 * (dtMs / 16.67);
      wave.width += 1.5 * (dtMs / 16.67);

      for (let j = 0; j < ctx.bricks.length; j++) {
        const brick = ctx.bricks[j];
        if (!brick.alive) continue;
        const brickId = j;
        if (wave.hit[brickId]) continue;
        const bc = brick.getCenter();
        if (Math.abs(bc.y - wave.y) < 12 && Math.abs(bc.x - wave.x) < wave.width / 2) {
          wave.hit[brickId] = true;
          ctx.damageBrick(brick, wave.damage, 'fireSurge');
        }
      }

      if (ctx.boss && ctx.boss.alive) {
        const by = ctx.boss.getCenterY();
        if (Math.abs(by - wave.y) < 20 && !wave.hit['boss']) {
          wave.hit['boss'] = true;
          ctx.damageBoss(wave.damage);
        }
      }

      if (wave.alpha <= 0 || wave.y < -20) {
        this.waves.splice(i, 1);
      }
    }
  }

  getRenderData() {
    return {
      waves: this.waves,
      color: this.evolved ? this.def.evolve.color : this.def.color,
    };
  }
}

// ===== 链式闪电 - 自动锁定砖块释放 =====
class Lightning extends Weapon {
  constructor(level) {
    super('lightning', level);
    this.bolts = [];
  }

  update(dtMs, ctx) {
    const stats = this.getStats();
    this.timer += dtMs;

    if (this.timer >= stats.interval) {
      this.timer = 0;
      this._fire(stats, ctx);
    }

    for (let i = this.bolts.length - 1; i >= 0; i--) {
      this.bolts[i].alpha -= 0.04 * (dtMs / 16.67);
      if (this.bolts[i].alpha <= 0) this.bolts.splice(i, 1);
    }
  }

  _fire(stats, ctx) {
    const aliveBricks = ctx.bricks.filter(b => b.alive);
    if (aliveBricks.length === 0 && !(ctx.boss && ctx.boss.alive)) return;

    const startX = ctx.launcher.getCenterX();
    const startY = ctx.launcher.y - 10;
    const points = [{ x: startX, y: startY }];
    const hit = new Set();
    let lastX = startX, lastY = startY;

    const chains = stats.chains || 1;
    for (let c = 0; c <= chains; c++) {
      let nearest = null, nearDist = Infinity;
      for (let i = 0; i < aliveBricks.length; i++) {
        if (hit.has(i)) continue;
        const bc = aliveBricks[i].getCenter();
        const dx = bc.x - lastX, dy = bc.y - lastY;
        const d = dx * dx + dy * dy;
        if (d < nearDist) { nearDist = d; nearest = { idx: i, brick: aliveBricks[i] }; }
      }
      if (!nearest) {
        if (ctx.boss && ctx.boss.alive && !hit.has('boss')) {
          hit.add('boss');
          const bx = ctx.boss.getCenterX(), by = ctx.boss.getCenterY();
          points.push({ x: bx, y: by });
          ctx.damageBoss(stats.damage);
        }
        break;
      }
      hit.add(nearest.idx);
      const bc = nearest.brick.getCenter();
      points.push({ x: bc.x, y: bc.y });
      ctx.damageBrick(nearest.brick, stats.damage, 'lightning');
      lastX = bc.x; lastY = bc.y;
    }

    if (points.length > 1) {
      this.bolts.push({ points: points, alpha: 1.0 });
      Sound.lightning();
    }
  }

  getRenderData() {
    return { bolts: this.bolts, color: this.evolved ? this.def.evolve.color : this.def.color };
  }
}

// ===== 追踪导弹 =====
class Missile extends Weapon {
  constructor(level) {
    super('missile', level);
    this.missiles = [];
    this.explosions = [];
  }

  update(dtMs, ctx) {
    const stats = this.getStats();
    const dt = dtMs / 16.67;
    this.timer += dtMs;

    if (this.timer >= stats.interval) {
      this.timer = 0;
      Sound.missileLaunch();
      const count = stats.count || 1;
      for (let i = 0; i < count; i++) {
        this._launch(stats, ctx, i);
      }
    }

    const speed = stats.speed || 3;
    for (let i = this.missiles.length - 1; i >= 0; i--) {
      const m = this.missiles[i];

      let tx = m.targetX, ty = m.targetY;
      if (m.targetBrick && m.targetBrick.alive) {
        const bc = m.targetBrick.getCenter();
        tx = bc.x; ty = bc.y;
      } else if (ctx.boss && ctx.boss.alive) {
        tx = ctx.boss.getCenterX(); ty = ctx.boss.getCenterY();
      }

      const dx = tx - m.x, dy = ty - m.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 3) {
        m.x += (dx / dist) * speed * dt;
        m.y += (dy / dist) * speed * dt;
      }

      m.trail.push({ x: m.x, y: m.y });
      if (m.trail.length > 6) m.trail.shift();

      let hit = false;
      for (let j = 0; j < ctx.bricks.length; j++) {
        const brick = ctx.bricks[j];
        if (!brick.alive) continue;
        const bc = brick.getCenter();
        if (Math.abs(m.x - bc.x) < brick.width / 2 + 5 && Math.abs(m.y - bc.y) < brick.height / 2 + 5) {
          ctx.damageBrick(brick, m.damage, 'missile');

          const er = this.evolved ? (this.def.evolve.explodeRadius || 0) : 0;
          if (er > 0) {
            this._explodeArea(m.x, m.y, er, m.damage, ctx);
            this.explosions.push({ x: m.x, y: m.y, radius: er, alpha: 1.0 });
            Sound.missileExplode();
          }
          hit = true;
          break;
        }
      }

      if (!hit && ctx.boss && ctx.boss.alive) {
        if (Math.abs(m.x - ctx.boss.getCenterX()) < ctx.boss.width / 2 + 5 &&
            Math.abs(m.y - ctx.boss.getCenterY()) < ctx.boss.height / 2 + 5) {
          ctx.damageBoss(m.damage);
          hit = true;
        }
      }

      if (hit || m.y < -20 || m.y > Config.SCREEN_HEIGHT + 20) {
        this.missiles.splice(i, 1);
      }
    }

    for (let i = this.explosions.length - 1; i >= 0; i--) {
      this.explosions[i].alpha -= 0.05 * dt;
      if (this.explosions[i].alpha <= 0) this.explosions.splice(i, 1);
    }
  }

  _launch(stats, ctx, index) {
    const aliveBricks = ctx.bricks.filter(b => b.alive);
    let targetBrick = null;
    if (aliveBricks.length > 0) {
      targetBrick = aliveBricks[Math.floor(Math.random() * aliveBricks.length)];
    }

    const offsetX = (index - ((stats.count || 1) - 1) / 2) * 20;
    this.missiles.push({
      x: ctx.launcher.getCenterX() + offsetX,
      y: ctx.launcher.y - 10,
      targetBrick: targetBrick,
      targetX: targetBrick ? targetBrick.getCenter().x : Config.SCREEN_WIDTH / 2,
      targetY: targetBrick ? targetBrick.getCenter().y : 100,
      damage: stats.damage,
      trail: [],
    });
  }

  _explodeArea(cx, cy, radius, damage, ctx) {
    for (let i = 0; i < ctx.bricks.length; i++) {
      const brick = ctx.bricks[i];
      if (!brick.alive) continue;
      const bc = brick.getCenter();
      const dx = bc.x - cx, dy = bc.y - cy;
      if (Math.sqrt(dx * dx + dy * dy) <= radius) {
        ctx.damageBrick(brick, damage, 'missile_explode');
      }
    }
  }

  getRenderData() {
    return {
      missiles: this.missiles,
      explosions: this.explosions,
      color: this.evolved ? this.def.evolve.color : this.def.color,
    };
  }
}

// ===== 激光射线 =====
class LaserBeam extends Weapon {
  constructor(level) {
    super('laserBeam', level);
    this.beams = [];
  }

  update(dtMs, ctx) {
    const stats = this.getStats();
    this.timer += dtMs;

    if (this.timer >= stats.interval) {
      this.timer = 0;
      const x = ctx.launcher.getCenterX();
      Sound.laserBeam();
      const beam = {
        x: x, topY: 0, alpha: 1.0,
        width: stats.width || 4,
        damage: stats.damage,
        duration: stats.duration || 300,
        life: stats.duration || 300,
        hitSet: {},
      };
      for (let i = 0; i < ctx.bricks.length; i++) {
        const brick = ctx.bricks[i];
        if (!brick.alive) continue;
        if (Math.abs(brick.getCenter().x - x) < brick.width / 2 + beam.width) {
          beam.hitSet[i] = true;
          ctx.damageBrick(brick, beam.damage, 'laserBeam');
        }
      }
      if (ctx.boss && ctx.boss.alive) {
        if (Math.abs(ctx.boss.getCenterX() - x) < ctx.boss.width / 2 + beam.width) {
          ctx.damageBoss(beam.damage * 2);
        }
      }
      this.beams.push(beam);
    }

    for (let i = this.beams.length - 1; i >= 0; i--) {
      this.beams[i].life -= dtMs;
      this.beams[i].alpha = Math.max(0, this.beams[i].life / this.beams[i].duration);
      if (this.beams[i].life <= 0) this.beams.splice(i, 1);
    }
  }

  getRenderData() {
    return { beams: this.beams, color: this.evolved ? this.def.evolve.color : this.def.color };
  }
}

// ===== 冰霜领域 =====
class IceField extends Weapon {
  constructor(level) {
    super('iceField', level);
    this.icicles = [];
  }

  update(dtMs, ctx) {
    const stats = this.getStats();
    const dt = dtMs / 16.67;

    ctx.advanceSlowMult = stats.slowMult || 1;

    this.timer += dtMs;
    if (this.timer >= (stats.iceInterval || 3000)) {
      this.timer = 0;
      Sound.iceShot();
      const aliveBricks = ctx.bricks.filter(b => b.alive);
      if (aliveBricks.length > 0) {
        const target = aliveBricks[Math.floor(Math.random() * aliveBricks.length)];
        const bc = target.getCenter();
        this.icicles.push({
          x: bc.x + (Math.random() - 0.5) * 30,
          y: -10,
          targetX: bc.x,
          targetY: bc.y,
          vy: 4,
          damage: stats.iceDamage || 1,
          trail: [],
        });
      }
    }

    for (let i = this.icicles.length - 1; i >= 0; i--) {
      const ic = this.icicles[i];
      ic.y += ic.vy * dt;

      ic.trail.push({ x: ic.x, y: ic.y });
      if (ic.trail.length > 4) ic.trail.shift();

      let hit = false;
      for (let j = 0; j < ctx.bricks.length; j++) {
        const brick = ctx.bricks[j];
        if (!brick.alive) continue;
        const bc = brick.getCenter();
        if (Math.abs(ic.x - bc.x) < brick.width / 2 + 4 && Math.abs(ic.y - bc.y) < brick.height / 2 + 4) {
          ctx.damageBrick(brick, ic.damage, 'iceField');
          hit = true;
          break;
        }
      }
      if (hit || ic.y > Config.SCREEN_HEIGHT + 10) {
        this.icicles.splice(i, 1);
      }
    }
  }

  getRenderData() {
    return {
      icicles: this.icicles,
      color: this.evolved ? this.def.evolve.color : this.def.color,
      slowMult: this.getStats().slowMult,
    };
  }
}

// ===== 武器工厂 =====
function createWeapon(key, level) {
  switch (key) {
    case 'orbitBlade': return new OrbitBlade(level);
    case 'fireSurge': return new FireSurge(level);
    case 'lightning': return new Lightning(level);
    case 'missile': return new Missile(level);
    case 'laserBeam': return new LaserBeam(level);
    case 'iceField': return new IceField(level);
  }
  return null;
}

module.exports = { Weapon, createWeapon, OrbitBlade, FireSurge, Lightning, Missile, LaserBeam, IceField };
