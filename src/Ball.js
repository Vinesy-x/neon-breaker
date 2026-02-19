/**
 * Ball.js - 球逻辑（含拖尾 + 穿透支持）
 */
const Config = require('./Config');

class Ball {
  constructor(x, y, vx, vy) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.radius = Config.BALL_RADIUS;
    this.trail = [];
    this.alive = true;
    this.color = Config.BALL_COLOR;
    // 穿透用：记录上次反弹前的速度
    this._prevVx = vx;
    this._prevVy = vy;
  }

  update(dt, speedMult) {
    const mult = speedMult || 1;
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > Config.BALL_TRAIL_LENGTH) {
      this.trail.shift();
    }
    this._prevVx = this.vx;
    this._prevVy = this.vy;
    this.x += this.vx * mult * dt;
    this.y += this.vy * mult * dt;
  }

  getSpeed() {
    return Math.sqrt(this.vx * this.vx + this.vy * this.vy);
  }

  setSpeed(speed) {
    const cur = this.getSpeed();
    if (cur === 0) return;
    const ratio = speed / cur;
    this.vx *= ratio;
    this.vy *= ratio;
  }

  /** 穿透时撤销反弹 */
  undoLastBounce() {
    this.vx = this._prevVx;
    this.vy = this._prevVy;
  }

  wallBounce(gameAreaWidth, gameAreaTop) {
    if (this.x - this.radius < 0) {
      this.x = this.radius;
      this.vx = Math.abs(this.vx);
    }
    if (this.x + this.radius > gameAreaWidth) {
      this.x = gameAreaWidth - this.radius;
      this.vx = -Math.abs(this.vx);
    }
    if (this.y - this.radius < gameAreaTop) {
      this.y = gameAreaTop + this.radius;
      this.vy = Math.abs(this.vy);
    }
  }

  isOutOfBounds(bottomY) {
    return this.y - this.radius > bottomY;
  }

  collidePaddle(paddle) {
    const px = paddle.x;
    const py = paddle.y;
    const pw = paddle.width;
    const ph = paddle.height;

    if (
      this.vy > 0 &&
      this.y + this.radius >= py &&
      this.y + this.radius <= py + ph + 4 &&
      this.x >= px &&
      this.x <= px + pw
    ) {
      const hitPos = (this.x - px) / pw;
      const angle = hitPos * Math.PI * 0.8 + Math.PI * 0.1;
      const speed = this.getSpeed();
      this.vx = speed * Math.cos(Math.PI - angle);
      this.vy = -Math.abs(speed * Math.sin(angle));
      this.y = py - this.radius;
      return true;
    }
    return false;
  }

  collideBrick(brick) {
    if (!brick.alive) return null;

    const bx = brick.x;
    const by = brick.y;
    const bw = brick.width;
    const bh = brick.height;

    const nearestX = Math.max(bx, Math.min(this.x, bx + bw));
    const nearestY = Math.max(by, Math.min(this.y, by + bh));
    const dx = this.x - nearestX;
    const dy = this.y - nearestY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < this.radius) {
      const overlapX = this.radius - Math.abs(dx);
      const overlapY = this.radius - Math.abs(dy);

      if (overlapX < overlapY) {
        this.vx = -this.vx;
        this.x += dx > 0 ? overlapX : -overlapX;
      } else {
        this.vy = -this.vy;
        this.y += dy > 0 ? overlapY : -overlapY;
      }
      return true;
    }
    return false;
  }

  collideBoss(boss) {
    if (!boss || !boss.alive) return false;

    const bx = boss.x;
    const by = boss.y;
    const bw = boss.width;
    const bh = boss.height;

    const nearestX = Math.max(bx, Math.min(this.x, bx + bw));
    const nearestY = Math.max(by, Math.min(this.y, by + bh));
    const dx = this.x - nearestX;
    const dy = this.y - nearestY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < this.radius) {
      this.vy = Math.abs(this.vy);
      this.y = by + bh + this.radius;
      return true;
    }
    return false;
  }
}

module.exports = Ball;
