/**
 * LauncherRenderer.js - 发射器 + 武器挂件渲染
 * 使用精灵图替代几何绘制，代码动态绘制喷射流特效
 */
const Config = require('../Config');
const { getIconLoader } = require('./IconLoader');

// 喷射流帧计数器（用于动画）
let _exhaustFrame = 0;

function drawLauncher(ctx, launcher, upgrades) {
  const { x, y, width, height, color, muzzleFlash } = launcher;
  const cx = x + width / 2;
  const elementType = upgrades ? upgrades.getElementType() : null;
  const elementColors = { fire: '#FF4400', ice: '#44DDFF', thunder: '#FFF050' };
  const elemColor = elementType ? elementColors[elementType] : null;
  const baseColor = elemColor || color;

  _exhaustFrame++;

  // ============ 1. 飞机本体（精灵图）============
  const IL = getIconLoader();
  const shipImg = IL.get('ship_main');
  let shipDrawW, shipDrawH, drawX, drawY;

  if (shipImg) {
    shipDrawW = width * 1.6;
    shipDrawH = shipDrawW;
    drawX = cx - shipDrawW / 2;
    drawY = y + height / 2 - shipDrawH * 0.55;

    if (elemColor) {
      ctx.drawImage(shipImg, drawX, drawY, shipDrawW, shipDrawH);
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = elemColor;
      ctx.fillRect(drawX, drawY, shipDrawW, shipDrawH);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 0.6;
      ctx.drawImage(shipImg, drawX, drawY, shipDrawW, shipDrawH);
      ctx.globalAlpha = 1;
    } else {
      ctx.drawImage(shipImg, drawX, drawY, shipDrawW, shipDrawH);
    }

    // 元素光环
    if (elemColor) {
      ctx.globalAlpha = 0.15;
      ctx.fillStyle = elemColor;
      ctx.beginPath();
      ctx.arc(cx, y + height / 2, width * 0.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  } else {
    // fallback: 几何绘制
    shipDrawH = height;
    ctx.fillStyle = baseColor;
    ctx.beginPath();
    ctx.moveTo(cx - width / 2, y + height);
    ctx.lineTo(cx - width / 3, y + 4);
    ctx.lineTo(cx + width / 3, y + 4);
    ctx.lineTo(cx + width / 2, y + height);
    ctx.closePath();
    ctx.fill();
  }

  // ============ 2. 喷射流特效（画在飞机之后，不会被覆盖）============
  const engineGap = width * 0.2;
  // 喷射流起点 = 飞机精灵图底部
  const exhaustBaseY = shipImg ? (drawY + shipDrawH) : (y + height);

  // 双引擎同步动画（相同相位）
  const outerLen = 20 + Math.sin(_exhaustFrame * 0.15) * 5;
  const midLen = 14 + Math.sin(_exhaustFrame * 0.2) * 4;
  const innerLen = 9 + Math.sin(_exhaustFrame * 0.25) * 2;
  const outerW = width * 0.16;
  const midW = outerW * 0.6;
  const innerW = midW * 0.45;

  for (let side = -1; side <= 1; side += 2) {
    const ex = cx + side * engineGap;

    // --- 外焰 ---
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = baseColor;
    ctx.beginPath();
    ctx.moveTo(ex - outerW, exhaustBaseY);
    ctx.quadraticCurveTo(ex - outerW * 0.5, exhaustBaseY + outerLen * 0.6, ex, exhaustBaseY + outerLen);
    ctx.quadraticCurveTo(ex + outerW * 0.5, exhaustBaseY + outerLen * 0.6, ex + outerW, exhaustBaseY);
    ctx.closePath();
    ctx.fill();

    // --- 中焰 ---
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = baseColor;
    ctx.beginPath();
    ctx.moveTo(ex - midW, exhaustBaseY);
    ctx.quadraticCurveTo(ex - midW * 0.3, exhaustBaseY + midLen * 0.7, ex, exhaustBaseY + midLen);
    ctx.quadraticCurveTo(ex + midW * 0.3, exhaustBaseY + midLen * 0.7, ex + midW, exhaustBaseY);
    ctx.closePath();
    ctx.fill();

    // --- 内焰（白色核心）---
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.moveTo(ex - innerW, exhaustBaseY);
    ctx.quadraticCurveTo(ex, exhaustBaseY + innerLen * 0.8, ex, exhaustBaseY + innerLen);
    ctx.quadraticCurveTo(ex, exhaustBaseY + innerLen * 0.8, ex + innerW, exhaustBaseY);
    ctx.closePath();
    ctx.fill();

    // --- 引擎口亮点 ---
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(ex, exhaustBaseY, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = baseColor;
    ctx.beginPath();
    ctx.arc(ex, exhaustBaseY, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // ============ 3. 发射口闪光 ============
  const spreadCount = upgrades ? upgrades.getSpreadBonus() : 0;
  const totalGuns = 1 + spreadCount;
  const gunGap = 10;
  const gunsStartX = cx - ((totalGuns - 1) * gunGap) / 2;
  if (muzzleFlash > 0) {
    const flashAlpha = muzzleFlash / 3;
    for (let g = 0; g < totalGuns; g++) {
      const gx = gunsStartX + g * gunGap;
      ctx.globalAlpha = flashAlpha * 0.8;
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(gx, y - 6, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = flashAlpha * 0.3;
      ctx.fillStyle = baseColor;
      ctx.beginPath();
      ctx.arc(gx, y - 6, 9, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

function drawWeaponWings(ctx, weapons, launcher) {
  const lcx = launcher.getCenterX();
  const lcy = launcher.y;
  const IL = getIconLoader();
  const keys = Object.keys(weapons);

  for (let i = 0; i < keys.length; i++) {
    const wk = keys[i];
    const weapon = weapons[wk];
    const wing = weapon.getWingData(lcx, lcy);
    if (!wing) continue;

    const side = (i % 2 === 0) ? -1 : 1;
    const row = Math.floor(i / 2);
    const wx = lcx + side * (32 + row * 14);
    const wy = lcy + 4 + row * 8;
    const wingSize = 32;

    ctx.globalAlpha = 0.85;
    if (!IL.drawIcon(ctx, 'wing_' + wk, wx, wy, wingSize)) {
      if (!IL.drawIcon(ctx, 'wing_default', wx, wy, wingSize)) {
        ctx.fillStyle = wing.color || '#888';
        ctx.fillRect(wx - 6, wy - 8, 12, 16);
      }
    }
    ctx.globalAlpha = 1;
  }
}

module.exports = { drawLauncher, drawWeaponWings };
