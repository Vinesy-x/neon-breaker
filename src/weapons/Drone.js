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

  _syncDrones(ctx) {
    var extraDrones = (ctx && ctx.saveManager && ctx.saveManager.hasWeaponPassive('drone', 'matrixPlus')) ? 2 : 0;
    var droneExtraPassive = (ctx && ctx.saveManager && ctx.saveManager.hasWeaponPassive('drone', 'droneExtra')) ? 1 : 0;
    const count = 2 + (this.branches.count || 0) + extraDrones + droneExtraPassive;
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
    // shield被动：每15秒给玩家护盾
    if (ctx && ctx.saveManager && ctx.saveManager.hasWeaponPassive('drone', 'shield')) {
      this._shieldTimer = (this._shieldTimer || 0) + dtMs;
      if (this._shieldTimer >= 15000) {
        this._shieldTimer = 0;
        if (ctx.launcher) ctx.launcher.shield = Math.min((ctx.launcher.shield || 0) + 1, 3);
      }
    }
    const dt = dtMs / 16.67;
    this._syncDrones(ctx);

    const speedLv = 0; // speed分支已移除，机动由外部养成控制
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
    // tick间隔由外部养成爽点控制（基础450，每5级-30）
    var tickInterval = 300;
    if (ctx && ctx.saveManager) {
      var ss = ctx.saveManager.getWeaponSweetSpot('drone');
      if (ss !== null) tickInterval = Math.max(150, ss * 0.67); // 比例换算
    }

    if (this._tickTimer >= tickInterval) {
      this._tickTimer = 0;
      const baseAttack = ctx.getBaseAttack ? ctx.getBaseAttack() : 1;
      var rawDamage = this.getDamage(baseAttack, ctx);
      const damage = rawDamage;
      const widthLv = this.branches.width || 0;
      var annihilateMult = (ctx.saveManager && ctx.saveManager.hasWeaponPassive('drone', 'annihilate')) ? 1.5 : 1;
      const laserWidth = (10 + widthLv * 8) * annihilateMult;
      const overchargeLv = this.branches.overcharge || 0;
      const focusLv = this.branches.focus || 0;
      const pulseLv = this.branches.pulse || 0;

      const lines = this._getLaserLines();
      const hitBricks = new Set(); // 每tick每砖块只受一次激光伤害

      for (const line of lines) {
        for (let j = 0; j < ctx.bricks.length; j++) {
          const brick = ctx.bricks[j];
          if (!brick.alive || hitBricks.has(brick)) continue;
          const bc = brick.getCenter();
          const dist = this._pointToLineDist(bc.x, bc.y, line.x1, line.y1, line.x2, line.y2);
          if (dist < laserWidth + brick.width * 0.3) {
            let dmg = damage;
            if (focusLv > 0 && brick.hp <= 3) {
              dmg = dmg * (1 + focusLv * 0.8);
            }
            ctx.damageBrick(brick, dmg, 'drone_laser', 'energy');
            hitBricks.add(brick);
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

      // === 电弧：激光线外随机弹射额外伤害 ===
      if (arcLv > 0) {
        const arcRange = 40 + arcLv * 25;
        const arcDmg = damage * 0.6;
        const arcsPerLine = arcLv;
        const arcHit = new Set(); // 电弧自己的去重（砖块）

        for (const line of lines) {
          let lineHitBoss = false; // 每条线对Boss最多命中1次
          for (let a = 0; a < arcsPerLine; a++) {
            const t = Math.random();
            const srcX = line.x1 + (line.x2 - line.x1) * t;
            const srcY = line.y1 + (line.y2 - line.y1) * t;

            // 找范围内最近的未被电弧打过的目标（砖块或Boss）
            let best = null, bestDist = Infinity;
            for (let j = 0; j < ctx.bricks.length; j++) {
              const brick = ctx.bricks[j];
              if (!brick.alive || arcHit.has(brick)) continue;
              const bc = brick.getCenter();
              const adist = Math.sqrt((bc.x - srcX) ** 2 + (bc.y - srcY) ** 2);
              if (adist < arcRange && adist < bestDist) {
                bestDist = adist;
                best = { brick, x: bc.x, y: bc.y, isBoss: false };
              }
            }
            // Boss也可以被电弧击中（每条线1次）
            if (ctx.boss && ctx.boss.alive && !lineHitBoss) {
              const bx = ctx.boss.getCenterX(), by = ctx.boss.getCenterY();
              const bdist = Math.sqrt((bx - srcX) ** 2 + (by - srcY) ** 2);
              if (bdist < arcRange && bdist < bestDist) {
                bestDist = bdist;
                best = { x: bx, y: by, isBoss: true };
              }
            }
            if (best) {
              if (best.isBoss) {
                ctx.damageBoss(arcDmg, 'drone_arc');
                lineHitBoss = true;
              } else {
                ctx.damageBrick(best.brick, arcDmg, 'drone_arc', 'energy');
                arcHit.add(best.brick);
              }
              this.laserHits.push({
                x: best.x, y: best.y, alpha: 0.8,
                arcFrom: { x: srcX, y: srcY },
              });
            }
          }
        }
      }

      // === 过载：所有线交叉区域 ===
      if (overchargeLv > 0 && this.drones.length >= 3) {
        const cx = this.drones.reduce((s, d) => s + d.x, 0) / this.drones.length;
        const cy = this.drones.reduce((s, d) => s + d.y, 0) / this.drones.length;
        const overDmg = damage * (1 + 0.5 * overchargeLv);
        const overRange = laserWidth * 3;
        for (let j = 0; j < ctx.bricks.length; j++) {
          const brick = ctx.bricks[j];
          if (!brick.alive) continue;
          const bc = brick.getCenter();
          if (Math.abs(bc.x - cx) + Math.abs(bc.y - cy) < overRange) {
            ctx.damageBrick(brick, overDmg, 'drone_cross', 'energy');
          }
        }
        // Boss过载判定
        if (ctx.boss && ctx.boss.alive) {
          if (Math.abs(ctx.boss.getCenterX() - cx) + Math.abs(ctx.boss.getCenterY() - cy) < overRange) {
            ctx.damageBoss(overDmg, 'drone_cross');
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
              ctx.damageBrick(brick, pulseDmg, 'drone_pulse', 'energy');
            }
          }
          // Boss脉冲判定
          if (ctx.boss && ctx.boss.alive) {
            const bdx = ctx.boss.getCenterX() - cx, bdy = ctx.boss.getCenterY() - cy;
            if (Math.sqrt(bdx * bdx + bdy * bdy) < pulseRange) {
              ctx.damageBoss(pulseDmg, 'drone_pulse');
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

  /** 为每台无人机分配目标砖块（或Boss） */
  _assignTargets(ctx, lcx, lcy, deployLv) {
    const bricks = ctx.bricks;
    const hasBricks = bricks && bricks.filter(b => b.alive).length > 0;
    const hasBoss = ctx.boss && ctx.boss.alive;

    if (!hasBricks && !hasBoss) return;

    // === 没有砖块但有Boss → 无人机围绕Boss布阵 ===
    if (!hasBricks && hasBoss) {
      const bx = ctx.boss.getCenterX();
      const by = ctx.boss.getCenterY();
      const spread = 50 + (this.branches.deploy || 0) * 25;
      for (let i = 0; i < this.drones.length; i++) {
        const angle = (Math.PI * 2 / this.drones.length) * i + ctx.elapsedMs * 0.0005;
        this.drones[i].tx = bx + Math.cos(angle) * spread;
        this.drones[i].ty = by + Math.sin(angle) * spread;
        this.drones[i].targetBrick = null;
      }
      return;
    }

    // === 前后分区：一半无人机在前（y大），一半在后（y小） ===
    const aliveBricks = bricks.filter(b => b.alive);
    const numDrones = this.drones.length;
    
    // 按y坐标排序（从大到小 = 从前到后）
    const sortedByY = [...aliveBricks].sort((a, b) => b.getCenter().y - a.getCenter().y);
    
    // 分成前半和后半
    const midIdx = Math.ceil(sortedByY.length / 2);
    const frontBricks = sortedByY.slice(0, midIdx);  // 前排（y大）
    const backBricks = sortedByY.slice(midIdx);       // 后排（y小）
    
    // 一半无人机负责前排，一半负责后排
    const frontDrones = Math.ceil(numDrones / 2);
    
    for (let i = 0; i < numDrones; i++) {
      const d = this.drones[i];
      const isFront = i < frontDrones;
      const pool = isFront ? frontBricks : backBricks;
      
      if (pool.length === 0) {
        // 这个区域没砖块了，从另一边选
        const fallback = isFront ? backBricks : frontBricks;
        if (fallback.length > 0) {
          // 选x位置分散的
          const xIdx = Math.floor((i % Math.ceil(numDrones/2)) / Math.ceil(numDrones/2) * fallback.length);
          d.targetBrick = fallback[Math.min(xIdx, fallback.length - 1)];
        }
      } else {
        // 在区域内按x位置分散选择
        const slotInRegion = isFront ? i : (i - frontDrones);
        const dronesInRegion = isFront ? frontDrones : (numDrones - frontDrones);
        
        // 把区域内砖块按x排序，然后均分
        const sortedByX = [...pool].sort((a, b) => a.getCenter().x - b.getCenter().x);
        const idx = Math.floor(slotInRegion / dronesInRegion * sortedByX.length);
        d.targetBrick = sortedByX[Math.min(idx, sortedByX.length - 1)];
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
