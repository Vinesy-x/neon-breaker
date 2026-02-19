/**
 * ChapterConfig.js - 100章数值配置生成器
 * 所有章节共用相同的节奏曲线，差异在数值缩放
 */

class ChapterConfig {
  /**
   * 获取某章节的完整配置
   * @param {number} chapter - 章节号 (1~100)
   */
  static get(chapter) {
    return {
      chapter: chapter,

      // 砖块数值缩放
      hpMultiplier: 1.0 + (chapter - 1) * 0.06,
      scrollSpeed: Math.min(0.45, 0.18 + (chapter - 1) * 0.003),
      spawnInterval: Math.max(1200, 2000 - (chapter - 1) * 10),
      gapChance: Math.max(0.03, 0.12 - (chapter - 1) * 0.001),

      // Boss
      bossType: ['charger', 'guardian', 'summoner', 'laser', 'phantom'][(chapter - 1) % 5],
      bossHpMultiplier: 1.0 + (chapter - 1) * 0.12,
      bossCycle: Math.floor((chapter - 1) / 5),

      // 金币奖励
      clearReward: 50 + chapter * 8,
      failRewardRatio: 0.3,
      firstClearBonus: 2.0,

      // 砖块类型解锁
      brickTypes: ChapterConfig._getBrickTypes(chapter),

      // 难度节奏时间线
      timeline: ChapterConfig._getTimeline(chapter),
    };
  }

  /**
   * 根据章节决定可出现的砖块类型
   */
  static _getBrickTypes(chapter) {
    var types = ['normal', 'fast', 'formation'];
    if (chapter >= 2) types.push('shield');
    if (chapter >= 3) types.push('split');
    if (chapter >= 5) types.push('stealth');
    if (chapter >= 8) types.push('healer');
    return types;
  }

  /**
   * 难度节奏时间线
   * 返回数组：[{ time, phase, intensity, hpRange, spawnMult, types }]
   */
  static _getTimeline(chapter) {
    // v6.0 重新设计：前30秒就开始加压，节奏更紧凑
    // 总时长10分钟 = 600秒，全程持续施压
    var phases = [
      // 0~25秒：热身，已有2HP砖混入
      { time: 0,      phase: 'warmup',    intensity: 0.4,  hpRange: [1, 2], spawnMult: 0.8,  types: ['normal'],
        scrollAccel: 0.002 },
      // 25~70秒：第一波，HP快速爬升到3
      { time: 25000,  phase: 'wave1',     intensity: 0.55, hpRange: [2, 3], spawnMult: 1.0,  types: ['normal', 'fast'],
        scrollAccel: 0.003 },
      // 70~110秒：第一波高潮，HP到4，阵型砖
      { time: 70000,  phase: 'surge1',    intensity: 0.7,  hpRange: [3, 5], spawnMult: 1.2,  types: ['normal', 'fast', 'formation'],
        scrollAccel: 0.002 },
      // 110~130秒：短喘息（20秒）
      { time: 110000, phase: 'breather1', intensity: 0.3,  hpRange: [2, 3], spawnMult: 0.6,  types: ['normal'],
        scrollAccel: 0 },
      // 130~190秒：第二波，护盾+分裂，HP到5
      { time: 130000, phase: 'wave2',     intensity: 0.75, hpRange: [3, 6], spawnMult: 1.2,  types: ['normal', 'fast', 'formation', 'shield', 'split'],
        scrollAccel: 0.003 },
      // 190~250秒：高压期，HP到7
      { time: 190000, phase: 'highpres',  intensity: 0.9,  hpRange: [4, 7], spawnMult: 1.4,  types: ['normal', 'fast', 'formation', 'shield', 'split'],
        scrollAccel: 0.003 },
      // 250~270秒：第二次喘息
      { time: 250000, phase: 'breather2', intensity: 0.35, hpRange: [3, 4], spawnMult: 0.5,  types: ['normal'],
        scrollAccel: 0 },
      // 270~350秒：第三波，HP到8
      { time: 270000, phase: 'wave3',     intensity: 0.85, hpRange: [5, 8], spawnMult: 1.3,  types: ['normal', 'fast', 'formation', 'shield', 'split', 'stealth'],
        scrollAccel: 0.004 },
      // 350~420秒：极限冲刺
      { time: 350000, phase: 'sprint',    intensity: 1.0,  hpRange: [6, 10], spawnMult: 1.6, types: ['normal', 'fast', 'formation', 'shield', 'split', 'stealth', 'healer'],
        scrollAccel: 0.004 },
      // 420~445秒：最后喘息
      { time: 420000, phase: 'breather3', intensity: 0.3,  hpRange: [3, 4], spawnMult: 0.4,  types: ['normal'],
        scrollAccel: 0 },
      // 445~475秒：Boss预热
      { time: 445000, phase: 'preBoss',   intensity: 0.1,  hpRange: [1, 2], spawnMult: 0.2,  types: ['normal'],
        scrollAccel: 0 },
      // 475秒：Boss战
      { time: 475000, phase: 'boss',      intensity: 0,    hpRange: [0, 0], spawnMult: 0,    types: [],
        scrollAccel: 0 },
    ];

    // 过滤掉该章节未解锁的砖块类型
    var unlocked = ChapterConfig._getBrickTypes(chapter);
    return phases.map(function(p) {
      return {
        time: p.time,
        phase: p.phase,
        intensity: p.intensity,
        hpRange: p.hpRange,
        spawnMult: p.spawnMult,
        scrollAccel: p.scrollAccel || 0,
        types: p.types.filter(function(t) { return unlocked.indexOf(t) !== -1; }),
      };
    });
  }

  /**
   * 获取当前时间点的阶段配置
   * @param {number} chapter
   * @param {number} elapsedMs - 章节内经过时间
   */
  static getPhaseAt(chapter, elapsedMs) {
    var timeline = ChapterConfig._getTimeline(chapter);
    var current = timeline[0];
    for (var i = timeline.length - 1; i >= 0; i--) {
      if (elapsedMs >= timeline[i].time) {
        current = timeline[i];
        break;
      }
    }
    return current;
  }
}

module.exports = ChapterConfig;
