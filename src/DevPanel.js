/**
 * DevPanel.js - 开发者工具面板 v2
 * Tab页签式布局，按钮更大，操作更方便
 */
const Config = require('./Config');
const DAMAGE_NAMES = require('./config/DamageNames');

class DevPanel {
  constructor() {
    this.open = false;
    this.tab = 0;           // 0=快捷 1=武器 2=飞机 3=永久 4=Boss测试
    this.scroll = 0;
    this.maxScroll = 0;
    this._hitAreas = [];
    this._btnArea = null;
    this._closeArea = null;
    this._tabAreas = [];

    // Boss测试参数
    this.bossTestType = 0;   // 0~4 对应5种Boss
    this.bossTestChapter = 1; // 测试章节

    // 跳关参数
    this.gotoChapter = 1;
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
      case 'addWeaponMax':
        if (!game.upgrades.hasWeapon(params.key)) {
          game.upgrades.addWeapon(params.key);
        }
        // 全分支满级
        { const weapon = game.upgrades.weapons[params.key];
          const tree = Config.WEAPON_TREES[params.key];
          if (weapon && tree) {
            for (const bk in tree.branches) weapon.branches[bk] = tree.branches[bk].max;
          }
        }
        game._syncLauncherStats();
        break;
      case 'maxAllBranches':
        { const weapon = game.upgrades.weapons[params.key];
          const tree = Config.WEAPON_TREES[params.key];
          if (weapon && tree) {
            for (const bk in tree.branches) weapon.branches[bk] = tree.branches[bk].max;
          }
        }
        game._syncLauncherStats();
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
        if (!game.boss || !game.boss.alive) {
          if (game.chapterConfig) {
            game._startBoss();
          } else {
            // 没在游戏中，用Boss测试入口
            game._startBossTest('charger', game.currentChapter || 1);
          }
        }
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
      case 'permUp':
        game.saveManager.setUpgrade(params.key, game.saveManager.getUpgrade(params.key) + 1);
        break;
      case 'permUp10':
        game.saveManager.setUpgrade(params.key, game.saveManager.getUpgrade(params.key) + 10);
        break;
      case 'permDown':
        game.saveManager.setUpgrade(params.key, game.saveManager.getUpgrade(params.key) - 1);
        break;
      case 'resetStats':
        game.damageStats = {};
        break;
      case 'cycleSpeed': {
        var speeds = [1, 2, 3, 5, 10];
        var cur = game._devTimeScale || 1;
        var idx = speeds.indexOf(cur);
        game._devTimeScale = speeds[(idx + 1) % speeds.length];
        break;
      }
      case 'bossTestTypeNext':
        this.bossTestType = (this.bossTestType + 1) % 5;
        break;
      case 'bossTestTypePrev':
        this.bossTestType = (this.bossTestType + 4) % 5;
        break;
      case 'bossTestChapterUp':
        this.bossTestChapter = Math.min(100, this.bossTestChapter + (params.amount || 1));
        break;
      case 'bossTestChapterDown':
        this.bossTestChapter = Math.max(1, this.bossTestChapter - (params.amount || 1));
        break;
      case 'startBossTest': {
        const bossTypes = ['charger', 'guardian', 'summoner', 'laser', 'phantom'];
        game._startBossTest(bossTypes[this.bossTestType], this.bossTestChapter);
        this.open = false; // 关闭面板开始测试
        break;
      }
      case 'gotoChapterUp':
        this.gotoChapter = Math.min(100, this.gotoChapter + (params.amount || 1));
        break;
      case 'gotoChapterDown':
        this.gotoChapter = Math.max(1, this.gotoChapter - (params.amount || 1));
        break;
      case 'gotoChapter':
        game.currentChapter = this.gotoChapter;
        // 自动解锁该章节前所有武器
        if (game.upgrades) {
          game.upgrades.setChapter(this.gotoChapter);
          var weaponUnlocks = { missile:3, meteor:6, drone:10, spinBlade:15, blizzard:25, ionBeam:40, frostStorm:55 };
          // 默认武器
          if (!game.upgrades.hasWeapon('kunai')) game.upgrades.addWeapon('kunai');
          if (!game.upgrades.hasWeapon('lightning')) game.upgrades.addWeapon('lightning');
          for (var wk in weaponUnlocks) {
            if (this.gotoChapter >= weaponUnlocks[wk] && !game.upgrades.hasWeapon(wk)) {
              game.upgrades.addWeapon(wk);
            }
          }
          // 根据章节给一些基础升级（模拟正常游戏进度）
          var totalLevels = Math.min(Math.floor(this.gotoChapter * 1.5), 50);
          var ownedWeapons = Object.keys(game.upgrades.weapons);
          for (var lv = 0; lv < totalLevels; lv++) {
            var rwk = ownedWeapons[lv % ownedWeapons.length];
            var weapon = game.upgrades.weapons[rwk];
            if (weapon) {
              // 找第一个能升的分支升一级
              var branches = Object.keys(weapon.def.branches);
              for (var bi = 0; bi < branches.length; bi++) {
                if (weapon.canUpgrade(branches[bi])) {
                  weapon.upgradeBranch(branches[bi]);
                  break;
                }
              }
            }
          }
          // 根据章节设置飞机等级
          if (game.upgrades.planeLevel !== undefined) {
            game.upgrades.planeLevel = Math.min(Math.floor(this.gotoChapter * 0.8) + 1, 30);
          }
        }
        // 更新存档最大章节
        if (game.saveManager && game.saveManager._data) {
          game.saveManager._data.maxChapter = Math.max(game.saveManager._data.maxChapter || 1, this.gotoChapter);
          game.saveManager.save();
        }
        game._initGame();
        this.open = false;
        break;
      case 'unlockAllChapters':
        game.saveManager._data.maxChapter = 100;
        game.saveManager.save();
        break;
      case 'balanceTest':
        // 平衡测试：70关，闪电链/无人机/离子射线/奇点引擎满级，飞机雷弹+输出满级
        this.gotoChapter = 70;
        game.currentChapter = 70;
        
        // 更新存档
        if (game.saveManager && game.saveManager._data) {
          game.saveManager._data.maxChapter = Math.max(game.saveManager._data.maxChapter || 1, 70);
          game.saveManager.save();
        }
        
        // 先初始化游戏（会reset武器）
        game._initGame();
        
        // 然后清空并添加测试武器
        game.upgrades.weapons = {};
        const testWeapons = ['lightning', 'drone', 'ionBeam', 'gravityWell'];
        for (const wk of testWeapons) {
          game.upgrades.addWeapon(wk);
          const weapon = game.upgrades.weapons[wk];
          const tree = Config.WEAPON_TREES[wk];
          if (weapon && tree) {
            for (const bk in tree.branches) {
              weapon.branches[bk] = tree.branches[bk].max;
            }
          }
        }
        
        // 飞机升级：雷弹满级 + 输出满级
        const shipUpgrades = ['thunder', 'damage', 'fireRate'];
        for (const sk of shipUpgrades) {
          const def = Config.SHIP_TREE[sk];
          if (def) {
            game.upgrades.shipTree[sk] = def.max;
          }
        }
        
        // 清统计
        game.damageStats = {};
        
        // 同步状态
        game._syncLauncherStats();
        this.open = false;
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
    const tabNames = ['⚡ 快捷', '🔪 武器', '✈ 飞机', '💎 永久', '👹 Boss'];
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
      ctx.font = 'bold 11px monospace';
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
      case 3: cy = this._drawPermTab(ctx, game, cx, cy, cw); break;
      case 4: cy = this._drawBossTestTab(ctx, game, cx, cy, cw); break;
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
    // ===== 基础属性面板 =====
    const baseAttack = game.getBaseAttack();
    const critBonus = game.saveManager ? game.saveManager.getCritBonus() : 0;
    const fireRateMult = game.upgrades ? game.upgrades.getFireRateMult() : 1;
    const fireRateBonus = game.saveManager ? game.saveManager.getFireRateBonus() : 0;
    const coinMult = game.saveManager ? game.saveManager.getCoinMultiplier() : 1;
    const expMult = game.saveManager ? game.saveManager.getExpMultiplier() : 1;

    ctx.fillStyle = 'rgba(0,255,255,0.1)';
    ctx.beginPath(); ctx.roundRect(x, y, w, 72, 6); ctx.fill();
    ctx.strokeStyle = 'rgba(0,255,255,0.3)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(x, y, w, 72, 6); ctx.stroke();

    ctx.fillStyle = Config.NEON_CYAN;
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText('📊 基础属性', x + 8, y + 6);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '11px monospace';
    const col1 = x + 8, col2 = x + w / 2 + 4;
    const row1 = y + 22, row2 = y + 38, row3 = y + 54;

    ctx.fillText(`⚔ 攻击: ${baseAttack}`, col1, row1);
    ctx.fillText(`🎯 暴击: +${(critBonus * 100).toFixed(0)}%`, col2, row1);
    ctx.fillText(`🔫 射速: ×${(fireRateMult * (1 + fireRateBonus)).toFixed(2)}`, col1, row2);
    ctx.fillText(`💰 金币: ×${coinMult.toFixed(2)}`, col2, row2);
    ctx.fillText(`⭐ 经验: ×${expMult.toFixed(2)}`, col1, row3);

    y += 80;

    // ===== 伤害统计面板 =====
    const stats = game.damageStats || {};
    const entries = Object.entries(stats).sort((a, b) => b[1] - a[1]);
    const totalDmg = entries.reduce((sum, e) => sum + e[1], 0);

    if (totalDmg > 0) {
      const nameMap = DAMAGE_NAMES;
      const statH = 20 + entries.length * 16;
      ctx.fillStyle = 'rgba(255,100,100,0.1)';
      ctx.beginPath(); ctx.roundRect(x, y, w, statH, 6); ctx.fill();
      ctx.strokeStyle = 'rgba(255,100,100,0.3)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect(x, y, w, statH, 6); ctx.stroke();

      ctx.fillStyle = Config.NEON_RED;
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText(`⚔ 伤害统计 (总: ${this._formatNum(totalDmg)})`, x + 8, y + 4);

      let statY = y + 20;
      ctx.font = '10px monospace';
      for (const [src, dmg] of entries) {
        const pct = ((dmg / totalDmg) * 100).toFixed(1);
        const barW = (dmg / totalDmg) * (w - 100);
        // 进度条
        ctx.fillStyle = 'rgba(255,100,100,0.3)';
        ctx.fillRect(x + 80, statY + 2, barW, 10);
        // 文字
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'left';
        ctx.fillText(nameMap[src] || src, x + 8, statY);
        ctx.textAlign = 'right';
        ctx.fillText(`${this._formatNum(dmg)} (${pct}%)`, x + w - 8, statY);
        statY += 16;
      }
      y += statH + 8;
    }

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
      { label: '📊 清统计', action: 'resetStats', color: '#888888' },
      { label: `⏩ 速度 ×${game._devTimeScale || 1}`, action: 'cycleSpeed', color: (game._devTimeScale || 1) > 1 ? Config.NEON_YELLOW : '#888888' },
      { label: '🔓 解锁全关', action: 'unlockAllChapters', color: '#FFD700' },
      { label: '⚖ 平衡测试', action: 'balanceTest', color: '#FF00FF' },
    ];

