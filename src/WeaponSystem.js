/**
 * WeaponSystem.js - v6.0 武器升级树系统
 * 每个武器有独立分支升级树，伤害基于攻击力百分比
 * 每种武器在飞机周围有辅翼表现
 */
const Config = require('./Config');
const Sound = require('./SoundManager');

// ===== 武器基类 =====
class Weapon {
  constructor(key) {
    this.key = key;
    this.def = Config.WEAPON_TREES[key];
    this.timer = 0;
    this.branches = {};
    for (const bk in this.def.branches) {
      this.branches[bk] = 0;
    }
  }

  getBranch(key) { return this.branches[key] || 0; }

  upgradeBranch(key) {
    const bDef = this.def.branches[key];
    if (!bDef) return false;
    if (this.branches[key] >= bDef.max) return false;
    if (bDef.requires) {
      for (const rk in bDef.requires) {
        if ((this.branches[rk] || 0) < bDef.requires[rk]) return false;
      }
    }
    this.branches[key]++;
    return true;
  }

  canUpgrade(branchKey) {
    const bDef = this.def.branches[branchKey];
    if (!bDef) return false;
    if (this.branches[branchKey] >= bDef.max) return false;
    if (bDef.requires) {
      for (const rk in bDef.requires) {
        if ((this.branches[rk] || 0) < bDef.requires[rk]) return false;
      }
    }
    return true;
  }

  getDamage(baseAttack) {
    const dmgLv = this.branches.damage || 0;
    return Math.max(1, Math.floor(baseAttack * (this.def.basePct + dmgLv * 0.5)));
  }

  update(dtMs, ctx) { /* override */ }
  getRenderData() { return null; }
  getWingData(lcx, lcy) { return null; }
}

// ===== 光能飞刀 =====
class Kunai extends Weapon {
  constructor() {
    super('kunai');
    this.knives = [];
  }

  update(dtMs, ctx) {
    const dt = dtMs / 16.67;
    this.timer += dtMs;
    const speedMult = 1 + (this.branches.speed || 0) * 0.3;
    const interval = this.def.interval / speedMult;

    if (this.timer >= interval) {
      this.timer = 0;
      this._fire(ctx);
    }

    const baseAttack = ctx.getBaseAttack ? ctx.getBaseAttack() : 1;
    const damage = this.getDamage(baseAttack);

    for (let i = this.knives.length - 1; i >= 0; i--) {
      const k = this.knives[i];
      k.x += k.vx * dt;
      k.y += k.vy * dt;
      k.life -= dtMs;
      k.tickTimer += dtMs;

      if (k.tickTimer >= 100) {
        k.tickTimer = 0;
        this._checkHit(k, damage, ctx);
      }

      if (k.returning) {
        const dx = k.homeX - k.x, dy = k.homeY - k.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 15) { this.knives.splice(i, 1); continue; }
        k.vx = (dx / dist) * 6;
        k.vy = (dy / dist) * 6;
      } else if ((this.branches.return || 0) > 0 && k.life <= k.maxLife * 0.4) {
        k.returning = true;
        k.homeX = ctx.launcher.getCenterX();
        k.homeY = ctx.launcher.y;
        k.hitSet = {};
      }

      if (!k.returning && (k.life <= 0 || k.y < -20 || k.x < -20 || k.x > Config.SCREEN_WIDTH + 20)) {
        this.knives.splice(i, 1);
      }
    }
  }

  _fire(ctx) {
    const count = 1 + (this.branches.count || 0);
    const scatterLv = this.branches.scatter || 0;
    const speedMult = 1 + (this.branches.speed || 0) * 0.3;
    const cx = ctx.launcher.getCenterX();
    const cy = ctx.launcher.y - 10;
    const baseSpeed = 5 * speedMult;
    const totalSpread = scatterLv > 0 ? (Math.PI / 6) * scatterLv : (count > 1 ? Math.PI / 8 : 0);

    for (let i = 0; i < count; i++) {
      let angle = -Math.PI / 2;
      if (count > 1) {
        angle = -Math.PI / 2 - totalSpread / 2 + (totalSpread / (count - 1)) * i;
      }
      const maxLife = 2500 + (this.branches.pierce || 0) * 500;
      this.knives.push({
        x: cx + (i - (count - 1) / 2) * 8, y: cy,
        vx: Math.cos(angle) * baseSpeed, vy: Math.sin(angle) * baseSpeed,
        pierce: this.branches.pierce || 0,
        life: maxLife, maxLife: maxLife,
        returning: false, homeX: cx, homeY: cy,
        tickTimer: 0, hitSet: {},
      });
    }
    Sound.bulletShoot();
  }

  _checkHit(knife, damage, ctx) {
    for (let j = 0; j < ctx.bricks.length; j++) {
      const brick = ctx.bricks[j];
      if (!brick.alive) continue;
      if (knife.hitSet[j] && !knife.returning) continue;
      const bc = brick.getCenter();
      if (Math.abs(knife.x - bc.x) < brick.width / 2 + 6 && Math.abs(knife.y - bc.y) < brick.height / 2 + 6) {
        knife.hitSet[j] = true;
        ctx.damageBrick(brick, damage, 'kunai');
        if (knife.pierce > 0) { knife.pierce--; }
        else if (!knife.returning) { knife.life = 0; }
      }
    }
    if (ctx.boss && ctx.boss.alive) {
      const bx = ctx.boss.getCenterX(), by = ctx.boss.getCenterY();
      if (Math.abs(knife.x - bx) < ctx.boss.width / 2 + 6 && Math.abs(knife.y - by) < ctx.boss.height / 2 + 6) {
        ctx.damageBoss(damage);
      }
    }
  }

  getRenderData() { return { knives: this.knives, color: this.def.color }; }
  getWingData(lcx, lcy) { return { type: 'kunai', color: this.def.color, x: lcx, y: lcy }; }
}

