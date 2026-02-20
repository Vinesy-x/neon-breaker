/**
 * ShipDefs.js - 飞机升级树定义
 * 飞机本体定位：碰撞伤害（子弹）+ 生存能力
 */

const SHIP_TREE = {
  attack:    { name: '基础攻击', desc: '+15%子弹伤害', icon: '⚔', color: '#FF3333', max: 6, requires: null },
  fireRate:  { name: '射速', desc: '+10%子弹射速', icon: '»', color: '#FFF050', max: 5, requires: null },
  spread:    { name: '弹道', desc: '+1子弹散射数', icon: '⋮', color: '#FF14FF', max: 3, requires: null },
  pierce:    { name: '穿透弹', desc: '子弹穿透+1层', icon: '↟', color: '#00FFFF', max: 2, requires: null },
  crit:      { name: '暴击', desc: '+8%暴击率', icon: '✕', color: '#FF3333', max: 4, requires: null },
  moveSpeed: { name: '移速', desc: '+10%移动速度', icon: '→', color: '#50FFB4', max: 3, requires: null },
  critDmg:   { name: '暴击伤害', desc: '+30%暴击倍率', icon: '☆', color: '#FFD700', max: 3, requires: { crit: 2 } },
  barrage:   { name: '弹幕', desc: '子弹变为3连发', icon: '⫶', color: '#FF14FF', max: 2, requires: { fireRate: 3 } },
  shield:    { name: '能量护盾', desc: '受击免疫1次/30秒', icon: '◎', color: '#4488FF', max: 2, requires: { moveSpeed: 2 } },
  magnet:    { name: '磁力场', desc: '自动吸收金币和宝箱', icon: '⊕', color: '#FFF050', max: 1, requires: null },
};

module.exports = SHIP_TREE;
