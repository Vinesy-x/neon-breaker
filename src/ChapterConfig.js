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
    // ===== 四层正交数值公式 =====
    // 最终HP = ceil( baseHP × timeCurve × typeMult × formationMult )
    //
    // 第一层：章节基准HP（难度跨度×2）
    // 第一层：章节基准HP（平缓增长，前期差距小）
    var baseHP = 1 + (chapter - 1) * 0.3;  // ch1=1, ch2=1.3, ch5=2.2, ch10=3.7, ch50=15.7, ch100=30.7
    // 章节缩放（额外乘数，拉开高章节差距）
    var chapterScale = 1.0 + (chapter - 1) * 0.04;  // ch1=1.0, ch2=1.04, ch10=1.36, ch50=2.96, ch100=4.96

    return {
      chapter: chapter,

      // ===== 第一层：章节难度（跨度×2） =====
      baseHP: baseHP,
      chapterScale: chapterScale,
      scrollSpeed: Math.min(0.4, 0.12 + (chapter - 1) * 0.004),  // ch100=0.4 (降速：起步0.12, 上限0.4)
      spawnInterval: Math.max(1000, 2500 - (chapter - 1) * 18),  // ch100=1000 (降频：起步2500, 下限1000)
      gapChance: Math.max(0.02, 0.12 - (chapter - 1) * 0.0015),  // ch100=0.02

      // Boss（跨度×2）
      bossType: ['charger', 'guardian', 'summoner', 'laser', 'phantom'][(chapter - 1) % 5],
      bossHpMultiplier: 1.0 + (chapter - 1) * 0.5,  // ch1=1.0, ch50=25.5, ch100=50.5
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
   * 返回数组：[{ time, phase, intensity, timeCurve, spawnMult, scrollAccel, types }]
   */
  static _getTimeline(chapter) {
    // v7.0: 更陡峭的难度曲线，压缩时间+拉高数值
    var phases = [
      { time: 0,      phase: 'warmup',    intensity: 0.3,  timeCurve: [0.8, 1.0],  spawnMult: 0.7,  types: ['normal'],
        scrollAccel: 0.002 },
      { time: 20000,  phase: 'wave1',     intensity: 0.5,  timeCurve: [1.2, 1.8],  spawnMult: 0.9,  types: ['normal', 'fast'],
        scrollAccel: 0.003 },
      { time: 55000,  phase: 'surge1',    intensity: 0.7,  timeCurve: [2.5, 4.0],  spawnMult: 1.2,  types: ['normal', 'fast', 'formation'],
        scrollAccel: 0.003 },
      { time: 85000,  phase: 'breather1', intensity: 0.35, timeCurve: [1.5, 2.5],  spawnMult: 0.6,  types: ['normal'],
        scrollAccel: 0 },
      { time: 100000, phase: 'wave2',     intensity: 0.8,  timeCurve: [4.0, 6.0],  spawnMult: 1.4,  types: ['normal', 'fast', 'formation', 'shield', 'split'],
        scrollAccel: 0.004 },
      { time: 145000, phase: 'highpres',  intensity: 0.9,  timeCurve: [6.0, 8.0],  spawnMult: 1.6,  types: ['normal', 'fast', 'formation', 'shield', 'split'],
        scrollAccel: 0.004 },
      { time: 190000, phase: 'breather2', intensity: 0.35, timeCurve: [3.5, 4.5],  spawnMult: 0.5,  types: ['normal'],
        scrollAccel: 0 },
      { time: 210000, phase: 'wave3',     intensity: 0.9,  timeCurve: [7.0, 10.0], spawnMult: 1.8,  types: ['normal', 'fast', 'formation', 'shield', 'split', 'stealth'],
        scrollAccel: 0.005 },
      { time: 260000, phase: 'sprint',    intensity: 1.0,  timeCurve: [9.0, 13.0], spawnMult: 2.2,  types: ['normal', 'fast', 'formation', 'shield', 'split', 'stealth', 'healer'],
        scrollAccel: 0.005 },
      { time: 380000, phase: 'breather3', intensity: 0.3,  timeCurve: [4.5, 5.5],  spawnMult: 0.4,  types: ['normal'],
        scrollAccel: 0 },
      { time: 420000, phase: 'preBoss',   intensity: 0.1,  timeCurve: [2.0, 3.0],  spawnMult: 0.3,  types: ['normal'],
        scrollAccel: 0 },
      { time: 480000, phase: 'boss',      intensity: 0,    timeCurve: [0, 0],      spawnMult: 0,    types: [],
        scrollAccel: 0 },
    ];

    // 过滤掉该章节未解锁的砖块类型
    var unlocked = ChapterConfig._getBrickTypes(chapter);
    return phases.map(function(p) {
      return {
        time: p.time,
        phase: p.phase,
        intensity: p.intensity,
        timeCurve: p.timeCurve,
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
