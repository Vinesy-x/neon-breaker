/**
 * ChapterConfig.js - 关卡数值配置
 * 
 * 核心设计：
 * - 25个技能点偏向2-3个主力武器，等效÷3，跨度~6.4x
 * - 所有关卡共用同一条节奏曲线，差异仅在章节基准HP（跨关卡成长）
 * - 砖块有效HP = baseHP × chapterScale × phaseMult
 * - 关卡内难度跨度 ≈ 10x DHP (砖块HP×生成速度)
 */

class ChapterConfig {
  /**
   * 获取某章节的完整配置
   * @param {number} chapter - 章节号 (1~100)
   */
  static get(chapter) {
    // 章节基准HP：跨关卡的商店养成差异
    var baseHP = 1 + (chapter - 1) * 0.3;
    var chapterScale = 1.0 + (chapter - 1) * 0.04;

    return {
      chapter: chapter,
      baseHP: baseHP,
      chapterScale: chapterScale,

      // 关卡内固定参数
      scrollSpeed: Math.min(0.4, 0.096 + (chapter - 1) * 0.004),
      spawnInterval: Math.max(1000, 2500 - (chapter - 1) * 18),
      gapChance: Math.max(0.02, 0.12 - (chapter - 1) * 0.0015),

      // Boss：HP = baseHP × chapterScale × bossMultiplier
      // bossMultiplier 设计为"满级玩家DPS × 45秒击杀时间"等效
      bossType: ['charger', 'guardian', 'summoner', 'laser', 'phantom'][(chapter - 1) % 5],
      bossHpMultiplier: 15 * 45,  // ≈ 182，满级DPS(~4x)打45秒
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
   * 难度节奏时间线（所有关卡共用）
   * 
   * phaseMult = 手工标定的难度倍率 (总跨度16x)
   * 开局1个输出源→结束4个输出源，每个成长4x → 总跨度16x
   * 
   * 设计原则：
   * - 难度曲线匹配玩家升级节奏
   * - breather阶段回退到低于当前玩家等级，制造"变强感"
   * - sprint阶段略超玩家等级，制造紧迫感
   * - boss前回退，给玩家信心
   */
  static _getTimeline(chapter) {

    var phases = [
      // 12分钟关卡节奏 (720s)
      // phaseMult: 砖块HP倍率（相对warmup）
      // 等效pts: 匹配玩家在该时间点大约获得的技能点数
      { time: 0,      phase: 'warmup',    intensity: 0.3,  phaseMult: 1.0,                 spawnMult: 0.7,  types: ['normal'],
        scrollAccel: 0.002 },                                                   // pts≈0

      { time: 30000,  phase: 'wave1',     intensity: 0.5,  phaseMult: 1.1,      spawnMult: 1.15,  types: ['normal', 'fast'],
        scrollAccel: 0.003 },                                                   // pts≈5, ×1.32

      { time: 80000,  phase: 'surge1',    intensity: 0.7,  phaseMult: 1.4,      spawnMult: 1.5,  types: ['normal', 'fast', 'formation'],
        scrollAccel: 0.003 },                                                   // pts≈9, ×1.65

      { time: 130000, phase: 'breather1', intensity: 0.35, phaseMult: 1.7,      spawnMult: 0.62,  types: ['normal'],
        scrollAccel: 0 },                                                       // pts≈7, ×1.48 (回退)

      { time: 150000, phase: 'wave2',     intensity: 0.8,  phaseMult: 1.8,     spawnMult: 1.94,  types: ['normal', 'fast', 'formation', 'shield', 'split'],
        scrollAccel: 0.004 },                                                   // pts≈13, ×2.07

      { time: 220000, phase: 'highpres',  intensity: 0.9,  phaseMult: 2.4,     spawnMult: 2.19,  types: ['normal', 'fast', 'formation', 'shield', 'split'],
        scrollAccel: 0.004 },                                                   // pts≈17, ×2.58

      { time: 290000, phase: 'breather2', intensity: 0.35, phaseMult: 3.1,     spawnMult: 0.45,  types: ['normal'],
        scrollAccel: 0 },                                                       // pts≈12, ×1.95 (回退)

      { time: 320000, phase: 'wave3',     intensity: 0.9,  phaseMult: 3.5,     spawnMult: 1.8,  types: ['normal', 'fast', 'formation', 'shield', 'split', 'stealth'],
        scrollAccel: 0.005 },                                                   // pts≈20, ×3.05

      { time: 400000, phase: 'sprint',    intensity: 1.0,  phaseMult: 4.8,     spawnMult: 1.75,  types: ['normal', 'fast', 'formation', 'shield', 'split', 'stealth', 'healer'],
        scrollAccel: 0.005 },                                                   // pts≈23, ×3.61

      { time: 560000, phase: 'breather3', intensity: 0.3,  phaseMult: 9.0,     spawnMult: 0.23,  types: ['normal'],
        scrollAccel: 0 },                                                       // pts≈18, ×2.73 (boss前放松)

      { time: 620000, phase: 'preBoss',   intensity: 0.1,  phaseMult: 11.4,     spawnMult: 0.18,  types: ['normal'],
        scrollAccel: 0 },                                                       // pts≈20, ×3.05

      { time: 690000, phase: 'boss',      intensity: 0,    phaseMult: 0,                   spawnMult: 0,    types: [],
        scrollAccel: 0 },
    ];

    // 过滤掉该章节未解锁的砖块类型
    var unlocked = ChapterConfig._getBrickTypes(chapter);
    return phases.map(function(p) {
      return {
        time: p.time,
        phase: p.phase,
        intensity: p.intensity,
        phaseMult: p.phaseMult,
        spawnMult: p.spawnMult,
        scrollAccel: p.scrollAccel || 0,
        types: p.types.filter(function(t) { return unlocked.indexOf(t) !== -1; }),
      };
    });
  }

  /**
   * 获取当前时间点的阶段配置
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
