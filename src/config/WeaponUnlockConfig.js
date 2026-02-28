/**
 * WeaponUnlockConfig.js - 武器解锁配置表
 * 纯数据，无逻辑代码
 * 
 * unlockChapter: 达到该关卡后解锁（同时决定列表排序：章节升序）
 * dmgType: 伤害类型标识
 * dmgLabel: 伤害类型显示名
 * dmgColor: 伤害类型显示色
 * 
 * 排序规则：unlockChapter升序，同章节按定义顺序
 */

module.exports = {
  ship:       { unlockChapter: 1,dmgType: 'physical', dmgLabel: '物理', dmgColor: '#FFFFFF' },
  kunai:      { unlockChapter: 1,dmgType: 'ice',      dmgLabel: '寒冰', dmgColor: '#44DDFF' },
  lightning:  { unlockChapter: 1,dmgType: 'energy',   dmgLabel: '能量', dmgColor: '#FFF050' },
  missile:    { unlockChapter: 1,dmgType: 'physical', dmgLabel: '物理', dmgColor: '#FFFFFF' },
  frostStorm: { unlockChapter: 10, order: 4,  dmgType: 'ice',      dmgLabel: '寒冰', dmgColor: '#44DDFF' },
  meteor:     { unlockChapter: 1,dmgType: 'fire',     dmgLabel: '火焰', dmgColor: '#FF4400' },
  drone:      { unlockChapter: 10, order: 6,  dmgType: 'energy',   dmgLabel: '能量', dmgColor: '#FFF050' },
  spinBlade:  { unlockChapter: 15, order: 7,  dmgType: 'physical', dmgLabel: '物理', dmgColor: '#FFFFFF' },
  blizzard:   { unlockChapter: 20, order: 8,  dmgType: 'fire',     dmgLabel: '火焰', dmgColor: '#FF4400' },
  ionBeam:    { unlockChapter: 25, order: 9,  dmgType: 'energy',   dmgLabel: '能量', dmgColor: '#FFF050' },
  gravityWell:{ unlockChapter: 30, order: 10, dmgType: 'energy',   dmgLabel: '能量', dmgColor: '#FFF050' },
};
