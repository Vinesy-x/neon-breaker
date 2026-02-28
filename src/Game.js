/**
 * Game.js - v8.0 主游戏循环（重构版）
 * 只保留：状态机、初始化、主循环调度、渲染调度、UI交互
 * 战斗/碰撞/元素/DOT 逻辑委托给对应 System
 *
 * v8.0: 从 817 行上帝类拆分为 4 个系统模块
 *   - CombatSystem: 伤害计算、子弹发射、砖块/Boss受击、掉落
 *   - CollisionSystem: 子弹碰撞、危险线、砖块融合、掉落物碰撞
 *   - ElementSystem: 火/冰/雷元素效果
 *   - DotSystem: 持续伤害（灼烧/感电/通用DOT）
 */
const Config = require('./Config');
const Launcher = require('./Launcher');
const BrickFactory = require('./BrickFactory');
const ChapterConfig = require('./ChapterConfig');
const { createBoss } = require('./BossFactory');
const SaveManager = require('./systems/SaveManager');
const { ParticleManager } = require('./Particle');
const UpgradeManager = require('./systems/UpgradeManager');
const ExpSystem = require('./systems/ExpSystem');
const Renderer = require('./Renderer');
const InputManager = require('./input/InputManager');
const Sound = require('./systems/SoundManager');
const DevPanel = require('./DevPanel');

// 系统模块
const CombatSystem = require('./systems/CombatSystem');
const CollisionSystem = require('./systems/CollisionSystem');
const ElementSystem = require('./systems/ElementSystem');
const DotSystem = require('./systems/DotSystem');
const UIController = require('./systems/UIController');

