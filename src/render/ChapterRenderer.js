/**
 * ChapterRenderer.js - 章节选择 + 升级商店 + 武器商店
 * 保持为 class，因为需要存储 hitAreas 等交互状态
 */
const Config = require('../Config');
const { getIconLoader } = require('./IconLoader');

class ChapterRenderer {
  constructor() {
    this._chapterScrollY = 0;
    this._chapterHitAreas = [];
    this._chapterContentH = 0;
    this._chapterViewH = 0;
    this._chapterTabAreas = null;
    this._shopUpgradeAreas = [];
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
      ctx.drawImage(bgImg, 0, 0, sw, sh);
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
    const WEAPON_TREES = require('../config/WeaponDefs');
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
  drawUpgradeShop(ctx, saveManager) {
    const sw = Config.SCREEN_WIDTH, sh = Config.SCREEN_HEIGHT, top = Config.SAFE_TOP;
    ctx.fillStyle = 'rgba(5,3,20,1)'; ctx.fillRect(0, 0, sw, sh);
    if (this._upgradeBg) { ctx.drawImage(this._upgradeBg, 0, 0, sw, sh); ctx.fillStyle = 'rgba(5,3,20,0.55)'; ctx.fillRect(0, 0, sw, sh); }

    // 顶部信息栏
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(0, 0, sw, top + 32);
    const IL1 = getIconLoader();
    IL1.drawIcon(ctx, 'ui_coin', 20, top + 13, 16);
    ctx.fillStyle = Config.NEON_YELLOW; ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText('' + saveManager.getCoins(), 30, top + 6);
    ctx.fillStyle = Config.NEON_CYAN; ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center'; ctx.fillText('飞机改造', sw / 2, top + 6);

    const margin = 12, contentW = sw - margin * 2;
    const upgrades = [
      { key:'attack', name:'弹药强化', desc:'子弹伤害+1', iconKey:'upgrade_attack', color:'#FF6644' },
      { key:'fireRate', name:'引擎改造', desc:'射击间隔-2%', iconKey:'upgrade_fireRate', color:'#44BBFF' },
      { key:'crit', name:'瞄准系统', desc:'暴击率+1%', iconKey:'upgrade_crit', color:'#FFAA00' },
      { key:'startLevel', name:'科技预载', desc:'开局自带等级', iconKey:'upgrade_startLevel', color:'#AA66FF' },
      { key:'coinBonus', name:'回收模块', desc:'金币收益+5%', iconKey:'upgrade_coinBonus', color:'#44FF88' },
    ];
    const itemH = 96, itemGap = 8, startY = top + 38;
    this._shopUpgradeAreas = [];
    const SaveManagerClass = require('../systems/SaveManager');

    for (let i = 0; i < upgrades.length; i++) {
      const u = upgrades[i], y = startY + i * (itemH + itemGap);
      const lv = saveManager.getUpgrade(u.key), maxLvl = SaveManagerClass.UPGRADE_CONFIG[u.key] ? SaveManagerClass.UPGRADE_CONFIG[u.key].maxLevel : 1;
      const maxed = saveManager.isUpgradeMaxed(u.key), cost = saveManager.getUpgradeCost(u.key), canAfford = saveManager.getCoins() >= cost;

      // 卡片背景（半透明毛玻璃感）
      ctx.fillStyle = 'rgba(12,8,35,0.85)';
      ctx.beginPath(); ctx.roundRect(margin, y, contentW, itemH, 14); ctx.fill();
      // 左侧彩色条
      ctx.fillStyle = u.color + '88';
      ctx.beginPath(); ctx.roundRect(margin, y, 4, itemH, [14, 0, 0, 14]); ctx.fill();
      // 边框
      ctx.strokeStyle = u.color + '22'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect(margin, y, contentW, itemH, 14); ctx.stroke();

      // 图标
      const iconCx = margin + 36, iconCy = y + 38;
      ctx.fillStyle = u.color + '18';
      ctx.beginPath(); ctx.arc(iconCx, iconCy, 22, 0, Math.PI * 2); ctx.fill();
      const IL = getIconLoader();
      IL.drawIcon(ctx, u.iconKey, iconCx, iconCy, 36);

      // 名称
      const textX = margin + 66;
      ctx.fillStyle = '#FFFFFF'; ctx.font = 'bold 18px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText(u.name, textX, y + 10);

      // 描述
      ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.font = '14px monospace';
      ctx.fillText(u.desc, textX, y + 34);

      // 进度条
      const barX = textX, barY2 = y + 56, barW = contentW - 66 - margin - 84, barH = 6;
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.beginPath(); ctx.roundRect(barX, barY2, barW, barH, 3); ctx.fill();
      const fillW = barW * (lv / maxLvl);
      if (fillW > 0) {
        ctx.fillStyle = u.color + 'CC';
        ctx.beginPath(); ctx.roundRect(barX, barY2, Math.max(fillW, 6), barH, 3); ctx.fill();
      }
      // 等级文字（进度条下方）
      ctx.fillStyle = u.color; ctx.font = 'bold 12px monospace';
      ctx.fillText('Lv.' + lv + ' / ' + maxLvl, barX, y + 66);

      // 升级按钮
      const btnW = 76, btnH2 = 44, btnX = sw - margin - btnW - 8, btnY = y + (itemH - btnH2) / 2;
      if (maxed) {
        ctx.fillStyle = 'rgba(80,255,80,0.1)';
        ctx.beginPath(); ctx.roundRect(btnX, btnY, btnW, btnH2, 10); ctx.fill();
        ctx.strokeStyle = Config.NEON_GREEN + '44'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.roundRect(btnX, btnY, btnW, btnH2, 10); ctx.stroke();
        ctx.fillStyle = Config.NEON_GREEN; ctx.font = 'bold 16px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('MAX', btnX + btnW / 2, btnY + btnH2 / 2);
      } else {
        ctx.fillStyle = canAfford ? 'rgba(0,200,255,0.12)' : 'rgba(60,60,60,0.08)';
        ctx.beginPath(); ctx.roundRect(btnX, btnY, btnW, btnH2, 10); ctx.fill();
        ctx.strokeStyle = canAfford ? Config.NEON_CYAN + '66' : 'rgba(100,100,100,0.15)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.roundRect(btnX, btnY, btnW, btnH2, 10); ctx.stroke();
        ctx.fillStyle = canAfford ? Config.NEON_YELLOW : 'rgba(150,150,150,0.35)';
        ctx.font = 'bold 14px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const bcx = btnX + btnW / 2, bcy = btnY + btnH2 / 2;
        getIconLoader().drawIcon(ctx, 'ui_coin', bcx - ctx.measureText('' + cost).width / 2 - 9, bcy, 13);
        ctx.fillText(' ' + cost, bcx + 2, bcy);
        this._shopUpgradeAreas.push({ key: u.key, x: btnX, y: btnY, w: btnW, h: btnH2 });
      }
    }
    this._drawLobbyTabs(ctx, sw, sh, 1);
  }

  // ===== 武器商店 =====
  drawWeaponShop(ctx, saveManager) {
    const sw = Config.SCREEN_WIDTH, sh = Config.SCREEN_HEIGHT, top = Config.SAFE_TOP;
    const WEAPON_TREES = require('../config/WeaponDefs');
    const SHIP_TREE = require('../config/ShipDefs');
    const SaveManagerClass = require('../systems/SaveManager');
    this._weaponHitAreas = [];
    ctx.fillStyle = 'rgba(0,0,0,0.95)'; ctx.fillRect(0, 0, sw, sh);
    if (this._weaponBg) { ctx.drawImage(this._weaponBg, 0, 0, sw, sh); ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, sw, sh); }

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

    if (this._weaponDetailKey) { this._drawWeaponDetail(ctx, sw, sh, top, saveManager, this._weaponDetailKey); this._drawLobbyTabs(ctx, sw, sh, 2); return; }

    // 武器解锁对应关卡（飞机和光能迫击炮/闪电链初始解锁）
    const weaponUnlockMap = { ship:1, kunai:1, lightning:1, missile:3, meteor:6, drone:10, spinBlade:15, blizzard:25, ionBeam:40, frostStorm:55 };
    const maxChapter = saveManager.getMaxChapter();

    // 构建武器列表（飞机 + 8武器）
    const allItems = [{ key: 'ship', iconKey: 'tab_upgrade', name: '战斗飞机', color: '#00DDFF', isShip: true }];
    const weaponKeys = Object.keys(WEAPON_TREES);
    for (let i = 0; i < weaponKeys.length; i++) {
      const wk = weaponKeys[i], wDef = WEAPON_TREES[wk];
      allItems.push({ key: wk, iconKey: 'weapon_' + wk, name: wDef.name, color: wDef.color, isShip: false });
    }

    // 卡牌网格：3列
    const margin = 10, gap = 8, cols = 3;
    const cardW = (sw - margin * 2 - gap * (cols - 1)) / cols;
    const cardH = cardW * 1.3;
    const startY = top + 36;

    for (let i = 0; i < allItems.length; i++) {
      const item = allItems[i], wk = item.key;
      const col = i % cols, row = Math.floor(i / cols);
      const cx = margin + col * (cardW + gap);
      const cy = startY + row * (cardH + gap);
      if (cy + cardH < 0 || cy > sh) continue;

      const unlockAt = weaponUnlockMap[wk] || 1;
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
        // 进度条
        const barX = cx + 8, barY = cy + cardH * 0.80, barW = cardW - 16, barH = 4;
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.beginPath(); ctx.roundRect(barX, barY, barW, barH, 2); ctx.fill();
        if (ratio > 0) {
          ctx.fillStyle = item.color + 'BB';
          ctx.beginPath(); ctx.roundRect(barX, barY, Math.max(barW * ratio, 4), barH, 2); ctx.fill();
        }
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

    this._drawLobbyTabs(ctx, sw, sh, 2);
  }

  _drawWeaponDetail(ctx, sw, sh, top, saveManager, weaponKey) {
    const WEAPON_TREES = require('../config/WeaponDefs'), SaveManagerClass = require('../systems/SaveManager');
    const SHIP_TREE = require('../config/ShipDefs');
    // 飞机视为特殊武器
    const isShip = weaponKey === 'ship';
    const wDef = isShip
      ? { name: '战斗飞机', desc: '你的主力战机，发射子弹消灭砖块', color: '#00DDFF', basePct: 1.0, interval: 400, branches: SHIP_TREE }
      : WEAPON_TREES[weaponKey];
    if (!wDef) return;
    const lv = saveManager.getWeaponLevel(weaponKey), maxLv = saveManager.getWeaponMaxLevel();
    const cost = saveManager.getWeaponUpgradeCost(weaponKey), canAfford = saveManager.getCoins() >= cost.coins, maxed = saveManager.isWeaponMaxed(weaponKey);
    this._weaponDetailHitAreas = [];
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, sw, sh);
    const popW = sw - 40, popH = sh * 0.75, popX = 20, popY = (sh - popH) / 2, cx = sw / 2, pad = 16, innerX = popX + pad, innerW = popW - pad * 2;
    ctx.fillStyle = 'rgba(15,10,40,0.97)'; ctx.beginPath(); ctx.roundRect(popX, popY, popW, popH, 16); ctx.fill();
    ctx.strokeStyle = wDef.color + '66'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(popX, popY, popW, popH, 16); ctx.stroke();
    this._weaponPopupRect = { x: popX, y: popY, w: popW, h: popH };

    // 关闭按钮
    const closeS = 34, closeX = popX + popW - closeS - 8, closeY2 = popY + 8;
    ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.beginPath(); ctx.roundRect(closeX, closeY2, closeS, closeS, 8); ctx.fill();
    ctx.fillStyle = '#FFFFFF'; ctx.font = 'bold 18px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('X', closeX + closeS / 2, closeY2 + closeS / 2);
    this._weaponDetailHitAreas.push({ action: 'close', x: closeX, y: closeY2, w: closeS, h: closeS });

    // 顶部：图标+名称+等级
    let cy = popY + 18;
    const IL = getIconLoader();
    const detailIconKey = isShip ? 'tab_upgrade' : ('weapon_' + weaponKey);
    IL.drawIcon(ctx, detailIconKey, innerX + 18, cy + 18, 34);
    ctx.fillStyle = '#FFFFFF'; ctx.font = 'bold 18px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(wDef.name, innerX + 44, cy + 2);
    ctx.fillStyle = wDef.color; ctx.font = 'bold 16px monospace'; ctx.fillText(lv + '级', innerX + 44, cy + 24); cy += 50;
    ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.font = '13px monospace'; ctx.fillText(wDef.desc, innerX, cy); cy += 26;

    // ===== 双Tab =====
    const tabW = innerW / 2, tabH = 32, tabY = cy;
    const tabs = ['属性', '技能树'];
    for (let i = 0; i < 2; i++) {
      const tx = innerX + i * tabW, active = this._weaponDetailTab === i;
      ctx.fillStyle = active ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0)';
      ctx.beginPath(); ctx.roundRect(tx, tabY, tabW, tabH, [8, 8, 0, 0]); ctx.fill();
      if (active) { ctx.fillStyle = wDef.color; ctx.fillRect(tx + 4, tabY + tabH - 2, tabW - 8, 2); }
      ctx.fillStyle = active ? '#FFFFFF' : 'rgba(255,255,255,0.4)';
      ctx.font = active ? 'bold 13px monospace' : '13px monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(tabs[i], tx + tabW / 2, tabY + tabH / 2);
      this._weaponDetailHitAreas.push({ action: 'tab', tabIdx: i, x: tx, y: tabY, w: tabW, h: tabH });
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(innerX, tabY + tabH); ctx.lineTo(innerX + innerW, tabY + tabH); ctx.stroke();
    cy = tabY + tabH + 10;

    const upgradeAreaH = 90, contentBottom = popY + popH - upgradeAreaH - 8;

    if (this._weaponDetailTab === 0) {
      // ===== 属性Tab =====
      // 武器伤害类型映射
      const WEAPON_DMG_TYPES = {
        ship:      [{ type: 'physical', label: '物理' }],
        kunai:     [{ type: 'physical', label: '物理' }, { type: 'fire', label: '火焰' }],
        lightning: [{ type: 'energy', label: '能量' }],
        missile:   [{ type: 'physical', label: '物理' }, { type: 'fire', label: '火焰' }],
        meteor:    [{ type: 'fire', label: '火焰' }],
        drone:     [{ type: 'energy', label: '能量' }],
        spinBlade: [{ type: 'physical', label: '物理' }],
        blizzard:  [{ type: 'fire', label: '火焰' }],
        ionBeam:   [{ type: 'energy', label: '能量' }],
      };
      const DMG_COLORS = { physical: '#FFFFFF', fire: '#FF4400', ice: '#44DDFF', energy: '#FFF050' };

      const interval = (wDef.interval / 1000).toFixed(1);
      ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.beginPath(); ctx.roundRect(innerX, cy, innerW, 98, 8); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(innerX, cy, innerW, 98, 8); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = 'bold 14px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText('▪ 技能属性', innerX + 10, cy + 8);
      const aY = cy + 32, labelX = innerX + 14, valRight = innerX + innerW - 14;
      ctx.font = '14px monospace';
      ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.textAlign = 'left'; ctx.fillText('伤害系数', labelX, aY);
      ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'right'; ctx.fillText((wDef.basePct * 100).toFixed(0) + '%', valRight, aY);
      ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.textAlign = 'left'; ctx.fillText('冷却时间', labelX, aY + 22);
      ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'right'; ctx.fillText(interval + 's', valRight, aY + 22);
      // 伤害类型
      ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.textAlign = 'left'; ctx.font = '14px monospace'; ctx.fillText('伤害类型', labelX, aY + 44);
      const dmgTypes = WEAPON_DMG_TYPES[weaponKey] || [{ type: 'physical', label: '物理' }];
      let tagX = valRight;
      for (let di = dmgTypes.length - 1; di >= 0; di--) {
        const dt = dmgTypes[di];
        const tagLabel = dt.label;
        const tagColor = DMG_COLORS[dt.type] || '#FFFFFF';
        ctx.font = 'bold 12px monospace';
        const tw = ctx.measureText(tagLabel).width + 16;
        ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.beginPath(); ctx.roundRect(tagX - tw, aY + 42, tw, 20, 4); ctx.fill();
        ctx.strokeStyle = tagColor; ctx.globalAlpha = 0.5; ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(tagX - tw, aY + 42, tw, 20, 4); ctx.stroke(); ctx.globalAlpha = 1;
        ctx.fillStyle = tagColor; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(tagLabel, tagX - tw / 2, aY + 52);
        tagX -= tw + 6;
      }
      cy += 106;

      // 升级解锁列表
      ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = 'bold 14px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText('▪ 升级效果', innerX + 4, cy); cy += 24;
      const unlocks = SaveManagerClass.getWeaponUnlocks(weaponKey);
      for (let i = 0; i < unlocks.length; i++) {
        const u = unlocks[i], unlocked = lv >= u.level, cardH = 52;
        if (cy + cardH > contentBottom) break;
        ctx.fillStyle = unlocked ? 'rgba(0,255,100,0.06)' : 'rgba(255,255,255,0.03)'; ctx.beginPath(); ctx.roundRect(innerX, cy, innerW, cardH, 8); ctx.fill();
        ctx.strokeStyle = unlocked ? 'rgba(0,255,100,0.15)' : 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(innerX, cy, innerW, cardH, 8); ctx.stroke();
        const tagW2 = 42, tagH2 = 26, tagX2 = innerX + 8, tagY2 = cy + (cardH - tagH2) / 2;
        ctx.fillStyle = unlocked ? 'rgba(0,255,100,0.15)' : 'rgba(255,255,255,0.06)'; ctx.beginPath(); ctx.roundRect(tagX2, tagY2, tagW2, tagH2, 6); ctx.fill();
        ctx.fillStyle = unlocked ? Config.NEON_GREEN : 'rgba(255,255,255,0.35)'; ctx.font = 'bold 14px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(u.level + '级', tagX2 + tagW2 / 2, tagY2 + tagH2 / 2);
        ctx.fillStyle = unlocked ? '#FFFFFF' : 'rgba(255,255,255,0.5)'; ctx.font = 'bold 13px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        ctx.fillText('解锁 ' + u.branchName, innerX + 58, cy + 8);
        ctx.fillStyle = unlocked ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.3)'; ctx.font = '12px monospace'; ctx.fillText(u.desc, innerX + 58, cy + 28);
        if (unlocked) { ctx.fillStyle = Config.NEON_GREEN; ctx.font = 'bold 14px monospace'; ctx.textAlign = 'right'; ctx.fillText('✓', innerX + innerW - 10, cy + cardH / 2 - 7); }
        cy += cardH + 6;
      }
    } else {
      // ===== 技能树Tab（可滚动） =====
      const unlocks = SaveManagerClass.getWeaponUnlocks(weaponKey);
      const gatedBranches = {};
      for (const u of unlocks) gatedBranches[u.branchKey] = u.level;

      const branches = Object.keys(wDef.branches);
      const cardH = 58, cardGap = 5;
      const totalH = branches.length * (cardH + cardGap);
      const viewH = contentBottom - cy;
      const maxScroll = Math.max(0, totalH - viewH);

      // 限制滚动范围
      if (this._skillTreeScrollY > maxScroll) this._skillTreeScrollY = maxScroll;
      if (this._skillTreeScrollY < 0) this._skillTreeScrollY = 0;

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
        ctx.font = 'bold 13px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        ctx.fillText(bDef.name, innerX + 10, drawY + 8);

        // 等级上限标签
        ctx.fillStyle = shopLocked ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.5)';
        ctx.font = '12px monospace'; ctx.textAlign = 'right';
        ctx.fillText('上限 ' + bDef.max + '级', innerX + innerW - 10, drawY + 9);

