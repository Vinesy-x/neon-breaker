/**
 * HangarUI.js - 改装台 Canvas UI
 * 赛博朋克风格，纯 Canvas 2D 绘制
 * 
 * 四个界面状态：
 *   parts     - 部件总览（2列3行卡片）
 *   detail    - 部件详情（5芯片槽 + 合成区）
 *   inventory - 芯片仓库（可滚动列表 + 品质筛选）
 *   merge     - 合成面板（5合1）
 */

const Config = require('../Config');
const ChipConfig = require('../config/ChipConfig');

const PARTS = ChipConfig.PARTS;
const QUALITIES = ChipConfig.QUALITIES;
const QUALITY_ORDER = ['white', 'green', 'blue', 'purple', 'orange', 'red'];
const SLOTS = ChipConfig.SLOTS_PER_PART;

/** 品质颜色（绘制用，更鲜艳） */
const Q_COLORS = {
  white: '#AAAAAA', green: '#44FF88', blue: '#4488FF',
  purple: '#BB66FF', orange: '#FF8800', red: '#FF2244'
};

class HangarUI {
  constructor() {
    /** @type {'parts'|'detail'|'inventory'|'merge'} */
    this._state = 'parts';
    /** 当前选中部位 key */
    this._selectedPart = null;
    /** 当前选中的芯片槽索引（detail 界面） */
    this._selectedSlot = -1;
    /** 仓库滚动偏移 */
    this._scrollY = 0;
    /** 滚动惯性速度 */
    this._scrollVelocity = 0;
    /** 品质筛选 'all' | quality key */
    this._filterQuality = 'all';
    /** 合成选中的品质 */
    this._mergeQuality = null;
    /** 弹出菜单（detail 界面点击已装芯片时） */
    this._popup = null; // { slotIndex }
    /** 点击区域列表 [{key, x, y, w, h, action, data}] */
    this._areas = [];
  }

  // ================================================================
  // 绘制入口
  // ================================================================

  /** 主绘制入口，被外部 render 循环调用 */
  draw(ctx, chipManager, saveManager) {
    this._areas = [];
    // 惯性滚动衰减
    if (Math.abs(this._scrollVelocity) > 0.3) {
      this._scrollY += this._scrollVelocity;
      this._scrollVelocity *= 0.92;
      if (this._scrollY < 0) { this._scrollY = 0; this._scrollVelocity = 0; }
    } else {
      this._scrollVelocity = 0;
    }

    switch (this._state) {
      case 'parts':     this._drawParts(ctx, chipManager, saveManager); break;
      case 'detail':    this._drawDetail(ctx, chipManager, saveManager); break;
      case 'inventory': this._drawInventory(ctx, chipManager, saveManager); break;
      case 'merge':     this._drawMerge(ctx, chipManager, saveManager); break;
    }
  }

  // ================================================================
  // 界面1: 部件总览（2列3行卡片）
  // ================================================================

