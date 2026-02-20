/**
 * DevPanel.js - 开发者工具面板 v2
 * Tab页签式布局，按钮更大，操作更方便
 */
const Config = require('./Config');

class DevPanel {
  constructor() {
    this.open = false;
    this.tab = 0;           // 0=快捷 1=武器 2=飞机
    this.scroll = 0;
    this.maxScroll = 0;
    this._hitAreas = [];
    this._btnArea = null;
    this._closeArea = null;
    this._tabAreas = [];
  }

  handleTap(tap, game) {
    if (!tap) return null;

    // 🔧 按钮
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

    // Tab 页签
    for (let i = 0; i < this._tabAreas.length; i++) {
      const a = this._tabAreas[i];
      if (tap.x >= a.x && tap.x <= a.x + a.w && tap.y >= a.y && tap.y <= a.y + a.h) {
        this.tab = i;
        this.scroll = 0;
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

    // 点在面板内 → 消费
    const p = this._panelRect;
    if (p && tap.x >= p.x && tap.x <= p.x + p.w && tap.y >= p.y && tap.y <= p.y + p.h) {
      return { consumed: true };
    }

    return null;
  }

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
      case 'removeWeapon':
        if (game.upgrades.hasWeapon(params.key)) {
          delete game.upgrades.weapons[params.key];
          game._syncLauncherStats();
        }
        break;
      case 'upgradeWeaponBranch':
        game.upgrades.upgradeWeaponBranch(params.weaponKey, params.branchKey);
        game._syncLauncherStats();
        break;
      case 'downgradeWeaponBranch': {
        const weapon = game.upgrades.weapons[params.weaponKey];
        if (weapon && weapon.getBranch(params.branchKey) > 0) {
          weapon.branches[params.branchKey]--;
          game._syncLauncherStats();
        }
        break;
      }
      case 'maxWeaponBranch': {
        const weapon = game.upgrades.weapons[params.weaponKey];
        if (weapon) {
          const bDef = Config.WEAPON_TREES[params.weaponKey].branches[params.branchKey];
          // dev模式：直接设置到满级，绕过前置条件
          weapon.branches[params.branchKey] = bDef.max;
          game._syncLauncherStats();
        }
        break;
      }
      case 'upgradeShip':
        game.upgrades.upgradeShip(params.key);
        game._syncLauncherStats();
        break;
      case 'downgradeShip':
        if ((game.upgrades.shipTree[params.key] || 0) > 0) {
          game.upgrades.shipTree[params.key]--;
          game._syncLauncherStats();
        }
        break;
      case 'maxShip': {
        const def = Config.SHIP_TREE[params.key];
        if (def) {
          // dev模式：直接设到满级
          game.upgrades.shipTree[params.key] = def.max;
          game._syncLauncherStats();
        }
        break;
      }
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
      case 'togglePauseFire':
        game._devPauseFire = !game._devPauseFire;
        break;
      case 'togglePauseLevelUp':
        game._devPauseLevelUp = !game._devPauseLevelUp;
        break;
      case 'killBoss':
        if (game.boss && game.boss.alive) {
          game.boss.hp = 0;
          game.boss.alive = false;
        }
        break;
      case 'spawnBoss':
        if (!game.boss || !game.boss.alive) game._startBoss();
        break;
      case 'addCoins':
        game.saveManager.addCoins(params.amount);
        break;
      case 'maxAllWeapons':
        for (const wk in Config.WEAPON_TREES) {
          if (!game.upgrades.hasWeapon(wk) && game.upgrades.getWeaponCount() < Config.MAX_WEAPONS) {
            game.upgrades.addWeapon(wk);
          }
          if (game.upgrades.hasWeapon(wk)) {
            const weapon = game.upgrades.weapons[wk];
            for (const bk in Config.WEAPON_TREES[wk].branches) {
              weapon.branches[bk] = Config.WEAPON_TREES[wk].branches[bk].max;
            }
          }
        }
        game._syncLauncherStats();
        break;
      case 'resetAll':
        game.upgrades.reset();
        game._syncLauncherStats();
        break;
    }
  }

