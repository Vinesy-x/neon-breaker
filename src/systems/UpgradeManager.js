/**
 * UpgradeManager.js - 升级管理器 v7.1
 * 管理武器升级树 + 飞机升级树 + 三选一生成
 *
 * 飞机升级公式：
 *   - attack:    伤害倍率 = 1.0 + lv * 0.5
 *   - fireRate:  射速倍率 = 1.0 + lv * 0.5（加法叠加，满4级=3倍射速）
 *   - spread:    散射数 = lv（0~3）
 *   - pierce:    穿透层数 = lv（0~5）
 *   - fireBullet/iceBullet/thunderBullet: 互斥元素弹
 */
const Config = require('../Config');
const WeaponUnlockConfig = require('../config/WeaponUnlockConfig');
const { createWeapon } = require('../weapons/WeaponFactory');
const SaveManager = require('./SaveManager');

class UpgradeManager {
  constructor(saveManager) {
    this.weapons = {};       // key -> Weapon (最多4个)
    this.shipTree = {};      // 飞机升级树分支等级
    for (const sk in Config.SHIP_TREE) this.shipTree[sk] = 0;
    this.currentChapter = 1; // 当前章节（用于武器解锁过滤）
    this.saveManager = saveManager || null; // 武器商店等级检查
  }

  // 武器解锁章节映射（冰爆弹和闪电链默认拥有）
  // 武器解锁配置统一在 WeaponUnlockConfig.js

  setChapter(chapter) { this.currentChapter = chapter; }

  isWeaponUnlocked(key) {
    const cfg = WeaponUnlockConfig[key];
    const unlockChapter = cfg ? cfg.unlockChapter : 999;
    return this.currentChapter >= unlockChapter;
  }

  // ===== 武器操作 =====
  getWeaponCount() { return Object.keys(this.weapons).length; }
  hasWeapon(key) { return !!this.weapons[key]; }

  addWeapon(key) {
    if (this.weapons[key] || this.getWeaponCount() >= Config.MAX_WEAPONS) return;
    this.weapons[key] = createWeapon(key);
  }

  upgradeWeaponBranch(weaponKey, branchKey) {
    const weapon = this.weapons[weaponKey];
    return weapon ? weapon.upgradeBranch(branchKey) : false;
  }

  // ===== 飞机升级 =====
  getShipLevel(key) { return this.shipTree[key] || 0; }

  upgradeShip(key) {
    const def = Config.SHIP_TREE[key];
    if (!def || this.shipTree[key] >= def.max) return false;
    if (def.requires) {
      for (const rk in def.requires) {
        if ((this.shipTree[rk] || 0) < def.requires[rk]) return false;
      }
    }
    if (def.exclusiveGroup && !this._checkExclusive(key, def)) return false;
    this.shipTree[key]++;
    return true;
  }

  canUpgradeShip(key) {
    const def = Config.SHIP_TREE[key];
    if (!def || this.shipTree[key] >= def.max) return false;
    if (def.requires) {
      for (const rk in def.requires) {
        if ((this.shipTree[rk] || 0) < def.requires[rk]) return false;
      }
    }
    if (def.exclusiveGroup && !this._checkExclusive(key, def)) return false;
    return true;
  }

  /** 互斥组检查：允许同一进阶线（requires链上的祖先） */
  _checkExclusive(key, def) {
    for (const sk in Config.SHIP_TREE) {
      if (sk === key) continue;
      const sDef = Config.SHIP_TREE[sk];
      if (sDef.exclusiveGroup === def.exclusiveGroup && (this.shipTree[sk] || 0) > 0) {
        // 如果冲突分支在自己的 requires 链上，允许（同一进阶线）
        if (this._isInRequiresChain(key, sk)) continue;
        // 如果自己在冲突分支的 requires 链上，也允许
        if (this._isInRequiresChain(sk, key)) continue;
        return false;
      }
    }
    return true;
  }

  _isInRequiresChain(targetKey, ancestorKey) {
    const def = Config.SHIP_TREE[targetKey];
    if (!def || !def.requires) return false;
    for (const rk in def.requires) {
      if (rk === ancestorKey) return true;
      if (this._isInRequiresChain(rk, ancestorKey)) return true;
    }
    return false;
  }

  // ===== 飞机被动数值 =====

  /** 子弹伤害倍率: 1.0 + lv * 0.5 */
  getAttackMult() { return 1.0 + (this.shipTree.attack || 0) * 0.5; }

  /** 射速倍率: 1.0 + lv * 0.5（用于缩短射击间隔） */
  getFireRateMult() { return 1.0 + (this.shipTree.fireRate || 0) * 0.5; }

  /** 散射额外弹道数 */
  getSpreadBonus() { return this.shipTree.spread || 0; }

  /** 穿透层数（已移除pierce分支，基础为0） */
  getPierceCount() { return 0; }

  /** 基础攻击力 = floor(10 * attackMult) */
  getBaseAttack() { return Math.max(1, 10 * this.getAttackMult()); }

  // ===== 元素弹 =====

  /** 获取当前激活的元素类型: 'fire' | 'ice' | 'thunder' | null */
  getElementType() {
    if ((this.shipTree.fireBullet || 0) > 0) return 'fire';
    if ((this.shipTree.iceBullet || 0) > 0) return 'ice';
    if ((this.shipTree.thunderBullet || 0) > 0) return 'thunder';
    return null;
  }

  /** 获取元素等级 */
  getElementLevel() {
    return (this.shipTree.fireBullet || 0)
         + (this.shipTree.iceBullet || 0)
         + (this.shipTree.thunderBullet || 0);
  }

