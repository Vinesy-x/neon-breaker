/**
 * WeaponBalanceConfig.js - 武器数值平衡配置表
 * 纯数据，无逻辑代码。数值人员只需修改此文件即可调整武器平衡。
 * 
 * 范围单位：以列宽(~53px)为1，如 aoeRadius: 1.5 表示1.5列宽
 * 字段说明：
 * - basePct: 基础伤害百分比（相对 baseAttack）
 * - interval: 攻击间隔(ms)
 * - branchDmgScale: 伤害分支每级增伤倍率（0.5 = +50%/级）
 * - 其他字段为武器专属参数
 */

module.exports = {
  // ===== 冰爆弹 =====
  kunai: {
    basePct: 5,
    interval: 6000,
    damageType: 'ice',
    aoeRadius: 1.1,              // AOE半径(列宽单位)，1.2列≈64px
    branchDmgScale: 0.5,         // 伤害分支每级+50%
    countPenalty: 0.2,            // 多弹时每发伤害-20%
    aoeRadiusScale: 0.3,         // 爆炸范围分支每级+30%
    pierceDecay: 0.2,            // 穿透衰减20%
    chainDmgBase: -0.5,          // 连锁初始-50%伤害
    chainDmgPerLv: 0.5,          // 连锁每级+50%
    splitBombCount: 2,            // 分裂弹初始2个
    splitBombCountPerLv: 1,       // 每级+1
    splitBombDmgPct: 0.18,        // 分裂弹伤害25%
    trailFadeRate: 0.06,          // 拖尾衰减
    trailInterval: 40,            // 拖尾间隔(ms)
    tickInterval: 50,             // 碰撞检测间隔(ms)
  },

  // ===== 闪电链 =====
  lightning: {
    basePct: 5.0,
    interval: 3800,
    damageType: 'lightning',
    branchDmgScale: 0.5,
    baseChains: 3,                // 基础链数
    chainsPerLv: 1,               // 每级+1链
    chargeScale: 0.25,            // 蓄能每跳+25%伤害
    shockDotPct: 0.2,             // 感电DOT 20%/秒
    shockDotDuration: 2000,       // 感电持续2秒
    echoChance: 0.2,              // 回响概率20%
    paralyzeSlowPct: 0.3,         // 麻痹减速30%
    chainDecayBase: 0.15,         // 链跳衰减15%
    boltFadeRate: 0.025,          // 闪电消散速度
    explosionFadeRate: 0.05,      // 爆炸消散速度
    thorInterval: 60000,          // 雷神降临间隔(ms)
  },

  // ===== 穿甲弹 =====
  missile: {
    basePct: 32,
    interval: 4500,
    damageType: 'physical',
    branchDmgScale: 0.5,
    basePierce: 8,                // 基础穿透数
    decayRate: 0.08,              // 穿透衰减率
    deepPiercePerLv: 3,           // 深度贯穿每级+3穿
    hyperVelocityScale: 0.2,     // 超速弹每穿+20%伤害
    salvoDelay: 200,              // 连射间隔(ms)
    dotExploitScale: 0.25,        // 烈性反应每种异常状态+25%
    shockwavePct: 0.3,            // 冲击波溅射50%→被动后100%
    shockwaveUpPct: 1.0,          // 冲击波强化后溅射100%
    shatterMarkDuration: 3000,    // 碎甲标记持续3秒
    shatterBonus: 0.25,           // 碎甲增伤25%
    doomPierceThreshold: 10,      // 毁灭穿甲触发穿透数
  },

  // ===== 寒冰发生器 =====
  frostStorm: {
    basePct: 12.0,
    interval: 10000,
    damageType: 'ice',
    branchDmgScale: 0.5,         // 强化每级+50% HP
    maxWallsBase: 2,              // 基础冰墙数
    wallHeight: 22,               // 冰墙高度(px)
    stackLimitBase: 3,            // 基础叠加倍数上限
    auraRange: 80,                // 寒气场范围(px)
    auraTick: 500,                // 寒气场tick间隔(ms)
    regenCooldown: 1500,          // 被撞后回血冷却(ms)
    regenInterval: 1000,          // 回血间隔(ms)
    frostArmorDmgScale: 0.3,     // 寒霜护甲碰撞伤害+30%/级
    shatterAoePct: 0.5,           // 碎冰溅射 maxHP×50%
    permaFrostDuration: 1000,     // 冰封基础持续(ms)
    permaFrostPerLv: 500,         // 冰封每级+500ms
    iceSlowPerStack: 0.1,         // 每层冰缓减速10%
    maxIceStacks: 5,              // 冰缓最大层数
  },

  // ===== 轰炸机 =====
  meteor: {
    basePct: 12,
    interval: 12000,
    damageType: 'fire',
    branchDmgScale: 0.5,
    baseBombs: 4,                 // 基础载弹量
    bombsPerLv: 2,                // 每级+2
    baseRadius: 28,               // 基础爆炸半径(px)
    radiusScale: 0.25,            // 范围分支每级+25%
    napalmDuration: 2000,         // 凝固汽油区域持续(ms)
    carpetDmgPct: 0.7,            // 地毯轰炸伤害比例
    carpetRadiusPct: 0.8,         // 地毯轰炸半径比例
    bombGravity: 0.6,             // 炸弹下落加速度
    explosionRadiusPct: 0.6,      // 爆炸视觉半径比例
    fireBombDuration: 2000,       // 燃烧弹火区持续(ms)
    scorchEarthMult: 3,           // 焦土策略持续×3
    fireDmgPct: 0.2,              // 火区tick伤害比例
    b52SizeMult: 1.5,             // B52范围×1.5
    b52DmgMult: 2,                // B52弹数×2
  },

  // ===== 战术无人机 =====
  drone: {
    basePct: 1.0,
    interval: 500,
    damageType: 'energy',
    branchDmgScale: 0.5,
    baseDrones: 2,                // 基础无人机数
    dronesPerLv: 1,               // 每级+1
    laserWidthScale: 0.4,         // 光束分支每级+40%判定
    deployRadiusBonus: 25,        // 部署分支每级半径+25
    overchargeMulti: 2,           // 过载交叉点伤害×2
    arcRangeBonus: 20,            // 电弧扩展范围
    focusLowHpBonus: 0.8,         // 聚焦低HP+80%
    pulseCycleSec: 4,             // 脉冲周期(s)
    pulseMulti: 4,                // 脉冲倍率×4
    maxSpeed: 1.2,                // 无人机移动速度
    tickInterval: 300,            // 激光tick间隔(ms)
    shieldInterval: 15000,        // 护盾刷新间隔(ms)
    maxShield: 3,                 // 护盾上限
    deployY: 0.3,                 // 初始Y位置比例
  },

  // ===== 回旋刃 =====
  spinBlade: {
    basePct: 11.0,
    interval: 10000,
    damageType: 'physical',
    branchDmgScale: 0.5,
    tickInterval: 200,            // 伤害tick间隔(ms)
    baseSize: 20,                 // 基础尺寸(px)
    giantSizePerLv: 10,           // 巨型化每级+10px
    durationPerLv: 2000,          // 续航每级+2秒
    pierceDmgScale: 0.3,          // 锋锐贯穿+30%
    rampPerSec: 0.12,             // 蓄势每秒+12%
    bleedDotPct: 0.15,            // 撕裂DOT 15%/秒
    bleedDuration: 2000,          // 撕裂持续2秒
    splitCount: 2,                // 分裂小旋刃数
    bounceBottomPct: 0.88,        // 反弹底部比例
    spinSpeed: 0.25,              // 旋转速度
    lingerSpinSpeed: 0.2,         // 停留旋转速度
    steerX: 0.03,                 // X方向操控力
    steerY: 0.015,                // Y方向操控力
    maxVy: 0.6,                   // 最大Y速度
    minVx: 0.8,                   // 最小X速度
  },

  // ===== 白磷弹 =====
  blizzard: {
    basePct: 4.5,
    interval: 8000,
    damageType: 'fire',
    branchDmgScale: 0.5,
    baseRadius: 30,               // 基础燃烧半径(px)
    radiusScale: 0.25,            // 范围分支每级+25%
    baseDuration: 3000,           // 基础燃烧时间(ms)
    durationPerLv: 1500,          // 每级+1.5秒
    bombGravity: 0.5,             // 下坠加速度
    trailInterval: 60,            // 拖尾间隔(ms)
    sparkInterval: 150,           // 火花间隔(ms)
    spreadInterval: 1500,         // 蔓延间隔(ms)
    spreadDmgPct: 0.5,            // 蔓延伤害50%
    slowPct: 0.15,                // 灼烧减速15%
  },

  // ===== 离子射线 =====
  ionBeam: {
    basePct: 75.0,
    interval: 7000,
    damageType: 'energy',
    branchDmgScale: 0.7,         // 伤害分支+70%/级（比其他高）
    baseBeamSec: 2,               // 基础射击时间(s)
    durationPerLv: 1000,          // 每级+1秒
    markDmgScale: 0.08,           // 标记每层+8%伤害
    pierceDmgDecay: 0.3,          // 穿透伤害衰减30%
    splitRange: 50,               // 溅射范围(px)
    splitDmgPct: 0.3,             // 溅射伤害比例
    overloadBase: 4,              // 过载基础倍率
    overloadPerLv: 3,             // 过载每级+倍率
    overloadEndBase: 6,           // 结束过载基础倍率
    overloadEndPerLv: 5,          // 结束过载每级+倍率
    chargeBurstBase: 2.5,         // 蓄能首击基础倍率
    chargeBurstPerLv: 1.5,        // 蓄能每级+倍率
    superOrbDmgMult: 30,          // 超级离子球倍率
    sparkFadeRate: 0.04,          // 火花衰减速度
  },

  // ===== 奇点引擎 =====
  gravityWell: {
    basePct: 12.0,
    interval: 14000,
    damageType: 'energy',
    branchDmgScale: 0.2,         // 引力强化每级+20%吸力
    radiusPerLv: 12,              // 每级范围+12px
    baseRadius: 120,              // 基础吸引半径(px)
    baseDuration: 5000,           // 基础持续时间(ms)
    basePull: 0.4,                // 基础吸力
    tickInterval: 400,            // 伤害tick间隔(ms)
    minInterval: 3000,            // 最小冷却(ms)
    negaBaseRate: 0.04,           // 负能量基础转化率
    negaLifetime: 15000,          // 负能量存活时间(ms)
    negaPerLvRate: 0.1,           // 负能量每级+10%
    negaBrickSize: 1.5,           // 负能量砖块大小倍率
    pctHpCapMult: 8,              // %HP伤害上限倍率
    horizonPctPerLv: 0.02,        // 事件视界每级+2% maxHP/tick
    singularityDurationPerLv: 1500, // 奇点每级+1.5秒
    singularityCenterMult: 2,     // 中心30px伤害翻倍
    darkMatterSizePerLv: 0.3,     // 暗物质体积+30%/级
    annihilateRangePerLv: 20,     // 湮灭冲击波+20px/级
    lensEnergyPerLv: 0.12,        // 引力透镜+12%/级
  },
};
