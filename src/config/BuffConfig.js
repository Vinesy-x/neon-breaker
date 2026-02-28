/**
 * BuffConfig.js - 通用Buff系统配置
 * 
 * 所有buff数值集中管理，武器只负责触发，不关心具体效果
 * v1.0 2026-02-28
 */

const BuffConfig = {

  // ===== 🔥 灼烧 (burn) =====
  burn: {
    maxStacks: 10,              // 最大叠加层数
    tickInterval: 1000,         // 判定间隔(ms)：每秒1次
    damagePerStack: 0.01,       // 每层伤害：当前生命的1%
    decayInterval: 2000,        // 每2秒减1层
    decayAmount: 1,             // 每次减少层数
    bossReduction: 0.80,        // Boss每层灼烧伤害降为0.2%当前生命（1% × (1-0.8)）
  },

  // ===== ❄ 冰缓 (chill) =====
  chill: {
    maxStacks: 5,               // 最大叠加层数
    slowPerStack: 0.10,         // 每层减速10%
    decayInterval: 2000,        // 每2秒减1层
    decayAmount: 1,             // 每次减少层数
    // 满层触发冻结
    freezeOnMax: true,          // 达到maxStacks后转化为冻结
    clearOnFreeze: true,        // 冻结时清除冰缓层数
  },

  // ===== 🧊 冻结 (freeze) =====
  freeze: {
    duration: 3000,             // 冻结持续时间(ms)
    iceDamageBonus: 0.50,       // 冻结中受寒冰伤害+50%
    immuneDuringFreeze: true,   // 冻结过程中无法触发新的冻结
    // Boss专属衰减
    bossDecayPerFreeze: 0.20,   // Boss每次冻结后持续时间衰减20%
                                // 第1次3s → 第2次2.4s → 第3次1.92s → ...
  },

  // ===== ⚡ 感电 (shock) =====
  shock: {
    maxStacks: 5,               // 最大叠加层数
    decayInterval: 2000,        // 每2秒减1层
    decayAmount: 1,             // 每次减少层数
    // 电弧触发
    arcChancePerStack: 0.10,    // 每层10%概率（受到能量伤害时判定）
    arcDamageRatio: 0.20,       // 电弧伤害 = 触发伤害的20%
    arcDamageType: 'energy',    // 电弧伤害类型
    arcTargets: 1,              // 电弧目标数（周围随机1块）
    arcRange: 100,              // 电弧搜索范围(px)
    // 电弧连锁感电
    arcShockChance: 0.10,       // 电弧命中后10%概率叠加1层感电
    arcShockStacks: 1,          // 连锁叠加层数
  },
};

module.exports = BuffConfig;
