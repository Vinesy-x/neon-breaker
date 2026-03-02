/**
 * AutoBattle.js - 自动战斗测试模块
 * 
 * 用法（开发者工具Console）：
 *   GameGlobal.__autoBattle()          → 默认DPS策略
 *   GameGlobal.__autoBattle('burst')   → 爆发策略（优先伤害）
 *   GameGlobal.__autoBattle('balanced')→ 均衡策略（雨露均沾）
 *   GameGlobal.__stopAuto()            → 停止
 * 
 * 倍速控制：
 *   GameGlobal.__setSpeed(3)           → 3倍速
 *   GameGlobal.__setSpeed(1)           → 恢复原速
 * 
 * 自动行为：智能巡航（优先最近砖列）、自动选技能、实时DPS、结束报告
 */

class AutoBattle {
  constructor(game, Config) {
    this.game = game;
    this.Config = Config;
    this.enabled = false;
    this.strategy = 'dps';
    this.moveSpeed = 4;
    this.reportInterval = 600;   // 每10秒（原速下）
    this.frameCount = 0;
    this.lastReportFrame = 0;
    this._autoChoiceDelay = 0;
    this._targetX = -1;          // 智能巡航目标X
    this._retargetCd = 0;        // 重新选目标冷却
    this._reported = false;
  }

  start(strategy) {
    this.strategy = strategy || 'dps';
    this.enabled = true;
    this.frameCount = 0;
    this.lastReportFrame = 0;
    this._targetX = -1;
    this._reported = false;
    console.log('🤖 AutoBattle ON | 策略: ' + this.strategy);
    console.log('   停止: GameGlobal.__stopAuto()');
    console.log('   倍速: GameGlobal.__setSpeed(N)  例: __setSpeed(3)');
  }

  stop() {
    this.enabled = false;
    // 恢复原速
    this.game._devTimeScale = 1;
    console.log('🤖 AutoBattle OFF（已恢复1x速度）');
    this._printReport();
  }

  setSpeed(n) {
    n = Math.max(0.5, Math.min(n || 1, 10));
    this.game._devTimeScale = n;
    console.log('🤖 倍速: ' + n + 'x');
  }

  update() {
    if (!this.enabled) return;
    this.frameCount++;
    var g = this.game;
    var state = g.state;

    // 自动移动（智能巡航）
    if (state === this.Config.STATE.PLAYING || state === this.Config.STATE.BOSS) {
      this._smartMove();
    }

    // 自动选技能
    if (state === this.Config.STATE.LEVEL_UP || state === this.Config.STATE.SKILL_CHOICE) {
      this._autoChoiceDelay++;
      // 沙盒模式下立即选择，不等延迟
      var choiceThreshold = this.game._devTimeScale > 1 ? 1 : 10;
      if (this._autoChoiceDelay > choiceThreshold) {
        this._autoSelectSkill();
        this._autoChoiceDelay = 0;
      }
    } else {
      this._autoChoiceDelay = 0;
    }

    // 自动过关结算
    // 关卡通关 → 打印报告并停止
    if (state === this.Config.STATE.CHAPTER_CLEAR || state === this.Config.STATE.CHAPTER_SELECT) {
      if (!this._reported) {
        this._reported = true;
        this.enabled = false;
        this.game._devTimeScale = 1;
        try { this._printReport(); } catch(e) { console.error('AutoBattle report error:', e); }
        console.log("🤖 AutoBattle: 关卡通关（已恢复1x速度）");
      }
      return;
    }








    // 定期DPS
    if (this.frameCount - this.lastReportFrame >= this.reportInterval) {
      this._printDPSSnapshot();
      this.lastReportFrame = this.frameCount;
    }

    // 游戏结束
    if (state === this.Config.STATE.GAME_OVER) {
      this.enabled = false;
      this.game._devTimeScale = 1;
      try { this._printReport(); } catch(e) { console.error('AutoBattle report error:', e); }
      console.log('🤖 AutoBattle: 游戏结束（已恢复1x速度）');
    }
  }

