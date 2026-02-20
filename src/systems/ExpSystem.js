/**
 * ExpSystem.js - 经验值系统
 * 管理经验球、经验条、升级触发
 */
const Config = require('../Config');
const Sound = require('./SoundManager');

class ExpSystem {
  constructor() {
    this.playerLevel = 1;
    this.exp = 0;
    this.expToNext = this._calcExpToLevel(1);
    this.orbs = [];
    this.pendingLevelUps = 0;
  }

  reset() {
    this.playerLevel = 1;
    this.exp = 0;
    this.expToNext = this._calcExpToLevel(1);
    this.orbs = [];
    this.pendingLevelUps = 0;
  }

  _calcExpToLevel(lv) {
    return 80 + (lv - 1) * 50 + (lv - 1) * (lv - 1) * 5;
  }

  /** 击碎砖块时调用，生成经验球 */
  spawnOrbs(x, y, totalExp, expMultiplier) {
    totalExp = Math.floor(totalExp * (expMultiplier || 1));
    const orbCount = Math.min(Math.ceil(totalExp / 5), 5);
    const perOrb = totalExp / orbCount;
    for (let i = 0; i < orbCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 2;
      this.orbs.push({
        x: x, y: y,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        value: Math.ceil(perOrb), life: 0,
      });
    }
  }

  /** 计算砖块经验值 */
  calcBrickExp(brick) {
    let expValue = Config.EXP_PER_BRICK + brick.maxHp * Config.EXP_PER_HP;
    switch (brick.type) {
      case 'shield':  expValue += 2; break;
      case 'split':   expValue += 1; break;
      case 'stealth': expValue += 3; break;
      case 'healer':  expValue += 4; break;
    }
    return expValue;
  }

  /** 每帧更新经验球 */
  update(dt) {
    const targetX = Config.SCREEN_WIDTH / 2;
    const targetY = Config.SCREEN_HEIGHT - Config.EXP_BAR_Y_OFFSET;

    for (let i = this.orbs.length - 1; i >= 0; i--) {
      const orb = this.orbs[i];
      orb.life += dt;

      if (orb.life < 8) {
        orb.x += orb.vx * dt;
        orb.y += orb.vy * dt;
        orb.vx *= 0.95;
        orb.vy *= 0.95;
      } else {
        const dx = targetX - orb.x, dy = targetY - orb.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const speed = Config.EXP_ORB_SPEED + orb.life * 0.3;
        if (dist > 3) {
          orb.x += (dx / dist) * speed * dt;
          orb.y += (dy / dist) * speed * dt;
        }
        if (dist < 20) {
          Sound.expCollect();
          this._addExp(orb.value);
          this.orbs.splice(i, 1);
          continue;
        }
      }

      if (orb.life > 80) {
        this._addExp(orb.value);
        this.orbs.splice(i, 1);
      }
    }
  }

  _addExp(amount) {
    this.exp += amount;
    while (this.exp >= this.expToNext) {
      this.exp -= this.expToNext;
      this.playerLevel++;
      this.expToNext = this._calcExpToLevel(this.playerLevel);
      this.pendingLevelUps++;
      Sound.levelUp();
    }
  }

  /** 公共接口：直接加经验（dev用） */
  addExp(amount) {
    this._addExp(amount);
  }

  /** 消费一个待处理的升级 */
  consumeLevelUp() {
    if (this.pendingLevelUps > 0) {
      this.pendingLevelUps--;
      return true;
    }
    return false;
  }

  hasPendingLevelUp() {
    return this.pendingLevelUps > 0;
  }
}

module.exports = ExpSystem;
