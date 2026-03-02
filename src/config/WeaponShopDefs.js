/**
 * WeaponShopDefs.js - 武器外部养成等级定义
 * 30级满，解锁即Lv1
 * 
 * 节奏：
 * - 5的倍数：⭐爽点属性（不加伤害）
 * - 2/10/18：🎰解锁战斗三选一选项
 * - 6/14/22/26/30：🌟解锁永久被动
 * - 其他：📈伤害系数提升
 */

var ShopCurve = require('./ShopCurveConfig');

// ===== 全局暴击伤害曲线 =====
// 每升1级都给暴伤，段越高越多
function getCritBonusPerLevel(lv) {
  var b = ShopCurve.critBonusPerBracket;
  if (lv <= 5) return b[0];
  if (lv <= 10) return b[1];
  if (lv <= 15) return b[2];
  if (lv <= 20) return b[3];
  return b[4];
}

// 累计暴伤：单武器满级=+100%
function getTotalCritBonus(lv) {
  var total = 0;
  for (var i = 1; i <= lv; i++) total += getCritBonusPerLevel(i);
  return total;
}

// ===== 伤害系数成长曲线 =====
// 基于武器初始basePct，5倍数级不加
function getDmgMultPerLevel(lv) {
  var b = ShopCurve.dmgMultPerBracket;
  if (lv <= 5) return b[0];
  if (lv <= 10) return b[1];
  if (lv <= 15) return b[2];
  if (lv <= 20) return b[3];
  return b[4];
}

// 计算某等级的伤害倍率（相对basePct）
function getDmgMultiplier(lv) {
  var mult = 1.0;
  for (var i = 2; i <= lv; i++) {
    if (i % 5 === 0) continue; // 5倍数不加伤害
    mult += getDmgMultPerLevel(i);
  }
  return mult;
}

