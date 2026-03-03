/**
 * ChapterConfig.js - 关卡数值配置
 * 
 * 核心设计：
 * - 25个技能点分给4个武器槽(3武器+飞机)，每武器≈6.25点
 * - 所有关卡共用同一条节奏曲线，差异仅在章节基准HP（跨关卡成长）
 * - 砖块有效HP = baseHP × chapterScale × phaseMult
 * - 关卡内难度跨度 = 1.25^(25/4) ≈ 4x, phaseMult匹配每武器实际成长
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
      scrollSpeed: Math.min(0.4, 0.12 + (chapter - 1) * 0.004),
      spawnInterval: Math.max(1000, 2500 - (chapter - 1) * 18),
      gapChance: Math.max(0.02, 0.12 - (chapter - 1) * 0.0015),

      // Boss：HP = baseHP × chapterScale × bossMultiplier
      // bossMultiplier 设计为"满级玩家DPS × 45秒击杀时间"等效
      bossType: ['charger', 'guardian', 'summoner', 'laser', 'phantom'][(chapter - 1) % 5],
      bossHpMultiplier: 4.0 * 45,  // ≈ 182，满级DPS(~4x)打45秒
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
   * phaseMult = 1.25 ^ (等效总技能点/4个武器槽)
   * 12分钟关卡 = 玩家25个技能点分4个武器，每武器成长~4x
   * 
   * 设计原则：
   * - 难度曲线匹配玩家升级节奏
   * - breather阶段回退到低于当前玩家等级，制造"变强感"
   * - sprint阶段略超玩家等级，制造紧迫感
   * - boss前回退，给玩家信心
   */
  static _getTimeline(chapter) {
    var n = 1.25;  // 每技能点倍率

    var phases = [
      // 12分钟关卡节奏 (720s)
      // phaseMult: 砖块HP倍率（相对warmup）
      // 等效pts: 匹配玩家在该时间点大约获得的技能点数
      { time: 0,      phase: 'warmup',    intensity: 0.3,  phaseMult: 1.0,                 spawnMult: 0.7,  types: ['normal'],
        scrollAccel: 0.002 },                                                   // pts≈0

      { time: 30000,  phase: 'wave1',     intensity: 0.5,  phaseMult: Math.pow(n, 5/4),      spawnMult: 0.9,  types: ['normal', 'fast'],
        scrollAccel: 0.003 },                                                   // pts≈5, ×1.32

      { time: 80000,  phase: 'surge1',    intensity: 0.7,  phaseMult: Math.pow(n, 9/4),      spawnMult: 1.0,  types: ['normal', 'fast', 'formation'],
        scrollAccel: 0.003 },                                                   // pts≈9, ×1.65

      { time: 130000, phase: 'breather1', intensity: 0.35, phaseMult: Math.pow(n, 7/4),      spawnMult: 0.6,  types: ['normal'],
        scrollAccel: 0 },                                                       // pts≈7, ×1.48 (回退)

      { time: 150000, phase: 'wave2',     intensity: 0.8,  phaseMult: Math.pow(n, 13/4),     spawnMult: 1.1,  types: ['normal', 'fast', 'formation', 'shield', 'split'],
        scrollAccel: 0.004 },                                                   // pts≈13, ×2.07

      { time: 220000, phase: 'highpres',  intensity: 0.9,  phaseMult: Math.pow(n, 17/4),     spawnMult: 1.2,  types: ['normal', 'fast', 'formation', 'shield', 'split'],
        scrollAccel: 0.004 },                                                   // pts≈17, ×2.58

      { time: 290000, phase: 'breather2', intensity: 0.35, phaseMult: Math.pow(n, 12/4),     spawnMult: 0.5,  types: ['normal'],
        scrollAccel: 0 },                                                       // pts≈12, ×1.95 (回退)

      { time: 320000, phase: 'wave3',     intensity: 0.9,  phaseMult: Math.pow(n, 20/4),     spawnMult: 1.3,  types: ['normal', 'fast', 'formation', 'shield', 'split', 'stealth'],
        scrollAccel: 0.005 },                                                   // pts≈20, ×3.05

      { time: 400000, phase: 'sprint',    intensity: 1.0,  phaseMult: Math.pow(n, 23/4),     spawnMult: 1.5,  types: ['normal', 'fast', 'formation', 'shield', 'split', 'stealth', 'healer'],
        scrollAccel: 0.005 },                                                   // pts≈23, ×3.61

      { time: 560000, phase: 'breather3', intensity: 0.3,  phaseMult: Math.pow(n, 18/4),     spawnMult: 0.4,  types: ['normal'],
        scrollAccel: 0 },                                                       // pts≈18, ×2.73 (boss前放松)

      { time: 620000, phase: 'preBoss',   intensity: 0.1,  phaseMult: Math.pow(n, 20/4),     spawnMult: 0.3,  types: ['normal'],
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
