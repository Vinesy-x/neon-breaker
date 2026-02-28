/**
 * UIRenderer.js - UI界面渲染
 * 标题/GameOver/升级卡片/暂停/Boss警告/通关结算/Loading
 */
const Config = require('../Config');
const { getIconLoader } = require('./IconLoader');

// 适龄提示状态
var _ageHitArea = null;
var _showAgeTip = false;

// ============ 霓虹 Logo 离屏缓存 ============
var _logoCache = null;   // {canvas, w, h}
var _logoCacheKey = '';   // 用于检测尺寸变化

/**
 * 绘制赛博朋克霓虹 Logo "无限飞机"
 * 使用离屏 canvas 预渲染，避免每帧重复计算
 */
function _getLogoCanvas(fontSize) {
  var key = fontSize + '';
  if (_logoCache && _logoCacheKey === key) return _logoCache;

  var text = '无限飞机';
  // 离屏 canvas
  var pad = fontSize * 1.2; // 四周留白（给发光留空间）
  var offCanvas = wx.createCanvas();
  var oc = offCanvas.getContext('2d');

  // 先测量文字宽度
  oc.font = 'bold ' + fontSize + 'px sans-serif';
  var metrics = oc.measureText(text);
  var tw = metrics.width;
  var cw = Math.ceil(tw + pad * 2);
  var ch = Math.ceil(fontSize * 1.6 + pad * 2);
  offCanvas.width = cw;
  offCanvas.height = ch;

  var cx = cw / 2;
  var cy = ch / 2;

  oc.textAlign = 'center';
  oc.textBaseline = 'middle';
  oc.font = 'bold ' + fontSize + 'px sans-serif';

  // === 第1层：大范围外发光（青色光晕） ===
  oc.shadowColor = '#00FFFF';
  oc.shadowBlur = fontSize * 0.6;
  oc.shadowOffsetX = 0;
  oc.shadowOffsetY = 0;
  oc.fillStyle = 'rgba(0, 255, 255, 0.25)';
  oc.fillText(text, cx, cy);

  // === 第2层：中等发光（品红辉光） ===
  oc.shadowColor = '#FF00FF';
  oc.shadowBlur = fontSize * 0.35;
  oc.fillStyle = 'rgba(255, 0, 255, 0.15)';
  oc.fillText(text, cx, cy);

  // === 第3层：文字描边（外轮廓，深青色） ===
  oc.shadowColor = '#00FFFF';
  oc.shadowBlur = fontSize * 0.15;
  oc.strokeStyle = '#006688';
  oc.lineWidth = fontSize * 0.08;
  oc.lineJoin = 'round';
  oc.strokeText(text, cx, cy);

  // === 第4层：主文字填充（明亮渐变） ===
  oc.shadowBlur = 0;
  var grad = oc.createLinearGradient(cx - tw / 2, cy - fontSize / 2, cx + tw / 2, cy + fontSize / 2);
  grad.addColorStop(0, '#FFFFFF');     // 顶部纯白
  grad.addColorStop(0.3, '#88FFFF');   // 浅青
  grad.addColorStop(0.7, '#00FFFF');   // 青色
  grad.addColorStop(1, '#00CCDD');     // 深青
  oc.fillStyle = grad;
  oc.fillText(text, cx, cy);

  // === 第5层：高光（顶部半透明白，模拟金属反射） ===
  oc.globalCompositeOperation = 'lighter';
  var hlGrad = oc.createLinearGradient(cx, cy - fontSize * 0.45, cx, cy + fontSize * 0.1);
  hlGrad.addColorStop(0, 'rgba(255,255,255,0.45)');
  hlGrad.addColorStop(0.5, 'rgba(255,255,255,0.08)');
  hlGrad.addColorStop(1, 'rgba(255,255,255,0)');
  oc.fillStyle = hlGrad;
  oc.fillText(text, cx, cy);
  oc.globalCompositeOperation = 'source-over';

  _logoCache = { canvas: offCanvas, w: cw, h: ch, padX: pad, padY: pad };
  _logoCacheKey = key;
  return _logoCache;
}