  /**
   * 智能巡航：找最靠近危险线的砖块列，移过去打
   * - 每30帧重新选目标
   * - Boss战时追踪Boss X
   */
  _smartMove() {
    var g = this.game;
    if (!g.launcher) return;
    var cx = g.launcher.getCenterX();
    var gw = g.gameWidth;
    var gh = g.gameHeight || 800;

    this._retargetCd--;

    // Boss战：追踪Boss中心 + 左右闪避
    if (g.state === this.Config.STATE.BOSS && g.boss) {
      var bx = g.boss.x + (g.boss.width || 0) / 2;
      // 小幅左右摆动避弹
      this._dodgePhase = (this._dodgePhase || 0) + 0.05;
      this._targetX = bx + Math.sin(this._dodgePhase) * 40;
      this._retargetCd = 3;
    }

    // smart策略：综合考虑危险+经验球+掉落物
    if (this._retargetCd <= 0) {
      if (this.strategy === 'smart') {
        this._targetX = this._smartTarget(g, cx);
      } else {
        this._targetX = this._findDangerousColumn(g);
      }
      this._retargetCd = 15; // 更频繁重选(原30)
    }

    // 移向目标
    if (this._targetX < 0) this._targetX = gw / 2;
    var dx = this._targetX - cx;
    var speed = this.moveSpeed;

    // 紧急闪避：如果有砖块快到底了，加速
    var urgentBrick = this._findUrgentBrick(g, cx, gh);
    if (urgentBrick) speed *= 1.5;

    if (Math.abs(dx) < speed) {
      g.launcher.setX(this._targetX);
    } else {
      g.launcher.setX(cx + (dx > 0 ? speed : -speed));
    }

    // 边界保护
    cx = g.launcher.getCenterX();
    if (cx < 20) g.launcher.setX(20);
    if (cx > gw - 20) g.launcher.setX(gw - 20);
  }

  /**
   * smart策略：综合目标选择
   * 权重：危险砖块60% + 砖块密集区20% + 经验球/掉落物20%
   */
  _smartTarget(g, cx) {
    var gw = g.gameWidth;
    var gh = g.gameHeight || 800;
    var cols = 8;
    var colW = gw / cols;
    var scores = [];
    for (var c = 0; c < cols; c++) scores[c] = 0;

    // 危险度评分：砖块越接近底部分越高
    var bricks = g.bricks || [];
    for (var i = 0; i < bricks.length; i++) {
      var b = bricks[i];
      if (b.dead) continue;
      var ci = Math.min(cols - 1, Math.max(0, Math.floor((b.x + (b.width||40)/2) / colW)));
      var danger = (b.y + (b.height||20)) / gh; // 0~1, 越大越危险
      scores[ci] += danger * danger * 60; // 二次方加权，底部砖块权重极高
    }

    // 经验球吸附：靠近经验球加分
    if (g.expSystem && g.expSystem.orbs) {
      for (var j = 0; j < g.expSystem.orbs.length; j++) {
        var orb = g.expSystem.orbs[j];
        var oci = Math.min(cols - 1, Math.max(0, Math.floor(orb.x / colW)));
        scores[oci] += 15; // 经验球吸引力
      }
    }

    // 掉落物吸附
    if (g.powerUps) {
      for (var k = 0; k < g.powerUps.length; k++) {
        var pu = g.powerUps[k];
        var pci = Math.min(cols - 1, Math.max(0, Math.floor(pu.x / colW)));
        scores[pci] += (pu.type === 'skillCrate' ? 40 : 10); // 宝箱高优先
      }
    }

    // 微调：略偏向当前位置（减少无意义抖动）
    var curCol = Math.min(cols - 1, Math.max(0, Math.floor(cx / colW)));
    scores[curCol] += 5;

    // 选最高分列
    var best = 0;
    for (var c2 = 1; c2 < cols; c2++) {
      if (scores[c2] > scores[best]) best = c2;
    }
    return (best + 0.5) * colW;
  }

  /**
   * 找紧急砖块：底部60px内有砖块就紧急
   */
  _findUrgentBrick(g, cx, gh) {
    var bricks = g.bricks || [];
    var dangerY = gh - 60;
    for (var i = 0; i < bricks.length; i++) {
      var b = bricks[i];
      if (!b.dead && b.y + (b.height||20) > dangerY) return b;
    }
    return null;
  }

