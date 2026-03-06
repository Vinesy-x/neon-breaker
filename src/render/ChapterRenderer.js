/**
 * ChapterRenderer.js - 章节选择 + 升级商店 + 武器商店
 * 保持为 class，因为需要存储 hitAreas 等交互状态
 */
const Config = require('../Config');
const { getIconLoader } = require('./IconLoader');
const WEAPON_TREES = require('../config/WeaponDefs');
const SHIP_TREE = require('../config/ShipDefs');
const WeaponUnlockConfig = require('../config/WeaponUnlockConfig');
const ShopDefs = require('../config/WeaponShopDefs');
const SaveManagerClass = require('../systems/SaveManager');

class ChapterRenderer {
  constructor() {
    this._chapterScrollY = 0;
    this._chapterHitAreas = [];
    this._chapterContentH = 0;
    this._chapterViewH = 0;
    this._chapterTabAreas = null;
    this._shopUpgradeAreas = [];
    this._upgradeEffects = []; // 升级特效粒子
    this._weaponListScrollY = 0; // 武器列表滚动偏移
    this._weaponHitAreas = [];
    this._weaponDetailKey = null;
    this._weaponDetailHitAreas = [];
    this._weaponPopupRect = null;
    this._weaponDetailTab = 0;
    this._skillTreeScrollY = 0;
    this._clearNextArea = null;
    this._clearBackArea = null;
    // 加载三张独立背景图
    this._chapterBg = null;
    this._upgradeBg = null;
    this._weaponBg = null;
    const img1 = wx.createImage();
    img1.onload = () => { this._chapterBg = img1; };
    img1.src = 'assets/chapter_bg.jpg';
    const img2 = wx.createImage();
    img2.onload = () => { this._upgradeBg = img2; };
    img2.src = 'assets/upgrade_bg.jpg';
    const img3 = wx.createImage();
    img3.onload = () => { this._weaponBg = img3; };
    img3.src = 'assets/weapon_bg.jpg';
  }

  get scrollY() { return this._chapterScrollY; }
  set scrollY(v) { this._chapterScrollY = v; }

  _drawBg(ctx, sw, sh, alpha, bgImg) {
    if (bgImg) {
      // cover适配，高度排除底栏(tabH=70+SAFE_BOTTOM)
      const imgW = bgImg.width || 1024;
      const imgH = bgImg.height || 1024;
      const visH = sh - Config.SAFE_BOTTOM - 70;
      const scale = Math.max(sw / imgW, visH / imgH);
      const drawW = imgW * scale;
      const drawH = imgH * scale;
      const x = (sw - drawW) / 2;
      const y = (visH - drawH) / 2;

      ctx.drawImage(bgImg, x, y, drawW, drawH);
      ctx.fillStyle = 'rgba(5,3,20,' + alpha + ')';
      ctx.fillRect(0, 0, sw, sh);
    } else {
      ctx.fillStyle = 'rgba(5,3,20,1)';
      ctx.fillRect(0, 0, sw, sh);
    }
  }

  // ===== 章节选择 =====
  drawChapterSelect(ctx, maxChapter, records, coins) {
    const sw = Config.SCREEN_WIDTH, sh = Config.SCREEN_HEIGHT, top = Config.SAFE_TOP;
    const weaponUnlocks = { 3:'missile', 6:'meteor', 10:'drone', 15:'spinBlade', 25:'blizzard', 40:'ionBeam', 55:'frostStorm' };
    const now = Date.now();

    this._drawBg(ctx, sw, sh, 0.45, this._chapterBg);

    // 顶部信息栏
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(0, 0, sw, top + 32);
    const IL0 = getIconLoader();
    IL0.drawIcon(ctx, 'ui_coin', 20, top + 13, 16);
    ctx.fillStyle = Config.NEON_YELLOW; ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText('' + coins, 30, top + 6);
    // 标题
    ctx.fillStyle = Config.NEON_CYAN; ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center'; ctx.fillText('星际航线', sw / 2, top + 6);
    // 进度
    const clearedCount = Object.keys(records).filter(k => records[k] && records[k].cleared).length;
    ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.font = '11px monospace';
    ctx.textAlign = 'right'; ctx.fillText(clearedCount + '/100', sw - 14, top + 8);

    const tabH = 70, pathTop = top + 32, pathBottom = sh - Config.SAFE_BOTTOM - tabH - 10;
    const pathH = pathBottom - pathTop, nodeSpacing = 110, nodeR = 30, cx = sw / 2;
    const scrollY = this._chapterScrollY || 0, totalChapters = 100;
    this._chapterHitAreas = [];
    this._chapterContentH = totalChapters * nodeSpacing + 100;
    this._chapterViewH = pathH;

    ctx.save(); ctx.beginPath(); ctx.rect(0, pathTop, sw, pathH); ctx.clip();

    // 蛇形路径 x 偏移
    const getNodeX = (i) => {
      const wave = Math.sin(i * 0.6) * (sw * 0.18);
      return cx + wave;
    };

    for (let i = 0; i < totalChapters; i++) {
      const chapter = i + 1, nodeY = pathBottom - 60 + scrollY - i * nodeSpacing;
      if (nodeY < pathTop - 80 || nodeY > pathBottom + 80) continue;
      const nodeX = getNodeX(i);
      const unlocked = chapter <= maxChapter, cleared = records[chapter] && records[chapter].cleared, isCurrent = chapter === maxChapter;

      // 连线（发光虚线）
      if (i < totalChapters - 1) {
        const nextY = nodeY - nodeSpacing;
        const nextX = getNodeX(i + 1);
        if (cleared) {
          // 已通关：实线发光
          ctx.globalAlpha = 0.15; ctx.strokeStyle = Config.NEON_CYAN; ctx.lineWidth = 10;
          ctx.beginPath(); ctx.moveTo(nodeX, nodeY); ctx.lineTo(nextX, Math.max(nextY, pathTop - 60)); ctx.stroke();
          ctx.globalAlpha = 0.6; ctx.strokeStyle = Config.NEON_CYAN; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(nodeX, nodeY); ctx.lineTo(nextX, Math.max(nextY, pathTop - 60)); ctx.stroke();
          ctx.globalAlpha = 1;
        } else if (chapter === maxChapter) {
          // 当前关到下一关：动态虚线
          ctx.strokeStyle = Config.NEON_CYAN + '55'; ctx.lineWidth = 2;
          ctx.setLineDash([6, 8]); ctx.lineDashOffset = -(now * 0.02 % 14);
          ctx.beginPath(); ctx.moveTo(nodeX, nodeY); ctx.lineTo(nextX, Math.max(nextY, pathTop - 60)); ctx.stroke();
          ctx.setLineDash([]);
        } else {
          // 未解锁：暗线
          ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(nodeX, nodeY); ctx.lineTo(nextX, Math.max(nextY, pathTop - 60)); ctx.stroke();
        }
      }

      this._drawHexNode(ctx, nodeX, nodeY, nodeR, chapter, unlocked, cleared, isCurrent, now);

      const wk = weaponUnlocks[chapter];
      if (wk && WEAPON_TREES[wk]) this._drawWeaponBadge(ctx, nodeX, nodeY, nodeR, chapter, maxChapter, WEAPON_TREES[wk], wk);
    }

    ctx.restore();
    this._drawScrollFade(ctx, sw, pathTop, pathBottom);
    this._drawLobbyTabs(ctx, sw, sh, 0);
  }