  // ===== 三选一生成 =====
  generateChoices() {
    const pool = [];
    const weaponCount = this.getWeaponCount();

    // 新武器（<4个时，且已解锁）
    if (weaponCount < Config.MAX_WEAPONS) {
      for (const wk in Config.WEAPON_TREES) {
        if (this.weapons[wk]) continue;
        if (!this.isWeaponUnlocked(wk)) continue; // 过滤未解锁
        const def = Config.WEAPON_TREES[wk];
        pool.push({ type: 'newWeapon', key: wk, name: def.name, desc: def.desc, icon: def.icon, color: def.color, priority: 3 });
      }
    }

    // 已有武器分支升级
    for (const wk in this.weapons) {
      const weapon = this.weapons[wk];
      const wDef = Config.WEAPON_TREES[wk];
      // 获取武器商店等级门槛信息
      const shopUnlocks = SaveManager.getWeaponUnlocks(wk);
      const shopLevel = this.saveManager ? this.saveManager.getWeaponLevel(wk) : 99;
      // 构建"需要商店等级X才解锁"的分支集合
      const gatedBranches = {};
      for (const u of shopUnlocks) gatedBranches[u.branchKey] = u.level;

      for (const bk in wDef.branches) {
        if (!weapon.canUpgrade(bk)) continue;
        const bDef = wDef.branches[bk];
        // 检查武器商店等级门槛
        if (gatedBranches[bk] && shopLevel < gatedBranches[bk]) continue;
        // 双重检查 requires 前置条件
        if (bDef.requires) {
          let reqMet = true;
          for (const rk in bDef.requires) {
            if ((weapon.branches[rk] || 0) < bDef.requires[rk]) { reqMet = false; break; }
          }
          if (!reqMet) continue;
        }
        const curLv = weapon.getBranch(bk);
        pool.push({
          type: 'weaponBranch', weaponKey: wk, branchKey: bk,
          name: wDef.name + '·' + bDef.name, desc: bDef.desc,
          icon: wDef.icon, color: wDef.color,
          level: curLv + 1, maxLevel: bDef.max,
          priority: curLv === 0 ? 2 : 1,
        });
      }
    }

    // 飞机升级
    const shipUnlocks = SaveManager.getWeaponUnlocks('ship');
    const shipShopLevel = this.saveManager ? this.saveManager.getWeaponLevel('ship') : 99;
    const shipGated = {};
    for (const u of shipUnlocks) shipGated[u.branchKey] = u.level;

    for (const sk in Config.SHIP_TREE) {
      const def = Config.SHIP_TREE[sk];
      if (def.hidden) continue;  // 隐藏分支不出现在技能选择
      if (!this.canUpgradeShip(sk)) continue;
      // shopGated分支需要商店解锁
      if (def.shopGated && shipGated[sk] && shipShopLevel < shipGated[sk]) continue;
      const curLv = this.shipTree[sk];
      // 品质三档权重：normal最常见，rare适中，exclusive(元素弹)最稀有
      //   normal:    首次=3, 继续=2
      //   rare:      首次=2, 继续=1
      //   exclusive: 首次=1, 继续=1
      let priority;
      if (def.quality === 'exclusive') { priority = 1; }
      else if (def.quality === 'rare') { priority = curLv === 0 ? 2 : 1; }
      else { priority = curLv === 0 ? 3 : 2; }

      pool.push({
        type: 'shipBranch', key: sk,
        name: '飞机·' + def.name, desc: def.desc,
        icon: def.icon, color: def.color,
        level: curLv + 1, maxLevel: def.max,
        priority: priority,
        quality: def.quality || 'normal',
      });
    }

    // 排序 + 取3个
    pool.sort((a, b) => b.priority !== a.priority ? b.priority - a.priority : Math.random() - 0.5);

    const result = [];
    const types = { newWeapon: [], weaponBranch: [], shipBranch: [] };
    for (const item of pool) types[item.type].push(item);

    if (types.newWeapon.length > 0 && weaponCount < 3) result.push(types.newWeapon[0]);
    if (types.weaponBranch.length > 0 && result.length < 3) result.push(types.weaponBranch[0]);
    if (types.shipBranch.length > 0 && result.length < 3) result.push(types.shipBranch[0]);

    const used = new Set(result.map(r => r.type + ':' + (r.key || r.weaponKey + ':' + r.branchKey)));
    for (const item of pool) {
      if (result.length >= 3) break;
      const id = item.type + ':' + (item.key || item.weaponKey + ':' + item.branchKey);
      if (!used.has(id)) { used.add(id); result.push(item); }
    }
    return result;
  }

  // ===== 应用选择 =====
  applyChoice(choice) {
    switch (choice.type) {
      case 'newWeapon': this.addWeapon(choice.key); return true;
      case 'weaponBranch': return this.upgradeWeaponBranch(choice.weaponKey, choice.branchKey);
      case 'shipBranch': return this.upgradeShip(choice.key);
    }
    return false;
  }

  // ===== 更新武器 =====
  updateWeapons(dtMs, ctx) {
    for (const key in this.weapons) this.weapons[key].update(dtMs, ctx);
  }

  // ===== HUD数据 =====
  getOwnedWeapons() {
    const list = [];
    for (const key in this.weapons) {
      const w = this.weapons[key];
      const def = Config.WEAPON_TREES[key];
      list.push({ key, icon: def.icon, color: def.color, name: def.name, totalLevel: w.getTotalLevel() });
    }
    return list;
  }

  // ===== 重置 =====
  reset() {
    this.weapons = {};
    for (const sk in Config.SHIP_TREE) this.shipTree[sk] = 0;
  }
}

module.exports = UpgradeManager;
