/**
 * DevPanel.js - 开发者工具面板
 * 游戏内点击🔧展开，可直接添加/升级武器、加经验等
 */
const Config = require('./Config');

class DevPanel {
  constructor() {
    this.open = false;
    this.scroll = 0;          // 滚动偏移
    this.maxScroll = 0;
    this._hitAreas = [];      // { x, y, w, h, action, params }
    this._btnArea = null;     // 🔧 按钮区域
    this._closeArea = null;
    this._scrollStartY = 0;
    this._isDragging = false;
  }

  /** 检测点击，返回 action 对象或 null */
  handleTap(tap, game) {
    if (!tap) return null;

    // 🔧 按钮 - 任何游戏状态都可点
    if (this._btnArea) {
      const a = this._btnArea;
      if (tap.x >= a.x && tap.x <= a.x + a.w && tap.y >= a.y && tap.y <= a.y + a.h) {
        this.open = !this.open;
        this.scroll = 0;
        return { consumed: true };
      }
    }

    if (!this.open) return null;

    // 关闭按钮
    if (this._closeArea) {
      const a = this._closeArea;
      if (tap.x >= a.x && tap.x <= a.x + a.w && tap.y >= a.y && tap.y <= a.y + a.h) {
        this.open = false;
        return { consumed: true };
      }
    }

    // 面板内按钮
    for (const area of this._hitAreas) {
      if (tap.x >= area.x && tap.x <= area.x + area.w &&
          tap.y >= area.y && tap.y <= area.y + area.h) {
        this._executeAction(area.action, area.params, game);
        return { consumed: true };
      }
    }

    // 点在面板区域内 → 消费掉，不传递给游戏
    const panelX = 10, panelY = Config.SAFE_TOP + 10;
    const panelW = Config.SCREEN_WIDTH - 20;
    const panelH = Config.SCREEN_HEIGHT - panelY - Config.SAFE_BOTTOM - 10;
    if (tap.x >= panelX && tap.x <= panelX + panelW &&
        tap.y >= panelY && tap.y <= panelY + panelH) {
      return { consumed: true };
    }

    return null;
  }

  /** 处理滑动（用于面板内滚动） */
  handleDrag(dy) {
    if (!this.open) return;
    this.scroll = Math.max(0, Math.min(this.maxScroll, this.scroll - dy));
  }

  _executeAction(action, params, game) {
    switch (action) {
      case 'addWeapon':
        if (!game.upgrades.hasWeapon(params.key)) {
          game.upgrades.addWeapon(params.key);
          game._syncLauncherStats();
        }
        break;

      case 'upgradeWeaponBranch':
        game.upgrades.upgradeWeaponBranch(params.weaponKey, params.branchKey);
        game._syncLauncherStats();
        break;

      case 'maxWeaponBranch': {
        const weapon = game.upgrades.weapons[params.weaponKey];
        if (weapon) {
          const bDef = Config.WEAPON_TREES[params.weaponKey].branches[params.branchKey];
          while (weapon.getBranch(params.branchKey) < bDef.max) {
            weapon.upgradeBranch(params.branchKey);
          }
          game._syncLauncherStats();
        }
        break;
      }

      case 'upgradeShip':
        game.upgrades.upgradeShip(params.key);
        game._syncLauncherStats();
        break;

      case 'maxShip': {
        const def = Config.SHIP_TREE[params.key];
        if (def) {
          while (game.upgrades.canUpgradeShip(params.key)) {
            game.upgrades.upgradeShip(params.key);
          }
          game._syncLauncherStats();
        }
        break;
      }

      case 'addExp':
        game.expSystem.addExp(params.amount);
        break;

      case 'levelUp':
        // 直接升一级
        game.expSystem.addExp(game.expSystem.expToNext - game.expSystem.exp);
        break;

      case 'levelUp10':
        for (let i = 0; i < 10; i++) {
          game.expSystem.addExp(game.expSystem.expToNext - game.expSystem.exp);
        }
        break;

      case 'clearBricks':
        for (const b of game.bricks) b.alive = false;
        game.bricks = [];
        break;

      case 'toggleInvincible':
        game._devInvincible = !game._devInvincible;
        break;

      case 'killBoss':
        if (game.boss && game.boss.alive) {
          game.boss.hp = 0;
          game.boss.alive = false;
        }
        break;

      case 'spawnBoss':
        if (!game.boss || !game.boss.alive) {
          game._startBoss();
        }
        break;

      case 'addCoins':
        game.saveManager.addCoins(params.amount);
        break;

      case 'maxAllWeapons':
        // 添加所有武器并满级
        for (const wk in Config.WEAPON_TREES) {
          if (!game.upgrades.hasWeapon(wk) && game.upgrades.getWeaponCount() < Config.MAX_WEAPONS) {
            game.upgrades.addWeapon(wk);
          }
          if (game.upgrades.hasWeapon(wk)) {
            const weapon = game.upgrades.weapons[wk];
            for (const bk in Config.WEAPON_TREES[wk].branches) {
              const bDef = Config.WEAPON_TREES[wk].branches[bk];
              while (weapon.getBranch(bk) < bDef.max) {
                if (!weapon.upgradeBranch(bk)) break;
              }
            }
          }
        }
        game._syncLauncherStats();
        break;
    }
  }