  /** 绘制6个部件卡片 */
  _drawParts(ctx, chipManager, saveManager) {
    const sw = Config.SCREEN_WIDTH;
    const safeTop = Config.SAFE_TOP;
    const maxCh = saveManager.getMaxChapter();

    // 标题
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('⚙ 改装台', sw / 2, safeTop + 24);

    const cardW = (sw - 30) / 2;
    const cardH = 100;
    const gap = 10;
    const startX = 10;
    const startY = safeTop + 44;

    const partKeys = Object.keys(PARTS);
    for (let i = 0; i < partKeys.length; i++) {
      const key = partKeys[i];
      const part = PARTS[key];
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = startX + col * (cardW + gap);
      const y = startY + row * (cardH + gap);
      const unlocked = maxCh >= part.unlock;

      // 获取该部位已装芯片
      const equipped = chipManager.getEquipped(key);
      const chipCount = equipped.filter(uid => uid !== null).length;

      // 找品质最高的芯片颜色作为边框
      let bestQuality = null;
      let bestQIdx = -1;
      equipped.forEach(uid => {
        if (!uid) return;
        const chip = chipManager.getChipByUid(uid);
        if (chip) {
          const qIdx = QUALITY_ORDER.indexOf(chip.quality);
          if (qIdx > bestQIdx) { bestQIdx = qIdx; bestQuality = chip.quality; }
        }
      });

      const borderColor = bestQuality ? Q_COLORS[bestQuality] + '55' : 'rgba(60,60,60,0.3)';
      this._drawCard(ctx, x, y, cardW, cardH, borderColor);

      if (!unlocked) {
        // 灰色遮罩 + 锁定文字
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.beginPath(); ctx.roundRect(x, y, cardW, cardH, 8); ctx.fill();
        ctx.fillStyle = '#666666';
        ctx.font = '13px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Ch.' + part.unlock + ' 解锁', x + cardW / 2, y + cardH / 2 + 4);
      } else {
        // 图标 + 名称
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '15px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(part.icon + ' ' + part.name, x + 10, y + 22);

        // 已装芯片数
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = '12px sans-serif';
        ctx.fillText(chipCount + ' / ' + SLOTS, x + 10, y + 42);

        // 品质色点预览（5个小圆点）
        for (let s = 0; s < SLOTS; s++) {
          const dotX = x + 10 + s * 16;
          const dotY = y + 60;
          const uid = equipped[s];
          if (uid) {
            const chip = chipManager.getChipByUid(uid);
            ctx.fillStyle = chip ? Q_COLORS[chip.quality] || '#AAAAAA' : '#333333';
          } else {
            ctx.fillStyle = '#333333';
          }
          ctx.beginPath();
          ctx.arc(dotX + 5, dotY, 5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 记录点击区域（仅已解锁）
      if (unlocked) {
        this._areas.push({ key: 'part_' + key, x, y, w: cardW, h: cardH, action: 'selectPart', data: key });
      }
    }

    // 底部 tab 栏（改装=index 2 高亮）
    this._drawBottomTabs(ctx, 2);
  }

  // ================================================================
  // 界面2: 部件详情（芯片槽 + 合成区）
  // ================================================================

  /** 绘制选中部件的5芯片槽和合成区 */
  _drawDetail(ctx, chipManager, saveManager) {
    const sw = Config.SCREEN_WIDTH;
    const safeTop = Config.SAFE_TOP;
    const key = this._selectedPart;
    const part = PARTS[key];
    if (!part) return;

    // 返回按钮
    this._drawBackButton(ctx, safeTop + 24);

    // 部件标题
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(part.icon + ' ' + part.name, sw / 2, safeTop + 24);

    // 5个芯片槽水平排列
    const equipped = chipManager.getEquipped(key);
    const slotSize = 56;
    const slotGap = 8;
    const totalW = SLOTS * slotSize + (SLOTS - 1) * slotGap;
    const slotStartX = (sw - totalW) / 2;
    const slotY = safeTop + 50;

    for (let i = 0; i < SLOTS; i++) {
      const sx = slotStartX + i * (slotSize + slotGap);
      const uid = equipped[i];
      const chip = uid ? chipManager.getChipByUid(uid) : null;
      this._drawChipSlot(ctx, sx, slotY, slotSize, chip, !uid);

      if (uid) {
        this._areas.push({ key: 'slot_' + i, x: sx, y: slotY, w: slotSize, h: slotSize + 20, action: 'tapSlot', data: i });
      } else {
        this._areas.push({ key: 'slot_' + i, x: sx, y: slotY, w: slotSize, h: slotSize + 20, action: 'openInventory', data: i });
      }
    }

    // 弹出菜单（卸下/洗练）
    if (this._popup !== null) {
      this._drawSlotPopup(ctx, chipManager);
    }

    // ─── 合成区 ───
    const mergeY = slotY + slotSize + 50;
    ctx.fillStyle = Config.NEON_CYAN;
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('─── 5合1升品质 ───', sw / 2, mergeY);

    // 统计各品质未装备芯片数
    const partChips = chipManager.getChipsByPart(key);
    let mergeInfoY = mergeY + 24;
    for (let qi = 0; qi < QUALITY_ORDER.length - 1; qi++) {
      const q = QUALITY_ORDER[qi];
      const qName = QUALITIES[q].name;
      const unequipped = partChips.filter(c => c.quality === q && !chipManager._isEquipped(c.uid));
      const count = unequipped.length;
      if (count === 0) continue;

      ctx.fillStyle = Q_COLORS[q];
      ctx.font = '13px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(qName + ': ' + count + '枚', 20, mergeInfoY);

      // 可合成时显示按钮
      if (count >= 5) {
        const btnX = sw - 90;
        const btnY2 = mergeInfoY - 14;
        this._drawButton(ctx, btnX, btnY2, 70, 24, '合成', Q_COLORS[q], true);
        this._areas.push({ key: 'merge_' + q, x: btnX, y: btnY2, w: 70, h: 24, action: 'startMerge', data: q });
      }
      mergeInfoY += 28;
    }
  }

  // ================================================================
  // 界面3: 芯片仓库（可滚动列表 + 品质筛选）
  // ================================================================

  /** 绘制芯片仓库 */
  _drawInventory(ctx, chipManager, saveManager) {
    const sw = Config.SCREEN_WIDTH;
    const sh = Config.SCREEN_HEIGHT;
    const safeTop = Config.SAFE_TOP;
    const key = this._selectedPart;

    // 返回按钮
    this._drawBackButton(ctx, safeTop + 24);

    // 标题
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('选择芯片', sw / 2, safeTop + 24);

    // 品质筛选 tab
    const filters = ['all', ...QUALITY_ORDER];
    const filterNames = ['全部', '白', '绿', '蓝', '紫', '橙', '红'];
    const tabW = (sw - 20) / filters.length;
    const tabY = safeTop + 40;
    const tabH = 26;

    for (let i = 0; i < filters.length; i++) {
      const tx = 10 + i * tabW;
      const active = this._filterQuality === filters[i];
      ctx.fillStyle = active ? 'rgba(0,255,255,0.15)' : 'rgba(255,255,255,0.04)';
      ctx.beginPath(); ctx.roundRect(tx, tabY, tabW - 2, tabH, 4); ctx.fill();
      ctx.fillStyle = active ? Config.NEON_CYAN : 'rgba(255,255,255,0.4)';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(filterNames[i], tx + tabW / 2 - 1, tabY + 17);
      this._areas.push({ key: 'filter_' + filters[i], x: tx, y: tabY, w: tabW - 2, h: tabH, action: 'setFilter', data: filters[i] });
    }

    // 筛选芯片：当前部位、未装备、符合品质
    const partChips = chipManager.getChipsByPart(key);
    let filtered = partChips.filter(c => !chipManager._isEquipped(c.uid));
    if (this._filterQuality !== 'all') {
      filtered = filtered.filter(c => c.quality === this._filterQuality);
    }
    // 按品质降序
    filtered.sort((a, b) => QUALITY_ORDER.indexOf(b.quality) - QUALITY_ORDER.indexOf(a.quality));

    const listY = tabY + tabH + 10;
    const cardH = 52;
    const cardGap = 6;
    const listH = sh - listY - Config.SAFE_BOTTOM - 10;

    // 限制滚动范围
    const contentH = filtered.length * (cardH + cardGap);
    const maxScroll = Math.max(0, contentH - listH);
    if (this._scrollY > maxScroll) this._scrollY = maxScroll;
    if (this._scrollY < 0) this._scrollY = 0;

    // 裁剪区域
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, listY, sw, listH);
    ctx.clip();

    for (let i = 0; i < filtered.length; i++) {
      const chip = filtered[i];
      const cy = listY + i * (cardH + cardGap) - this._scrollY;
      if (cy + cardH < listY || cy > listY + listH) continue;

      const cx = 10;
      const cw = sw - 20;

      // 卡片背景
      ctx.fillStyle = 'rgba(8,4,22,0.92)';
      ctx.beginPath(); ctx.roundRect(cx, cy, cw, cardH, 6); ctx.fill();
      ctx.strokeStyle = Q_COLORS[chip.quality] + '44';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect(cx, cy, cw, cardH, 6); ctx.stroke();

      // 品质色条（左边3px竖条）
      ctx.fillStyle = Q_COLORS[chip.quality];
      ctx.beginPath(); ctx.roundRect(cx, cy, 3, cardH, [3, 0, 0, 3]); ctx.fill();

      // 词条名 + 数值
      const affixText = this._formatAffix(chip);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(affixText, cx + 12, cy + 22);

      // 品质名
      ctx.fillStyle = Q_COLORS[chip.quality];
      ctx.font = '11px sans-serif';
      ctx.fillText(QUALITIES[chip.quality].name, cx + 12, cy + 40);

      // "装备"按钮
      const btnW2 = 52;
      const btnH2 = 26;
      const btnX2 = cx + cw - btnW2 - 8;
      const btnY2 = cy + (cardH - btnH2) / 2;
      this._drawButton(ctx, btnX2, btnY2, btnW2, btnH2, '装备', Config.NEON_CYAN, true);
      this._areas.push({ key: 'equip_' + chip.uid, x: btnX2, y: btnY2, w: btnW2, h: btnH2, action: 'equipChip', data: chip.uid });
    }

    ctx.restore();

    // 滚动条指示器
    if (contentH > listH && maxScroll > 0) {
      const barH = Math.max(20, listH * (listH / contentH));
      const barY2 = listY + (listH - barH) * (this._scrollY / maxScroll);
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.beginPath(); ctx.roundRect(sw - 4, barY2, 3, barH, 1.5); ctx.fill();
    }
  }

  // ================================================================
  // 界面4: 合成面板（5合1升品质）
  // ================================================================

  /** 绘制合成面板 */
  _drawMerge(ctx, chipManager, saveManager) {
    const sw = Config.SCREEN_WIDTH;
    const safeTop = Config.SAFE_TOP;
    const key = this._selectedPart;
    const quality = this._mergeQuality;
    if (!quality) return;

    // 返回按钮
    this._drawBackButton(ctx, safeTop + 24);

    // 标题
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('芯片合成', sw / 2, safeTop + 24);

    const nextQ = QUALITY_ORDER[QUALITY_ORDER.indexOf(quality) + 1] || quality;

    // 5个待合成芯片槽
    const slotSize = 48;
    const slotGap = 6;
    const rowW = 5 * slotSize + 4 * slotGap;
    const rowX = (sw - rowW) / 2;
    const rowY = safeTop + 60;

    // 获取可合成的芯片（前5个）
    const candidates = chipManager.getChipsByPart(key)
      .filter(c => c.quality === quality && !chipManager._isEquipped(c.uid));

    for (let i = 0; i < 5; i++) {
      const sx = rowX + i * (slotSize + slotGap);
      const chip = candidates[i] || null;
      this._drawChipSlot(ctx, sx, rowY, slotSize, chip, !chip);
    }

    // 箭头指示
    const arrowY = rowY + slotSize + 20;
    ctx.fillStyle = Config.NEON_YELLOW;
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('⬇', sw / 2, arrowY);

    // 结果品质预览
    const resultY = arrowY + 16;
    ctx.fillStyle = Q_COLORS[nextQ];
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText('→ ' + QUALITIES[nextQ].name + ' 品质芯片', sw / 2, resultY);

    // 合成按钮
    const btnW = 120;
    const btnH = 36;
    const btnX = (sw - btnW) / 2;
    const btnY = resultY + 20;
    const canMerge = candidates.length >= 5;
    this._drawButton(ctx, btnX, btnY, btnW, btnH, '合成！', Q_COLORS[nextQ], canMerge);
    if (canMerge) {
      this._areas.push({ key: 'doMerge', x: btnX, y: btnY, w: btnW, h: btnH, action: 'doMerge', data: null });
    }
  }

  // ================================================================
  // 触摸处理
  // ================================================================

  /**
   * 处理触摸事件
   * @param {number} x 触摸 x 坐标
   * @param {number} y 触摸 y 坐标
   * @param {object} chipManager ChipManager 实例
   * @param {object} saveManager SaveManager 实例
   * @returns {null|'back'|'exit'} null=无操作, 'back'=返回上一层, 'exit'=退出改装台
   */
  handleTouch(x, y, chipManager, saveManager) {
    // 从后往前遍历（后绘制的在上层，优先响应）
    for (let i = this._areas.length - 1; i >= 0; i--) {
      const a = this._areas[i];
      if (x >= a.x && x <= a.x + a.w && y >= a.y && y <= a.y + a.h) {
        return this._handleAction(a.action, a.data, chipManager, saveManager);
      }
    }

    // 点击空白处关闭弹出菜单
    if (this._popup) {
      this._popup = null;
      return null;
    }

    return null;
  }

  /**
   * 处理滑动（用于仓库列表滚动）
   * @param {number} dy 滑动 Y 距离（负=上滑）
   */
  handleSwipe(dy) {
    if (this._state === 'inventory') {
      this._scrollVelocity = dy * 0.3;
    }
  }

  /** 分发点击动作到对应处理逻辑 */
  _handleAction(action, data, chipManager, saveManager) {
    switch (action) {
      case 'selectPart':
        this._state = 'detail';
        this._selectedPart = data;
        this._popup = null;
        return null;

      case 'tapSlot':
        // 点击已装芯片槽 → 弹出操作菜单
        this._popup = { slotIndex: data };
        return null;

      case 'openInventory':
        // 点击空槽 → 进入仓库选芯片
        this._selectedSlot = data;
        this._state = 'inventory';
        this._scrollY = 0;
        this._scrollVelocity = 0;
        this._filterQuality = 'all';
        return null;

      case 'setFilter':
        this._filterQuality = data;
        this._scrollY = 0;
        return null;

      case 'equipChip':
        // 装备芯片到选中槽位
        chipManager.equip(data, this._selectedPart, this._selectedSlot);
        if (saveManager.saveChipData) saveManager.saveChipData(chipManager);
        this._state = 'detail';
        return null;

      case 'startMerge':
        this._mergeQuality = data;
        this._state = 'merge';
        return null;

      case 'doMerge':
        // 执行合成
        chipManager.merge(this._selectedPart, this._mergeQuality);
        if (saveManager.saveChipData) saveManager.saveChipData(chipManager);
        this._state = 'detail';
        return null;

      case 'unequipSlot':
        // 卸下芯片
        chipManager.unequip(this._selectedPart, this._popup.slotIndex);
        if (saveManager.saveChipData) saveManager.saveChipData(chipManager);
        this._popup = null;
        return null;

      case 'rerollSlot': {
        // 洗练芯片
        const equipped = chipManager.getEquipped(this._selectedPart);
        const uid = equipped[this._popup.slotIndex];
        if (uid) chipManager.reroll(uid);
        if (saveManager.saveChipData) saveManager.saveChipData(chipManager);
        this._popup = null;
        return null;
      }

      case 'back':
        return this._goBack();

      case 'tab':
        if (data === 2) return null; // 已在改装 tab
        return 'exit'; // 切换到其他 tab → 通知外层

      default:
        return null;
    }
  }

  /** 返回上一层状态 */
  _goBack() {
    switch (this._state) {
      case 'detail':
        this._state = 'parts';
        this._selectedPart = null;
        this._popup = null;
        return null;
      case 'inventory':
        this._state = 'detail';
        this._scrollY = 0;
        return null;
      case 'merge':
        this._state = 'detail';
        return null;
      case 'parts':
        return 'exit';
    }
    return null;
  }

  // ================================================================
  // 通用 UI 组件
  // ================================================================

  /** 绘制通用卡片（深色背景 + 圆角 + 边框） */
  _drawCard(ctx, x, y, w, h, borderColor) {
    ctx.fillStyle = 'rgba(8,4,22,0.92)';
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 8); ctx.fill();
    ctx.strokeStyle = borderColor || 'rgba(60,60,60,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 8); ctx.stroke();
  }

