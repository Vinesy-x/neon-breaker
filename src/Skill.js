/**
 * Skill.js - 升级管理器（武器+基础强化+进化）
 * 射击模式版
 */
const Config = require('./Config');
const { createWeapon } = require('./WeaponSystem');

class UpgradeManager {
  constructor() {
    // 武器实例
    this.weapons = {}; // key -> Weapon instance

    // 基础强化等级
    this.buffs = {};
    Config.BUFFS.forEach(b => { this.buffs[b.key] = 0; });

    // 已进化的武器
    this.evolved = {};
  }

  // ===== 武器操作 =====
  hasWeapon(key) { return !!this.weapons[key]; }

  addWeapon(key) {
    if (this.weapons[key]) {
      this.weapons[key].levelUp();
    } else {
      this.weapons[key] = createWeapon(key, 1);
    }
  }

  getWeaponLevel(key) {
    return this.weapons[key] ? this.weapons[key].level : 0;
  }

  // ===== 基础强化 =====
  getBuffLevel(key) { return this.buffs[key] || 0; }

  addBuff(key) {
    this.buffs[key] = (this.buffs[key] || 0) + 1;
  }

  // ===== 进化检查 =====
  checkEvolve() {
    const results = [];
    for (const key in Config.EVOLVE_RECIPES) {
      if (this.evolved[key]) continue;
      const recipe = Config.EVOLVE_RECIPES[key];
      const weapon = this.weapons[recipe.weapon];
      if (!weapon) continue;
      const weaponDef = Config.WEAPONS[recipe.weapon];
      if (weapon.level < weaponDef.maxLevel) continue;
      const buffDef = Config.BUFFS.find(b => b.key === recipe.buff);
      if (!buffDef) continue;
      if ((this.buffs[recipe.buff] || 0) < buffDef.maxLevel) continue;

      // 可以进化！
      weapon.evolve();
      this.evolved[key] = true;
      results.push({
        weaponKey: key,
        name: weaponDef.evolve.name,
        icon: weaponDef.evolve.icon,
        color: weaponDef.evolve.color,
      });
    }
    return results;
  }

  // ===== 被动数值（射击模式） =====
  getFireRateBonus() { return (this.buffs.fireRate || 0) * 0.10; }
  getSpreadBonus() { return this.buffs.spread || 0; }
  getBulletDamageBonus() { return this.buffs.bulletDmg || 0; }
  getCritChance() { return (this.buffs.crit || 0) * 0.15; }
  getPierceCount() { return this.buffs.pierce || 0; }
  hasMagnet() { return (this.buffs.magnet || 0) > 0; }

  getAdvanceSlowMult() {
    // 冰霜领域的减速
    if (this.weapons.iceField) {
      return this.weapons.iceField.getStats().slowMult || 1;
    }
    return 1;
  }

  // ===== 生成升级选项（3选1） =====
  generateChoices() {
    const pool = [];

    // 武器选项（未拥有=新获得，已拥有未满级=升级）
    for (const key in Config.WEAPONS) {
      const def = Config.WEAPONS[key];
      if (this.evolved[key]) continue; // 已进化不再出
      const weapon = this.weapons[key];
      if (weapon && weapon.level >= def.maxLevel) continue; // 满级不出
      const curLv = weapon ? weapon.level : 0;
      pool.push({
        type: 'weapon',
        key: key,
        name: curLv === 0 ? def.name : def.name + ' Lv.' + (curLv + 1),
        desc: curLv === 0 ? def.desc : '升级' + def.desc,
        icon: def.icon,
        color: def.color,
        isNew: curLv === 0,
        priority: curLv === 0 ? 2 : 1, // 新武器优先
      });
    }

    // 基础强化选项
    Config.BUFFS.forEach(def => {
      const cur = this.buffs[def.key] || 0;
      if (cur >= def.maxLevel) return;
      pool.push({
        type: 'buff',
        key: def.key,
        name: def.name + (cur > 0 ? ' Lv.' + (cur + 1) : ''),
        desc: def.desc,
        icon: def.icon,
        color: def.color,
        isNew: cur === 0,
        priority: 0,
      });
    });

    // 按优先级排+随机
    pool.sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return Math.random() - 0.5;
    });

    // 保证至少1个武器选项（如果有）
    const weapons = pool.filter(p => p.type === 'weapon');
    const buffs = pool.filter(p => p.type === 'buff');

    const result = [];
    if (weapons.length > 0) {
      result.push(weapons[0]);
      const rest = weapons.slice(1).concat(buffs);
      // shuffle rest
      for (let i = rest.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [rest[i], rest[j]] = [rest[j], rest[i]];
      }
      for (let i = 0; i < rest.length && result.length < 3; i++) {
        result.push(rest[i]);
      }
    } else {
      for (let i = 0; i < buffs.length && result.length < 3; i++) {
        result.push(buffs[i]);
      }
    }

    return result;
  }

  // ===== 应用选择 =====
  applyChoice(choice) {
    if (choice.type === 'weapon') {
      this.addWeapon(choice.key);
    } else {
      this.addBuff(choice.key);
    }
  }

  // ===== 更新所有武器 =====
  updateWeapons(dtMs, ctx) {
    for (const key in this.weapons) {
      this.weapons[key].update(dtMs, ctx);
    }
  }

  // ===== 获取所有持有物列表（HUD显示用） =====
  getOwnedList() {
    const list = [];
    for (const key in this.weapons) {
      const w = this.weapons[key];
      const def = Config.WEAPONS[key];
      list.push({
        icon: w.evolved ? def.evolve.icon : def.icon,
        color: w.evolved ? def.evolve.color : def.color,
        name: w.evolved ? def.evolve.name : def.name,
        level: w.evolved ? 'MAX' : w.level,
      });
    }
    Config.BUFFS.forEach(def => {
      const lv = this.buffs[def.key] || 0;
      if (lv > 0) {
        list.push({
          icon: def.icon,
          color: def.color,
          name: def.name,
          level: lv,
        });
      }
    });
    return list;
  }

  reset() {
    this.weapons = {};
    this.evolved = {};
    Config.BUFFS.forEach(b => { this.buffs[b.key] = 0; });
  }
}

module.exports = UpgradeManager;
