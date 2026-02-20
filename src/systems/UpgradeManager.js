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
const { createWeapon } = require('../weapons/WeaponFactory');

class UpgradeManager {
  constructor() {
    this.weapons = {};       // key -> Weapon (最多4个)
    this.shipTree = {};      // 飞机升级树分支等级
    for (const sk in Config.SHIP_TREE) this.shipTree[sk] = 0;
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
    // 互斥组检查：如果该分支有互斥组，且已选了同组其他分支，则不允许
    if (def.exclusiveGroup) {
      for (const sk in Config.SHIP_TREE) {
        if (sk === key) continue;
        const sDef = Config.SHIP_TREE[sk];
        if (sDef.exclusiveGroup === def.exclusiveGroup && (this.shipTree[sk] || 0) > 0) {
          return false;
        }
      }
    }
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
    // 互斥组：已选了同组其他分支则不可选
    if (def.exclusiveGroup) {
      for (const sk in Config.SHIP_TREE) {
        if (sk === key) continue;
        const sDef = Config.SHIP_TREE[sk];
        if (sDef.exclusiveGroup === def.exclusiveGroup && (this.shipTree[sk] || 0) > 0) {
          return false;
        }
      }
    }
    return true;
  }

  // ===== 飞机被动数值 =====

  /** 子弹伤害倍率: 1.0 + lv * 0.5 */
  getAttackMult() { return 1.0 + (this.shipTree.attack || 0) * 0.5; }

  /** 射速倍率: 1.0 + lv * 0.5（用于缩短射击间隔） */
  getFireRateMult() { return 1.0 + (this.shipTree.fireRate || 0) * 0.5; }

  /** 散射额外弹道数 */
  getSpreadBonus() { return this.shipTree.spread || 0; }

  /** 穿透层数 */
  getPierceCount() { return this.shipTree.pierce || 0; }

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

    // 新武器（<4个时）
    if (weaponCount < Config.MAX_WEAPONS) {
      for (const wk in Config.WEAPON_TREES) {
        if (this.weapons[wk]) continue;
        const def = Config.WEAPON_TREES[wk];
        pool.push({ type: 'newWeapon', key: wk, name: def.name, desc: def.desc, icon: def.icon, color: def.color, priority: 3 });
      }
    }

    // 已有武器分支升级
    for (const wk in this.weapons) {
      const weapon = this.weapons[wk];
      const wDef = Config.WEAPON_TREES[wk];
      for (const bk in wDef.branches) {
        if (!weapon.canUpgrade(bk)) continue;
        const bDef = wDef.branches[bk];
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
    for (const sk in Config.SHIP_TREE) {
      if (!this.canUpgradeShip(sk)) continue;
      const def = Config.SHIP_TREE[sk];
      const curLv = this.shipTree[sk];
      // 品质影响优先级
      let priority = curLv === 0 ? 2 : 1;
      if (def.quality === 'rare') priority = curLv === 0 ? 3 : 2;
      if (def.quality === 'exclusive') priority = curLv === 0 ? 3 : 2;

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