/**
 * 在指定位置绘制霓虹 Logo
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x - 中心 x
 * @param {number} y - 中心 y
 * @param {number} fontSize - 字号（默认36）
 */
function drawNeonLogo(ctx, x, y, fontSize) {
  fontSize = fontSize || 36;
  var logo = _getLogoCanvas(fontSize);
  ctx.drawImage(logo.canvas, x - logo.w / 2, y - logo.h / 2);
}

function _drawTextWrap(ctx, text, cx, y, maxW, lineH) {
  if (!text) return;
  ctx.textAlign = 'center';
  const lines = []; let line = '';
  for (let i = 0; i < text.length; i++) {
    const test = line + text[i];
    if (ctx.measureText(test).width > maxW && line.length > 0) { lines.push(line); line = text[i]; }
    else line = test;
  }
  if (line) lines.push(line);
  const offsetY = -((lines.length - 1) * lineH) / 2;
  for (let i = 0; i < lines.length; i++) ctx.fillText(lines[i], cx, y + offsetY + i * lineH);
}

function _drawLevelDots(ctx, cx, y, curLv, maxLv, color) {
  const dotSize = 9, dotGap = 5;
  const totalW = maxLv * dotSize + (maxLv - 1) * dotGap;
  const startX = cx - totalW / 2;
  for (let i = 0; i < maxLv; i++) {
    const dx = startX + i * (dotSize + dotGap);
    if (i < curLv) ctx.fillStyle = color;
    else if (i === curLv) ctx.fillStyle = 'rgba(255,255,255,' + (0.4 + Math.sin(Date.now() * 0.008) * 0.4) + ')';
    else ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(dx, y - dotSize / 2, dotSize, dotSize);
  }
}

function _hexToRgb(hex) {
  return parseInt(hex.slice(1, 3), 16) + ',' + parseInt(hex.slice(3, 5), 16) + ',' + parseInt(hex.slice(5, 7), 16);
}

// 预加载主界面背景图
let _titleBg = null;
let _titleBgLoaded = false;
(function _loadTitleBg() {
  const img = wx.createImage();
  img.onload = function() { _titleBg = img; _titleBgLoaded = true; };
  img.onerror = function() { _titleBgLoaded = true; }; // 加载失败也标记完成
  img.src = 'assets/title_bg.jpg';
})();

