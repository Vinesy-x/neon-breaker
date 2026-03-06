/**
 * GachaUI.js - 抽奖界面 Canvas UI
 * 赛博朋克风格，深色背景 + 霓虹色 + 圆角卡片
 * 
 * 主界面：顶部货币+tab → 中间池信息(概率条+保底) → 底部按钮
 * 结果展示：单抽大卡 / 十连网格 + 确认按钮
 * 动画：旋转光圈 → 卡片弹入
 */

const Config = require('../Config');
const ChipConfig = require('../config/ChipConfig');
const GachaConfig = require('../config/GachaConfig');

// 品质颜色（UI展示用，比ChipConfig更鲜艳）
const Q_COLORS = {
  white:  '#AAAAAA',
  green:  '#44FF88',
  blue:   '#4488FF',
  purple: '#BB66FF',
  orange: '#FF8800',
  red:    '#FF2244',
};

// 品质中文名
const Q_NAMES = {
  white: '普通', green: '精良', blue: '稀有',
  purple: '史诗', orange: '传说', red: '至尊',
};

// 品质排序（条形图从左到右）
const Q_ORDER = ['white', 'green', 'blue', 'purple', 'orange', 'red'];

class GachaUI {
  constructor() {
    this._tab = 'normal';      // 'normal' | 'premium'
    this._showResult = false;   // 是否显示抽奖结果
    this._results = [];         // 本次抽到的芯片
    this._animPhase = 0;        // 0=无 1=旋转光圈 2=白闪 3=展示结果
    this._animTimer = 0;        // 动画开始时间戳
    this._areas = [];           // 点击区域 [{x,y,w,h,action}]
  }

  // ============================================================
  // 外部调用：设置抽奖结果并启动动画
  // ============================================================
  showResults(chips) {
    this._results = chips || [];
    this._showResult = true;
    this._animPhase = 1;
    this._animTimer = Date.now();
  }

