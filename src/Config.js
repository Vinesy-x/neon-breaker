/**
 * Config.js - v3.0 向僵尸开炮式肉鸽打砖块
 * 核心：可见武器 + 套路Build + 满屏特效
 */

const { windowWidth, windowHeight, pixelRatio } = wx.getSystemInfoSync();

// 微信安全区域适配
let _safeTop = 0;
let _safeBottom = 0;
try {
  const menuRect = wx.getMenuButtonBoundingClientRect();
  // 胶囊按钮底部 + 间距 = 安全区顶部
  _safeTop = menuRect.bottom + 8;
} catch (e) {
  _safeTop = 80; // 兜底
}
try {
  const sysInfo = wx.getSystemInfoSync();
  // iPhone X 系列底部安全区
  _safeBottom = (sysInfo.screenHeight - sysInfo.safeArea.bottom) + 8;
  if (_safeBottom < 10) _safeBottom = 10;
} catch (e) {
  _safeBottom = 20;
}

const Config = {
  // 屏幕
  SCREEN_WIDTH: windowWidth,
  SCREEN_HEIGHT: windowHeight,
  DPR: pixelRatio,
  CANVAS_WIDTH: windowWidth * pixelRatio,
  CANVAS_HEIGHT: windowHeight * pixelRatio,

  // 安全区域
  SAFE_TOP: _safeTop,       // HUD和砖块不能超过这条线
  SAFE_BOTTOM: _safeBottom,  // 经验条和挡板不能低于这条线

  // 颜色
  BG_COLOR: '#080220',
  NEON_CYAN: '#00FFFF',
  NEON_PINK: '#FF14FF',
  NEON_GREEN: '#50FFB4',
  NEON_YELLOW: '#FFF050',
  NEON_ORANGE: '#FF8800',
  NEON_RED: '#FF3333',
  NEON_COLORS: ['#00FFFF', '#FF14FF', '#50FFB4', '#FFF050'],

  // 发射器（替代挡板）
  LAUNCHER_WIDTH: 48,
  LAUNCHER_HEIGHT: 28,
  LAUNCHER_Y_OFFSET: Math.max(120, _safeBottom + 80), // 距底部，留出经验条空间
  LAUNCHER_COLOR: '#00FFFF',
  LAUNCHER_GUN_WIDTH: 6,
  LAUNCHER_GUN_HEIGHT: 18,

  // 子弹（替代球）
  BULLET_RADIUS: 4,
  BULLET_SPEED: 10,
  BULLET_MAX: 60,
  BULLET_TRAIL_LENGTH: 4,
  BULLET_COLOR: '#00FFFF',
  BULLET_FIRE_INTERVAL: 500, // ms
  BULLET_GLOW_COLOR: 'rgba(0, 255, 255, 0.4)',

  // 砖块
  BRICK_COLS: 7,
  BRICK_PADDING: 4,
  BRICK_TOP_OFFSET: _safeTop + 30,
  BRICK_HEIGHT: 20,
  BRICK_HP_COLORS: {
    1: null,
    2: '#FF8800',
    3: '#FF3333',
    4: '#AA00FF',
    5: '#FFFFFF',
    6: '#FFD700',
    7: '#00FF88',
    8: '#FF69B4',
  },

  // 砖块持续下移（无限模式）
  BRICK_SCROLL_SPEED: 0.22,       // 更快
  BRICK_SPAWN_INTERVAL: 1800,     // 1.8秒一行
  BRICK_INIT_ROWS: 6,
  BRICK_GAP_CHANCE: 0.06,         // 几乎不空
  BRICK_DANGER_Y: 0.78,
  BRICK_SPEED_INCREMENT: 0.025,
  DIFFICULTY_INTERVAL: 18000,     // 18秒难度+1

  // Boss
  BOSS_TRIGGER_TIME: 60000,  // 每60秒触发Boss
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
    { key: 'fireRate', name: '射速', desc: '射速+10%', icon: '»', color: '#FFF050', maxLevel: 5 },
    { key: 'spread', name: '散射', desc: '子弹+1发', icon: '⋮', color: '#FF14FF', maxLevel: 3 },
    { key: 'bulletDmg', name: '弹伤', desc: '子弹伤害+1', icon: '↑', color: '#50FFB4', maxLevel: 3 },
    { key: 'clearBomb', name: '清屏', desc: '清除底部一行砖块', icon: '💥', color: '#FF14FF', maxLevel: 3 },
    { key: 'magnet', name: '磁力', desc: '道具自动吸附', icon: '⊕', color: '#FFF050', maxLevel: 1 },
    { key: 'crit', name: '暴击', desc: '子弹15%双倍伤害', icon: '✕', color: '#FF3333', maxLevel: 3 },
    { key: 'pierce', name: '穿透', desc: '子弹穿透+1层', icon: '↟', color: '#00FFFF', maxLevel: 2 },
  ],

  // 进化条件：武器满级 + 特定基础强化满级
  EVOLVE_RECIPES: {
    orbitBlade: { weapon: 'orbitBlade', buff: 'fireRate' },
    fireSurge: { weapon: 'fireSurge', buff: 'crit' },
    lightning: { weapon: 'lightning', buff: 'pierce' },
    missile: { weapon: 'missile', buff: 'spread' },
    laserBeam: { weapon: 'laserBeam', buff: 'bulletDmg' },
    iceField: { weapon: 'iceField', buff: 'clearBomb' },
  },

  // 游戏状态
  STATE: {
    LOADING: 'LOADING',
    TITLE: 'TITLE',
    PLAYING: 'PLAYING',
    BOSS: 'BOSS',
    LEVEL_UP: 'LEVEL_UP',
    GAME_OVER: 'GAME_OVER',
  },

  // ===== 经验系统 =====
  EXP_PER_BRICK: 3,         // 每个砖块基础经验
  EXP_PER_HP: 1,            // 每点HP额外经验
  EXP_BASE_TO_LEVEL: 300,   // 1级升级所需经验
  EXP_GROWTH: 1.6,          // 每级经验增长系数
  EXP_ORB_SPEED: 6,         // 经验球飞行速度
  EXP_ORB_SIZE: 4,          // 经验球大小
  EXP_ORB_COLOR: '#AAFFFF', // 经验球颜色
  EXP_BAR_HEIGHT: 6,        // 经验条高度
  EXP_BAR_Y_OFFSET: Math.max(34, _safeBottom + 14), // 经验条距屏幕底部

  // 经验升级选择状态
  STATE_LEVEL_UP: 'LEVEL_UP',
};

module.exports = Config;