function drawTitle(ctx) {
  const sw = Config.SCREEN_WIDTH, sh = Config.SCREEN_HEIGHT;
  const cx = sw / 2;

  // 背景图（铺满屏幕）
  if (_titleBg) {
    ctx.drawImage(_titleBg, 0, 0, sw, sh);
    // 上方渐变遮罩（让Logo更清晰）
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, 0, sw, sh * 0.45);
    // 下方渐变遮罩（让按钮更清晰）
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, sh * 0.8, sw, sh * 0.2);
  } else {
    // fallback 纯色背景
    ctx.fillStyle = '#0a0015';
    ctx.fillRect(0, 0, sw, sh);
  }

  // Logo "无限飞机" —— 赛博朋克霓虹效果
  drawNeonLogo(ctx, cx, sh * 0.28, 52);

  // 副标题
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = '13px monospace';
  ctx.fillText('收集武器 · 无限射击 · 越打越爽', cx, sh * 0.28 + 40);

  // 开始按钮（脉冲动画）— 在底部信息区之前绘制
  // （移到下方统一绘制）

  // 版本号（右上角，微信胶囊下方）
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.font = '10px monospace';
  ctx.textAlign = 'right';
  ctx.fillText('v1.0.0', sw - 12, 32);

  // 用户协议 & 隐私政策（右上）
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '10px monospace';
  ctx.textAlign = 'right';
  ctx.fillText('用户协议 & 隐私政策', sw - 12, 48);

  // 适龄提示（左上，蓝色12+标识）
  const ageX = 8, ageY = 88, ageW = 56, ageH = 72, ageR = 8;
  const pad = 3;
  // 1. 白色圆角大底 + 细黑边框
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath(); ctx.roundRect(ageX, ageY, ageW, ageH, ageR); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect(ageX, ageY, ageW, ageH, ageR); ctx.stroke();
  // 2. 蓝色圆角矩形（内缩，留白边）
  const oX = ageX + pad, oY = ageY + pad;
  const oW = ageW - pad * 2, oH = ageH - 22;
  ctx.fillStyle = '#2B7CD0';
  ctx.beginPath(); ctx.roundRect(oX, oY, oW, oH, 5); ctx.fill();
  // 3. "12+" 白色大字
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 22px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('12+', ageX + ageW / 2, oY + oH * 0.38);
  // 4. "CADPA"
  ctx.font = '8px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText('CADPA', ageX + ageW / 2, oY + oH * 0.75);
  // 5. "适龄提示"
  ctx.fillStyle = '#333333';
  ctx.font = 'bold 10px sans-serif';
  ctx.fillText('适龄提示', ageX + ageW / 2, ageY + ageH - 9);
  // 记录点击区域
  _ageHitArea = { x: ageX, y: ageY, w: ageW, h: ageH };

  // Logo "无限飞机" —— 赛博朋克霓虹效果
  drawNeonLogo(ctx, cx, sh * 0.28, 52);

  // 副标题
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = '13px monospace';
  ctx.fillText('收集武器 · 无限射击 · 越打越爽', cx, sh * 0.28 + 40);

  // 开始按钮（脉冲动画）
  const pulse = Math.sin(Date.now() * 0.004) * 0.15 + 0.85;
  const btnW = 180, btnH = 48;
  const btnX = cx - btnW / 2, btnY = sh * 0.72;
  ctx.globalAlpha = pulse;
  ctx.fillStyle = Config.NEON_CYAN;
  ctx.beginPath(); ctx.roundRect(btnX, btnY, btnW, btnH, 24); ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#000';
  ctx.font = 'bold 18px monospace';
  ctx.fillText('开始游戏', cx, btnY + btnH / 2);

  // ===== 底部信息区 =====
  ctx.textAlign = 'center';

  // 健康游戏忠告
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.font = '8px monospace';
  const bottomY = sh - 12;
  ctx.fillText('本公司积极履行《网络游戏行业防沉迷自律公约》', cx, bottomY - 56);
  ctx.fillText('《健康游戏忠告》', cx, bottomY - 44);
  ctx.fillText('抵制不良游戏，拒绝盗版游戏，注意自我保护，谨防受骗上当', cx, bottomY - 30);
  ctx.fillText('适度游戏益脑，沉迷游戏伤身，合理安排时间，享受健康生活', cx, bottomY - 18);
  ctx.fillText('游戏名称：无限飞机    著作权人：VineKim', cx, bottomY - 4);

  // ===== 适龄提示弹窗 =====
  if (_showAgeTip) {
    _drawAgeTipDialog(ctx, sw, sh);
  }
}

