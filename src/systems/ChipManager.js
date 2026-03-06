/**
 * ChipManager.js - 芯片系统核心管理器
 * 管理芯片生成、仓库、装配、合成、洗练、分解、效果汇总
 *
 * 需要在 SaveManager.DEFAULT_SAVE 中新增以下字段：
 *   chips: [],                    // 芯片仓库
 *   chipUidCounter: 0,            // 芯片uid自增计数器
 *   equipped: {                   // 各部位装备槽（每部位5槽）
 *     fireControl: [null,null,null,null,null],
 *     powerCore:   [null,null,null,null,null],
 *     armorBay:    [null,null,null,null,null],
 *     mobility:    [null,null,null,null,null],
 *     tactical:    [null,null,null,null,null],
 *     expansion:   [null,null,null,null,null],
 *   },
 *   partsUnlocked: ['fireControl','powerCore','armorBay'],
 *   diamonds: 0, premiumPity: 0, freeDrawToday: false,
 *   scraps: 0, solvents: 0
 */
const ChipConfig = require('../config/ChipConfig');
const GachaConfig = require('../config/GachaConfig');

// 品质升级顺序
const QUALITY_ORDER = ['white', 'green', 'blue', 'purple', 'orange', 'red'];

class ChipManager {
  constructor(saveManager) {
    this.saveManager = saveManager;
    this.chips = [];           // 芯片仓库
    this.chipUidCounter = 0;   // uid自增
    this.equipped = {};        // 部位 -> [uid|null, ...]
    this._pendingReroll = null; // 洗练临时状态 {uid, old, new}

    this._loadFromSave();
  }

  // ==================== 芯片生成 ====================

  /**
   * 生成1颗芯片
   * @param {string} partKey - 部位key（expansion=全池合并）
   * @param {string} quality - 品质key
   * @returns {{uid:number, part:string, quality:string, affix:{type:string, value:number}}}
   */
  generateChip(partKey, quality) {
    const pool = this._getAffixPool(partKey, quality);
    if (!pool.length) return null;

    // 随机选1条词条
    const template = pool[Math.floor(Math.random() * pool.length)];
    const [min, max] = ChipConfig.QUALITIES[quality].multiplier;
    const value = template.baseValue * (min + Math.random() * (max - min));

    return {
      uid: 0, // addChip时赋值
      part: partKey,
      quality,
      affix: { type: template.id, value: parseFloat(value.toFixed(6)) },
    };
  }

  /**
   * 获取指定部位+品质的可用词条池
   * expansion部位=合并所有词条池并去重
   * redOnly词条仅red品质可出
   */
  _getAffixPool(partKey, quality) {
    let pool;
    if (partKey === 'expansion') {
      // 合并所有部位词条池，同id去重
      const seen = new Set();
      pool = [];
      for (const key in ChipConfig.AFFIX_POOL) {
        if (key === 'expansion' || !ChipConfig.AFFIX_POOL[key]) continue;
        for (const entry of ChipConfig.AFFIX_POOL[key]) {
          if (!seen.has(entry.id)) {
            seen.add(entry.id);
            pool.push(entry);
          }
        }
      }
    } else {
      pool = ChipConfig.AFFIX_POOL[partKey] || [];
    }
    // redOnly过滤：非red品质排除redOnly词条
    if (quality !== 'red') {
      pool = pool.filter(e => !e.redOnly);
    }
    return pool;
  }

  // ==================== 仓库 ====================

  /** 返回所有芯片数组 */
  getChips() { return this.chips; }

  /** 按uid查找芯片 */
  getChipByUid(uid) { return this.chips.find(c => c.uid === uid) || null; }

  /** 按部位筛选芯片 */
  getChipsByPart(partKey) { return this.chips.filter(c => c.part === partKey); }

  /** 加入仓库（自增uid） */
  addChip(chip) {
    chip.uid = ++this.chipUidCounter;
    this.chips.push(chip);
    this._saveToStorage();
    return chip;
  }