  _drawHexNode(ctx, cx, nodeY, nodeR, chapter, unlocked, cleared, isCurrent, now) {
    if (!unlocked) {
      // 锁定节点 — 暗淡小圆
      ctx.fillStyle = 'rgba(30,25,50,0.5)';
      ctx.beginPath(); ctx.arc(cx, nodeY, nodeR * 0.7, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(100,100,100,0.15)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cx, nodeY, nodeR * 0.7, 0, Math.PI * 2); ctx.stroke();
      const ILlock = getIconLoader();
      ILlock.drawIcon(ctx, 'ui_lock', cx, nodeY, 18);
    } else if (isCurrent) {
      // 当前关卡 — 大发光圆 + 脉冲
      const pulse = 0.5 + Math.sin(now * 0.004) * 0.3;
      // 外圈发光
      ctx.globalAlpha = pulse * 0.2; ctx.fillStyle = Config.NEON_CYAN;
      ctx.beginPath(); ctx.arc(cx, nodeY, nodeR + 16, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = pulse * 0.35;
      ctx.beginPath(); ctx.arc(cx, nodeY, nodeR + 8, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      // 主体
      ctx.fillStyle = 'rgba(0,180,255,0.3)';
      ctx.beginPath(); ctx.arc(cx, nodeY, nodeR, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = Config.NEON_CYAN; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(cx, nodeY, nodeR, 0, Math.PI * 2); ctx.stroke();
      // 进度环（装饰）
      ctx.strokeStyle = Config.NEON_CYAN; ctx.lineWidth = 2; ctx.globalAlpha = 0.4;
      ctx.beginPath(); ctx.arc(cx, nodeY, nodeR + 4, -Math.PI / 2, -Math.PI / 2 + (now * 0.001 % (Math.PI * 2))); ctx.stroke();
      ctx.globalAlpha = 1;
      // 章节号
      ctx.fillStyle = '#FFFFFF'; ctx.font = 'bold 20px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('' + chapter, cx, nodeY);
      this._chapterHitAreas.push({ chapter, x: cx - nodeR - 8, y: nodeY - nodeR - 8, w: (nodeR + 8) * 2, h: (nodeR + 8) * 2 });
    } else if (cleared) {
      // 已通关 — 绿色勾
      ctx.fillStyle = 'rgba(0,60,40,0.5)';
      ctx.beginPath(); ctx.arc(cx, nodeY, nodeR * 0.85, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = Config.NEON_GREEN + '66'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, nodeY, nodeR * 0.85, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = Config.NEON_GREEN; ctx.font = 'bold 15px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('' + chapter, cx, nodeY - 3);
      ctx.font = '10px monospace'; ctx.fillText('✓', cx, nodeY + 14);
      this._chapterHitAreas.push({ chapter, x: cx - nodeR, y: nodeY - nodeR, w: nodeR * 2, h: nodeR * 2 });
    } else {
      // 已解锁未通关 — 普通圆
      ctx.fillStyle = 'rgba(20,10,60,0.7)';
      ctx.beginPath(); ctx.arc(cx, nodeY, nodeR * 0.85, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = Config.NEON_CYAN + '44'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(cx, nodeY, nodeR * 0.85, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#FFFFFF'; ctx.font = 'bold 15px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('' + chapter, cx, nodeY);
      this._chapterHitAreas.push({ chapter, x: cx - nodeR, y: nodeY - nodeR, w: nodeR * 2, h: nodeR * 2 });
    }
  }

  _hexPath(ctx, cx, cy, r) {
    ctx.beginPath();
    for (let v = 0; v < 6; v++) { const a = Math.PI/6+v*Math.PI/3; const hx = cx+r*Math.cos(a), hy = cy+r*Math.sin(a); v===0?ctx.moveTo(hx,hy):ctx.lineTo(hx,hy); }
    ctx.closePath();
  }

  _drawWeaponBadge(ctx, nodeX, nodeY, nodeR, chapter, maxChapter, wDef, wk) {
    const sw = Config.SCREEN_WIDTH;
    const isLeft = nodeX > sw / 2, badgeW = 60, badgeH = 48;
    const badgeX = isLeft ? nodeX - nodeR - badgeW - 14 : nodeX + nodeR + 14;
    const wUnlocked = chapter <= maxChapter;
    ctx.fillStyle = wUnlocked ? 'rgba(20,15,50,0.9)' : 'rgba(30,25,50,0.5)';
    ctx.beginPath(); ctx.roundRect(badgeX, nodeY - badgeH / 2, badgeW, badgeH, 10); ctx.fill();
    ctx.strokeStyle = wUnlocked ? wDef.color + '88' : 'rgba(100,100,100,0.2)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(badgeX, nodeY - badgeH / 2, badgeW, badgeH, 10); ctx.stroke();
    ctx.globalAlpha = wUnlocked ? 1 : 0.3;
    const IL = getIconLoader();
    IL.drawIcon(ctx, 'weapon_' + wk, badgeX + badgeW / 2, nodeY - 4, 24);
    ctx.fillStyle = wUnlocked ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.25)'; ctx.font = '8px monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(wDef.name.length > 5 ? wDef.name.substring(0, 5) : wDef.name, badgeX + badgeW / 2, nodeY + 18);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = wUnlocked ? wDef.color + '44' : 'rgba(100,100,100,0.15)'; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(isLeft ? badgeX + badgeW : badgeX, nodeY); ctx.lineTo(isLeft ? nodeX - nodeR : nodeX + nodeR, nodeY); ctx.stroke(); ctx.setLineDash([]);
  }

  _drawScrollFade(ctx, sw, pathTop, pathBottom) {
    const grdTop = ctx.createLinearGradient(0, pathTop, 0, pathTop + 30);
    grdTop.addColorStop(0, 'rgba(5,3,20,1)'); grdTop.addColorStop(1, 'rgba(5,3,20,0)');
    ctx.fillStyle = grdTop; ctx.fillRect(0, pathTop, sw, 30);
    const grdBot = ctx.createLinearGradient(0, pathBottom - 30, 0, pathBottom);
    grdBot.addColorStop(0, 'rgba(5,3,20,0)'); grdBot.addColorStop(1, 'rgba(5,3,20,1)');
    ctx.fillStyle = grdBot; ctx.fillRect(0, pathBottom - 30, sw, 30);
  }

  // ===== 升级商店 =====
  drawUpgradeShop(ctx, saveManager, chipManager) {
    var sw = Config.SCREEN_WIDTH, sh = Config.SCREEN_HEIGHT, top = Config.SAFE_TOP;
    ctx.fillStyle = 'rgba(5,3,20,1)'; ctx.fillRect(0, 0, sw, sh);
    this._drawBg(ctx, sw, sh, 0.3, this._upgradeBg);

    // 顶部信息栏
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, 0, sw, top + 32);
    var IL1 = getIconLoader();
    IL1.drawIcon(ctx, 'ui_coin', 20, top + 13, 16);
    ctx.fillStyle = Config.NEON_YELLOW; ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText('' + saveManager.getCoins(), 30, top + 6);
    // 二级tab：飞机改造 | 改装台 | 抽奖
    var subTabY = top + 32;
    var subTabH = 36;
    var subTabs = ['飞机改造', '改装台', '抽奖'];
    var subTabColors = ['#00DDFF', '#BB66FF', '#FF8800'];
    var activeSubTab = this._upgradeSubTab || 0;
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, subTabY, sw, subTabH);
    this._upgradeSubTabAreas = [];
    var stw = sw / 3;
    for (var ti = 0; ti < 3; ti++) {
      var stx = stw * ti, stcx = stx + stw / 2;
      ctx.fillStyle = ti === activeSubTab ? subTabColors[ti] : 'rgba(255,255,255,0.3)';
      ctx.font = ti === activeSubTab ? 'bold 14px monospace' : '13px monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(subTabs[ti], stcx, subTabY + subTabH / 2);
      if (ti === activeSubTab) {
        ctx.fillStyle = subTabColors[ti]; ctx.fillRect(stx + 10, subTabY + subTabH - 3, stw - 20, 3);
      }
      this._upgradeSubTabAreas.push({ idx: ti, x: stx, y: subTabY, w: stw, h: subTabH });
    }

    // 如果选的是改装台或抽奖，交给对应UI绘制
    if (activeSubTab === 1) {
      if (!this._hangarUI) { var HangarUI = require('./HangarUI'); this._hangarUI = new HangarUI(); }
      this._hangarUI.draw(ctx, chipManager, saveManager);
      this._drawLobbyTabs(ctx, sw, sh, 1);
      return;
    }
    if (activeSubTab === 2) {
      if (!this._gachaUI) { var GachaUI = require('./GachaUI'); this._gachaUI = new GachaUI(); }
      this._gachaUI.draw(ctx, saveManager);
      this._drawLobbyTabs(ctx, sw, sh, 1);
      return;
    }

    // === 原飞机改造内容 ===
    ctx.fillStyle = Config.NEON_CYAN; ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';

    // imgPt：原图坐标→屏幕坐标（与_drawBg cover适配同步）
    var imgW = this._upgradeBg ? (this._upgradeBg.width || 1024) : 1024;
    var imgH = this._upgradeBg ? (this._upgradeBg.height || 1024) : 1024;
    var visH = sh - Config.SAFE_BOTTOM - 70;
    var imgScale = Math.max(sw / imgW, visH / imgH);
    var bgOffX = (sw - imgW * imgScale) / 2;
    var bgOffY = (visH - imgH * imgScale) / 2;
    function imgPt(ix, iy) { return { x: bgOffX + ix * imgScale, y: bgOffY + iy * imgScale }; }

    // Vin确认锚点（原图1024x1024）
    var anchors = {
      nose:   imgPt(370, 685),
      tail:   imgPt(540, 420),
      leftW:  imgPt(650, 580),
      rightW: imgPt(420, 495),
      core:   imgPt(506, 540),
    };

    var cardW = sw * 0.43, cardH = 90;
    var m = 5;

    // Vin手动指定：部位 → 占比位置 + 靠左/靠右（基于可见区域visH）
    var visH = sh - Config.SAFE_BOTTOM - 70;
    var layouts = [
      { key:'attack',    name:'机炮改装',   part:'机头', icon:'nose_icon',  desc:'攻击力',   suffix:'',  color:'#44FF88',
        anchor: anchors.nose,   x: m,              y: visH * (680 / 1024) },
      { key:'energyDmg', name:'尾翼·脉冲',  part:'尾翼', icon:'tail_icon',  desc:'能量伤害', suffix:'%', color:'#BB66FF',
        anchor: anchors.tail,   x: sw - cardW - m, y: visH * (240 / 1024) },
      { key:'fireDmg',   name:'左翼·烈焰',  part:'左翼', icon:'leftW_icon',  desc:'火焰伤害', suffix:'%', color:'#FF4422',
        anchor: anchors.leftW,  x: sw - cardW - m, y: visH * (630 / 1024) },
      { key:'iceDmg',    name:'右翼·寒冰',  part:'右翼', icon:'rightW_icon',  desc:'寒冰伤害', suffix:'%', color:'#44DDFF',
        anchor: anchors.rightW, x: m,              y: visH * (330 / 1024) },
      { key:'crit',      name:'引擎核心',   part:'引擎', icon:'core_icon',  desc:'暴击率',   suffix:'%', color:'#FFAA00',
        anchor: anchors.core,   x: sw - cardW - m, y: visH * (430 / 1024) },
    ];

    this._shopUpgradeAreas = [];
    var now = Date.now();

    for (var i = 0; i < layouts.length; i++) {
      var u = layouts[i];
      var ax = u.anchor.x, ay = u.anchor.y;
      var posX = u.x, posY = u.y;

      var lv = saveManager.getUpgrade(u.key);
      var maxLvl = SaveManagerClass.UPGRADE_CONFIG[u.key] ? SaveManagerClass.UPGRADE_CONFIG[u.key].maxLevel : 1;
      var maxed = saveManager.isUpgradeMaxed(u.key);
      var cost = saveManager.getUpgradeCost(u.key);
      var canAfford = saveManager.getCoins() >= cost;

      // 引导线起点：卡牌四边中点选最近锚点的
      var mids = [
        { x: posX + cardW / 2, y: posY },
        { x: posX + cardW / 2, y: posY + cardH },
        { x: posX,             y: posY + cardH / 2 },
        { x: posX + cardW,     y: posY + cardH / 2 },
      ];
      var bestD = 99999, lsx = mids[0].x, lsy = mids[0].y;
      for (var mi = 0; mi < mids.length; mi++) {
        var ddx = mids[mi].x - ax, ddy = mids[mi].y - ay;
        if (ddx * ddx + ddy * ddy < bestD) { bestD = ddx*ddx+ddy*ddy; lsx = mids[mi].x; lsy = mids[mi].y; }
      }

      ctx.strokeStyle = u.color + '18'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(lsx, lsy); ctx.lineTo(ax, ay); ctx.stroke();
      ctx.strokeStyle = u.color + '77'; ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 4]);
      ctx.beginPath(); ctx.moveTo(lsx, lsy); ctx.lineTo(ax, ay); ctx.stroke();
      ctx.setLineDash([]);
      var pulse = 0.5 + 0.5 * Math.sin(now / 500 + i * 1.2);
      var pAlpha = Math.floor(pulse * 140 + 80).toString(16).padStart(2, '0');
      ctx.fillStyle = u.color + pAlpha;
      ctx.beginPath(); ctx.arc(ax, ay, 2.5 + pulse * 2, 0, Math.PI * 2); ctx.fill();

      // 卡牌
      ctx.fillStyle = 'rgba(8,4,22,0.92)';
      ctx.beginPath(); ctx.roundRect(posX, posY, cardW, cardH, 8); ctx.fill();
      var isFlashing = this._upgradeFlash && this._upgradeFlash.key === u.key && (Date.now() - this._upgradeFlash.time) < 400;
      ctx.strokeStyle = isFlashing ? u.color : ((canAfford || maxed) ? u.color + '55' : u.color + '18');
      ctx.lineWidth = isFlashing ? 2.5 : 1;
      ctx.beginPath(); ctx.roundRect(posX, posY, cardW, cardH, 8); ctx.stroke();
      ctx.fillStyle = u.color + '66';
      ctx.fillRect(posX + 8, posY, cardW - 16, 2);

      // 第1行：图标 + 名称（垂直居中）
      var IL = getIconLoader();
      IL.drawIcon(ctx, u.icon, posX + 18, posY + 12, 22);

      ctx.fillStyle = '#FFFFFF'; ctx.font = 'bold 13px monospace';
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(u.name, posX + 34, posY + 12);

      // 第2行：效果数值
      ctx.fillStyle = u.color; ctx.font = 'bold 16px monospace';
      ctx.textBaseline = 'top';
      ctx.fillText(u.desc + ' +' + lv + u.suffix, posX + 8, posY + 28);

      // 第3行：等级
      ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.font = '11px monospace';
      ctx.fillText('Lv.' + lv + '/' + maxLvl, posX + 8, posY + 50);

      var btnW = 72, btnH = 30, btnX = posX + cardW - btnW - 6, btnY = posY + cardH - btnH - 6;
      if (maxed) {
        ctx.fillStyle = Config.NEON_GREEN; ctx.font = 'bold 14px monospace';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('MAX', btnX + btnW / 2, btnY + btnH / 2);
      } else {
        ctx.fillStyle = canAfford ? 'rgba(0,200,255,0.15)' : 'rgba(30,30,30,0.1)';
        ctx.beginPath(); ctx.roundRect(btnX, btnY, btnW, btnH, 4); ctx.fill();
        ctx.strokeStyle = canAfford ? Config.NEON_CYAN + '44' : 'rgba(60,60,60,0.1)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.roundRect(btnX, btnY, btnW, btnH, 4); ctx.stroke();
        ctx.fillStyle = canAfford ? Config.NEON_YELLOW : 'rgba(100,100,100,0.3)';
        ctx.font = 'bold 13px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        var bcx = btnX + btnW / 2, bcy = btnY + btnH / 2;
        getIconLoader().drawIcon(ctx, 'ui_coin', bcx - ctx.measureText('' + cost).width / 2 - 9, bcy, 10);
        ctx.fillText(' ' + cost, bcx + 2, bcy);
        this._shopUpgradeAreas.push({ key: u.key, x: btnX, y: btnY, w: btnW, h: btnH });
      }
    }
    this._drawUpgradeEffects(ctx);
    this._drawLobbyTabs(ctx, sw, sh, 1);
  }

  // ===== 武器商店 =====
  drawWeaponShop(ctx, saveManager) {

    const sw = Config.SCREEN_WIDTH, sh = Config.SCREEN_HEIGHT, top = Config.SAFE_TOP;
    this._weaponHitAreas = [];
    ctx.fillStyle = 'rgba(0,0,0,0.95)'; ctx.fillRect(0, 0, sw, sh);
    this._drawBg(ctx, sw, sh, 0.55, this._weaponBg);

    // 顶部信息栏
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(0, 0, sw, top + 32);
    const IL2 = getIconLoader();
    IL2.drawIcon(ctx, 'ui_coin', 20, top + 13, 16);
    ctx.fillStyle = Config.NEON_YELLOW; ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText('' + saveManager.getCoins(), 30, top + 6);
    ctx.fillStyle = Config.NEON_PINK; ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center'; ctx.fillText('武器强化', sw / 2, top + 6);
    const critBonus = saveManager.getWeaponCritDamageBonus();
    ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.font = '11px monospace';
    ctx.textAlign = 'right'; ctx.fillText('暴伤+' + (critBonus * 100).toFixed(0) + '%', sw - 14, top + 8);

    if (this._weaponDetailKey) { this._drawLobbyTabs(ctx, sw, sh, 2); this._drawWeaponDetail(ctx, sw, sh, top, saveManager, this._weaponDetailKey); return; }

    // 武器解锁配置统一在 WeaponUnlockConfig
    const maxChapter = saveManager.getMaxChapter();

    // 构建武器列表（飞机 + 武器，按解锁章节排序）
    const allItems = [{ key: 'ship', iconKey: 'tab_upgrade', name: '战斗飞机', color: '#00DDFF', isShip: true }];
    var weaponKeys = Object.keys(WEAPON_TREES);
    weaponKeys.sort(function(a, b) { return (WeaponUnlockConfig[a] && WeaponUnlockConfig[a].unlockChapter || 99) - (WeaponUnlockConfig[b] && WeaponUnlockConfig[b].unlockChapter || 99); });
    for (let i = 0; i < weaponKeys.length; i++) {
      const wk = weaponKeys[i], wDef = WEAPON_TREES[wk];
      allItems.push({ key: wk, iconKey: 'weapon_' + wk, name: wDef.name, color: wDef.color, isShip: false });
    }

    // 卡牌网格：3列（支持滚动）
    const margin = 10, gap = 8, cols = 3;
    const cardW = (sw - margin * 2 - gap * (cols - 1)) / cols;
    const cardH = cardW * 1.3;
    const startY = top + 36;
    const totalRows = Math.ceil(allItems.length / cols);
    const contentH = totalRows * (cardH + gap) - gap;
    const visibleH = sh - startY - 70 - (Config.SAFE_BOTTOM || 0) - 10; // 底栏tab(70) + safeBottom + 间距
    const maxScroll = Math.max(0, contentH - visibleH);
    this._weaponListMaxScroll = maxScroll;
    if (!this._elasticMode) {
      if (this._weaponListScrollY < 0) this._weaponListScrollY = 0;
      if (this._weaponListScrollY > maxScroll) this._weaponListScrollY = maxScroll;
    }
    const scrollY = this._weaponListScrollY;

    // 裁剪区域（不画到底栏上）
    ctx.save();
    ctx.beginPath(); ctx.rect(0, startY - 4, sw, visibleH + 8); ctx.clip();

    for (let i = 0; i < allItems.length; i++) {
      const item = allItems[i], wk = item.key;
      const col = i % cols, row = Math.floor(i / cols);
      const cx = margin + col * (cardW + gap);
      const cy = startY + row * (cardH + gap) - scrollY;
      if (cy + cardH < startY - 10 || cy > sh) continue;

      const unlockCfg = WeaponUnlockConfig[wk] || {}; const unlockAt = unlockCfg.unlockChapter || 1;
      const isUnlocked = maxChapter >= unlockAt;

      const lv = saveManager.getWeaponLevel(wk), maxLv = saveManager.getWeaponMaxLevel();
      const maxed = saveManager.isWeaponMaxed(wk);
      const ratio = lv / maxLv;

      // 卡片背景
      ctx.fillStyle = isUnlocked ? 'rgba(12,8,35,0.88)' : 'rgba(15,12,25,0.92)';
      ctx.beginPath(); ctx.roundRect(cx, cy, cardW, cardH, 12); ctx.fill();

      if (isUnlocked) {
        // === 已解锁 ===
        // 顶部彩色细线
        ctx.fillStyle = item.color + '66';
        ctx.beginPath(); ctx.roundRect(cx + 8, cy, cardW - 16, 2, 1); ctx.fill();
        // 边框
        ctx.strokeStyle = item.color + '33'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.roundRect(cx, cy, cardW, cardH, 12); ctx.stroke();
        // 图标
        const iconY = cy + cardH * 0.28;
        const IL = getIconLoader();
        IL.drawIcon(ctx, item.iconKey, cx + cardW / 2, iconY, 40);
        // 名称
        ctx.fillStyle = '#FFFFFF'; ctx.font = 'bold 15px monospace';
        ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillText(item.name, cx + cardW / 2, cy + cardH * 0.52);
        // 等级
        ctx.fillStyle = maxed ? Config.NEON_GREEN : item.color;
        ctx.font = 'bold 13px monospace';
        ctx.fillText(maxed ? 'MAX' : 'Lv.' + lv, cx + cardW / 2, cy + cardH * 0.66);
        // 伤害类型小标签
        const dtCfg = WeaponUnlockConfig[wk] || {}; const dtI = { type: dtCfg.dmgType || 'physical', label: dtCfg.dmgLabel || '物理', color: dtCfg.dmgColor || '#FFFFFF' };
        ctx.font = 'bold 10px monospace';
        const dtW2 = ctx.measureText(dtI.label).width + 10;
        const dtX2 = cx + (cardW - dtW2) / 2, dtY3 = cy + cardH * 0.80;
        ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.beginPath(); ctx.roundRect(dtX2, dtY3, dtW2, 16, 3); ctx.fill();
        ctx.strokeStyle = dtI.color + '55'; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.roundRect(dtX2, dtY3, dtW2, 16, 3); ctx.stroke();
        ctx.fillStyle = dtI.color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(dtI.label, cx + cardW / 2, dtY3 + 8);
        this._weaponHitAreas.push({ key: wk, x: cx, y: cy, w: cardW, h: cardH });
      } else {
        // === 未解锁 ===
        // 暗色边框
        ctx.strokeStyle = 'rgba(80,80,80,0.25)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.roundRect(cx, cy, cardW, cardH, 12); ctx.stroke();
        // 图标（半透明）
        ctx.globalAlpha = 0.25;
        const IL = getIconLoader();
        IL.drawIcon(ctx, item.iconKey, cx + cardW / 2, cy + cardH * 0.28, 40);
        ctx.globalAlpha = 1;
        // 锁图标
        IL.drawIcon(ctx, 'ui_lock', cx + cardW / 2, cy + cardH * 0.28, 22);
        // 名称（暗色）
        ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.font = 'bold 15px monospace';
        ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillText(item.name, cx + cardW / 2, cy + cardH * 0.52);
        // 解锁条件
        ctx.fillStyle = 'rgba(255,180,50,0.5)'; ctx.font = '12px monospace';
        ctx.fillText('第' + unlockAt + '关解锁', cx + cardW / 2, cy + cardH * 0.68);
      }
    }

    ctx.restore(); // 恢复裁剪
    // 滚动指示器
    if (maxScroll > 0) {
      const barH = Math.max(20, visibleH * (visibleH / contentH));
      const barY = startY + (visibleH - barH) * (scrollY / maxScroll);
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.beginPath(); ctx.roundRect(sw - 4, barY, 3, barH, 1.5); ctx.fill();
    }
    this._drawLobbyTabs(ctx, sw, sh, 2);
  }

  _drawWeaponDetail(ctx, sw, sh, top, saveManager, weaponKey) {
    // 飞机视为特殊武器
    const isShip = weaponKey === 'ship';
    const wDef = isShip
      ? { name: '战斗飞机', desc: '你的主力战机，发射子弹消灭砖块', color: '#00DDFF', basePct: 1.0, interval: 400, branches: SHIP_TREE }
      : WEAPON_TREES[weaponKey];
    if (!wDef) return;
    const lv = saveManager.getWeaponLevel(weaponKey), maxLv = saveManager.getWeaponMaxLevel();
    const cost = saveManager.getWeaponUpgradeCost(weaponKey), canAfford = saveManager.getCoins() >= cost.coins, maxed = saveManager.isWeaponMaxed(weaponKey);
    this._weaponDetailHitAreas = [];
    // 遮罩（覆盖底栏）
    ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0, 0, sw, sh);
    const popW = sw - 32, popH = sh * 0.65, popX = 16, popY = (sh - popH) / 2 - 20, cx = sw / 2, pad = 16, innerX = popX + pad, innerW = popW - pad * 2;
    // 弹框主体
    ctx.fillStyle = 'rgba(15,10,40,0.97)'; ctx.beginPath(); ctx.roundRect(popX, popY, popW, popH, 16); ctx.fill();
    ctx.strokeStyle = wDef.color + '66'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(popX, popY, popW, popH, 16); ctx.stroke();
    this._weaponPopupRect = { x: popX, y: popY, w: popW, h: popH };

    // 底部关闭按钮（圆形 X）
    const closeR = 22, closeCY = popY + popH + 28;
    ctx.beginPath(); ctx.arc(cx, closeCY, closeR, 0, Math.PI * 2); ctx.fillStyle = 'rgba(15,10,40,0.9)'; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1.5; ctx.stroke();
    // X 图形
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx - 8, closeCY - 8); ctx.lineTo(cx + 8, closeCY + 8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + 8, closeCY - 8); ctx.lineTo(cx - 8, closeCY + 8); ctx.stroke();
    this._weaponDetailHitAreas.push({ action: 'close', x: cx - closeR, y: closeCY - closeR, w: closeR * 2, h: closeR * 2 });