function _drawAgeTipDialog(ctx, sw, sh) {
  // 遮罩
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(0, 0, sw, sh);

  // 弹窗
  const popW = sw * 0.85, popH = sh * 0.65;
  const popX = (sw - popW) / 2, popY = (sh - popH) / 2;
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath(); ctx.roundRect(popX, popY, popW, popH, 12); ctx.fill();

  // 标题
  ctx.fillStyle = '#333333';
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('适龄提示', sw / 2, popY + 30);

  // 分隔线
  ctx.strokeStyle = '#EEEEEE'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(popX + 16, popY + 50); ctx.lineTo(popX + popW - 16, popY + 50); ctx.stroke();

  // 正文
  const lines = [
    '（1）本游戏是一款休闲游戏，适用于年满12周岁及以上年龄段用户，建议未成年人在家长监护下使用游戏产品。',
    '',
    '（2）本游戏基于太空射击故事背景，画面风格非写实，无基于历史和真实事件改编内容，有着欢快活泼的音效烘托游戏氛围，游戏主要玩法为单人模式，没有基于语音和文字的陌生人社交系统。',
    '',
    '（3）根据国家相关要求，游戏中有用户实名认证系统，未通过实名认证的用户不可进入游戏；认证为未成年人的用户除周五、周六、周日及法定节假日每日20时至21时外其他时间均不可进入游戏；游戏中无付费内容。',
    '',
    '（4）本游戏以太空战斗为游戏主题。游戏有助于锻炼用户的反应能力与策略决策能力，通过武器搭配和升级选择培养逻辑思维，丰富多样的关卡设计激发用户探索欲和创造力，轻松休闲的玩法帮助用户释放压力、调节情绪。',
  ];

  ctx.fillStyle = '#333333';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  const textX = popX + 18, maxTextW = popW - 36;
  var curY = popY + 60;

  for (var li = 0; li < lines.length; li++) {
    var line = lines[li];
    if (line === '') { curY += 6; continue; }
    // 自动换行
    var words = '';
    for (var ci = 0; ci < line.length; ci++) {
      var testLine = words + line[ci];
      var metrics = ctx.measureText(testLine);
      if (metrics.width > maxTextW && words.length > 0) {
        ctx.fillText(words, textX, curY);
        curY += 18;
        words = line[ci];
      } else {
        words = testLine;
      }
    }
    if (words) { ctx.fillText(words, textX, curY); curY += 18; }
  }

  // 关闭按钮
  const btnW = 120, btnH = 36;
  const btnX = (sw - btnW) / 2, btnY2 = popY + popH - 50;
  ctx.fillStyle = '#2B7CD0';
  ctx.beginPath(); ctx.roundRect(btnX, btnY2, btnW, btnH, 8); ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('我知道了', sw / 2, btnY2 + btnH / 2);

  // 记录关闭按钮区域（复用 _ageHitArea 来检测关闭）
  _ageTipCloseArea = { x: btnX, y: btnY2, w: btnW, h: btnH };
}
var _ageTipCloseArea = null;

function drawLoading(ctx) {
  const sw = Config.SCREEN_WIDTH, sh = Config.SCREEN_HEIGHT, cx = sw / 2;

  // 复用主界面背景图
  if (_titleBg) {
    ctx.drawImage(_titleBg, 0, 0, sw, sh);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(0, 0, sw, sh);
  } else {
    ctx.fillStyle = '#0a0015';
    ctx.fillRect(0, 0, sw, sh);
  }

  // Logo
  drawNeonLogo(ctx, cx, sh * 0.38, 52);

  // 副标题
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '13px monospace';
  ctx.fillText('收集武器 · 无限射击 · 越打越爽', cx, sh * 0.38 + 40);

  // 底部进度条
  const barW = sw * 0.6, barH = 6, barR = 3;
  const barX = cx - barW / 2, barY = sh - 80;
  // 进度条背景
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.beginPath(); ctx.roundRect(barX, barY, barW, barH, barR); ctx.fill();
  // 进度条填充
  const progress = Math.min(1, (Date.now() % 3000) / 2500);
  if (progress > 0.01) {
    const fillW = barW * progress;
    const r = Math.min(barR, fillW / 2);
    ctx.fillStyle = Config.NEON_CYAN;
    ctx.beginPath(); ctx.roundRect(barX, barY, fillW, barH, r); ctx.fill();
  }

  // Loading 文字
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '11px monospace';
  ctx.fillText('加载中...', cx, barY + 22);
}

