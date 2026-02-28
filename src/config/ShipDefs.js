/**
 * ShipDefs.js - 飞机升级树定义 v9.0（外部养成版，fireRate移除）
 *
 * 分支结构（6基础 + 3互斥元素 + 6元素进阶 = 15方向）
 *   基础线: attack                          (无前置)
 *   弹道线: spread, pierce                 (无前置，rare)
 *   弹幕线: barrage                        (需fireRate:2)
 *   元素线: fire/ice/thunder               (互斥三选一)
 *   火进阶: fireSpread, fireExplosion      (需fireBullet)
 *   冰进阶: iceFreeze, iceShatter          (需iceBullet)
 *   雷进阶: shockMark, shockField          (需thunderBullet)
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


  // ===== 弹道线 =====
  spread: {
    name: '散射弹道',
    desc: '+1子弹散射数',
    icon: '⋮',
    color: '#FF14FF',
    max: 3,
    requires: null,
    quality: 'rare',
    shopGated: true,
  },
  pierce: {
    name: '穿透弹',
    desc: '子弹穿透+1层',
    icon: '↟',
    color: '#00FFFF',
    max: 5,
    requires: null,
    quality: 'rare',
  },

  // ===== 反弹线 =====
  wallBounce: {
    name: '边界反弹',
    desc: '子弹碰墙壁反弹，每次反弹伤害+25%',
    icon: '🔀',
    color: '#FF9900',
    max: 3,
    requires: null,
    quality: 'rare',
    shopGated: true,
  },
  ricochet: {
    name: '弹射反弹',
    desc: '子弹碰砖块后弹向附近目标，反弹次数+1',
    icon: '🔁',
    color: '#FF6600',
    max: 3,
    requires: { wallBounce: 1 },
    quality: 'rare',
  },

  // ===== 进阶 =====
  barrage: {
    name: '弹幕风暴',
    desc: '每3秒释放一轮全屏散射',
    icon: '🌀',
    color: '#AA44FF',
    max: 3,
    requires: null,
    quality: 'rare',
    shopGated: true,
  },

  // ===== 元素弹（互斥三选一）=====
  fireBullet: {
    name: '火焰弹',
    desc: '命中附带灼烧DOT',
    icon: '🔥',
    color: '#FF4400',
    max: 3,
    requires: null,
    quality: 'exclusive',
    exclusiveGroup: 'element',
  },
  iceBullet: {
    name: '寒冰弹',
    desc: '命中叠加冰缓，每层减速10%，满5层可触发冻结',
    icon: '❄',
    color: '#44DDFF',
    max: 3,
    requires: null,
    quality: 'exclusive',
    exclusiveGroup: 'element',
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
  },

  // ===== 火焰进阶 =====
  fireSpread: {
    name: '引燃蔓延',
    desc: '灼烧砖块被毁时，火焰扩散相邻砖块',
    icon: '🔥',
    color: '#FF6622',
    max: 2,
    requires: { fireBullet: 1 },
    quality: 'rare',
    exclusiveGroup: 'element',
  },
  fireExplosion: {
    name: '余烬爆破',
    desc: '灼烧自然结束时爆炸AOE',
    icon: '💥',
    color: '#FF8844',
    max: 2,
    requires: { fireBullet: 2 },
    quality: 'rare',
    exclusiveGroup: 'element',
  },

  // ===== 寒冰进阶 =====
  iceFreeze: {
    name: '冰封禁锢',
    desc: '冰缓叠5层后冻结2秒，冻结受伤+50%',
    icon: '❄',
    color: '#88EEFF',
    max: 2,
    requires: { iceBullet: 1 },
    quality: 'rare',
    exclusiveGroup: 'element',
  },
  iceShatter: {
    name: '碎冰迸射',
    desc: '冻结砖块被毁时碎裂伤害周围',
    icon: '💎',
    color: '#66CCFF',
    max: 2,
    requires: { iceBullet: 2 },
    quality: 'rare',
    exclusiveGroup: 'element',
  },

  // ===== 雷电进阶 =====
  shockMark: {
    name: '超导标记',
    desc: '感电砖受攻击时额外15%×层数能量伤害',
    icon: '⚡',
    color: '#FFDD44',
    max: 2,
    requires: { thunderBullet: 1 },
    quality: 'rare',
    exclusiveGroup: 'element',
  },
  shockField: {
    name: '雷暴领域',
    desc: '电弧区域留电场3秒持续伤害',
    icon: '🌩',
    color: '#DDBB00',
    max: 2,
    requires: { thunderBullet: 2 },
    quality: 'rare',
    exclusiveGroup: 'element',
  },
};

module.exports = SHIP_TREE;
