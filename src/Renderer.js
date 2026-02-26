/**
 * Renderer.js - v5.0 组合层（原子化重构）
 * 所有渲染逻辑委托给 render/ 子模块
 */
const Config = require('./Config');
const SpriteCache = require('./SpriteCache');

// 子模块
const { drawBullets } = require('./render/BulletRenderer');
const { drawBrick, drawBricksBatch } = require('./render/BrickRenderer');
const { drawLauncher, drawWeaponWings } = require('./render/LauncherRenderer');
const { drawWeapons } = require('./render/WeaponRenderer');
const { drawBoss } = require('./render/BossRenderer');
const HUD = require('./render/HUDRenderer');
const UI = require('./render/UIRenderer');
const ChapterRenderer = require('./render/ChapterRenderer');

class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = Config.DPR;
    canvas.width = Config.CANVAS_WIDTH;
    canvas.height = Config.CANVAS_HEIGHT;
    this.ctx.scale(this.dpr, this.dpr);

    // 精灵缓存
    this.sprites = new SpriteCache();
    this.sprites.warmup();

    // 背景星空
    this.stars = [];
    for (let i = 0; i < 35; i++) {
      this.stars.push({
        x: Math.random() * Config.SCREEN_WIDTH,
        y: Math.random() * Config.SCREEN_HEIGHT,
        size: 0.5 + Math.random() * 1.5,
        speed: 0.1 + Math.random() * 0.3,
        alpha: 0.2 + Math.random() * 0.5,
        twinkle: Math.random() * Math.PI * 2,
      });
    }
    this._frameCount = 0;

    // 预渲染星空背景
    this._starCanvas = wx.createCanvas();
    this._starCanvas.width = Config.CANVAS_WIDTH;
    this._starCanvas.height = Config.CANVAS_HEIGHT;
    const starCtx = this._starCanvas.getContext('2d');
    starCtx.scale(this.dpr, this.dpr);
    for (let i = 0; i < this.stars.length; i++) {
      const s = this.stars[i];
      starCtx.globalAlpha = s.alpha;
      starCtx.fillStyle = '#FFFFFF';
      starCtx.fillRect(s.x, s.y, s.size, s.size);
    }
    this._starScrollY = 0;

    // 章节渲染器（带交互状态）
    this.chapter = new ChapterRenderer();

    // 暂停按钮区域
    this._pauseBtnArea = null;
    // 暂停对话框区域
    this._pauseDialogAreas = null;
  }

  // ===== 背景/星空 =====
  clear() {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = Config.BG_COLOR;
    ctx.fillRect(0, 0, Config.SCREEN_WIDTH, Config.SCREEN_HEIGHT);

    this._starScrollY = (this._starScrollY + 0.15) % Config.SCREEN_HEIGHT;
    const sy = this._starScrollY;
    ctx.globalAlpha = 0.6;
    ctx.drawImage(this._starCanvas, 0, 0, Config.CANVAS_WIDTH, Config.CANVAS_HEIGHT, 0, sy, Config.SCREEN_WIDTH, Config.SCREEN_HEIGHT);
    ctx.drawImage(this._starCanvas, 0, 0, Config.CANVAS_WIDTH, Config.CANVAS_HEIGHT, 0, sy - Config.SCREEN_HEIGHT, Config.SCREEN_WIDTH, Config.SCREEN_HEIGHT);
    ctx.globalAlpha = 1;
  }

  // ===== 委托到子模块 =====
  drawBullets(bullets) { drawBullets(this.ctx, this.sprites, bullets); }
  drawBrick(brick) { drawBrick(this.ctx, brick); }
  drawBricksBatch(bricks) { drawBricksBatch(this.ctx, bricks); }
  drawLauncher(launcher, upgrades) { drawLauncher(this.ctx, launcher, upgrades); }
  drawWeaponWings(weapons, launcher) { drawWeaponWings(this.ctx, weapons, launcher); }
  drawWeapons(weapons, launcher) { drawWeapons(this.ctx, this.sprites, weapons, launcher); }
  drawBoss(boss) { drawBoss(this.ctx, boss); }
  drawParticles(particles) { HUD.drawParticles(this.ctx, particles); }
  drawPowerUp(powerUp) { HUD.drawPowerUp(this.ctx, powerUp); }
  drawFloatingTexts(texts) { HUD.drawFloatingTexts(this.ctx, texts); }
  drawDangerLine(dangerY) { HUD.drawDangerLine(this.ctx, dangerY); }
  drawExpOrbs(orbs) { HUD.drawExpOrbs(this.ctx, this.sprites, orbs); }
  drawExpBar(exp, expToNext, playerLevel) { HUD.drawExpBar(this.ctx, exp, expToNext, playerLevel); }
  drawWeaponHUD(weaponList) { HUD.drawWeaponHUD(this.ctx, this.sprites, weaponList); }

  drawDamageStats(stats, expanded) { return HUD.drawDamageStats(this.ctx, stats, expanded); }

  drawChapterHUD(chapter, score, combo, playerLevel, elapsedMs, soundEnabled) {
    this._pauseBtnArea = HUD.drawChapterHUD(this.ctx, chapter, score, combo, playerLevel, elapsedMs, soundEnabled);
  }

  // ===== UI 界面 =====
  drawTitle() { UI.drawTitle(this.ctx); }
  handleAgeTipTap(tap) { return UI.handleAgeTipTap(tap); }
  drawLoading() { UI.drawLoading(this.ctx); }
  drawSkillChoice(choices, upgrades, title) { UI.drawSkillChoice(this.ctx, this.sprites, choices, upgrades, title); }
  drawGameOver(score, playerLevel, ownedList) { UI.drawGameOver(this.ctx, score, playerLevel, ownedList); }
  drawBossWarning(bossType) { UI.drawBossWarning(this.ctx, bossType); }

  drawPauseDialog() {
    this._pauseDialogAreas = UI.drawPauseDialog(this.ctx);
  }

  drawChapterClear(chapter, score, playerLevel, maxCombo, ownedList, coinsEarned, isFirstClear) {
    const areas = UI.drawChapterClear(this.ctx, chapter, score, playerLevel, maxCombo, ownedList, coinsEarned, isFirstClear);
    this.chapter._clearNextArea = areas.next;
    this.chapter._clearBackArea = areas.back;
  }

  // ===== 章节选择/商店（委托 ChapterRenderer） =====
  get _chapterScrollY() { return this.chapter.scrollY; }
  set _chapterScrollY(v) { this.chapter.scrollY = v; }
  get _chapterTabAreas() { return this.chapter._chapterTabAreas; }
  get _weaponDetailKey() { return this.chapter._weaponDetailKey; }
  set _weaponDetailKey(v) { this.chapter._weaponDetailKey = v; }
  get _weaponDetailTab() { return this.chapter._weaponDetailTab; }
  set _weaponDetailTab(v) { this.chapter._weaponDetailTab = v; }
  get _skillTreeScrollY() { return this.chapter._skillTreeScrollY; }
  set _skillTreeScrollY(v) { this.chapter._skillTreeScrollY = v; }

  drawChapterSelect(maxChapter, records, coins) { this.chapter.drawChapterSelect(this.ctx, maxChapter, records, coins); }
  drawUpgradeShop(saveManager) { this.chapter.drawUpgradeShop(this.ctx, saveManager); }
  drawWeaponShop(saveManager) { this.chapter.drawWeaponShop(this.ctx, saveManager); }

  getChapterSelectHit(tap) { return this.chapter.getChapterSelectHit(tap); }
  getUpgradeShopHit(tap) { return this.chapter.getUpgradeShopHit(tap); }
  getWeaponShopHit(tap) { return this.chapter.getWeaponShopHit(tap); }
  getChapterClearHit(tap) { return this.chapter.getChapterClearHit(tap); }

  getPauseDialogHit(tap) {
    if (!this._pauseDialogAreas) return null;
    const r = this._pauseDialogAreas.resume;
    if (tap.x >= r.x && tap.x <= r.x + r.w && tap.y >= r.y && tap.y <= r.y + r.h) return 'resume';
    const q = this._pauseDialogAreas.quit;
    if (tap.x >= q.x && tap.x <= q.x + q.w && tap.y >= q.y && tap.y <= q.y + q.h) return 'quit';
    return 'noop';
  }

  getPauseBtnHit(tap) {
    const a = this._pauseBtnArea;
    if (!a) return false;
    return tap.x >= a.x && tap.x <= a.x + a.w && tap.y >= a.y && tap.y <= a.y + a.h;
  }
}

module.exports = Renderer;
