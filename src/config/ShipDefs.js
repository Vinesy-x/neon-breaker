/**
 * ShipDefs.js - 飞机升级树定义 v7.1
 *
 * 设计原则：
 *   - 每次升级 ≈ +50% 等价伤害提升
 *   - 射速公式: baseFPS * (1 + lv * 0.5)，即每级+50%射速（加法叠加）
 *   - spread/pierce 为高品质选项（出现概率低但价值高）
 *   - 火/冰/雷互斥，选一个后其他不再出现
 *
 * 品质说明（用于三选一权重）:
 *   quality: 'normal' | 'rare' | 'exclusive'
 *   - normal: 普通，正常出现
 *   - rare: 高品质，出现概率低但价值高
 *   - exclusive: 互斥组，同组只能选一个
 *
 * exclusiveGroup: 互斥组名，同组内选了一个，其他不再出现
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
  fireRate: {
    name: '射速',
    desc: '+50%射速',
    icon: '»',
    color: '#FFF050',
    max: 4,
    requires: null,
    quality: 'normal',
  },

  // ===== 高品质 =====
  spread: {
    name: '散射弹道',
    desc: '+1子弹散射数',
    icon: '⋮',
    color: '#FF14FF',
    max: 3,
    requires: null,
    quality: 'rare',
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

  // ===== 元素弹（互斥三选一）=====
  fireBullet: {
    name: '火焰弹',
    desc: '命中附带灼烧',
    icon: '🔥',
    color: '#FF4400',
    max: 3,
    requires: null,
    quality: 'exclusive',
    exclusiveGroup: 'element',
  },
  iceBullet: {
    name: '寒冰弹',
    desc: '命中减速砖块',
    icon: '❄',
    color: '#44DDFF',
    max: 3,
    requires: null,
    quality: 'exclusive',
    exclusiveGroup: 'element',
  },
  thunderBullet: {
    name: '雷电弹',
    desc: '命中链式弹跳',
    icon: '⚡',
    color: '#FFF050',
    max: 3,
    requires: null,
    quality: 'exclusive',
    exclusiveGroup: 'element',
  },
};

module.exports = SHIP_TREE;