  /** 绘制面板 */
  draw(ctx, game) {
    this._hitAreas = [];

    // 🔧 按钮（左下角，音效按钮上面）
    const btnSize = 28;
    const btnX = 10;
    const btnY = Config.SCREEN_HEIGHT - Config.SAFE_BOTTOM - 80;
    this._btnArea = { x: btnX, y: btnY, w: btnSize, h: btnSize };

    // 绘制🔧按钮
    ctx.fillStyle = this.open ? 'rgba(0,255,255,0.3)' : 'rgba(255,255,255,0.15)';
    ctx.beginPath();
    ctx.arc(btnX + btnSize / 2, btnY + btnSize / 2, btnSize / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = this.open ? Config.NEON_CYAN : 'rgba(255,255,255,0.6)';
    ctx.font = '16px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🔧', btnX + btnSize / 2, btnY + btnSize / 2);

    if (!this.open) return;

    // 面板背景
    const panelX = 10;
    const panelY = Config.SAFE_TOP + 10;
    const panelW = Config.SCREEN_WIDTH - 20;
    const panelH = Config.SCREEN_HEIGHT - panelY - Config.SAFE_BOTTOM - 10;

    ctx.fillStyle = 'rgba(8, 2, 32, 0.92)';
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 8);
    ctx.fill();
    ctx.strokeStyle = Config.NEON_CYAN;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 8);
    ctx.stroke();

    // 标题栏
    ctx.fillStyle = Config.NEON_CYAN;
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('⚙ DEV TOOLS ⚙', panelX + panelW / 2, panelY + 8);

    // 关闭按钮
    const closeSize = 24;
    const closeX = panelX + panelW - closeSize - 6;
    const closeY = panelY + 4;
    this._closeArea = { x: closeX, y: closeY, w: closeSize, h: closeSize };
    ctx.fillStyle = 'rgba(255,50,50,0.6)';
    ctx.beginPath();
    ctx.arc(closeX + closeSize / 2, closeY + closeSize / 2, closeSize / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 12px monospace';
    ctx.fillText('✕', closeX + closeSize / 2, closeY + 6);

    // ===== 内容区域（带裁剪） =====
    const contentX = panelX + 6;
    const contentW = panelW - 12;
    const contentTop = panelY + 30;
    const contentH = panelH - 38;

    ctx.save();
    ctx.beginPath();
    ctx.rect(panelX, contentTop, panelW, contentH);
    ctx.clip();

    let cy = contentTop - this.scroll;
    const rowH = 30;
    const smallRowH = 24;
    const sectionGap = 10;

    // ===== 快捷操作 =====
    cy = this._drawSection(ctx, '⚡ 快捷操作', contentX, cy, contentW);
    const quickBtns = [
      { label: '升10级', action: 'levelUp10', color: Config.NEON_GREEN },
      { label: '清屏', action: 'clearBricks', color: Config.NEON_ORANGE },
      { label: game._devInvincible ? '无敌 ON' : '无敌 OFF', action: 'toggleInvincible', color: game._devInvincible ? Config.NEON_GREEN : '#888' },
      { label: '+1000💰', action: 'addCoins', params: { amount: 1000 }, color: '#FFD700' },
      { label: '召唤Boss', action: 'spawnBoss', color: Config.NEON_RED },
      { label: '秒杀Boss', action: 'killBoss', color: Config.NEON_PINK },
    ];
    cy = this._drawButtonGrid(ctx, quickBtns, contentX, cy, contentW, 3);
    cy += sectionGap;

    // ===== 武器管理 =====
    cy = this._drawSection(ctx, '🔪 武器', contentX, cy, contentW);

    // 添加武器按钮
    const weaponKeys = Object.keys(Config.WEAPON_TREES);
    for (const wk of weaponKeys) {
      const wDef = Config.WEAPON_TREES[wk];
      const owned = game.upgrades.hasWeapon(wk);

      // 武器名称行
      ctx.fillStyle = owned ? wDef.color : '#666';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(wDef.icon + ' ' + wDef.name + (owned ? ' ✓' : ''), contentX + 4, cy + 2);

      if (!owned) {
        // 添加按钮
        const addBtnW = 40;
        const addBtnX = contentX + contentW - addBtnW - 2;
        this._drawBtn(ctx, '添加', addBtnX, cy, addBtnW, smallRowH - 2, wDef.color,
          { action: 'addWeapon', params: { key: wk } });
      }
      cy += smallRowH;

      // 分支升级（仅已拥有的）
      if (owned) {
        const weapon = game.upgrades.weapons[wk];
        for (const bk in wDef.branches) {
          const bDef = wDef.branches[bk];
          const curLv = weapon.getBranch(bk);
          const maxLv = bDef.max;

          // 分支名 + 等级条
          ctx.fillStyle = curLv >= maxLv ? '#FFD700' : 'rgba(255,255,255,0.6)';
          ctx.font = '10px monospace';
          ctx.textAlign = 'left';
          ctx.fillText('  ' + bDef.name + ' ' + curLv + '/' + maxLv, contentX + 4, cy + 4);

          // 等级点
          const dotStartX = contentX + 80;
          for (let d = 0; d < maxLv; d++) {
            ctx.fillStyle = d < curLv ? wDef.color : 'rgba(255,255,255,0.15)';
            ctx.beginPath();
            ctx.arc(dotStartX + d * 12, cy + smallRowH / 2, 3, 0, Math.PI * 2);
            ctx.fill();
          }

          // +1 按钮
          if (curLv < maxLv) {
            const upBtnW = 26;
            const upBtnX = contentX + contentW - upBtnW * 2 - 8;
            this._drawBtn(ctx, '+1', upBtnX, cy + 1, upBtnW, smallRowH - 4, wDef.color,
              { action: 'upgradeWeaponBranch', params: { weaponKey: wk, branchKey: bk } });

            // MAX 按钮
            const maxBtnX = upBtnX + upBtnW + 4;
            this._drawBtn(ctx, 'MAX', maxBtnX, cy + 1, upBtnW, smallRowH - 4, '#FFD700',
              { action: 'maxWeaponBranch', params: { weaponKey: wk, branchKey: bk } });
          }

          cy += smallRowH;
        }
        cy += 4; // 武器之间小间距
      }
    }
    cy += sectionGap;

    // ===== 飞机升级 =====
    cy = this._drawSection(ctx, '✈ 飞机', contentX, cy, contentW);
    for (const sk in Config.SHIP_TREE) {
      const def = Config.SHIP_TREE[sk];
      const curLv = game.upgrades.getShipLevel(sk);
      const maxLv = def.max;

      ctx.fillStyle = curLv >= maxLv ? '#FFD700' : 'rgba(255,255,255,0.6)';
      ctx.font = '10px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(def.icon + ' ' + def.name + ' ' + curLv + '/' + maxLv, contentX + 4, cy + 4);

      // 等级点
      const dotStartX = contentX + 90;
      for (let d = 0; d < Math.min(maxLv, 6); d++) {
        ctx.fillStyle = d < curLv ? (def.color || Config.NEON_CYAN) : 'rgba(255,255,255,0.15)';
        ctx.beginPath();
        ctx.arc(dotStartX + d * 12, cy + smallRowH / 2, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      if (curLv < maxLv) {
        const upBtnW = 26;
        const upBtnX = contentX + contentW - upBtnW * 2 - 8;
        this._drawBtn(ctx, '+1', upBtnX, cy + 1, upBtnW, smallRowH - 4, def.color || Config.NEON_CYAN,
          { action: 'upgradeShip', params: { key: sk } });
        const maxBtnX = upBtnX + upBtnW + 4;
        this._drawBtn(ctx, 'MAX', maxBtnX, cy + 1, upBtnW, smallRowH - 4, '#FFD700',
          { action: 'maxShip', params: { key: sk } });
      }

      cy += smallRowH;
    }
    cy += sectionGap;

    // ===== 一键全满 =====
    cy = this._drawSection(ctx, '🚀 一键', contentX, cy, contentW);
    const megaBtns = [
      { label: '全武器满级', action: 'maxAllWeapons', color: '#FFD700' },
    ];
    cy = this._drawButtonGrid(ctx, megaBtns, contentX, cy, contentW, 2);

    // 更新最大滚动
    this.maxScroll = Math.max(0, (cy + this.scroll) - (contentTop + contentH));

    ctx.restore();

    // 滚动条指示
    if (this.maxScroll > 0) {
      const trackH = contentH;
      const thumbH = Math.max(20, trackH * (contentH / (contentH + this.maxScroll)));
      const thumbY = contentTop + (this.scroll / this.maxScroll) * (trackH - thumbH);
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(panelX + panelW - 4, contentTop, 3, trackH);
      ctx.fillStyle = 'rgba(0,255,255,0.4)';
      ctx.fillRect(panelX + panelW - 4, thumbY, 3, thumbH);
    }
  }

  // ===== 绘制辅助 =====

  _drawSection(ctx, title, x, y, w) {
    ctx.fillStyle = 'rgba(0,255,255,0.1)';
    ctx.fillRect(x, y, w, 20);
    ctx.fillStyle = Config.NEON_CYAN;
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(title, x + 6, y + 4);
    return y + 24;
  }

  _drawBtn(ctx, label, x, y, w, h, color, hitData) {
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 3);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 3);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + w / 2, y + h / 2);

    this._hitAreas.push({ x, y, w, h, action: hitData.action, params: hitData.params || {} });
  }

  _drawButtonGrid(ctx, btns, x, y, totalW, cols) {
    const gap = 6;
    const btnW = (totalW - gap * (cols - 1)) / cols;
    const btnH = 26;
    let col = 0;
    let rowY = y;

    for (const btn of btns) {
      const bx = x + col * (btnW + gap);
      this._drawBtn(ctx, btn.label, bx, rowY, btnW, btnH, btn.color,
        { action: btn.action, params: btn.params || {} });
      col++;
      if (col >= cols) {
        col = 0;
        rowY += btnH + 4;
      }
    }

    return rowY + (col > 0 ? btnH + 4 : 0);
  }
}

module.exports = DevPanel;
