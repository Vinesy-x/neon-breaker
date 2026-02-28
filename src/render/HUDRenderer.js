/**
 * HUDRenderer.js - HUD/经验条/伤害统计/飘字/道具/粒子
 */
const Config = require('../Config');
const DAMAGE_NAMES = require('../config/DamageNames');
const { getIconLoader } = require('./IconLoader');

function formatNum(n) {
  n = Math.ceil(n);
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toString();
}

function drawChapterHUD(ctx, chapter, score, combo, playerLevel, elapsedMs, soundEnabled, timeScale) {
  const top = Config.SAFE_TOP;

  // 暂停按钮
  const pauseSize = 30;
  const pauseX = 8, pauseY = top;
  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  ctx.beginPath(); ctx.roundRect(pauseX, pauseY, pauseSize, pauseSize, 6); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillRect(pauseX + 9, pauseY + 7, 4, 16);
  ctx.fillRect(pauseX + 17, pauseY + 7, 4, 16);

  // 分数
  ctx.fillStyle = Config.NEON_CYAN;
  ctx.font = 'bold 16px monospace'; ctx.textAlign = 'center';
  ctx.fillText('' + score, Config.SCREEN_WIDTH / 2, top);

  // 等级
  ctx.fillStyle = Config.NEON_GREEN;
  ctx.font = 'bold 13px monospace'; ctx.textAlign = 'right';
  ctx.fillText('Lv.' + playerLevel, Config.SCREEN_WIDTH - 8, top);

  // 时间
  const sec = Math.floor(elapsedMs / 1000);
  const min = Math.floor(sec / 60);
  const s = sec % 60;
  ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '12px monospace'; ctx.textAlign = 'right';
  ctx.fillText(min + ':' + (s < 10 ? '0' : '') + s, Config.SCREEN_WIDTH - 8, top + 16);



  // 音效
  ctx.fillStyle = soundEnabled ? 'rgba(255,255,255,0.5)' : 'rgba(255,50,50,0.5)';
  ctx.font = '14px monospace'; ctx.textAlign = 'left';
  ctx.fillText(soundEnabled ? '♪' : '♪̶', 10, Config.SCREEN_HEIGHT - Config.SAFE_BOTTOM - 48);

  // 速度按钮（暂停按钮右边）
  var ts = timeScale || 1;
  var speedX = pauseX + pauseSize + 6, speedY = pauseY, speedW = 38, speedH = pauseSize;
  ctx.fillStyle = ts > 1 ? 'rgba(255,255,0,0.2)' : 'rgba(255,255,255,0.1)';
  ctx.beginPath(); ctx.roundRect(speedX, speedY, speedW, speedH, 6); ctx.fill();
  ctx.fillStyle = ts > 1 ? Config.NEON_YELLOW : 'rgba(255,255,255,0.7)';
  ctx.font = 'bold 11px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('x' + ts, speedX + speedW / 2, speedY + speedH / 2);

  return { pauseBtn: { x: pauseX, y: pauseY, w: pauseSize, h: pauseSize }, speedBtn: { x: speedX, y: speedY, w: speedW, h: speedH } };
}

function drawExpOrbs(ctx, sprites, orbs) {
  if (!orbs || orbs.length === 0) return;
  for (let i = 0; i < orbs.length; i++) {
    const o = orbs[i];
    sprites.draw(ctx, 'exp_orb', o.x, o.y, 0, 1);
  }
}

function drawExpBar(ctx, exp, expToNext, playerLevel) {
  const barH = Config.EXP_BAR_HEIGHT;
  const barY = Config.SCREEN_HEIGHT - Config.EXP_BAR_Y_OFFSET;
  const margin = 40;
  const barW = Config.SCREEN_WIDTH - margin * 2;
  const barX = margin;
  const ratio = Math.min(1, exp / expToNext);

  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.beginPath(); ctx.roundRect(barX, barY, barW, barH, barH / 2); ctx.fill();

  if (ratio > 0) {
    ctx.fillStyle = Config.NEON_CYAN;
    ctx.beginPath(); ctx.roundRect(barX, barY, barW * ratio, barH, barH / 2); ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath(); ctx.arc(barX + barW * ratio, barY + barH / 2, 3, 0, Math.PI * 2); ctx.fill();
  }

  ctx.fillStyle = Config.NEON_CYAN;
  ctx.font = 'bold 10px monospace'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  ctx.fillText('Lv.' + playerLevel, barX - 4, barY + barH / 2);

  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.font = '9px monospace'; ctx.textAlign = 'left';
  ctx.fillText(Math.floor(ratio * 100) + '%', barX + barW + 4, barY + barH / 2);
}

