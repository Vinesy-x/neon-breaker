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

    const dpr = 1.5; // 1.5x够清晰，省内存
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
    this._createGlow();
    this._createWeaponIcons();
  }

  // ===== 寒冰弹 =====
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

  // ===== Glow 发光精灵 =====
  _createGlow() {
    // 子弹用 Glow（小号，24x24）
    // 用多层半透明圆模拟径向渐变，避免 createRadialGradient 性能问题
    const colors = {
      cyan: '#00FFFF',
      fire: '#FF4400',
      ice: '#44DDFF',
      thunder: '#FFF050',
      white: '#FFFFFF',
    };

    for (const name in colors) {
      const color = colors[name];
      const w = 24, h = 24, ox = 12, oy = 12;
      this.getOrCreate('glow_' + name, w, h, ox, oy, (ctx) => {
        const cx = 12, cy = 12;
        const layers = [
          { r: 11, a: 0.1 },
          { r: 8,  a: 0.18 },
          { r: 5,  a: 0.3 },
          { r: 3,  a: 0.5 },
        ];
        for (const l of layers) {
          ctx.globalAlpha = l.a;
          ctx.fillStyle = color;
          ctx.beginPath(); ctx.arc(cx, cy, l.r, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 0.6;
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath(); ctx.arc(cx, cy, 2, 0, Math.PI * 2); ctx.fill();
      });
    }
  }

  // ===== 武器图标精灵（32×32，用于HUD和选择面板） =====
  _createWeaponIcons() {
    const S = 32, C = 16;

    // --- 寒冰弹：弹体 ---
    this.getOrCreate('wicon_kunai', S, S, C, C, (ctx) => {
      ctx.fillStyle = '#00FFFF';
      ctx.beginPath();
      ctx.moveTo(C + 8, C); ctx.lineTo(C + 3, C - 6); ctx.lineTo(C - 7, C - 6);
      ctx.lineTo(C - 7, C + 6); ctx.lineTo(C + 3, C + 6);
      ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.arc(C + 3, C, 6, -Math.PI / 2, Math.PI / 2); ctx.fill();
      ctx.fillStyle = '#006688';
      ctx.beginPath(); ctx.moveTo(C - 7, C - 6); ctx.lineTo(C - 12, C - 9); ctx.lineTo(C - 10, C - 6); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(C - 7, C + 6); ctx.lineTo(C - 12, C + 9); ctx.lineTo(C - 10, C + 6); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#FFFFFF'; ctx.globalAlpha = 0.6;
      ctx.beginPath(); ctx.arc(C + 5, C - 2, 2.5, 0, Math.PI * 2); ctx.fill();
    });

    // --- 闪电链：锯齿闪电 ---
    this.getOrCreate('wicon_lightning', S, S, C, C, (ctx) => {
      ctx.fillStyle = '#FFF050';
      ctx.beginPath();
      ctx.moveTo(C - 2, C - 12); ctx.lineTo(C + 5, C - 12); ctx.lineTo(C + 1, C - 3);
      ctx.lineTo(C + 6, C - 3); ctx.lineTo(C - 3, C + 12); ctx.lineTo(C, C + 2);
      ctx.lineTo(C - 5, C + 2);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#FFFFFF'; ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.moveTo(C, C - 10); ctx.lineTo(C + 3, C - 10); ctx.lineTo(C + 1, C - 5); ctx.lineTo(C - 1, C - 5);
      ctx.closePath(); ctx.fill();
    });

    // --- 追踪导弹：竖直导弹 ---
    this.getOrCreate('wicon_missile', S, S, C, C, (ctx) => {
      ctx.fillStyle = '#FF14FF';
      ctx.beginPath();
      ctx.moveTo(C, C - 11); ctx.lineTo(C + 4, C - 5); ctx.lineTo(C + 4, C + 5);
      ctx.lineTo(C + 3, C + 8); ctx.lineTo(C - 3, C + 8); ctx.lineTo(C - 4, C + 5); ctx.lineTo(C - 4, C - 5);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#AA00AA';
      ctx.beginPath(); ctx.moveTo(C - 4, C + 5); ctx.lineTo(C - 8, C + 10); ctx.lineTo(C - 4, C + 8); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(C + 4, C + 5); ctx.lineTo(C + 8, C + 10); ctx.lineTo(C + 4, C + 8); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#FF8844'; ctx.globalAlpha = 0.8;
      ctx.beginPath(); ctx.moveTo(C - 2, C + 8); ctx.lineTo(C, C + 13); ctx.lineTo(C + 2, C + 8); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#FFFFFF'; ctx.globalAlpha = 0.5;
      ctx.beginPath(); ctx.arc(C, C - 7, 2, 0, Math.PI * 2); ctx.fill();
    });

    // --- 天降陨石：火球 ---
    this.getOrCreate('wicon_meteor', S, S, C, C, (ctx) => {
      ctx.fillStyle = '#FF8800';
      ctx.beginPath(); ctx.arc(C, C, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#FFDD44';
      ctx.beginPath(); ctx.arc(C, C, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#FFFFFF'; ctx.globalAlpha = 0.7;
      ctx.beginPath(); ctx.arc(C - 1, C - 1, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.6; ctx.fillStyle = '#FF4400';
      ctx.beginPath(); ctx.moveTo(C + 6, C - 6); ctx.lineTo(C + 13, C - 11); ctx.lineTo(C + 8, C - 3); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(C + 4, C - 7); ctx.lineTo(C + 9, C - 13); ctx.lineTo(C + 2, C - 8); ctx.closePath(); ctx.fill();
    });

    // --- 战术无人机：菱形飞行器 ---
    this.getOrCreate('wicon_drone', S, S, C, C, (ctx) => {
      ctx.fillStyle = '#50FFB4';
      ctx.beginPath();
      ctx.moveTo(C, C - 6); ctx.lineTo(C + 7, C); ctx.lineTo(C, C + 6); ctx.lineTo(C - 7, C);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#FFFFFF'; ctx.globalAlpha = 0.8;
      ctx.beginPath(); ctx.arc(C, C, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.6; ctx.fillStyle = '#50FFB4';
      ctx.fillRect(C - 10, C - 1.5, 4, 3);
      ctx.fillRect(C + 6, C - 1.5, 4, 3);
      ctx.strokeStyle = '#50FFB4'; ctx.lineWidth = 1; ctx.globalAlpha = 0.4;
      ctx.beginPath();
      ctx.moveTo(C - 7, C); ctx.lineTo(C - 13, C + 10);
      ctx.moveTo(C + 7, C); ctx.lineTo(C + 13, C + 10);
      ctx.stroke();
    });

    // --- 回旋刃：四角旋刃 ---
    this.getOrCreate('wicon_spinBlade', S, S, C, C, (ctx) => {
      ctx.fillStyle = '#AA44FF';
      for (let a = 0; a < 4; a++) {
        const angle = (Math.PI * 2 / 4) * a - Math.PI / 4;
        ctx.save(); ctx.translate(C, C); ctx.rotate(angle);
        ctx.beginPath();
        ctx.moveTo(0, -2); ctx.lineTo(10, -3); ctx.lineTo(11, 0); ctx.lineTo(10, 3); ctx.lineTo(0, 2);
        ctx.closePath(); ctx.fill();
        ctx.restore();
      }
      ctx.fillStyle = '#FFFFFF'; ctx.globalAlpha = 0.7;
      ctx.beginPath(); ctx.arc(C, C, 3, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#AA44FF'; ctx.lineWidth = 1.5; ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.arc(C, C, 3, 0, Math.PI * 2); ctx.stroke();
    });

    // --- 寒冰发生器：横向冰晶屏障 ---
    this.getOrCreate('wicon_frostStorm', S, S, C, C, (ctx) => {
      // 底座横条
      ctx.fillStyle = '#00DDFF';
      ctx.globalAlpha = 0.8;
      ctx.fillRect(C - 12, C + 2, 24, 6);
      // 冰晶尖刺（5个三角形）
      ctx.fillStyle = '#44FFFF';
      ctx.globalAlpha = 0.9;
      const spikes = [
        { x: C - 9, h: 7 },
        { x: C - 4, h: 10 },
        { x: C, h: 12 },
        { x: C + 4, h: 10 },
        { x: C + 9, h: 7 }
      ];
      spikes.forEach(s => {
        ctx.beginPath();
        ctx.moveTo(s.x - 2.5, C + 2);
        ctx.lineTo(s.x, C + 2 - s.h);
        ctx.lineTo(s.x + 2.5, C + 2);
        ctx.closePath();
        ctx.fill();
      });
      // 霓虹辉光边缘
      ctx.strokeStyle = '#AAFFFF';
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.7;
      ctx.strokeRect(C - 12, C + 2, 24, 6);
      // 高光
      ctx.fillStyle = '#FFFFFF';
      ctx.globalAlpha = 0.5;
      ctx.fillRect(C - 10, C + 3, 8, 2);
    });

    // --- 奇点引擎：黑洞漩涡 ---
    this.getOrCreate('wicon_gravityWell', S, S, C, C, (ctx) => {
      // 外环
      ctx.strokeStyle = '#AA00FF';
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.8;
      ctx.beginPath(); ctx.arc(C, C, 9, 0, Math.PI * 2); ctx.stroke();
      // 内环
      ctx.strokeStyle = '#CC66FF';
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.6;
      ctx.beginPath(); ctx.arc(C, C, 5, 0, Math.PI * 2); ctx.stroke();
      // 中心点
      ctx.fillStyle = '#FFFFFF';
      ctx.globalAlpha = 0.9;
      ctx.beginPath(); ctx.arc(C, C, 2, 0, Math.PI * 2); ctx.fill();
      // 漩涡臂（4条弧线）
      ctx.strokeStyle = '#BB44FF';
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.5;
      for (var arm = 0; arm < 4; arm++) {
        var startAngle = (Math.PI * 2 / 4) * arm;
        ctx.beginPath();
        ctx.arc(C, C, 7, startAngle, startAngle + Math.PI * 0.4);
        ctx.stroke();
      }
      // 吸入粒子点
      ctx.fillStyle = '#CC88FF';
      ctx.globalAlpha = 0.7;
      ctx.beginPath(); ctx.arc(C - 10, C - 4, 1, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(C + 8, C + 6, 1, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(C + 3, C - 9, 1, 0, Math.PI * 2); ctx.fill();
    });

    // --- 白磷弹：圆形炸弹+引线 ---
    this.getOrCreate('wicon_blizzard', S, S, C, C, (ctx) => {
      ctx.fillStyle = '#FF8833';
      ctx.beginPath(); ctx.arc(C, C + 1, 7, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#FFAA44'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(C + 3, C - 6); ctx.lineTo(C + 6, C - 10); ctx.stroke();
      ctx.fillStyle = '#FFEE88'; ctx.globalAlpha = 0.9;
      ctx.beginPath(); ctx.arc(C + 6, C - 10, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#FFFFFF'; ctx.globalAlpha = 0.7;
      ctx.beginPath(); ctx.arc(C + 6, C - 10, 1.2, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.4; ctx.fillStyle = '#FFFFFF';
      ctx.beginPath(); ctx.arc(C - 2, C - 1, 3, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#CC5500'; ctx.lineWidth = 1; ctx.globalAlpha = 0.5;
      ctx.beginPath(); ctx.moveTo(C - 5, C + 1); ctx.lineTo(C + 5, C + 1); ctx.stroke();
    });

    // --- 离子射线：瞄准镜+射线 ---
    this.getOrCreate('wicon_ionBeam', S, S, C, C, (ctx) => {
      ctx.strokeStyle = '#FF4444'; ctx.lineWidth = 2;
      // 十字准星
      ctx.beginPath();
      ctx.moveTo(C, C - 10); ctx.lineTo(C, C - 4);
      ctx.moveTo(C, C + 4); ctx.lineTo(C, C + 10);
      ctx.moveTo(C - 10, C); ctx.lineTo(C - 4, C);
      ctx.moveTo(C + 4, C); ctx.lineTo(C + 10, C);
      ctx.stroke();
      // 外环
      ctx.beginPath(); ctx.arc(C, C, 8, 0, Math.PI * 2); ctx.stroke();
      // 中心点
      ctx.fillStyle = '#FF4444';
      ctx.beginPath(); ctx.arc(C, C, 2.5, 0, Math.PI * 2); ctx.fill();
      // 高光
      ctx.fillStyle = '#FFFFFF'; ctx.globalAlpha = 0.6;
      ctx.beginPath(); ctx.arc(C, C, 1.2, 0, Math.PI * 2); ctx.fill();
    });
  }
}

module.exports = SpriteCache;