function drawSkillChoice(ctx, sprites, choices, upgrades, title, game) {
  const sw = Config.SCREEN_WIDTH, sh = Config.SCREEN_HEIGHT, cx = sw / 2;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.8)'; ctx.fillRect(0, 0, sw, sh);
  const isLevelUp = (title || '').indexOf('LEVEL') >= 0;
  ctx.fillStyle = isLevelUp ? Config.NEON_GREEN : Config.NEON_PINK;
  ctx.font = 'bold 22px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(title || '选择强化', cx, sh * 0.16);
  ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '13px monospace';
  ctx.fillText('选择一项强化', cx, sh * 0.16 + 26);
  const count = choices.length; if (count === 0) return;
  const gap = 8, totalW = sw - 20;
  const cardW = Math.floor((totalW - gap * (count - 1)) / count);
  const cardH = sh * 0.52;
  const startX = (sw - (cardW * count + gap * (count - 1))) / 2, startY = sh * 0.24;
  for (let i = 0; i < count; i++) {
    const c = choices[i], cardX = startX + i * (cardW + gap), cardY = startY;
    const isNew = c.type === 'newWeapon';
    ctx.fillStyle = 'rgba(8, 2, 32, 0.92)';
    ctx.beginPath(); ctx.roundRect(cardX, cardY, cardW, cardH, 10); ctx.fill();
    ctx.strokeStyle = c.color; ctx.lineWidth = isNew ? 1.5 : 1;
    ctx.beginPath(); ctx.roundRect(cardX, cardY, cardW, cardH, 10); ctx.stroke();
    const rgb = _hexToRgb(c.color);
    ctx.fillStyle = 'rgba(' + rgb + ', 0.3)';
    ctx.beginPath(); ctx.roundRect(cardX + 1, cardY + 1, cardW - 2, 3, [2, 2, 0, 0]); ctx.fill();
    const ccx = cardX + cardW / 2;
    var typeLabel = '强化';
    if (c.type === 'newWeapon') typeLabel = '新武器';
    else if (c.type === 'weaponBranch') typeLabel = '武器';
    else if (c.type === 'shipBranch') typeLabel = '飞机';
    ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center';
    ctx.fillText(typeLabel, ccx, cardY + 20);
    if (isNew) { ctx.fillStyle = Config.NEON_YELLOW; ctx.font = 'bold 12px monospace'; ctx.fillText('NEW!', ccx, cardY + 36); }
    const wiconKey = 'wicon_' + (c.key || c.weaponKey || '');
    if (sprites._cache[wiconKey]) { ctx.globalAlpha = 1; sprites.draw(ctx, wiconKey, ccx, cardY + cardH * 0.28, 0, 40 / 32); }
    else {
      // 尝试用IconLoader
      const IL = getIconLoader();
      var iconKey = null;
      if (c.type === 'shipBranch') iconKey = 'ship_' + c.key;
      else if (c.type === 'weaponBranch') iconKey = 'weapon_' + c.weaponKey;
      else if (c.type === 'newWeapon') iconKey = 'weapon_' + c.key;
      else iconKey = c.weaponKey ? 'weapon_' + c.weaponKey : (c.key ? 'upgrade_' + c.key : null);
      if (iconKey && IL.drawIcon(ctx, iconKey, ccx, cardY + cardH * 0.28, 36)) { /* drawn */ }
      else if (c.icon) { ctx.fillStyle = c.color; ctx.font = '40px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(c.icon, ccx, cardY + cardH * 0.28); }
    }
    ctx.fillStyle = '#FFFFFF'; ctx.font = 'bold 14px monospace'; ctx.textBaseline = 'middle';
    _drawTextWrap(ctx, c.name, ccx, cardY + cardH * 0.48, cardW - 8, 16);
    ctx.fillStyle = 'rgba(255,255,255,0.65)'; ctx.font = '12px monospace';
    _drawTextWrap(ctx, c.desc, ccx, cardY + cardH * 0.62, cardW - 8, 14);
    if (c.level && c.maxLevel) _drawLevelDots(ctx, ccx, cardY + cardH * 0.82, c.level - 1, c.maxLevel, c.color);
    c._hitArea = { x: cardX, y: cardY, w: cardW, h: cardH };
  }

  // ── 刷新按钮（广告刷新三选一） ──
  _refreshBtnArea = null;
  if (game) {
    var maxFree = 1;  // 每次三选一免费刷新1次
    var totalUsed = (game._refreshCount || 0);
    var adUsed = (game._adRefreshUsed || 0);
    var maxAd = (game._maxAdRefresh || 3);
    var isFree = totalUsed < maxFree;
    var canRefresh = isFree || adUsed < maxAd;
    if (canRefresh) {
      var btnW = 120, btnH = 32;
      var btnX = cx - btnW / 2, btnY = startY + cardH + 16;
      // 按钮背景
      ctx.fillStyle = isFree ? 'rgba(0, 200, 100, 0.25)' : 'rgba(255, 180, 0, 0.25)';
      ctx.beginPath(); ctx.roundRect(btnX, btnY, btnW, btnH, 8); ctx.fill();
      ctx.strokeStyle = isFree ? '#00CC66' : '#FFAA00';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect(btnX, btnY, btnW, btnH, 8); ctx.stroke();
      // 文字
      ctx.fillStyle = isFree ? '#00FF88' : '#FFCC00';
      ctx.font = 'bold 13px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      var label = isFree ? '🔄 免费刷新' : '🎬 看广告刷新 (' + (maxAd - adUsed) + ')';
      ctx.fillText(label, cx, btnY + btnH / 2);
      _refreshBtnArea = { x: btnX, y: btnY, w: btnW, h: btnH, needAd: !isFree };
    }
  }
}

