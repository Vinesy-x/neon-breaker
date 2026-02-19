/**
 * PowerUp.js - 掉落道具（被动系统版）
 */
const Config = require('./Config');

class PowerUp {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.size = Config.POWERUP_SIZE;
    this.speed = Config.POWERUP_SPEED;
    this.alive = true;
    this.time = 0;

    switch (type) {
      case 'multiball':
        this.color = Config.NEON_PINK;
        this.icon = '●';
        break;
      case 'widen':
        this.color = Config.NEON_GREEN;
        this.icon = '◆';
        break;
      case 'score':
        this.color = Config.NEON_YELLOW;
        this.icon = '★';
        break;
    }
  }

  update(dt, magnetTarget) {
    this.time += dt;

    // 磁力吸附
    if (magnetTarget) {
      const dx = magnetTarget.x - this.x;
      const dy = magnetTarget.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 5) {
        this.x += (dx / dist) * 4 * dt;
        this.y += (dy / dist) * 4 * dt;
      }
    } else {
      this.y += this.speed * dt;
    }
  }

  collidePaddle(paddle) {
    return (
      this.y + this.size / 2 >= paddle.y &&
      this.y - this.size / 2 <= paddle.y + paddle.height &&
      this.x + this.size / 2 >= paddle.x &&
      this.x - this.size / 2 <= paddle.x + paddle.width
    );
  }

  isOutOfBounds(bottomY) {
    return this.y - this.size / 2 > bottomY;
  }
}

const POWERUP_TYPES = ['multiball', 'widen', 'score'];

function maybeDropPowerUp(x, y) {
  if (Math.random() < Config.POWERUP_DROP_CHANCE) {
    const type = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
    return new PowerUp(x, y, type);
  }
  return null;
}

module.exports = { PowerUp, maybeDropPowerUp };