    // 顶部：图标+名称+等级
    let cy = popY + 18;
    const IL = getIconLoader();
    const detailIconKey = isShip ? 'tab_upgrade' : ('weapon_' + weaponKey);
    IL.drawIcon(ctx, detailIconKey, innerX + 18, cy + 18, 34);
    ctx.fillStyle = '#FFFFFF'; ctx.font = 'bold 18px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(wDef.name, innerX + 44, cy + 2);
    ctx.fillStyle = wDef.color; ctx.font = 'bold 16px monospace'; ctx.fillText(lv + '级', innerX + 44, cy + 24);
    cy += 50;
    ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.font = '12px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    // 描述自动换行
    var descWords = wDef.desc, descMaxW = innerW, descLines = [];
    var tmpLine = '';
    for (var di = 0; di < descWords.length; di++) {
      tmpLine += descWords[di];
      if (ctx.measureText(tmpLine).width > descMaxW) { descLines.push(tmpLine.slice(0, -1)); tmpLine = descWords[di]; }
    }
    if (tmpLine) descLines.push(tmpLine);
    for (var dl = 0; dl < descLines.length; dl++) { ctx.fillText(descLines[dl], innerX, cy + dl * 16); }
    cy += Math.max(descLines.length, 1) * 16 + 6;

    // 双Tab移到底部（升级区域上方）
    const upgradeAreaH = 90, tabH2 = 36;
    const contentBottom = popY + popH - upgradeAreaH - tabH2 - 8;