class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new Renderer(canvas);
    this.input = new InputManager();
    this.gameWidth = Config.SCREEN_WIDTH;
    this.gameHeight = Config.SCREEN_HEIGHT;

    // 游戏状态
    this.state = Config.STATE.LOADING;
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.comboTimer = 0;

    // 游戏对象
    this.bullets = [];
    this.bricks = [];
    this.launcher = null;
    this.particles = new ParticleManager();
    this.powerUps = [];
    this.boss = null;
    this.floatingTexts = [];
    this.screenShake = 0;
    this.shakeCooldown = 0; // 震动冷却（帧数）

    // 持久系统
    this.saveManager = new SaveManager();
    this.saveManager.initCloud('cloud1-0gnbjg5o5d331b5c');
    this.upgrades = new UpgradeManager(this.saveManager);
    this.expSystem = new ExpSystem();

    // 战斗系统（初始化顺序：element/dot 先于 combat，因为 combat 依赖它们）
    this.elementSystem = new ElementSystem(this);
    this.dotSystem = new DotSystem(this);
    this.combat = new CombatSystem(this);
    this.collision = new CollisionSystem(this);
    this.ui = new UIController(this);

    // 计时器 & 状态
    this.fireTimer = 0;
    this.pendingSkillChoices = [];
    this._refreshCount = 0;       // 本局已用刷新次数
    this._maxFreeRefresh = 1;     // 免费刷新次数
    this._maxAdRefresh = 3;       // 广告刷新次数
    this._adRefreshUsed = 0;      // 已用广告刷新次数
    this._preChoiceState = null;
    this._choiceSource = null;
    this.lastCrateTime = 0;

    // 章节
    this.currentChapter = 1;
    this.chapterConfig = null;
    this.elapsedMs = 0;
    this.currentPhase = null;
    this.coinsEarned = 0;
    this.bricksDestroyed = 0;
    this.spawnTimer = 0;
    this.bossWarningTimer = 0;
    this.bossTriggered = false;

    // 帧控制
    this.lastTime = 0;
    this.loadTimer = 60;

    // Dev
    this._devInvincible = false;
    this._devPauseFire = false;
    this._devPauseLevelUp = false;
    this.devPanel = Config.DEV_MODE ? new DevPanel() : null;
    this.damageStats = {};
    this.statsExpanded = false;
    this._statsArea = null;

    // 章节滚动
    this._scrollVelocity = 0;
    this._scrolling = false;

    // 统一弹性滑动系统
    // _scrollVelocity 统一为"向上滑=正值（scrollY增大）"
    this.input.onDragY = (dy) => {
      if (this.devPanel && this.devPanel.open) { this.devPanel.handleDrag(dy); return; }
      this._scrolling = true;

      if (this.state === Config.STATE.WEAPON_SHOP) {
        var negDy = -dy; // 手指上划 dy<0 → scrollY增大
        this._scrollVelocity = negDy;
        if (this.renderer._weaponDetailKey) {
          var key = this.renderer._weaponDetailTab === 0 ? '_attrScrollY' : '_skillTreeScrollY';
          this.renderer[key] = (this.renderer[key] || 0) + negDy;
        } else {
          this.renderer._weaponListScrollY = (this.renderer._weaponListScrollY || 0) + negDy;
        }
        return;
      }
      if (this.state === Config.STATE.CHAPTER_SELECT) {
        this._scrollVelocity = dy;
        this.renderer._chapterScrollY = (this.renderer._chapterScrollY || 0) + dy;
      }
    };

    this.input.onDragEnd = () => {
      this._scrolling = false;
    };
  }

  // ===== 公共接口（供系统模块和武器调用） =====

  getBaseAttack() { return 1 + this.saveManager.getAttackBonus(); }

  /** 兼容接口：武器通过 ctx.damageBrick 调用 */
  damageBrick(brick, damage, source, damageType) {
    this.combat.damageBrick(brick, damage, source, damageType);
  }

  /** 兼容接口：武器通过 ctx.damageBoss 调用 */
  damageBoss(damage, source) {
    this.combat.damageBoss(damage, source);
  }

  /** 兼容接口：武器通过 ctx.addDot 调用 */
  addDot(brick, damage, duration, type) {
    this.dotSystem.addDot(brick, damage, duration, type);
  }

  _addFloatingText(t, x, y, c, s) {
    this.floatingTexts.push({ text: t, x: x, y: y, color: c || Config.NEON_YELLOW, size: s || 16, alpha: 1, vy: -1.5, life: 40 });
  }

  // ===== 初始化 =====

  _initGame() {
    this.chapterConfig = ChapterConfig.get(this.currentChapter);
    this.elapsedMs = 0;
    this.currentPhase = ChapterConfig.getPhaseAt(this.currentChapter, 0);
    this.coinsEarned = 0;
    this.bricksDestroyed = 0;
    this.bossTriggered = false;
    this.bossWarningTimer = 0;
    this.lastCrateTime = 0;

    this.launcher = new Launcher(this.gameWidth, this.gameHeight);
    this.launcher.reset(this.gameWidth, this.gameHeight);
    this.bullets = [];
    this.bricks = [];
    this.powerUps = [];
    this.particles.clear();
    this.floatingTexts = [];
    this.combo = 0;
    this.maxCombo = 0;
    this.fireTimer = 0;
    this.comboTimer = 0;
    this.spawnTimer = 0;
    this.boss = null;
    this.score = 0;

    this.upgrades.reset();
    this.upgrades.setChapter(Math.max(this.currentChapter, this.saveManager ? this.saveManager.getMaxChapter() : 1));
    this.expSystem.reset();
    this.dotSystem.reset();
    this.damageStats = {};

    this.launcher.permFireRateBonus = this.saveManager.getFireRateBonus();
    this._syncLauncherStats();

    for (var r = 0; r < Config.BRICK_INIT_ROWS; r++) {
      var y = Config.BRICK_TOP_OFFSET + r * (Config.BRICK_HEIGHT + Config.BRICK_PADDING);
      this.bricks = this.bricks.concat(BrickFactory.generateRow(this.gameWidth, y, this.currentPhase, this.chapterConfig));
    }
    this.state = Config.STATE.PLAYING;
  }

  _syncLauncherStats() {
    if (!this.launcher) return;
    var fireRateMult = this.upgrades.getFireRateMult();
    this.launcher.permFireRateBonus = 1 - 1 / fireRateMult + this.saveManager.getFireRateBonus();
  }

  // ===== 主循环 =====

  update(timestamp) {
    if (this.lastTime === 0) this.lastTime = timestamp;
    var dtMs = Math.min(timestamp - this.lastTime, 50);
    this.lastTime = timestamp;
    var ts = this._devTimeScale || 1;
    dtMs *= ts;
    var dt = dtMs / 16.67;

    // Dev panel 优先处理点击
    if (this.devPanel) {
      var devTap = this.input.peekTap();
      if (devTap) {
        var devResult = this.devPanel.handleTap(devTap, this);
        if (devResult && devResult.consumed) {
          this.input.consumeTap();
          return;
        }
      }
    }

    // 统计面板点击检测
    var devTap2 = this.input.peekTap();
    if (Config.DEV_MODE && this._statsArea && devTap2) {
      const a = this._statsArea;
      if (devTap2.x >= a.x && devTap2.x <= a.x + a.w && devTap2.y >= a.y && devTap2.y <= a.y + a.h) {
        this.statsExpanded = !this.statsExpanded;
        this.input.consumeTap();
        return;
      }
    }

    if (this.devPanel && this.devPanel.open) return;

    switch (this.state) {
      case Config.STATE.LOADING:
        this.loadTimer -= dt;
        if (this.loadTimer <= 0) this.state = Config.STATE.TITLE;
        break;
      case Config.STATE.TITLE: {
        const tap = this.input.consumeTap();
        if (tap) {
          // 适龄提示弹窗优先
          if (this.renderer.handleAgeTipTap(tap)) break;
          // 只有点击"开始游戏"按钮区域才进入
          const btnW = 180, btnH = 48;
          const btnX = Config.SCREEN_WIDTH / 2 - btnW / 2;
          const btnY = Config.SCREEN_HEIGHT * 0.72;
          if (tap.x >= btnX && tap.x <= btnX + btnW && tap.y >= btnY && tap.y <= btnY + btnH) {
            Sound.init(); Sound.gameStart();
            this.state = Config.STATE.CHAPTER_SELECT;
            this.renderer._chapterScrollY = (this.saveManager.getMaxChapter() - 1) * 100;
          }
        }
        break;
      }
      case Config.STATE.CHAPTER_SELECT: this.ui.updateChapterSelect(); break;
      case Config.STATE.UPGRADE_SHOP: this.ui.updateUpgradeShop(); break;
      case Config.STATE.WEAPON_SHOP: this.ui.updateWeaponShop(); break;
      case Config.STATE.PLAYING: this._updatePlaying(dt, dtMs); break;
      case Config.STATE.BOSS: this._updateBoss(dt, dtMs); break;
      case Config.STATE.PAUSED: this.ui.updatePaused(); break;
      case Config.STATE.LEVEL_UP:
      case Config.STATE.SKILL_CHOICE:
        this.expSystem.update(dt);
        this._updateFloatingTexts(dt);
        this.particles.update(dt);
        this.ui.updateSkillChoice();
        break;
      case Config.STATE.CHAPTER_CLEAR: this.ui.updateChapterClear(); break;
      case Config.STATE.GAME_OVER: this.ui.updateGameOver(); break;
    }
  }

  // ===== 战斗更新 =====

  /**
   * 通用战斗tick — Playing 和 Boss 共享的核心循环
   * 射击、武器、碰撞、DOT、粒子、经验、Combo
   */
  _tickCombatSystems(dt, dtMs) {
    this._handleInput(dt);
    this.launcher.update(dt, dtMs);

    // 自动射击
    if (!this._devPauseFire) {
      this.fireTimer += dtMs;
      if (this.fireTimer >= this.launcher.getFireInterval()) {
        this.fireTimer -= this.launcher.getFireInterval();
        this.combat.fireBullets();
      }
    }

    // 砖块状态
    this._scrollBricks(dt);
    BrickFactory.updateSpecialBricks(this.bricks, dtMs);
    for (var si = 0; si < this.bricks.length; si++) {
      if (this.bricks[si].alive && this.bricks[si].updateStatus) this.bricks[si].updateStatus(dtMs);
      // 衰减黑洞禁融合标记
      var brick = this.bricks[si];
      if (brick._noMerge) {
        brick._noMergeTimer -= dtMs;
        if (brick._noMergeTimer <= 0) { brick._noMerge = false; }
      }
    }

    // 武器 & 碰撞 & DOT & 掉落
    this.upgrades.updateWeapons(dtMs, this);
    this.collision.updateBullets(dt, dtMs);
    this.dotSystem.update(dtMs);
    this.collision.updatePowerUps(dt);

    // 粒子 & 文字 & 经验
    this.expSystem.update(dt);
    this.particles.update(dt);
    this._updateFloatingTexts(dt);

    // Combo 超时
    if (this.combo > 0) {
      this.comboTimer += dtMs;
      if (this.comboTimer > 2000) { this.combo = 0; this.comboTimer = 0; }
    }
  }

  _updatePlaying(dt, dtMs) {
    var pauseTap = this.input.consumeTap();
    if (pauseTap && this.renderer.getSpeedBtnHit(pauseTap)) {
      var speeds = [1, 2, 3, 5];
      var cur = this._devTimeScale || 1;
      var idx = speeds.indexOf(cur);
      this._devTimeScale = speeds[(idx + 1) % speeds.length];
      return;
    }
    if (pauseTap && this.renderer.getPauseBtnHit(pauseTap)) {
      this._pausedFrom = Config.STATE.PLAYING;
      this.state = Config.STATE.PAUSED;
      return;
    }

    // 章节时间推进
    this.elapsedMs += dtMs;
    this.currentPhase = ChapterConfig.getPhaseAt(this.currentChapter, this.elapsedMs);
    if (!this.bossTriggered && this.currentPhase.phase === 'boss') {
      this.bossTriggered = true;
      this.bossWarningTimer = Config.BOSS_WARNING_DURATION;
    }
    if (this.bossWarningTimer > 0) {
      this.bossWarningTimer -= dtMs;
      if (this.bossWarningTimer <= 0) { this._startBoss(); return; }
    }

    // 砖块生成（仅 Playing 阶段）
    this._updateBrickSpawn(dtMs);

    // 通用战斗tick
    this._tickCombatSystems(dt, dtMs);

    // 危险线检测（无敌模式跳过）
    if (!this._devInvincible && this.collision.checkDangerLine()) { Sound.gameOver(); this.state = Config.STATE.GAME_OVER; return; }

    this._tryShowLevelUpChoice();
  }

  _updateBoss(dt, dtMs) {
    var pauseTap = this.input.consumeTap();
    if (pauseTap && this.renderer.getPauseBtnHit(pauseTap)) {
      this._pausedFrom = Config.STATE.BOSS;
      this.state = Config.STATE.PAUSED;
      return;
    }

    // Boss 逻辑
    if (this.boss && this.boss.alive) {
      this.boss.update(dtMs);
      var s = this.boss.collectSpawnedBricks();
      if (s.length > 0) this.bricks = this.bricks.concat(s);
    }

    // 通用战斗tick
    this._tickCombatSystems(dt, dtMs);

    // Boss/砖块越线检测（无敌模式跳过）
    if (!this._devInvincible && this.boss && this.boss.alive && this.boss.isPastDangerLine()) {
      Sound.gameOver(); this.state = Config.STATE.GAME_OVER; return;
    }
    if (!this._devInvincible && this.collision.checkDangerLine()) { Sound.gameOver(); this.state = Config.STATE.GAME_OVER; return; }

    this._tryShowLevelUpChoice();
    if (this.state === Config.STATE.LEVEL_UP || this.state === Config.STATE.SKILL_CHOICE) return;

    // Boss 击败
    if (this.boss && !this.boss.alive) {
      Sound.bossDefeat();
      this.score += 500;
      this._addFloatingText('BOSS DEFEATED!', this.gameWidth / 2, this.gameHeight / 3, Config.NEON_YELLOW, 22);
      this.coinsEarned = Math.floor((this.chapterConfig ? this.chapterConfig.clearReward : 0) * this.saveManager.getCoinMultiplier() * (this.saveManager.isChapterCleared(this.currentChapter) ? 1 : 2));
      this.saveManager.setChapterRecord(this.currentChapter, this.score, this.expSystem.playerLevel);
      if (!this.saveManager.isChapterCleared(this.currentChapter) && this.currentChapter >= this.saveManager.getMaxChapter()) this.saveManager.unlockNextChapter();
      this.saveManager.addCoins(this.coinsEarned);
      this.boss = null;
      this.state = Config.STATE.CHAPTER_CLEAR;
    }
  }

  // ===== 砖块滚动 & 生成 =====

  _scrollBricks(dt) {
    if (!this.chapterConfig) return;
    var bs = this.chapterConfig.scrollSpeed;
    var ac = (this.currentPhase && this.currentPhase.scrollAccel) ? this.currentPhase.scrollAccel : 0;
    var tip = (this.elapsedMs - (this.currentPhase ? this.currentPhase.time : 0)) / 1000;
    var ds = Math.min(bs + ac * tip, bs * 3);

    for (var i = 0; i < this.bricks.length; i++) {
      var b = this.bricks[i];
      if (b.alive) {
        b.y += ds * b.speedMult * dt;
        if (b.knockbackY && b.knockbackY < 0) {
          b.y += b.knockbackY;
          b.knockbackY *= 0.85;
          if (b.knockbackY > -0.5) b.knockbackY = 0;
          var minY = 100;
          if (b.y < minY) b.y = minY;
        }
      }
    }

    this.collision.mergeBricks();

    for (var j = this.bricks.length - 1; j >= 0; j--) {
      if (!this.bricks[j].alive || this.bricks[j].y > this.gameHeight + 50) this.bricks.splice(j, 1);
    }
  }

  _spawnNewRow() {
    if (!this.currentPhase || this.currentPhase.spawnMult <= 0) return;
    this.bricks = this.bricks.concat(BrickFactory.generateRow(this.gameWidth, Config.BRICK_TOP_OFFSET - Config.BRICK_HEIGHT - Config.BRICK_PADDING, this.currentPhase, this.chapterConfig));
  }

  _updateBrickSpawn(dtMs) {
    if (!this.chapterConfig || !this.currentPhase || this.currentPhase.spawnMult <= 0) return;
    var tip = (this.elapsedMs - this.currentPhase.time) / 1000;
    var iv = this.chapterConfig.spawnInterval / (this.currentPhase.spawnMult * (1 + Math.min(tip / 60, 0.15)));
    this.spawnTimer += dtMs;
    if (this.spawnTimer >= iv) { this.spawnTimer -= iv; this._spawnNewRow(); }
  }

  // ===== 输入 =====

  _handleInput(dt) {
    if (this.devPanel && this.devPanel.open) return;
    var dx = this.input.getPaddleDeltaX();
    if (dx !== 0) this.launcher.setX(this.launcher.getCenterX() + dx);
  }

  // ===== 升级选择 =====

  _triggerChoice(source) {
    this.pendingSkillChoices = this.upgrades.generateChoices();
    if (this.pendingSkillChoices.length > 0) {
      this._preChoiceState = this.state;
      this._choiceSource = source;
      this.state = source === 'crate' ? Config.STATE.SKILL_CHOICE : Config.STATE.LEVEL_UP;
    }
  }

  _tryShowLevelUpChoice() {
    if (this._devPauseLevelUp) return;
    if (this.expSystem.hasPendingLevelUp() && this.state !== Config.STATE.LEVEL_UP && this.state !== Config.STATE.SKILL_CHOICE) {
      this.expSystem.consumeLevelUp();
      this._addFloatingText('LEVEL UP!', this.gameWidth / 2, this.gameHeight * 0.4, Config.NEON_GREEN, 20);
      this._triggerChoice('levelUp');
    }
  }

  // ===== Boss =====

  _startBoss() {
    for (var i = 0; i < this.bricks.length; i++) {
      if (this.bricks[i].alive && this.bricks[i].y < this.gameHeight * 0.3) this.bricks[i].alive = false;
    }
    this.state = Config.STATE.BOSS;
    this.boss = createBoss(this.chapterConfig.bossType, this.currentChapter, this.gameWidth);
    Sound.bossAppear();
  }

  /**
   * Boss测试场景 - 从DevPanel调用
   */
  _startBossTest(bossType, chapter) {
    if (this.state !== Config.STATE.PLAYING && this.state !== Config.STATE.BOSS) {
      this.currentChapter = chapter;
      this._initGame();
    }
    for (var i = 0; i < this.bricks.length; i++) this.bricks[i].alive = false;
    this.bricks = [];
    this.boss = null;
    this.damageStats = {};
    this.currentChapter = chapter;
    this.chapterConfig = ChapterConfig.get(chapter);
    this.state = Config.STATE.BOSS;
    this.boss = createBoss(bossType, chapter, this.gameWidth);
    this.bossTriggered = true;
    this.bossWarningTimer = 0;
    this.currentPhase = { phase: 'boss', spawnMult: 0, types: [], timeCurve: [0, 0], scrollAccel: 0 };
    Sound.bossAppear();
  }

  // ===== 通用更新 =====

  _updateFloatingTexts(dt) {
    for (var i = this.floatingTexts.length - 1; i >= 0; i--) {
      var t = this.floatingTexts[i];
      t.y += t.vy * dt;
      t.life -= dt;
      t.alpha = Math.max(0, t.life / 40);
      if (t.life <= 0) this.floatingTexts.splice(i, 1);
    }
  }

  // ===== 渲染 =====

  render() {
    this.renderer.clear();
    switch (this.state) {
      case Config.STATE.LOADING: this.renderer.drawLoading(); break;
      case Config.STATE.TITLE: this.renderer.drawTitle(); break;
      case Config.STATE.CHAPTER_SELECT:
        this.renderer.drawChapterSelect(this.saveManager.getMaxChapter(), this.saveManager.getData().chapterRecords, this.saveManager.getCoins());
        break;
      case Config.STATE.UPGRADE_SHOP: this.renderer.drawUpgradeShop(this.saveManager); break;
      case Config.STATE.WEAPON_SHOP: this.renderer.drawWeaponShop(this.saveManager); break;
      case Config.STATE.PLAYING:
        this._renderGame();
        if (this.bossWarningTimer > 0) this.renderer.drawBossWarning(this.chapterConfig.bossType);
        break;
      case Config.STATE.BOSS: this._renderGame(); break;
      case Config.STATE.PAUSED: this._renderGame(); this.renderer.drawPauseDialog(); break;
      case Config.STATE.LEVEL_UP:
        this._renderGame();
        this.renderer.drawSkillChoice(this.pendingSkillChoices, this.upgrades, '⬆ LEVEL ' + this.expSystem.playerLevel, this);
        break;
      case Config.STATE.SKILL_CHOICE:
        this._renderGame();
        this.renderer.drawSkillChoice(this.pendingSkillChoices, this.upgrades, '技能宝箱', this);
        break;
      case Config.STATE.CHAPTER_CLEAR:
        this.renderer.drawChapterClear(this.currentChapter, this.score, this.expSystem.playerLevel, this.maxCombo, this.upgrades.getOwnedWeapons(), this.coinsEarned, false);
        break;
      case Config.STATE.GAME_OVER:
        this._renderGame();
        this.renderer.drawGameOver({
          score: this.score,
          level: this.expSystem.playerLevel,
          weapons: this.upgrades.getOwnedWeapons(),
          damageStats: this.damageStats || {},
          elapsedMs: this.elapsedMs,
          chapter: this.currentChapter,
          shipTree: this.upgrades.shipTree,
          bricksKilled: this._bricksKilled || 0,
        });
        break;
    }
    // Dev panel 最后绘制（在最上层）
    if (this.devPanel) this.devPanel.draw(this.renderer.ctx, this);
  }

  _renderGame() {
    // 震动冷却
    if (this.shakeCooldown > 0) this.shakeCooldown--;
    var shaking = this.screenShake > 0.5;
    if (shaking) {
      var intensity = Math.min(this.screenShake, 6); // 强度上限6（原来12太猛）
      this.renderer.ctx.save();
      this.renderer.ctx.translate(
        (Math.random() - 0.5) * intensity * this.renderer.dpr,
        (Math.random() - 0.5) * intensity * this.renderer.dpr
      );
      this.screenShake *= 0.80; // 衰减更快（0.85→0.80）
      if (this.screenShake < 0.5) this.screenShake = 0;
    }
    this.renderer.drawDangerLine(this.gameHeight * Config.BRICK_DANGER_Y);
    this.renderer.drawBricksBatch(this.bricks);
    if (this.boss && this.boss.alive) this.renderer.drawBoss(this.boss);
    for (var j = 0; j < this.powerUps.length; j++) this.renderer.drawPowerUp(this.powerUps[j]);
    this.renderer.drawExpOrbs(this.expSystem.orbs);
    this.renderer.drawBullets(this.bullets);
    if (this.launcher) this.renderer.drawLauncher(this.launcher, this.upgrades);
    this.renderer.drawWeapons(this.upgrades.weapons, this.launcher);
    this.renderer.drawWeaponWings(this.upgrades.weapons, this.launcher);
    this.renderer.drawParticles(this.particles.particles);
    this.renderer.drawFloatingTexts(this.floatingTexts);
    this.renderer.drawWeaponHUD(this.upgrades.getOwnedWeapons());
    this.renderer.drawChapterHUD(this.currentChapter, this.score, this.combo, this.expSystem.playerLevel, this.elapsedMs, Sound.enabled, this._devTimeScale || 1);
    this.renderer.drawExpBar(this.expSystem.exp, this.expSystem.expToNext, this.expSystem.playerLevel);
    if (Config.DEV_MODE) this._statsArea = this.renderer.drawDamageStats(this.damageStats, this.statsExpanded);
    if (shaking) this.renderer.ctx.restore();
  }
}

module.exports = Game;