// ===== 闪电链 =====
class LightningWeapon extends Weapon {
  constructor() {
    super('lightning');
    this.bolts = [];
  }

  update(dtMs, ctx) {
    const dt = dtMs / 16.67;
    this.timer += dtMs;
    const interval = this.def.interval * Math.pow(0.8, this.branches.freq || 0);

    if (this.timer >= interval) {
      this.timer = 0;
      const times = 1 + (this.branches.storm || 0);
      for (let t = 0; t < times; t++) this._fire(ctx);
    }

    for (let i = this.bolts.length - 1; i >= 0; i--) {
      this.bolts[i].alpha -= 0.04 * dt;
      if (this.bolts[i].alpha <= 0) this.bolts.splice(i, 1);
    }
  }

  _fire(ctx) {
    const baseAttack = ctx.getBaseAttack ? ctx.getBaseAttack() : 1;
    const damage = this.getDamage(baseAttack);
    const aliveBricks = ctx.bricks.filter(b => b.alive);
    if (aliveBricks.length === 0 && !(ctx.boss && ctx.boss.alive)) return;

    const startX = ctx.launcher.getCenterX(), startY = ctx.launcher.y - 10;
    const points = [{ x: startX, y: startY }];
    const hit = new Set();
    let lastX = startX, lastY = startY;
    const chains = 1 + (this.branches.chains || 0);
    const overloadLv = this.branches.overload || 0;
    const paralyzeLv = this.branches.paralyze || 0;

    for (let c = 0; c < chains; c++) {
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
          points.push({ x: ctx.boss.getCenterX(), y: ctx.boss.getCenterY() });
          ctx.damageBoss(damage);
        }
        break;
      }
      hit.add(nearest.idx);
      const bc = nearest.brick.getCenter();
      points.push({ x: bc.x, y: bc.y });
      ctx.damageBrick(nearest.brick, damage, 'lightning');
      if (paralyzeLv > 0 && nearest.brick.alive) {
        nearest.brick.speedMult = Math.max(0.3, nearest.brick.speedMult * (1 - paralyzeLv * 0.15));
      }
      lastX = bc.x; lastY = bc.y;
      if (overloadLv > 0 && c === chains - 1) {
        this._explodeAt(bc.x, bc.y, 40, damage, ctx);
      }
    }

    if (points.length > 1) {
      this.bolts.push({ points: points, alpha: 1.0 });
      Sound.lightning();
    }
  }

  _explodeAt(cx, cy, radius, damage, ctx) {
    for (let i = 0; i < ctx.bricks.length; i++) {
      const brick = ctx.bricks[i];
      if (!brick.alive) continue;
      const bc = brick.getCenter();
      if (Math.sqrt((bc.x - cx) ** 2 + (bc.y - cy) ** 2) <= radius) {
        ctx.damageBrick(brick, Math.floor(damage * 0.5), 'lightning_aoe');
      }
    }
    if (ctx.particles) ctx.particles.emitBrickBreak(cx - 10, cy - 10, 20, 20, Config.NEON_YELLOW);
  }

  getRenderData() { return { bolts: this.bolts, color: this.def.color }; }
  getWingData(lcx, lcy) { return { type: 'lightning', color: this.def.color, x: lcx, y: lcy }; }
}

