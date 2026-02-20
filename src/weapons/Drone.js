/**
 * Drone.js - 攻击无人机
 * 跟随飞机的无人机自动射击，可升级为激光/蜂群/护盾等
 */
const Weapon = require('./Weapon');
const Config = require('../Config');
const Sound = require('../systems/SoundManager');

class DroneWeapon extends Weapon {
  constructor() {
    super('drone');
    this.drones = [];
    this.droneBullets = [];
    this.laserBeams = []; // 激光效果
    this._syncDrones();
  }

  _syncDrones() {
    const count = 1 + (this.branches.count || 0);
    // 增加无人机
    while (this.drones.length < count) {
      this.drones.push({
        angle: Math.random() * Math.PI * 2,
        fireTimer: 0,
        x: 0, y: 0,
        shield: this.branches.shield > 0,
        shieldFlash: 0,
      });
    }
    // 减少无人机（降级时）
    while (this.drones.length > count) {
      this.drones.pop();
    }
    // 更新护盾状态
    const hasShield = this.branches.shield > 0;
    for (let d of this.drones) {
      if (hasShield && d.shield === undefined) d.shield = true;
    }
  }

  update(dtMs, ctx) {
    const dt = dtMs / 16.67;
    this._syncDrones();

    const baseAttack = ctx.getBaseAttack ? ctx.getBaseAttack() : 1;
    const damage = this.getDamage(baseAttack);

    // 射速计算：基础 + 射速分支 + 蜂群分支
    const swarmLv = this.branches.swarm || 0;
    const fireRateMult = Math.pow(0.75, this.branches.fireRate || 0) * Math.pow(0.5, swarmLv);
    const fireInterval = this.def.interval * fireRateMult;

    const range = 150 * (1 + (this.branches.range || 0) * 0.2);
    const burstLv = this.branches.burst || 0;
    const laserLv = this.branches.laser || 0;
    const pierceLv = this.branches.pierce || 0;

    const lcx = ctx.launcher.getCenterX(), lcy = ctx.launcher.y;

    // 更新无人机位置和射击
    for (let i = 0; i < this.drones.length; i++) {
      const d = this.drones[i];

      // 环绕飞机旋转
      d.angle += (0.02 + swarmLv * 0.01) * dt; // 蜂群时旋转更快
      const offset = (Math.PI * 2 / this.drones.length) * i;
      const orbitR = 35 + swarmLv * 5;
      d.x = lcx + Math.cos(d.angle + offset) * orbitR;
      d.y = lcy + Math.sin(d.angle + offset) * 20 - 15;

      // 护盾闪烁衰减
      if (d.shieldFlash > 0) d.shieldFlash -= dt * 0.1;

      // 射击
      d.fireTimer += dtMs;
      if (d.fireTimer >= fireInterval) {
        d.fireTimer = 0;
        const target = this._findTarget(d.x, d.y, range, ctx);
        if (target) {
          if (laserLv > 0) {
            // 激光模式：直接命中
            if (target.brick) ctx.damageBrick(target.brick, damage * 1.5, 'drone_laser');
            else if (ctx.boss && ctx.boss.alive) ctx.damageBoss(damage * 1.5, 'drone_laser');
            this.laserBeams.push({ x1: d.x, y1: d.y, x2: target.x, y2: target.y, alpha: 1.0 });
          } else {
            // 普通子弹
            const shots = 1 + burstLv; // lv0=1, lv1=2, lv2=3
            const dx = target.x - d.x, dy = target.y - d.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            for (let s = 0; s < shots; s++) {
              this.droneBullets.push({
                x: d.x, y: d.y,
                vx: (dx / dist) * 8 + (Math.random() - 0.5) * s * 0.5,
                vy: (dy / dist) * 8 + (Math.random() - 0.5) * s * 0.5,
                damage: damage, life: 60,
                pierceLeft: pierceLv, // 剩余穿透次数
                hitBricks: [], // 已命中的砖块
              });
            }
            Sound.bulletShoot();
          }
        }
      }
    }

    // 更新激光效果
    for (let i = this.laserBeams.length - 1; i >= 0; i--) {
      const beam = this.laserBeams[i];
      beam.alpha -= 0.06 * dt;
      if (beam.alpha <= 0) this.laserBeams.splice(i, 1);
    }

    // 更新子弹
    for (let i = this.droneBullets.length - 1; i >= 0; i--) {
      const b = this.droneBullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;

      if (b.life <= 0 || b.x < 0 || b.x > Config.SCREEN_WIDTH || b.y < 0 || b.y > Config.SCREEN_HEIGHT) {
        this.droneBullets.splice(i, 1);
        continue;
      }

      // 检测碰撞
      let hit = false;
      for (let j = 0; j < ctx.bricks.length; j++) {
        const brick = ctx.bricks[j];
        if (!brick.alive) continue;
        if (b.hitBricks.includes(brick)) continue; // 已命中过

        const bc = brick.getCenter();
        if (Math.abs(b.x - bc.x) < brick.width / 2 + 4 && Math.abs(b.y - bc.y) < brick.height / 2 + 4) {
          ctx.damageBrick(brick, b.damage, 'drone');
          b.hitBricks.push(brick);

          if (b.pierceLeft > 0) {
            b.pierceLeft--;
            // 穿透继续
          } else {
            hit = true;
          }
          break;
        }
      }

      // Boss 碰撞
      if (!hit && ctx.boss && ctx.boss.alive) {
        if (Math.abs(b.x - ctx.boss.getCenterX()) < ctx.boss.width / 2 + 4 &&
            Math.abs(b.y - ctx.boss.getCenterY()) < ctx.boss.height / 2 + 4) {
          ctx.damageBoss(b.damage, 'drone_bullet');
          hit = true;
        }
      }

      if (hit) this.droneBullets.splice(i, 1);
    }
  }

  _findTarget(sx, sy, range, ctx) {
    let nearest = null, nearDist = Infinity;
    for (let i = 0; i < ctx.bricks.length; i++) {
      const brick = ctx.bricks[i];
      if (!brick.alive) continue;
      const bc = brick.getCenter();
      const d = Math.sqrt((bc.x - sx) ** 2 + (bc.y - sy) ** 2);
      if (d < nearDist && d <= range) {
        nearDist = d;
        nearest = { x: bc.x, y: bc.y, brick: brick };
      }
    }
    if (!nearest && ctx.boss && ctx.boss.alive) {
      const d = Math.sqrt((ctx.boss.getCenterX() - sx) ** 2 + (ctx.boss.getCenterY() - sy) ** 2);
      if (d <= range) nearest = { x: ctx.boss.getCenterX(), y: ctx.boss.getCenterY(), brick: null };
    }
    return nearest;
  }

  // 护盾挡伤害（由外部调用）
  absorbDamage() {
    const shieldLv = this.branches.shield || 0;
    if (shieldLv === 0) return false;

    for (let d of this.drones) {
      if (d.shield) {
        d.shield = false;
        d.shieldFlash = 1.0;
        return true; // 挡住了
      }
    }
    return false;
  }

  getRenderData() {
    return {
      drones: this.drones,
      bullets: this.droneBullets,
      lasers: this.laserBeams,
      color: this.def.color,
      hasShield: this.branches.shield > 0,
      swarmLv: this.branches.swarm || 0,
    };
  }

  getWingData(lcx, lcy) {
    return { type: 'drone', color: this.def.color, x: lcx, y: lcy, count: this.drones.length };
  }
}

module.exports = DroneWeapon;
