/**
 * WeaponDefs.js - 6大武器升级树定义
 * 每个武器有独立分支升级，basePct为伤害百分比基准
 */

const WEAPON_TREES = {
  kunai: {
    name: '光能迫击炮', desc: '发射炮弹命中爆炸，范围AOE伤害',
    icon: '💣', color: '#00FFFF', basePct: 1.2, interval: 1800,
    branches: {
      damage:      { name: '伤害', desc: '+50%基础伤害', max: 5, requires: null },
      count:       { name: '弹数', desc: '+1发炮弹', max: 3, requires: null },
      aoe:         { name: '爆炸范围', desc: '+25%爆炸半径，弹体变大', max: 3, requires: null },
      speed:       { name: '冷却缩减', desc: '-20%技能CD', max: 3, requires: null },
      pierce:      { name: '穿透', desc: '穿透砖块，最后一击爆炸', max: 2, requires: { count: 2 } },
      pierceBlast: { name: '穿透爆炸', desc: '每次穿透都爆炸', max: 1, requires: { pierce: 2 } },
      homing:      { name: '制导', desc: '炮弹追踪最近砖块', max: 2, requires: { speed: 2 } },
      chain:       { name: '连锁爆炸', desc: '被击杀砖块也会爆炸', max: 2, requires: { aoe: 2, damage: 2 } },
      giant:       { name: '巨型弹头', desc: '弹体+爆炸范围翻倍', max: 1, requires: { aoe: 3, pierce: 2 } },
    },
  },
  lightning: {
    name: '闪电链', desc: '自动锁定砖块释放闪电',
    icon: '⚡', color: '#FFF050', basePct: 2.0, interval: 1800,
    branches: {
      damage:   { name: '伤害', desc: '+50%基础伤害', max: 5, requires: null },
      chains:   { name: '链数', desc: '+1跳跃目标', max: 4, requires: null },
      freq:     { name: '频率', desc: '-20%冷却', max: 3, requires: null },
      paralyze: { name: '麻痹', desc: '命中减速30%', max: 2, requires: { chains: 2 } },
      storm:    { name: '雷暴', desc: '同时释放2道闪电', max: 2, requires: { freq: 2 } },
      charge:   { name: '蓄能', desc: '每次链跳+25%伤害', max: 2, requires: { chains: 2 } },
      shock:    { name: '感电', desc: '命中留DOT(30%/秒×2秒)', max: 2, requires: { damage: 2 } },
      echo:     { name: '回响', desc: '链末端20%再次释放', max: 2, requires: { chains: 3 } },
      overload: { name: '超载', desc: '链末端爆炸AOE', max: 1, requires: { chains: 4, damage: 3 } },
    },
  },
  missile: {
    name: '追踪导弹', desc: '自动追踪砖块的导弹',
    icon: '🚀', color: '#FF14FF', basePct: 1.5, interval: 3500,
    branches: {
      damage:     { name: '直击伤害', desc: '+50%直击伤害', max: 4, requires: null },
      blastPower: { name: '爆炸伤害', desc: '+50%爆炸伤害', max: 4, requires: null },
      count:      { name: '数量', desc: '+1发导弹', max: 3, requires: null },
      aoe:        { name: '爆炸范围', desc: '+25%AOE', max: 3, requires: null },
      tracking:   { name: '追踪性能', desc: '+30%转向', max: 2, requires: null },
      split:      { name: '分裂弹', desc: '命中后分裂3小弹', max: 2, requires: { count: 2 } },
      nuke:       { name: '核弹头', desc: '巨型爆炸+屏震', max: 1, requires: { aoe: 3, blastPower: 3 } },
    },
  },
  meteor: {
    name: '天降陨石', desc: '随机位置砸下陨石AOE',
    icon: '☄', color: '#FF8800', basePct: 2.5, interval: 4000,
    branches: {
      damage: { name: '伤害', desc: '+50%基础伤害', max: 5, requires: null },
      count:  { name: '数量', desc: '+1颗陨石', max: 3, requires: null },
      radius: { name: '范围', desc: '+25%爆炸范围', max: 3, requires: null },
      freq:   { name: '频率', desc: '-15%冷却', max: 3, requires: null },
      burn:   { name: '燃烧', desc: '落点留火焰地带', max: 2, requires: { damage: 2 } },
      rain:   { name: '陨石雨', desc: '同时砸下一排', max: 1, requires: { count: 3, freq: 2 } },
    },
  },
  drone: {
    name: '战术无人机', desc: '无人机布阵，激光网切割砖块',
    icon: '🤖', color: '#50FFB4', basePct: 0.8, interval: 300,
    branches: {
      damage:     { name: '伤害', desc: '+50%激光伤害', max: 5, requires: null },
      count:      { name: '阵列', desc: '+1台(2→3△→4◇→5★)', max: 3, requires: null },
      speed:      { name: '机动', desc: '阵型移动+tick频率提升30%', max: 3, requires: null },
      width:      { name: '光束', desc: '激光变粗+判定+40%', max: 2, requires: { damage: 2 } },
      deploy:     { name: '部署', desc: '阵型半径+25,追踪更准', max: 2, requires: { count: 1 } },
      arc:        { name: '电弧', desc: '激光线释放电弧扩大范围', max: 2, requires: { count: 2 } },
      overcharge: { name: '过载', desc: '阵型中心交叉点伤害×2', max: 1, requires: { count: 2, damage: 3 } },
      focus:      { name: '聚焦', desc: '激光对低HP砖额外伤害+80%', max: 2, requires: { damage: 3, width: 1 } },
      pulse:      { name: '脉冲', desc: '每4秒阵型范围AOE爆发×4', max: 1, requires: { damage: 4, arc: 2 } },
    },
  },
  spinBlade: {
    name: '等离子旋刃', desc: '弹墙旋刃，后排持续清扫',
    icon: '🌀', color: '#AA44FF', basePct: 0.8, interval: 3000, tickInterval: 250,
    branches: {
      damage:    { name: '伤害', desc: '+50%基础伤害', max: 5, requires: null },
      duration:  { name: '续航', desc: '+1.5秒存在时间', max: 3, requires: null },
      giant:     { name: '巨型化', desc: '旋刃变大+判定范围↑', max: 3, requires: null },
      pierce:    { name: '贯穿', desc: '每tick可命中所有砖块', max: 1, requires: { damage: 2 } },
      shockwave: { name: '回旋斩', desc: '弹墙时释放环形刀气波', max: 2, requires: { damage: 2 } },
      ramp:      { name: '蓄势', desc: '存活每秒+12%伤害', max: 3, requires: { duration: 2 } },
      bleed:     { name: '撕裂', desc: '命中留DOT(15%/秒×2秒)', max: 2, requires: { damage: 3 } },
      linger:    { name: '滞留', desc: '结束后原地旋转2秒', max: 2, requires: { duration: 2, giant: 1 } },
      split:     { name: '分裂', desc: '结束后分裂2个小旋刃', max: 2, requires: { duration: 2, damage: 2 } },
      superBlade:{ name: '超级旋刃', desc: '华丽特效+伤害频率翻倍', max: 1, requires: { giant: 3, damage: 3 } },
    },
  },
};

module.exports = WEAPON_TREES;