// ===== 追踪导弹 =====
class MissileWeapon extends Weapon {
  constructor() {
    super('missile');
    this.missiles = [];
    this.explosions = [];
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
    const trackMult = 1 + (this.branches.tracking || 0) * 0.3;
    const speed = 3 * trackMult;
    const baseAoe = 25 * (1 + (this.branches.aoe || 0) * 0.25);
    const splitLv = this.branches.split || 0;
    const nukeLv = this.branches.nuke || 0;

    for (let i = this.missiles.length - 1; i >= 0; i--) {
      const m = this.missiles[i];
      let tx = m.targetX, ty = m.targetY;
      if (m.targetBrick && m.targetBrick.alive) {
        const bc = m.targetBrick.getCenter(); tx = bc.x; ty = bc.y;
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
          ctx.damageBrick(brick, damage, 'missile');
          const effectiveAoe = nukeLv > 0 ? baseAoe * 3 : baseAoe;
          this._explodeArea(m.x, m.y, effectiveAoe, Math.floor(damage * 0.5), ctx);
          this.explosions.push({ x: m.x, y: m.y, radius: effectiveAoe, alpha: 1.0 });
          if (nukeLv > 0) ctx.screenShake = Math.min((ctx.screenShake || 0) + 6, 12);
          if (splitLv > 0) this._spawnSplits(m.x, m.y, splitLv, ctx);
          Sound.missileExplode();
          hit = true; break;
        }
      }
      if (!hit && ctx.boss && ctx.boss.alive) {
        if (Math.abs(m.x - ctx.boss.getCenterX()) < ctx.boss.width / 2 + 5 &&
            Math.abs(m.y - ctx.boss.getCenterY()) < ctx.boss.height / 2 + 5) {
          ctx.damageBoss(damage); hit = true;
        }
      }
      if (hit || m.y < -20 || m.y > Config.SCREEN_HEIGHT + 20 ||
          (m.isSplitChild && --m.splitLife <= 0)) {
        this.missiles.splice(i, 1);
      }
    }

    for (let i = this.explosions.length - 1; i >= 0; i--) {
      this.explosions[i].alpha -= 0.05 * dt;
      if (this.explosions[i].alpha <= 0) this.explosions.splice(i, 1);
    }
  }

  _launch(ctx) {
    const count = 1 + (this.branches.count || 0);
    const aliveBricks = ctx.bricks.filter(b => b.alive);
    Sound.missileLaunch();
    for (let i = 0; i < count; i++) {
      let targetBrick = aliveBricks.length > 0 ? aliveBricks[Math.floor(Math.random() * aliveBricks.length)] : null;
      this.missiles.push({
        x: ctx.launcher.getCenterX() + (i - (count - 1) / 2) * 20,
        y: ctx.launcher.y - 10,
        targetBrick: targetBrick,
        targetX: targetBrick ? targetBrick.getCenter().x : Config.SCREEN_WIDTH / 2,
        targetY: targetBrick ? targetBrick.getCenter().y : 100,
        trail: [],
      });
    }
  }

  _explodeArea(cx, cy, radius, damage, ctx) {
    for (let i = 0; i < ctx.bricks.length; i++) {
      const brick = ctx.bricks[i];
      if (!brick.alive) continue;
      const bc = brick.getCenter();
      if (Math.sqrt((bc.x - cx) ** 2 + (bc.y - cy) ** 2) <= radius) {
        ctx.damageBrick(brick, damage, 'missile_aoe');
      }
    }
  }

  _spawnSplits(cx, cy, level, ctx) {
    const n = 3 * level;
    for (let i = 0; i < n; i++) {
      const angle = (Math.PI * 2 / n) * i;
      this.missiles.push({
        x: cx, y: cy,
        targetBrick: null,
        targetX: cx + Math.cos(angle) * 80,
        targetY: cy + Math.sin(angle) * 80,
        trail: [], isSplitChild: true, splitLife: 40,
      });
    }
  }

  getRenderData() { return { missiles: this.missiles, explosions: this.explosions, color: this.def.color }; }
  getWingData(lcx, lcy) { return { type: 'missile', color: this.def.color, x: lcx, y: lcy }; }
}

