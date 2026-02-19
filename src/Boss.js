/**
 * Boss.js - Boss 战（简化版，无子弹，纯受击）
 */
const Config = require('./Config');

class Boss {
  constructor(level, gameAreaWidth) {
    this.width = Config.BOSS_WIDTH;
    this.height = Config.BOSS_HEIGHT;
    this.x = (gameAreaWidth - this.width) / 2;
    this.y = 60;
    this.gameAreaWidth = gameAreaWidth;
    this.alive = true;
    this.speed = Config.BOSS_SPEED + level * 0.3;
    this.direction = 1;

    // 3阶段 HP
    const levelCoeff = 1 + (level - 1) * 0.25;
    this.phaseHP = Config.BOSS_BASE_HP.map(hp => Math.floor(hp * levelCoeff));
    this.phase = 0;
    this.maxHp = this.phaseHP[0] + this.phaseHP[1] + this.phaseHP[2];
    this.hp = this.maxHp;
    this.phaseThresholds = [
      this.phaseHP[1] + this.phaseHP[2],
      this.phaseHP[2],
      0,
    ];

    this.flashTimer = 0;
    this.phaseChangeFlash = 0;
  }

  update(dtMs) {
    const dt = dtMs / 16.67;

    // 左右移动，越低阶段越快
    const speedMult = 1 + this.phase * 0.3;
    this.x += this.speed * speedMult * this.direction * dt;
    if (this.x <= 0) {
      this.x = 0;
      this.direction = 1;
    }
    if (this.x + this.width >= this.gameAreaWidth) {
      this.x = this.gameAreaWidth - this.width;
      this.direction = -1;
    }

    if (this.flashTimer > 0) this.flashTimer -= dtMs;
    if (this.phaseChangeFlash > 0) this.phaseChangeFlash -= dtMs;
  }

  hit(damage) {
    this.hp -= (damage || 1);
    this.flashTimer = 100;

    const oldPhase = this.phase;
    if (this.hp <= this.phaseThresholds[0] && this.phase === 0) {
      this.phase = 1;
    }
    if (this.hp <= this.phaseThresholds[1] && this.phase <= 1) {
      this.phase = 2;
    }
    if (this.phase !== oldPhase) {
      this.phaseChangeFlash = 500;
      this.speed += 0.5;
    }

    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
      return true;
    }
    return false;
  }

  getCenterX() { return this.x + this.width / 2; }
  getCenterY() { return this.y + this.height / 2; }
  getHpRatio() { return this.hp / this.maxHp; }

  getPhaseColor() {
    const colors = [Config.NEON_CYAN, Config.NEON_YELLOW, Config.NEON_PINK];
    return colors[this.phase] || Config.NEON_PINK;
  }
}

module.exports = Boss;
