/**
 * Drone.js - 战术无人机（激光阵型）
 *
 * 核心：每台无人机独立追踪高威胁砖块，之间连接激光网
 * 砖块越靠近飞机 → 权重越高 → 无人机优先前往
 * 阵型由砖块分布自然决定，不是固定几何形状
 */
const Weapon = require('./Weapon');
const Config = require('../Config');

class DroneWeapon extends Weapon {
  constructor() {
    super('drone');
    this.drones = [];
    this.laserHits = [];
    this._tickTimer = 0;
    this._pulseTimer = 0;
    this._pulseWave = null;
    this._assignTimer = 0;
  }

  _syncDrones() {
    const count = 2 + (this.branches.count || 0);
    while (this.drones.length < count) {
      this.drones.push({
        x: Config.SCREEN_WIDTH / 2 + (Math.random() - 0.5) * 60,
        y: Config.SCREEN_HEIGHT * 0.35 + (Math.random() - 0.5) * 60,
        tx: Config.SCREEN_WIDTH / 2,
        ty: Config.SCREEN_HEIGHT * 0.3,
        targetBrick: null,
      });
    }
    while (this.drones.length > count) {
      this.drones.pop();
    }
  }

  update(dtMs, ctx) {
    const dt = dtMs / 16.67;
    this._syncDrones();

    const speedLv = this.branches.speed || 0;
    const arcLv = this.branches.arc || 0;
    const deployLv = this.branches.deploy || 0;
    const lcx = ctx.launcher.getCenterX();
    const lcy = ctx.launcher.y;

    // === 分配目标（每2秒重新分配，减少抖动） ===
    this._assignTimer += dtMs;
    if (this._assignTimer > 2000) {
      this._assignTimer = 0;
      this._assignTargets(ctx, lcx, lcy, deployLv);
    }

    // === 无人机移动 ===
    // === 无人机移动（限速） ===
    const maxSpeed = 1.2 + speedLv * 0.4;

    for (let i = 0; i < this.drones.length; i++) {
      const d = this.drones[i];

      if (d.targetBrick && !d.targetBrick.alive) {
        d.targetBrick = null;
      }

      if (d.targetBrick) {
        const bc = d.targetBrick.getCenter();
        d.tx = bc.x;
        d.ty = bc.y;
      }

      const dx = d.tx - d.x;
      const dy = d.ty - d.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 3) {
        const speed = Math.min(maxSpeed * dt, dist);
        d.x += (dx / dist) * speed;
        d.y += (dy / dist) * speed;
      }
    }

    // === 激光线伤害 ===
    const tickSpeedMult = 1 + speedLv * 0.3;
    this._tickTimer += dtMs * tickSpeedMult;
    const tickInterval = 300;

    if (this._tickTimer >= tickInterval) {
      this._tickTimer = 0;
      const baseAttack = ctx.getBaseAttack ? ctx.getBaseAttack() : 1;
      const damage = this.getDamage(baseAttack);
      const widthLv = this.branches.width || 0;
      const laserWidth = 10 + widthLv * 8;
      const overchargeLv = this.branches.overcharge || 0;
      const focusLv = this.branches.focus || 0;
      const pulseLv = this.branches.pulse || 0;

      const lines = this._getLaserLines();

      for (const line of lines) {
        for (let j = 0; j < ctx.bricks.length; j++) {
          const brick = ctx.bricks[j];
          if (!brick.alive) continue;
          const bc = brick.getCenter();
          const dist = this._pointToLineDist(bc.x, bc.y, line.x1, line.y1, line.x2, line.y2);
          if (dist < laserWidth + brick.width * 0.3) {
            let dmg = damage;
            if (focusLv > 0 && brick.hp <= 3) {
              dmg = Math.floor(dmg * (1 + focusLv * 0.8));
            }
            ctx.damageBrick(brick, dmg, 'drone_laser');
            if (Math.random() < 0.25) {
              this.laserHits.push({ x: bc.x, y: bc.y, alpha: 1.0 });
            }
          }
        }
        if (ctx.boss && ctx.boss.alive) {
          const dist = this._pointToLineDist(
            ctx.boss.getCenterX(), ctx.boss.getCenterY(),
            line.x1, line.y1, line.x2, line.y2
          );
          if (dist < laserWidth + ctx.boss.width * 0.3) {
            ctx.damageBoss(damage, 'drone_laser');
          }
        }
      }

      // === 电弧：激光线附近随机弹射 ===
      if (arcLv > 0) {
        const arcRange = 30 + arcLv * 20; // 电弧弹射范围
        const arcDmg = Math.floor(damage * 0.5);
        const arcsPerLine = arcLv; // 每条线每tick弹出的电弧数

        for (const line of lines) {
          for (let a = 0; a < arcsPerLine; a++) {
            // 激光线上随机取一点
            const t = Math.random();
            const srcX = line.x1 + (line.x2 - line.x1) * t;
            const srcY = line.y1 + (line.y2 - line.y1) * t;

            // 找附近但不在激光线上的砖块
            for (let j = 0; j < ctx.bricks.length; j++) {
              const brick = ctx.bricks[j];
              if (!brick.alive) continue;
              const bc = brick.getCenter();
              const adx = bc.x - srcX, ady = bc.y - srcY;
              const adist = Math.sqrt(adx * adx + ady * ady);
              // 在电弧范围内但不在激光线判定内
              const lineDist = this._pointToLineDist(bc.x, bc.y, line.x1, line.y1, line.x2, line.y2);
              if (adist < arcRange && lineDist > laserWidth) {
                ctx.damageBrick(brick, arcDmg, 'drone_arc');
                // 电弧视觉
                this.laserHits.push({
                  x: bc.x, y: bc.y, alpha: 0.8,
                  arcFrom: { x: srcX, y: srcY },
                });
                break; // 每个电弧只打一个目标
              }
            }
          }
        }
      }

      // === 过载：所有线交叉区域 ===
      if (overchargeLv > 0 && this.drones.length >= 3) {
        const cx = this.drones.reduce((s, d) => s + d.x, 0) / this.drones.length;
        const cy = this.drones.reduce((s, d) => s + d.y, 0) / this.drones.length;
        const overDmg = damage * 2;
        const overRange = laserWidth * 3;
        for (let j = 0; j < ctx.bricks.length; j++) {
          const brick = ctx.bricks[j];
          if (!brick.alive) continue;
          const bc = brick.getCenter();
          if (Math.abs(bc.x - cx) + Math.abs(bc.y - cy) < overRange) {
            ctx.damageBrick(brick, overDmg, 'drone_cross');
          }
        }
      }

      // === 脉冲 ===
      if (pulseLv > 0) {
        this._pulseTimer += tickInterval;
        if (this._pulseTimer >= 4000) {
          this._pulseTimer = 0;
          const cx = this.drones.reduce((s, d) => s + d.x, 0) / this.drones.length;
          const cy = this.drones.reduce((s, d) => s + d.y, 0) / this.drones.length;
          const pulseRange = 120 + this.drones.length * 20;
          const pulseDmg = damage * 4;
          for (let j = 0; j < ctx.bricks.length; j++) {
            const brick = ctx.bricks[j];
            if (!brick.alive) continue;
            const bc = brick.getCenter();
            const dx = bc.x - cx, dy = bc.y - cy;
            if (Math.sqrt(dx * dx + dy * dy) < pulseRange) {
              ctx.damageBrick(brick, pulseDmg, 'drone_pulse');
            }
          }
          this._pulseWave = { x: cx, y: cy, maxR: pulseRange, progress: 0 };
        }
      }
    }