// ===== 天降陨石 =====
class MeteorWeapon extends Weapon {
  constructor() {
    super('meteor');
    this.meteors = [];
    this.burnZones = [];
  }

  update(dtMs, ctx) {
    const dt = dtMs / 16.67;
    this.timer += dtMs;
    const interval = this.def.interval * Math.pow(0.85, this.branches.freq || 0);

    if (this.timer >= interval) {
      this.timer = 0;
      this._drop(ctx);
    }

    const baseAttack = ctx.getBaseAttack ? ctx.getBaseAttack() : 1;
    const damage = this.getDamage(baseAttack);
    const baseRadius = 30 * (1 + (this.branches.radius || 0) * 0.25);

    for (let i = this.meteors.length - 1; i >= 0; i--) {
      const m = this.meteors[i];
      m.y += m.vy * dt;
      m.vy += 0.3 * dt;
      if (m.y >= m.targetY) {
        this._explodeArea(m.targetX, m.targetY, baseRadius, damage, ctx);
        if (ctx.particles) ctx.particles.emitBrickBreak(m.targetX - 15, m.targetY - 15, 30, 30, this.def.color);
        Sound.missileExplode();
        ctx.screenShake = Math.min((ctx.screenShake || 0) + 3, 8);
        if ((this.branches.burn || 0) > 0) {
          this.burnZones.push({
            x: m.targetX, y: m.targetY, radius: baseRadius * 0.8,
            life: 3000 + (this.branches.burn - 1) * 1500,
            tickTimer: 0, damage: Math.floor(damage * 0.3),
          });
        }
        this.meteors.splice(i, 1);
      }
    }

    for (let i = this.burnZones.length - 1; i >= 0; i--) {
      const z = this.burnZones[i];
      z.life -= dtMs;
      z.tickTimer += dtMs;
      if (z.tickTimer >= 500) {
        z.tickTimer = 0;
        this._explodeArea(z.x, z.y, z.radius, z.damage, ctx);
      }
      if (z.life <= 0) this.burnZones.splice(i, 1);
    }
  }

  _drop(ctx) {
    const count = 1 + (this.branches.count || 0);
    const rainLv = this.branches.rain || 0;
    if (rainLv > 0) {
      const cols = Config.BRICK_COLS;
      const bw = (Config.SCREEN_WIDTH - Config.BRICK_PADDING * (cols + 1)) / cols;
      for (let c = 0; c < cols; c++) {
        const tx = Config.BRICK_PADDING + c * (bw + Config.BRICK_PADDING) + bw / 2;
        const ty = Config.BRICK_TOP_OFFSET + Math.random() * (Config.SCREEN_HEIGHT * 0.4);
        this.meteors.push({ x: tx + (Math.random() - 0.5) * 30, y: -30, targetX: tx, targetY: ty, vy: 2 });
      }
    } else {
      for (let i = 0; i < count; i++) {
        const tx = 30 + Math.random() * (Config.SCREEN_WIDTH - 60);
        const ty = Config.BRICK_TOP_OFFSET + Math.random() * (Config.SCREEN_HEIGHT * 0.5);
        this.meteors.push({ x: tx + (Math.random() - 0.5) * 40, y: -30, targetX: tx, targetY: ty, vy: 2 + Math.random() * 2 });
      }
    }
    Sound.fireSurge();
  }

  _explodeArea(cx, cy, radius, damage, ctx) {
    for (let i = 0; i < ctx.bricks.length; i++) {
      const brick = ctx.bricks[i];
      if (!brick.alive) continue;
      const bc = brick.getCenter();
      if (Math.sqrt((bc.x - cx) ** 2 + (bc.y - cy) ** 2) <= radius) {
        ctx.damageBrick(brick, damage, 'meteor');
      }
    }
    if (ctx.boss && ctx.boss.alive) {
      if (Math.sqrt((ctx.boss.getCenterX() - cx) ** 2 + (ctx.boss.getCenterY() - cy) ** 2) <= radius) {
        ctx.damageBoss(damage);
      }
    }
  }

