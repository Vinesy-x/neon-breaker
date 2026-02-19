/**
 * Launcher.js - 发射器（替代挡板，底部左右移动，自动往上发射子弹）
 */
const Config = require('./Config');

class Launcher {
  constructor(gameAreaWidth, gameAreaHeight) {
    this.width = Config.LAUNCHER_WIDTH;
    this.height = Config.LAUNCHER_HEIGHT;
    this.gameAreaWidth = gameAreaWidth;
    this.x = (gameAreaWidth - this.width) / 2;
    this.y = gameAreaHeight - Config.LAUNCHER_Y_OFFSET;

    this.color = Config.LAUNCHER_COLOR;
    this.fireTimer = 0;
    this.fireInterval = Config.BULLET_FIRE_INTERVAL;
    this.bulletSpeed = Config.BULLET_SPEED;
    this.bulletDamage = 1;
    this.bulletCount = 1; // 每次发射几颗（散射）
    this.spreadAngle = 0; // 散射角度（弧度），0=单发直线

    // 临时增益
    this.fireRateTimer = 0; // 射速增益剩余时间
    this.spreadTimer = 0;   // 散射增益剩余时间

    // 永久增益
    this.permFireRateBonus = 0;  // 永久射速加成（减少间隔%）
    this.permSpreadBonus = 0;    // 永久散射加成
    this.permWidenBonus = 0;     // 永久加宽（碰撞拾取用）

    // 发射口动画
    this.muzzleFlash = 0;
  }

  setX(targetCenterX) {
    this.x = Math.max(0, Math.min(targetCenterX - this.width / 2, this.gameAreaWidth - this.width));
  }

  getCenterX() {
    return this.x + this.width / 2;
  }

  update(dt, dtMs) {
    // 临时增益倒计时
    if (this.fireRateTimer > 0) {
      this.fireRateTimer -= dtMs;
      if (this.fireRateTimer <= 0) this.fireRateTimer = 0;
    }
    if (this.spreadTimer > 0) {
      this.spreadTimer -= dtMs;
      if (this.spreadTimer <= 0) this.spreadTimer = 0;
    }

    // 发射口闪光
    if (this.muzzleFlash > 0) this.muzzleFlash -= dt;
  }

  getFireInterval() {
    let interval = this.fireInterval;
    // 永久射速加成
    interval *= (1 - this.permFireRateBonus);
    // 临时射速加成
    if (this.fireRateTimer > 0) interval *= 0.5;
    return Math.max(80, interval);
  }

  getBulletCount() {
    let count = this.bulletCount;
    if (this.spreadTimer > 0) count += 2;
    count += this.permSpreadBonus;
    return count;
  }

  getSpreadAngle() {
    const count = this.getBulletCount();
    if (count <= 1) return 0;
    // 每多一发子弹扩展一点角度，最大30度
    return Math.min(count * 0.08, Math.PI / 6);
  }

  applyTempFireRate() {
    this.fireRateTimer = 10000; // 10秒
  }

  applyTempSpread() {
    this.spreadTimer = 10000; // 10秒
  }

  applyPermWiden(amount) {
    this.permWidenBonus += amount;
    this.width = Config.LAUNCHER_WIDTH + this.permWidenBonus;
  }

  reset(gameAreaWidth, gameAreaHeight) {
    this.gameAreaWidth = gameAreaWidth;
    this.width = Config.LAUNCHER_WIDTH + this.permWidenBonus;
    this.x = (gameAreaWidth - this.width) / 2;
    this.y = gameAreaHeight - Config.LAUNCHER_Y_OFFSET;
    this.fireTimer = 0;
  }
}

module.exports = Launcher;
