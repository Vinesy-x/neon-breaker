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
    let hp = 1;
    if (difficulty >= 8) {
      hp = Math.random() < 0.3 ? 3 : (Math.random() < 0.5 ? 2 : 1);
    } else if (difficulty >= 4) {
      hp = Math.random() < 0.3 ? 2 : 1;
    } else if (difficulty >= 2) {
      hp = Math.random() < 0.15 ? 2 : 1;
    }
    // 高难度有极少4HP砖块
    if (difficulty >= 12 && Math.random() < 0.1) hp = 4;

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
