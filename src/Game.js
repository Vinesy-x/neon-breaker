/**
 * Game.js - v4.1 无限射击模式
 * 没有关卡，砖块持续从上方缓慢下移
 * 砖块到底线 = Game Over
 */
const Config = require('./Config');
const Bullet = require('./Bullet');
const Launcher = require('./Launcher');
const { Brick, generateBrickRow } = require('./Brick');
const { ParticleManager } = require('./Particle');
const { PowerUp, maybeDropPowerUp } = require('./PowerUp');
const UpgradeManager = require('./Skill');
const Boss = require('./Boss');
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

    this.bullets = [];
    this.bricks = [];
    this.launcher = null;
    this.particles = new ParticleManager();
    this.powerUps = [];
    this.upgrades = new UpgradeManager();
    this.boss = null;
    this.floatingTexts = [];

    // ===== 经验系统 =====
    this.playerLevel = 1;
    this.exp = 0;
    this.expToNext = Config.EXP_BASE_TO_LEVEL;
    this.expOrbs = [];
    this.pendingLevelUps = 0;

    // 砖块持续下移
    this.brickSpeed = Config.BRICK_SCROLL_SPEED; // px/frame
    this.spawnTimer = 0; // 生成新行计时
    this.difficulty = 0; // 难度递增计数（用于HP递增）
    this.difficultyTimer = 0;

    // 发射计时
    this.fireTimer = 0;

    this.pendingUpgradeChoices = [];

    // 进化通知
    this.evolveNotifications = [];

    // Boss
    this.bossTimer = 0;
    this.bossesDefeated = 0;

    // 记录升级前的状态
    this._preUpgradeState = null;

    this.lastTime = 0;
    this.loadTimer = 0;

    this._startLoading();
  }

  _startLoading() {
    this.state = Config.STATE.LOADING;
    this.loadTimer = 60;
  }

  _initGame() {
    this.launcher = new Launcher(this.gameWidth, this.gameHeight);
    this.launcher.reset(this.gameWidth, this.gameHeight);

    this.bullets = [];
    this.bricks = [];
    this.powerUps = [];
    this.particles.clear();
    this.floatingTexts = [];
    this.expOrbs = [];
    this.combo = 0;
    this.fireTimer = 0;
    this.spawnTimer = 0;
    this.difficulty = 0;
    this.difficultyTimer = 0;
    this.brickSpeed = Config.BRICK_SCROLL_SPEED;
    this.boss = null;
    this.bossTimer = 0;
    this.bossesDefeated = 0;

    // 生成初始几行砖块
    const initRows = Config.BRICK_INIT_ROWS;
    for (let r = 0; r < initRows; r++) {
      const y = Config.BRICK_TOP_OFFSET + r * (Config.BRICK_HEIGHT + Config.BRICK_PADDING);
      const row = generateBrickRow(this.gameWidth, y, this.difficulty);
      this.bricks = this.bricks.concat(row);
    }

    this.state = Config.STATE.PLAYING;
  }

  // ===== 砖块持续生成 =====
  _spawnNewRow() {
    // 在屏幕上方生成新行（刚好在可见区域外）
    const y = Config.BRICK_TOP_OFFSET - Config.BRICK_HEIGHT - Config.BRICK_PADDING;
    const row = generateBrickRow(this.gameWidth, y, this.difficulty);
    this.bricks = this.bricks.concat(row);
  }

  // ===== 子弹发射 =====
  _fireBullets() {
    const count = this.launcher.getBulletCount();
    const spread = this.launcher.getSpreadAngle();
    const cx = this.launcher.getCenterX();
    const startY = this.launcher.y - 5;
    const speed = Config.BULLET_SPEED;
    const damage = this.launcher.bulletDamage;
    const pierce = this.upgrades.getPierceCount();

    for (let i = 0; i < count; i++) {
      if (this.bullets.length >= Config.BULLET_MAX) break;

      let angle = -Math.PI / 2;
      if (count > 1) {
        angle = -Math.PI / 2 - spread / 2 + (spread / (count - 1)) * i;
      }

      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      const bullet = new Bullet(cx, startY, vx, vy, damage);
      bullet.pierce = pierce;
      this.bullets.push(bullet);
    }

    this.launcher.muzzleFlash = 3;
    if (this.launcher.getFireInterval() > 120) {
      Sound.bulletShoot();
    }
  }

  _addFloatingText(text, x, y, color, size) {
    this.floatingTexts.push({
      text, x, y, color: color || Config.NEON_YELLOW,
      size: size || 16, alpha: 1.0, vy: -1.5, life: 40,
    });
  }

  // ===== 经验系统 =====
  _calcExpToLevel(lv) {
    return Math.floor(Config.EXP_BASE_TO_LEVEL * Math.pow(Config.EXP_GROWTH, lv - 1));
  }

  _spawnExpOrbs(x, y, totalExp) {
    const orbCount = Math.min(Math.ceil(totalExp / 5), 5);
    const perOrb = totalExp / orbCount;
    for (let i = 0; i < orbCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 2;
      this.expOrbs.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        value: Math.ceil(perOrb),
        life: 0,
      });
    }
  }

  _updateExpOrbs(dt) {
    const targetX = Config.SCREEN_WIDTH / 2;
    const targetY = Config.SCREEN_HEIGHT - Config.EXP_BAR_Y_OFFSET;

    for (let i = this.expOrbs.length - 1; i >= 0; i--) {
      const orb = this.expOrbs[i];
      orb.life += dt;

      if (orb.life < 8) {
        orb.x += orb.vx * dt;
        orb.y += orb.vy * dt;
        orb.vx *= 0.95;
        orb.vy *= 0.95;
      } else {
        const dx = targetX - orb.x;
        const dy = targetY - orb.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const speed = Config.EXP_ORB_SPEED + orb.life * 0.3;
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
      this._addFloatingText('LEVEL UP!', this.gameWidth / 2, this.gameHeight * 0.4,
        Config.NEON_GREEN, 20);
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

  // ===== 伤害回调 =====
  damageBrick(brick, damage, source) {
    if (!brick.alive) return;
    const destroyed = brick.hit(damage);
    if (destroyed) {
      Sound.brickBreak();
      this._onBrickDestroyed(brick, source);
    } else {
      Sound.brickHit();
      const bc = brick.getCenter();
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
    const center = brick.getCenter();
    this.particles.emitBrickBreak(brick.x, brick.y, brick.width, brick.height, brick.color);

    this.combo++;
    if (this.combo > this.maxCombo) this.maxCombo = this.combo;
    const multiplier = 1 + Math.floor(this.combo / 5) * 0.5;
    const points = Math.floor(Config.COMBO_SCORE_BASE * brick.maxHp * multiplier);
    this.score += points;

    if (this.combo > 1 && this.combo % 5 === 0) {
      Sound.combo(this.combo);
      this._addFloatingText(this.combo + ' COMBO!', center.x, center.y - 10,
        Config.NEON_YELLOW, 14 + Math.min(this.combo, 12));
      this.particles.emitCombo(center.x, center.y, this.combo);
    }

    const expValue = Config.EXP_PER_BRICK + Config.EXP_PER_HP * brick.maxHp;
    this._spawnExpOrbs(center.x, center.y, expValue);

    const powerUp = maybeDropPowerUp(center.x, center.y);
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
        const bonus = 50 + this.difficulty * 10;
        this.score += bonus;
        this._addFloatingText('+' + bonus, powerUp.x, powerUp.y, Config.NEON_GREEN, 14);
        break;
    }
  }

  // ===== 主更新 =====
  update(timestamp) {
    if (this.lastTime === 0) this.lastTime = timestamp;
    const dtMs = Math.min(timestamp - this.lastTime, 50);
    this.lastTime = timestamp;
    const dt = dtMs / 16.67;

    // 进化通知淡出
    for (let i = this.evolveNotifications.length - 1; i >= 0; i--) {
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
          this.score = 0;
          this.combo = 0;
          this.maxCombo = 0;
          this.playerLevel = 1;
          this.exp = 0;
          this.expToNext = this._calcExpToLevel(1);
          this.expOrbs = [];
          this.pendingLevelUps = 0;
          this.upgrades.reset();
          this.evolveNotifications = [];
          this._initGame();
        }
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

      case Config.STATE.GAME_OVER:
        if (this.input.consumeTap()) this.state = Config.STATE.TITLE;
        break;
    }
  }

  _updatePlaying(dt, dtMs) {
    this._handleInput();
    this.launcher.update(dt, dtMs);

    // 自动发射子弹
    this.fireTimer += dtMs;
    const fireInterval = this.launcher.getFireInterval();
    if (this.fireTimer >= fireInterval) {
      this.fireTimer -= fireInterval;
      this._fireBullets();
    }

    // 砖块持续下移
    this._scrollBricks(dt);

    // 难度递增
    this._updateDifficulty(dtMs);

    // 生成新砖块行
    this._updateBrickSpawn(dtMs);

    // 检查砖块到底线
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

    // 检查升级
    this._tryShowLevelUpChoice();
    if (this.state === Config.STATE.LEVEL_UP) return;

    // Boss触发（每隔一段时间）
    this.bossTimer += dtMs;
    if (this.bossTimer >= Config.BOSS_TRIGGER_TIME) {
      this.bossTimer = 0;
      this._startBoss();
    }
  }

  _updateBoss(dt, dtMs) {
    this._handleInput();
    this.launcher.update(dt, dtMs);

    // 自动发射
    this.fireTimer += dtMs;
    const fireInterval = this.launcher.getFireInterval();
    if (this.fireTimer >= fireInterval) {
      this.fireTimer -= fireInterval;
      this._fireBullets();
    }

    if (this.boss && this.boss.alive) this.boss.update(dtMs);

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
      this.bossesDefeated++;
      this.score += 500 * (this.bossesDefeated);
      this._addFloatingText('BOSS DEFEATED!', this.gameWidth / 2, this.gameHeight / 3, Config.NEON_YELLOW, 22);
      this.boss = null;
      this.state = Config.STATE.PLAYING;
    }
  }

  _startBoss() {
    this.state = Config.STATE.BOSS;
    const bossLevel = this.bossesDefeated + 1;
    this.boss = new Boss(bossLevel, this.gameWidth);
    Sound.bossAppear();
  }

  // ===== 砖块持续下移 =====
  _scrollBricks(dt) {
    const speed = this.brickSpeed * dt;
    for (let i = 0; i < this.bricks.length; i++) {
      if (this.bricks[i].alive) {
        this.bricks[i].y += speed;
      }
    }
    // 清理已出屏幕底部的死砖块
    for (let i = this.bricks.length - 1; i >= 0; i--) {
      if (!this.bricks[i].alive || this.bricks[i].y > this.gameHeight + 50) {
        this.bricks.splice(i, 1);
      }
    }
  }

  // ===== 检查砖块到达危险线 =====
  _checkDangerLine() {
    const dangerY = this.gameHeight * Config.BRICK_DANGER_Y;
    for (let i = 0; i < this.bricks.length; i++) {
      if (this.bricks[i].alive && this.bricks[i].y + this.bricks[i].height >= dangerY) {
        return true;
      }
    }
    return false;
  }

  // ===== 定时生成新行 =====
  _updateBrickSpawn(dtMs) {
    this.spawnTimer += dtMs;
    if (this.spawnTimer >= Config.BRICK_SPAWN_INTERVAL) {
      this.spawnTimer -= Config.BRICK_SPAWN_INTERVAL;
      this._spawnNewRow();
    }
  }

  // ===== 难度递增 =====
  _updateDifficulty(dtMs) {
    this.difficultyTimer += dtMs;
    if (this.difficultyTimer >= Config.DIFFICULTY_INTERVAL) {
      this.difficultyTimer -= Config.DIFFICULTY_INTERVAL;
      this.difficulty++;
      // 砖块下移速度缓慢增加
      this.brickSpeed = Config.BRICK_SCROLL_SPEED + this.difficulty * Config.BRICK_SPEED_INCREMENT;
    }
  }

  _updateLevelUp() {
    const tap = this.input.consumeTap();
    if (tap && this.pendingUpgradeChoices.length > 0) {
      for (let i = 0; i < this.pendingUpgradeChoices.length; i++) {
        const ug = this.pendingUpgradeChoices[i];
        if (ug._hitArea) {
          const { x, y, w, h } = ug._hitArea;
          if (tap.x >= x && tap.x <= x + w && tap.y >= y && tap.y <= y + h) {
            Sound.selectSkill();
            this.upgrades.applyChoice(ug);
            this._syncLauncherStats();

            const evolves = this.upgrades.checkEvolve();
            for (const ev of evolves) {
              Sound.evolve();
              this.evolveNotifications.push({
                name: ev.name, icon: ev.icon, color: ev.color, timer: 120,
              });
              this._addFloatingText('进化! ' + ev.name, this.gameWidth / 2, this.gameHeight / 2, ev.color, 20);
            }

            if (ug.type === 'buff' && ug.key === 'clearBomb') {
              // 清除最靠近底线的一行砖块
              this._clearBottomBricks();
            }

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
    this.launcher.permFireRateBonus = this.upgrades.getFireRateBonus();
    this.launcher.permSpreadBonus = this.upgrades.getSpreadBonus();
    this.launcher.bulletDamage = 1 + this.upgrades.getBulletDamageBonus();
  }

  /** 清除最靠近底线的几个砖块 */
  _clearBottomBricks() {
    const dangerY = this.gameHeight * Config.BRICK_DANGER_Y;
    // 按Y排序，清掉最下面的一排（最多7个）
    const alive = this.bricks.filter(b => b.alive).sort((a, b) => b.y - a.y);
    const count = Math.min(alive.length, Config.BRICK_COLS);
    for (let i = 0; i < count; i++) {
      const brick = alive[i];
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
    const deltaX = this.input.getPaddleDeltaX();
    if (deltaX !== 0) {
      this.launcher.setX(this.launcher.getCenterX() + deltaX);
    }
  }

  _updateBullets(dt) {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const bullet = this.bullets[i];
      bullet.update(dt);

      if (bullet.isOutOfBounds(this.gameWidth, this.gameHeight)) {
        this.bullets.splice(i, 1);
        continue;
      }

      let removed = false;

      for (let j = 0; j < this.bricks.length; j++) {
        const brick = this.bricks[j];
        if (!brick.alive) continue;
        if (bullet.collideBrick(brick)) {
          const critMult = (Math.random() < this.upgrades.getCritChance()) ? 2 : 1;
          const damage = Math.max(1, Math.floor(bullet.damage * critMult));
          this.damageBrick(brick, damage, 'bullet');
          if (critMult > 1) {
            Sound.crit();
            const bc = brick.getCenter();
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

      if (this.boss && this.boss.alive && bullet.collideBoss(this.boss)) {
        const critMult = (Math.random() < this.upgrades.getCritChance()) ? 2 : 1;
        this.damageBoss(Math.floor(bullet.damage * 3 * critMult));
        if (critMult > 1) {
          this._addFloatingText('暴击!', bullet.x, this.boss.y + this.boss.height + 10, Config.NEON_RED, 14);
        }
        this.bullets.splice(i, 1);
      }
    }
  }

  _updatePowerUps(dt) {
    const magnetTarget = this.upgrades.hasMagnet() ? {
      x: this.launcher.getCenterX(), y: this.launcher.y,
    } : null;

    for (let i = this.powerUps.length - 1; i >= 0; i--) {
      const pu = this.powerUps[i];
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
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const t = this.floatingTexts[i];
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
      case Config.STATE.PLAYING:
      case Config.STATE.BOSS:
        this._renderGame();
        break;
      case Config.STATE.LEVEL_UP:
        this._renderGame();
        this.renderer.drawLevelUpChoice(this.pendingUpgradeChoices, this.playerLevel, this.upgrades);
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
    // 危险线
    const dangerY = this.gameHeight * Config.BRICK_DANGER_Y;
    this.renderer.drawDangerLine(dangerY);

    for (let i = 0; i < this.bricks.length; i++) this.renderer.drawBrick(this.bricks[i]);
    if (this.boss && this.boss.alive) this.renderer.drawBoss(this.boss);
    for (let i = 0; i < this.powerUps.length; i++) this.renderer.drawPowerUp(this.powerUps[i]);

    this.renderer.drawExpOrbs(this.expOrbs);

    this.renderer.drawWeapons(this.upgrades.weapons, this.launcher);
    for (let i = 0; i < this.bullets.length; i++) this.renderer.drawBullet(this.bullets[i]);
    if (this.launcher) this.renderer.drawLauncher(this.launcher);

    this.renderer.drawParticles(this.particles.particles);
    this.renderer.drawFloatingTexts(this.floatingTexts);
    this.renderer.drawPassiveBar(this.upgrades.getOwnedList());

    this.renderer.drawHUD(this.score, this.combo, this.playerLevel, this.difficulty, Sound.enabled);
    this.renderer.drawExpBar(this.exp, this.expToNext, this.playerLevel);
  }
}

module.exports = Game;