    // ===== 双Tab（底部） =====
    const tabW = innerW / 2, tabY = popY + popH - upgradeAreaH - tabH2;
    const tabs = ['属性', '技能树'];
    // 分隔线
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(innerX, tabY); ctx.lineTo(innerX + innerW, tabY); ctx.stroke();
    for (let i = 0; i < 2; i++) {
      const tx = innerX + i * tabW, active = this._weaponDetailTab === i;
      ctx.fillStyle = active ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0)';
      ctx.beginPath(); ctx.roundRect(tx, tabY, tabW, tabH2, [0, 0, 0, 0]); ctx.fill();
      if (active) { ctx.fillStyle = wDef.color; ctx.fillRect(tx + 4, tabY + tabH2 - 2, tabW - 8, 2); }
      ctx.fillStyle = active ? '#FFFFFF' : 'rgba(255,255,255,0.4)';
      ctx.font = active ? 'bold 13px monospace' : '13px monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(tabs[i], tx + tabW / 2, tabY + tabH2 / 2);
      this._weaponDetailHitAreas.push({ action: 'tab', tabIdx: i, x: tx, y: tabY, w: tabW, h: tabH2 });
    }

    if (this._weaponDetailTab === 0) {
      // ===== 属性Tab =====
      // 武器伤害类型映射
      
      // ===== 技能属性（含爽点属性+升级预览） =====
      const shopDef2 = ShopDefs.WEAPON_SHOP[weaponKey];
      const currentDmgMult = ShopDefs.getDmgMultiplier(lv);
      const nextDmgMult = maxed ? currentDmgMult : ShopDefs.getDmgMultiplier(lv + 1);
      const effectivePct = (wDef.basePct * currentDmgMult * 100).toFixed(0);
      const nextEffectivePct = (wDef.basePct * nextDmgMult * 100).toFixed(0);
      const dmgChanged = !maxed && nextEffectivePct !== effectivePct;
      
      // 爽点属性当前值
      const ssVal = ShopDefs.getSweetSpotValue(weaponKey, lv);
      const nextSsVal = maxed ? ssVal : ShopDefs.getSweetSpotValue(weaponKey, lv + 1);
      const ssChanged = !maxed && nextSsVal !== ssVal;
      const ssTypeNames = { cd: '冷却时间', chains: '闪电链数', pierce: '穿透数', bombs: '载弹量', duration: '持续时间', count: '数量', salvo: '齐射数', fireRate: '射击间隔' };
      const ssLabel = shopDef2 ? (ssTypeNames[shopDef2.sweetSpot.type] || shopDef2.sweetSpot.type) : '';
      
      // 根据爽点类型格式化显示值
      function fmtSs(val, type, unit) {
        if (type === 'cd') return (val / 1000).toFixed(1) + 's';
        if (type === 'duration') return val.toFixed(1) + 's';
        if (type === 'fireRate') { var baseMs = 800; var bonus = val - 1.0; var actualMs = baseMs * (1 - bonus); return (Math.max(80, actualMs) / 1000).toFixed(2) + '秒'; }
        return val + unit;
      }
      
      // 计算属性行数（伤害系数+冷却/爽点+伤害类型）= 基础3行 + 爽点可能替代冷却
      var attrRows = 2; // 伤害系数、爽点/冷却
      var showSeparateCd = true;
      if (shopDef2 && (shopDef2.sweetSpot.type === 'cd' || shopDef2.sweetSpot.type === 'fireRate')) {
        showSeparateCd = false; // 爽点就是CD或射速，不重复显示冷却行
      } else if (shopDef2) {
        attrRows = 3; // 伤害系数、冷却、爽点属性
      }
      const attrBoxH = 26 + attrRows * 24 + 12;
      
      ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.beginPath(); ctx.roundRect(innerX, cy, innerW, attrBoxH, 8); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(innerX, cy, innerW, attrBoxH, 8); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = 'bold 14px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText('▪ 技能属性', innerX + 10, cy + 8);
      const aY = cy + 32, labelX = innerX + 14, valRight = innerX + innerW - 14;
      ctx.font = '14px monospace';
      var rowIdx = 0;
      
      // 伤害系数（显示实际值 + 升级预览）
      ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.textAlign = 'left'; ctx.fillText('伤害系数', labelX, aY + rowIdx * 24);
      ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'right'; ctx.fillText(effectivePct + '%', valRight - (dmgChanged ? 70 : 0), aY + rowIdx * 24);
      if (dmgChanged) {
        ctx.fillStyle = Config.NEON_GREEN; ctx.font = '12px monospace';
        ctx.fillText('→ ' + nextEffectivePct + '%', valRight, aY + rowIdx * 24 + 1);
        ctx.font = '14px monospace';
      }
      rowIdx++;
      
      // 冷却时间 / 爽点属性
      if (shopDef2 && shopDef2.sweetSpot.type === 'cd') {
        // 爽点就是CD，直接显示爽点值作为冷却
        ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.textAlign = 'left'; ctx.fillText('冷却时间', labelX, aY + rowIdx * 24);
        var cdStr = fmtSs(ssVal, 'cd', 'ms');
        ctx.fillStyle = Config.NEON_YELLOW; ctx.textAlign = 'right'; ctx.fillText(cdStr, valRight - (ssChanged ? 70 : 0), aY + rowIdx * 24);
        if (ssChanged) {
          ctx.fillStyle = Config.NEON_GREEN; ctx.font = '12px monospace';
          ctx.fillText('→ ' + fmtSs(nextSsVal, 'cd', 'ms'), valRight, aY + rowIdx * 24 + 1);
          ctx.font = '14px monospace';
        }

        rowIdx++;
      } else {
        // 固定冷却（fireRate类型不显示，避免重复）
        if (!showSeparateCd) { /* skip */ } else {
          const interval = (wDef.interval / 1000).toFixed(1);
          ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.textAlign = 'left'; ctx.fillText('冷却时间', labelX, aY + rowIdx * 24);
          ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'right'; ctx.fillText(interval + 's', valRight, aY + rowIdx * 24);
          rowIdx++;
        }
        
        // 爽点属性单独一行
        if (shopDef2) {
          ctx.fillStyle = Config.NEON_YELLOW; ctx.textAlign = 'left';
          ctx.fillText(ssLabel, labelX, aY + rowIdx * 24);
          
          var ssStr = fmtSs(ssVal, shopDef2.sweetSpot.type, shopDef2.sweetSpot.unit);
          ctx.fillStyle = Config.NEON_YELLOW; ctx.textAlign = 'right'; ctx.fillText(ssStr, valRight - (ssChanged ? 70 : 0), aY + rowIdx * 24);
          if (ssChanged) {
            ctx.fillStyle = Config.NEON_GREEN; ctx.font = '12px monospace';
            ctx.fillText('→ ' + fmtSs(nextSsVal, shopDef2.sweetSpot.type, shopDef2.sweetSpot.unit), valRight, aY + rowIdx * 24 + 1);
            ctx.font = '14px monospace';
          }
          rowIdx++;
        }
      }

      cy += attrBoxH + 8;

      // 升级里程碑列表（选项+被动+爽点）
      const shopDef = ShopDefs.WEAPON_SHOP[weaponKey];

      if (shopDef) {
        // 构建里程碑列表
        const milestones = [];
        // 选项解锁（2/10/18）
        for (const slv in shopDef.unlockBranches) {
          const bk = shopDef.unlockBranches[slv];
          const bDef = wDef.branches[bk];
          milestones.push({ level: parseInt(slv), type: 'option', label: '选项', desc: '解锁: ' + (bDef ? bDef.name : bk) });
        }
        // 被动解锁（6/14/22/26/30）
        for (const plv in shopDef.passives) {
          const p = shopDef.passives[plv];
          milestones.push({ level: parseInt(plv), type: 'passive', label: '被动', desc: p.name + ': ' + p.desc });
        }
        milestones.sort(function(a, b) { return a.level - b.level; });

        // 可滚动区域
        const cardH2 = 60, cardGap2 = 6;
        const totalH2 = milestones.length * (cardH2 + cardGap2);
        const viewH2 = contentBottom - cy;
        const maxScroll2 = Math.max(0, totalH2 - viewH2);
        if (!this._attrScrollY) this._attrScrollY = 0;
        this._attrMaxScroll = maxScroll2;
        ctx.save(); ctx.beginPath(); ctx.rect(popX, cy, popW, viewH2); ctx.clip();
        let drawY2 = cy - this._attrScrollY;

        for (let i = 0; i < milestones.length; i++) {
          const m = milestones[i], unlocked = lv >= m.level;
          if (drawY2 + cardH2 < cy) { drawY2 += cardH2 + cardGap2; continue; }
          if (drawY2 > contentBottom) break;
          const typeColors = { sweet: 'rgba(255,200,0,', option: 'rgba(0,180,255,', passive: 'rgba(180,100,255,' };
          const tc = typeColors[m.type] || 'rgba(255,255,255,';
          ctx.fillStyle = unlocked ? tc + '0.08)' : 'rgba(255,255,255,0.03)'; ctx.beginPath(); ctx.roundRect(innerX, drawY2, innerW, cardH2, 8); ctx.fill();
          ctx.strokeStyle = unlocked ? tc + '0.2)' : 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(innerX, drawY2, innerW, cardH2, 8); ctx.stroke();
          // 等级标签
          const tagW2 = 42, tagH2 = 26, tagX2 = innerX + 8, tagY2 = drawY2 + (cardH2 - tagH2) / 2;
          ctx.fillStyle = unlocked ? tc + '0.2)' : 'rgba(255,255,255,0.06)'; ctx.beginPath(); ctx.roundRect(tagX2, tagY2, tagW2, tagH2, 6); ctx.fill();
          ctx.fillStyle = unlocked ? '#FFFFFF' : 'rgba(255,255,255,0.35)'; ctx.font = 'bold 14px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(m.level + '级', tagX2 + tagW2 / 2, tagY2 + tagH2 / 2);
          // 描述文本（不含类型标签）
          ctx.fillStyle = unlocked ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.3)'; ctx.font = '14px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
          var descText = m.desc; if (descText.length > 24) descText = descText.substring(0, 23) + '…';
          ctx.fillText(descText, innerX + 58, drawY2 + cardH2 / 2);
          if (unlocked) { ctx.fillStyle = Config.NEON_GREEN; ctx.font = 'bold 14px monospace'; ctx.textAlign = 'right'; ctx.fillText('✓', innerX + innerW - 10, drawY2 + cardH2 / 2 - 7); }
          drawY2 += cardH2 + cardGap2;
        }
        ctx.restore();

      }
    } else {
      // ===== 技能树Tab（可滚动） =====
      const unlocks = SaveManagerClass.getWeaponUnlocks(weaponKey);
      const gatedBranches = {};
      for (const u of unlocks) gatedBranches[u.branchKey] = u.level;

      const branches = Object.keys(wDef.branches).filter(function(bk){ return !wDef.branches[bk].hidden; }).sort(function(a, b) { return (gatedBranches[a] || 0) - (gatedBranches[b] || 0); });
      const cardH = 58, cardGap = 5;
      const totalH = branches.length * (cardH + cardGap);
      const viewH = contentBottom - cy;
      const maxScroll = Math.max(0, totalH - viewH);

      // 限制滚动范围
      this._skillTreeMaxScroll = maxScroll;

      // 裁剪可视区域
      ctx.save();
      ctx.beginPath();
      ctx.rect(popX, cy, popW, viewH);
      ctx.clip();

      const scrollOffset = this._skillTreeScrollY || 0;
      let drawY = cy - scrollOffset;

      for (let i = 0; i < branches.length; i++) {
        const bk = branches[i], bDef = wDef.branches[bk];

        // 跳过不可见的卡片
        if (drawY + cardH < cy) { drawY += cardH + cardGap; continue; }
        if (drawY > contentBottom) break;

        // 判断是否被商店等级锁定
        const shopGate = gatedBranches[bk] || 0;
        const shopLocked = shopGate > 0 && lv < shopGate;
        // 判断前置依赖是否满足（显示用，不影响商店锁）
        let reqText = null;
        if (bDef.requires) {
          const reqParts = [];
          for (const rk in bDef.requires) {
            const rDef = wDef.branches[rk];
            reqParts.push((rDef ? rDef.name : rk) + ' ' + bDef.requires[rk] + '级');
          }
          reqText = '需要: ' + reqParts.join(', ');
        }

        // 卡片背景
        const isBase = !bDef.requires;
        if (shopLocked) {
          ctx.fillStyle = 'rgba(255,60,60,0.04)';
        } else {
          ctx.fillStyle = isBase ? 'rgba(0,200,255,0.06)' : 'rgba(200,150,255,0.06)';
        }
        ctx.beginPath(); ctx.roundRect(innerX, drawY, innerW, cardH, 8); ctx.fill();
        ctx.strokeStyle = shopLocked ? 'rgba(255,60,60,0.15)' : (isBase ? 'rgba(0,200,255,0.12)' : 'rgba(200,150,255,0.12)');
        ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(innerX, drawY, innerW, cardH, 8); ctx.stroke();

        // 分支名称
        ctx.fillStyle = shopLocked ? 'rgba(255,255,255,0.4)' : '#FFFFFF';
        ctx.font = 'bold 15px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        ctx.fillText(bDef.name, innerX + 10, drawY + 8);

        // 右侧：解锁条件 或 等级上限
        ctx.font = '13px monospace'; ctx.textAlign = 'right';
        if (shopLocked) {
          ctx.fillStyle = '#FF5555';
          ctx.fillText(shopGate + '级解锁', innerX + innerW - 10, drawY + 9);
        } else {
          // 上限等级
          ctx.fillStyle = 'rgba(255,255,255,0.4)';
          ctx.fillText('上限' + bDef.max + '级', innerX + innerW - 10, drawY + 9);
          // 前置条件（上限下方一行）
          if (reqText) {
            ctx.fillStyle = 'rgba(200,150,255,0.5)'; ctx.font = '11px monospace'; ctx.textAlign = 'right';
            ctx.fillText(reqText, innerX + innerW - 10, drawY + 25);
            ctx.font = '13px monospace';
          }
        }

        // 描述（自动换行+垂直居中）
        ctx.fillStyle = shopLocked ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.6)';
        ctx.font = '14px monospace'; ctx.textAlign = 'left';
        var descMaxW = innerW - 20;
        var descLines = [];
        var descText = bDef.desc;
        while (descText.length > 0) {
          var fit = descText.length;
          while (fit > 0 && ctx.measureText(descText.substring(0, fit)).width > descMaxW) fit--;
          if (fit <= 0) fit = 1;
          descLines.push(descText.substring(0, fit));
          descText = descText.substring(fit);
        }
        var descLineH = 16;
        var descTotalH = descLines.length * descLineH;
        var descAreaTop = drawY + 26;
        var descAreaH = cardH - 26 - 2;
        var descStartY = descAreaTop + (descAreaH - descTotalH) / 2;
        for (var dl = 0; dl < descLines.length; dl++) {
          ctx.fillText(descLines[dl], innerX + 10, descStartY + dl * descLineH);
        }

        drawY += cardH + cardGap;
      }

      ctx.restore(); // 恢复裁剪


    }

    // ===== 底部升级区域（两个Tab共用） =====
    const btmY = popY + popH - upgradeAreaH;
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(innerX, btmY); ctx.lineTo(innerX + innerW, btmY); ctx.stroke();
    if (maxed) {
      ctx.fillStyle = Config.NEON_GREEN; ctx.font = 'bold 18px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('= 已满级 =', cx, btmY + 40);
    } else {
      ctx.fillStyle = canAfford ? Config.NEON_YELLOW : '#FF5555'; ctx.font = 'bold 15px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      getIconLoader().drawIcon(ctx, 'ui_coin', cx - ctx.measureText('' + cost.coins).width / 2 - 11, btmY + 16, 15);
      ctx.fillText('  ' + cost.coins, cx, btmY + 8);
      const btnW2 = 150, btnH2 = 38, btnX2 = cx - btnW2 / 2, btnY2 = btmY + 32;
      ctx.fillStyle = canAfford ? 'rgba(0,200,100,0.25)' : 'rgba(100,100,100,0.12)'; ctx.beginPath(); ctx.roundRect(btnX2, btnY2, btnW2, btnH2, 10); ctx.fill();
      ctx.strokeStyle = canAfford ? Config.NEON_GREEN : 'rgba(100,100,100,0.3)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(btnX2, btnY2, btnW2, btnH2, 10); ctx.stroke();
      ctx.fillStyle = canAfford ? '#FFFFFF' : 'rgba(255,255,255,0.3)'; ctx.font = 'bold 16px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('升  级', cx, btnY2 + btnH2 / 2);
      this._weaponDetailHitAreas.push({ action: 'upgrade', key: weaponKey, x: btnX2, y: btnY2, w: btnW2, h: btnH2 });
      ctx.fillStyle = Config.NEON_ORANGE; ctx.font = '12px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; var nextCritPct = (ShopDefs.getCritBonusPerLevel(lv + 1) * 100).toFixed(0);
      ctx.fillText('升级奖励：暴击伤害+' + nextCritPct + '%', cx, btnY2 + btnH2 + 4);
    }
  }

  // ===== 底部3Tab =====
  // 触发升级成功特效
  triggerUpgradeEffect(key) {
    // 找到该卡牌按钮位置
    if (!this._shopUpgradeAreas) return;
    for (var i = 0; i < this._shopUpgradeAreas.length; i++) {
      var a = this._shopUpgradeAreas[i];
      if (a.key === key) {
        var cx = a.x + a.w / 2, cy = a.y + a.h / 2;
        // 找对应颜色
        var colors = { attack:'#44FF88', energyDmg:'#BB66FF', fireDmg:'#FF4422', iceDmg:'#44DDFF', crit:'#FFAA00' };
        var col = colors[key] || '#FFFFFF';
        // 生成粒子
        for (var p = 0; p < 12; p++) {
          var angle = (Math.PI * 2 / 12) * p + Math.random() * 0.3;
          var speed = 2 + Math.random() * 3;
          this._upgradeEffects.push({
            x: cx, y: cy,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 1.0,
            decay: 0.02 + Math.random() * 0.015,
            color: col,
            size: 2 + Math.random() * 3,
          });
        }
        // 闪光环
        this._upgradeEffects.push({
          x: cx, y: cy, vx: 0, vy: 0,
          life: 1.0, decay: 0.04, color: col,
          size: 5, isRing: true,
        });
        // 数值飘字
        this._upgradeFlash = { key: key, time: Date.now(), color: col };
        break;
      }
    }
  }

  // 绘制升级特效
  _drawUpgradeEffects(ctx) {
    for (var i = this._upgradeEffects.length - 1; i >= 0; i--) {
      var p = this._upgradeEffects[i];
      p.x += p.vx; p.y += p.vy;
      p.life -= p.decay;
      if (p.life <= 0) { this._upgradeEffects.splice(i, 1); continue; }
      var alpha = Math.floor(p.life * 255).toString(16).padStart(2, '0');
      if (p.isRing) {
        var radius = (1 - p.life) * 40 + 5;
        ctx.strokeStyle = p.color + alpha;
        ctx.lineWidth = 2 * p.life;
        ctx.beginPath(); ctx.arc(p.x, p.y, radius, 0, Math.PI * 2); ctx.stroke();
      } else {
        ctx.fillStyle = p.color + alpha;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2); ctx.fill();
      }
    }
    // 升级闪光卡牌边框
    if (this._upgradeFlash) {
      var elapsed = Date.now() - this._upgradeFlash.time;
      if (elapsed > 500) { this._upgradeFlash = null; }
    }
  }

  _drawLobbyTabs(ctx, sw, sh, activeIdx) {
    const tabH = 70, tabY = sh - Config.SAFE_BOTTOM - tabH, tabW = sw / 3;
    const labels = ['关卡', '飞机', '武器'];
    const tabIcons = ['tab_chapter', 'tab_upgrade', 'tab_weapon'];
    const tabColors = ['#FFB830', '#00DDFF', '#FF3366'];
    ctx.fillStyle = 'rgba(10, 10, 30, 0.95)'; ctx.fillRect(0, tabY, sw, tabH + Config.SAFE_BOTTOM);
    ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, tabY); ctx.lineTo(sw, tabY); ctx.stroke();
    const IL = getIconLoader();
    for (let i = 0; i < 3; i++) {
      const tx = tabW * i, tcx = tx + tabW / 2;
      if (i === activeIdx) { ctx.fillStyle = tabColors[i]; ctx.fillRect(tx, tabY, tabW, 3); }
      IL.drawIcon(ctx, tabIcons[i], tcx, tabY + 24, 36);
      ctx.fillStyle = i === activeIdx ? tabColors[i] : 'rgba(255,255,255,0.3)';
      ctx.font = i === activeIdx ? 'bold 12px monospace' : '12px monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText(labels[i], tcx, tabY + 46);
      if (i < 2) { ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.beginPath(); ctx.moveTo(tx + tabW, tabY + 10); ctx.lineTo(tx + tabW, tabY + tabH - 10); ctx.stroke(); }
    }
    this._chapterTabAreas = { battle: { x: 0, y: tabY, w: tabW, h: tabH }, upgrade: { x: tabW, y: tabY, w: tabW, h: tabH }, weapon: { x: tabW * 2, y: tabY, w: tabW, h: tabH } };
  }

  // ===== 点击判定 =====
  getChapterSelectHit(tap) {
    if (this._chapterTabAreas) {
      const u = this._chapterTabAreas.upgrade; if (u && tap.x >= u.x && tap.x <= u.x + u.w && tap.y >= u.y && tap.y <= u.y + u.h) return 'upgrade';
      const w = this._chapterTabAreas.weapon; if (w && tap.x >= w.x && tap.x <= w.x + w.w && tap.y >= w.y && tap.y <= w.y + w.h) return 'weapon';
    }
    if (this._chapterHitAreas) { for (let i = 0; i < this._chapterHitAreas.length; i++) { const a = this._chapterHitAreas[i]; if (tap.x >= a.x && tap.x <= a.x + a.w && tap.y >= a.y && tap.y <= a.y + a.h) return a.chapter; } }
    return null;
  }

  getUpgradeShopHit(tap) {
    if (this._chapterTabAreas) {
      for (const k in this._chapterTabAreas) { const a = this._chapterTabAreas[k]; if (tap.x >= a.x && tap.x <= a.x + a.w && tap.y >= a.y && tap.y <= a.y + a.h) return { action: 'tab', tab: k }; }
    }
    if (this._shopUpgradeAreas) { for (let i = 0; i < this._shopUpgradeAreas.length; i++) { const a = this._shopUpgradeAreas[i]; if (tap.x >= a.x && tap.x <= a.x + a.w && tap.y >= a.y && tap.y <= a.y + a.h) return a.key; } }
    return null;
  }

  getWeaponShopHit(tap) {
    if (this._weaponDetailKey && this._weaponDetailHitAreas) {
      for (const a of this._weaponDetailHitAreas) { if (tap.x >= a.x && tap.x <= a.x + a.w && tap.y >= a.y && tap.y <= a.y + a.h) return a; }
      const pr = this._weaponPopupRect;
      if (pr && tap.x >= pr.x && tap.x <= pr.x + pr.w && tap.y >= pr.y && tap.y <= pr.y + pr.h) return { action: 'noop' };
      return { action: 'close' };
    }
    if (this._chapterTabAreas) { for (const k in this._chapterTabAreas) { const a = this._chapterTabAreas[k]; if (tap.x >= a.x && tap.x <= a.x + a.w && tap.y >= a.y && tap.y <= a.y + a.h) return { action: 'tab', tab: k }; } }
    if (this._weaponHitAreas) { for (const a of this._weaponHitAreas) { if (tap.x >= a.x && tap.x <= a.x + a.w && tap.y >= a.y && tap.y <= a.y + a.h) return { action: 'detail', key: a.key }; } }
    return null;
  }

  getChapterClearHit(tap) {
    if (this._clearNextArea) { const a = this._clearNextArea; if (tap.x >= a.x && tap.x <= a.x + a.w && tap.y >= a.y && tap.y <= a.y + a.h) return 'next'; }
    if (this._clearBackArea) { const a = this._clearBackArea; if (tap.x >= a.x && tap.x <= a.x + a.w && tap.y >= a.y && tap.y <= a.y + a.h) return 'back'; }
    return null;
  }
}

module.exports = ChapterRenderer;