  /**
   * 找最危险的列（最接近底部的砖块所在X位置）
   * 如果有多个同高度的，选砖块密度最高的列
   */
  _findDangerousColumn(g) {
    var bricks = g.bricks;
    if (!bricks || bricks.length === 0) return g.gameWidth / 2;

    // 把屏幕分成若干列，统计每列砖块的最大Y和数量
    var cols = 8;
    var colW = g.gameWidth / cols;
    var colMaxY = [];
    var colCount = [];
    var colCenterX = [];
    for (var c = 0; c < cols; c++) {
      colMaxY[c] = 0;
      colCount[c] = 0;
      colCenterX[c] = (c + 0.5) * colW;
    }

    for (var i = 0; i < bricks.length; i++) {
      var b = bricks[i];
      if (b.dead) continue;
      var ci = Math.floor((b.x + (b.width || 40) / 2) / colW);
      if (ci < 0) ci = 0;
      if (ci >= cols) ci = cols - 1;
      var by = b.y + (b.height || 20);
      if (by > colMaxY[ci]) colMaxY[ci] = by;
      colCount[ci]++;
    }

    // 找最危险的列：最大Y最大的；平手选数量多的
    var bestCol = 0, bestY = 0, bestCount = 0;
    for (var c2 = 0; c2 < cols; c2++) {
      if (colMaxY[c2] > bestY || (colMaxY[c2] === bestY && colCount[c2] > bestCount)) {
        bestY = colMaxY[c2];
        bestCount = colCount[c2];
        bestCol = c2;
      }
    }
    return colCenterX[bestCol];
  }

  _autoSelectSkill() {
    var g = this.game;
    var choices = g.pendingSkillChoices;
    if (!choices || choices.length === 0) return;

    var bestIdx = 0, bestScore = -Infinity;
    for (var i = 0; i < choices.length; i++) {
      var score = this._scoreChoice(choices[i]);
      if (score > bestScore) { bestScore = score; bestIdx = i; }
    }

    var picked = choices[bestIdx];
    console.log('🤖 选择: ' + picked.name + ' (Lv' + picked.level + '/' + picked.maxLevel + ') [' + picked.type + ']');

    g.upgrades.applyChoice(picked);
    g._syncLauncherStats();

    if (g._choiceSource === 'levelUp' && g.expSystem.hasPendingLevelUp()) {
      g.expSystem.consumeLevelUp();
      g.pendingSkillChoices = g.upgrades.generateChoices();
      if (g.pendingSkillChoices.length === 0) {
        g.state = g._preChoiceState || this.Config.STATE.PLAYING;
        g._preChoiceState = null;
      }
    } else {
      g.state = g._preChoiceState || this.Config.STATE.PLAYING;
      g._preChoiceState = null;
    }
  }

  _scoreChoice(choice) {
    var type = choice.type, key = choice.key, level = choice.level;

    if (this.strategy === 'burst') {
      if (type === 'newWeapon') return 100;
      if (key && key.includes('damage')) return 80 - level;
      if (type === 'weaponBranch') return 50 - level;
      if (type === 'shipBranch') return 30;
      return 10;
    }

    if (this.strategy === 'balanced') {
      if (type === 'newWeapon') return 90;
      return level === 1 ? 70 : (50 - level * 5);
    }

    // dps: 专注策略 — 优先把伤害类分支堆满，再铺面
    if (type === 'newWeapon') return 95;

    // 找当前伤害最低的武器，优先升它
    var focusBonus = 0;
    if (type === 'weaponBranch' && choice.weaponKey) {
      var g = this.game;
      var weapons = g.upgrades.weapons;
      var minLv = Infinity, minKey = null;
      for (var wk in weapons) {
        var w = weapons[wk];
        if (!w) continue;
        var dmgLv = w.branches.damage || 0;
        if (dmgLv < minLv) { minLv = dmgLv; minKey = wk; }
      }
      if (choice.weaponKey === minKey) focusBonus = 30;
    }

    if (type === 'weaponBranch') {
      if (key && key.includes('damage')) return 85 - level * 2 + focusBonus;
      if (key && (key.includes('count') || key.includes('salvo') || key.includes('bombs'))) return 70 - level * 3 + focusBonus;
      if (key && (key.includes('aoe') || key.includes('radius'))) return 65 - level * 3;
      return 50 - level * 3;
    }
    if (type === 'shipBranch') {
      if (key && key.includes('attack')) return 80 - level * 2;
      return 45 - level * 3;
    }
    return 20;
  }

