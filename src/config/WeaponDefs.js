/**
 * WeaponDefs.js - 10大武器升级树定义（v2 外部养成版）
 * 每个武器有独立分支升级，basePct为伤害百分比基准
 */

const B = require('./WeaponBalanceConfig');

const WEAPON_TREES = {
  kunai: {
    name: '寒冰弹', desc: '发射寒冰弹命中爆炸，范围AOE寒冰伤害',
    icon: '💣', color: '#00FFFF', basePct: B.kunai.basePct, interval: B.kunai.interval,
    damageType: B.kunai.damageType,
    branches: {
      damage:      { name: '伤害', desc: '+50%基础伤害', max: 10, requires: null },
      count:       { name: '弹数', desc: '+1发炮弹，每发伤害-20%', max: 3, requires: null },
      aoe:         { name: '爆炸范围', desc: '+30%爆炸半径，弹体变大', max: 3, requires: null },
      pierce:      { name: '穿透', desc: '穿透砖块+1，每穿1个伤害衰减20%', max: 2, requires: null },
      pierceBlast: { name: '穿透爆炸', desc: '每次穿透都爆炸', max: 1, requires: { pierce: 2 } },
      chain:       { name: '连锁爆炸', desc: '击杀砖块爆炸(初始-50%伤害,每级+50%)', max: 2, requires: null, shopGated: true },
      splitBomb:   { name: '分裂弹', desc: '爆炸后产生小寒冰弹(初始2个各25%伤,每级+1)', max: 3, requires: null, shopGated: true },
      giant:       { name: '巨型弹头', desc: '弹体+爆炸范围翻倍', max: 1, requires: null, shopGated: true },
    },
  },
  lightning: {
    name: '闪电链', desc: '自动锁定砖块释放闪电，链式跳跃',
    icon: '⚡', color: '#FFF050', basePct: B.lightning.basePct, interval: B.lightning.interval,
    damageType: B.lightning.damageType,
    branches: {
      damage:   { name: '伤害', desc: '+50%基础伤害', max: 10, requires: null },
      chains:   { name: '链数', desc: '+1跳跃目标', max: 4, requires: null },
      charge:   { name: '蓄能', desc: '每次链跳+25%伤害', max: 2, requires: { chains: 2 } },
      shock:    { name: '感电', desc: '命中留DOT(20%/秒×2秒)', max: 2, requires: { damage: 2 } },
      echo:     { name: '回响', desc: '链末端20%再次释放', max: 2, requires: { chains: 3 } },
      paralyze: { name: '麻痹', desc: '命中减速30%', max: 2, requires: { chains: 2 }, shopGated: true },
      storm:    { name: '雷暴', desc: '同时释放2道闪电', max: 2, requires: null, shopGated: true },
      overload: { name: '超载', desc: '链末端爆炸AOE', max: 1, requires: { chains: 4, damage: 3 }, shopGated: true },
    },
  },
  missile: {
    name: '穿甲弹', desc: '飞机侧翼发射，贯穿整列砖块',
    icon: '🎯', color: '#FF14FF', basePct: B.missile.basePct, interval: B.missile.interval,
    basePierce: B.missile.basePierce, decayRate: B.missile.decayRate,
    branches: {
      damage:        { name: '穿甲强化', desc: '+50%基础伤害，弹体变大', max: 10, requires: null },
      pierce:        { name: '贯穿', desc: '穿透衰减-15%(30%→15%→0%)', max: 2, requires: null },
      salvo:         { name: '连射', desc: '+1发连射(同列间隔200ms)', max: 3, requires: null },
      dotExploit:    { name: '烈性反应', desc: '对有DOT砖块每层+20%伤害', max: 3, requires: { damage: 2 } },
      twinCannon:    { name: '双管炮', desc: '飞机左右侧翼各一管', max: 2, requires: { salvo: 2 } },
      shockwave:     { name: '冲击波', desc: '穿透时横向溅射50%伤害', max: 2, requires: { damage: 2, pierce: 1 } },
      deepPierce:    { name: '深度贯穿', desc: '+3穿透数(5→8→11)', max: 2, requires: null, shopGated: true },
      hyperVelocity: { name: '超速弹', desc: '每穿一个+20%伤害', max: 1, requires: null, shopGated: true },
      twinCannonAdv: { name: '双管独立瞄准', desc: '双管各自瞄准不同列', max: 1, requires: null, shopGated: true },
    },
  },
  frostStorm: {
    name: '寒冰发生器', desc: '生成冰晶屏障阻挡砖块，互相消耗HP完成伤害',
    icon: '❄', color: '#44DDFF', basePct: B.frostStorm.basePct, interval: B.frostStorm.interval,
    branches: {
      damage:    { name: '强化', desc: '+50%冰墙HP', max: 10, requires: null },
      freeze:    { name: '冻结', desc: '撞墙每tick多叠1层冰缓', max: 2, requires: null },
      count:     { name: '数量', desc: '场上+1面墙(2→3→4)', max: 2, requires: null },
      frostArmor:{ name: '寒霜护甲', desc: '撞墙+1冰缓/级,碰撞伤害+30%/级', max: 3, requires: { freeze: 1 } },
      aura:      { name: '寒气场', desc: '冰墙周围80px范围叠冰缓', max: 2, requires: { freeze: 2 } },
      stack:     { name: '叠甲', desc: '叠加上限+1倍,触发冰冻脉冲', max: 2, requires: null, shopGated: true },
      permafrost:{ name: '冰封', desc: '冰缓满5层触发冻结(1s+0.5s/级)', max: 2, requires: null, shopGated: true },
      shatter:   { name: '碎冰', desc: '碎裂时AOE溅射(maxHP×50%)', max: 2, requires: null, shopGated: true },
    },
  },
  meteor: {
    name: '轰炸机', desc: '轰炸机横穿屏幕，沿途投弹地毯轰炸',
    icon: '✈', color: '#FF8800', basePct: B.meteor.basePct, interval: B.meteor.interval,
    baseBombs: B.meteor.baseBombs,
    branches: {
      damage:     { name: '装药强化', desc: '+50%炸弹伤害', max: 10, requires: null },
      bombs:      { name: '载弹量', desc: '+2颗炸弹/次出击', max: 3, requires: null },
      radius:     { name: '爆破范围', desc: '+25%爆炸半径', max: 3, requires: null },
      napalm:     { name: '凝固汽油', desc: '落点留燃烧区域DOT 3秒', max: 2, requires: { damage: 2 } },
      carpet:     { name: '地毯轰炸', desc: '飞行路径变宽上下各多一行', max: 2, requires: { bombs: 2 } },
      escort:     { name: '护航编队', desc: '+1架僚机同时出击', max: 2, requires: null, shopGated: true },
      incendiary: { name: '燃烧风暴', desc: '燃烧区域合并扩大+50%伤害', max: 1, requires: null, shopGated: true },
      b52:        { name: '战略轰炸', desc: '巨型机弹数×2+范围×1.5+屏震', max: 1, requires: null, shopGated: true },
    },
  },
  drone: {
    name: '战术无人机', desc: '无人机布阵，激光网切割砖块',
    icon: '🤖', color: '#50FFB4', basePct: B.drone.basePct, interval: B.drone.interval,
    branches: {
      damage:     { name: '伤害', desc: '+50%激光伤害', max: 10, requires: null },
      count:      { name: '阵列', desc: '+1台(2→3△→4◇→5★)', max: 3, requires: null },
      width:      { name: '光束', desc: '激光变粗+判定+40%', max: 2, requires: { damage: 2 } },
      deploy:     { name: '部署', desc: '阵型半径+25,追踪更准', max: 2, requires: { count: 1 } },
      overcharge: { name: '过载', desc: '阵型中心交叉点伤害×2', max: 1, requires: { count: 2, damage: 3 } },
      arc:        { name: '电弧', desc: '激光线释放电弧扩大范围', max: 2, requires: null, shopGated: true },
      focus:      { name: '聚焦', desc: '对低HP砖额外+80%伤害', max: 2, requires: null, shopGated: true },
      pulse:      { name: '脉冲', desc: '每4秒阵型AOE爆发×4', max: 1, requires: null, shopGated: true },
    },
  },
  spinBlade: {
    name: '回旋刃', desc: '弹墙旋刃，后排持续清扫',
    icon: '🌀', color: '#AA44FF', basePct: B.spinBlade.basePct, interval: B.spinBlade.interval, tickInterval: B.spinBlade.tickInterval,
    branches: {
      damage:    { name: '伤害', desc: '+50%基础伤害', max: 10, requires: null },
      duration:  { name: '续航', desc: '+2秒存在时间', max: 3, requires: null },
      giant:     { name: '巨型化', desc: '旋刃变大+判定范围↑', max: 3, requires: null },
      pierce:    { name: '锋锐', desc: '贯穿伤害+30%', max: 1, requires: { damage: 2 } },
      shockwave: { name: '回旋斩', desc: '弹墙时释放环形刀气波', max: 2, requires: { damage: 2 } },
      ramp:      { name: '蓄势', desc: '存活每秒+12%伤害', max: 3, requires: { duration: 2 } },
      bleed:     { name: '撕裂', desc: '命中留DOT(15%/秒×2秒)', max: 2, requires: null, shopGated: true },
      split:     { name: '分裂', desc: '结束后分裂2个小旋刃', max: 2, requires: null, shopGated: true },
      superBlade:{ name: '超级旋刃', desc: '华丽特效+伤害频率翻倍', max: 1, requires: null, shopGated: true },
    },
  },
  blizzard: {
    name: '白磷弹', desc: '从天而降的白磷弹，落地燃烧引燃周边',
    icon: '☢', color: '#FF8833', basePct: B.blizzard.basePct, interval: B.blizzard.interval,
    branches: {
      damage:      { name: '伤害', desc: '+50%燃烧伤害', max: 10, requires: null },
      radius:      { name: '范围', desc: '+25%燃烧半径', max: 3, requires: null },
      duration:    { name: '持续', desc: '+1.5秒燃烧时间', max: 3, requires: null },
      count:       { name: '弹数', desc: '+1发白磷弹', max: 2, requires: null },
      frostbite:   { name: '腐蚀', desc: '附加持续伤害DOT', max: 2, requires: { damage: 2 } },
      slow:        { name: '灼烧', desc: '砖块下移减速15%', max: 3, requires: null, shopGated: true },
      shatter:     { name: '引燃', desc: '火焰蔓延+结束时爆燃', max: 2, requires: null, shopGated: true },
      permafrost:  { name: '烈焰', desc: '燃烧频率提升', max: 1, requires: null, shopGated: true },
    },
  },
  ionBeam: {
    name: '离子射线', desc: '锁定最强目标持续射击，标记叠加增伤',
    icon: '⊕', color: '#FF4444', basePct: B.ionBeam.basePct, interval: B.ionBeam.interval,
    branches: {
      damage:   { name: '伤害', desc: '+50%射线伤害', max: 10, requires: null },
      duration: { name: '持续', desc: '+1秒射击时间', max: 3, requires: null },
      mark:     { name: '标记', desc: '每次命中+1层，每层+8%伤害', max: 3, requires: { damage: 1 } },
      pierce:   { name: '穿透', desc: '射线穿透打击后方目标', max: 2, requires: { damage: 2 } },
      split:    { name: '分裂', desc: '命中点溅射周围敌人', max: 2, requires: { duration: 1 } },
      overload: { name: '过载', desc: '射击结束时AOE爆炸', max: 2, requires: { damage: 3, duration: 2 } },
      charge:   { name: '蓄能', desc: '首击爆发×(2.5+1.5×等级)', max: 2, requires: null, shopGated: true },
      superOrb: { name: '离子球', desc: '蓄能释放超级离子球', max: 2, requires: null, shopGated: true },
      prism:    { name: '棱镜阵列', desc: '射线分叉为多方向', max: 2, requires: null, shopGated: true },
    },
  },
  gravityWell: {
    name: '奇点引擎', desc: '生成黑洞吸引砖块，累积能量伤害生成负能量砖块触发湮灭',
    icon: '🕳', color: '#AA00FF', basePct: B.gravityWell.basePct, interval: B.gravityWell.interval,
    branches: {
      damage:      { name: '引力强化', desc: '吸力+20%/级，范围+12px/级', max: 10, requires: null },
      horizon:     { name: '事件视界', desc: '每tick额外HP上限×2%/级伤害', max: 2, requires: { damage: 2 } },
      singularity: { name: '奇点', desc: '持续+1.5s/级，中心30px伤害翻倍', max: 2, requires: { horizon: 1 } },
      negaEnergy:  { name: '负能量', desc: '黑洞结束生成负能量砖块转化率+10%/级', max: 3, requires: null },
      count:       { name: '双星系统', desc: '同时+1个黑洞/级', max: 2, requires: null },
      darkMatter:  { name: '暗物质', desc: '负能量体积+30%/级，存活无限', max: 2, requires: null, shopGated: true },
      annihilate:  { name: '湮灭链', desc: '湮灭冲击波溅射范围+20px/级', max: 2, requires: null, shopGated: true },
      lens:        { name: '引力透镜', desc: '范围内能量伤害+12%/级', max: 2, requires: null, shopGated: true },
    },
  },
};

module.exports = WEAPON_TREES;
