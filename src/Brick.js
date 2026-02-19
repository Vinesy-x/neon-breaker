/**
 * Brick.js - 砖块基类（支持7种类型）
 * 类型：normal / fast / formation / shield / split / stealth / healer
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

    // ===== v5.0 新增字段 =====
    this.type = 'normal';     // normal/fast/formation/shield/split/stealth/healer
    this.shieldHp = 0;        // 护盾砖块护盾层数
    this.visible = true;      // 隐身砖块可见性
    this.stealthTimer = 0;    // 隐身砖块计时（ms）
    this.healTimer = 0;       // 治愈砖块计时（ms）
    this.speedMult = 1.0;     // 快速砖块 = 2.0
    this.isSplitChild = false; // 是否分裂后的子砖块
  }

  /**
   * 受击处理
   * 护盾砖块：先扣护盾（任意伤害扣1层），护盾没了才扣HP
   */
  hit(damage) {
    if (this.shieldHp > 0) {
      this.shieldHp--;
      this.flashTimer = 4;
      // 护盾吸收了这次伤害
      return false;
    }

    this.hp -= (damage || 1);
    this.flashTimer = 4;
    if (this.hp <= 0) {
      this.alive = false;
      return true;
    }
    // 更新颜色
    if (this.type === 'normal' || this.type === 'formation') {
      this.color = Config.BRICK_HP_COLORS[this.hp] || this.color;
    }
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
 * @deprecated 使用 BrickFactory.generateRow() 代替
 * 保留兼容：生成一行砖块（旧逻辑）
 */
function generateBrickRow(gameAreaWidth, y, difficulty) {
  var bricks = [];
  var cols = Config.BRICK_COLS;
  var padding = Config.BRICK_PADDING;
  var brickHeight = Config.BRICK_HEIGHT;
  var totalPadding = padding * (cols + 1);
  var brickWidth = (gameAreaWidth - totalPadding) / cols;

  for (var c = 0; c < cols; c++) {
    if (Math.random() < (Config.BRICK_GAP_CHANCE || 0.12)) continue;

    var x = padding + c * (brickWidth + padding);
    var hp = 1;
    if (difficulty >= 10) {
      var roll = Math.random();
      if (roll < 0.25) hp = 6;
      else if (roll < 0.55) hp = 5;
      else if (roll < 0.8) hp = 4;
      else hp = 3;
    } else if (difficulty >= 6) {
      var roll2 = Math.random();
      if (roll2 < 0.3) hp = 4;
      else if (roll2 < 0.65) hp = 3;
      else hp = 2;
    } else if (difficulty >= 3) {
      hp = Math.random() < 0.4 ? 3 : 2;
    } else if (difficulty >= 1) {
      hp = Math.random() < 0.3 ? 2 : 1;
    }

    var color;
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