function drawGameOver(ctx, score, playerLevel, ownedList) {
  const sw = Config.SCREEN_WIDTH, sh = Config.SCREEN_HEIGHT, cx = sw / 2, cy = sh / 2;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.85)'; ctx.fillRect(0, 0, sw, sh);
  ctx.fillStyle = Config.NEON_PINK; ctx.font = 'bold 28px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('GAME OVER', cx, cy - 100);
  ctx.fillStyle = Config.NEON_CYAN; ctx.font = '16px monospace'; ctx.fillText('得分: ' + score, cx, cy - 60);
  if (ownedList && ownedList.length > 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '11px monospace'; ctx.fillText('你的武器:', cx, cy - 25);
    const perRow = 4, icoSz = 24, icoGap = 8;
    const totalW = Math.min(ownedList.length, perRow) * (icoSz + icoGap) - icoGap;
    const startX = cx - totalW / 2;
    for (let i = 0; i < ownedList.length; i++) {
      const p = ownedList[i], col = i % perRow, row = Math.floor(i / perRow);
      const px = startX + col * (icoSz + icoGap) + icoSz / 2, py = cy + row * (icoSz + 12);
      const IL = getIconLoader();
      const wIconKey = 'weapon_' + (p.key || '');
      if (!IL.drawIcon(ctx, wIconKey, px, py, icoSz - 2)) {
        ctx.fillStyle = p.color; ctx.font = (icoSz - 4) + 'px monospace'; ctx.textAlign = 'center'; ctx.fillText(p.icon, px, py);
      }
      ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '7px monospace'; ctx.fillText('Lv.' + p.totalLevel, px, py + 14);
    }
  }
  ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.font = '14px monospace'; ctx.textAlign = 'center';
  ctx.fillText('点击屏幕重新开始', cx, cy + 110);
}

function drawBossWarning(ctx, bossType) {
  const sw = Config.SCREEN_WIDTH, sh = Config.SCREEN_HEIGHT, cx = sw / 2;
  const flash = Math.sin(Date.now() * 0.01) > 0 ? 0.6 : 0.3;
  ctx.fillStyle = 'rgba(255,0,0,' + (flash * 0.15) + ')'; ctx.fillRect(0, 0, sw, sh);
  ctx.fillStyle = 'rgba(255,50,50,' + flash + ')'; ctx.font = 'bold 28px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('⚠ WARNING ⚠', cx, sh * 0.4);
  const bossNames = { charger:'冲锋者', guardian:'护盾卫士', summoner:'召唤师', laser:'激光炮台', phantom:'幽影刺客' };
  const bossIcons = { charger:'🔴', guardian:'🔵', summoner:'🟣', laser:'🟡', phantom:'⚪' };
  ctx.fillStyle = '#FFFFFF'; ctx.globalAlpha = flash; ctx.font = 'bold 16px monospace';
  ctx.fillText((bossIcons[bossType]||'') + ' ' + (bossNames[bossType] || 'BOSS') + ' 来袭!', cx, sh * 0.5);
  ctx.globalAlpha = 1;
}

