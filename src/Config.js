/**
 * Config.js - v7.0 基础常量 + 引用定义
 */
const WEAPON_TREES = require('./config/WeaponDefs');
const SHIP_TREE = require('./config/ShipDefs');

const { windowWidth, windowHeight, pixelRatio } = wx.getSystemInfoSync();

let _safeTop = 0, _safeBottom = 0;
try { _safeTop = wx.getMenuButtonBoundingClientRect().bottom + 8; } catch (e) { _safeTop = 80; }
try { const si = wx.getSystemInfoSync(); _safeBottom = (si.screenHeight - si.safeArea.bottom) + 8; if (_safeBottom < 10) _safeBottom = 10; } catch (e) { _safeBottom = 20; }

const Config = {
  SCREEN_WIDTH: windowWidth, SCREEN_HEIGHT: windowHeight,
  DPR: pixelRatio,
  CANVAS_WIDTH: windowWidth * pixelRatio, CANVAS_HEIGHT: windowHeight * pixelRatio,
  SAFE_TOP: _safeTop, SAFE_BOTTOM: _safeBottom,

  // 颜色
  BG_COLOR: '#080220',
  NEON_CYAN: '#00FFFF', NEON_PINK: '#FF14FF', NEON_GREEN: '#50FFB4',
  NEON_YELLOW: '#FFF050', NEON_ORANGE: '#FF8800', NEON_RED: '#FF3333',
  NEON_COLORS: ['#00FFFF', '#FF14FF', '#50FFB4', '#FFF050'],

  // 发射器
  LAUNCHER_WIDTH: 48, LAUNCHER_HEIGHT: 28,
  LAUNCHER_Y_OFFSET: Math.max(120, _safeBottom + 80),
  LAUNCHER_COLOR: '#00FFFF', LAUNCHER_GUN_WIDTH: 6, LAUNCHER_GUN_HEIGHT: 18,

  // 子弹
  BULLET_RADIUS: 4, BULLET_SPEED: 10, BULLET_MAX: 60,
  BULLET_TRAIL_LENGTH: 4, BULLET_COLOR: '#00FFFF',
  BULLET_FIRE_INTERVAL: 400, BULLET_GLOW_COLOR: 'rgba(0, 255, 255, 0.4)',

  // 砖块
  BRICK_COLS: 7, BRICK_PADDING: 4, BRICK_TOP_OFFSET: _safeTop + 30,
  BRICK_HEIGHT: 20, BRICK_INIT_ROWS: 6, BRICK_DANGER_Y: 0.78,
  BRICK_HP_COLORS: { 1: null, 2: '#FF8800', 3: '#FF3333', 4: '#AA00FF', 5: '#FFFFFF', 6: '#FFD700', 7: '#00FF88', 8: '#FF69B4', 9: '#44DDFF', 10: '#FF2222' },
  BRICK_TYPE_COLORS: { normal: null, fast: '#FF8800', formation: '#AA44FF', shield: '#4488FF', split: '#00DDAA', stealth: '#AAAAAA', healer: '#FF4466' },

  // 章节
  CHAPTER_DURATION: 480000, BOSS_WARNING_DURATION: 3000,

  // Boss
  BOSS_WIDTH: 160, BOSS_HEIGHT: 40, BOSS_SPEED: 2, BOSS_BASE_HP: [80, 120, 160],

  // 粒子
  PARTICLE_MAX: 150,

  // 掉落
  COIN_DROP_CHANCE: 0.6,
  SKILL_CRATE_CHANCE: 0.05,
  SKILL_CRATE_COOLDOWN: 15000,
  POWERUP_SIZE: 18, POWERUP_SPEED: 2.5,

  // 经验系统
  EXP_PER_BRICK: 3, EXP_PER_HP: 1,
  EXP_ORB_SPEED: 6, EXP_ORB_SIZE: 4, EXP_ORB_COLOR: '#AAFFFF',
  EXP_BAR_HEIGHT: 6, EXP_BAR_Y_OFFSET: Math.max(34, _safeBottom + 14),

  // 武器上限
  MAX_WEAPONS: 4,

  // Combo
  COMBO_SCORE_BASE: 10,

  // 引用定义
  WEAPON_TREES: WEAPON_TREES,
  SHIP_TREE: SHIP_TREE,

  // 游戏状态
  STATE: {
    LOADING: 'LOADING', TITLE: 'TITLE',
    CHAPTER_SELECT: 'CHAPTER_SELECT', UPGRADE_SHOP: 'UPGRADE_SHOP',
    PLAYING: 'PLAYING', BOSS: 'BOSS',
    LEVEL_UP: 'LEVEL_UP',           // 经验升级三选一
    SKILL_CHOICE: 'SKILL_CHOICE',   // 技能宝箱三选一
    CHAPTER_CLEAR: 'CHAPTER_CLEAR', GAME_OVER: 'GAME_OVER',
  },
};

module.exports = Config;
