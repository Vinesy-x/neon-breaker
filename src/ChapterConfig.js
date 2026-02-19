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
      // 0~30秒：短暂热身，但已经有节奏感
      { time: 0,      phase: 'warmup',    intensity: 0.4,  hpRange: [1, 1], spawnMult: 0.8,  types: ['normal'],
        scrollAccel: 0.002 }, // 每秒scrollSpeed += scrollAccel
      // 30~80秒：第一波压力，fast砖登场，HP开始爬升
      { time: 30000,  phase: 'wave1',     intensity: 0.55, hpRange: [1, 2], spawnMult: 1.0,  types: ['normal', 'fast'],
        scrollAccel: 0.003 },
      // 80~120秒：第一波高潮，阵型砖登场，密度增加
      { time: 80000,  phase: 'surge1',    intensity: 0.7,  hpRange: [2, 3], spawnMult: 1.2,  types: ['normal', 'fast', 'formation'],
        scrollAccel: 0.002 },
      // 120~140秒：短喘息（20秒），让玩家享受清场爽感
      { time: 120000, phase: 'breather1', intensity: 0.3,  hpRange: [1, 2], spawnMult: 0.6,  types: ['normal'],
        scrollAccel: 0 },
      // 140~200秒：第二波压力，护盾+分裂砖登场，HP更高
      { time: 140000, phase: 'wave2',     intensity: 0.75, hpRange: [2, 4], spawnMult: 1.2,  types: ['normal', 'fast', 'formation', 'shield', 'split'],
        scrollAccel: 0.003 },
      // 200~260秒：高压期，砖块HP和密度大幅上升
      { time: 200000, phase: 'highpres',  intensity: 0.9,  hpRange: [3, 5], spawnMult: 1.4,  types: ['normal', 'fast', 'formation', 'shield', 'split'],
        scrollAccel: 0.003 },
      // 260~280秒：第二次喘息
      { time: 260000, phase: 'breather2', intensity: 0.35, hpRange: [2, 2], spawnMult: 0.5,  types: ['normal'],
        scrollAccel: 0 },
      // 280~360秒：第三波，全种类砖块，密度继续爬升
      { time: 280000, phase: 'wave3',     intensity: 0.85, hpRange: [3, 5], spawnMult: 1.3,  types: ['normal', 'fast', 'formation', 'shield', 'split', 'stealth'],
        scrollAccel: 0.004 },
      // 360~430秒：极限冲刺，最高难度
      { time: 360000, phase: 'sprint',    intensity: 1.0,  hpRange: [4, 6], spawnMult: 1.6,  types: ['normal', 'fast', 'formation', 'shield', 'split', 'stealth', 'healer'],
        scrollAccel: 0.004 },
      // 430~450秒：最后喘息
      { time: 430000, phase: 'breather3', intensity: 0.3,  hpRange: [2, 3], spawnMult: 0.4,  types: ['normal'],
        scrollAccel: 0 },
      // 450~480秒：Boss预热（清场阶段）
      { time: 450000, phase: 'preBoss',   intensity: 0.1,  hpRange: [1, 1], spawnMult: 0.2,  types: ['normal'],
        scrollAccel: 0 },
      // 480秒：Boss战
      { time: 480000, phase: 'boss',      intensity: 0,    hpRange: [0, 0], spawnMult: 0,    types: [],
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