  /** 绘制通用按钮（半透明填充 + 霓虹边框） */
  _drawButton(ctx, x, y, w, h, text, color, enabled) {
    if (enabled) {
      ctx.fillStyle = color + '22';
      ctx.beginPath(); ctx.roundRect(x, y, w, h, 4); ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect(x, y, w, h, 4); ctx.stroke();
      ctx.fillStyle = color;
    } else {
      ctx.fillStyle = 'rgba(40,40,40,0.5)';
      ctx.beginPath(); ctx.roundRect(x, y, w, h, 4); ctx.fill();
      ctx.fillStyle = '#555555';
    }
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(text, x + w / 2, y + h / 2 + 4);
  }

  /** 绘制芯片槽（空槽虚线+加号 / 有芯片显示品质和词条） */
  _drawChipSlot(ctx, x, y, size, chip, empty) {
    if (empty) {
      // 虚线空槽
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.roundRect(x, y, size, size, 6); ctx.stroke();
      ctx.setLineDash([]);
      // + 号
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.font = '20px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('+', x + size / 2, y + size / 2 + 7);
    } else {
      // 有芯片：品质色背景 + 边框
      const qColor = Q_COLORS[chip.quality] || '#AAAAAA';
      ctx.fillStyle = qColor + '15';
      ctx.beginPath(); ctx.roundRect(x, y, size, size, 6); ctx.fill();
      ctx.strokeStyle = qColor;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.roundRect(x, y, size, size, 6); ctx.stroke();

      // 品质名
      ctx.fillStyle = qColor;
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(QUALITIES[chip.quality].name, x + size / 2, y + size / 2 - 4);

      // 词条短文本
      const affixShort = this._formatAffixShort(chip);
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = '9px sans-serif';
      ctx.fillText(affixShort, x + size / 2, y + size / 2 + 10);
    }
  }

