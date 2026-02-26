/**
 * BossRenderer.js - Boss 渲染（5种Boss + 通用HP条）
 */
const Config = require('../Config');

function _drawBossParts(ctx, boss, fillColor) {
  const parts = boss.parts || [{ ox: 0, oy: 0, w: boss.width, h: boss.height }];
  ctx.fillStyle = fillColor;
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    ctx.beginPath(); ctx.roundRect(boss.x + p.ox, boss.y + p.oy, p.w, p.h, 4); ctx.fill();
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1;
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    ctx.beginPath(); ctx.roundRect(boss.x + p.ox, boss.y + p.oy, p.w, p.h, 4); ctx.stroke();
  }
}

function _drawCharger(ctx, boss) {
  const isCharging = boss.state === 'charging' || boss.state === 'dashing';
  if (boss.state === 'charging') {
    const flash = Math.sin(Date.now() * 0.02) > 0;
    ctx.globalAlpha = flash ? 1 : 0.4;
  }
  _drawBossParts(ctx, boss, isCharging ? '#FF4444' : '#CC2222');
  if (boss.flashTimer > 0) { ctx.globalAlpha = 0.6; _drawBossParts(ctx, boss, '#FFFFFF'); }
  if (boss.state === 'dashing') {
    for (let i = 0; i < 3; i++) {
      ctx.globalAlpha = 0.2 - i * 0.06; ctx.fillStyle = Config.NEON_ORANGE;
      ctx.fillRect(boss.x + 10 + i * 8, boss.y - 10 - i * 6, boss.width - 20 - i * 16, 4);
    }
  }
  ctx.globalAlpha = 1;
}

function _drawGuardian(ctx, boss) {
  _drawBossParts(ctx, boss, boss.flashTimer > 0 ? '#FFFFFF' : '#2244CC');
  if (boss.shields) {
    const cx = boss.x + boss.width / 2, cy = boss.y + boss.height / 2;
    const shieldR = Math.max(boss.width, boss.height) / 2 + 12;
    for (let i = 0; i < boss.shields.length; i++) {
      const s = boss.shields[i];
      if (s.hp <= 0) continue;
      const angle = (boss.shieldAngle || 0) + (Math.PI * 2 / boss.shields.length) * i;
      const sx = cx + Math.cos(angle) * shieldR, sy = cy + Math.sin(angle) * shieldR;
      ctx.globalAlpha = 0.6; ctx.fillStyle = '#6688FF';
      ctx.beginPath(); ctx.arc(sx, sy, 10, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.3; ctx.strokeStyle = '#AACCFF'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(sx, sy, 13, angle - 0.5, angle + 0.5); ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
}

function _drawSummoner(ctx, boss) {
  _drawBossParts(ctx, boss, boss.flashTimer > 0 ? '#FFFFFF' : '#8822CC');
  if (boss.state === 'summoning') {
    ctx.globalAlpha = 0.4; ctx.strokeStyle = Config.NEON_PINK; ctx.lineWidth = 2;
    const pulse = 15 + Math.sin(Date.now() * 0.01) * 5;
    ctx.beginPath(); ctx.arc(boss.x + boss.width / 2, boss.y + boss.height / 2, pulse + boss.width / 2, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 0.3; _drawBossParts(ctx, boss, '#FFFFFF');
    ctx.globalAlpha = 1;
  }
}

function _drawLaser(ctx, boss) {
  _drawBossParts(ctx, boss, boss.flashTimer > 0 ? '#FFFFFF' : '#CCAA00');
  const cx = boss.getCenterX();
  if (boss.state === 'charging') {
    const chargeProgress = boss.stateTimer / 2000;
    const coreR = 4 + chargeProgress * 8;
    ctx.fillStyle = Config.NEON_YELLOW;
    ctx.globalAlpha = 0.5 + chargeProgress * 0.5;
    ctx.beginPath(); ctx.arc(cx, boss.y + boss.height * 0.4, coreR, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }
  if (boss.state === 'firing' && boss.laserX !== undefined) {
    const lx = boss.laserX, lw = boss.laserWidth || 8;
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = 'rgba(255,50,50,0.1)'; ctx.fillRect(lx - lw * 3, boss.y + boss.height, lw * 6, Config.SCREEN_HEIGHT);
    ctx.fillStyle = 'rgba(255,80,80,0.3)'; ctx.fillRect(lx - lw * 1.5, boss.y + boss.height, lw * 3, Config.SCREEN_HEIGHT);
    ctx.fillStyle = Config.NEON_YELLOW; ctx.fillRect(lx - lw / 2, boss.y + boss.height, lw, Config.SCREEN_HEIGHT);
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillRect(lx - 1, boss.y + boss.height, 2, Config.SCREEN_HEIGHT);
    ctx.globalAlpha = 1;
  }
}

function _drawPhantom(ctx, boss) {
  if (boss.state === 'blinking') ctx.globalAlpha = 0.15;
  else if (boss.state === 'appearing') ctx.globalAlpha = 0.5 + Math.sin(Date.now() * 0.02) * 0.3;
  _drawBossParts(ctx, boss, boss.flashTimer > 0 ? '#FFFFFF' : 'rgba(200,200,220,0.8)');
  if (boss.afterImages) {
    for (let i = 0; i < boss.afterImages.length; i++) {
      const img = boss.afterImages[i];
      ctx.globalAlpha = img.alpha * 0.3; ctx.fillStyle = 'rgba(200,200,220,0.5)';
      var parts = boss.parts || [{ox:0,oy:0,w:boss.width,h:boss.height}];
      for (var pi=0;pi<parts.length;pi++) { var p=parts[pi]; ctx.beginPath(); ctx.roundRect(img.x+p.ox,img.y+p.oy,p.w,p.h,4); ctx.fill(); }
    }
  }
  ctx.globalAlpha = 1;
}

function drawBoss(ctx, boss) {
  if (!boss || !boss.alive) return;

  switch (boss.type) {
    case 'charger': _drawCharger(ctx, boss); break;
    case 'guardian': _drawGuardian(ctx, boss); break;
    case 'summoner': _drawSummoner(ctx, boss); break;
    case 'laser': _drawLaser(ctx, boss); break;
    case 'phantom': _drawPhantom(ctx, boss); break;
    default: _drawBossParts(ctx, boss, boss.flashTimer > 0 ? '#FFFFFF' : Config.NEON_CYAN); break;
  }

  // HP条
  const barW = boss.width * 0.8, barH = 6;
  const barX = boss.x + (boss.width - boss.width * 0.8) / 2;
  const barY = boss.y - 14;
  ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fillRect(barX, barY, barW, barH);
  const hpRatio = boss.hp / boss.maxHp;
  const hpColor = hpRatio > 0.5 ? Config.NEON_CYAN : hpRatio > 0.25 ? Config.NEON_YELLOW : Config.NEON_RED;
  ctx.fillStyle = hpColor; ctx.fillRect(barX, barY, barW * hpRatio, barH);
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1;
  ctx.strokeRect(barX, barY, barW, barH);

  ctx.fillStyle = '#FFFFFF'; ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
}

module.exports = { drawBoss };
