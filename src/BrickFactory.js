/**
 * BrickFactory.js - 7种砖块工厂
 * 替代原 generateBrickRow，根据章节和阶段生成多样化砖块
 */
const Config = require('./Config');
const { Brick } = require('./Brick');

// 砖块类型颜色（normal 用随机霓虹色）
var TYPE_COLORS = {
  normal: null,
  fast: '#FF8800',
  formation: '#AA44FF',
  shield: '#4488FF',
  split: '#00DDAA',
  stealth: '#AAAAAA',
  healer: '#FF4466',
};

// 阵型定义（相对坐标，col范围0~6）
var FORMATIONS = {
  // V字形（7个）
  vShape: [
    [0, 0], [1, 1], [2, 2], [3, 3], [4, 2], [5, 1], [6, 0],
  ],
  // 菱形（5个）
  diamond: [
    [3, 0], [2, 1], [4, 1], [3, 2], [3, 1],
  ],
  // 满排横线（7个）
  fullRow: [
    [0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0],
  ],
  // 双排交错（14个）
  doubleStagger: [
    [0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0],
    [0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1],
  ],
  // 箭头（9个）
  arrow: [
    [3, 0],
    [2, 1], [3, 1], [4, 1],
    [1, 2], [3, 2], [5, 2],
    [0, 3], [6, 3],
  ],
};

var FORMATION_KEYS = Object.keys(FORMATIONS);

class BrickFactory {
  /**
   * 根据当前阶段配置生成一行砖块
   * @param {number} gameAreaWidth
   * @param {number} y - 行的Y坐标
   * @param {object} phase - 当前阶段 { types, timeCurve, spawnMult }
   * @param {object} chapterConfig - 章节配置 { baseHP, chapterScale, gapChance }
   * @returns {Brick[]}
   */
  static generateRow(gameAreaWidth, y, phase, chapterConfig) {
    if (!phase || !phase.types || phase.types.length === 0) return [];

    // 概率选择是否生成阵型
    if (phase.types.indexOf('formation') !== -1 && Math.random() < 0.15) {
      var formHP = BrickFactory.calcHP(chapterConfig, phase.timeCurve, 'formation', true);
      return BrickFactory.generateFormation(gameAreaWidth, y, null, formHP);
    }

    var bricks = [];
    var cols = Config.BRICK_COLS;
    var padding = Config.BRICK_PADDING;
    var brickHeight = Config.BRICK_HEIGHT;
    var totalPadding = padding * (cols + 1);
    var brickWidth = (gameAreaWidth - totalPadding) / cols;
    var gapChance = chapterConfig.gapChance;

    // 过滤掉 formation（已单独处理）
    var availableTypes = phase.types.filter(function(t) { return t !== 'formation'; });
    if (availableTypes.length === 0) availableTypes = ['normal'];

    for (var c = 0; c < cols; c++) {
      // 空洞
      if (Math.random() < gapChance) continue;

      var x = padding + c * (brickWidth + padding);

      // 随机选类型（normal 权重更高）
      var type = BrickFactory._pickType(availableTypes);

      // v6.2: 四层正交HP公式
      var hp = BrickFactory.calcHP(chapterConfig, phase.timeCurve, type, false);

      var color = BrickFactory._getColor(type, hp);
      var brick = new Brick(x, y, brickWidth, brickHeight, hp, color);
      brick.type = type;

      // 特殊类型额外设置
      switch (type) {
        case 'fast':
          brick.speedMult = 2.0;
          break;
        case 'shield':
          brick.shieldHp = 1;
          break;
        case 'stealth':
          brick.visible = true;
          brick.stealthTimer = 0;
          break;
        case 'healer':
          brick.healTimer = 0;
          break;
      }

      bricks.push(brick);
    }

    return bricks;
  }

  /**
   * 生成阵型砖块（一次生成整个阵型）
   * @param {number} gameAreaWidth
   * @param {number} y - 起始Y坐标
   * @param {string|null} formationType - 阵型类型，null则随机
   * @param {number} hp - 每个砖块的HP
   * @returns {Brick[]}
   */
  static generateFormation(gameAreaWidth, y, formationType, hp) {
    if (!formationType) {
      formationType = FORMATION_KEYS[Math.floor(Math.random() * FORMATION_KEYS.length)];
    }
    var pattern = FORMATIONS[formationType];
    if (!pattern) pattern = FORMATIONS.fullRow;

    var bricks = [];
    var cols = Config.BRICK_COLS;
    var padding = Config.BRICK_PADDING;
    var brickHeight = Config.BRICK_HEIGHT;
    var totalPadding = padding * (cols + 1);
    var brickWidth = (gameAreaWidth - totalPadding) / cols;
    var color = TYPE_COLORS.formation;

    for (var i = 0; i < pattern.length; i++) {
      var col = pattern[i][0];
      var row = pattern[i][1];
      var bx = padding + col * (brickWidth + padding);
      var by = y + row * (brickHeight + padding);
      var brick = new Brick(bx, by, brickWidth, brickHeight, hp, color);
      brick.type = 'formation';
      bricks.push(brick);
    }

    return bricks;
  }