function drawPauseDialog(ctx) {
  const sw = Config.SCREEN_WIDTH, sh = Config.SCREEN_HEIGHT;
  ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0, 0, sw, sh);
  const popW = 240, popH = 180, popX = (sw - popW) / 2, popY = (sh - popH) / 2;
  ctx.fillStyle = 'rgba(15,10,40,0.97)'; ctx.beginPath(); ctx.roundRect(popX, popY, popW, popH, 16); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(popX, popY, popW, popH, 16); ctx.stroke();
  ctx.fillStyle = '#FFFFFF'; ctx.font = 'bold 18px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('游戏暂停', sw / 2, popY + 36);
  ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '13px monospace'; ctx.fillText('确认退出关卡？', sw / 2, popY + 66);
  const btnW = 100, btnH = 38, btnGap = 12, btnY = popY + popH - 56;
  const contX = sw / 2 - btnW - btnGap / 2, quitX = sw / 2 + btnGap / 2;
  ctx.fillStyle = 'rgba(0,200,100,0.25)'; ctx.beginPath(); ctx.roundRect(contX, btnY, btnW, btnH, 10); ctx.fill();
  ctx.strokeStyle = Config.NEON_GREEN; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(contX, btnY, btnW, btnH, 10); ctx.stroke();
  ctx.fillStyle = '#FFFFFF'; ctx.font = 'bold 15px monospace'; ctx.fillText('继续', contX + btnW / 2, btnY + btnH / 2);
  ctx.fillStyle = 'rgba(255,50,50,0.2)'; ctx.beginPath(); ctx.roundRect(quitX, btnY, btnW, btnH, 10); ctx.fill();
  ctx.strokeStyle = Config.NEON_RED; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(quitX, btnY, btnW, btnH, 10); ctx.stroke();
  ctx.fillStyle = '#FFFFFF'; ctx.fillText('退出', quitX + btnW / 2, btnY + btnH / 2);
  return { resume: { x: contX, y: btnY, w: btnW, h: btnH }, quit: { x: quitX, y: btnY, w: btnW, h: btnH } };
}

