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
    this.wallBounce = 0;   // 边界反弹剩余次数(含四面)
    this.ricochet = 0;     // 弹射反弹剩余次数（碰砖块镜面反弹）
    this.bounceCount = 0;  // 已反弹总次数（用于增伤）
    this.bounceDmgMult = 0.25; // 每次反弹增伤比例
  }

  update(dt) {
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > Config.BULLET_TRAIL_LENGTH) {
      this.trail.shift();
    }
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // 边界反弹（四面墙壁镜面反射）
    if (this.wallBounce > 0) {
      var sw = Config.SCREEN_WIDTH, sh = Config.SCREEN_HEIGHT;
      // 左墙
      if (this.x - this.radius < 0) {
        this.x = this.radius;
        this.vx = Math.abs(this.vx);
        this._onBounce();
      }
      // 右墙
      else if (this.x + this.radius > sw) {
        this.x = sw - this.radius;
        this.vx = -Math.abs(this.vx);
        this._onBounce();
      }
      // 顶部
      if (this.y - this.radius < 0) {
        this.y = this.radius;
        this.vy = Math.abs(this.vy);
        this._onBounce();
      }
      // 底部
      else if (this.y + this.radius > sh) {
        this.y = sh - this.radius;
        this.vy = -Math.abs(this.vy);
        this._onBounce();
      }
    }
  }

  /** 反弹时增伤 */
  _onBounce() {
    this.bounceCount++;
    this.damage *= (1 + this.bounceDmgMult);
    this.wallBounce--;
  }

  isOutOfBounds(screenWidth, screenHeight) {
    // 有反弹能力时不出界（四面都弹）
    if (this.wallBounce > 0) return false;
    return (
      this.y + this.radius < 0 ||
      this.y - this.radius > screenHeight ||
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
