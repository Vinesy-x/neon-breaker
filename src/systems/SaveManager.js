/**
 * SaveManager.js - 存档管理（金币/进度/升级）
 * 使用 wx.getStorageSync / wx.setStorageSync
 */

const SAVE_KEY = 'neon_breaker_save';

const UPGRADE_CONFIG = {
  attack:    { maxLevel: 50, costPer: 50 },
  fireRate:  { maxLevel: 30, costPer: 80 },
  crit:      { maxLevel: 20, costPer: 120 },
  startLevel:{ maxLevel: 5,  costPer: 500 },
  coinBonus: { maxLevel: 20, costPer: 150 },
  expBonus:  { maxLevel: 20, costPer: 100 },
};

const DEFAULT_SAVE = {
  maxChapter: 1,
  coins: 0,
  upgrades: {
    attack: 0,
    fireRate: 0,
    crit: 0,
    startLevel: 0,
    coinBonus: 0,
    expBonus: 0,
  },
  chapterRecords: {},
};

class SaveManager {
  constructor() {
    this._data = null;
    this._load();
  }

  // ===== 内部存取 =====

  _load() {
    try {
      const raw = wx.getStorageSync(SAVE_KEY);
      if (raw && typeof raw === 'object') {
        // 合并默认值（防止旧存档缺字段）
        this._data = Object.assign({}, JSON.parse(JSON.stringify(DEFAULT_SAVE)), raw);
        // 确保 upgrades 所有 key 存在
        for (var k in DEFAULT_SAVE.upgrades) {
          if (this._data.upgrades[k] === undefined) {
            this._data.upgrades[k] = 0;
          }
        }
      } else {
        this._data = JSON.parse(JSON.stringify(DEFAULT_SAVE));
      }
    } catch (e) {
      this._data = JSON.parse(JSON.stringify(DEFAULT_SAVE));
    }
  }

  save() {
    try {
      wx.setStorageSync(SAVE_KEY, this._data);
    } catch (e) {
      // 存储失败静默处理
    }
  }

  getData() {
    return this._data;
  }

  // ===== 金币 =====

  getCoins() {
    return this._data.coins || 0;
  }

  addCoins(amount) {
    this._data.coins = (this._data.coins || 0) + Math.floor(amount);
    this.save();
  }

  /**
   * 消费金币，够则扣除并返回 true，不够返回 false
   */
  spendCoins(amount) {
    if (this._data.coins >= amount) {
      this._data.coins -= amount;
      this.save();
      return true;
    }
    return false;
  }

  // ===== 章节进度 =====

  getMaxChapter() {
    // DEV: 全部解锁方便测试
    return 100;
    // return this._data.maxChapter || 1;
  }

  isChapterCleared(chapter) {
    var rec = this._data.chapterRecords[String(chapter)];
    return rec ? !!rec.cleared : false;
  }

  getChapterRecord(chapter) {
    var rec = this._data.chapterRecords[String(chapter)];
    if (!rec) return { cleared: false, bestScore: 0, bestLevel: 0 };
    return {
      cleared: !!rec.cleared,
      bestScore: rec.bestScore || 0,
      bestLevel: rec.bestLevel || 0,
    };
  }

  /**
   * 更新章节记录（只在更好时更新）
   */
  setChapterRecord(chapter, score, level) {
    var key = String(chapter);
    var rec = this._data.chapterRecords[key];
    if (!rec) {
      rec = { cleared: true, bestScore: 0, bestLevel: 0 };
    }
    rec.cleared = true;
    if (score > rec.bestScore) rec.bestScore = score;
    if (level > rec.bestLevel) rec.bestLevel = level;
    this._data.chapterRecords[key] = rec;
    this.save();
  }

  unlockNextChapter() {
    this._data.maxChapter = (this._data.maxChapter || 1) + 1;
    if (this._data.maxChapter > 100) this._data.maxChapter = 100;
    this.save();
  }

  // ===== 升级系统 =====

  getUpgrade(key) {
    return this._data.upgrades[key] || 0;
  }

  getUpgradeCost(key) {
    var cfg = UPGRADE_CONFIG[key];
    if (!cfg) return 99999;
    var curLevel = this.getUpgrade(key);
    return cfg.costPer * (curLevel + 1);
  }

  isUpgradeMaxed(key) {
    var cfg = UPGRADE_CONFIG[key];
    if (!cfg) return true;
    return this.getUpgrade(key) >= cfg.maxLevel;
  }

  /**
   * 升一级，扣金币。成功返回 true，失败返回 false
   */
  upgradeLevel(key) {
    if (this.isUpgradeMaxed(key)) return false;
    var cost = this.getUpgradeCost(key);
    if (this._data.coins < cost) return false;
    this._data.coins -= cost;
    this._data.upgrades[key] = (this._data.upgrades[key] || 0) + 1;
    this.save();
    return true;
  }

  /** Dev用：直接设置升级等级 */
  setUpgrade(key, level) {
    if (this._data.upgrades[key] === undefined) return;
    this._data.upgrades[key] = Math.max(0, level);
    this.save();
  }

  // ===== 升级效果计算 =====

  /** 基础攻击加成（子弹伤害+1/级） */
  getAttackBonus() {
    return this.getUpgrade('attack');
  }

  /** 射速加成比例 (0~0.6)，每级-2% */
  getFireRateBonus() {
    return this.getUpgrade('fireRate') * 0.02;
  }

  /** 暴击率加成 (0~0.2)，每级+1% */
  getCritBonus() {
    return this.getUpgrade('crit') * 0.01;
  }

  /** 起始等级 (0~5) */
  getStartLevel() {
    return this.getUpgrade('startLevel');
  }

  /** 金币倍率 (1.0~2.0)，每级+5% */
  getCoinMultiplier() {
    return 1.0 + this.getUpgrade('coinBonus') * 0.05;
  }

  /** 经验倍率 (1.0~1.6)，每级+3% */
  getExpMultiplier() {
    return 1.0 + this.getUpgrade('expBonus') * 0.03;
  }
}

// 导出升级配置供外部读取
SaveManager.UPGRADE_CONFIG = UPGRADE_CONFIG;

module.exports = SaveManager;