// ===== 各武器定义 =====
var WEAPON_SHOP = {
  kunai: {
    name: '冰爆弹',
    // 爽点属性：CD缩短
    sweetSpot: { type: 'cd', base: 6000, delta: -600, unit: 'ms' },
    // 商店解锁选项（加入战斗三选一池）
    unlockBranches: {
      2:  'chain',       // 连锁爆炸
      10: 'splitBomb',   // 分裂弹（新分支）
      18: 'giant',       // 巨型弹头
    },
    // 商店被动（永久生效）
    passives: {
      6:  { key: 'countNoPenalty',   name: '弹数不减伤', desc: '弹数分支不再降低每发伤害' },
      14: { key: 'burnExploit',     name: '灼烧引爆', desc: '爆炸对灼烧砖块伤害翻倍' },
      22: { key: 'burnChance',      name: '燃烧弹头', desc: '巨型弹头20%概率灼烧砖块3秒' },
      26: { key: 'pierceNoDecay',   name: '穿透不衰减', desc: '穿透不再降低伤害' },
      30: { key: 'doomBarrage',     name: '末日弹幕', desc: '炮弹发射数×2' },
    },
  },
  lightning: {
    name: '闪电链',
    sweetSpot: { type: 'chains', base: 3, delta: 1, unit: '链' },
    unlockBranches: {
      2:  'paralyze',   // 麻痹
      10: 'storm',      // 雷暴
      18: 'thorGod',    // 雷神降临
    },
    passives: {
      6:  { key: 'shockMark',     name: '感电标记', desc: '被命中砖块受伤+25%' },
      14: { key: 'residualField', name: '残留电场', desc: '链末端留电场(30%伤)持续2秒' },
      22: { key: 'chainNoDecay',  name: '链不衰减', desc: '跳跃不再降低伤害' },
      26: { key: 'dualChain',     name: '双链释放', desc: '同时释放2道闪电' },
      30: { key: 'overload',      name: '超载引爆', desc: '链末端超载爆炸AOE' },
    },
  },
  missile: {
    name: '穿甲弹',
    sweetSpot: { type: 'salvo', base: 1, delta: 1, unit: '发' },
    unlockBranches: {
      2:  'deepPierce',     // 深度贯穿
      10: 'hyperVelocity',  // 超速弹
      18: 'twinCannonAdv',  // 双管炮升级
    },
    passives: {
      6:  { key: 'armorBreak',    name: '碎甲标记', desc: '命中降防10%持续3秒' },
      14: { key: 'pierceNoDecay', name: '穿透不衰减', desc: '穿透不再降低伤害' },
      22: { key: 'pierceBonus',   name: '穿透+3', desc: '基础穿透数额外+3' },
      26: { key: 'shockwaveUp',   name: '冲击波强化', desc: '溅射伤害50%→100%' },
      30: { key: 'doomPierce',    name: '毁灭穿甲', desc: '穿透10个后全列爆炸' },
    },
  },
  meteor: {
    name: '轰炸机',
    sweetSpot: { type: 'cd', base: 12000, delta: -1000, unit: 'ms' },
    unlockBranches: {
      2:  'escort',      // 护航编队
      10: 'incendiary',  // 燃烧风暴
      18: 'b52',         // 战略轰炸
    },
    passives: {
      6:  { key: 'fireBomb',    name: '燃烧弹', desc: '所有炸弹命中留火区2秒' },
      14: { key: 'napalmBelt',  name: '凝固汽油', desc: '火焰区域扩展为带状' },
      22: { key: 'scorchEarth', name: '焦土策略', desc: '火焰区域持续时间×3' },
      26: { key: 'doublePass',  name: '双波次轰炸', desc: '每次出击轰炸机飞1.5遍' },
      30: { key: 'nuke',        name: '核弹', desc: '最后1颗炸弹替换为核弹范围×2伤害×2' },
    },
  },
  drone: {
    name: '战术无人机',
    sweetSpot: { type: 'cd', base: 450, delta: -30, unit: 'ms' },
    unlockBranches: {
      2:  'arc',    // 电弧
      10: 'focus',  // 聚焦
      18: 'pulse',  // 脉冲
    },
    passives: {
      6:  { key: 'shield',      name: '能量护盾', desc: '每15秒给玩家1层护盾' },
      14: { key: 'droneExtra',  name: '增援编队', desc: '额外+1台无人机' },
      22: { key: 'crossfire',   name: '交叉火力', desc: '激光交叉点伤害+30%' },
      26: { key: 'matrixPlus',  name: '矩阵扩展', desc: '无人机上限+2台' },
      30: { key: 'annihilate',  name: '歼灭模式', desc: '激光宽度×1.5' },
    },
  },
  spinBlade: {
    name: '回旋刃',
    sweetSpot: { type: 'duration', base: 10, delta: 0.5, unit: 's' },
    unlockBranches: {
      2:  'bleed',       // 撕裂
      10: 'split',       // 分裂
      18: 'superBlade',  // 超级旋刃
    },
    passives: {
      6:  { key: 'rampUp',      name: '加速旋转', desc: '每存活1秒伤害+10%' },
      14: { key: 'shockSlash',  name: '回旋斩', desc: '弹墙释放环形刀气波' },
      22: { key: 'rebirth',     name: '不灭旋刃', desc: '消失后50%概率重生' },
      26: { key: 'eternal',     name: '永恒之刃', desc: '旋刃不再自动消失' },
      30: { key: 'bladeFury',   name: '刃之狂怒', desc: '蓄势伤害加成上限翻倍' },
    },
  },
  blizzard: {
    name: '白磷弹',
    sweetSpot: { type: 'duration', base: 3, delta: 0.5, unit: 's' },
    unlockBranches: {
      2:  'slow',       // 灼烧
      10: 'shatter',    // 引燃
      18: 'permafrost', // 烈焰
    },
    passives: {
      6:  { key: 'extraCount',  name: '白磷弹+1', desc: '每次多发射1颗' },
      14: { key: 'fireSpread',  name: '火焰蔓延', desc: '燃烧可引燃相邻砖块' },
      22: { key: 'burnBlast',   name: '白磷溅射', desc: '燃烧区结束时爆炸(200%伤害)' },
      26: { key: 'burnBoost',   name: '烈焰强化', desc: '燃烧伤害+50%' },
      30: { key: 'burnExtra',   name: '白磷覆盖', desc: '每次额外+2颗白磷弹' },
    },
  },
  ionBeam: {
    name: '离子射线',
    sweetSpot: { type: 'duration', base: 2, delta: 0.3, unit: 's' },
    unlockBranches: {
      2:  'charge',    // 蓄能
      10: 'superOrb',  // 离子球
      18: 'prism',     // 棱镜阵列（新分支）
    },
    passives: {
      6:  { key: 'overloadMark', name: '过载标记', desc: '叠满3层触发小爆炸' },
      14: { key: 'focusMode',    name: '聚能模式', desc: '持续命中同目标每秒+10%伤' },
      22: { key: 'pierceAll',    name: '穿透射线', desc: '射线穿透所有目标' },
      26: { key: 'splashHit',    name: '分裂溅射', desc: '命中点溅射周围敌人' },
      30: { key: 'doomBeam',     name: '毁灭射线', desc: '持续5秒后贯穿全屏一击' },
    },
  },
  frostStorm: {
    name: '寒冰发生器',
    sweetSpot: { type: 'count', base: 2, delta: 1, unit: '墙' },
    unlockBranches: {
      2:  'stack',      // 叠甲
      10: 'permafrost', // 冰封
      18: 'shatter',    // 碎冰
    },
    passives: {
      6:  { key: 'frostStack',   name: '冰缓强化', desc: '撞墙每次多叠1层冰缓' },
      14: { key: 'frostAura',    name: '寒气场', desc: '冰墙周围80px自动叠冰缓' },
      22: { key: 'permafrostHP', name: '永冻', desc: '冻结期间不消耗冰墙生命' },
      26: { key: 'frostArmor',   name: '寒霜护甲', desc: '碰撞伤害+30%' },
      30: { key: 'absoluteZero', name: '极寒领域', desc: '冰墙周围自动冻结一切' },
    },
  },
  gravityWell: {
    name: '奇点引擎',
    sweetSpot: { type: 'duration', base: 3, delta: 0.5, unit: 's' },
    unlockBranches: {
      2:  'darkMatter',  // 暗物质
      10: 'annihilate',  // 湮灭链
      18: 'lens',        // 引力透镜
    },
    passives: {
      6:  { key: 'siphon',      name: '虹吸', desc: '引力范围内砖块受伤+20%' },
      14: { key: 'singBurst',   name: '奇点爆发', desc: '黑洞结束爆炸累积伤害50%' },
      22: { key: 'gravityX2',   name: '引力倍增', desc: '吸力×2' },
      26: { key: 'binarySystem',name: '双星系统', desc: '同时+1个黑洞' },
      30: { key: 'superHole',   name: '超级黑洞', desc: '持续×2+可吸收弹幕' },
    },
  },
  ship: {
    name: '飞机',
    sweetSpot: { type: 'cd', base: 800, delta: -80, unit: 'ms' },
    unlockBranches: {
      2:  'fireBullet',     // 火焰弹
      10: 'iceBullet',      // 寒冰弹
      18: 'thunderBullet',  // 雷电弹
    },
    passives: {
      6:  { key: 'pierceOne',    name: '穿透+1',   desc: '子弹默认穿透+1' },
      14: { key: 'elemAffinity', name: '元素亲和', desc: '元素弹伤害+30%' },
      22: { key: 'ricochetDmg',  name: '弹射增伤', desc: '每次弹射伤害+20%' },
      26: { key: 'spreadPlus',   name: '散射+1',   desc: '额外+1散射弹道' },
      30: { key: 'overclockEng', name: '超频引擎', desc: '射速额外+50%' },
    },
  },
};

