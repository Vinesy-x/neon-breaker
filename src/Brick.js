/**
 * Brick.js - 砖块生成与管理（支持前移）
 */
const Config = require('./Config');

class Brick {
  constructor(x, y, width, height, hp, color) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.hp = hp;
    this.maxHp = hp;
    this.color = color;
    this.alive = true;
  }

  hit(damage) {
    this.hp -= (damage || 1);
    if (this.hp <= 0) {
      this.alive = false;
      return true;
    }
    this.color = Config.BRICK_HP_COLORS[this.hp] || this.color;
    return false;
  }

  getCenter() {
    return {
      x: this.x + this.width / 2,
      y: this.y + this.height / 2,
    };
  }

  /** 砖块整体下移 */
  advance(dy) {
    this.y += dy;
  }
}

/**
 * 生成一关的砖块
 */
function generateBricks(level, gameAreaWidth) {
  const bricks = [];
  const cols = Config.BRICK_COLS;
  const rows = Math.min(3 + Math.floor(level * 0.8), 10);
  const padding = Config.BRICK_PADDING;
  const topOffset = Config.BRICK_TOP_OFFSET;
  const brickHeight = Config.BRICK_HEIGHT;

  const totalPadding = padding * (cols + 1);
  const brickWidth = (gameAreaWidth - totalPadding) / cols;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = padding + c * (brickWidth + padding);
      const y = topOffset + r * (brickHeight + padding);

      let hp = 1;
      if (level >= 5 && r < 1) hp = 3;
      else if (level >= 3 && r < 2) hp = 2;
      // 随机高血量砖块增加多样性
      if (level >= 4 && Math.random() < 0.1 * (level - 3)) {
        hp = Math.min(hp + 1, 3);
      }

      let color;
      if (hp === 1) {
        color = Config.NEON_COLORS[Math.floor(Math.random() * Config.NEON_COLORS.length)];
      } else {
        color = Config.BRICK_HP_COLORS[hp] || '#FF8800';
      }

      bricks.push(new Brick(x, y, brickWidth, brickHeight, hp, color));
    }
  }
  return bricks;
}

module.exports = { Brick, generateBricks };
