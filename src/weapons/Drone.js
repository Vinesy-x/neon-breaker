/**
 * Drone.js - 战术无人机（激光阵型）
 * 无人机飞到砖块区域自主布阵，相邻无人机之间连接激光线
 * 激光路径上的砖块持续受到伤害
 * 2台=直线, 3台=三角, 4台=菱形
 */
const Weapon = require('./Weapon');
const Config = require('../Config');

class DroneWeapon extends Weapon {
  constructor() {
    super('drone');
    this.drones = [];
    this.laserHits = []; // 激光命中闪光效果
    this._formationAngle = 0; // 阵型旋转角度
    this._centerX = Config.SCREEN_WIDTH / 2;
    this._centerY = Config.SCREEN_HEIGHT * 0.35;
    this._targetCX = this._centerX;
    this._targetCY = this._centerY;
    this._retargetTimer = 0;
    this._tickTimer = 0;
  }

  _syncDrones() {
    const count = 1 + (this.branches.count || 0);
    while (this.drones.length < count) {
      this.drones.push({
        x: this._centerX, y: this._centerY,
        tx: 0, ty: 0, // 目标位置
        angle: 0, // 自旋角度
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
    const moveSpeed = 0.06 + speedLv * 0.02;

    // === 阵型中心追踪砖块密度 ===
    this._retargetTimer += dtMs;
    if (this._retargetTimer > 1500) {
      this._retargetTimer = 0;
      this._updateFormationCenter(ctx, deployLv);
    }

    // 中心平滑移动
    this._centerX += (this._targetCX - this._centerX) * moveSpeed * dt;
    this._centerY += (this._targetCY - this._centerY) * moveSpeed * dt;

    // === 阵型旋转 ===
    const baseRotateSpeed = 0.003;
    const rotateSpeed = baseRotateSpeed + rotateLv * 0.006;
    this._formationAngle += rotateSpeed * dt;

    // === 计算各无人机目标位置（阵型） ===
    const radius = 50 + deployLv * 15 + count * 10;
    for (let i = 0; i < count; i++) {
      const d = this.drones[i];
      const angle = this._formationAngle + (Math.PI * 2 / count) * i;
      d.tx = this._centerX + Math.cos(angle) * radius;
      d.ty = this._centerY + Math.sin(angle) * radius;

      // 平滑飞向目标位置
      d.x += (d.tx - d.x) * moveSpeed * dt;
      d.y += (d.ty - d.y) * moveSpeed * dt;

      // 自旋
      d.angle += 0.03 * dt;
    }

    // === 激光线伤害（tick） ===
    this._tickTimer += dtMs;
    const tickInterval = 300; // 每300ms造成一次伤害
    if (this._tickTimer >= tickInterval) {
      this._tickTimer = 0;
      const baseAttack = ctx.getBaseAttack ? ctx.getBaseAttack() : 1;
      const damage = this.getDamage(baseAttack);
      const widthLv = this.branches.width || 0;
      const laserWidth = 8 + widthLv * 5;
      const overchargeLv = this.branches.overcharge || 0;
      const pulseLv = this.branches.pulse || 0;

      // 获取所有激光线段
      const lines = this._getLaserLines();

      for (const line of lines) {
        // 检测每条线段上的砖块
        for (let j = 0; j < ctx.bricks.length; j++) {
          const brick = ctx.bricks[j];
          if (!brick.alive) continue;
          const bc = brick.getCenter();
          const dist = this._pointToLineDist(bc.x, bc.y, line.x1, line.y1, line.x2, line.y2);
          if (dist < laserWidth + brick.width * 0.3) {
            ctx.damageBrick(brick, damage, 'drone_laser');
            // 命中闪光
            this.laserHits.push({ x: bc.x, y: bc.y, alpha: 1.0 });
          }
        }

        // Boss 检测
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

      // === 过载：激光交叉点额外伤害 ===
      if (overchargeLv > 0 && count >= 3) {
        // 阵型中心就是交叉点
        const overDmg = damage * 2;
        const overRange = laserWidth * 2;
        for (let j = 0; j < ctx.bricks.length; j++) {
          const brick = ctx.bricks[j];
          if (!brick.alive) continue;
          const bc = brick.getCenter();
          const dx = bc.x - this._centerX, dy = bc.y - this._centerY;
          if (Math.sqrt(dx * dx + dy * dy) < overRange) {
            ctx.damageBrick(brick, overDmg, 'drone_cross');
            this.laserHits.push({ x: bc.x, y: bc.y, alpha: 1.5 });
          }
        }
      }

      // === 脉冲：周期性全阵型AOE ===
      if (pulseLv > 0) {
        this._pulseTimer = (this._pulseTimer || 0) + tickInterval;
        if (this._pulseTimer >= 5000) {
          this._pulseTimer = 0;
          const pulseRange = radius + 40;
          const pulseDmg = damage * 3;
          for (let j = 0; j < ctx.bricks.length; j++) {
            const brick = ctx.bricks[j];
            if (!brick.alive) continue;
            const bc = brick.getCenter();
            const dx = bc.x - this._centerX, dy = bc.y - this._centerY;
            if (Math.sqrt(dx * dx + dy * dy) < pulseRange) {
              ctx.damageBrick(brick, pulseDmg, 'drone_pulse');
            }
          }
          // 脉冲视觉
          this.laserHits.push({ x: this._centerX, y: this._centerY, alpha: 2.0, pulse: true, radius: pulseRange });
        }
      }
    }

    // 更新命中闪光
    for (let i = this.laserHits.length - 1; i >= 0; i--) {
      this.laserHits[i].alpha -= 0.05 * dt;
      if (this.laserHits[i].alpha <= 0) this.laserHits.splice(i, 1);
    }
  }

  /** 根据砖块密度找最佳阵型中心 */
  _updateFormationCenter(ctx, deployLv) {
    if (!ctx.bricks || ctx.bricks.length === 0) return;

    // 找砖块密度最高的区域
    let sumX = 0, sumY = 0, count = 0;
    for (const brick of ctx.bricks) {
      if (!brick.alive) continue;
      const bc = brick.getCenter();
      sumX += bc.x;
      sumY += bc.y;
      count++;
    }
    if (count === 0) return;

    const avgX = sumX / count;
    const avgY = sumY / count;

    // 限制在屏幕安全范围内
    const margin = 60 + deployLv * 20;
    this._targetCX = Math.max(margin, Math.min(Config.SCREEN_WIDTH - margin, avgX));
    this._targetCY = Math.max(Config.SAFE_TOP + 40, Math.min(Config.SCREEN_HEIGHT * 0.65, avgY));
  }

  /** 获取所有激光连线 */
  _getLaserLines() {
    const lines = [];
    const n = this.drones.length;
    if (n < 2) return lines;

    // 相邻无人机连线（形成多边形）
    for (let i = 0; i < n; i++) {
      const a = this.drones[i];
      const b = this.drones[(i + 1) % n];
      lines.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
    }

    return lines;
  }

  /** 点到线段的距离 */
  _pointToLineDist(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);

    let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));

    const projX = x1 + t * dx;
    const projY = y1 + t * dy;
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
    };
  }

  getWingData(lcx, lcy) {
    return { type: 'drone', color: this.def.color, x: lcx, y: lcy, count: this.drones.length };
  }
}

module.exports = DroneWeapon;
