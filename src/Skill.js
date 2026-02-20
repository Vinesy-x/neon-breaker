/**
 * Skill.js - v6.0 升级管理器（武器升级树 + 飞机升级树）
 * 技能宝箱三选一：武器分支升级 / 飞机分支升级 / 新武器
 * 最多4种武器，满后不再出新武器
 */
const Config = require('./Config');
const { createWeapon } = require('./WeaponSystem');

class UpgradeManager {
  constructor() {
    this.weapons = {};       // key -> Weapon instance（最多4个）
    this.shipTree = {};      // 飞机升级树分支等级
    for (const sk in Config.SHIP_TREE) {
      this.shipTree[sk] = 0;
    }
  }

  // ===== 武器操作 =====
  getWeaponCount() { return Object.keys(this.weapons).length; }
  hasWeapon(key) { return !!this.weapons[key]; }

  addWeapon(key) {
    if (this.weapons[key]) return; // 已有
    if (this.getWeaponCount() >= Config.MAX_WEAPONS) return; // 满了
    this.weapons[key] = createWeapon(key);
  }

  upgradeWeaponBranch(weaponKey, branchKey) {
    const weapon = this.weapons[weaponKey];
    if (!weapon) return false;
    return weapon.upgradeBranch(branchKey);
  }

  // ===== 飞机升级 =====
  getShipLevel(key) { return this.shipTree[key] || 0; }

  upgradeShip(key) {
    const def = Config.SHIP_TREE[key];
    if (!def) return false;
    if (this.shipTree[key] >= def.max) return false;
    if (def.requires) {
      for (const rk in def.requires) {
        if ((this.shipTree[rk] || 0) < def.requires[rk]) return false;
      }
    }
    this.shipTree[key]++;
    return true;
  }

  canUpgradeShip(key) {
    const def = Config.SHIP_TREE[key];
    if (!def) return false;
    if (this.shipTree[key] >= def.max) return false;
    if (def.requires) {
      for (const rk in def.requires) {
        if ((this.shipTree[rk] || 0) < def.requires[rk]) return false;
      }
    }
    return true;
  }

  // ===== 飞机被动数值 =====
  getAttackMult()  { return 1.0 + (this.shipTree.attack || 0) * 0.15; }
  getFireRateBonus() { return (this.shipTree.fireRate || 0) * 0.10; }
  getSpreadBonus()  { return this.shipTree.spread || 0; }
  getPierceCount()  { return this.shipTree.pierce || 0; }
  getCritChance()   { return (this.shipTree.crit || 0) * 0.08; }
  getCritDmgMult()  { return 2.0 + (this.shipTree.critDmg || 0) * 0.3; }
  getMoveSpeedMult(){ return 1.0 + (this.shipTree.moveSpeed || 0) * 0.10; }
  getBarrageLv()    { return this.shipTree.barrage || 0; }
  getShieldLv()     { return this.shipTree.shield || 0; }
  hasMagnet()       { return (this.shipTree.magnet || 0) > 0; }

  /** 基础攻击力（供武器伤害计算） */
  getBaseAttack() {
    return Math.max(1, Math.floor(10 * this.getAttackMult()));
  }