  /** 绘制返回按钮（左上角） */
  _drawBackButton(ctx, y) {
    const bx = 10, by = y - 16, bw = 40, bh = 28;
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 6); ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('‹', bx + bw / 2, by + bh / 2 + 5);
    this._areas.push({ key: 'back', x: bx, y: by, w: bw, h: bh, action: 'back', data: null });
  }

  /** 绘制底部 tab 栏（改造/武器/改装） */
  _drawBottomTabs(ctx, activeIdx) {
    const sw = Config.SCREEN_WIDTH;
    const sh = Config.SCREEN_HEIGHT;
    const tabH = 42;
    const tabY = sh - Config.SAFE_BOTTOM - tabH;
    const tabs = ['改造', '武器', '改装'];

    // tab 背景条
    ctx.fillStyle = 'rgba(5,3,20,0.95)';
    ctx.fillRect(0, tabY, sw, tabH + Config.SAFE_BOTTOM);

    const tabW = sw / tabs.length;
    for (let i = 0; i < tabs.length; i++) {
      const tx = i * tabW;
      const active = i === activeIdx;

      if (active) {
        ctx.fillStyle = 'rgba(0,255,255,0.1)';
        ctx.fillRect(tx, tabY, tabW, tabH);
        // 高亮顶线
        ctx.fillStyle = Config.NEON_CYAN;
        ctx.fillRect(tx + 10, tabY, tabW - 20, 2);
      }

      ctx.fillStyle = active ? Config.NEON_CYAN : 'rgba(255,255,255,0.4)';
      ctx.font = (active ? 'bold ' : '') + '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(tabs[i], tx + tabW / 2, tabY + tabH / 2 + 5);

      this._areas.push({ key: 'tab_' + i, x: tx, y: tabY, w: tabW, h: tabH, action: 'tab', data: i });
    }
  }

  /** 绘制芯片槽弹出操作菜单（卸下/洗练） */
  _drawSlotPopup(ctx, chipManager) {
    const sw = Config.SCREEN_WIDTH;
    const popW = 120;
    const popH = 70;
    const popX = (sw - popW) / 2;
    const popY = Config.SAFE_TOP + 120;

    // 深色弹窗背景
    ctx.fillStyle = 'rgba(15,10,40,0.97)';
    ctx.beginPath(); ctx.roundRect(popX, popY, popW, popH, 10); ctx.fill();
    ctx.strokeStyle = Config.NEON_CYAN + '66';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(popX, popY, popW, popH, 10); ctx.stroke();

    // 卸下按钮
    const btn1Y = popY + 8;
    this._drawButton(ctx, popX + 10, btn1Y, popW - 20, 22, '卸下', '#FF6644', true);
    this._areas.push({ key: 'popup_unequip', x: popX + 10, y: btn1Y, w: popW - 20, h: 22, action: 'unequipSlot', data: null });

    // 洗练按钮
    const btn2Y = popY + 38;
    this._drawButton(ctx, popX + 10, btn2Y, popW - 20, 22, '洗练', Config.NEON_CYAN, true);
    this._areas.push({ key: 'popup_reroll', x: popX + 10, y: btn2Y, w: popW - 20, h: 22, action: 'rerollSlot', data: null });
  }

  // ================================================================
  // 辅助方法
  // ================================================================

  /** 返回品质颜色字符串 */
  _qualityColor(quality) {
    return Q_COLORS[quality] || '#AAAAAA';
  }

  /** 返回品质中文名 */
  _qualityName(quality) {
    return QUALITIES[quality] ? QUALITIES[quality].name : '未知';
  }

  /** 格式化芯片词条完整文本（如 "+4.9% 暴击率"） */
  _formatAffix(chip) {
    if (!chip || !chip.affix) return '???';
    const affix = chip.affix;
    const pool = ChipConfig.AFFIX_POOL[chip.part] || [];
    const def = pool.find(a => a.id === affix.id);
    if (!def) return affix.id + ': ' + affix.value;

    let valStr;
    if (def.format.includes('%')) {
      valStr = def.format.replace('N', (affix.value * 100).toFixed(1));
    } else {
      valStr = def.format.replace('N', Math.round(affix.value));
    }
    return valStr + ' ' + def.name;
  }

  /** 格式化芯片词条短文本（芯片槽内显示） */
  _formatAffixShort(chip) {
    if (!chip || !chip.affix) return '?';
    const pool = ChipConfig.AFFIX_POOL[chip.part] || [];
    const def = pool.find(a => a.id === chip.affix.id);
    if (!def) return chip.affix.id;

    if (def.format.includes('%')) {
      return (chip.affix.value * 100).toFixed(1) + '%';
    }
    return '+' + Math.round(chip.affix.value);
  }
}

module.exports = HangarUI;
