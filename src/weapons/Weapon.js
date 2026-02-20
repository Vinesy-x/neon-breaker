/**
 * Weapon.js - 武器基类
 * 所有武器继承此类，提供分支升级和伤害计算
 */
const Config = require('../Config');

class Weapon {
  constructor(key) {
    this.key = key;
    this.def = Config.WEAPON_TREES[key];
    this.timer = 0;
    this.branches = {};
    for (const bk in this.def.branches) this.branches[bk] = 0;
  }

  getBranch(key) { return this.branches[key] || 0; }

  upgradeBranch(key) {
    const bDef = this.def.branches[key];
    if (!bDef || this.branches[key] >= bDef.max) return false;
    if (bDef.requires) {
      for (const rk in bDef.requires) {
        if ((this.branches[rk] || 0) < bDef.requires[rk]) return false;
      }
    }
    this.branches[key]++;
    return true;
  }

  canUpgrade(branchKey) {
    const bDef = this.def.branches[branchKey];
    if (!bDef || this.branches[branchKey] >= bDef.max) return false;
    if (bDef.requires) {
      for (const rk in bDef.requires) {
        if ((this.branches[rk] || 0) < bDef.requires[rk]) return false;
      }
    }
    return true;
  }

  /** 武器伤害 = baseAttack * (basePct + damageLv * 0.5) */
  getDamage(baseAttack) {
    return Math.max(1, Math.floor(baseAttack * (this.def.basePct + (this.branches.damage || 0) * 0.5)));
  }

  getTotalLevel() {
    let sum = 0;
    for (const k in this.branches) sum += this.branches[k];
    return sum;
  }

  update(dtMs, ctx) { /* override */ }
  getRenderData() { return null; }
  getWingData(lcx, lcy) { return null; }
}

module.exports = Weapon;
