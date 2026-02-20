/**
 * Game.js - v6.0 武器升级树 + 飞机升级树 + 技能宝箱
 * 100章关卡 + 7种砖块 + 5种Boss + 金币养成
 */
const Config = require('./Config');
const Bullet = require('./Bullet');
const Launcher = require('./Launcher');
const { Brick, generateBrickRow } = require('./Brick');
const BrickFactory = require('./BrickFactory');
const ChapterConfig = require('./ChapterConfig');
const { createBoss, GuardianBoss, LaserTurretBoss } = require('./BossFactory');
const SaveManager = require('./SaveManager');
const { ParticleManager } = require('./Particle');
const { PowerUp, generateDrops } = require('./PowerUp');
const UpgradeManager = require('./Skill');
const Renderer = require('./Renderer');
const InputManager = require('./InputManager');
const Sound = require('./SoundManager');

class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new Renderer(canvas);
    this.input = new InputManager();
    this.gameWidth = Config.SCREEN_WIDTH;
    this.gameHeight = Config.SCREEN_HEIGHT;
    this.state = Config.STATE.LOADING;
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.comboTimer = 0;
    this.bullets = [];
    this.bricks = [];
    this.launcher = null;
    this.particles = new ParticleManager();
    this.powerUps = [];
    this.upgrades = new UpgradeManager();
    this.boss = null;
    this.floatingTexts = [];
    this.screenShake = 0;
    this.fireTimer = 0;
    this.pendingSkillChoices = [];
    this._preChoiceState = null;
    this.lastCrateTime = 0;
    this.shieldTimer = 0;
    this.shieldActive = true;
    this.saveManager = new SaveManager();
    this.currentChapter = 1;
    this.chapterConfig = null;
    this.elapsedMs = 0;
    this.currentPhase = null;
    this.coinsEarned = 0;
    this.bricksDestroyed = 0;
    this.spawnTimer = 0;
    this.bossWarningTimer = 0;
    this.bossTriggered = false;
    this.chapterScrollY = 0;
    this.lastTime = 0;
    this.loadTimer = 0;
    this._startLoading();
  }

  _startLoading() { this.state = Config.STATE.LOADING; this.loadTimer = 60; }

  getBaseAttack() {
    return this.upgrades.getBaseAttack() + this.saveManager.getAttackBonus();
  }

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
    this.shieldTimer = 0;
    this.shieldActive = true;
    this.launcher.bulletDamage = 1 + this.saveManager.getAttackBonus();
    this.launcher.permFireRateBonus = this.saveManager.getFireRateBonus();
    this._syncLauncherStats();
    var initRows = Config.BRICK_INIT_ROWS;
    for (var r = 0; r < initRows; r++) {
      var y = Config.BRICK_TOP_OFFSET + r * (Config.BRICK_HEIGHT + Config.BRICK_PADDING);
      var row = BrickFactory.generateRow(this.gameWidth, y, this.currentPhase, this.chapterConfig);
      this.bricks = this.bricks.concat(row);
    }
    this.state = Config.STATE.PLAYING;
  }

  _fireBullets() {
    var spreadBonus = this.upgrades.getSpreadBonus();
    var count = this.launcher.getBulletCount() + spreadBonus;
    var spread = this.launcher.getSpreadAngle() + spreadBonus * 0.08;
    var cx = this.launcher.getCenterX();
    var startY = this.launcher.y - 5;
    var speed = Config.BULLET_SPEED;
    var atkMult = this.upgrades.getAttackMult();
    var damage = Math.max(1, Math.floor(this.launcher.bulletDamage * atkMult));
    var pierce = this.upgrades.getPierceCount();
    var barrageLv = this.upgrades.getBarrageLv();
    var burstCount = barrageLv > 0 ? 3 : 1;
    for (var burst = 0; burst < burstCount; burst++) {
      for (var i = 0; i < count; i++) {
        if (this.bullets.length >= Config.BULLET_MAX) break;
        var angle = -Math.PI / 2;
        if (count > 1) angle = -Math.PI / 2 - spread / 2 + (spread / (count - 1)) * i;
        var vx = Math.cos(angle) * speed;
        var vy = Math.sin(angle) * speed;
        var bullet = new Bullet(cx, startY - burst * 8, vx, vy, damage);
        bullet.pierce = pierce;
        this.bullets.push(bullet);
      }
    }
    this.launcher.muzzleFlash = 3;
    if (this.launcher.getFireInterval() > 120) Sound.bulletShoot();
  }

  _addFloatingText(text, x, y, color, size) {
    this.floatingTexts.push({ text: text, x: x, y: y, color: color || Config.NEON_YELLOW, size: size || 16, alpha: 1.0, vy: -1.5, life: 40 });
  }

  _spawnNewRow() {
    if (!this.currentPhase || this.currentPhase.spawnMult <= 0) return;
    var y = Config.BRICK_TOP_OFFSET - Config.BRICK_HEIGHT - Config.BRICK_PADDING;
    var row = BrickFactory.generateRow(this.gameWidth, y, this.currentPhase, this.chapterConfig);
    this.bricks = this.bricks.concat(row);
  }

  damageBrick(brick, damage, source) {
    if (!brick.alive) return;
    if (brick.type === 'stealth' && !brick.visible) return;
    var destroyed = brick.hit(damage);
    if (destroyed) { Sound.brickBreak(); this._onBrickDestroyed(brick, source); }
    else { Sound.brickHit(); var bc = brick.getCenter(); this.particles.emitHitSpark(bc.x, bc.y, brick.color); }
  }

  damageBoss(damage) {
    if (!this.boss || !this.boss.alive) return;
    this.boss.hit(damage);
    Sound.brickHit();
    this.particles.emitBossHit(this.boss.getCenterX(), this.boss.getCenterY());
    this.score += damage;
  }

  _onBrickDestroyed(brick, source) {
    var center = brick.getCenter();
    this.particles.emitBrickBreak(brick.x, brick.y, brick.width, brick.height, brick.color);
    if (brick.maxHp >= 3) this.screenShake = Math.min(this.screenShake + 2, 8);
    this.combo++;
    this.comboTimer = 0;
    if (this.combo > this.maxCombo) this.maxCombo = this.combo;
    var multiplier = 1 + Math.floor(this.combo / 5) * 0.5;
    var points = Math.floor(Config.COMBO_SCORE_BASE * brick.maxHp * multiplier);
    this.score += points;
    this.bricksDestroyed++;
    if (this.combo > 1 && this.combo % 5 === 0) {
      Sound.combo(this.combo);
      this._addFloatingText(this.combo + ' COMBO!', center.x, center.y - 10, Config.NEON_YELLOW, 14 + Math.min(this.combo, 12));
      this.particles.emitCombo(center.x, center.y, this.combo);
    }
    if (brick.type === 'split' && !brick.isSplitChild) {
      var children = BrickFactory.spawnSplitChildren(brick);
      this.bricks = this.bricks.concat(children);
    }
    // 掉落：金币 + 技能宝箱
    var drops = generateDrops(center.x, center.y, this.lastCrateTime, this.elapsedMs);
    for (var i = 0; i < drops.items.length; i++) this.powerUps.push(drops.items[i]);
    if (drops.crateDropped) this.lastCrateTime = this.elapsedMs;
  }

  _applyPowerUp(powerUp) {
    if (powerUp.type === 'coin') {
      var coinMult = this.saveManager.getCoinMultiplier();
      var value = Math.floor(1 * coinMult);
      this.coinsEarned += value;
      this._addFloatingText('+' + value + '💰', powerUp.x, powerUp.y, '#FFD700', 12);
    } else if (powerUp.type === 'skillCrate') {
      Sound.levelUp();
      this._addFloatingText('技能宝箱!', powerUp.x, powerUp.y, Config.NEON_PINK, 16);
      this.pendingSkillChoices = this.upgrades.generateChoices();
      if (this.pendingSkillChoices.length > 0) {
        this._preChoiceState = this.state;
        this.state = Config.STATE.SKILL_CHOICE;
      }
    }
  }

  _calcCoinsEarned(cleared) {
    if (!this.chapterConfig) return 0;
    var coinMult = this.saveManager.getCoinMultiplier();
    var brickCoins = Math.min(50, Math.floor(this.bricksDestroyed / 100));
    var baseReward = this.chapterConfig.clearReward;
    if (cleared) {
      var isFirst = !this.saveManager.isChapterCleared(this.currentChapter);
      return Math.floor(baseReward * coinMult * (isFirst ? 2 : 1)) + brickCoins;
    }
    return Math.floor(baseReward * 0.3 * coinMult) + brickCoins;
  }

  _syncLauncherStats() {
    if (!this.launcher) return;
    this.launcher.permFireRateBonus = this.upgrades.getFireRateBonus() + this.saveManager.getFireRateBonus();
    this.launcher.permSpreadBonus = this.upgrades.getSpreadBonus();
    this.launcher.bulletDamage = 1 + this.saveManager.getAttackBonus();
  }

  update(timestamp) {
    if (this.lastTime === 0) this.lastTime = timestamp;
    var dtMs = Math.min(timestamp - this.lastTime, 50);
    this.lastTime = timestamp;
    var dt = dtMs / 16.67;
    switch (this.state) {
      case Config.STATE.LOADING:
        this.loadTimer -= dt;
        if (this.loadTimer <= 0) this.state = Config.STATE.TITLE;
        break;
      case Config.STATE.TITLE:
        if (this.input.consumeTap()) { Sound.init(); Sound.gameStart(); this.state = Config.STATE.CHAPTER_SELECT; }
        break;
      case Config.STATE.CHAPTER_SELECT: this._updateChapterSelect(); break;
      case Config.STATE.UPGRADE_SHOP: this._updateUpgradeShop(); break;
      case Config.STATE.PLAYING: this._updatePlaying(dt, dtMs); break;
      case Config.STATE.BOSS: this._updateBoss(dt, dtMs); break;
      case Config.STATE.SKILL_CHOICE:
        this._updateFloatingTexts(dt);
        this.particles.update(dt);
        this._updateSkillChoice();
        break;
      case Config.STATE.CHAPTER_CLEAR: this._updateChapterClear(); break;
      case Config.STATE.GAME_OVER: this._updateGameOver(); break;
    }
  }

  _updateChapterSelect() {
    var tap = this.input.consumeTap();
    if (!tap) return;
    var result = this.renderer.getChapterSelectHit(tap, this.saveManager.getMaxChapter(), this.saveManager.getData().chapterRecords, this.saveManager.getCoins());
    if (result === 'upgrade') this.state = Config.STATE.UPGRADE_SHOP;
    else if (result === 'sound') Sound.toggle();
    else if (typeof result === 'number' && result > 0 && result <= this.saveManager.getMaxChapter()) { this.currentChapter = result; this._initGame(); }
  }

  _updateUpgradeShop() {
    var tap = this.input.consumeTap();
    if (!tap) return;
    var result = this.renderer.getUpgradeShopHit(tap, this.saveManager);
    if (result === 'back') this.state = Config.STATE.CHAPTER_SELECT;
    else if (result && typeof result === 'string') { if (this.saveManager.upgradeLevel(result)) Sound.selectSkill(); }
  }

  _updateChapterClear() {
    var tap = this.input.consumeTap();
    if (!tap) return;
    var result = this.renderer.getChapterClearHit(tap);
    if (result === 'next') { this.currentChapter = Math.min(this.currentChapter + 1, this.saveManager.getMaxChapter()); this._initGame(); }
    else if (result === 'back') this.state = Config.STATE.CHAPTER_SELECT;
  }

  _updateGameOver() {
    var tap = this.input.consumeTap();
    if (!tap) return;
    var coins = this._calcCoinsEarned(false);
    if (coins > 0) this.saveManager.addCoins(coins);
    this.state = Config.STATE.CHAPTER_SELECT;
  }

  _updatePlaying(dt, dtMs) {
    this._handleInput(dt);
    this.launcher.update(dt, dtMs);
    this.fireTimer += dtMs;
    var fireInterval = this.launcher.getFireInterval();
    if (this.fireTimer >= fireInterval) { this.fireTimer -= fireInterval; this._fireBullets(); }
    this.elapsedMs += dtMs;
    this.currentPhase = ChapterConfig.getPhaseAt(this.currentChapter, this.elapsedMs);
    if (!this.bossTriggered && this.currentPhase.phase === 'boss') { this.bossTriggered = true; this.bossWarningTimer = Config.BOSS_WARNING_DURATION; }
    if (this.bossWarningTimer > 0) { this.bossWarningTimer -= dtMs; if (this.bossWarningTimer <= 0) { this._startBoss(); return; } }
    this._scrollBricks(dt);
    this._updateBrickSpawn(dtMs);
    BrickFactory.updateSpecialBricks(this.bricks, dtMs);
    if (this._checkDangerLine()) { Sound.gameOver(); this.state = Config.STATE.GAME_OVER; return; }
    this.upgrades.updateWeapons(dtMs, this);
    this._updateBullets(dt);
    this._updatePowerUps(dt);
    this.particles.update(dt);
    this._updateFloatingTexts(dt);
    this._updateShield(dtMs);
    if (this.combo > 0) { this.comboTimer += dtMs; if (this.comboTimer > 2000) { this.combo = 0; this.comboTimer = 0; } }
  }

  _updateBoss(dt, dtMs) {
    this._handleInput(dt);
    this.launcher.update(dt, dtMs);
    this.fireTimer += dtMs;
    var fireInterval = this.launcher.getFireInterval();
    if (this.fireTimer >= fireInterval) { this.fireTimer -= fireInterval; this._fireBullets(); }
    if (this.boss && this.boss.alive) { this.boss.update(dtMs); var spawned = this.boss.collectSpawnedBricks(); if (spawned.length > 0) this.bricks = this.bricks.concat(spawned); }
    this._scrollBricks(dt);
    BrickFactory.updateSpecialBricks(this.bricks, dtMs);
    if (this._checkDangerLine()) { Sound.gameOver(); this.state = Config.STATE.GAME_OVER; return; }
    this.upgrades.updateWeapons(dtMs, this);
    this._updateBullets(dt);
    this._updatePowerUps(dt);
    this.particles.update(dt);
    this._updateFloatingTexts(dt);
    this._updateShield(dtMs);
    if (this.boss && !this.boss.alive) {
      Sound.bossDefeat();
      this.score += 500;
      this._addFloatingText('BOSS DEFEATED!', this.gameWidth / 2, this.gameHeight / 3, Config.NEON_YELLOW, 22);
      this.coinsEarned = this._calcCoinsEarned(true);
      var isFirst = !this.saveManager.isChapterCleared(this.currentChapter);
      this.saveManager.setChapterRecord(this.currentChapter, this.score, 0);
      if (isFirst && this.currentChapter >= this.saveManager.getMaxChapter()) this.saveManager.unlockNextChapter();
      this.saveManager.addCoins(this.coinsEarned);
      this.boss = null;
      this.state = Config.STATE.CHAPTER_CLEAR;
    }
  }

  _updateSkillChoice() {
    var tap = this.input.consumeTap();
    if (tap && this.pendingSkillChoices.length > 0) {
      for (var i = 0; i < this.pendingSkillChoices.length; i++) {
        var choice = this.pendingSkillChoices[i];
        if (choice._hitArea) {
          var ha = choice._hitArea;
          if (tap.x >= ha.x && tap.x <= ha.x + ha.w && tap.y >= ha.y && tap.y <= ha.y + ha.h) {
            Sound.selectSkill();
            this.upgrades.applyChoice(choice);
            this._syncLauncherStats();
            this.state = this._preChoiceState || Config.STATE.PLAYING;
            this._preChoiceState = null;
            return;
          }
        }
      }
    }
  }

  _updateShield(dtMs) {
    var shieldLv = this.upgrades.getShieldLv();
    if (shieldLv <= 0) return;
    if (!this.shieldActive) {
      this.shieldTimer += dtMs;
      if (this.shieldTimer >= 30000 / shieldLv) { this.shieldActive = true; this.shieldTimer = 0; }
    }
  }

  _startBoss() {
    for (var i = 0; i < this.bricks.length; i++) { if (this.bricks[i].alive && this.bricks[i].y < this.gameHeight * 0.3) this.bricks[i].alive = false; }
    this.state = Config.STATE.BOSS;
    this.boss = createBoss(this.chapterConfig.bossType, this.currentChapter, this.gameWidth);
    Sound.bossAppear();
  }

  _scrollBricks(dt) {
    if (!this.chapterConfig) return;
    var baseSpeed = this.chapterConfig.scrollSpeed;
    var accel = (this.currentPhase && this.currentPhase.scrollAccel) ? this.currentPhase.scrollAccel : 0;
    var phaseStartTime = this.currentPhase ? this.currentPhase.time : 0;
    var timeInPhase = (this.elapsedMs - phaseStartTime) / 1000;
    var dynamicSpeed = Math.min(baseSpeed + accel * timeInPhase, baseSpeed * 3.0);
    for (var i = 0; i < this.bricks.length; i++) { var brick = this.bricks[i]; if (brick.alive) brick.y += dynamicSpeed * brick.speedMult * dt; }
    for (var j = this.bricks.length - 1; j >= 0; j--) { if (!this.bricks[j].alive || this.bricks[j].y > this.gameHeight + 50) this.bricks.splice(j, 1); }
  }

  _checkDangerLine() {
    var dangerY = this.gameHeight * Config.BRICK_DANGER_Y;
    for (var i = 0; i < this.bricks.length; i++) { if (this.bricks[i].alive && this.bricks[i].y + this.bricks[i].height >= dangerY) return true; }
    return false;
  }

  _updateBrickSpawn(dtMs) {
    if (!this.chapterConfig || !this.currentPhase || this.currentPhase.spawnMult <= 0) return;
    var timeInPhase = (this.elapsedMs - this.currentPhase.time) / 1000;
    var rampMult = 1.0 + Math.min(timeInPhase / 60, 0.15);
    var interval = this.chapterConfig.spawnInterval / (this.currentPhase.spawnMult * rampMult);
    this.spawnTimer += dtMs;
    if (this.spawnTimer >= interval) { this.spawnTimer -= interval; this._spawnNewRow(); }
  }

  _handleInput(dt) {
    var moveSpeedMult = this.upgrades.getMoveSpeedMult();
    var deltaX = this.input.getPaddleDeltaX() * moveSpeedMult;
    if (deltaX !== 0) this.launcher.setX(this.launcher.getCenterX() + deltaX);
  }

  _updateBullets(dt) {
    for (var i = this.bullets.length - 1; i >= 0; i--) {
      var bullet = this.bullets[i];
      bullet.update(dt);
      if (bullet.isOutOfBounds(this.gameWidth, this.gameHeight)) { this.bullets.splice(i, 1); continue; }
      if (this.boss && this.boss.alive && this.boss.type === 'laser' && this.boss.isInLaserZone && this.boss.isInLaserZone(bullet.x, bullet.y)) { this.bullets.splice(i, 1); continue; }
      var removed = false;
      for (var j = 0; j < this.bricks.length; j++) {
        var brick = this.bricks[j];
        if (!brick.alive || (brick.type === 'stealth' && !brick.visible)) continue;
        if (bullet.collideBrick(brick)) {
          var critChance = this.upgrades.getCritChance() + this.saveManager.getCritBonus();
          var critMult = (Math.random() < critChance) ? this.upgrades.getCritDmgMult() : 1;
          this.damageBrick(brick, Math.max(1, Math.floor(bullet.damage * critMult)), 'bullet');
          if (critMult > 1) { Sound.crit(); this._addFloatingText('暴击!', brick.getCenter().x, brick.getCenter().y - 10, Config.NEON_RED, 14); }
          if (bullet.pierce > 0) bullet.pierce--;
          else { this.bullets.splice(i, 1); removed = true; break; }
        }
      }
      if (removed) continue;
      if (this.boss && this.boss.alive) {
        if (this.boss.type === 'guardian' && this.boss.hitShield && this.boss.hitShield(bullet.x, bullet.y, bullet.radius)) { this.bullets.splice(i, 1); Sound.brickHit(); continue; }
        if (bullet.collideBoss(this.boss)) {
          var bCrit = (Math.random() < this.upgrades.getCritChance() + this.saveManager.getCritBonus()) ? this.upgrades.getCritDmgMult() : 1;
          this.damageBoss(Math.floor(bullet.damage * 3 * bCrit));
          if (bCrit > 1) this._addFloatingText('暴击!', bullet.x, this.boss.y + this.boss.height + 10, Config.NEON_RED, 14);
          this.bullets.splice(i, 1);
        }
      }
    }
  }

  _updatePowerUps(dt) {
    var magnetTarget = this.upgrades.hasMagnet() ? { x: this.launcher.getCenterX(), y: this.launcher.y } : null;
    for (var i = this.powerUps.length - 1; i >= 0; i--) {
      var pu = this.powerUps[i];
      pu.update(dt, magnetTarget);
      if (pu.collideLauncher(this.launcher)) { this._applyPowerUp(pu); this.powerUps.splice(i, 1); continue; }
      if (pu.isOutOfBounds(this.gameHeight)) this.powerUps.splice(i, 1);
    }
  }

  _updateFloatingTexts(dt) {
    for (var i = this.floatingTexts.length - 1; i >= 0; i--) {
      var t = this.floatingTexts[i];
      t.y += t.vy * dt; t.life -= dt; t.alpha = Math.max(0, t.life / 40);
      if (t.life <= 0) this.floatingTexts.splice(i, 1);
    }
  }

  render() {
    this.renderer.clear();
    switch (this.state) {
      case Config.STATE.LOADING: this.renderer.drawLoading(); break;
      case Config.STATE.TITLE: this.renderer.drawTitle(); break;
      case Config.STATE.CHAPTER_SELECT:
        this.renderer.drawChapterSelect(this.saveManager.getMaxChapter(), this.saveManager.getData().chapterRecords, this.saveManager.getCoins());
        break;
      case Config.STATE.UPGRADE_SHOP: this.renderer.drawUpgradeShop(this.saveManager); break;
      case Config.STATE.PLAYING:
        this._renderGame();
        if (this.bossWarningTimer > 0) this.renderer.drawBossWarning(this.chapterConfig.bossType);
        break;
      case Config.STATE.BOSS: this._renderGame(); break;
      case Config.STATE.SKILL_CHOICE:
        this._renderGame();
        this.renderer.drawSkillChoice(this.pendingSkillChoices, this.upgrades);
        break;
      case Config.STATE.CHAPTER_CLEAR:
        this.renderer.drawChapterClear(this.currentChapter, this.score, 0, this.maxCombo, this.upgrades.getOwnedWeapons(), this.coinsEarned, false);
        break;
      case Config.STATE.GAME_OVER:
        this._renderGame();
        this.renderer.drawGameOver(this.score, 0, this.upgrades.getOwnedWeapons());
        break;
    }
  }

  _renderGame() {
    var shaking = false;
    if (this.screenShake > 0.5) {
      shaking = true;
      this.renderer.ctx.save();
      this.renderer.ctx.translate((Math.random() - 0.5) * this.screenShake * this.renderer.dpr, (Math.random() - 0.5) * this.screenShake * this.renderer.dpr);
      this.screenShake *= 0.85;
      if (this.screenShake < 0.5) this.screenShake = 0;
    }
    var dangerY = this.gameHeight * Config.BRICK_DANGER_Y;
    this.renderer.drawDangerLine(dangerY);
    for (var i = 0; i < this.bricks.length; i++) this.renderer.drawBrick(this.bricks[i]);
    if (this.boss && this.boss.alive) this.renderer.drawBoss(this.boss);
    for (var j = 0; j < this.powerUps.length; j++) this.renderer.drawPowerUp(this.powerUps[j]);
    // 武器渲染
    this.renderer.drawWeapons(this.upgrades.weapons, this.launcher);
    // 武器辅翼
    this.renderer.drawWeaponWings(this.upgrades.weapons, this.launcher);
    for (var k = 0; k < this.bullets.length; k++) this.renderer.drawBullet(this.bullets[k]);
    if (this.launcher) this.renderer.drawLauncher(this.launcher);
    this.renderer.drawParticles(this.particles.particles);
    this.renderer.drawFloatingTexts(this.floatingTexts);
    // 武器图标HUD
    this.renderer.drawWeaponHUD(this.upgrades.getOwnedWeapons());
    this.renderer.drawChapterHUD(this.currentChapter, this.score, this.combo, 0, this.elapsedMs, Sound.enabled);
    if (shaking) this.renderer.ctx.restore();
  }
}

module.exports = Game;