  // ============================================================
  // 主绘制入口
  // ============================================================
  draw(ctx, saveManager) {
    var sw = Config.SCREEN_WIDTH;
    var sh = Config.SCREEN_HEIGHT;
    this._areas = [];

    // 深色背景
    ctx.fillStyle = '#050318';
    ctx.fillRect(0, 0, sw, sh);

    // 背景网格装饰（赛博朋克风）
    ctx.strokeStyle = 'rgba(0,255,255,0.03)';
    ctx.lineWidth = 1;
    for (var i = 0; i < sw; i += 40) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, sh); ctx.stroke();
    }
    for (var j = 0; j < sh; j += 40) {
      ctx.beginPath(); ctx.moveTo(0, j); ctx.lineTo(sw, j); ctx.stroke();
    }

    // 动画覆盖层（动画期间不画其他UI）
    if (this._animPhase === 1 || this._animPhase === 2) {
      this._drawAnimation(ctx);
      return;
    }

    // 结果展示
    if (this._showResult && this._animPhase === 3) {
      this._drawResult(ctx);
      return;
    }

    // === 正常界面 ===
    this._drawHeader(ctx, saveManager);
    this._drawPool(ctx, saveManager);
    this._drawButtons(ctx, saveManager);
    this._drawBackButton(ctx);
  }

  // ============================================================
  // 顶部：货币显示 + Tab切换（军火商/黑市）
  // ============================================================
  _drawHeader(ctx, saveManager) {
    var sw = Config.SCREEN_WIDTH;
    var top = Config.SAFE_TOP;

    // 顶部栏背景
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, sw, top + 50);

    // 金币
    ctx.font = 'bold 14px sans-serif';
    ctx.fillStyle = '#FFD700';
    ctx.textAlign = 'left';
    ctx.fillText('💰 ' + (saveManager.getCoins ? saveManager.getCoins() : 0), 16, top + 20);

    // 钻石
    ctx.fillStyle = '#88DDFF';
    ctx.fillText('💎 ' + (saveManager.getDiamonds ? saveManager.getDiamonds() : 0), 16, top + 40);

    // Tab 按钮
    var tabY = top + 58;
    var tabW = sw / 2 - 16;
    var tabH = 36;

    // 军火商 tab
    var normActive = this._tab === 'normal';
    ctx.fillStyle = normActive ? 'rgba(0,255,255,0.15)' : 'rgba(255,255,255,0.05)';
    ctx.beginPath(); ctx.roundRect(8, tabY, tabW, tabH, 8); ctx.fill();
    ctx.strokeStyle = normActive ? '#00FFFF' : 'rgba(255,255,255,0.15)';
    ctx.lineWidth = normActive ? 2 : 1;
    ctx.beginPath(); ctx.roundRect(8, tabY, tabW, tabH, 8); ctx.stroke();
    ctx.fillStyle = normActive ? '#00FFFF' : '#888';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🔫 军火商', 8 + tabW / 2, tabY + 24);
    this._areas.push({ x: 8, y: tabY, w: tabW, h: tabH, action: 'tab_normal' });

    // 黑市 tab
    var premActive = this._tab === 'premium';
    var tx2 = sw / 2 + 8;
    ctx.fillStyle = premActive ? 'rgba(255,20,255,0.15)' : 'rgba(255,255,255,0.05)';
    ctx.beginPath(); ctx.roundRect(tx2, tabY, tabW, tabH, 8); ctx.fill();
    ctx.strokeStyle = premActive ? '#FF14FF' : 'rgba(255,255,255,0.15)';
    ctx.lineWidth = premActive ? 2 : 1;
    ctx.beginPath(); ctx.roundRect(tx2, tabY, tabW, tabH, 8); ctx.stroke();
    ctx.fillStyle = premActive ? '#FF14FF' : '#888';
    ctx.fillText('🌑 黑市', tx2 + tabW / 2, tabY + 24);
    this._areas.push({ x: tx2, y: tabY, w: tabW, h: tabH, action: 'tab_premium' });
  }

  // ============================================================
  // 中间：抽奖池信息（池名 + 概率条形图 + 保底进度）
  // ============================================================
  _drawPool(ctx, saveManager) {
    var sw = Config.SCREEN_WIDTH;
    var top = Config.SAFE_TOP + 105;
    var pool = this._tab === 'normal' ? GachaConfig.normal : GachaConfig.premium;
    var accent = this._tab === 'normal' ? '#00FFFF' : '#FF14FF';

    // 池名称
    ctx.font = 'bold 18px sans-serif';
    ctx.fillStyle = accent;
    ctx.textAlign = 'center';
    var poolName = this._tab === 'normal' ? '⚡ 军火商标准池' : '🌀 黑市暗巷池';
    ctx.fillText(poolName, sw / 2, top + 20);

    // 描述
    ctx.font = '12px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    var desc = this._tab === 'normal'
      ? '使用金币抽取芯片，每日免费1次'
      : '使用钻石抽取芯片，高品质概率UP + 保底';
    ctx.fillText(desc, sw / 2, top + 42);

    // === 概率条形图 ===
    var barX = 20, barY = top + 58, barW = sw - 40, barH = 24;

    // 条形图背景
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath(); ctx.roundRect(barX, barY, barW, barH, 4); ctx.fill();

    // 各品质色块按概率占比着色
    var cx = barX;
    for (var qi = 0; qi < Q_ORDER.length; qi++) {
      var q = Q_ORDER[qi];
      var rate = pool.rates[q] || 0;
      if (rate <= 0) continue;
      var w = barW * rate;
      ctx.fillStyle = Q_COLORS[q];
      ctx.globalAlpha = 0.8;
      ctx.fillRect(cx, barY, w, barH);
      ctx.globalAlpha = 1;

      // 百分比文字（宽度够才显示）
      if (w > 28) {
        ctx.font = 'bold 10px sans-serif';
        ctx.fillStyle = '#000';
        ctx.textAlign = 'center';
        ctx.fillText((rate * 100).toFixed(1) + '%', cx + w / 2, barY + 16);
      }
      cx += w;
    }

    // 条形图边框
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(barX, barY, barW, barH, 4); ctx.stroke();

    // 图例（品质色块 + 名称）
    var legendY = barY + barH + 14;
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'left';
    var lx = barX;
    for (var li = 0; li < Q_ORDER.length; li++) {
      var lq = Q_ORDER[li];
      var lr = pool.rates[lq] || 0;
      if (lr <= 0) continue;
      ctx.fillStyle = Q_COLORS[lq];
      ctx.fillRect(lx, legendY - 8, 8, 8);
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      var label = Q_NAMES[lq];
      ctx.fillText(label, lx + 11, legendY);
      lx += ctx.measureText(label).width + 20;
    }

    // === 保底进度（仅高级池） ===
    if (this._tab === 'premium') {
      var pityY = legendY + 24;
      var pity = GachaConfig.premium.pity;
      // 从 saveManager 获取保底计数
      var pityOrange = (saveManager._data && saveManager._data.gachaPityOrange) || 0;
      var pityRed = (saveManager._data && saveManager._data.gachaPityRed) || 0;

      this._drawPityBar(ctx, barX, pityY, barW, '🟠 橙色保底', pityOrange, pity.orange, '#FF8800');
      this._drawPityBar(ctx, barX, pityY + 32, barW, '🔴 至尊保底', pityRed, pity.red, '#FF2244');
    }
  }

  /**
   * 绘制保底进度条
   * @param {string} label - 标签文字
   * @param {number} current - 当前计数
   * @param {number} max - 保底上限
   * @param {string} color - 进度条颜色
   */
  _drawPityBar(ctx, x, y, w, label, current, max, color) {
    var progress = Math.min(current / max, 1);

    ctx.font = '12px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.textAlign = 'left';
    ctx.fillText(label + '：' + current + '/' + max, x, y + 12);

    // 进度条背景
    var pbY = y + 18, pbH = 8;
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath(); ctx.roundRect(x, pbY, w, pbH, 4); ctx.fill();

    // 进度条前景
    if (progress > 0) {
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.8;
      ctx.beginPath(); ctx.roundRect(x, pbY, w * progress, pbH, 4); ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  // ============================================================
  // 底部：抽奖按钮
  // ============================================================
  _drawButtons(ctx, saveManager) {
    var sw = Config.SCREEN_WIDTH;
    var sh = Config.SCREEN_HEIGHT;
    var btnY = sh - Config.SAFE_BOTTOM - 130;
    var pool = this._tab === 'normal' ? GachaConfig.normal : GachaConfig.premium;
    var accent = this._tab === 'normal' ? '#00FFFF' : '#FF14FF';

    var coins = saveManager.getCoins ? saveManager.getCoins() : 0;
    var diamonds = saveManager.getDiamonds ? saveManager.getDiamonds() : 0;

    // 检查每日免费（仅普通池）
    var hasFree = this._tab === 'normal' && pool.freeDaily &&
      !(saveManager._data && saveManager._data.lastFreeGachaDate === this._todayStr());

    // --- 单抽按钮 ---
    var btn1W = (sw - 48) / 2;
    var btn1H = 56;
    var btn1X = 16;

    var singleLabel, singleCost, canSingle;
    if (this._tab === 'normal') {
      if (hasFree) {
        singleLabel = '免费单抽';
        singleCost = '';
        canSingle = true;
      } else {
        singleLabel = '单抽';
        singleCost = '💰' + pool.cost;
        canSingle = coins >= pool.cost;
      }
    } else {
      singleLabel = '单抽';
      singleCost = '💎' + pool.cost;
      canSingle = diamonds >= pool.cost;
    }

    this._drawButton(ctx, btn1X, btnY, btn1W, btn1H, singleLabel, singleCost, accent, canSingle);
    this._areas.push({
      x: btn1X, y: btnY, w: btn1W, h: btn1H,
      action: canSingle ? { action: 'draw', type: this._tab, count: 1 } : null,
    });

    // --- 十连按钮 ---
    var btn2X = btn1X + btn1W + 16;
    var tenCost = pool.costTen;
    var tenCostLabel = this._tab === 'normal' ? '💰' + tenCost : '💎' + tenCost;
    var canTen = this._tab === 'normal' ? coins >= tenCost : diamonds >= tenCost;

    this._drawButton(ctx, btn2X, btnY, btn1W, btn1H, '十连抽', tenCostLabel, accent, canTen);
    this._areas.push({
      x: btn2X, y: btnY, w: btn1W, h: btn1H,
      action: canTen ? { action: 'draw', type: this._tab, count: 10 } : null,
    });
  }

  /**
   * 绘制单个按钮（带霓虹发光效果）
   */
  _drawButton(ctx, x, y, w, h, label, costText, accent, enabled) {
    // 背景
    ctx.fillStyle = enabled ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)';
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 10); ctx.fill();

    // 边框（激活时霓虹发光）
    if (enabled) {
      ctx.shadowColor = accent;
      ctx.shadowBlur = 8;
    }
    ctx.strokeStyle = enabled ? accent : 'rgba(255,255,255,0.15)';
    ctx.lineWidth = enabled ? 2 : 1;
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 10); ctx.stroke();
    ctx.shadowBlur = 0;

    // 文字
    ctx.textAlign = 'center';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillStyle = enabled ? '#FFF' : '#555';
    ctx.fillText(label, x + w / 2, y + (costText ? 24 : 34));

    if (costText) {
      ctx.font = '12px sans-serif';
      ctx.fillStyle = enabled ? 'rgba(255,255,255,0.7)' : '#444';
      ctx.fillText(costText, x + w / 2, y + 44);
    }
  }

  // ============================================================
  // 返回按钮（右上角）
  // ============================================================
  _drawBackButton(ctx) {
    var top = Config.SAFE_TOP;
    var bx = Config.SCREEN_WIDTH - 70, by = top + 4, bw = 60, bh = 30;

    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 6); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 6); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('返回', bx + bw / 2, by + 20);
    this._areas.push({ x: bx, y: by, w: bw, h: bh, action: 'back' });
  }

  // ============================================================
  // 抽奖结果展示（单抽大卡 / 十连网格）
  // ============================================================
  _drawResult(ctx) {
    var sw = Config.SCREEN_WIDTH;
    var sh = Config.SCREEN_HEIGHT;
    this._areas = [];

    // 半透明遮罩
    ctx.fillStyle = 'rgba(5,3,24,0.92)';
    ctx.fillRect(0, 0, sw, sh);

    var count = this._results.length;
    var elapsed = Date.now() - this._animTimer;

    ctx.save();

    if (count === 1) {
      // === 单抽：大卡片居中，easeOutCubic弹入 ===
      var chip = this._results[0];
      var cardW = 200, cardH = 260;
      var cardX = (sw - cardW) / 2, cardY = (sh - cardH) / 2 - 30;

      var scale = Math.min(1, elapsed / 300);
      var ease = 1 - Math.pow(1 - scale, 3);

      ctx.translate(sw / 2, sh / 2 - 30);
      ctx.scale(ease, ease);
      ctx.translate(-sw / 2, -(sh / 2 - 30));

      this._drawChipCard(ctx, cardX, cardY, cardW, cardH, chip, true);
    } else {
      // === 十连：2行5列网格，逐张弹入 ===
      var cols = 5, gap = 8;
      var cW = (sw - 32 - gap * (cols - 1)) / cols;
      var cH = cW * 1.35;
      var gridW = cols * cW + (cols - 1) * gap;
      var rows = 2;
      var gridH = rows * cH + gap;
      var startX = (sw - gridW) / 2;
      var startY = (sh - gridH) / 2 - 40;

      for (var i = 0; i < count && i < 10; i++) {
        var col = i % cols, row = Math.floor(i / cols);
        var cx = startX + col * (cW + gap);
        var cy = startY + row * (cH + gap);

        // 每张卡片有50ms延迟的弹入动画
        var delay = i * 50;
        var cardElapsed = Math.max(0, elapsed - delay);
        var cardScale = Math.min(1, cardElapsed / 250);
        var cardEase = 1 - Math.pow(1 - cardScale, 3);

        ctx.save();
        ctx.translate(cx + cW / 2, cy + cH / 2);
        ctx.scale(cardEase, cardEase);
        ctx.translate(-(cx + cW / 2), -(cy + cH / 2));

        this._drawChipCard(ctx, cx, cy, cW, cH, this._results[i], false);
        ctx.restore();
      }
    }

    ctx.restore();

    // 确认按钮
    var btnW = 160, btnH = 44;
    var btnX = (sw - btnW) / 2, btnY = sh - Config.SAFE_BOTTOM - 80;
    ctx.fillStyle = 'rgba(0,255,255,0.12)';
    ctx.beginPath(); ctx.roundRect(btnX, btnY, btnW, btnH, 10); ctx.fill();
    ctx.strokeStyle = '#00FFFF';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#00FFFF';
    ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.roundRect(btnX, btnY, btnW, btnH, 10); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.font = 'bold 16px sans-serif';
    ctx.fillStyle = '#FFF';
    ctx.textAlign = 'center';
    ctx.fillText('确认', btnX + btnW / 2, btnY + 28);
    this._areas.push({ x: btnX, y: btnY, w: btnW, h: btnH, action: 'confirm' });
  }

  /**
   * 绘制单张芯片卡片
   * @param {boolean} large - true=大卡片模式（单抽），false=小卡片（十连）
   */
  _drawChipCard(ctx, x, y, w, h, chip, large) {
    if (!chip) return;
    var quality = chip.quality || 'white';
    var color = Q_COLORS[quality] || '#AAA';

    // 卡片背景
    ctx.fillStyle = 'rgba(20,15,40,0.9)';
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 8); ctx.fill();

    // 品质色顶部渐变高光
    var grad = ctx.createLinearGradient(x, y, x, y + h * 0.3);
    grad.addColorStop(0, color + '44');
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 8); ctx.fill();

    // 品质光效边框
    ctx.shadowColor = color;
    ctx.shadowBlur = large ? 16 : 6;
    ctx.strokeStyle = color;
    ctx.lineWidth = large ? 2.5 : 1.5;
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 8); ctx.stroke();
    ctx.shadowBlur = 0;

    // 部位信息
    var partName = chip.part && ChipConfig.PARTS[chip.part]
      ? ChipConfig.PARTS[chip.part].name : '未知';
    var partIcon = chip.part && ChipConfig.PARTS[chip.part]
      ? ChipConfig.PARTS[chip.part].icon : '?';

    if (large) {
      // --- 大卡片布局 ---
      ctx.font = 'bold 16px sans-serif';
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.fillText(Q_NAMES[quality] || quality, x + w / 2, y + 30);

      ctx.font = '13px sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillText(partIcon + ' ' + partName, x + w / 2, y + 52);

      if (chip.affix) {
        ctx.font = 'bold 15px sans-serif';
        ctx.fillStyle = '#FFF';
        ctx.fillText(chip.affix.name || chip.affix.id, x + w / 2, y + 100);

        ctx.font = '22px sans-serif';
        ctx.fillStyle = color;
        ctx.fillText(this._formatAffixValue(chip.affix), x + w / 2, y + 140);
      }
    } else {
      // --- 小卡片布局（紧凑） ---
      var fs = Math.max(9, Math.min(11, w / 8));

      ctx.font = 'bold ' + fs + 'px sans-serif';
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.fillText(Q_NAMES[quality] || '', x + w / 2, y + 16);

      ctx.font = (fs - 1) + 'px sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillText(partIcon + partName, x + w / 2, y + 30);

      if (chip.affix) {
        ctx.font = (fs - 1) + 'px sans-serif';
        ctx.fillStyle = '#FFF';
        var name = (chip.affix.name || chip.affix.id || '');
        var displayName = name.length > 5 ? name.slice(0, 5) + '..' : name;
        ctx.fillText(displayName, x + w / 2, y + h * 0.6);

        ctx.font = 'bold ' + fs + 'px sans-serif';
        ctx.fillStyle = color;
        ctx.fillText(this._formatAffixValue(chip.affix), x + w / 2, y + h * 0.8);
      }
    }
  }

  /**
   * 格式化词条数值显示
   */
  _formatAffixValue(affix) {
    if (!affix) return '';
    var val = affix.value != null ? affix.value : 0;
    var fmt = affix.format || '+N';
    if (fmt.indexOf('%') >= 0) {
      return fmt.replace('N', (val * 100).toFixed(1));
    }
    return fmt.replace('N', typeof val === 'number'
      ? (val % 1 ? val.toFixed(2) : String(val)) : String(val));
  }

  // ============================================================
  // 抽奖动画（旋转光圈 → 白闪过渡 → 结果展示）
  // ============================================================
  _drawAnimation(ctx) {
    var sw = Config.SCREEN_WIDTH;
    var sh = Config.SCREEN_HEIGHT;
    var elapsed = Date.now() - this._animTimer;

    // 深色背景
    ctx.fillStyle = 'rgba(5,3,24,0.95)';
    ctx.fillRect(0, 0, sw, sh);

    var cx = sw / 2, cy = sh / 2;

    if (this._animPhase === 1) {
      // === Phase 1: 旋转光圈 (0~500ms) ===
      var t = Math.min(elapsed / 500, 1);
      var angle = t * Math.PI * 4;
      var radius = 60 + t * 20;
      var alpha = 0.3 + t * 0.5;

      // 外圈弧线
      ctx.strokeStyle = this._tab === 'normal' ? '#00FFFF' : '#FF14FF';
      ctx.lineWidth = 3;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, angle, angle + Math.PI * 1.5);
      ctx.stroke();

      // 内圈弧线（反向旋转）
      ctx.strokeStyle = '#FFF';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 0.6, -angle, -angle + Math.PI);
      ctx.stroke();
      ctx.globalAlpha = 1;

      // 中心径向光晕
      var glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 0.4);
      glow.addColorStop(0, 'rgba(255,255,255,0.6)');
      glow.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);

      if (t >= 1) {
        this._animPhase = 2;
        this._animTimer = Date.now();
      }
    } else if (this._animPhase === 2) {
      // === Phase 2: 白闪过渡 (0~200ms) ===
      var t2 = Math.min(elapsed / 200, 1);
      var flashAlpha = t2 < 0.3 ? t2 / 0.3 * 0.5 : 0.5 * (1 - (t2 - 0.3) / 0.7);
      ctx.fillStyle = 'rgba(255,255,255,' + flashAlpha + ')';
      ctx.fillRect(0, 0, sw, sh);

      if (t2 >= 1) {
        this._animPhase = 3;
        this._animTimer = Date.now();
      }
    }
  }

  // ============================================================
  // 触摸处理
  // 返回: null | 'back' | {action:'draw', type:'normal'|'premium', count:1|10}
  // ============================================================
  handleTouch(x, y, gachaManager, saveManager) {
    // 动画中不响应触摸
    if (this._animPhase === 1 || this._animPhase === 2) return null;

    for (var i = 0; i < this._areas.length; i++) {
      var area = this._areas[i];
      if (x >= area.x && x <= area.x + area.w &&
          y >= area.y && y <= area.y + area.h) {
        var act = area.action;
        if (!act) continue;

        if (act === 'tab_normal') { this._tab = 'normal'; return null; }
        if (act === 'tab_premium') { this._tab = 'premium'; return null; }
        if (act === 'back') return 'back';
        if (act === 'confirm') {
          this._showResult = false;
          this._results = [];
          this._animPhase = 0;
          return null;
        }
        if (act.action === 'draw') return act;
      }
    }
    return null;
  }

  /**
   * 获取今天日期字符串 YYYY-MM-DD（用于免费抽判断）
   */
  _todayStr() {
    var d = new Date();
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }
}

module.exports = GachaUI;