function drawDamageStats(ctx, stats, expanded) {
  const nameMap = DAMAGE_NAMES;
  const entries = Object.entries(stats || {}).sort((a, b) => b[1] - a[1]);
  const totalDmg = entries.reduce((sum, e) => sum + e[1], 0);

  const px = 8, py = Config.SAFE_TOP + 75;
  const btnW = 28, btnH = 28;

  ctx.fillStyle = totalDmg > 0 ? 'rgba(255,100,100,0.3)' : 'rgba(255,255,255,0.1)';
  ctx.beginPath(); ctx.arc(px + btnW / 2, py + btnH / 2, btnW / 2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = totalDmg > 0 ? '#FF6666' : 'rgba(255,255,255,0.3)';
  ctx.font = '14px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('📊', px + btnW / 2, py + btnH / 2);

  const hitArea = { x: px, y: py, w: btnW, h: btnH };
  if (!expanded || totalDmg === 0) return hitArea;

  const panelW = 140, lineH = 14;
  const maxLines = Math.min(entries.length, 8);
  const panelH = 24 + maxLines * lineH;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
  ctx.beginPath(); ctx.roundRect(px, py + btnH + 4, panelW, panelH, 6); ctx.fill();
  ctx.strokeStyle = 'rgba(255,100,100,0.5)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect(px, py + btnH + 4, panelW, panelH, 6); ctx.stroke();

  ctx.fillStyle = '#FF6666'; ctx.font = 'bold 10px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillText('伤害: ' + formatNum(totalDmg), px + 6, py + btnH + 8);

  let ly = py + btnH + 22;
  ctx.font = '9px monospace';
  for (let i = 0; i < maxLines; i++) {
    const [src, dmg] = entries[i];
    const pct = ((dmg / totalDmg) * 100).toFixed(0);
    const barW2 = (dmg / totalDmg) * 60;

    ctx.fillStyle = 'rgba(255,100,100,0.4)';
    ctx.fillRect(px + 6, ly + 2, barW2, 8);

    const displayName = nameMap[src] || src;
    ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'left';
    ctx.fillText(displayName.substring(0, 6), px + 6, ly);
    ctx.textAlign = 'right';
    ctx.fillText(pct + '%', px + panelW - 6, ly);

    ly += lineH;
  }

  hitArea.h = btnH + 4 + panelH;
  return hitArea;
}

function drawParticles(ctx, particles) {
  if (!particles || particles.length === 0) return;
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    const a = p.getAlpha();
    if (a < 0.05) continue;
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size * 0.5, p.y - p.size * 0.5, p.size, p.size);
  }
  ctx.globalAlpha = 1;
}

function drawPowerUp(ctx, powerUp) {
  const { x, y, size, color, time, type } = powerUp;
  const pulse = 0.8 + Math.sin(time * 0.15) * 0.2;
  const drawSize = size * pulse;
  if (type === 'coin') {
    ctx.fillStyle = '#FFD700';
    ctx.beginPath(); ctx.arc(x, y, drawSize / 2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath(); ctx.arc(x - 1, y - 1, drawSize / 4, 0, Math.PI * 2); ctx.fill();
  } else if (type === 'skillCrate') {
    ctx.fillStyle = 'rgba(255, 20, 255, 0.15)';
    ctx.beginPath(); ctx.arc(x, y, drawSize, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = color;
    ctx.fillRect(x - drawSize / 2, y - drawSize / 2, drawSize, drawSize);
    ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 1;
    ctx.strokeRect(x - drawSize / 2, y - drawSize / 2, drawSize, drawSize);
    ctx.fillStyle = '#FFFFFF'; ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('?', x, y);
  } else {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x, y, drawSize / 2, 0, Math.PI * 2); ctx.fill();
  }
}

function drawFloatingTexts(ctx, texts) {
  for (let i = 0; i < texts.length; i++) {
    const t = texts[i];
    ctx.globalAlpha = t.alpha;
    ctx.fillStyle = t.color;
    ctx.font = 'bold ' + t.size + 'px monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(t.text, t.x, t.y);
  }
  ctx.globalAlpha = 1;
}

function drawDangerLine(ctx, dangerY) {
  const pulse = 0.15 + Math.sin(Date.now() * 0.003) * 0.08;
  ctx.strokeStyle = 'rgba(255, 50, 50, ' + pulse + ')';
  ctx.lineWidth = 1;
  ctx.setLineDash([8, 4]);
  ctx.beginPath(); ctx.moveTo(0, dangerY); ctx.lineTo(Config.SCREEN_WIDTH, dangerY); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(255, 0, 0, ' + (pulse * 0.15) + ')';
  ctx.fillRect(0, dangerY - 20, Config.SCREEN_WIDTH, 20);
}

function drawWeaponHUD(ctx, sprites, weaponList) {
  if (!weaponList || weaponList.length === 0) return;
  const iconSize = 20, gap = 6;
  const startX = Config.SCREEN_WIDTH - iconSize - 6;
  const startY = Config.SAFE_TOP + 36;
  for (let i = 0; i < weaponList.length; i++) {
    const w = weaponList[i];
    const y = startY + i * (iconSize + gap + 8);
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.beginPath(); ctx.roundRect(startX - 2, y - 2, iconSize + 4, iconSize + 4, 4); ctx.fill();
    ctx.strokeStyle = w.color; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(startX - 2, y - 2, iconSize + 4, iconSize + 4, 4); ctx.stroke();
    const wiconKey = 'wicon_' + w.key;
    if (sprites._cache[wiconKey]) {
      ctx.globalAlpha = 1;
      sprites.draw(ctx, wiconKey, startX + iconSize / 2, y + iconSize / 2, 0, iconSize / 32);
    } else {
      const IL = getIconLoader();
      if (!IL.drawIcon(ctx, 'weapon_' + w.key, startX + iconSize / 2, y + iconSize / 2, iconSize - 2)) {
        ctx.fillStyle = w.color; ctx.font = (iconSize - 2) + 'px monospace';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(w.icon, startX + iconSize / 2, y + iconSize / 2);
      }
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '7px monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('Lv.' + w.totalLevel, startX + iconSize / 2, y + iconSize + 6);
  }
}

module.exports = {
  drawChapterHUD, drawExpOrbs, drawExpBar, drawDamageStats,
  drawParticles, drawPowerUp, drawFloatingTexts, drawDangerLine, drawWeaponHUD,
};
