/**
 * UIController.js - UI交互控制器
 * 管理非战斗场景的UI交互：章节选择、升级商店、武器商店、暂停、结算
 * 从 Game.js 提取
 */
const Config = require('../Config');
const Sound = require('./SoundManager');

class UIController {
  constructor(game) {
    this.game = game;
  }

  // ===== 章节选择 =====

  updateChapterSelect() {
    var g = this.game;
    const maxChapter = g.saveManager.getMaxChapter();
    const nodeSpacing = 110;
    const contentH = 100 * nodeSpacing + 100;
    const viewH = Config.SCREEN_HEIGHT - Config.SAFE_TOP - 32 - 44 - Config.SAFE_BOTTOM - 10;
    const maxScroll = Math.max(0, contentH - viewH);

    let scrollY = g.renderer._chapterScrollY || 0;

    if (!g._scrolling) {
      scrollY += g._scrollVelocity;
      g._scrollVelocity *= 0.92;
      if (Math.abs(g._scrollVelocity) < 0.3) g._scrollVelocity = 0;
      if (scrollY < 0) {
        scrollY += (0 - scrollY) * 0.2;
        if (scrollY > -0.5) scrollY = 0;
        g._scrollVelocity = 0;
      } else if (scrollY > maxScroll) {
        scrollY += (maxScroll - scrollY) * 0.2;
        if (scrollY < maxScroll + 0.5) scrollY = maxScroll;
        g._scrollVelocity = 0;
      }
    }

    g.renderer._chapterScrollY = scrollY;

    var t = g.input.consumeTap();
    if (!t) return;
    var r = g.renderer.getChapterSelectHit(t);
    if (r === 'upgrade') g.state = Config.STATE.UPGRADE_SHOP;
    else if (r === 'weapon') { g.renderer._weaponDetailKey = null; g.state = Config.STATE.WEAPON_SHOP; }
    else if (r === 'sound') Sound.toggle();
    else if (typeof r === 'number' && r > 0 && r <= maxChapter) { g.currentChapter = r; g._initGame(); }
  }

  // ===== 升级商店 =====

  updateUpgradeShop() {
    var g = this.game;
    var t = g.input.consumeTap();
    if (!t) return;
    if (g.renderer._chapterTabAreas) {
      var tabs = g.renderer._chapterTabAreas;
      if (tabs.battle && t.x >= tabs.battle.x && t.x <= tabs.battle.x + tabs.battle.w && t.y >= tabs.battle.y && t.y <= tabs.battle.y + tabs.battle.h) {
        g.state = Config.STATE.CHAPTER_SELECT; return;
      }
      if (tabs.weapon && t.x >= tabs.weapon.x && t.x <= tabs.weapon.x + tabs.weapon.w && t.y >= tabs.weapon.y && t.y <= tabs.weapon.y + tabs.weapon.h) {
        g.renderer._weaponDetailKey = null; g.state = Config.STATE.WEAPON_SHOP; return;
      }
    }
    var r = g.renderer.getUpgradeShopHit(t);
    if (r && typeof r === 'string') { if (g.saveManager.upgradeLevel(r)) Sound.selectSkill(); }
  }

  // ===== 武器商店 =====

  updateWeaponShop() {
    var g = this.game;
    var t = g.input.consumeTap();
    if (!t) return;
    var r = g.renderer.getWeaponShopHit(t);
    if (!r) return;
    if (r.action === 'tab') {
      if (r.tabIdx !== undefined) {
        g.renderer._weaponDetailTab = r.tabIdx;
        g.renderer._skillTreeScrollY = 0;
      } else if (r.tab === 'battle') g.state = Config.STATE.CHAPTER_SELECT;
      else if (r.tab === 'upgrade') g.state = Config.STATE.UPGRADE_SHOP;
    } else if (r.action === 'detail') {
      g.renderer._weaponDetailKey = r.key;
      g.renderer._weaponDetailTab = 0;
      g.renderer._skillTreeScrollY = 0;
    } else if (r.action === 'close') {
      g.renderer._weaponDetailKey = null;
    } else if (r.action === 'upgrade') {
      if (g.saveManager.upgradeWeapon(r.key)) Sound.selectSkill();
    }
  }

  // ===== 暂停 =====

  updatePaused() {
    var g = this.game;
    var t = g.input.consumeTap();
    if (!t) return;
    var r = g.renderer.getPauseDialogHit(t);
    if (r === 'resume') {
      g.state = g._pausedFrom || Config.STATE.PLAYING;
    } else if (r === 'quit') {
      g.state = Config.STATE.CHAPTER_SELECT;
    }
  }

  // ===== 章节通关 =====

  updateChapterClear() {
    var g = this.game;
    var t = g.input.consumeTap();
    if (!t) return;
    var r = g.renderer.getChapterClearHit(t);
    if (r === 'next') {
      g.currentChapter = Math.min(g.currentChapter + 1, g.saveManager.getMaxChapter());
      g._initGame();
    } else if (r === 'back') {
      g.state = Config.STATE.CHAPTER_SELECT;
    }
  }

  // ===== 游戏结束 =====

  updateGameOver() {
    var g = this.game;
    var t = g.input.consumeTap();
    if (!t) return;
    var coins = Math.floor((g.chapterConfig ? g.chapterConfig.clearReward : 0) * 0.3 * g.saveManager.getCoinMultiplier()) + Math.min(50, Math.floor(g.bricksDestroyed / 100));
    if (coins > 0) g.saveManager.addCoins(coins);
    g.state = Config.STATE.CHAPTER_SELECT;
  }

  // ===== 技能选择 =====

  updateSkillChoice() {
    var g = this.game;
    var t = g.input.consumeTap();
    if (t && g.pendingSkillChoices.length > 0) {
      for (var i = 0; i < g.pendingSkillChoices.length; i++) {
        var ch = g.pendingSkillChoices[i];
        if (!ch._hitArea) continue;
        var ha = ch._hitArea;
        if (t.x >= ha.x && t.x <= ha.x + ha.w && t.y >= ha.y && t.y <= ha.y + ha.h) {
          Sound.selectSkill();
          g.upgrades.applyChoice(ch);
          g._syncLauncherStats();
          if (g._choiceSource === 'levelUp' && g.expSystem.hasPendingLevelUp()) {
            g.expSystem.consumeLevelUp();
            g.pendingSkillChoices = g.upgrades.generateChoices();
            if (g.pendingSkillChoices.length === 0) {
              g.state = g._preChoiceState || Config.STATE.PLAYING;
              g._preChoiceState = null;
            }
          } else {
            g.state = g._preChoiceState || Config.STATE.PLAYING;
            g._preChoiceState = null;
          }
          return;
        }
      }
    }
  }
}

module.exports = UIController;