    let col = 0, rowY = y;
    for (const btn of btns) {
      const bx = x + col * (btnW + gap);
      this._drawBigBtn(ctx, btn.label, bx, rowY, btnW, btnH, btn.color,
        { action: btn.action, params: btn.params || {} });
      col++;
      if (col >= cols) { col = 0; rowY += btnH + gap; }
    }
    rowY += (col > 0 ? btnH + gap : 0);

    // 跳关控件
    rowY += 8;
    ctx.fillStyle = 'rgba(255,200,0,0.1)';
    ctx.beginPath(); ctx.roundRect(x, rowY, w, 44, 6); ctx.fill();
    ctx.strokeStyle = 'rgba(255,200,0,0.3)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(x, rowY, w, 44, 6); ctx.stroke();

    ctx.fillStyle = Config.NEON_YELLOW;
    ctx.font = 'bold 12px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText('🚀 跳关: 第 ' + this.gotoChapter + ' 章', x + 10, rowY + 22);

    const smallBtnW = 32, smallBtnH = 28;
    // -10
    this._drawBigBtn(ctx, '-10', x + w - smallBtnW * 4 - 24, rowY + 8, smallBtnW, smallBtnH, '#888',
      { action: 'gotoChapterDown', params: { amount: 10 } });
    // -1
    this._drawBigBtn(ctx, '-1', x + w - smallBtnW * 3 - 18, rowY + 8, smallBtnW, smallBtnH, '#888',
      { action: 'gotoChapterDown', params: { amount: 1 } });
    // +1
    this._drawBigBtn(ctx, '+1', x + w - smallBtnW * 2 - 12, rowY + 8, smallBtnW, smallBtnH, Config.NEON_CYAN,
      { action: 'gotoChapterUp', params: { amount: 1 } });
    // +10
    this._drawBigBtn(ctx, '+10', x + w - smallBtnW - 6, rowY + 8, smallBtnW, smallBtnH, Config.NEON_CYAN,
      { action: 'gotoChapterUp', params: { amount: 10 } });