  getRenderData() { return { meteors: this.meteors, burnZones: this.burnZones, color: this.def.color }; }
  getWingData(lcx, lcy) { return { type: 'meteor', color: this.def.color, x: lcx, y: lcy }; }
}

// ===== 攻击无人机 =====
class DroneWeapon extends Weapon {
  constructor() {
    super('drone');
    this.drones = [];
    this.droneBullets = [];
    this._syncDrones();
  }

  _syncDrones() {
    const count = 1 + (this.branches.count || 0);
    while (this.drones.length < count) {
      this.drones.push({ angle: Math.random() * Math.PI * 2, fireTimer: 0, x: 0, y: 0 });
    }
  }

  update(dtMs, ctx) {
    const dt = dtMs / 16.67;
    this._syncDrones();
    const baseAttack = ctx.getBaseAttack ? ctx.getBaseAttack() : 1;
    const damage = this.getDamage(baseAttack);
    const fireInterval = this.def.interval * Math.pow(0.75, this.branches.fireRate || 0);
    const range = 150 * (1 + (this.branches.range || 0) * 0.2);
    const burstLv = this.branches.burst || 0;
    const laserLv = this.branches.laser || 0;
    const lcx = ctx.launcher.getCenterX(), lcy = ctx.launcher.y;

    for (let i = 0; i < this.drones.length; i++) {
      const d = this.drones[i];
      d.angle += 0.02 * dt;
      const offset = (Math.PI * 2 / this.drones.length) * i;
      d.x = lcx + Math.cos(d.angle + offset) * 35;
      d.y = lcy + Math.sin(d.angle + offset) * 20 - 15;

      d.fireTimer += dtMs;
      if (d.fireTimer >= fireInterval) {
        d.fireTimer = 0;
        const target = this._findTarget(d.x, d.y, range, ctx);
        if (target) {
          if (laserLv > 0) {
            if (target.brick) ctx.damageBrick(target.brick, damage, 'drone_laser');
            else if (ctx.boss && ctx.boss.alive) ctx.damageBoss(damage);
            this.droneBullets.push({ x1: d.x, y1: d.y, x2: target.x, y2: target.y, alpha: 1.0, isLaser: true });
          } else {
            const shots = burstLv > 0 ? 3 : 1;
            const dx = target.x - d.x, dy = target.y - d.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            for (let s = 0; s < shots; s++) {
              this.droneBullets.push({
                x: d.x, y: d.y,
                vx: (dx / dist) * 7 + (Math.random() - 0.5) * s * 0.5,
                vy: (dy / dist) * 7 + (Math.random() - 0.5) * s * 0.5,
                damage: damage, life: 60,
              });
            }
            Sound.bulletShoot();
          }
        }
      }
    }

    for (let i = this.droneBullets.length - 1; i >= 0; i--) {
      const b = this.droneBullets[i];
      if (b.isLaser) {
        b.alpha -= 0.08 * dt;
        if (b.alpha <= 0) this.droneBullets.splice(i, 1);
      } else {
        b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
        if (b.life <= 0) { this.droneBullets.splice(i, 1); continue; }
        let hit = false;
        for (let j = 0; j < ctx.bricks.length; j++) {
          const brick = ctx.bricks[j];
          if (!brick.alive) continue;
          const bc = brick.getCenter();
          if (Math.abs(b.x - bc.x) < brick.width / 2 + 4 && Math.abs(b.y - bc.y) < brick.height / 2 + 4) {
            ctx.damageBrick(brick, b.damage, 'drone'); hit = true; break;
          }
        }
        if (!hit && ctx.boss && ctx.boss.alive) {
          if (Math.abs(b.x - ctx.boss.getCenterX()) < ctx.boss.width / 2 + 4 &&
              Math.abs(b.y - ctx.boss.getCenterY()) < ctx.boss.height / 2 + 4) {
            ctx.damageBoss(b.damage); hit = true;
          }
        }
        if (hit) this.droneBullets.splice(i, 1);
      }
    }
  }

