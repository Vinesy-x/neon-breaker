/**
 * Config.js - v7.0 基础常量 + 引用定义
 */
const WEAPON_TREES = require('./config/WeaponDefs');
const GC = require('./config/GameConfig');
const SHIP_TREE = require('./config/ShipDefs');

const { windowWidth, windowHeight, pixelRatio } = wx.getSystemInfoSync();

let _safeTop = 0, _safeBottom = 0;
try { _safeTop = wx.getMenuButtonBoundingClientRect().bottom + 8; } catch (e) { _safeTop = 80; }
try { const si = wx.getSystemInfoSync(); _safeBottom = (si.screenHeight - si.safeArea.bottom) + 8; if (_safeBottom < 10) _safeBottom = 10; } catch (e) { _safeBottom = 20; }

const Config = {
  DEV_MODE: true,  // 发布时设为false，隐藏DEV按钮和面板
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
  LAUNCHER_WIDTH: GC.launcher.width, LAUNCHER_HEIGHT: GC.launcher.height,
  LAUNCHER_Y_OFFSET: Math.max(120, _safeBottom + 80),
  LAUNCHER_COLOR: '#00FFFF', LAUNCHER_GUN_WIDTH: GC.launcher.gunWidth, LAUNCHER_GUN_HEIGHT: GC.launcher.gunHeight,

  // 子弹
  BULLET_RADIUS: GC.bullet.radius, BULLET_SPEED: GC.bullet.speed, BULLET_MAX: GC.bullet.maxCount,
  BULLET_TRAIL_LENGTH: GC.bullet.trailLength, BULLET_COLOR: '#FFFFFF',
  BULLET_FIRE_INTERVAL: GC.bullet.fireInterval, BULLET_GLOW_COLOR: 'rgba(0, 255, 255, 0.4)',

  // 砖块
  BRICK_COLS: GC.brick.cols, BRICK_PADDING: GC.brick.padding, BRICK_TOP_OFFSET: _safeTop + 30,
  BRICK_HEIGHT: GC.brick.height, BRICK_INIT_ROWS: GC.brick.initRows, BRICK_DANGER_Y: GC.brick.dangerY,
  BRICK_HP_COLORS: { 1: null, 2: '#FF8800', 3: '#FF3333', 4: '#AA00FF', 5: '#FFFFFF', 6: '#FFD700', 7: '#00FF88', 8: '#FF69B4', 9: '#44DDFF', 10: '#FF2222' },
  BRICK_TYPE_COLORS: { normal: null, fast: '#FF8800', formation: '#AA44FF', shield: '#4488FF', split: '#00DDAA', stealth: '#AAAAAA', healer: '#FF4466' },

  // 章节
  CHAPTER_DURATION: GC.chapter.duration, BOSS_WARNING_DURATION: GC.chapter.bossWarningDuration,

  // Boss
  BOSS_WIDTH: GC.boss.width, BOSS_HEIGHT: GC.boss.height, BOSS_SPEED: GC.boss.speed, BOSS_BASE_HP: GC.boss.baseHP,

  // 粒子
  PARTICLE_MAX: GC.particle.maxCount,

  // 掉落
  COIN_DROP_CHANCE: GC.drop.coinChance,
  SKILL_CRATE_CHANCE: GC.drop.skillCrateChance,
  SKILL_CRATE_COOLDOWN: GC.drop.skillCrateCooldown,
  SKILL_CRATE_DOUBLE_CHANCE: GC.drop.skillCrateDoubleChance,
  SKILL_CRATE_TRIPLE_CHANCE: GC.drop.skillCrateTripleChance,
  POWERUP_SIZE: GC.drop.powerupSize, POWERUP_SPEED: GC.drop.powerupSpeed,

  // 经验系统
  EXP_PER_BRICK: GC.exp.perBrick, EXP_PER_HP: GC.exp.perHP,
  EXP_ORB_SPEED: GC.exp.orbSpeed, EXP_ORB_SIZE: GC.exp.orbSize, EXP_ORB_COLOR: '#AAFFFF',
  EXP_BAR_HEIGHT: GC.exp.barHeight, EXP_BAR_Y_OFFSET: Math.max(34, _safeBottom + 14),

  // 武器上限
  MAX_WEAPONS: GC.combat.maxWeapons,

  // Combo
  COMBO_SCORE_BASE: GC.combat.comboScoreBase,

  // 伤害类型
  DAMAGE_TYPES: {
    PHYSICAL: 'physical',  // 子弹、旋刃、导弹直击、冰爆弹弹体
    FIRE: 'fire',          // 火焰弹、白磷弹、陨石、爆炸类
    ICE: 'ice',            // 冰爆弹
    ENERGY: 'energy',      // 雷电弹、闪电链、离子射线、无人机激光
  },
  DAMAGE_TYPE_COLORS: {
    physical: '#FFFFFF',
    fire: '#FF4400',
    ice: '#44DDFF',
    energy: '#FFF050',
  },

  // 引用定义
  WEAPON_TREES: WEAPON_TREES,
  SHIP_TREE: SHIP_TREE,

  // 游戏状态
  STATE: {
    LOADING: 'LOADING', TITLE: 'TITLE',
    CHAPTER_SELECT: 'CHAPTER_SELECT', UPGRADE_SHOP: 'UPGRADE_SHOP',
    WEAPON_SHOP: 'WEAPON_SHOP',
    PLAYING: 'PLAYING', BOSS: 'BOSS', PAUSED: 'PAUSED',
    LEVEL_UP: 'LEVEL_UP',           // 经验升级三选一
    SKILL_CHOICE: 'SKILL_CHOICE',   // 技能宝箱三选一
    CHAPTER_CLEAR: 'CHAPTER_CLEAR', GAME_OVER: 'GAME_OVER',
  },
};

module.exports = Config;
