/**
 * GachaManager.js - 扭蛋/抽卡系统
 * 管理普通抽（军火商）、高级抽（黑市）、Boss掉落
 */

const GachaConfig = require('../config/GachaConfig');

class GachaManager {
  /**
   * @param {object} chipManager - ChipManager实例（generateChip/addChip）
   * @param {object} saveManager - SaveManager实例（读写coins/diamonds/pity等）
   */
  constructor(chipManager, saveManager) {
    this.chipManager = chipManager;
    this.saveManager = saveManager;
  }

  // ========== 普通抽（军火商）==========

  /**
   * 检查是否能普通抽卡
   * @param {number} count - 1或10
   * @returns {boolean}
   */
  canDrawNormal(count) {
    // 每日免费1次（仅单抽）
    if (count === 1 && !this.saveManager.getFreeDrawToday()) return true;
    var cost = count === 10 ? GachaConfig.normal.costTen : GachaConfig.normal.cost;
    return this.saveManager.getCoins() >= cost;
  }

  /**
   * 执行普通抽卡
   * @param {number} count - 1或10
   * @returns {Array} 生成的芯片数组
   */
  drawNormal(count) {
    if (!this.canDrawNormal(count)) return [];

    if (count === 1 && !this.saveManager.getFreeDrawToday()) {
      // 使用每日免费次数
      this.saveManager.setFreeDrawToday(true);
    } else {
      // 扣金币
      var cost = count === 10 ? GachaConfig.normal.costTen : GachaConfig.normal.cost;
      if (!this.saveManager.spendCoins(cost)) return [];
    }

    var chips = [];
    var times = count === 10 ? 10 : 1;
    for (var i = 0; i < times; i++) {
      var quality = this._rollQuality(GachaConfig.normal.rates);
      var part = this._rollPart();
      var chip = this.chipManager.generateChip(part, quality);
      this.chipManager.addChip(chip);
      chips.push(chip);
    }
    return chips;
  }

  // ========== 高级抽（黑市）==========

  /**
   * 检查是否能高级抽卡
   * @param {number} count - 1或10
   * @returns {boolean}
   */
  canDrawPremium(count) {
    var cost = count === 10 ? GachaConfig.premium.costTen : GachaConfig.premium.cost;
    return this.saveManager.getDiamonds() >= cost;
  }

  /**
   * 执行高级抽卡（含保底逻辑）
   * @param {number} count - 1或10
   * @returns {Array} 生成的芯片数组
   */
  drawPremium(count) {
    if (!this.canDrawPremium(count)) return [];

    var cost = count === 10 ? GachaConfig.premium.costTen : GachaConfig.premium.cost;
    if (!this.saveManager.spendDiamonds(cost)) return [];

    var chips = [];
    var times = count === 10 ? 10 : 1;
    for (var i = 0; i < times; i++) {
      var quality = this._rollQuality(GachaConfig.premium.rates);
      quality = this._applyPity(quality); // 保底检查
      var part = this._rollPart();
      var chip = this.chipManager.generateChip(part, quality);
      this.chipManager.addChip(chip);
      chips.push(chip);
    }
    return chips;
  }

  // ========== Boss掉落 ==========

  /**
   * Boss掉落芯片
   * @param {number} chapter - 当前章节
   * @param {boolean} isFirstClear - 是否首通
   * @returns {Array} 掉落的芯片数组
   */
  bossDropChip(chapter, isFirstClear) {
    var rates = this._getBossDropRates(chapter);
    var chips = [];

    // 基础掉落1颗
    var quality = this._rollQuality(rates);
    if (quality === 'red') quality = 'orange'; // Boss不掉红色
    var part = this._rollPart();
    var chip = this.chipManager.generateChip(part, quality);
    this.chipManager.addChip(chip);
    chips.push(chip);

    // 首通额外掉2颗
    if (isFirstClear) {
      for (var i = 0; i < 2; i++) {
        quality = this._rollQuality(rates);
        if (quality === 'red') quality = 'orange';
        part = this._rollPart();
        chip = this.chipManager.generateChip(part, quality);
        this.chipManager.addChip(chip);
        chips.push(chip);
      }
    }

    return chips;
  }

  // ========== 内部方法 ==========

  /** 根据章节获取Boss掉落概率表 */
  _getBossDropRates(chapter) {
    var drops = GachaConfig.bossDrop;
    for (var i = drops.length - 1; i >= 0; i--) {
      if (chapter >= drops[i].minChapter) {
        return drops[i].rates;
      }
    }
    return drops[0].rates;
  }

  /**
   * 按概率表随机选品质
   * @param {object} rates - { white: 0.5, green: 0.3, ... }
   * @returns {string} 品质key
   */
  _rollQuality(rates) {
    var r = Math.random();
    var cumulative = 0;
    var keys = Object.keys(rates);
    for (var i = 0; i < keys.length; i++) {
      cumulative += rates[keys[i]];
      if (r <= cumulative) return keys[i];
    }
    return keys[keys.length - 1];
  }

  /** 随机选一个已解锁部位 */
  _rollPart() {
    var parts = this.saveManager.getPartsUnlocked();
    if (!parts || parts.length === 0) {
      parts = ['fireControl', 'powerCore', 'armorBay'];
    }
    return parts[Math.floor(Math.random() * parts.length)];
  }

  /**
   * 保底逻辑：50抽小保底(橙)，100抽大保底(红)
   * 自然出橙/红也重置计数
   */
  _applyPity(quality) {
    var pity = this.saveManager.getPremiumPity() + 1;

    if (pity >= 100) {
      this.saveManager.setPremiumPity(0);
      return 'red';
    }
    if (pity >= 50 && quality !== 'orange' && quality !== 'red') {
      this.saveManager.setPremiumPity(0);
      return 'orange';
    }
    if (quality === 'orange' || quality === 'red') {
      this.saveManager.setPremiumPity(0);
      return quality;
    }

    this.saveManager.setPremiumPity(pity);
    return quality;
  }

  // ========== 每日重置 ==========

  /** 重置每日免费抽次数（由外部每日调用） */
  resetDaily() {
    this.saveManager.setFreeDrawToday(false);
  }
}

module.exports = GachaManager;
