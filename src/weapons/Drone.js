/**
 * Drone.js - drone 武器
 */
const Weapon = require('./Weapon');
const Config = require('../Config');
const Sound = require('../systems/SoundManager');

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
            else if (ctx.boss && ctx.boss.alive) ctx.damageBoss(damage, "drone");
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
            ctx.damageBoss(b.damage, "drone_bullet"); hit = true;
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

module.exports = DroneWeapon;
