/**
 * ShipDefs.js - 飞机升级树定义 v10.0
 *
 * 分支结构:
 *   基础线: attack                          (无前置，默认分支)
 *   弹道线: spread, burst, ricochet         (无前置，默认分支)
 *   元素线: fireBullet/iceBullet/thunderBullet (商店解锁，互斥三选一)
 * 
 * 元素进阶技能(fireSpread/fireExplosion/iceFreeze/iceShatter/shockMark/shockField)
 * 不在技能树显示，留给后续系统。
 */

const SHIP_TREE = {
  // ===== 基础强化 =====
  attack: {
    name: '子弹伤害',
    desc: '+50%子弹伤害',
    icon: '⚔',
    color: '#FF3333',
    max: 5,
    requires: null,
    quality: 'normal',
  },

  // ===== 弹道线（默认分支）=====
  spread: {
    name: '散射弹道',
    desc: '+1子弹散射数',
    icon: '⋮',
    color: '#FF14FF',
    max: 3,
    requires: null,
    quality: 'rare',
  },
  burst: {
    name: '连射',
    desc: '连续射击+1子弹，间隔150ms',
    icon: '🔫',
    color: '#FFAA00',
    max: 3,
    requires: null,
    quality: 'rare',
  },
  ricochet: {
    name: '弹射弹道',
    desc: '子弹反弹次数+1（砖块+边界）',
    icon: '🔁',
    color: '#FF6600',
    max: 3,
    requires: null,
    quality: 'rare',
  },

  // ===== 元素弹（商店解锁，互斥三选一）=====
  fireBullet: {
    name: '火焰弹',
    desc: '命中附带灼烧DOT',
    icon: '🔥',
    color: '#FF4400',
    max: 3,
    requires: null,
    quality: 'exclusive',
    exclusiveGroup: 'element',
    shopGated: true,
  },
  iceBullet: {
    name: '寒冰弹',
    desc: '命中叠加冰缓，满5层触发冻结',
    icon: '❄',
    color: '#44DDFF',
    max: 3,
    requires: null,
    quality: 'exclusive',
    exclusiveGroup: 'element',
    shopGated: true,
  },
  thunderBullet: {
    name: '雷电弹',
    desc: '命中附加感电，受伤时概率电弧',
    icon: '⚡',
    color: '#FFF050',
    max: 3,
    requires: null,
    quality: 'exclusive',
    exclusiveGroup: 'element',
    shopGated: true,
  },

  // ===== 元素进阶（不显示在技能树，留给后续系统）=====
  fireSpread:    { name: '引燃蔓延', max: 2, requires: { fireBullet: 1 }, hidden: true },
  fireExplosion: { name: '余烬爆破', max: 2, requires: { fireBullet: 2 }, hidden: true },
  iceFreeze:     { name: '冰封禁锢', max: 2, requires: { iceBullet: 1 }, hidden: true },
  iceShatter:    { name: '碎冰迸射', max: 2, requires: { iceBullet: 2 }, hidden: true },
  shockMark:     { name: '超导标记', max: 2, requires: { thunderBullet: 1 }, hidden: true },
  shockField:    { name: '雷暴领域', max: 2, requires: { thunderBullet: 2 }, hidden: true },
};

module.exports = SHIP_TREE;