  /** 从仓库移除（含自动卸下） */
  removeChip(uid) {
    // 先从所有装备槽中卸下
    for (const part in this.equipped) {
      const slots = this.equipped[part];
      for (let i = 0; i < slots.length; i++) {
        if (slots[i] === uid) slots[i] = null;
      }
    }
    this.chips = this.chips.filter(c => c.uid !== uid);
    this._saveToStorage();
  }

  // ==================== 装配 ====================

  /**
   * 装备芯片到指定部位槽位
   * 校验：芯片part==partKey(expansion除外)，槽位0~4，部位已解锁
   */
  equip(uid, partKey, slotIndex) {
    const chip = this.getChipByUid(uid);
    if (!chip) return false;
    // expansion芯片可装任意已解锁部位；其他芯片只能装对应部位
    if (chip.part !== 'expansion' && chip.part !== partKey) return false;
    if (slotIndex < 0 || slotIndex >= ChipConfig.SLOTS_PER_PART) return false;
    if (!this.isPartUnlocked(partKey)) return false;

    // 先从旧位置卸下
    for (const p in this.equipped) {
      const s = this.equipped[p];
      for (let i = 0; i < s.length; i++) {
        if (s[i] === uid) s[i] = null;
      }
    }

    this.equipped[partKey][slotIndex] = uid;
    this._saveToStorage();
    return true;
  }

  /** 卸下指定部位槽位 */
  unequip(partKey, slotIndex) {
    if (!this.equipped[partKey]) return false;
    this.equipped[partKey][slotIndex] = null;
    this._saveToStorage();
    return true;
  }

  /** 返回该部位5个槽的芯片uid数组 */
  getEquipped(partKey) {
    return this.equipped[partKey] || [null, null, null, null, null];
  }

  /** 检查部位是否解锁（根据最高通关章节） */
  isPartUnlocked(partKey) {
    const cfg = ChipConfig.PARTS[partKey];
    if (!cfg) return false;
    return this.saveManager.getMaxChapter() >= cfg.unlock;
  }

  /** 判断芯片是否已装备 */
  _isEquipped(uid) {
    for (const part in this.equipped) {
      if (this.equipped[part].includes(uid)) return true;
    }
    return false;
  }

  // ==================== 5合1升品质 ====================

  /**
   * 检查能否合成：仓库中该部位该品质的未装备芯片 >= 5
   * red品质不能再合
   */
  canMerge(partKey, quality) {
    if (quality === 'red') return false;
    const count = this._getMergeCandidates(partKey, quality).length;
    return count >= 5;
  }

  /**
   * 消耗5颗同部位同品质未装备芯片 → 生成1颗高一级品质芯片（词条重随机）
   */
  merge(partKey, quality) {
    if (!this.canMerge(partKey, quality)) return null;

    const candidates = this._getMergeCandidates(partKey, quality);
    // 消耗前5颗
    for (let i = 0; i < 5; i++) {
      this.chips = this.chips.filter(c => c.uid !== candidates[i].uid);
    }

    // 下一级品质
    const idx = QUALITY_ORDER.indexOf(quality);
    const nextQuality = QUALITY_ORDER[idx + 1];

    // 生成新芯片
    const newChip = this.generateChip(partKey, nextQuality);
    this.addChip(newChip); // addChip内部会save
    return newChip;
  }

  /** 获取可用于合成的芯片（同部位同品质且未装备） */
  _getMergeCandidates(partKey, quality) {
    return this.chips.filter(c =>
      c.part === partKey && c.quality === quality && !this._isEquipped(c.uid)
    );
  }

  // ==================== 洗练 ====================

  /**
   * 消耗1瓶焕新试剂，重roll词条
   * @returns {{old:{type,value}, new:{type,value}}} 供UI二选一
   */
  reroll(uid) {
    const chip = this.getChipByUid(uid);
    if (!chip) return null;

    // 检查试剂
    const save = this.saveManager.getData();
    if ((save.solvents || 0) < 1) return null;

    // 扣试剂
    save.solvents = (save.solvents || 0) - 1;

    // 重roll
    const pool = this._getAffixPool(chip.part, chip.quality);
    const template = pool[Math.floor(Math.random() * pool.length)];
    const [min, max] = ChipConfig.QUALITIES[chip.quality].multiplier;
    const newValue = template.baseValue * (min + Math.random() * (max - min));

    const oldAffix = { type: chip.affix.type, value: chip.affix.value };
    const newAffix = { type: template.id, value: parseFloat(newValue.toFixed(6)) };

    // 暂存，等confirmReroll决定
    this._pendingReroll = { uid, old: oldAffix, new: newAffix };
    this._saveToStorage();

    return { old: oldAffix, new: newAffix };
  }

