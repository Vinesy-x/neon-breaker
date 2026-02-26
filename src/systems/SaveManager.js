/**
 * SaveManager.js - 存档管理（金币/进度/升级）
 * 本地 wx.Storage + 微信云开发双写
 */

const SAVE_KEY = 'neon_breaker_save';
var _cloudReady = false;
var _cloudSaveTimer = null;  // 防抖定时器
var _cloudSaving = false;    // 防并发

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
  weaponLevels: {},  // { kunai: 0, lightning: 0, ... }
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
        if (!this._data.weaponLevels) this._data.weaponLevels = {};
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
      // 本地存储失败静默处理
    }
    // 云端防抖保存（2秒内多次save只上传一次）
    this._cloudSaveDebounce();
  }

  _cloudSaveDebounce() {
    if (!_cloudReady) return;
    if (_cloudSaveTimer) clearTimeout(_cloudSaveTimer);
    _cloudSaveTimer = setTimeout(() => {
      this._cloudSave();
    }, 2000);
  }

  _cloudSave() {
    if (!_cloudReady || _cloudSaving) return;
    _cloudSaving = true;
    var data = JSON.parse(JSON.stringify(this._data));
    wx.cloud.callFunction({
      name: 'saveGame',
      data: { saveData: data },
      success: function(res) {
        if (res.result && res.result.code === 0) {
          console.log('[Cloud] 存档已同步');
        }
      },
      fail: function(err) {
        console.warn('[Cloud] 存档同步失败', err);
      },
      complete: function() {
        _cloudSaving = false;
      }
    });
  }

  /**
   * 初始化云开发并从云端加载存档（启动时调一次）
   * 云端存档比本地新则覆盖本地
   */
  initCloud(envId, callback) {
    if (!wx.cloud) {
      console.warn('[Cloud] wx.cloud 不可用');
      if (callback) callback(false);
      return;
    }
    try {
      wx.cloud.init({ env: envId, traceUser: true });
    } catch (e) {
      console.warn('[Cloud] init failed', e);
      if (callback) callback(false);
      return;
    }
    var self = this;
    wx.cloud.callFunction({
      name: 'loadGame',
      data: {},
      success: function(res) {
        _cloudReady = true;
        if (res.result && res.result.code === 0 && res.result.saveData) {
          var cloudData = res.result.saveData;
          // 用进度更高的存档：比较 maxChapter + coins 总和
          var localScore = (self._data.maxChapter || 1) * 1000 + (self._data.coins || 0);
          var cloudScore = (cloudData.maxChapter || 1) * 1000 + (cloudData.coins || 0);
          if (cloudScore > localScore) {
            // 云端存档更好，覆盖本地
            self._data = Object.assign({}, JSON.parse(JSON.stringify(DEFAULT_SAVE)), cloudData);
            for (var k in DEFAULT_SAVE.upgrades) {
              if (self._data.upgrades[k] === undefined) self._data.upgrades[k] = 0;
            }
            if (!self._data.weaponLevels) self._data.weaponLevels = {};
            wx.setStorageSync(SAVE_KEY, self._data);
            console.log('[Cloud] 云端存档已恢复 (maxChapter=' + self._data.maxChapter + ')');
          } else if (localScore > cloudScore) {
            // 本地更好，上传到云端
            self._cloudSave();
            console.log('[Cloud] 本地存档更新，已上传云端');
          } else {
            console.log('[Cloud] 存档一致');
          }
        } else {
          // 云端没存档，上传本地的
          self._cloudSave();
          console.log('[Cloud] 首次同步，上传本地存档');
        }
        if (callback) callback(true);
      },
      fail: function(err) {
        console.warn('[Cloud] 加载存档失败', err);
        _cloudReady = false;
        if (callback) callback(false);
      }
    });
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
    return this._data.maxChapter || 1;
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

  // ===== 武器等级系统 =====

  /** 获取武器等级 */
  getWeaponLevel(key) {
    return this._data.weaponLevels[key] || 0;
  }

  /** 武器最高等级 */
  getWeaponMaxLevel() { return 15; }

  /** 武器升级费用：金币 + 蓝晶（蓝晶暂用金币代替） */
  getWeaponUpgradeCost(key) {
    var lv = this.getWeaponLevel(key);
    var coins = Math.floor(100 * Math.pow(1.3, lv));
    var crystals = Math.floor(50 * Math.pow(1.25, lv));
    return { coins: coins, crystals: crystals };
  }

  /** 武器是否满级 */
  isWeaponMaxed(key) {
    return this.getWeaponLevel(key) >= this.getWeaponMaxLevel();
  }

  /** 升级武器，扣费。成功返回true */
  upgradeWeapon(key) {
    if (this.isWeaponMaxed(key)) return false;
    var cost = this.getWeaponUpgradeCost(key);
    // 暂时只扣金币（crystals后续加）
    if (this._data.coins < cost.coins) return false;
    this._data.coins -= cost.coins;
    this._data.weaponLevels[key] = (this._data.weaponLevels[key] || 0) + 1;
    this.save();
    return true;
  }

  /** 全局暴击伤害加成（所有武器等级之和 × 2%） */
  getWeaponCritDamageBonus() {
    var total = 0;
    for (var k in this._data.weaponLevels) {
      total += this._data.weaponLevels[k];
    }
    return total * 0.02;
  }

  /** 获取武器在某等级解锁的分支列表 */
  static getWeaponUnlocks(weaponKey) {
    var WEAPON_TREES = require('../config/WeaponDefs');
    var SHIP_TREE = require('../config/ShipDefs');
    var tree, branchSource;
    if (weaponKey === 'ship') {
      // 飞机：分支定义直接是 SHIP_TREE 本身（不是 tree.branches）
      branchSource = SHIP_TREE;
    } else {
      tree = WEAPON_TREES[weaponKey];
      if (!tree) return [];
      branchSource = tree.branches;
    }
    // 按requires复杂度分配解锁等级
    var branches = Object.keys(branchSource);
    var unlocks = [];
    for (var i = 0; i < branches.length; i++) {
      var bk = branches[i];
      var bDef = branchSource[bk];
      // 无前置 = 初始可用, 有前置 = 根据requires深度分配等级
      if (!bDef.requires) continue;
      // 计算前置总等级需求
      var reqTotal = 0;
      for (var rk in bDef.requires) reqTotal += bDef.requires[rk];
      // 映射到解锁等级: 2,4,6,8,10...
      var unlockLv = Math.min(15, Math.max(2, reqTotal * 2));
      unlocks.push({ level: unlockLv, branchKey: bk, branchName: bDef.name, desc: bDef.desc });
    }
    unlocks.sort(function(a, b) { return a.level - b.level; });
    return unlocks;
  }
}

// 导出升级配置供外部读取
SaveManager.UPGRADE_CONFIG = UPGRADE_CONFIG;

module.exports = SaveManager;
