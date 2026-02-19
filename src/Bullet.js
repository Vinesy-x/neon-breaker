/**
 * Bullet.js - 子弹（直线飞行，打中砖块消失或穿透）
 */
const Config = require('./Config');

class Bullet {
  constructor(x, y, vx, vy, damage) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.damage = damage || 1;
    this.radius = Config.BULLET_RADIUS;
    this.alive = true;
    this.color = Config.BULLET_COLOR;
    this.trail = [];
    this.pierce = 0; // 剩余穿透次数
  }

  update(dt) {
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > Config.BULLET_TRAIL_LENGTH) {
      this.trail.shift();
    }
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }

  isOutOfBounds(screenWidth, screenHeight) {
    return (
      this.y + this.radius < 0 ||
      this.x + this.radius < 0 ||
      this.x - this.radius > screenWidth
    );
  }

  collideBrick(brick) {
    if (!brick.alive) return false;
    const bx = brick.x;
    const by = brick.y;
    const bw = brick.width;
    const bh = brick.height;

    // 简单 AABB 碰撞
    if (
      this.x + this.radius > bx &&
      this.x - this.radius < bx + bw &&
      this.y + this.radius > by &&
      this.y - this.radius < by + bh
    ) {
      return true;
    }
    return false;
  }

  collideBoss(boss) {
    if (!boss || !boss.alive) return false;
    return (
      this.x + this.radius > boss.x &&
      this.x - this.radius < boss.x + boss.width &&
      this.y + this.radius > boss.y &&
      this.y - this.radius < boss.y + boss.height
    );
  }
}

module.exports = Bullet;
