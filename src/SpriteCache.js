/**
 * SpriteCache.js - 离屏canvas精灵缓存
 * 把复杂的色块拼凑预渲染成图片，运行时只需 drawImage
 * 
 * 微信小游戏中 wx.createCanvas() 第2次起 = 离屏canvas
 */

class SpriteCache {
  constructor() {
    this._cache = {}; // key -> { canvas, w, h, ox, oy }
  }

  /**
   * 获取或创建缓存精灵
   * @param {string} key - 缓存key
   * @param {number} w - canvas宽
   * @param {number} h - canvas高
   * @param {number} ox - 原点x偏移（绘制中心）
   * @param {number} oy - 原点y偏移
   * @param {function} drawFn - (ctx) => void 绘制函数
   */
  getOrCreate(key, w, h, ox, oy, drawFn) {
    if (this._cache[key]) return this._cache[key];

    const dpr = 2; // 固定2x清晰度
    const canvas = wx.createCanvas();
    canvas.width = Math.ceil(w * dpr);
    canvas.height = Math.ceil(h * dpr);
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    drawFn(ctx);

    const sprite = { canvas, w, h, ox, oy, dpr };
    this._cache[key] = sprite;
    return sprite;
  }

  /**
   * 在目标ctx上绘制缓存精灵
   * @param {CanvasRenderingContext2D} ctx - 目标上下文
   * @param {string} key - 缓存key
   * @param {number} x - 世界坐标x
   * @param {number} y - 世界坐标y
   * @param {number} rotation - 旋转弧度
   * @param {number} scale - 缩放
   */
  draw(ctx, key, x, y, rotation, scale) {
    const sprite = this._cache[key];
    if (!sprite) return;

    ctx.save();
    ctx.translate(x, y);
    if (rotation) ctx.rotate(rotation);
    if (scale && scale !== 1) ctx.scale(scale, scale);

    ctx.drawImage(
      sprite.canvas,
      -sprite.ox, -sprite.oy,
      sprite.w, sprite.h
    );
    ctx.restore();
  }

  /** 预热：创建所有武器精灵 */
  warmup() {
    this._createMortarShell();
    this._createMissile();
    this._createBullet();
    this._createExpOrb();
  }

  // ===== 迫击炮弹 =====
  _createMortarShell() {
    // 基础尺寸的炮弹（scale=1）
    const w = 24, h = 16;
    const ox = 12, oy = 8; // 中心

    this.getOrCreate('mortar_shell', w, h, ox, oy, (ctx) => {
      const cx = 12, cy = 8;

      // 弹体主体
      ctx.fillStyle = '#00FFFF';
      ctx.beginPath();
      ctx.moveTo(cx + 6, cy - 3.5);
      ctx.lineTo(cx - 6, cy - 3.5);
      ctx.lineTo(cx - 6, cy + 3.5);
      ctx.lineTo(cx + 6, cy + 3.5);
      ctx.closePath();
      ctx.fill();

      // 弹头（半圆）
      ctx.beginPath();
      ctx.arc(cx + 6, cy, 3.5, -Math.PI / 2, Math.PI / 2);
      ctx.fill();

      // 弹头高光
      ctx.fillStyle = '#FFFFFF';
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.arc(cx + 7, cy - 1, 2, 0, Math.PI * 2);
      ctx.fill();

      // 条纹
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = '#004466';
      ctx.fillRect(cx - 1, cy - 3.5, 2, 7);
      ctx.fillRect(cx + 3, cy - 3.5, 1.5, 7);

      // 尾翼
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = '#006688';
      ctx.beginPath();
      ctx.moveTo(cx - 6, cy - 3.5);
      ctx.lineTo(cx - 11, cy - 6);
      ctx.lineTo(cx - 9, cy - 3.5);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx - 6, cy + 3.5);
      ctx.lineTo(cx - 11, cy + 6);
      ctx.lineTo(cx - 9, cy + 3.5);
      ctx.closePath();
      ctx.fill();

      // 尾翼内线
      ctx.strokeStyle = '#00AACC';
      ctx.lineWidth = 0.5;
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.moveTo(cx - 6, cy - 3); ctx.lineTo(cx - 9.5, cy - 5);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - 6, cy + 3); ctx.lineTo(cx - 9.5, cy + 5);
      ctx.stroke();

      // 尾部火焰
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = '#FF8844';
      ctx.beginPath();
      ctx.moveTo(cx - 6, cy - 2);
      ctx.lineTo(cx - 10, cy);
      ctx.lineTo(cx - 6, cy + 2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#FFDD44';
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.moveTo(cx - 6, cy - 1);
      ctx.lineTo(cx - 8, cy);
      ctx.lineTo(cx - 6, cy + 1);
      ctx.closePath();
      ctx.fill();
    });
  }

  // ===== 导弹 =====
  _createMissile() {
    const w = 14, h = 14;
    const ox = 7, oy = 7;

    this.getOrCreate('missile', w, h, ox, oy, (ctx) => {
      const cx = 7, cy = 7;
      // 弹体
      ctx.fillStyle = '#FF14FF';
      ctx.beginPath();
      ctx.arc(cx, cy, 5, 0, Math.PI * 2);
      ctx.fill();
      // 高光
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(cx, cy - 1, 2, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // ===== 子弹 =====
  _createBullet() {
    const w = 10, h = 10;
    const ox = 5, oy = 5;

    // 普通子弹
    this.getOrCreate('bullet', w, h, ox, oy, (ctx) => {
      ctx.fillStyle = '#00FFFF';
      ctx.beginPath(); ctx.arc(5, 5, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath(); ctx.arc(5, 5, 1.6, 0, Math.PI * 2); ctx.fill();
    });

    // 火弹
    this.getOrCreate('bullet_fire', w, h, ox, oy, (ctx) => {
      ctx.fillStyle = '#FF4400';
      ctx.beginPath(); ctx.arc(5, 5, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath(); ctx.arc(5, 5, 1.6, 0, Math.PI * 2); ctx.fill();
    });

    // 冰弹
    this.getOrCreate('bullet_ice', w, h, ox, oy, (ctx) => {
      ctx.fillStyle = '#44DDFF';
      ctx.beginPath(); ctx.arc(5, 5, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath(); ctx.arc(5, 5, 1.6, 0, Math.PI * 2); ctx.fill();
    });

    // 雷弹
    this.getOrCreate('bullet_thunder', w, h, ox, oy, (ctx) => {
      ctx.fillStyle = '#FFF050';
      ctx.beginPath(); ctx.arc(5, 5, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath(); ctx.arc(5, 5, 1.6, 0, Math.PI * 2); ctx.fill();
    });
  }

  // ===== 经验球 =====
  _createExpOrb() {
    const w = 10, h = 10;
    const ox = 5, oy = 5;

    this.getOrCreate('exp_orb', w, h, ox, oy, (ctx) => {
      ctx.fillStyle = '#AAFFFF';
      ctx.beginPath(); ctx.arc(5, 5, 4, 0, Math.PI * 2); ctx.fill();
    });
  }
}

module.exports = SpriteCache;
