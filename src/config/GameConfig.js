/**
 * GameConfig.js - 游戏全局常量配置
 * 纯数据，无逻辑代码。频繁调整的游戏数值集中在此。
 * 
 * 分类：
 * - launcher: 发射器/飞机
 * - bullet: 子弹
 * - brick: 砖块
 * - chapter: 章节节奏
 * - boss: Boss
 * - drop: 掉落
 * - exp: 经验系统
 * - combat: 战斗通用
 * - particle: 粒子特效
 */

module.exports = {
  // ===== 发射器/飞机 =====
  launcher: {
    width: 48,
    height: 28,
    yOffset: 80,               // 底部偏移（实际会加 safeBottom）
    gunWidth: 6,
    gunHeight: 18,
  },

  // ===== 子弹 =====
  bullet: {
    radius: 4,
    speed: 10,
    maxCount: 40,
    trailLength: 5,
    fireInterval: 800,          // 射击间隔(ms)
  },

  // ===== 砖块 =====
  brick: {
    cols: 7,
    padding: 4,
    height: 20,
    initRows: 6,                // 初始行数
    dangerY: 0.78,              // 危险线（屏幕比例）
    hpColors: {
      1: null, 2: '#FF8800', 3: '#FF3333', 4: '#AA00FF', 5: '#FFFFFF',
      6: '#FFD700', 7: '#00FF88', 8: '#FF69B4', 9: '#44DDFF', 10: '#FF2222',
    },
    typeColors: {
      normal: null, fast: '#FF8800', formation: '#AA44FF',
      shield: '#4488FF', split: '#00DDAA', stealth: '#AAAAAA', healer: '#FF4466',
    },
  },

  // ===== 章节节奏 =====
  chapter: {
    duration: 480000,            // 章节时长(ms) = 8分钟
    bossWarningDuration: 3000,   // Boss预警时长(ms)
  },

  // ===== Boss =====
  boss: {
    width: 160,
    height: 40,
    speed: 2,
    baseHP: [80, 120, 160],     // 三阶段HP
  },

  // ===== 粒子 =====
  particle: {
    maxCount: 80,
  },

  // ===== 掉落 =====
  drop: {
    coinChance: 0.6,             // 金币掉率
    skillCrateChance: 0.05,      // 技能箱掉率
    skillCrateCooldown: 15000,   // 技能箱冷却(ms)
    powerupSize: 18,
    powerupSpeed: 2.5,
  },

  // ===== 经验系统 =====
  exp: {
    perBrick: 3,                 // 每个砖块经验
    perHP: 1,                    // 每点HP经验
    orbSpeed: 6,
    orbSize: 4,
    barHeight: 6,
  },

  // ===== 战斗通用 =====
  combat: {
    maxWeapons: 4,               // 战斗中最多携带武器数
    comboScoreBase: 10,          // Combo基础分数
  },

  // ===== 伤害类型 =====
  damageTypes: {
    PHYSICAL: 'physical',
    FIRE: 'fire',
    ICE: 'ice',
    ENERGY: 'energy',
  },
  damageTypeColors: {
    physical: '#FFFFFF',
    fire: '#FF4400',
    ice: '#44DDFF',
    energy: '#FFF050',
  },
};