  /**
   * 确认洗练结果
   * @param {number} uid
   * @param {boolean} keepNew - true=接受新词条，false=保留旧的
   */
  confirmReroll(uid, keepNew) {
    if (!this._pendingReroll || this._pendingReroll.uid !== uid) return false;

    if (keepNew) {
      const chip = this.getChipByUid(uid);
      if (chip) {
        chip.affix = this._pendingReroll.new;
      }
    }
    // 不管选哪个，清除pending
    this._pendingReroll = null;
    this._saveToStorage();
    return true;
  }

  // ==================== 分解 ====================

  /**
   * 分解芯片 → 纳米碎片 + 可能的试剂
   * 碎片数量按 GachaConfig.scraps[quality]
   * 橙色额外+2试剂，红色+5试剂
   */
  disassemble(uid) {
    const chip = this.getChipByUid(uid);
    if (!chip) return null;

    const save = this.saveManager.getData();
    const scrapsGain = (GachaConfig.scraps && GachaConfig.scraps[chip.quality]) || 1;
    save.scraps = (save.scraps || 0) + scrapsGain;

    // 橙/红额外试剂
    let solventsGain = 0;
    if (chip.quality === 'orange') solventsGain = 2;
    if (chip.quality === 'red') solventsGain = 5;
    if (solventsGain > 0) {
      save.solvents = (save.solvents || 0) + solventsGain;
    }

    const result = { scraps: scrapsGain, solvents: solventsGain };
    this.removeChip(uid); // 内部会save
    return result;
  }

  // ==================== 效果汇总 ====================

  /**
   * 遍历所有已装备芯片，汇总词条效果
   * 同类词条加法叠加
   * @returns {Object} {all_dmg: 0.12, crit_rate: 0.05, ...}
   */
  getStats() {
    const stats = {};
    for (const part in this.equipped) {
      for (const uid of this.equipped[part]) {
        if (uid == null) continue;
        const chip = this.getChipByUid(uid);
        if (!chip) continue;
        const { type, value } = chip.affix;
        stats[type] = (stats[type] || 0) + value;
      }
    }
    return stats;
  }

  /** 快捷获取单个效果值，没有返回0 */
  getStat(affixId) {
    return this.getStats()[affixId] || 0;
  }

  // ==================== 存档读写 ====================

  /** 从saveManager读取芯片相关数据 */

  /**
   * 检查并解锁新部位（通关新章节后调用）
   */
  checkPartUnlock() {
    var ch = this.saveManager.getMaxChapter();
    var unlocked = this.saveManager.getPartsUnlocked();
    var changed = false;
    for (var key in ChipConfig.PARTS) {
      if (ChipConfig.PARTS[key].unlock <= ch && unlocked.indexOf(key) === -1) {
        unlocked.push(key);
        changed = true;
      }
    }
    if (changed) {
      this.saveManager.setPartsUnlocked(unlocked);
    }
  }

  _loadFromSave() {
    const save = this.saveManager.getData();

    this.chips = save.chips || [];
    this.chipUidCounter = save.chipUidCounter || 0;

    // 初始化equipped（确保每个部位都有5槽）
    const defaultEquipped = {};
    for (const part in ChipConfig.PARTS) {
      defaultEquipped[part] = [null, null, null, null, null];
    }
    this.equipped = save.equipped
      ? Object.assign(defaultEquipped, save.equipped)
      : defaultEquipped;
  }

  /** 写回saveManager并触发save() */
  _saveToStorage() {
    const save = this.saveManager.getData();
    save.chips = this.chips;
    save.chipUidCounter = this.chipUidCounter;
    save.equipped = this.equipped;
    this.saveManager.save();
  }
}

module.exports = ChipManager;
