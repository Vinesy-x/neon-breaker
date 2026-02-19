/**
 * Config.js - 游戏配置常量
 * v2.0 - 全被动技能 + 砖块前移 + 肉鸽升级
 */

const { windowWidth, windowHeight, pixelRatio } = wx.getSystemInfoSync();

const Config = {
  // 屏幕
  SCREEN_WIDTH: windowWidth,
  SCREEN_HEIGHT: windowHeight,
  DPR: pixelRatio,
  CANVAS_WIDTH: windowWidth * pixelRatio,
  CANVAS_HEIGHT: windowHeight * pixelRatio,

  // 颜色
  BG_COLOR: '#080220',
  NEON_CYAN: '#00FFFF',
  NEON_PINK: '#FF14FF',
  NEON_GREEN: '#50FFB4',
  NEON_YELLOW: '#FFF050',
  NEON_ORANGE: '#FF8800',
  NEON_COLORS: ['#00FFFF', '#FF14FF', '#50FFB4', '#FFF050'],

  // 挡板
  PADDLE_WIDTH: 90,
  PADDLE_HEIGHT: 14,
  PADDLE_Y_OFFSET: 100, // 距底部
  PADDLE_COLOR: '#00FFFF',

  // 球
  BALL_RADIUS: 7,
  BALL_SPEED: 5,
  BALL_MAX: 20,
  BALL_TRAIL_LENGTH: 8,
  BALL_COLOR: '#FFFFFF',

  // 砖块
  BRICK_COLS: 7,
  BRICK_PADDING: 4,
  BRICK_TOP_OFFSET: 60, // 初始离顶部距离
  BRICK_HEIGHT: 22,
  BRICK_HP_COLORS: {
    1: null, // 随机霓虹色
    2: '#FF8800',
    3: '#FF3333',
  },

  // 砖块前移
  BRICK_ADVANCE_INTERVAL: 8000, // ms，每8秒前移一次
  BRICK_ADVANCE_STEP: 26,       // 每次下移像素（约一行砖块高度）
  BRICK_DANGER_Y: 0.75,         // 危险线比例（屏幕高度的75%）

  // Boss
  BOSS_TRIGGER_INTERVAL: 5, // 每5关
  BOSS_WIDTH: 160,
  BOSS_HEIGHT: 40,
  BOSS_SPEED: 2,
  BOSS_BASE_HP: [80, 120, 160],

  // 粒子
  PARTICLE_MAX: 120,

  // 道具掉落
  POWERUP_DROP_CHANCE: 0.12,
  POWERUP_SIZE: 18,
  POWERUP_SPEED: 2.5,

  // Combo
  COMBO_SCORE_BASE: 10,

  // 被动技能触发
  PASSIVE_CHAIN_CHANCE: 0,      // 连锁闪电概率（升级增加）
  PASSIVE_PIERCE_COUNT: 0,      // 穿透次数（升级增加）
  PASSIVE_SPLIT_ON_BRICK: false, // 击砖分裂球
  PASSIVE_EXPLOSION_RADIUS: 0,  // 爆炸半径（0=无）
  PASSIVE_LIFESTEAL_CHANCE: 0,  // 吸血概率
  PASSIVE_CRIT_CHANCE: 0,       // 暴击概率（双倍伤害）
  PASSIVE_CRIT_MULT: 2.0,       // 暴击倍率
  PASSIVE_MAGNET: false,         // 磁力吸附（道具自动飞向挡板）

  // 肉鸽升级池
  UPGRADES: [
    // === 球相关 ===
    { key: 'extraBall', name: '量子分裂', desc: '+1 起始球', icon: '◇', color: '#FF14FF', maxLevel: 3 },
    { key: 'ballSpeed', name: '超频加速', desc: '球速+12%', icon: '»', color: '#FFF050', maxLevel: 5 },
    { key: 'pierce', name: '穿甲弹头', desc: '球穿透+1层砖', icon: '↟', color: '#00FFFF', maxLevel: 3 },
    { key: 'splitOnBrick', name: '裂变核心', desc: '击砖概率分裂球', icon: '✦', color: '#FF14FF', maxLevel: 1 },

    // === 挡板相关 ===
    { key: 'widerPaddle', name: '扩展护盾', desc: '挡板+25px', icon: '═', color: '#50FFB4', maxLevel: 4 },

    // === 被动触发 ===
    { key: 'chain', name: '连锁闪电', desc: '击砖30%概率连锁', icon: '⚡', color: '#00FFFF', maxLevel: 3 },
    { key: 'explosion', name: '爆裂核心', desc: '击砖小范围爆炸', icon: '✸', color: '#FF8800', maxLevel: 3 },
    { key: 'crit', name: '致命一击', desc: '15%概率双倍伤害', icon: '✕', color: '#FF3333', maxLevel: 3 },

    // === 生存 ===
    { key: 'extraLife', name: '备用电池', desc: '+1 生命', icon: '♥', color: '#FF14FF', maxLevel: 3 },
    { key: 'lifesteal', name: '能量虹吸', desc: '击砖5%回血', icon: '❤', color: '#FF3333', maxLevel: 3 },
    { key: 'slowAdvance', name: '黑客入侵', desc: '砖块前移速度-25%', icon: '◎', color: '#50FFB4', maxLevel: 3 },
    { key: 'magnet', name: '磁力牵引', desc: '道具自动飞向挡板', icon: '⊕', color: '#FFF050', maxLevel: 1 },
  ],

  // 游戏状态
  STATE: {
    LOADING: 'LOADING',
    TITLE: 'TITLE',
    PLAYING: 'PLAYING',
    BOSS: 'BOSS',
    LEVEL_CLEAR: 'LEVEL_CLEAR',
    GAME_OVER: 'GAME_OVER',
  },

  // 初始生命
  INITIAL_LIVES: 3,
};

module.exports = Config;