  // ===== 生成三选一选项 =====
  generateChoices() {
    const pool = [];
    const weaponCount = this.getWeaponCount();

    // 1. 新武器选项（如果还没满4个）
    if (weaponCount < Config.MAX_WEAPONS) {
      for (const wk in Config.WEAPON_TREES) {
        if (this.weapons[wk]) continue;
        const def = Config.WEAPON_TREES[wk];
        pool.push({
          type: 'newWeapon',
          key: wk,
          name: def.name,
          desc: def.desc,
          icon: def.icon,
          color: def.color,
          priority: 3,
        });
      }
    }

    // 2. 已有武器的分支升级
    for (const wk in this.weapons) {
      const weapon = this.weapons[wk];
      const wDef = Config.WEAPON_TREES[wk];
      for (const bk in wDef.branches) {
        if (!weapon.canUpgrade(bk)) continue;
        const bDef = wDef.branches[bk];
        const curLv = weapon.getBranch(bk);
        pool.push({
          type: 'weaponBranch',
          weaponKey: wk,
          branchKey: bk,
          name: wDef.name + '·' + bDef.name,
          desc: bDef.desc,
          icon: wDef.icon,
          color: wDef.color,
          level: curLv + 1,
          maxLevel: bDef.max,
          priority: curLv === 0 ? 2 : 1,
        });
      }
    }

    // 3. 飞机升级分支
    for (const sk in Config.SHIP_TREE) {
      if (!this.canUpgradeShip(sk)) continue;
      const def = Config.SHIP_TREE[sk];
      const curLv = this.shipTree[sk];
      pool.push({
        type: 'shipBranch',
        key: sk,
        name: '飞机·' + def.name,
        desc: def.desc,
        icon: def.icon,
        color: def.color,
        level: curLv + 1,
        maxLevel: def.max,
        priority: curLv === 0 ? 2 : 1,
      });
    }

    // 排序：优先级高的在前 + 随机打乱
    pool.sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return Math.random() - 0.5;
    });

    // 取3个，尽量保证多样性
    const result = [];
    const types = { newWeapon: [], weaponBranch: [], shipBranch: [] };
    for (const item of pool) {
      types[item.type].push(item);
    }

    // 优先：至少1个武器相关 + 至少1个飞机相关（如果有）
    if (types.newWeapon.length > 0 && weaponCount < 3) {
      result.push(types.newWeapon[0]);
    }
    if (types.weaponBranch.length > 0 && result.length < 3) {
      result.push(types.weaponBranch[0]);
    }
    if (types.shipBranch.length > 0 && result.length < 3) {
      result.push(types.shipBranch[0]);
    }

    // 补满3个
    const used = new Set(result.map(r => r.type + ':' + (r.key || r.weaponKey + ':' + r.branchKey)));
    for (const item of pool) {
      if (result.length >= 3) break;
      const id = item.type + ':' + (item.key || item.weaponKey + ':' + item.branchKey);
      if (used.has(id)) continue;
      used.add(id);
      result.push(item);
    }

    return result;
  }

  // ===== 应用选择 =====
  applyChoice(choice) {
    switch (choice.type) {
      case 'newWeapon':
        this.addWeapon(choice.key);
        return true;
      case 'weaponBranch':
        return this.upgradeWeaponBranch(choice.weaponKey, choice.branchKey);
      case 'shipBranch':
        return this.upgradeShip(choice.key);
    }
    return false;
  }

  // ===== 更新所有武器 =====
  updateWeapons(dtMs, ctx) {
    for (const key in this.weapons) {
      this.weapons[key].update(dtMs, ctx);
    }
  }

  // ===== HUD 显示用列表 =====
  getOwnedWeapons() {
    const list = [];
    for (const key in this.weapons) {
      const w = this.weapons[key];
      const def = Config.WEAPON_TREES[key];
      const totalLv = Object.values(w.branches).reduce((s, v) => s + v, 0);
      list.push({
        key: key,
        icon: def.icon,
        color: def.color,
        name: def.name,
        totalLevel: totalLv,
      });
    }
    return list;
  }

  getShipUpgrades() {
    const list = [];
    for (const sk in this.shipTree) {
      const lv = this.shipTree[sk];
      if (lv > 0) {
        const def = Config.SHIP_TREE[sk];
        list.push({ key: sk, icon: def.icon, color: def.color, name: def.name, level: lv });
      }
    }
    return list;
  }

  // ===== 重置 =====
  reset() {
    this.weapons = {};
    for (const sk in Config.SHIP_TREE) {
      this.shipTree[sk] = 0;
    }
  }
}

module.exports = UpgradeManager;
