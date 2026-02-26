/**
 * BulletRenderer.js - 子弹渲染
 */
const Config = require('../Config');

function drawBullets(ctx, sprites, bullets) {
  if (!bullets || bullets.length === 0) return;
  const elementColors = { fire: '#FF4400', ice: '#44DDFF', thunder: '#FFF050' };
  const glowMap = { fire: 'glow_fire', ice: 'glow_ice', thunder: 'glow_thunder' };

  // Pass 1: Glow 底层
  for (let k = 0; k < bullets.length; k++) {
    const b = bullets[k];
    const glowKey = b.element ? (glowMap[b.element] || 'glow_white') : 'glow_white';
    ctx.globalAlpha = 0.8;
    sprites.draw(ctx, glowKey, b.x, b.y, 0, 1.6);
  }

  // Pass 2: 拖尾
  for (let k = 0; k < bullets.length; k++) {
    const b = bullets[k];
    const c = b.element ? (elementColors[b.element] || b.color || Config.BULLET_COLOR) : (b.color || Config.BULLET_COLOR);
    ctx.fillStyle = c;
    for (let i = 0; i < b.trail.length; i++) {
      const t = b.trail[i];
      const ratio = (i + 1) / b.trail.length;
      ctx.globalAlpha = ratio * 0.5;
      const s = 1.5 + ratio * 2.5;
      ctx.fillRect(t.x - s, t.y - s, s * 2, s * 2);
    }
  }

  // Pass 3: 弹体（drawImage）
  ctx.globalAlpha = 1;
  for (let k = 0; k < bullets.length; k++) {
    const b = bullets[k];
    const bulletKey = b.element ? 'bullet_' + b.element : 'bullet';
    sprites.draw(ctx, bulletKey, b.x, b.y, 0, 1);
  }
}

module.exports = { drawBullets };
