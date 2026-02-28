/**
 * AutoBattle.js - 自动战斗测试模块
 * 
 * 用法（开发者工具Console）：
 *   GameGlobal.__autoBattle()          → 默认DPS策略
 *   GameGlobal.__autoBattle('burst')   → 爆发策略（优先伤害）
 *   GameGlobal.__autoBattle('balanced')→ 均衡策略（雨露均沾）
 *   GameGlobal.__stopAuto()            → 停止
 * 
 * 自动行为：飞机巡航、自动选技能、实时DPS、结束报告
 */

class AutoBattle {
  constructor(game, Config) {
    this.game = game;
    this.Config = Config;
    this.enabled = false;
    this.strategy = 'dps';
    this.moveDir = 1;
    this.moveSpeed = 3;
    this.moveTimer = 0;
    this.changeInterval = 60;
    this.reportInterval = 600;   // 每10秒
    this.frameCount = 0;
    this.lastReportFrame = 0;
    this._autoChoiceDelay = 0;
  }

  start(strategy) {
    this.strategy = strategy || 'dps';
    this.enabled = true;
    this.frameCount = 0;
    this.lastReportFrame = 0;
    console.log('🤖 AutoBattle ON | 策略: ' + this.strategy);
    console.log('   停止: GameGlobal.__stopAuto()');
  }

  stop() {
    this.enabled = false;
    console.log('🤖 AutoBattle OFF');
    this._printReport();
  }

  update() {
    if (!this.enabled) return;
    this.frameCount++;
    var g = this.game;
    var state = g.state;

    // 自动移动
    if (state === this.Config.STATE.PLAYING || state === this.Config.STATE.BOSS) {
      this._autoMove();
    }

    // 自动选技能
    if (state === this.Config.STATE.LEVEL_UP || state === this.Config.STATE.SKILL_CHOICE) {
      this._autoChoiceDelay++;
      if (this._autoChoiceDelay > 10) {
        this._autoSelectSkill();
        this._autoChoiceDelay = 0;
      }
    } else {
      this._autoChoiceDelay = 0;
    }

    // 自动过关结算
    if (state === this.Config.STATE.CHAPTER_CLEAR) {
      this._autoChoiceDelay++;
      if (this._autoChoiceDelay > 30) {
        this._autoTapClear();
        this._autoChoiceDelay = 0;
      }
    }

    // 定期DPS
    if (this.frameCount - this.lastReportFrame >= this.reportInterval) {
      this._printDPSSnapshot();
      this.lastReportFrame = this.frameCount;
    }

    // 游戏结束
    if (state === this.Config.STATE.GAME_OVER) {
      this._printReport();
      this.enabled = false;
      console.log('🤖 AutoBattle: 游戏结束');
    }
  }

  _autoMove() {
    var g = this.game;
    if (!g.launcher) return;
    this.moveTimer++;
    if (this.moveTimer >= this.changeInterval) {
      this.moveDir *= -1;
      this.moveTimer = 0;
      this.changeInterval = 40 + Math.floor(Math.random() * 40);
    }
    var cx = g.launcher.getCenterX();
    if (cx < 30 || cx > g.gameWidth - 30) this.moveDir *= -1;
    g.launcher.setX(cx + this.moveDir * this.moveSpeed);
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

    // 直接调用升级逻辑
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

    // dps: 模拟最优DPS
    if (type === 'newWeapon') return 95;
    if (type === 'weaponBranch') {
      if (key && key.includes('damage')) return 85 - level * 2;
      if (key && (key.includes('count') || key.includes('salvo') || key.includes('storm') || key.includes('bombs'))) return 75 - level * 3;
      if (key && (key.includes('aoe') || key.includes('radius') || key.includes('giant'))) return 70 - level * 3;
      return 55 - level * 3;
    }
    if (type === 'shipBranch') {
      if (key && (key.includes('attack') || key.includes('fireRate'))) return 60 - level * 3;
      return 40 - level * 3;
    }
    return 20;
  }

  _autoTapClear() {
    var g = this.game;
    // 尝试调用下一章逻辑
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
    console.log('📊 [' + elapsed.toFixed(0) + 's] Lv' + lvl + ' | 总DPS:' + (total / elapsed).toFixed(1) + ' | ' +
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
    // 武器等级
    if (g.upgrades) {
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
