/**
 * ShopCurveConfig.js - 武器商店等级成长曲线配置
 * 纯数据，无逻辑代码
 * 
 * critBonusPerBracket: 每段暴伤增长值 [lv1-5, lv6-10, lv11-15, lv16-20, lv21+]
 * dmgMultPerBracket: 每段伤害系数增长值
 * maxShopLevel: 最大商店等级
 * weaponUpgradeCostBase: 武器升级基础费用
 * weaponUpgradeCostScale: 费用缩放指数
 */

module.exports = {
  maxShopLevel: 30,

  // 暴伤：每级增加值，按段递增
  critBonusPerBracket: [0.01, 0.02, 0.03, 0.04, 0.05],
  // 伤害系数：每级增加值（5倍数级跳过）
  dmgMultPerBracket:   [0.10, 0.15, 0.20, 0.25, 0.30],

  // 武器升级费用公式: floor(costBase × costScale^lv)
  weaponUpgradeCostBase: 100,
  weaponUpgradeCostScale: 1.3,
  crystalCostBase: 50,
  crystalCostScale: 1.25,
};
