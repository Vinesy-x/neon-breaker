/**
 * Config.js - v6.0 武器升级树 + 飞机升级树
 * 核心：武器分支升级 + 飞机独立升级 + 技能宝箱三选一
 */

const { windowWidth, windowHeight, pixelRatio } = wx.getSystemInfoSync();

// 微信安全区域适配
let _safeTop = 0;
let _safeBottom = 0;
try {
  const menuRect = wx.getMenuButtonBoundingClientRect();
  _safeTop = menuRect.bottom + 8;
} catch (e) {
  _safeTop = 80;
}
try {
  const sysInfo = wx.getSystemInfoSync();
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
  SAFE_TOP: _safeTop,
  SAFE_BOTTOM: _safeBottom,

  // 颜色
  BG_COLOR: '#080220',
  NEON_CYAN: '#00FFFF',
  NEON_PINK: '#FF14FF',
  NEON_GREEN: '#50FFB4',
  NEON_YELLOW: '#FFF050',
  NEON_ORANGE: '#FF8800',
  NEON_RED: '#FF3333',
  NEON_COLORS: ['#00FFFF', '#FF14FF', '#50FFB4', '#FFF050'],

  // 发射器
  LAUNCHER_WIDTH: 48,
  LAUNCHER_HEIGHT: 28,
  LAUNCHER_Y_OFFSET: Math.max(120, _safeBottom + 80),
  LAUNCHER_COLOR: '#00FFFF',
  LAUNCHER_GUN_WIDTH: 6,
  LAUNCHER_GUN_HEIGHT: 18,

  // 子弹
  BULLET_RADIUS: 4,
  BULLET_SPEED: 10,
  BULLET_MAX: 60,
  BULLET_TRAIL_LENGTH: 4,
  BULLET_COLOR: '#00FFFF',
  BULLET_FIRE_INTERVAL: 400,
  BULLET_GLOW_COLOR: 'rgba(0, 255, 255, 0.4)',

  // 砖块
  BRICK_COLS: 7,
  BRICK_PADDING: 4,
  BRICK_TOP_OFFSET: _safeTop + 30,
  BRICK_HEIGHT: 20,
  BRICK_HP_COLORS: {
    1: null, 2: '#FF8800', 3: '#FF3333', 4: '#AA00FF', 5: '#FFFFFF',
    6: '#FFD700', 7: '#00FF88', 8: '#FF69B4', 9: '#44DDFF', 10: '#FF2222',
  },

  BRICK_INIT_ROWS: 6,
  BRICK_DANGER_Y: 0.78,

  CHAPTER_DURATION: 480000,
  BOSS_WARNING_DURATION: 3000,

  BRICK_TYPE_COLORS: {
    normal: null, fast: '#FF8800', formation: '#AA44FF',
    shield: '#4488FF', split: '#00DDAA', stealth: '#AAAAAA', healer: '#FF4466',
  },

  BOSS_WIDTH: 160,
  BOSS_HEIGHT: 40,
  BOSS_SPEED: 2,
  BOSS_BASE_HP: [80, 120, 160],

  PARTICLE_MAX: 150,

  // 掉落：金币 + 技能宝箱
  COIN_DROP_CHANCE: 0.6,      // 金币掉率
  SKILL_CRATE_CHANCE: 0.05,   // 技能宝箱掉率
  SKILL_CRATE_COOLDOWN: 15000, // 宝箱最小间隔15秒
  POWERUP_SIZE: 18,
  POWERUP_SPEED: 2.5,

  // 武器上限
  MAX_WEAPONS: 4,

  // Combo
  COMBO_SCORE_BASE: 10,

  // ===== 武器升级树 =====
  WEAPON_TREES: {
    kunai: {
      name: '光能飞刀',
      desc: '丢出飞刀向前飞行，穿透砖块',
      icon: '🔪',
      color: '#00FFFF',
      basePct: 1.0,
      interval: 1500,
      branches: {
        damage:  { name: '伤害', desc: '+50%基础伤害', max: 5, requires: null },
        count:   { name: '刀数', desc: '+1把飞刀', max: 3, requires: null },
        pierce:  { name: '穿透', desc: '+1穿透层数', max: 3, requires: null },
        speed:   { name: '飞行速度', desc: '+30%速度', max: 2, requires: null },
        scatter: { name: '散射', desc: '扇形发射', max: 2, requires: { count: 2 } },
        return:  { name: '回旋', desc: '飞刀返回再造成伤害', max: 1, requires: { pierce: 2 } },
      },
    },
    lightning: {
      name: '闪电链',
      desc: '自动锁定砖块释放闪电',
      icon: '⚡',
      color: '#FFF050',
      basePct: 1.2,
      interval: 2500,
      branches: {
        damage:   { name: '伤害', desc: '+50%基础伤害', max: 5, requires: null },
        chains:   { name: '链数', desc: '+1跳跃目标', max: 4, requires: null },
        freq:     { name: '频率', desc: '-20%冷却', max: 3, requires: null },
        paralyze: { name: '麻痹', desc: '命中减速30%', max: 2, requires: { chains: 2 } },
        storm:    { name: '雷暴', desc: '同时释放2道闪电', max: 2, requires: { freq: 2 } },
        overload: { name: '超载', desc: '链末端爆炸AOE', max: 1, requires: { chains: 3, damage: 3 } },
      },
    },
    missile: {
      name: '追踪导弹',
      desc: '自动追踪砖块的导弹',
      icon: '🚀',
      color: '#FF14FF',
      basePct: 2.0,
      interval: 3500,
      branches: {
        damage:   { name: '伤害', desc: '+50%基础伤害', max: 4, requires: null },
        count:    { name: '数量', desc: '+1发导弹', max: 3, requires: null },
        aoe:      { name: '爆炸范围', desc: '+25%AOE', max: 3, requires: null },
        tracking: { name: '追踪性能', desc: '+30%转向', max: 2, requires: null },
        split:    { name: '分裂弹', desc: '命中后分裂3小弹', max: 2, requires: { count: 2 } },
        nuke:     { name: '核弹头', desc: '巨型爆炸+屏震', max: 1, requires: { aoe: 3, damage: 4 } },
      },
    },
    meteor: {
      name: '天降陨石',
      desc: '随机位置砸下陨石AOE',
      icon: '☄',
      color: '#FF8800',
      basePct: 2.5,
      interval: 4000,
      branches: {
        damage: { name: '伤害', desc: '+50%基础伤害', max: 5, requires: null },
        count:  { name: '数量', desc: '+1颗陨石', max: 3, requires: null },
        radius: { name: '范围', desc: '+25%爆炸范围', max: 3, requires: null },
        freq:   { name: '频率', desc: '-15%冷却', max: 3, requires: null },
        burn:   { name: '燃烧', desc: '落点留火焰地带', max: 2, requires: { damage: 2 } },
        rain:   { name: '陨石雨', desc: '同时砸下一排', max: 1, requires: { count: 3, freq: 2 } },
      },
    },
    drone: {
      name: '攻击无人机',
      desc: '跟随飞机的无人机自动射击',
      icon: '🤖',
      color: '#50FFB4',
      basePct: 0.8,
      interval: 800,
      branches: {
        damage:   { name: '伤害', desc: '+50%基础伤害', max: 5, requires: null },
        count:    { name: '数量', desc: '+1台无人机', max: 3, requires: null },
        fireRate: { name: '射速', desc: '+25%攻击频率', max: 3, requires: null },
        range:    { name: '射程', desc: '+20%攻击距离', max: 2, requires: null },
        burst:    { name: '连射', desc: '每次射3发', max: 2, requires: { fireRate: 2 } },
        laser:    { name: '激光模式', desc: '改为持续激光', max: 1, requires: { count: 2, damage: 4 } },
      },
    },
    spinBlade: {
      name: '等离子旋刃',
      desc: '丢出旋转刃持续移动切割',
      icon: '🌀',
      color: '#AA44FF',
      basePct: 0.6,
      interval: 3000,
      tickInterval: 200,
      branches: {
        damage:   { name: '伤害', desc: '+50%基础伤害', max: 5, requires: null },
        count:    { name: '刃数', desc: '+1把旋刃', max: 3, requires: null },
        duration: { name: '持续时间', desc: '+1秒存在时间', max: 3, requires: null },
        speed:    { name: '移速', desc: '+30%飞行速度', max: 2, requires: null },
        giant:    { name: '巨型化', desc: '旋刃体积翻倍', max: 2, requires: { duration: 2 } },
        bounce:   { name: '连锁弹射', desc: '碰壁反弹继续飞', max: 1, requires: { count: 2, speed: 2 } },
      },
    },
  },

  // ===== 飞机升级树 =====
  SHIP_TREE: {
    attack:    { name: '基础攻击', desc: '+15%子弹伤害', icon: '⚔', color: '#FF3333', max: 6, requires: null },
    fireRate:  { name: '射速', desc: '+10%子弹射速', icon: '»', color: '#FFF050', max: 5, requires: null },
    spread:    { name: '弹道', desc: '+1子弹散射数', icon: '⋮', color: '#FF14FF', max: 3, requires: null },
    pierce:    { name: '穿透弹', desc: '子弹穿透+1层', icon: '↟', color: '#00FFFF', max: 2, requires: null },
    crit:      { name: '暴击', desc: '+8%暴击率', icon: '✕', color: '#FF3333', max: 4, requires: null },
    moveSpeed: { name: '移速', desc: '+10%移动速度', icon: '→', color: '#50FFB4', max: 3, requires: null },
    critDmg:   { name: '暴击伤害', desc: '+30%暴击倍率', icon: '☆', color: '#FFD700', max: 3, requires: { crit: 2 } },
    barrage:   { name: '弹幕', desc: '子弹变为3连发', icon: '⫶', color: '#FF14FF', max: 2, requires: { fireRate: 3 } },
    shield:    { name: '能量护盾', desc: '受击免疫1次/30秒', icon: '◎', color: '#4488FF', max: 2, requires: { moveSpeed: 2 } },
    magnet:    { name: '磁力场', desc: '自动吸收金币和宝箱', icon: '⊕', color: '#FFF050', max: 1, requires: null },
  },

  // 游戏状态
  STATE: {
    LOADING: 'LOADING',
    TITLE: 'TITLE',
    CHAPTER_SELECT: 'CHAPTER_SELECT',
    UPGRADE_SHOP: 'UPGRADE_SHOP',
    PLAYING: 'PLAYING',
    BOSS: 'BOSS',
    SKILL_CHOICE: 'SKILL_CHOICE',  // 技能宝箱三选一（替代 LEVEL_UP）
    CHAPTER_CLEAR: 'CHAPTER_CLEAR',
    GAME_OVER: 'GAME_OVER',
  },
};

module.exports = Config;