    // 脉冲波动画
    if (this._pulseWave) {
      this._pulseWave.progress += 0.03 * dt;
      if (this._pulseWave.progress >= 1) this._pulseWave = null;
    }

    // 命中闪光衰减
    for (let i = this.laserHits.length - 1; i >= 0; i--) {
      this.laserHits[i].alpha -= 0.06 * dt;
      if (this.laserHits[i].alpha <= 0) this.laserHits.splice(i, 1);
    }
  }

  /** 为每台无人机分配目标砖块 */
  _assignTargets(ctx, lcx, lcy, deployLv) {
    const bricks = ctx.bricks;
    if (!bricks || bricks.length === 0) return;

    // 计算砖块权重：越靠近危险线(y越大) → 权重越高
    const dangerY = Config.SCREEN_HEIGHT * Config.BRICK_DANGER_Y;
    const scored = [];
    for (const brick of bricks) {
      if (!brick.alive) continue;
      const bc = brick.getCenter();
      // y位置权重：越靠下(接近危险线)越危险
      const yRatio = bc.y / dangerY; // 0~1，越接近1越危险
      const proximityScore = yRatio * yRatio; // 平方加强前方优先级
      // HP权重
      const hpScore = Math.min(brick.hp / 20, 1);
      const weight = proximityScore * 4 + hpScore;
      scored.push({ brick, weight, x: bc.x, y: bc.y });
    }

    // 按权重排序
    scored.sort((a, b) => b.weight - a.weight);

    // 为每台无人机分配不同目标（欧氏距离分散）
    const used = new Set();
    const spread = 60 + deployLv * 25; // 最小欧氏间距

    for (const d of this.drones) {
      let best = null;
      for (const s of scored) {
        if (used.has(s.brick)) continue;
        // 检查和已分配的无人机距离
        let tooClose = false;
        for (const other of this.drones) {
          if (other === d || !other.targetBrick || !other.targetBrick.alive) continue;
          const obc = other.targetBrick.getCenter();
          const edist = Math.sqrt((s.x - obc.x) ** 2 + (s.y - obc.y) ** 2);
          if (edist < spread) {
            tooClose = true;
            break;
          }
        }
        if (!tooClose) {
          best = s;
          break;
        }
      }

      // 如果没找到不扎堆的，就取权重最高的
      if (!best && scored.length > 0) {
        for (const s of scored) {
          if (!used.has(s.brick)) { best = s; break; }
        }
      }

      if (best) {
        d.targetBrick = best.brick;
        used.add(best.brick);
      }
    }
  }

  /** 全连接激光线 */
  _getLaserLines() {
    const lines = [];
    const n = this.drones.length;
    if (n < 2) return lines;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        lines.push({ x1: this.drones[i].x, y1: this.drones[i].y, x2: this.drones[j].x, y2: this.drones[j].y });
      }
    }
    return lines;
  }

  _pointToLineDist(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
    let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const projX = x1 + t * dx, projY = y1 + t * dy;
    return Math.sqrt((px - projX) ** 2 + (py - projY) ** 2);
  }

  getRenderData() {
    return {
      drones: this.drones,
      lines: this._getLaserLines(),
      hits: this.laserHits,
      color: this.def.color,
      overchargeLv: this.branches.overcharge || 0,
      widthLv: this.branches.width || 0,
      pulseWave: this._pulseWave,
    };
  }

  getWingData(lcx, lcy) {
    return { type: 'drone', color: this.def.color, x: lcx, y: lcy, count: this.drones.length };
  }
}

module.exports = DroneWeapon;