function drawChapterClear(ctx, chapter, score, playerLevel, maxCombo, ownedList, coinsEarned, isFirstClear) {
  const sw = Config.SCREEN_WIDTH, sh = Config.SCREEN_HEIGHT, cx = sw / 2;
  ctx.fillStyle = 'rgba(0,0,0,0.9)'; ctx.fillRect(0, 0, sw, sh);
  const pulse = 0.8 + Math.sin(Date.now() * 0.005) * 0.2;
  ctx.globalAlpha = pulse; ctx.fillStyle = Config.NEON_YELLOW; ctx.font = 'bold 22px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('CHAPTER ' + chapter + ' CLEAR', cx, sh * 0.15); ctx.globalAlpha = 1;
  ctx.fillStyle = Config.NEON_CYAN; ctx.font = '14px monospace'; ctx.fillText('得分: ' + score, cx, sh * 0.26);
  ctx.fillStyle = Config.NEON_GREEN; ctx.fillText('等级: Lv.' + playerLevel, cx, sh * 0.32);
  ctx.fillStyle = Config.NEON_PINK; ctx.fillText('最高Combo: ' + maxCombo, cx, sh * 0.38);
  if (ownedList && ownedList.length > 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '11px monospace'; ctx.fillText('你的 Build:', cx, sh * 0.46);
    const perRow = 6, icoSz = 22, icoGap = 6;
    const totalW = Math.min(ownedList.length, perRow) * (icoSz + icoGap) - icoGap;
    const startX = cx - totalW / 2;
    for (let i = 0; i < ownedList.length; i++) {
      const p = ownedList[i], row = Math.floor(i / perRow), col = i % perRow;
      const px = startX + col * (icoSz + icoGap) + icoSz / 2, py = sh * 0.52 + row * (icoSz + icoGap + 4);
      const IL2 = getIconLoader();
      const wIK = 'weapon_' + (p.key || '');
      if (!IL2.drawIcon(ctx, wIK, px, py, icoSz - 2)) {
        ctx.fillStyle = p.color; ctx.font = (icoSz - 4) + 'px monospace'; ctx.textAlign = 'center'; ctx.fillText(p.icon, px, py);
      }
      ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '7px monospace';
      ctx.fillText(typeof p.level === 'number' ? 'Lv.' + p.level : p.level, px, py + 12);
    }
  }
  ctx.fillStyle = Config.NEON_YELLOW; ctx.font = 'bold 16px monospace'; ctx.textAlign = 'center';
  const coinText = '+' + coinsEarned + ' 金币';
  getIconLoader().drawIcon(ctx, 'ui_coin', cx - ctx.measureText(coinText).width / 2 - 12, sh * 0.68, 16);
  ctx.fillText('  ' + coinText, cx, sh * 0.68);
  if (isFirstClear) { ctx.fillStyle = Config.NEON_ORANGE; ctx.font = '12px monospace'; ctx.fillText('(首通 ×2!)', cx, sh * 0.73); }
  const btnW = 100, btnH = 36, btnGap = 16;
  const nextX = cx - btnW - btnGap / 2, nextY = sh * 0.80;
  ctx.fillStyle = 'rgba(0,200,100,0.2)'; ctx.beginPath(); ctx.roundRect(nextX, nextY, btnW, btnH, 8); ctx.fill();
  ctx.strokeStyle = Config.NEON_GREEN; ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(nextX, nextY, btnW, btnH, 8); ctx.stroke();
  ctx.fillStyle = '#FFFFFF'; ctx.font = 'bold 13px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('下一章', nextX + btnW / 2, nextY + btnH / 2);
  const backX = cx + btnGap / 2, backY = sh * 0.80;
  ctx.fillStyle = 'rgba(100,100,100,0.2)'; ctx.beginPath(); ctx.roundRect(backX, backY, btnW, btnH, 8); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(backX, backY, btnW, btnH, 8); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.font = 'bold 13px monospace';
  ctx.fillText('返回', backX + btnW / 2, backY + btnH / 2);
  return { next: { x: nextX, y: nextY, w: btnW, h: btnH }, back: { x: backX, y: backY, w: btnW, h: btnH } };
}

function handleAgeTipTap(tap) {
  if (!tap) return false;
  // 弹窗打开时，点击关闭按钮
  if (_showAgeTip) {
    if (_ageTipCloseArea && tap.x >= _ageTipCloseArea.x && tap.x <= _ageTipCloseArea.x + _ageTipCloseArea.w &&
        tap.y >= _ageTipCloseArea.y && tap.y <= _ageTipCloseArea.y + _ageTipCloseArea.h) {
      _showAgeTip = false;
      return true;
    }
    // 点击弹窗外也关闭
    var popW = Config.SCREEN_WIDTH * 0.85, popH = Config.SCREEN_HEIGHT * 0.65;
    var popX = (Config.SCREEN_WIDTH - popW) / 2, popY = (Config.SCREEN_HEIGHT - popH) / 2;
    if (tap.x < popX || tap.x > popX + popW || tap.y < popY || tap.y > popY + popH) {
      _showAgeTip = false;
      return true;
    }
    return true; // 弹窗开着时吞掉所有点击
  }
  // 点击适龄标识打开弹窗
  if (_ageHitArea && tap.x >= _ageHitArea.x && tap.x <= _ageHitArea.x + _ageHitArea.w &&
      tap.y >= _ageHitArea.y && tap.y <= _ageHitArea.y + _ageHitArea.h) {
    _showAgeTip = true;
    return true;
  }
  return false;
}

var _refreshBtnArea = null;
function getRefreshBtnArea() { return _refreshBtnArea; }

module.exports = { drawTitle, drawLoading, drawSkillChoice, drawGameOver, drawBossWarning, drawPauseDialog, drawChapterClear, handleAgeTipTap, getRefreshBtnArea };
