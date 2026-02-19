/**
 * Config.js - v3.0 向僵尸开炮式肉鸽打砖块
 * 核心：可见武器 + 套路Build + 满屏特效
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
  NEON_RED: '#FF3333',
  NEON_COLORS: ['#00FFFF', '#FF14FF', '#50FFB4', '#FFF050'],

  // 挡板
  PADDLE_WIDTH: 90,
  PADDLE_HEIGHT: 14,
  PADDLE_Y_OFFSET: 100,
  PADDLE_COLOR: '#00FFFF',

  // 球
  BALL_RADIUS: 7,
  BALL_SPEED: 5,
  BALL_MAX: 30,
  BALL_TRAIL_LENGTH: 8,
  BALL_COLOR: '#FFFFFF',

  // 砖块
  BRICK_COLS: 7,
  BRICK_PADDING: 4,
  BRICK_TOP_OFFSET: 55,
  BRICK_HEIGHT: 20,
  BRICK_HP_COLORS: {
    1: null,
    2: '#FF8800',
    3: '#FF3333',
    4: '#AA00FF',
  },

  // 砖块前移
  BRICK_ADVANCE_INTERVAL: 10000,
  BRICK_ADVANCE_STEP: 24,
  BRICK_DANGER_Y: 0.75,

  // Boss
  BOSS_TRIGGER_INTERVAL: 5,
  BOSS_WIDTH: 160,
  BOSS_HEIGHT: 40,
  BOSS_SPEED: 2,
  BOSS_BASE_HP: [80, 120, 160],

  // 粒子
  PARTICLE_MAX: 200,

  // 道具
  POWERUP_DROP_CHANCE: 0.15,
  POWERUP_SIZE: 18,
  POWERUP_SPEED: 2.5,

  // Combo
  COMBO_SCORE_BASE: 10,

  // ===== 武器技能定义 =====
  // 每个武器有独立视觉，5级满级
  WEAPONS: {
    // --- 环绕类 ---
    orbitBlade: {
      name: '等离子刃',
      desc: '环绕挡板旋转的能量刃',
      icon: '⟐',
      color: '#00FFFF',
      category: 'orbit',
      maxLevel: 5,
      // 每级数值: [数量, 伤害, 半径]
      levels: [
        { count: 1, damage: 1, radius: 60, speed: 0.04 },
        { count: 2, damage: 1, radius: 65, speed: 0.045 },
        { count: 3, damage: 1, radius: 70, speed: 0.05 },
        { count: 3, damage: 2, radius: 75, speed: 0.055 },
        { count: 4, damage: 2, radius: 80, speed: 0.06 },
      ],
      evolve: { name: '量子旋涡', icon: '◈', color: '#00FFDD', count: 6, damage: 3, radius: 90, speed: 0.07 },
    },
    fireSurge: {
      name: '烈焰涌动',
      desc: '火焰波纹向上扩散',
      icon: '🔥',
      color: '#FF8800',
      category: 'wave',
      maxLevel: 5,
      levels: [
        { damage: 1, interval: 3000, width: 0.4 },
        { damage: 1, interval: 2600, width: 0.5 },
        { damage: 2, interval: 2200, width: 0.6 },
        { damage: 2, interval: 1800, width: 0.7 },
        { damage: 3, interval: 1500, width: 0.8 },
      ],
      evolve: { name: '炼狱风暴', icon: '🌋', color: '#FF4400', damage: 4, interval: 1200, width: 1.0 },
    },
    lightning: {
      name: '链式闪电',
      desc: '自动锁定砖块释放闪电',
      icon: '⚡',
      color: '#FFF050',
      category: 'auto',
      maxLevel: 5,
      levels: [
        { damage: 1, interval: 2500, chains: 1 },
        { damage: 1, interval: 2200, chains: 2 },
        { damage: 2, interval: 1900, chains: 2 },
        { damage: 2, interval: 1600, chains: 3 },
        { damage: 3, interval: 1400, chains: 4 },
      ],
      evolve: { name: '雷神之怒', icon: '⛈', color: '#FFFF00', damage: 4, interval: 1000, chains: 6 },
    },
    missile: {
      name: '追踪导弹',
      desc: '自动追踪砖块的导弹',
      icon: '◆',
      color: '#FF14FF',
      category: 'auto',
      maxLevel: 5,
      levels: [
        { damage: 2, interval: 3500, count: 1, speed: 3 },
        { damage: 2, interval: 3000, count: 1, speed: 3.5 },
        { damage: 2, interval: 2500, count: 2, speed: 3.5 },
        { damage: 3, interval: 2200, count: 2, speed: 4 },
        { damage: 3, interval: 1800, count: 3, speed: 4.5 },
      ],
      evolve: { name: '核弹洗地', icon: '☢', color: '#FF00AA', damage: 5, interval: 1500, count: 4, speed: 5, explodeRadius: 50 },
    },
    laserBeam: {
      name: '激光射线',
      desc: '挡板上方自动发射激光',
      icon: '|',
      color: '#FF3333',
      category: 'beam',
      maxLevel: 5,
      levels: [
        { damage: 1, interval: 2000, width: 3, duration: 300 },
        { damage: 1, interval: 1800, width: 4, duration: 350 },
        { damage: 2, interval: 1500, width: 5, duration: 400 },
        { damage: 2, interval: 1300, width: 6, duration: 450 },
        { damage: 3, interval: 1100, width: 8, duration: 500 },
      ],
      evolve: { name: '死亡射线', icon: '‖', color: '#FF0000', damage: 5, interval: 800, width: 12, duration: 600 },
    },
    iceField: {
      name: '冰霜领域',
      desc: '减速砖块前移+冰锥攻击',
      icon: '❄',
      color: '#80DDFF',
      category: 'aura',
      maxLevel: 5,
      levels: [
        { slowMult: 0.85, iceDamage: 1, iceInterval: 4000 },
        { slowMult: 0.75, iceDamage: 1, iceInterval: 3500 },
        { slowMult: 0.65, iceDamage: 2, iceInterval: 3000 },
        { slowMult: 0.55, iceDamage: 2, iceInterval: 2500 },
        { slowMult: 0.45, iceDamage: 3, iceInterval: 2000 },
      ],
      evolve: { name: '绝对零度', icon: '✧', color: '#AAEEFF', slowMult: 0.3, iceDamage: 4, iceInterval: 1500 },
    },
  },

  // ===== 基础强化（非武器） =====
  BUFFS: [
    { key: 'extraBall', name: '+1球', desc: '起始多一个球', icon: '●', color: '#FF14FF', maxLevel: 3 },
    { key: 'ballSpeed', name: '加速', desc: '球速+15%', icon: '»', color: '#FFF050', maxLevel: 4 },
    { key: 'widerPaddle', name: '加宽', desc: '挡板+25px', icon: '═', color: '#50FFB4', maxLevel: 4 },
    { key: 'extraLife', name: '+命', desc: '额外生命+1', icon: '♥', color: '#FF14FF', maxLevel: 3 },
    { key: 'magnet', name: '磁力', desc: '道具自动吸附', icon: '⊕', color: '#FFF050', maxLevel: 1 },
    { key: 'crit', name: '暴击', desc: '球20%双倍伤害', icon: '✕', color: '#FF3333', maxLevel: 3 },
    { key: 'pierce', name: '穿透', desc: '球穿透+1层', icon: '↟', color: '#00FFFF', maxLevel: 3 },
  ],

  // 进化条件：武器满级 + 特定基础强化满级
  EVOLVE_RECIPES: {
    orbitBlade: { weapon: 'orbitBlade', buff: 'ballSpeed' },
    fireSurge: { weapon: 'fireSurge', buff: 'crit' },
    lightning: { weapon: 'lightning', buff: 'pierce' },
    missile: { weapon: 'missile', buff: 'extraBall' },
    laserBeam: { weapon: 'laserBeam', buff: 'widerPaddle' },
    iceField: { weapon: 'iceField', buff: 'extraLife' },
  },

  // 游戏状态
  STATE: {
    LOADING: 'LOADING',
    TITLE: 'TITLE',
    PLAYING: 'PLAYING',
    BOSS: 'BOSS',
    LEVEL_CLEAR: 'LEVEL_CLEAR',
    GAME_OVER: 'GAME_OVER',
  },

  INITIAL_LIVES: 3,
};

module.exports = Config;