  _findTarget(sx, sy, range, ctx) {
    let nearest = null, nearDist = Infinity;
    for (let i = 0; i < ctx.bricks.length; i++) {
      const brick = ctx.bricks[i];
      if (!brick.alive) continue;
      const bc = brick.getCenter();
      const d = Math.sqrt((bc.x - sx) ** 2 + (bc.y - sy) ** 2);
      if (d < nearDist && d <= range) { nearDist = d; nearest = { x: bc.x, y: bc.y, brick: brick }; }
    }
    if (!nearest && ctx.boss && ctx.boss.alive) {
      const d = Math.sqrt((ctx.boss.getCenterX() - sx) ** 2 + (ctx.boss.getCenterY() - sy) ** 2);
      if (d <= range) nearest = { x: ctx.boss.getCenterX(), y: ctx.boss.getCenterY(), brick: null };
    }
    return nearest;
  }

  getRenderData() { return { drones: this.drones, bullets: this.droneBullets, color: this.def.color }; }
  getWingData(lcx, lcy) { return { type: 'drone', color: this.def.color, x: lcx, y: lcy, count: this.drones.length }; }
}

// ===== 等离子旋刃 =====
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
    const bounceLv = this.branches.bounce || 0;
    const size = (12 + giantLv * 12);

    for (let i = this.blades.length - 1; i >= 0; i--) {
      const b = this.blades[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.angle += 0.15 * dt;
      b.life -= dtMs;
      b.size = size;

      // 弹墙反弹
      if (bounceLv > 0) {
        if (b.x < size || b.x > Config.SCREEN_WIDTH - size) { b.vx = -b.vx; b.x = Math.max(size, Math.min(b.x, Config.SCREEN_WIDTH - size)); }
        if (b.y < size || b.y > Config.SCREEN_HEIGHT * 0.75) { b.vy = -b.vy; }
      }

      // tick伤害
      b.tickTimer += dtMs;
      if (b.tickTimer >= (this.def.tickInterval || 200)) {
        b.tickTimer = 0;
        for (let j = 0; j < ctx.bricks.length; j++) {
          const brick = ctx.bricks[j];
          if (!brick.alive) continue;
          const bc = brick.getCenter();
          if (Math.abs(b.x - bc.x) < brick.width / 2 + size && Math.abs(b.y - bc.y) < brick.height / 2 + size) {
            ctx.damageBrick(brick, damage, 'spinBlade');
          }
        }
        if (ctx.boss && ctx.boss.alive) {
          if (Math.abs(b.x - ctx.boss.getCenterX()) < ctx.boss.width / 2 + size &&
              Math.abs(b.y - ctx.boss.getCenterY()) < ctx.boss.height / 2 + size) {
            ctx.damageBoss(damage);
          }
        }
      }

      if (b.life <= 0) this.blades.splice(i, 1);
    }
  }

  _launch(ctx) {
    const count = 1 + (this.branches.count || 0);
    const speedMult = 1 + (this.branches.speed || 0) * 0.3;
    const durationMs = (3 + (this.branches.duration || 0)) * 1000;
    const cx = ctx.launcher.getCenterX(), cy = ctx.launcher.y - 20;

    for (let i = 0; i < count; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.6;
      const spd = 3 * speedMult;
      this.blades.push({
        x: cx + (i - (count - 1) / 2) * 15, y: cy,
        vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd,
        angle: 0, life: durationMs, size: 12,
        tickTimer: 0,
      });
    }
    Sound.bulletShoot();
  }

  getRenderData() { return { blades: this.blades, color: this.def.color }; }
  getWingData(lcx, lcy) { return { type: 'spinBlade', color: this.def.color, x: lcx, y: lcy }; }
}

// ===== 武器工厂 =====
function createWeapon(key) {
  switch (key) {
    case 'kunai': return new Kunai();
    case 'lightning': return new LightningWeapon();
    case 'missile': return new MissileWeapon();
    case 'meteor': return new MeteorWeapon();
    case 'drone': return new DroneWeapon();
    case 'spinBlade': return new SpinBlade();
  }
  return null;
}

module.exports = { Weapon, createWeapon, Kunai, LightningWeapon, MissileWeapon, MeteorWeapon, DroneWeapon, SpinBlade };