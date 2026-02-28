/**
 * UpgradeConfig.js - 永久升级配置表
 * 纯数据，无逻辑代码
 * 
 * maxLevel: 最大等级
 * costPer: 每级费用
 * effect: 每级效果值（供UI显示）
 * desc: 描述
 */

module.exports = {
  attack:    { maxLevel: 50, costPer: 50,  effect: '+2%攻击',   desc: '基础攻击力' },
  crit:      { maxLevel: 20, costPer: 120, effect: '+5%暴击率', desc: '暴击概率' },
  fireDmg:   { maxLevel: 30, costPer: 80,  effect: '+3%火伤',   desc: '火焰伤害加成' },
  iceDmg:    { maxLevel: 30, costPer: 80,  effect: '+3%冰伤',   desc: '寒冰伤害加成' },
  energyDmg: { maxLevel: 30, costPer: 80,  effect: '+3%能量伤', desc: '能量伤害加成' },
  fireRate:  { maxLevel: 30, costPer: 80,  effect: '+2%射速',   desc: '射击频率' },
  startLevel:{ maxLevel: 5,  costPer: 500, effect: '+1初始等级', desc: '战斗初始等级' },
  coinBonus: { maxLevel: 20, costPer: 150, effect: '+3%金币',   desc: '金币获取加成' },
  expBonus:  { maxLevel: 20, costPer: 100, effect: '+3%经验',   desc: '经验获取加成' },
};
