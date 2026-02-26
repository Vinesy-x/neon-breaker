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

    // ===== 元素状态 =====
    this.iceStacks = 0;       // 冰缓层数(0-5)，每层减速10%
    this.iceDuration = 0;     // 冰缓剩余ms
    this.frozen = false;      // 是否冻结
    this.frozenTimer = 0;     // 冻结剩余ms
    this.shockStacks = 0;     // 感电层数(0-3)
    this.shockDuration = 0;   // 感电剩余ms
    this._baseSpeedMult = 1.0; // 基础速度（type决定）
  }

  /** 更新元素状态 */
  updateStatus(dtMs) {
    // 冻结
    if (this.frozen) {
      this.frozenTimer -= dtMs;
      if (this.frozenTimer <= 0) {
        this.frozen = false;
        this.frozenTimer = 0;
        this.iceStacks = 0; // 冻结结束清冰缓
        this.iceDuration = 0;
      }
      this.speedMult = 0;
      return;
    }
    // 冰缓消退
    if (this.iceStacks > 0) {
      this.iceDuration -= dtMs;
      if (this.iceDuration <= 0) {
        this.iceStacks = Math.max(0, this.iceStacks - 1);
        this.iceDuration = this.iceStacks > 0 ? 3000 : 0;
      }
    }
    // 感电消退
    if (this.shockStacks > 0) {
      this.shockDuration -= dtMs;
      if (this.shockDuration <= 0) {
        this.shockStacks = Math.max(0, this.shockStacks - 1);
        this.shockDuration = this.shockStacks > 0 ? 3000 : 0;
      }
    }
    // 速度计算
    this.speedMult = this._baseSpeedMult * (1.0 - this.iceStacks * 0.10);
    // 碎甲标记倒计时
    if (this.shatterMark > 0) {
      this.shatterMark -= dtMs;
      if (this.shatterMark <= 0) { this.shatterMark = 0; this.shatterBonus = 0; }
    }
  }

  /** 冻结期间受伤倍率 */
  getDamageMult(damageType) {
    // 冻结增伤：只对冰属性(ice)伤害+50%
    var iceMult = (this.frozen && damageType === 'ice') ? 1.5 : 1.0;
    // 碎甲标记额外乘算
    var shatterMult = (this.shatterMark > 0) ? (1 + (this.shatterBonus || 0)) : 1.0;
    return iceMult * shatterMult;
  }

  /** 统计当前砖块身上的DOT层数（给穿甲弹烈性反应用） */
  dotCount() {
    let count = 0;
    if (this.fireDuration > 0) count++;
    if (this.shockStacks > 0) count++;
    if (this.bleedDuration > 0) count++;
    return count;
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
      this.color = Config.BRICK_HP_COLORS[Math.ceil(this.hp)] || this.color;
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