  _autoTapClear() {
    var g = this.game;
    if (typeof g.startNextChapter === 'function') {
      g.startNextChapter();
    } else if (typeof g._startChapter === 'function') {
      g._startChapter(g.currentChapter + 1);
    }
  }

  _printDPSSnapshot() {
    var g = this.game;
    if (!g.damageStats) return;
    var elapsed = (g.elapsedMs || 1) / 1000;
    var stats = g.damageStats;
    var total = 0, lines = [];
    for (var name in stats) {
      total += stats[name];
      lines.push({ name: name, dps: stats[name] / elapsed });
    }
    lines.sort(function(a, b) { return b.dps - a.dps; });
    var lvl = g.expSystem ? g.expSystem.playerLevel : '?';
    var spd = g._devTimeScale || 1;
    console.log('📊 [' + elapsed.toFixed(0) + 's] ' + spd + 'x | Lv' + lvl + ' | 总DPS:' + (total / elapsed).toFixed(1) + ' | ' +
      lines.map(function(l) { return l.name + ':' + l.dps.toFixed(0); }).join(' '));
  }

  _printReport() {
    var g = this.game;
    if (!g.damageStats) return;
    var elapsed = (g.elapsedMs || 1) / 1000;
    var stats = g.damageStats;
    var total = 0, lines = [];
    for (var name in stats) {
      total += stats[name];
      lines.push({ name: name, dmg: stats[name] });
    }
    lines.sort(function(a, b) { return b.dmg - a.dmg; });

    console.log('');
    console.log('╔══════════════════════════════════════╗');
    console.log('║     🤖 AutoBattle 最终报告           ║');
    console.log('╚══════════════════════════════════════╝');
    console.log('  策略: ' + this.strategy);
    console.log('  时长: ' + elapsed.toFixed(0) + '秒');
    console.log('  等级: Lv' + (g.expSystem ? g.expSystem.playerLevel : '?'));
    console.log('  总伤: ' + total.toFixed(0));
    console.log('  总DPS: ' + (total / elapsed).toFixed(1));
    console.log('  ─────────────────────────────');
    for (var i = 0; i < lines.length; i++) {
      var l = lines[i];
      var pct = (l.dmg / total * 100).toFixed(1);
      var dps = (l.dmg / elapsed).toFixed(1);
      var bar = '';
      for (var b = 0; b < Math.round(l.dmg / total * 20); b++) bar += '█';
      console.log('  ' + padEnd(l.name, 10) + ' | ' + padStart(l.dmg.toFixed(0), 6) + ' (' + padStart(pct, 5) + '%) | DPS:' + padStart(dps, 6) + ' | ' + bar);
    }
    if (g.upgrades && g.upgrades.weaponLevels) {
      console.log('  ─────────────────────────────');
      console.log('  武器等级:');
      var owned = g.upgrades.getOwnedWeapons();
      for (var w = 0; w < owned.length; w++) {
        var wk = owned[w].key;
        var branches = g.upgrades.weaponLevels[wk] || {};
        var parts = [];
        for (var bk in branches) { if (branches[bk] > 0) parts.push(bk + ':' + branches[bk]); }
        console.log('    ' + owned[w].name + ' → ' + parts.join(', '));
      }
      console.log('  飞机升级:');
      var ship = g.upgrades.shipTree || {};
      var shipParts = [];
      for (var sk in ship) { if (ship[sk] > 0) shipParts.push(sk + ':' + ship[sk]); }
      console.log('    ' + (shipParts.join(', ') || '无'));
    }
    console.log('');
  }
}

function padEnd(s, n) { s = String(s); while (s.length < n) s += ' '; return s; }
function padStart(s, n) { s = String(s); while (s.length < n) s = ' ' + s; return s; }

module.exports = AutoBattle;