    rowY += 52;
    this._drawBigBtn(ctx, '🚀 解锁至第 ' + this.gotoChapter + ' 章', x, rowY, w, btnH, Config.NEON_YELLOW,
      { action: 'gotoChapter', params: {} });

    return rowY + btnH + gap;
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
        this._drawBigBtn(ctx, '添加', x + w - 120, cy + 2, 56, rowH - 4, wDef.color,
          { action: 'addWeapon', params: { key: wk } });
        this._drawBigBtn(ctx, '满级', x + w - 60, cy + 2, 56, rowH - 4, '#FFD700',
          { action: 'addWeaponMax', params: { key: wk } });
      } else {
        this._drawBigBtn(ctx, '满级', x + w - 120, cy + 2, 56, rowH - 4, '#FFD700',
          { action: 'maxAllBranches', params: { key: wk } });
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

  // ===== Tab 3: 永久升级 =====
  _drawPermTab(ctx, game, x, y, w) {
    const rowH = 36;
    const permUpgrades = [
      { key: 'attack', name: '⚔ 攻击', desc: 'baseAttack +1' },
      { key: 'fireRate', name: '🔫 射速', desc: '+2%射速' },
      { key: 'crit', name: '🎯 暴击', desc: '+1%暴击率' },
      { key: 'startLevel', name: '⬆ 初始等级', desc: '起始等级+1' },
      { key: 'coinBonus', name: '💰 金币', desc: '+5%金币' },
      { key: 'expBonus', name: '⭐ 经验', desc: '+3%经验' },
    ];

    ctx.fillStyle = 'rgba(255,215,0,0.15)';
    ctx.beginPath(); ctx.roundRect(x, y, w, 36, 6); ctx.fill();
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('💎 永久升级 (存档)', x + w / 2, y + 18);
    y += 44;

    for (const u of permUpgrades) {
      const curLv = game.saveManager.getUpgrade(u.key);

      // 名称
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.font = '12px monospace';
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(u.name, x + 4, y + rowH / 2);

      // 等级
      ctx.fillStyle = curLv > 0 ? '#FFD700' : 'rgba(255,255,255,0.3)';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Lv.' + curLv, x + 100, y + rowH / 2);

      // 按钮
      const btnW2 = 34, btnH2 = rowH - 8, gap2 = 4;
      const startX = x + w - btnW2 * 3 - gap2 * 2;

      if (curLv > 0) {
        this._drawBigBtn(ctx, '-1', startX, y + 4, btnW2, btnH2, '#FF5555',
          { action: 'permDown', params: { key: u.key } });
      }
      this._drawBigBtn(ctx, '+1', startX + btnW2 + gap2, y + 4, btnW2, btnH2, '#FFD700',
        { action: 'permUp', params: { key: u.key } });
      this._drawBigBtn(ctx, '+10', startX + (btnW2 + gap2) * 2, y + 4, btnW2, btnH2, '#FFA500',
        { action: 'permUp10', params: { key: u.key } });

      y += rowH;
    }
    return y;
  }

  // ===== Tab 4: Boss 测试 =====
  _drawBossTestTab(ctx, game, x, y, w) {
    const bossTypes = ['charger', 'guardian', 'summoner', 'laser', 'phantom'];
    const bossNames = ['冲锋者', '护盾卫士', '召唤师', '激光炮台', '幽影刺客'];
    const bossIcons = ['🔴', '🔵', '🟣', '🟡', '⚪'];
    const bossColors = ['#FF3333', '#4488FF', '#AA44FF', '#FFF050', '#DDDDDD'];

    const btnH = 38, gap = 8;

    // ===== Boss 类型选择 =====
    ctx.fillStyle = 'rgba(255,100,100,0.15)';
    ctx.beginPath(); ctx.roundRect(x, y, w, 90, 6); ctx.fill();
    ctx.strokeStyle = 'rgba(255,100,100,0.3)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(x, y, w, 90, 6); ctx.stroke();

    ctx.fillStyle = Config.NEON_RED;
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText('👹 Boss 类型', x + 8, y + 6);

    // 当前Boss名
    ctx.fillStyle = bossColors[this.bossTestType];
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(bossIcons[this.bossTestType] + ' ' + bossNames[this.bossTestType], x + w / 2, y + 40);

    // 英文类型名
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '10px monospace';
    ctx.fillText(bossTypes[this.bossTestType], x + w / 2, y + 58);

    // 左右切换按钮
    const arrowW = 50, arrowH = 34;
    this._drawBigBtn(ctx, '◀', x + 8, y + 50, arrowW, arrowH, bossColors[this.bossTestType],
      { action: 'bossTestTypePrev', params: {} });
    this._drawBigBtn(ctx, '▶', x + w - arrowW - 8, y + 50, arrowW, arrowH, bossColors[this.bossTestType],
      { action: 'bossTestTypeNext', params: {} });

    y += 98;

    // ===== 章节难度选择 =====
    const curType = bossTypes[this.bossTestType];
    const cycle = Math.floor((this.bossTestChapter - 1) / 5);
    const hpMult = (1.0 + (this.bossTestChapter - 1) * 0.12).toFixed(2);

    // Boss参数预览
    const baseHpMap = { charger: 300, guardian: 350, summoner: 250, laser: 400, phantom: 280 };
    const baseHp = baseHpMap[curType] || 300;
    const finalHp = Math.floor(baseHp * parseFloat(hpMult));

    ctx.fillStyle = 'rgba(255,215,0,0.12)';
    ctx.beginPath(); ctx.roundRect(x, y, w, 112, 6); ctx.fill();
    ctx.strokeStyle = 'rgba(255,215,0,0.3)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(x, y, w, 112, 6); ctx.stroke();

    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText('📊 难度设置', x + 8, y + 6);

    // 章节数字
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 22px monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('第 ' + this.bossTestChapter + ' 章', x + w / 2, y + 34);

    // 参数信息
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('HP: ' + finalHp + '  |  周期: ' + cycle + '  |  倍率: ×' + hpMult, x + w / 2, y + 56);

    // 章节+-按钮行
    const cBtnW = (w - gap * 5) / 4;
    const cBtnY = y + 70;
    this._drawBigBtn(ctx, '-10', x + gap, cBtnY, cBtnW, 34, '#FF5555',
      { action: 'bossTestChapterDown', params: { amount: 10 } });
    this._drawBigBtn(ctx, '-1', x + gap * 2 + cBtnW, cBtnY, cBtnW, 34, '#FF8888',
      { action: 'bossTestChapterDown', params: { amount: 1 } });
    this._drawBigBtn(ctx, '+1', x + gap * 3 + cBtnW * 2, cBtnY, cBtnW, 34, '#88FF88',
      { action: 'bossTestChapterUp', params: { amount: 1 } });
    this._drawBigBtn(ctx, '+10', x + gap * 4 + cBtnW * 3, cBtnY, cBtnW, 34, '#50FFB4',
      { action: 'bossTestChapterUp', params: { amount: 10 } });

    y += 120;

    // ===== Boss特性说明 =====
    const bossDesc = {
      charger: ['🔴 冲锋者 Charger', '周期性冲锋↓，冲锋中受-50%伤', '撞停后1秒受2倍伤害（弱点窗口）', 'cycle≥1: 冲锋留火焰地带'],
      guardian: ['🔵 护盾卫士 Guardian', '旋转护盾挡子弹，护盾有独立HP', '护盾全碎→5秒弱点期(1.5倍伤)', 'cycle≥1: 3个护盾, cycle≥3: 快速再生'],
      summoner: ['🟣 召唤师 Summoner', '每4-5秒召唤一排砖块', '召唤时2秒无敌（无法受伤）', 'cycle≥2: 混合砖块, cycle≥3: 召唤两排'],
      laser: ['🟡 激光炮台 Laser', '充能→发射激光柱（消灭子弹）', '充能期间受3倍伤害（最大弱点）', 'cycle≥1: 留灼烧带, cycle≥2: 双炮管'],
      phantom: ['⚪ 幽影刺客 Phantom', '随机闪现，出现瞬间受2倍伤', '消失中完全无敌，移速×1.5', 'cycle≥1: 留残影, cycle≥2: 分裂砖块'],
    };

    const desc = bossDesc[curType] || [];
    const descH = 20 + desc.length * 18;
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.beginPath(); ctx.roundRect(x, y, w, descH, 6); ctx.fill();

    ctx.fillStyle = bossColors[this.bossTestType];
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    if (desc.length > 0) ctx.fillText(desc[0], x + 8, y + 4);

    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '10px monospace';
    for (let i = 1; i < desc.length; i++) {
      ctx.fillText(desc[i], x + 8, y + 4 + i * 18);
    }
    y += descH + gap;

    // ===== 开始测试按钮 =====
    this._drawBigBtn(ctx, '⚔ 开始 Boss 测试', x, y, w, 48, bossColors[this.bossTestType],
      { action: 'startBossTest', params: {} });
    y += 56;

    // 快捷：当前状态提示
    if (game.boss && game.boss.alive) {
      ctx.fillStyle = 'rgba(255,50,50,0.15)';
      ctx.beginPath(); ctx.roundRect(x, y, w, 36, 6); ctx.fill();
      ctx.fillStyle = Config.NEON_RED;
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const bossHpPct = ((game.boss.hp / game.boss.maxHp) * 100).toFixed(1);
      ctx.fillText('⚠ Boss战斗中: ' + game.boss.type + ' HP ' + bossHpPct + '%', x + w / 2, y + 18);
      y += 44;

      this._drawBigBtn(ctx, '💀 秒杀当前Boss', x, y, w, btnH, '#FF5555',
        { action: 'killBoss', params: {} });
      y += btnH + gap;
    } else if (game.state !== Config.STATE.PLAYING && game.state !== Config.STATE.BOSS) {
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.beginPath(); ctx.roundRect(x, y, w, 36, 6); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.font = '11px monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('💡 先进入游戏再测试Boss', x + w / 2, y + 18);
      y += 44;
    }

    return y;
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

  _formatNum(n) {
    n = Math.ceil(n);
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return n.toString();
  }
}

module.exports = DevPanel;