  draw(ctx, game) {
    this._hitAreas = [];
    this._tabAreas = [];

    // 🔧 按钮
    const btnSize = 32;
    const btnX = 10;
    const btnY = Config.SCREEN_HEIGHT - Config.SAFE_BOTTOM - 84;
    this._btnArea = { x: btnX, y: btnY, w: btnSize, h: btnSize };

    ctx.fillStyle = this.open ? 'rgba(0,255,255,0.35)' : 'rgba(255,255,255,0.12)';
    ctx.beginPath();
    ctx.arc(btnX + btnSize / 2, btnY + btnSize / 2, btnSize / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = this.open ? Config.NEON_CYAN : 'rgba(255,255,255,0.5)';
    ctx.font = '18px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🔧', btnX + btnSize / 2, btnY + btnSize / 2);

    if (!this.open) return;

    // 面板
    const px = 8, py = Config.SAFE_TOP + 6;
    const pw = Config.SCREEN_WIDTH - 16;
    const ph = Config.SCREEN_HEIGHT - py - Config.SAFE_BOTTOM - 6;
    this._panelRect = { x: px, y: py, w: pw, h: ph };

    ctx.fillStyle = 'rgba(5, 1, 25, 0.95)';
    ctx.beginPath(); ctx.roundRect(px, py, pw, ph, 10); ctx.fill();
    ctx.strokeStyle = Config.NEON_CYAN; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(px, py, pw, ph, 10); ctx.stroke();

    // 标题 + 关闭
    ctx.fillStyle = Config.NEON_CYAN;
    ctx.font = 'bold 15px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('DEV TOOLS', px + pw / 2, py + 8);

    const clsS = 28, clsX = px + pw - clsS - 4, clsY = py + 4;
    this._closeArea = { x: clsX, y: clsY, w: clsS, h: clsS };
    ctx.fillStyle = 'rgba(255,50,50,0.7)';
    ctx.beginPath(); ctx.arc(clsX + clsS / 2, clsY + clsS / 2, clsS / 2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#FFF'; ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('✕', clsX + clsS / 2, clsY + clsS / 2);

    // ===== Tab 页签 =====
    const tabNames = ['⚡ 快捷', '🔪 武器', '✈ 飞机'];
    const tabY = py + 32;
    const tabH = 34;
    const tabGap = 4;
    const tabW = (pw - tabGap * (tabNames.length + 1)) / tabNames.length;

    for (let i = 0; i < tabNames.length; i++) {
      const tx = px + tabGap + i * (tabW + tabGap);
      const isActive = this.tab === i;

      ctx.fillStyle = isActive ? 'rgba(0,255,255,0.2)' : 'rgba(255,255,255,0.05)';
      ctx.beginPath(); ctx.roundRect(tx, tabY, tabW, tabH, 6); ctx.fill();

      if (isActive) {
        ctx.strokeStyle = Config.NEON_CYAN; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.roundRect(tx, tabY, tabW, tabH, 6); ctx.stroke();
      }

      ctx.fillStyle = isActive ? '#FFFFFF' : 'rgba(255,255,255,0.5)';
      ctx.font = 'bold 13px monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(tabNames[i], tx + tabW / 2, tabY + tabH / 2);

      this._tabAreas.push({ x: tx, y: tabY, w: tabW, h: tabH });
    }

    // ===== 内容区域 =====
    const ctop = tabY + tabH + 8;
    const ch = ph - (ctop - py) - 6;
    const cx = px + 8, cw = pw - 16;

    ctx.save();
    ctx.beginPath(); ctx.rect(px, ctop, pw, ch); ctx.clip();

    let cy = ctop - this.scroll;

    switch (this.tab) {
      case 0: cy = this._drawQuickTab(ctx, game, cx, cy, cw); break;
      case 1: cy = this._drawWeaponTab(ctx, game, cx, cy, cw); break;
      case 2: cy = this._drawShipTab(ctx, game, cx, cy, cw); break;
    }

    this.maxScroll = Math.max(0, (cy + this.scroll) - (ctop + ch));
    ctx.restore();

    // 滚动条
    if (this.maxScroll > 0) {
      const thumbH = Math.max(20, ch * (ch / (ch + this.maxScroll)));
      const thumbY = ctop + (this.scroll / this.maxScroll) * (ch - thumbH);
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.fillRect(px + pw - 5, ctop, 3, ch);
      ctx.fillStyle = 'rgba(0,255,255,0.4)';
      ctx.fillRect(px + pw - 5, thumbY, 3, thumbH);
    }
  }

  // ===== Tab 0: 快捷操作 =====
  _drawQuickTab(ctx, game, x, y, w) {
    const btnH = 38;
    const gap = 8;
    const cols = 2;
    const btnW = (w - gap) / cols;

    const btns = [
      { label: '⬆ 升10级', action: 'levelUp10', color: Config.NEON_GREEN },
      { label: '💣 清屏', action: 'clearBricks', color: Config.NEON_ORANGE },
      { label: game._devInvincible ? '🛡 无敌 ON' : '🛡 无敌 OFF', action: 'toggleInvincible', color: game._devInvincible ? Config.NEON_GREEN : '#666' },
      { label: game._devPauseFire ? '🔫 射击 OFF' : '🔫 射击 ON', action: 'togglePauseFire', color: game._devPauseFire ? '#FF5555' : Config.NEON_CYAN },
      { label: game._devPauseLevelUp ? '⬆ 升级 OFF' : '⬆ 升级 ON', action: 'togglePauseLevelUp', color: game._devPauseLevelUp ? '#FF5555' : Config.NEON_CYAN },
      { label: '💰 +1000金', action: 'addCoins', params: { amount: 1000 }, color: '#FFD700' },
      { label: '👹 召唤Boss', action: 'spawnBoss', color: Config.NEON_RED },
      { label: '💀 秒杀Boss', action: 'killBoss', color: Config.NEON_PINK },
      { label: '🚀 全武器满级', action: 'maxAllWeapons', color: '#FFD700' },
      { label: '🔄 重置全部', action: 'resetAll', color: '#FF5555' },
    ];

    let col = 0, rowY = y;
    for (const btn of btns) {
      const bx = x + col * (btnW + gap);
      this._drawBigBtn(ctx, btn.label, bx, rowY, btnW, btnH, btn.color,
        { action: btn.action, params: btn.params || {} });
      col++;
      if (col >= cols) { col = 0; rowY += btnH + gap; }
    }
    return rowY + (col > 0 ? btnH + gap : 0);
  }

  // ===== Tab 1: 武器管理 =====
  _drawWeaponTab(ctx, game, x, y, w) {
    const rowH = 32;
    let cy = y;

    for (const wk of Object.keys(Config.WEAPON_TREES)) {
      const wDef = Config.WEAPON_TREES[wk];
      const owned = game.upgrades.hasWeapon(wk);

      // 武器标题行
      ctx.fillStyle = owned ? wDef.color : '#555';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(wDef.icon + ' ' + wDef.name, x + 4, cy + rowH / 2);

      if (!owned) {
        this._drawBigBtn(ctx, '添加', x + w - 60, cy + 2, 56, rowH - 4, wDef.color,
          { action: 'addWeapon', params: { key: wk } });
      } else {
        this._drawBigBtn(ctx, '移除', x + w - 60, cy + 2, 56, rowH - 4, '#FF5555',
          { action: 'removeWeapon', params: { key: wk } });
      }
      cy += rowH + 2;

      // 分支（仅已拥有）
      if (owned) {
        const weapon = game.upgrades.weapons[wk];
        for (const bk in wDef.branches) {
          const bDef = wDef.branches[bk];
          const curLv = weapon.getBranch(bk);
          const maxLv = bDef.max;

          // 名称 + 等级
          ctx.fillStyle = curLv >= maxLv ? '#FFD700' : 'rgba(255,255,255,0.7)';
          ctx.font = '12px monospace';
          ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
          ctx.fillText(bDef.name, x + 12, cy + rowH / 2);

          // 等级点（更大）
          const dotX = x + 76;
          for (let d = 0; d < maxLv; d++) {
            ctx.fillStyle = d < curLv ? wDef.color : 'rgba(255,255,255,0.12)';
            ctx.beginPath();
            ctx.arc(dotX + d * 16, cy + rowH / 2, 4.5, 0, Math.PI * 2);
            ctx.fill();
          }

          // 按钮组: -1  +1  MAX
          const btnW2 = 34, btnH2 = rowH - 6, gap2 = 4;
          const startX = x + w - btnW2 * 3 - gap2 * 2;

          if (curLv > 0) {
            this._drawBigBtn(ctx, '-1', startX, cy + 3, btnW2, btnH2, '#FF5555',
              { action: 'downgradeWeaponBranch', params: { weaponKey: wk, branchKey: bk } });
          }
          if (curLv < maxLv) {
            this._drawBigBtn(ctx, '+1', startX + btnW2 + gap2, cy + 3, btnW2, btnH2, wDef.color,
              { action: 'upgradeWeaponBranch', params: { weaponKey: wk, branchKey: bk } });
            this._drawBigBtn(ctx, 'MAX', startX + (btnW2 + gap2) * 2, cy + 3, btnW2, btnH2, '#FFD700',
              { action: 'maxWeaponBranch', params: { weaponKey: wk, branchKey: bk } });
          }

          cy += rowH;
        }

        // 分隔线
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x, cy + 4); ctx.lineTo(x + w, cy + 4); ctx.stroke();
        cy += 10;
      }
    }
    return cy;
  }

