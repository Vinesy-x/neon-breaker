/**
 * game.js - 微信小游戏入口
 * Neon Breaker - 赛博朋克打砖块
 */

// ===== Polyfills =====
// 某些基础库版本 setTimeout/setInterval 可能未挂到全局
if (typeof setTimeout === 'undefined') {
  // 微信小游戏的 timer 通常在 GameGlobal 上
  if (typeof GameGlobal !== 'undefined') {
    if (GameGlobal.setTimeout) var setTimeout = GameGlobal.setTimeout;
    if (GameGlobal.setInterval) var setInterval = GameGlobal.setInterval;
    if (GameGlobal.clearTimeout) var clearTimeout = GameGlobal.clearTimeout;
    if (GameGlobal.clearInterval) var clearInterval = GameGlobal.clearInterval;
  }
}

// 第一次调用 wx.createCanvas() 获取主屏幕 canvas
const canvas = wx.createCanvas();

// 保持屏幕常亮
if (wx.setKeepScreenOn) wx.setKeepScreenOn({ keepScreenOn: true });

// Canvas roundRect polyfill（覆盖原生实现，解决参数兼容性问题）
(function() {
  const ctx = canvas.getContext('2d');
  const proto = Object.getPrototypeOf(ctx);
  proto.roundRect = function(x, y, w, h, radii) {
    let r = 0;
    if (typeof radii === 'number') {
      r = radii;
    } else if (Array.isArray(radii)) {
      r = radii[0] || 0;
    }
    if (r < 0) r = 0;
    if (w <= 0 || h <= 0) return this;
    if (r > w / 2) r = w / 2;
    if (r > h / 2) r = h / 2;
    this.moveTo(x + r, y);
    this.lineTo(x + w - r, y);
    this.arcTo(x + w, y, x + w, y + h, r);
    this.lineTo(x + w, y + h - r);
    this.arcTo(x + w, y + h, x, y + h, r);
    this.lineTo(x + r, y + h);
    this.arcTo(x, y + h, x, y, r);
    this.lineTo(x, y + r);
    this.arcTo(x, y, x + w, y, r);
    this.closePath();
    return this;
  };
})();

const Game = require('./src/Game');

// 创建游戏实例
const game = new Game(canvas);

// 游戏主循环
function gameLoop(timestamp) {
  game.update(timestamp);
  game.render();
  requestAnimationFrame(gameLoop);
}

// 启动游戏循环
requestAnimationFrame(gameLoop);
