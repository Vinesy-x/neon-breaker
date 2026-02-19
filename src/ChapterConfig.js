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
      hpMultiplier: 1.0 + (chapter - 1) * 0.05,
      scrollSpeed: Math.min(0.35, 0.12 + (chapter - 1) * 0.0023),
      spawnInterval: Math.max(1400, 2500 - (chapter - 1) * 11),
      gapChance: Math.max(0.04, 0.15 - (chapter - 1) * 0.0011),

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
    var phases = [
      { time: 0,      phase: 'warmup',    intensity: 0.3,  hpRange: [1, 1], spawnMult: 0.7, types: ['normal'] },
      { time: 90000,  phase: 'rampup',    intensity: 0.5,  hpRange: [1, 2], spawnMult: 0.9, types: ['normal', 'fast'] },
      { time: 180000, phase: 'breather1', intensity: 0.2,  hpRange: [1, 1], spawnMult: 0.5, types: ['normal'] },
      { time: 210000, phase: 'pressure',  intensity: 0.7,  hpRange: [2, 3], spawnMult: 1.0, types: ['normal', 'fast', 'formation'] },
      { time: 300000, phase: 'breather2', intensity: 0.2,  hpRange: [1, 2], spawnMult: 0.5, types: ['normal'] },
      { time: 330000, phase: 'highpres',  intensity: 0.85, hpRange: [3, 4], spawnMult: 1.2, types: ['normal', 'fast', 'formation', 'shield', 'split'] },
      { time: 420000, phase: 'breather3', intensity: 0.3,  hpRange: [2, 2], spawnMult: 0.5, types: ['normal'] },
      { time: 450000, phase: 'sprint',    intensity: 1.0,  hpRange: [4, 5], spawnMult: 1.4, types: ['normal', 'fast', 'formation', 'shield', 'split', 'stealth', 'healer'] },
      { time: 540000, phase: 'preBoss',   intensity: 0.1,  hpRange: [1, 1], spawnMult: 0.2, types: ['normal'] },
      { time: 570000, phase: 'boss',      intensity: 0,    hpRange: [0, 0], spawnMult: 0,   types: [] },
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