// ===== 辅助函数 =====

// 获取某武器某等级的爽点属性值
function getSweetSpotValue(weaponKey, shopLevel) {
  var def = WEAPON_SHOP[weaponKey];
  if (!def) return null;
  var ss = def.sweetSpot;
  var ticks = Math.floor(shopLevel / 5); // 每5级一次
  return ss.base + ticks * ss.delta;
}

// 获取某武器在某商店等级已解锁的分支key列表
function getUnlockedBranches(weaponKey, shopLevel) {
  var def = WEAPON_SHOP[weaponKey];
  if (!def) return [];
  var result = [];
  var unlocks = def.unlockBranches;
  for (var lv in unlocks) {
    if (shopLevel >= parseInt(lv)) result.push(unlocks[lv]);
  }
  return result;
}

// 获取某武器在某商店等级已解锁的被动key列表
function getUnlockedPassives(weaponKey, shopLevel) {
  var def = WEAPON_SHOP[weaponKey];
  if (!def) return [];
  var result = [];
  var passives = def.passives;
  for (var lv in passives) {
    if (shopLevel >= parseInt(lv)) result.push(passives[lv].key);
  }
  return result;
}

// 检查某分支是否被商店等级门控
function isBranchGated(weaponKey, branchKey) {
  var def = WEAPON_SHOP[weaponKey];
  if (!def) return false;
  var unlocks = def.unlockBranches;
  for (var lv in unlocks) {
    if (unlocks[lv] === branchKey) return true;
  }
  return false;
}

// 检查某分支是否在当前商店等级下已解锁
function isBranchUnlocked(weaponKey, branchKey, shopLevel) {
  var def = WEAPON_SHOP[weaponKey];
  if (!def) return true; // 没有定义=不门控
  var unlocks = def.unlockBranches;
  for (var lv in unlocks) {
    if (unlocks[lv] === branchKey) return shopLevel >= parseInt(lv);
  }
  return true; // 不在解锁列表=默认可用
}


module.exports = {
  WEAPON_SHOP: WEAPON_SHOP,
  getCritBonusPerLevel: getCritBonusPerLevel,
  getTotalCritBonus: getTotalCritBonus,
  getDmgMultPerLevel: getDmgMultPerLevel,
  getDmgMultiplier: getDmgMultiplier,
  getSweetSpotValue: getSweetSpotValue,
  getUnlockedBranches: getUnlockedBranches,
  getUnlockedPassives: getUnlockedPassives,
  isBranchGated: isBranchGated,
  isBranchUnlocked: isBranchUnlocked,
};