  // ===== Tab 2: 飞机升级 =====
  _drawShipTab(ctx, game, x, y, w) {
    const rowH = 34;
    let cy = y;

    for (const sk in Config.SHIP_TREE) {
      const def = Config.SHIP_TREE[sk];
      const curLv = game.upgrades.getShipLevel(sk);
      const maxLv = def.max;

      // 名称
      ctx.fillStyle = curLv >= maxLv ? '#FFD700' : 'rgba(255,255,255,0.7)';
      ctx.font = '12px monospace';
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText((def.icon || '•') + ' ' + def.name, x + 4, cy + rowH / 2);

      // 等级数字
      ctx.fillStyle = curLv > 0 ? (def.color || Config.NEON_CYAN) : 'rgba(255,255,255,0.3)';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(curLv + '/' + maxLv, x + 100, cy + rowH / 2);

      // 等级点
      const dotX = x + 120;
      for (let d = 0; d < Math.min(maxLv, 5); d++) {
        ctx.fillStyle = d < curLv ? (def.color || Config.NEON_CYAN) : 'rgba(255,255,255,0.1)';
        ctx.beginPath();
        ctx.arc(dotX + d * 14, cy + rowH / 2, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      // 按钮组
      const btnW2 = 34, btnH2 = rowH - 6, gap2 = 4;
      const startX = x + w - btnW2 * 3 - gap2 * 2;

      if (curLv > 0) {
        this._drawBigBtn(ctx, '-1', startX, cy + 3, btnW2, btnH2, '#FF5555',
          { action: 'downgradeShip', params: { key: sk } });
      }
      if (curLv < maxLv) {
        this._drawBigBtn(ctx, '+1', startX + btnW2 + gap2, cy + 3, btnW2, btnH2, def.color || Config.NEON_CYAN,
          { action: 'upgradeShip', params: { key: sk } });
        this._drawBigBtn(ctx, 'MAX', startX + (btnW2 + gap2) * 2, cy + 3, btnW2, btnH2, '#FFD700',
          { action: 'maxShip', params: { key: sk } });
      }

      cy += rowH;
    }
    return cy;
  }

  // ===== 大按钮 =====
  _drawBigBtn(ctx, label, x, y, w, h, color, hitData) {
    // 背景
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 5); ctx.fill();
    // 边框
    ctx.strokeStyle = color; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 5); ctx.stroke();
    // 文字
    ctx.fillStyle = color;
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label, x + w / 2, y + h / 2);

    this._hitAreas.push({ x, y, w, h, action: hitData.action, params: hitData.params || {} });
  }
}

module.exports = DevPanel;
