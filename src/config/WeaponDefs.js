/**
 * WeaponDefs.js - 6大武器升级树定义
 * 每个武器有独立分支升级，basePct为伤害百分比基准
 */

const WEAPON_TREES = {
  kunai: {
    name: '光能飞刀', desc: '飞刀命中爆炸，范围AOE伤害',
    icon: '🔪', color: '#00FFFF', basePct: 1.2, interval: 1800,
    branches: {
      damage:  { name: '伤害', desc: '+50%基础伤害', max: 5, requires: null },
      count:   { name: '刀数', desc: '+1把飞刀', max: 3, requires: null },
      aoe:     { name: '爆炸范围', desc: '+25%爆炸半径', max: 3, requires: null },
      speed:   { name: '冷却缩减', desc: '-20%技能CD', max: 3, requires: null },
      pierce:  { name: '穿透', desc: '穿透后继续飞行再爆炸', max: 2, requires: { count: 2 } },
      chain:   { name: '连锁爆炸', desc: '被击杀砖块也会爆炸', max: 2, requires: { aoe: 2, damage: 2 } },
    },
  },
  lightning: {
    name: '闪电链', desc: '自动锁定砖块释放闪电',
    icon: '⚡', color: '#FFF050', basePct: 1.2, interval: 2500,
    branches: {
      damage:   { name: '伤害', desc: '+50%基础伤害', max: 5, requires: null },
      chains:   { name: '链数', desc: '+1跳跃目标', max: 4, requires: null },
      freq:     { name: '频率', desc: '-20%冷却', max: 3, requires: null },
      paralyze: { name: '麻痹', desc: '命中减速30%', max: 2, requires: { chains: 2 } },
      storm:    { name: '雷暴', desc: '同时释放2道闪电', max: 2, requires: { freq: 2 } },
      overload: { name: '超载', desc: '链末端爆炸AOE', max: 1, requires: { chains: 3, damage: 3 } },
    },
  },
  missile: {
    name: '追踪导弹', desc: '自动追踪砖块的导弹',
    icon: '🚀', color: '#FF14FF', basePct: 2.0, interval: 3500,
    branches: {
      damage:   { name: '伤害', desc: '+50%基础伤害', max: 4, requires: null },
      count:    { name: '数量', desc: '+1发导弹', max: 3, requires: null },
      aoe:      { name: '爆炸范围', desc: '+25%AOE', max: 3, requires: null },
      tracking: { name: '追踪性能', desc: '+30%转向', max: 2, requires: null },
      split:    { name: '分裂弹', desc: '命中后分裂3小弹', max: 2, requires: { count: 2 } },
      nuke:     { name: '核弹头', desc: '巨型爆炸+屏震', max: 1, requires: { aoe: 3, damage: 4 } },
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
    name: '攻击无人机', desc: '跟随飞机的无人机自动射击',
    icon: '🤖', color: '#50FFB4', basePct: 0.8, interval: 800,
    branches: {
      damage:   { name: '伤害', desc: '+50%基础伤害', max: 5, requires: null },
      count:    { name: '数量', desc: '+1台无人机', max: 3, requires: null },
      fireRate: { name: '射速', desc: '+25%攻击频率', max: 3, requires: null },
      range:    { name: '射程', desc: '+20%攻击距离', max: 2, requires: null },
      burst:    { name: '连射', desc: '每次射3发', max: 2, requires: { fireRate: 2 } },
      laser:    { name: '激光模式', desc: '改为持续激光', max: 1, requires: { count: 2, damage: 4 } },
    },
  },
  spinBlade: {
    name: '等离子旋刃', desc: '丢出旋转刃持续移动切割',
    icon: '🌀', color: '#AA44FF', basePct: 0.6, interval: 3000, tickInterval: 200,
    branches: {
      damage:   { name: '伤害', desc: '+50%基础伤害', max: 5, requires: null },
      count:    { name: '刃数', desc: '+1把旋刃', max: 3, requires: null },
      duration: { name: '持续时间', desc: '+1秒存在时间', max: 3, requires: null },
      speed:    { name: '移速', desc: '+30%飞行速度', max: 2, requires: null },
      giant:    { name: '巨型化', desc: '旋刃体积翻倍', max: 2, requires: { duration: 2 } },
      bounce:   { name: '连锁弹射', desc: '碰壁反弹继续飞', max: 1, requires: { count: 2, speed: 2 } },
    },
  },
};

module.exports = WEAPON_TREES;
