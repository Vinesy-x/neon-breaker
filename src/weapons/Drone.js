/**
 * Drone.js - 战术无人机（激光阵型）
 * 
 * 核心：无人机飞到砖块区域布阵，全连接激光网切割砖块
 * 初始2台（直线），升级后3台（三角3线）→ 4台（菱形6线）→ 5台（五角10线）
 */
const Weapon = require('./Weapon');
const Config = require('../Config');

class DroneWeapon extends Weapon {
  constructor() {
    super('drone');
    this.drones = [];
    this.laserHits = [];     // 命中闪光
    this._formationAngle = 0;
    this._centerX = Config.SCREEN_WIDTH / 2;
    this._centerY = Config.SCREEN_HEIGHT * 0.35;
    this._targetCX = this._centerX;
    this._targetCY = this._centerY;
    this._retargetTimer = 0;
    this._tickTimer = 0;
    this._pulseTimer = 0;
    this._pulseWave = null;  // 脉冲波视觉
  }

  _syncDrones() {
    const count = 2 + (this.branches.count || 0); // 初始2台
    while (this.drones.length < count) {
      this.drones.push({
        x: this._centerX + (Math.random() - 0.5) * 40,
        y: this._centerY + (Math.random() - 0.5) * 40,
        tx: 0, ty: 0,
        angle: Math.random() * Math.PI * 2,
      });
    }
    while (this.drones.length > count) {
      this.drones.pop();
    }
  }

  update(dtMs, ctx) {
    const dt = dtMs / 16.67;
    this._syncDrones();

    const count = this.drones.length;
    const rotateLv = this.branches.rotate || 0;
    const speedLv = this.branches.speed || 0;
    const deployLv = this.branches.deploy || 0;

    // === 阵型中心追踪砖块密度 ===
    this._retargetTimer += dtMs;
    if (this._retargetTimer > 1200) {
      this._retargetTimer = 0;
      this._updateFormationCenter(ctx, deployLv);
    }

    // 中心平滑移动
    const centerSpeed = 0.05 + speedLv * 0.02;
    this._centerX += (this._targetCX - this._centerX) * centerSpeed * dt;
    this._centerY += (this._targetCY - this._centerY) * centerSpeed * dt;

    // === 阵型旋转 ===
    const rotateSpeed = 0.005 + rotateLv * 0.012;
    this._formationAngle += rotateSpeed * dt;

    // === 计算各无人机目标位置（阵型） ===
    const radius = 60 + deployLv * 35 + count * 15;
    for (let i = 0; i < count; i++) {
      const d = this.drones[i];
      const angle = this._formationAngle + (Math.PI * 2 / count) * i;
      d.tx = this._centerX + Math.cos(angle) * radius;
      d.ty = this._centerY + Math.sin(angle) * radius;

      // 平滑飞向目标
      const flySpeed = 0.08 + speedLv * 0.03;
      d.x += (d.tx - d.x) * flySpeed * dt;
      d.y += (d.ty - d.y) * flySpeed * dt;
      d.angle += 0.04 * dt;
    }

    // === 激光线伤害（tick） ===
    const tickSpeedMult = 1 + speedLv * 0.3; // 机动加速tick频率
    this._tickTimer += dtMs * tickSpeedMult;
    const tickInterval = 300;

    if (this._tickTimer >= tickInterval) {
      this._tickTimer = 0;
      const baseAttack = ctx.getBaseAttack ? ctx.getBaseAttack() : 1;
      const damage = this.getDamage(baseAttack);
      const widthLv = this.branches.width || 0;
      const laserWidth = 10 + widthLv * 8;
      const overchargeLv = this.branches.overcharge || 0;
      const pulseLv = this.branches.pulse || 0;

      const lines = this._getLaserLines();
      const focusLv = this.branches.focus || 0;

      for (const line of lines) {
        for (let j = 0; j < ctx.bricks.length; j++) {
          const brick = ctx.bricks[j];
          if (!brick.alive) continue;
          const bc = brick.getCenter();
          const dist = this._pointToLineDist(bc.x, bc.y, line.x1, line.y1, line.x2, line.y2);
          if (dist < laserWidth + brick.width * 0.3) {
            // 聚焦：低HP砖块额外伤害
            let dmg = damage;
            if (focusLv > 0 && brick.hp <= 3) {
              dmg = Math.floor(dmg * (1 + focusLv * 0.8));
            }
            ctx.damageBrick(brick, dmg, 'drone_laser');
            if (Math.random() < 0.3) {
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

      // === 过载：交叉点额外伤害 ===
      if (overchargeLv > 0 && count >= 3) {
        const overDmg = damage * 2;
        const overRange = laserWidth * 3;
        for (let j = 0; j < ctx.bricks.length; j++) {
          const brick = ctx.bricks[j];
          if (!brick.alive) continue;
          const bc = brick.getCenter();
          const dx = bc.x - this._centerX, dy = bc.y - this._centerY;
          if (Math.sqrt(dx * dx + dy * dy) < overRange) {
            ctx.damageBrick(brick, overDmg, 'drone_cross');
          }
        }
      }

      // === 脉冲AOE ===
      if (pulseLv > 0) {
        this._pulseTimer += tickInterval;
        if (this._pulseTimer >= 4000) {
          this._pulseTimer = 0;
          const pulseRange = radius * 1.8;
          const pulseDmg = damage * 4;
          for (let j = 0; j < ctx.bricks.length; j++) {
            const brick = ctx.bricks[j];
            if (!brick.alive) continue;
            const bc = brick.getCenter();
            const dx = bc.x - this._centerX, dy = bc.y - this._centerY;
            if (Math.sqrt(dx * dx + dy * dy) < pulseRange) {
              ctx.damageBrick(brick, pulseDmg, 'drone_pulse');
            }
          }
          // 脉冲波视觉
          this._pulseWave = { x: this._centerX, y: this._centerY, maxR: pulseRange, progress: 0 };
        }
      }
    }

    // 脉冲波动画
    if (this._pulseWave) {
      this._pulseWave.progress += 0.03 * dt;
      if (this._pulseWave.progress >= 1) this._pulseWave = null;
    }

    // 更新命中闪光
    for (let i = this.laserHits.length - 1; i >= 0; i--) {
      this.laserHits[i].alpha -= 0.06 * dt;
      if (this.laserHits[i].alpha <= 0) this.laserHits.splice(i, 1);
    }
  }

  _updateFormationCenter(ctx, deployLv) {
    if (!ctx.bricks || ctx.bricks.length === 0) return;

    // 用加权平均找密度中心（HP越高权重越大）
    let sumX = 0, sumY = 0, totalW = 0;
    for (const brick of ctx.bricks) {
      if (!brick.alive) continue;
      const bc = brick.getCenter();
      const w = Math.min(brick.hp, 10); // 高HP砖块权重更大
      sumX += bc.x * w;
      sumY += bc.y * w;
      totalW += w;
    }
    if (totalW === 0) return;

    const margin = 50 + deployLv * 25;
    this._targetCX = Math.max(margin, Math.min(Config.SCREEN_WIDTH - margin, sumX / totalW));
    this._targetCY = Math.max(Config.SAFE_TOP + 50, Math.min(Config.SCREEN_HEIGHT * 0.65, sumY / totalW));
  }

  /** 全连接图：每对无人机之间都有激光线 */
  _getLaserLines() {
    const lines = [];
    const n = this.drones.length;
    if (n < 2) return lines;

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = this.drones[i], b = this.drones[j];
        lines.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
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
      centerX: this._centerX,
      centerY: this._centerY,
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
