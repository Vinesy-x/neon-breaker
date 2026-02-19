/**
 * Paddle.js - 挡板
 */
const Config = require('./Config');

class Paddle {
  constructor(gameAreaWidth, gameAreaHeight) {
    this.baseWidth = Config.PADDLE_WIDTH;
    this.width = this.baseWidth;
    this.height = Config.PADDLE_HEIGHT;
    this.gameAreaWidth = gameAreaWidth;
    this.x = (gameAreaWidth - this.width) / 2;
    this.y = gameAreaHeight - Config.PADDLE_Y_OFFSET;
    this.color = Config.PADDLE_COLOR;
    this.widenTimer = 0; // 临时加宽计时
    this.permWidenBonus = 0; // 永久加宽
  }

  setX(targetX) {
    this.x = Math.max(0, Math.min(targetX - this.width / 2, this.gameAreaWidth - this.width));
  }

  update(dt) {
    if (this.widenTimer > 0) {
      this.widenTimer -= dt * 16.67; // 近似毫秒
      if (this.widenTimer <= 0) {
        this.widenTimer = 0;
        this.width = this.baseWidth + this.permWidenBonus;
      }
    }
  }

  applyTempWiden() {
    this.width = this.baseWidth + this.permWidenBonus + 50;
    this.widenTimer = 15000; // 15秒
  }

  applyPermWiden(amount) {
    this.permWidenBonus += amount;
    if (this.widenTimer <= 0) {
      this.width = this.baseWidth + this.permWidenBonus;
    }
  }

  reset(gameAreaWidth, gameAreaHeight) {
    this.gameAreaWidth = gameAreaWidth;
    this.width = this.baseWidth + this.permWidenBonus;
    this.x = (gameAreaWidth - this.width) / 2;
    this.y = gameAreaHeight - Config.PADDLE_Y_OFFSET;
  }

  getCenterX() {
    return this.x + this.width / 2;
  }
}

module.exports = Paddle;