  /**
   * 分裂砖块碎裂后生成小砖块
   * @param {Brick} parentBrick
   * @returns {Brick[]} 2个宽度减半、1HP的小砖块
   */
  static spawnSplitChildren(parentBrick) {
    var halfW = parentBrick.width / 2 - 1;
    var color = TYPE_COLORS.split;
    var children = [];

    var child1 = new Brick(
      parentBrick.x, parentBrick.y,
      halfW, parentBrick.height, 1, color
    );
    child1.type = 'normal';
    child1.isSplitChild = true;

    var child2 = new Brick(
      parentBrick.x + halfW + 2, parentBrick.y,
      halfW, parentBrick.height, 1, color
    );
    child2.type = 'normal';
    child2.isSplitChild = true;

    children.push(child1);
    children.push(child2);
    return children;
  }

  /**
   * 更新特殊砖块状态（每帧调用）
   * @param {Brick[]} bricks
   * @param {number} dtMs - 帧间隔毫秒
   */
  static updateSpecialBricks(bricks, dtMs) {
    for (var i = 0; i < bricks.length; i++) {
      var brick = bricks[i];
      if (!brick.alive) continue;

      switch (brick.type) {
        case 'stealth':
          // 每2秒切换 visible
          brick.stealthTimer += dtMs;
          if (brick.stealthTimer >= 2000) {
            brick.stealthTimer -= 2000;
            brick.visible = !brick.visible;
          }
          break;

        case 'healer':
          // 每3秒给相邻砖块回1HP
          brick.healTimer += dtMs;
          if (brick.healTimer >= 3000) {
            brick.healTimer -= 3000;
            BrickFactory._healNearby(brick, bricks);
          }
          break;
      }
    }
  }

  /**
   * 治愈砖块给相邻砖块回血
   */
  static _healNearby(healer, bricks) {
    var cx = healer.x + healer.width / 2;
    var cy = healer.y + healer.height / 2;
    var range = healer.width * 1.8; // 相邻范围

    for (var i = 0; i < bricks.length; i++) {
      var b = bricks[i];
      if (!b.alive || b === healer) continue;
      // 不给自己回血
      var bx = b.x + b.width / 2;
      var by = b.y + b.height / 2;
      var dist = Math.abs(cx - bx) + Math.abs(cy - by); // 曼哈顿距离
      if (dist < range) {
        b.hp = Math.min(b.hp + 1, b.maxHp + 2); // 最多超过maxHp 2点
      }
    }
  }

  // ===== 内部工具 =====

  // ===== 第三层：砖块类型HP系数 =====
  // ===== 第四层：阵型HP系数 =====

  /**
   * v6.2 四层正交HP公式
   * finalHP = ceil( baseHP * chapterScale * timeCurve * typeMult * formationMult )
   */
  static calcHP(chapterConfig, timeCurve, brickType, isFormation) {
    var base = chapterConfig.baseHP * chapterConfig.chapterScale;
    // 时间曲线随机
    var tMin = timeCurve[0];
    var tMax = timeCurve[1];
    var tMult = tMin + Math.random() * (tMax - tMin);
    // 类型系数
    var TYPE_MULT = {
      normal: 1.0,
      fast: 0.7,
      formation: 1.0,
      shield: 1.2,
      split: 0.8,
      stealth: 0.6,
      healer: 0.5,
    };
    var typeMult = TYPE_MULT[brickType] || 1.0;
    // 阵型系数
    var formMult = isFormation ? 1.3 : 1.0;

    return Math.max(1, Math.ceil(base * tMult * typeMult * formMult));
  }

  static _pickType(types) {
    // normal 权重 3x，其他 1x
    var weighted = [];
    for (var i = 0; i < types.length; i++) {
      var weight = types[i] === 'normal' ? 3 : 1;
      for (var j = 0; j < weight; j++) {
        weighted.push(types[i]);
      }
    }
    return weighted[Math.floor(Math.random() * weighted.length)];
  }

  static _getColor(type, hp) {
    if (type === 'normal') {
      if (hp === 1) {
        return Config.NEON_COLORS[Math.floor(Math.random() * Config.NEON_COLORS.length)];
      }
      return Config.BRICK_HP_COLORS[hp] || '#AA00FF';
    }
    var typeColor = TYPE_COLORS[type];
    return typeColor || Config.NEON_COLORS[Math.floor(Math.random() * Config.NEON_COLORS.length)];
  }
}

module.exports = BrickFactory;