        // 描述
        ctx.fillStyle = shopLocked ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.6)';
        ctx.font = '12px monospace'; ctx.textAlign = 'left';
        ctx.fillText(bDef.desc, innerX + 10, drawY + 26);

        // 状态标签
        if (shopLocked) {
          ctx.fillStyle = '#FF5555'; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'left';
          ctx.fillText(shopGate + '级解锁', innerX + 10, drawY + 42);
        } else if (reqText) {
          ctx.fillStyle = 'rgba(200,150,255,0.6)'; ctx.font = '11px monospace'; ctx.textAlign = 'left';
          ctx.fillText(reqText, innerX + 10, drawY + 42);
        } else {
          ctx.fillStyle = 'rgba(0,200,255,0.5)'; ctx.font = '11px monospace'; ctx.textAlign = 'left';
          ctx.fillText('- 基础方向（初始可用）', innerX + 10, drawY + 42);
        }

        drawY += cardH + cardGap;
      }

      ctx.restore(); // 恢复裁剪

      // 滚动条指示器
      if (maxScroll > 0) {
        const barH = Math.max(20, viewH * (viewH / totalH));
        const barY = cy + (scrollOffset / maxScroll) * (viewH - barH);
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.beginPath(); ctx.roundRect(innerX + innerW - 3, barY, 3, barH, 2); ctx.fill();
      }
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
      ctx.fillStyle = Config.NEON_ORANGE; ctx.font = '12px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText('升级奖励：暴击伤害+2.0%', cx, btnY2 + btnH2 + 4);
    }
  }

  // ===== 底部3Tab =====
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
      // 图标
      IL.drawIcon(ctx, tabIcons[i], tcx, tabY + 24, 36);
      // 文字
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