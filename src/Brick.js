/**
 * Brick.js - 砖块（无限模式，按行生成）
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
    this.flashTimer = 0;
  }

  hit(damage) {
    this.hp -= (damage || 1);
    this.flashTimer = 4; // 受击闪白
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
}

/**
 * 生成一行砖块
 * @param {number} gameAreaWidth
 * @param {number} y - 行的Y坐标
 * @param {number} difficulty - 难度等级（影响HP和空洞）
 */
function generateBrickRow(gameAreaWidth, y, difficulty) {
  const bricks = [];
  const cols = Config.BRICK_COLS;
  const padding = Config.BRICK_PADDING;
  const brickHeight = Config.BRICK_HEIGHT;
  const totalPadding = padding * (cols + 1);
  const brickWidth = (gameAreaWidth - totalPadding) / cols;

  for (let c = 0; c < cols; c++) {
    // 随机空洞（让玩家有喘息空间）
    if (Math.random() < Config.BRICK_GAP_CHANCE) continue;

    const x = padding + c * (brickWidth + padding);

    // HP 随难度递增
    let hp = 2;
    if (difficulty >= 8) {
      const roll = Math.random();
      if (roll < 0.25) hp = 8;
      else if (roll < 0.5) hp = 6;
      else if (roll < 0.8) hp = 5;
      else hp = 4;
    } else if (difficulty >= 5) {
      const roll = Math.random();
      if (roll < 0.2) hp = 6;
      else if (roll < 0.5) hp = 5;
      else hp = 4;
    } else if (difficulty >= 2) {
      hp = Math.random() < 0.5 ? 4 : 3;
    } else if (difficulty >= 1) {
      hp = Math.random() < 0.5 ? 3 : 2;
    }

    let color;
    if (hp === 1) {
      color = Config.NEON_COLORS[Math.floor(Math.random() * Config.NEON_COLORS.length)];
    } else {
      color = Config.BRICK_HP_COLORS[hp] || '#AA00FF';
    }

    bricks.push(new Brick(x, y, brickWidth, brickHeight, hp, color));
  }
  return bricks;
}

module.exports = { Brick, generateBrickRow };
