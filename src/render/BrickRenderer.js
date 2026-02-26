/**
 * BrickRenderer.js - 砖块渲染
 */
const Config = require('../Config');

function drawBrick(ctx, brick) {
  if (!brick.alive) return;
  const { x, y, width, height, color, hp, maxHp } = brick;
  const type = brick.type || 'normal';

  // 隐身砖块不可见时只画鬼影
  if (type === 'stealth' && !brick.visible) {
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = Config.BRICK_TYPE_COLORS.stealth;
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 3);
    ctx.fill();
    ctx.globalAlpha = 1;
    return;
  }

  // 接近危险线时变红
  const dangerY = Config.SCREEN_HEIGHT * Config.BRICK_DANGER_Y;
  const dangerDist = dangerY - (y + height);
  const dangerRatio = dangerDist < 80 ? 1 - dangerDist / 80 : 0;

  // 受击闪白
  if (brick.flashTimer > 0) {
    brick.flashTimer--;
    ctx.fillStyle = '#FFFFFF';
  } else if (dangerRatio > 0.5) {
    const pulse = 0.5 + Math.sin(Date.now() * 0.01) * 0.3;
    ctx.fillStyle = 'rgba(255, ' + Math.floor(50 * (1 - dangerRatio)) + ', ' + Math.floor(50 * (1 - dangerRatio)) + ', ' + (0.7 + pulse * 0.3) + ')';
  } else {
    ctx.fillStyle = color;
  }

  // 隐身砖块渐隐
  if (type === 'stealth') {
    ctx.globalAlpha = 0.6 + Math.sin(Date.now() * 0.003) * 0.2;
  }

  ctx.beginPath();
  ctx.roundRect(x, y, width, height, 3);
  ctx.fill();

  // === 砖块类型特殊视觉 ===

  // 快速砖块：向下速度线
  if (type === 'fast') {
    ctx.strokeStyle = 'rgba(255,136,0,0.5)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 2; i++) {
      const lx = x + width * 0.3 + i * width * 0.4;
      ctx.beginPath();
      ctx.moveTo(lx, y - 3);
      ctx.lineTo(lx, y + 6);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(lx - 2, y + 3);
      ctx.lineTo(lx, y + 6);
      ctx.lineTo(lx + 2, y + 3);
      ctx.stroke();
    }
  }

  // 护盾砖块：外层白色半透明框
  if (type === 'shield' && brick.shieldHp > 0) {
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x - 2, y - 2, width + 4, height + 4, 5);
    ctx.stroke();
  }

  // 分裂砖块：X裂纹
  if (type === 'split') {
    ctx.strokeStyle = 'rgba(0,255,200,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 3, y + 3);
    ctx.lineTo(x + width - 3, y + height - 3);
    ctx.moveTo(x + width - 3, y + 3);
    ctx.lineTo(x + 3, y + height - 3);
    ctx.stroke();
  }

  // 治愈砖块：脉冲绿色光环
  if (type === 'healer') {
    const healPulse = (brick.healTimer || 0) / 3000;
    if (healPulse > 0.7) {
      const ring = (healPulse - 0.7) / 0.3;
      ctx.globalAlpha = (1 - ring) * 0.4;
      ctx.strokeStyle = Config.NEON_GREEN;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x + width / 2, y + height / 2, width / 2 + ring * 12, 0, Math.PI * 2);
      ctx.stroke();
    }
    // 红十字标记
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    const cx = x + width / 2;
    const cy = y + height / 2;
    ctx.fillRect(cx - 1, cy - 4, 2, 8);
    ctx.fillRect(cx - 4, cy - 1, 8, 2);
  }

  ctx.globalAlpha = 1;

  // 高HP砖块发光边框
  if (maxHp >= 4) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 3);
    ctx.stroke();
  } else if (maxHp > 1 && type !== 'shield') {
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 3);
    ctx.stroke();
  }

  // HP数字
  if (hp > 1) {
    ctx.fillStyle = brick.flashTimer > 0 ? '#000000' : '#FFFFFF';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(hp.toString(), x + width / 2, y + height / 2);
  }
}

/** 批量渲染砖块 - 大幅减少 Draw Call */
function drawBricksBatch(ctx, bricks) {
  if (!bricks || bricks.length === 0) return;
  const dangerY = Config.SCREEN_HEIGHT * Config.BRICK_DANGER_Y;

  // 按颜色分组
  const groups = {};
  const flashBricks = [];
  const shieldBricks = [];
  const hpTextBricks = [];

  for (let i = 0; i < bricks.length; i++) {
    const b = bricks[i];
    if (!b.alive) continue;

    // 处理 flashTimer
    if (b.flashTimer > 0) {
      b.flashTimer--;
      flashBricks.push(b);
      continue;
    }

    // 危险区变红
    const dangerDist = dangerY - (b.y + b.height);
    if (dangerDist < 40) {
      flashBricks.push(b);
      continue;
    }

    // 按颜色分组
    const c = b.color;
    if (!groups[c]) groups[c] = [];
    groups[c].push(b);

    // 收集需要边框的
    if (b.type === 'shield' && b.shieldHp > 0) shieldBricks.push(b);
    if (Math.ceil(b.hp) > 1) hpTextBricks.push(b);
  }

  // Pass 1: 批量画同色砖块主体
  for (const color in groups) {
    const arr = groups[color];
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < arr.length; i++) {
      const b = arr[i];
      ctx.rect(b.x, b.y, b.width, b.height);
    }
    ctx.fill();
  }

  // Pass 2: 画闪白/危险砖块
  if (flashBricks.length > 0) {
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    for (let i = 0; i < flashBricks.length; i++) {
      const b = flashBricks[i];
      ctx.rect(b.x, b.y, b.width, b.height);
    }
    ctx.fill();
  }

  // Pass 3: 画护盾边框
  if (shieldBricks.length > 0) {
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < shieldBricks.length; i++) {
      const b = shieldBricks[i];
      ctx.rect(b.x - 2, b.y - 2, b.width + 4, b.height + 4);
    }
    ctx.stroke();
  }

  // Pass 4: HP数字
  if (hpTextBricks.length > 0) {
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < hpTextBricks.length; i++) {
      const b = hpTextBricks[i];
      ctx.fillText(Math.ceil(b.hp).toString(), b.x + b.width / 2, b.y + b.height / 2);
    }
  }
}

module.exports = { drawBrick, drawBricksBatch };
