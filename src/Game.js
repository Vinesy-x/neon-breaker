/**
 * Game.js - v5.0 章节制射击模式
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
const { PowerUp, maybeDropPowerUp } = require('./PowerUp');
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

    // ===== 经验系统 =====
    this.playerLevel = 1;
    this.exp = 0;
    this.expToNext = 80;
    this.expOrbs = [];
    this.pendingLevelUps = 0;

    // 发射计时
    this.fireTimer = 0;
    this.pendingUpgradeChoices = [];
    this.evolveNotifications = [];
    this._preUpgradeState = null;

    // ===== v5.0 章节系统 =====
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

  _startLoading() {
    this.state = Config.STATE.LOADING;
    this.loadTimer = 60;
  }

  _initGame() {
    this.chapterConfig = ChapterConfig.get(this.currentChapter);
    this.elapsedMs = 0;
    this.currentPhase = ChapterConfig.getPhaseAt(this.currentChapter, 0);
    this.coinsEarned = 0;
    this.bricksDestroyed = 0;
    this.bossTriggered = false;
    this.bossWarningTimer = 0;

    this.launcher = new Launcher(this.gameWidth, this.gameHeight);
    this.launcher.reset(this.gameWidth, this.gameHeight);

    this.bullets = [];
    this.bricks = [];
    this.powerUps = [];
    this.particles.clear();
    this.floatingTexts = [];
    this.expOrbs = [];
    this.combo = 0;
    this.maxCombo = 0;
    this.fireTimer = 0;
    this.comboTimer = 0;
    this.spawnTimer = 0;
    this.boss = null;

    this.score = 0;
    this.playerLevel = 1;
    this.exp = 0;
    this.expToNext = this._calcExpToLevel(1);
    this.pendingLevelUps = 0;
    this.upgrades.reset();
    this.evolveNotifications = [];

    // 应用外部成长
    this.launcher.bulletDamage = 1 + this.saveManager.getAttackBonus();
    this.launcher.permFireRateBonus = this.saveManager.getFireRateBonus();

    // 起始等级自动分配Build
    var startLevel = this.saveManager.getStartLevel();
    if (startLevel > 0) {
      this.playerLevel = 1 + startLevel;
      this.expToNext = this._calcExpToLevel(this.playerLevel);
      for (var i = 0; i < startLevel; i++) {
        var choices = this.upgrades.generateChoices();
        if (choices.length > 0) {
          var pick = choices[Math.floor(Math.random() * choices.length)];
          this.upgrades.applyChoice(pick);
        }
      }
      this._syncLauncherStats();
    }

    // 生成初始砖块
    var initRows = Config.BRICK_INIT_ROWS;
    for (var r = 0; r < initRows; r++) {
      var y = Config.BRICK_TOP_OFFSET + r * (Config.BRICK_HEIGHT + Config.BRICK_PADDING);
      var row = BrickFactory.generateRow(this.gameWidth, y, this.currentPhase, this.chapterConfig);
      this.bricks = this.bricks.concat(row);
    }

    this.state = Config.STATE.PLAYING;
  }

  _calcExpToLevel(lv) {
    return 80 + (lv - 1) * 50 + (lv - 1) * (lv - 1) * 5;
  }

  _spawnExpOrbs(x, y, totalExp) {
    totalExp = Math.floor(totalExp * this.saveManager.getExpMultiplier());
    var orbCount = Math.min(Math.ceil(totalExp / 5), 5);
    var perOrb = totalExp / orbCount;
    for (var i = 0; i < orbCount; i++) {
      var angle = Math.random() * Math.PI * 2;
      var speed = 1.5 + Math.random() * 2;
      this.expOrbs.push({
        x: x, y: y,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        value: Math.ceil(perOrb), life: 0,
      });
    }
  }

  _updateExpOrbs(dt) {
    var targetX = Config.SCREEN_WIDTH / 2;
    var targetY = Config.SCREEN_HEIGHT - Config.EXP_BAR_Y_OFFSET;
    for (var i = this.expOrbs.length - 1; i >= 0; i--) {
      var orb = this.expOrbs[i];
      orb.life += dt;
      if (orb.life < 8) {
        orb.x += orb.vx * dt;
        orb.y += orb.vy * dt;
        orb.vx *= 0.95;
        orb.vy *= 0.95;
      } else {
        var dx = targetX - orb.x;
        var dy = targetY - orb.y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        var speed = Config.EXP_ORB_SPEED + orb.life * 0.3;
        if (dist > 5) {
          orb.x += (dx / dist) * speed * dt;
          orb.y += (dy / dist) * speed * dt;
        }
        if (dist < 10) {
          Sound.expCollect();
          this._addExp(orb.value);
          this.expOrbs.splice(i, 1);
          continue;
        }
      }
      if (orb.life > 120) {
        this._addExp(orb.value);
        this.expOrbs.splice(i, 1);
      }
    }
  }

  _addExp(amount) {
    this.exp += amount;
    while (this.exp >= this.expToNext) {
      this.exp -= this.expToNext;
      this.playerLevel++;
      this.expToNext = this._calcExpToLevel(this.playerLevel);
      this.pendingLevelUps++;
      Sound.levelUp();
      this._addFloatingText('LEVEL UP!', this.gameWidth / 2, this.gameHeight * 0.4, Config.NEON_GREEN, 20);
    }
  }

  _tryShowLevelUpChoice() {
    if (this.pendingLevelUps > 0 && this.state !== Config.STATE.LEVEL_UP) {
      this.pendingLevelUps--;
      this.pendingUpgradeChoices = this.upgrades.generateChoices();
      if (this.pendingUpgradeChoices.length > 0) {
        this._preUpgradeState = this.state;
        this.state = Config.STATE.LEVEL_UP;
      }
    }
  }

  _fireBullets() {
    var count = this.launcher.getBulletCount();
    var spread = this.launcher.getSpreadAngle();
    var cx = this.launcher.getCenterX();
    var startY = this.launcher.y - 5;
    var speed = Config.BULLET_SPEED;
    var damage = this.launcher.bulletDamage;
    var pierce = this.upgrades.getPierceCount();

    for (var i = 0; i < count; i++) {
      if (this.bullets.length >= Config.BULLET_MAX) break;
      var angle = -Math.PI / 2;
      if (count > 1) {
        angle = -Math.PI / 2 - spread / 2 + (spread / (count - 1)) * i;
      }
      var vx = Math.cos(angle) * speed;
      var vy = Math.sin(angle) * speed;
      var bullet = new Bullet(cx, startY, vx, vy, damage);
      bullet.pierce = pierce;
      this.bullets.push(bullet);
    }
    this.launcher.muzzleFlash = 3;
    if (this.launcher.getFireInterval() > 120) Sound.bulletShoot();
  }

  _addFloatingText(text, x, y, color, size) {
    this.floatingTexts.push({
      text: text, x: x, y: y, color: color || Config.NEON_YELLOW,
      size: size || 16, alpha: 1.0, vy: -1.5, life: 40,
    });
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
    if (destroyed) {
      Sound.brickBreak();
      this._onBrickDestroyed(brick, source);
    } else {
      Sound.brickHit();
      var bc = brick.getCenter();
      this.particles.emitHitSpark(bc.x, bc.y, brick.color);
    }
  }

  damageBoss(damage) {
    if (!this.boss || !this.boss.alive) return;
    this.boss.hit(damage);
    Sound.brickHit();
    this.particles.emitBossHit(this.boss.getCenterX(), this.boss.getCenterY());
    this.score += damage;
    this._spawnExpOrbs(this.boss.getCenterX(), this.boss.getCenterY(), damage * 2);
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
      this._addFloatingText(this.combo + ' COMBO!', center.x, center.y - 10,
        Config.NEON_YELLOW, 14 + Math.min(this.combo, 12));
      this.particles.emitCombo(center.x, center.y, this.combo);
    }

    var expValue = 3 + brick.maxHp * 1;
    switch (brick.type) {
      case 'shield':  expValue += 2; break;
      case 'split':   expValue += 1; break;
      case 'stealth': expValue += 3; break;
      case 'healer':  expValue += 4; break;
    }
    this._spawnExpOrbs(center.x, center.y, expValue);

    if (brick.type === 'split' && !brick.isSplitChild) {
      var children = BrickFactory.spawnSplitChildren(brick);
      this.bricks = this.bricks.concat(children);
    }

    var powerUp = maybeDropPowerUp(center.x, center.y);
    if (powerUp) this.powerUps.push(powerUp);
  }

  _applyPowerUp(powerUp) {
    Sound.powerUp();
    switch (powerUp.type) {
      case 'firerate':
        this.launcher.applyTempFireRate();
        this._addFloatingText('射速UP!', powerUp.x, powerUp.y, Config.NEON_YELLOW, 14);
        break;
      case 'spread':
        this.launcher.applyTempSpread();
        this._addFloatingText('散射!', powerUp.x, powerUp.y, Config.NEON_PINK, 14);
        break;
      case 'score':
        var bonus = 1 + Math.floor(this.currentChapter / 10);
        this.coinsEarned += bonus;
        this._addFloatingText('+' + bonus + '💰', powerUp.x, powerUp.y, Config.NEON_GREEN, 14);
        break;
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
    } else {
      return Math.floor(baseReward * 0.3 * coinMult) + brickCoins;
    }
  }

  // ===== 主更新 =====
  update(timestamp) {
    if (this.lastTime === 0) this.lastTime = timestamp;
    var dtMs = Math.min(timestamp - this.lastTime, 50);
    this.lastTime = timestamp;
    var dt = dtMs / 16.67;

    for (var i = this.evolveNotifications.length - 1; i >= 0; i--) {
      this.evolveNotifications[i].timer -= dt;
      if (this.evolveNotifications[i].timer <= 0) this.evolveNotifications.splice(i, 1);
    }

    switch (this.state) {
      case Config.STATE.LOADING:
        this.loadTimer -= dt;
        if (this.loadTimer <= 0) this.state = Config.STATE.TITLE;
        break;
      case Config.STATE.TITLE:
        if (this.input.consumeTap()) {
          Sound.init();
          Sound.gameStart();
          this.state = Config.STATE.CHAPTER_SELECT;
        }
        break;
      case Config.STATE.CHAPTER_SELECT:
        this._updateChapterSelect();
        break;
      case Config.STATE.UPGRADE_SHOP:
        this._updateUpgradeShop();
        break;
      case Config.STATE.PLAYING:
        this._updatePlaying(dt, dtMs);
        break;
      case Config.STATE.BOSS:
        this._updateBoss(dt, dtMs);
        break;
      case Config.STATE.LEVEL_UP:
        this._updateExpOrbs(dt);
        this._updateFloatingTexts(dt);
        this.particles.update(dt);
        this._updateLevelUp();
        break;
      case Config.STATE.CHAPTER_CLEAR:
        this._updateChapterClear();
        break;
      case Config.STATE.GAME_OVER:
        this._updateGameOver();
        break;
    }
  }

  _updateChapterSelect() {
    var tap = this.input.consumeTap();
    if (!tap) return;
    var result = this.renderer.getChapterSelectHit(
      tap, this.saveManager.getMaxChapter(),
      this.saveManager.getData().chapterRecords,
      this.saveManager.getCoins()
    );
    if (result === 'upgrade') {
      this.state = Config.STATE.UPGRADE_SHOP;
    } else if (result === 'sound') {
      Sound.toggle();
    } else if (typeof result === 'number' && result > 0 && result <= this.saveManager.getMaxChapter()) {
      this.currentChapter = result;
      this._initGame();
    }
  }

  _updateUpgradeShop() {
    var tap = this.input.consumeTap();
    if (!tap) return;
    var result = this.renderer.getUpgradeShopHit(tap, this.saveManager);
    if (result === 'back') {
      this.state = Config.STATE.CHAPTER_SELECT;
    } else if (result && typeof result === 'string') {
      var success = this.saveManager.upgradeLevel(result);
      if (success) Sound.selectSkill();
    }
  }

  _updateChapterClear() {
    var tap = this.input.consumeTap();
    if (!tap) return;
    var result = this.renderer.getChapterClearHit(tap);
    if (result === 'next') {
      this.currentChapter = Math.min(this.currentChapter + 1, this.saveManager.getMaxChapter());
      this._initGame();
    } else if (result === 'back') {
      this.state = Config.STATE.CHAPTER_SELECT;
    }
  }

  _updateGameOver() {
    var tap = this.input.consumeTap();
    if (!tap) return;
    var coins = this._calcCoinsEarned(false);
    if (coins > 0) this.saveManager.addCoins(coins);
    this.state = Config.STATE.CHAPTER_SELECT;
  }

  _updatePlaying(dt, dtMs) {
    this._handleInput();
    this.launcher.update(dt, dtMs);

    this.fireTimer += dtMs;
    var fireInterval = this.launcher.getFireInterval();
    if (this.fireTimer >= fireInterval) {
      this.fireTimer -= fireInterval;
      this._fireBullets();
    }

    this.elapsedMs += dtMs;
    this.currentPhase = ChapterConfig.getPhaseAt(this.currentChapter, this.elapsedMs);

    if (!this.bossTriggered && this.currentPhase.phase === 'boss') {
      this.bossTriggered = true;
      this.bossWarningTimer = Config.BOSS_WARNING_DURATION;
    }

    if (this.bossWarningTimer > 0) {
      this.bossWarningTimer -= dtMs;
      if (this.bossWarningTimer <= 0) {
        this._startBoss();
        return;
      }
    }

    this._scrollBricks(dt);
    this._updateBrickSpawn(dtMs);
    BrickFactory.updateSpecialBricks(this.bricks, dtMs);

    if (this._checkDangerLine()) {
      Sound.gameOver();
      this.state = Config.STATE.GAME_OVER;
      return;
    }

    this.upgrades.updateWeapons(dtMs, this);
    this._updateBullets(dt);
    this._updatePowerUps(dt);
    this._updateExpOrbs(dt);
    this.particles.update(dt);
    this._updateFloatingTexts(dt);

    if (this.combo > 0) {
      this.comboTimer += dtMs;
      if (this.comboTimer > 2000) { this.combo = 0; this.comboTimer = 0; }
    }

    this._tryShowLevelUpChoice();
  }

  _updateBoss(dt, dtMs) {
    this._handleInput();
    this.launcher.update(dt, dtMs);

    this.fireTimer += dtMs;
    var fireInterval = this.launcher.getFireInterval();
    if (this.fireTimer >= fireInterval) {
      this.fireTimer -= fireInterval;
      this._fireBullets();
    }

    if (this.boss && this.boss.alive) {
      this.boss.update(dtMs);
      var spawned = this.boss.collectSpawnedBricks();
      if (spawned.length > 0) this.bricks = this.bricks.concat(spawned);
    }

    this._scrollBricks(dt);
    BrickFactory.updateSpecialBricks(this.bricks, dtMs);

    if (this._checkDangerLine()) {
      Sound.gameOver();
      this.state = Config.STATE.GAME_OVER;
      return;
    }

    this.upgrades.updateWeapons(dtMs, this);
    this._updateBullets(dt);
    this._updatePowerUps(dt);
    this._updateExpOrbs(dt);
    this.particles.update(dt);
    this._updateFloatingTexts(dt);

    this._tryShowLevelUpChoice();
    if (this.state === Config.STATE.LEVEL_UP) return;

    if (this.boss && !this.boss.alive) {
      Sound.bossDefeat();
      this.score += 500;
      this._addFloatingText('BOSS DEFEATED!', this.gameWidth / 2, this.gameHeight / 3, Config.NEON_YELLOW, 22);
      this.coinsEarned = this._calcCoinsEarned(true);
      var isFirst = !this.saveManager.isChapterCleared(this.currentChapter);
      this.saveManager.setChapterRecord(this.currentChapter, this.score, this.playerLevel);
      if (isFirst && this.currentChapter >= this.saveManager.getMaxChapter()) {
        this.saveManager.unlockNextChapter();
      }
      this.saveManager.addCoins(this.coinsEarned);
      this.boss = null;
      this.state = Config.STATE.CHAPTER_CLEAR;
    }
  }

  _startBoss() {
    for (var i = 0; i < this.bricks.length; i++) {
      if (this.bricks[i].alive && this.bricks[i].y < this.gameHeight * 0.3) {
        this.bricks[i].alive = false;
      }
    }
    this.state = Config.STATE.BOSS;
    this.boss = createBoss(this.chapterConfig.bossType, this.currentChapter, this.gameWidth);
    Sound.bossAppear();
  }

  _scrollBricks(dt) {
    if (!this.chapterConfig) return;
    var baseSpeed = this.chapterConfig.scrollSpeed;
    var slowMult = this.upgrades.getAdvanceSlowMult();
    for (var i = 0; i < this.bricks.length; i++) {
      var brick = this.bricks[i];
      if (!brick.alive) continue;
      brick.y += baseSpeed * slowMult * brick.speedMult * dt;
    }
    for (var j = this.bricks.length - 1; j >= 0; j--) {
      if (!this.bricks[j].alive || this.bricks[j].y > this.gameHeight + 50) {
        this.bricks.splice(j, 1);
      }
    }
  }

  _checkDangerLine() {
    var dangerY = this.gameHeight * Config.BRICK_DANGER_Y;
    for (var i = 0; i < this.bricks.length; i++) {
      if (this.bricks[i].alive && this.bricks[i].y + this.bricks[i].height >= dangerY) return true;
    }
    return false;
  }

  _updateBrickSpawn(dtMs) {
    if (!this.chapterConfig || !this.currentPhase || this.currentPhase.spawnMult <= 0) return;
    var interval = this.chapterConfig.spawnInterval / this.currentPhase.spawnMult;
    this.spawnTimer += dtMs;
    if (this.spawnTimer >= interval) {
      this.spawnTimer -= interval;
      this._spawnNewRow();
    }
  }

  _updateLevelUp() {
    var tap = this.input.consumeTap();
    if (tap && this.pendingUpgradeChoices.length > 0) {
      for (var i = 0; i < this.pendingUpgradeChoices.length; i++) {
        var ug = this.pendingUpgradeChoices[i];
        if (ug._hitArea) {
          var ha = ug._hitArea;
          if (tap.x >= ha.x && tap.x <= ha.x + ha.w && tap.y >= ha.y && tap.y <= ha.y + ha.h) {
            Sound.selectSkill();
            this.upgrades.applyChoice(ug);
            this._syncLauncherStats();

            var evolves = this.upgrades.checkEvolve();
            for (var j = 0; j < evolves.length; j++) {
              var ev = evolves[j];
              Sound.evolve();
              this.evolveNotifications.push({ name: ev.name, icon: ev.icon, color: ev.color, timer: 120 });
              this._addFloatingText('进化! ' + ev.name, this.gameWidth / 2, this.gameHeight / 2, ev.color, 20);
            }

            if (ug.type === 'buff' && ug.key === 'clearBomb') this._clearBottomBricks();

            if (this.pendingLevelUps > 0) {
              this.pendingLevelUps--;
              this.pendingUpgradeChoices = this.upgrades.generateChoices();
              if (this.pendingUpgradeChoices.length === 0) {
                this.pendingLevelUps = 0;
                this.state = this._preUpgradeState || Config.STATE.PLAYING;
                this._preUpgradeState = null;
              }
            } else {
              this.state = this._preUpgradeState || Config.STATE.PLAYING;
              this._preUpgradeState = null;
            }
            return;
          }
        }
      }
    }
  }

  _syncLauncherStats() {
    if (!this.launcher) return;
    this.launcher.permFireRateBonus = this.upgrades.getFireRateBonus() + this.saveManager.getFireRateBonus();
    this.launcher.permSpreadBonus = this.upgrades.getSpreadBonus();
    this.launcher.bulletDamage = 1 + this.upgrades.getBulletDamageBonus() + this.saveManager.getAttackBonus();
  }

  _clearBottomBricks() {
    var dangerY = this.gameHeight * Config.BRICK_DANGER_Y;
    var alive = this.bricks.filter(function(b) { return b.alive; }).sort(function(a, b) { return b.y - a.y; });
    var count = Math.min(alive.length, Config.BRICK_COLS);
    for (var i = 0; i < count; i++) {
      var brick = alive[i];
      this.particles.emitBrickBreak(brick.x, brick.y, brick.width, brick.height, brick.color);
      brick.alive = false;
      this.score += 5;
    }
    if (count > 0) {
      Sound.brickBreak();
      this._addFloatingText('清屏!', this.gameWidth / 2, dangerY - 30, Config.NEON_PINK, 16);
    }
  }

  _handleInput() {
    var deltaX = this.input.getPaddleDeltaX();
    if (deltaX !== 0) this.launcher.setX(this.launcher.getCenterX() + deltaX);
  }

  _updateBullets(dt) {
    for (var i = this.bullets.length - 1; i >= 0; i--) {
      var bullet = this.bullets[i];
      bullet.update(dt);

      if (bullet.isOutOfBounds(this.gameWidth, this.gameHeight)) {
        this.bullets.splice(i, 1);
        continue;
      }

      // LaserTurret: 激光范围内子弹被消除
      if (this.boss && this.boss.alive && this.boss.type === 'laser' && this.boss.isInLaserZone && this.boss.isInLaserZone(bullet.x, bullet.y)) {
        this.bullets.splice(i, 1);
        continue;
      }

      var removed = false;

      for (var j = 0; j < this.bricks.length; j++) {
        var brick = this.bricks[j];
        if (!brick.alive) continue;
        if (brick.type === 'stealth' && !brick.visible) continue;
        if (bullet.collideBrick(brick)) {
          var critChance = this.upgrades.getCritChance() + this.saveManager.getCritBonus();
          var critMult = (Math.random() < critChance) ? 2 : 1;
          var damage = Math.max(1, Math.floor(bullet.damage * critMult));
          this.damageBrick(brick, damage, 'bullet');
          if (critMult > 1) {
            Sound.crit();
            var bc = brick.getCenter();
            this._addFloatingText('暴击!', bc.x, bc.y - 10, Config.NEON_RED, 14);
          }
          if (bullet.pierce > 0) {
            bullet.pierce--;
          } else {
            this.bullets.splice(i, 1);
            removed = true;
            break;
          }
        }
      }

      if (removed) continue;

      if (this.boss && this.boss.alive) {
        // Guardian: 检查护盾
        if (this.boss.type === 'guardian' && this.boss.hitShield && this.boss.hitShield(bullet.x, bullet.y, bullet.radius)) {
          this.bullets.splice(i, 1);
          Sound.brickHit();
          continue;
        }
        if (bullet.collideBoss(this.boss)) {
          var bossCritChance = this.upgrades.getCritChance() + this.saveManager.getCritBonus();
          var bossCritMult = (Math.random() < bossCritChance) ? 2 : 1;
          this.damageBoss(Math.floor(bullet.damage * 3 * bossCritMult));
          if (bossCritMult > 1) {
            this._addFloatingText('暴击!', bullet.x, this.boss.y + this.boss.height + 10, Config.NEON_RED, 14);
          }
          this.bullets.splice(i, 1);
        }
      }
    }
  }

  _updatePowerUps(dt) {
    var magnetTarget = this.upgrades.hasMagnet() ? {
      x: this.launcher.getCenterX(), y: this.launcher.y,
    } : null;

    for (var i = this.powerUps.length - 1; i >= 0; i--) {
      var pu = this.powerUps[i];
      pu.update(dt, magnetTarget);
      if (pu.collideLauncher(this.launcher)) {
        this._applyPowerUp(pu);
        this.powerUps.splice(i, 1);
        continue;
      }
      if (pu.isOutOfBounds(this.gameHeight)) this.powerUps.splice(i, 1);
    }
  }

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
      case Config.STATE.LOADING:
        this.renderer.drawLoading();
        break;
      case Config.STATE.TITLE:
        this.renderer.drawTitle();
        break;
      case Config.STATE.CHAPTER_SELECT:
        this.renderer.drawChapterSelect(
          this.saveManager.getMaxChapter(),
          this.saveManager.getData().chapterRecords,
          this.saveManager.getCoins()
        );
        break;
      case Config.STATE.UPGRADE_SHOP:
        this.renderer.drawUpgradeShop(this.saveManager);
        break;
      case Config.STATE.PLAYING:
        this._renderGame();
        if (this.bossWarningTimer > 0) {
          this.renderer.drawBossWarning(this.chapterConfig.bossType);
        }
        break;
      case Config.STATE.BOSS:
        this._renderGame();
        break;
      case Config.STATE.LEVEL_UP:
        this._renderGame();
        this.renderer.drawLevelUpChoice(this.pendingUpgradeChoices, this.playerLevel, this.upgrades);
        break;
      case Config.STATE.CHAPTER_CLEAR:
        this.renderer.drawChapterClear(
          this.currentChapter, this.score, this.playerLevel,
          this.maxCombo, this.upgrades.getOwnedList(),
          this.coinsEarned,
          this.saveManager.getChapterRecord(this.currentChapter).bestScore === this.score
        );
        break;
      case Config.STATE.GAME_OVER:
        this._renderGame();
        this.renderer.drawGameOver(this.score, this.playerLevel, this.upgrades.getOwnedList());
        break;
    }

    if (this.evolveNotifications.length > 0) {
      this.renderer.drawEvolveNotification(this.evolveNotifications[0]);
    }
  }

  _renderGame() {
    var shaking = false;
    if (this.screenShake > 0.5) {
      shaking = true;
      var shakeX = (Math.random() - 0.5) * this.screenShake;
      var shakeY = (Math.random() - 0.5) * this.screenShake;
      this.renderer.ctx.save();
      this.renderer.ctx.translate(shakeX * this.renderer.dpr, shakeY * this.renderer.dpr);
      this.screenShake *= 0.85;
      if (this.screenShake < 0.5) this.screenShake = 0;
    }

    var dangerY = this.gameHeight * Config.BRICK_DANGER_Y;
    this.renderer.drawDangerLine(dangerY);

    for (var i = 0; i < this.bricks.length; i++) this.renderer.drawBrick(this.bricks[i]);
    if (this.boss && this.boss.alive) this.renderer.drawBoss(this.boss);
    for (var j = 0; j < this.powerUps.length; j++) this.renderer.drawPowerUp(this.powerUps[j]);

    this.renderer.drawExpOrbs(this.expOrbs);
    this.renderer.drawWeapons(this.upgrades.weapons, this.launcher);
    for (var k = 0; k < this.bullets.length; k++) this.renderer.drawBullet(this.bullets[k]);
    if (this.launcher) this.renderer.drawLauncher(this.launcher);

    this.renderer.drawParticles(this.particles.particles);
    this.renderer.drawFloatingTexts(this.floatingTexts);
    this.renderer.drawPassiveBar(this.upgrades.getOwnedList());

    this.renderer.drawChapterHUD(
      this.currentChapter, this.score, this.combo,
      this.playerLevel, this.elapsedMs, Sound.enabled
    );
    this.renderer.drawExpBar(this.exp, this.expToNext, this.playerLevel);

    if (shaking) this.renderer.ctx.restore();
  }
}

module.exports = Game;