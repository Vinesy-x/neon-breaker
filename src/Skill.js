/**
 * Skill.js - 被动技能管理器
 * v2.0 - 全被动，不需要手动释放
 */

class PassiveManager {
  constructor() {
    // 升级等级
    this.levels = {
      extraBall: 0,
      ballSpeed: 0,
      pierce: 0,
      splitOnBrick: 0,
      widerPaddle: 0,
      chain: 0,
      explosion: 0,
      crit: 0,
      extraLife: 0,
      lifesteal: 0,
      slowAdvance: 0,
      magnet: 0,
    };
  }

  getLevel(key) {
    return this.levels[key] || 0;
  }

  upgrade(key) {
    this.levels[key] = (this.levels[key] || 0) + 1;
  }

  // === 被动数值计算 ===

  /** 起始球数 */
  getStartBallCount() {
    return 1 + this.levels.extraBall;
  }

  /** 球速系数 */
  getBallSpeedMult() {
    return 1 + this.levels.ballSpeed * 0.12;
  }

  /** 穿透层数 */
  getPierceCount() {
    return this.levels.pierce;
  }

  /** 击砖分裂 */
  canSplitOnBrick() {
    return this.levels.splitOnBrick > 0;
  }

  /** 分裂概率 */
  getSplitChance() {
    return this.levels.splitOnBrick > 0 ? 0.2 : 0;
  }

  /** 挡板加宽量 */
  getPaddleBonus() {
    return this.levels.widerPaddle * 25;
  }

  /** 连锁概率 */
  getChainChance() {
    return this.levels.chain * 0.3;
  }

  /** 连锁最大跳跃数 */
  getChainBounces() {
    return this.levels.chain;
  }

  /** 爆炸半径 */
  getExplosionRadius() {
    return this.levels.explosion * 35;
  }

  /** 暴击概率 */
  getCritChance() {
    return this.levels.crit * 0.15;
  }

  /** 暴击倍率 */
  getCritMult() {
    return 2.0;
  }

  /** 吸血概率 */
  getLifestealChance() {
    return this.levels.lifesteal * 0.05;
  }

  /** 砖块前移减速系数 */
  getAdvanceSlowMult() {
    return Math.pow(0.75, this.levels.slowAdvance);
  }

  /** 磁力吸附 */
  hasMagnet() {
    return this.levels.magnet > 0;
  }

  reset() {
    for (const key in this.levels) {
      this.levels[key] = 0;
    }
  }
}

module.exports = PassiveManager;
