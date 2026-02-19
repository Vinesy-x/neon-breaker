/**
 * Game.js - v4.0 打飞机模式
 * 发射器左右移动，自动往上射子弹打砖块
 * 保留：武器系统、经验升级、砖块前移、Boss
 */
const Config = require('./Config');
const Bullet = require('./Bullet');
const Launcher = require('./Launcher');
const { Brick, generateBricks } = require('./Brick');
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
    this.level = 1;
    this.score = 0;
    this.lives = Config.INITIAL_LIVES;
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

    // 砖块前移
    this.advanceTimer = 0;
    this.advanceInterval = Config.BRICK_ADVANCE_INTERVAL;
    this.advanceWarning = false;
    this.advanceSlowMult = 1;

    // 发射计时
    this.fireTimer = 0;

    this.pendingUpgradeChoices = [];

    // 进化通知
    this.evolveNotifications = [];

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

  _initLevel() {
    const isBossLevel = (this.level % Config.BOSS_TRIGGER_INTERVAL === 0);

    this.launcher = new Launcher(this.gameWidth, this.gameHeight);
    this.launcher.applyPermWiden(0); // 重置
    this.launcher.permFireRateBonus = this.upgrades.getFireRateBonus();
    this.launcher.permSpreadBonus = this.upgrades.getSpreadBonus();
    this.launcher.bulletDamage = 1 + this.upgrades.getBulletDamageBonus();
    this.launcher.reset(this.gameWidth, this.gameHeight);

    this.bullets = [];
    this.powerUps = [];
    this.particles.clear();
    this.floatingTexts = [];
    this.combo = 0;
    this.fireTimer = 0;

    this.advanceTimer = 0;
    this.advanceSlowMult = this.upgrades.getAdvanceSlowMult();
    this.advanceInterval = Config.BRICK_ADVANCE_INTERVAL / Math.max(0.3, this.advanceSlowMult);
    this.advanceWarning = false;

    if (isBossLevel) {
      this.state = Config.STATE.BOSS;
      this.bricks = [];
      this.boss = new Boss(this.level, this.gameWidth);
      Sound.bossAppear();
    } else {
      this.state = Config.STATE.PLAYING;
      this.bricks = generateBricks(this.level, this.gameWidth);
      this.boss = null;
    }
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

      let angle = -Math.PI / 2; // 正上方
      if (count > 1) {
        // 均匀分布在扇形内
        angle = -Math.PI / 2 - spread / 2 + (spread / (count - 1)) * i;
      }

      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      const bullet = new Bullet(cx, startY, vx, vy, damage);
      bullet.pierce = pierce;
      this.bullets.push(bullet);
    }

    this.launcher.muzzleFlash = 3;
    // 只在低射速时播放音效（高射速时太吵）
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
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        value: Math.ceil(perOrb),
        life: 0,
        collected: false,
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

  // ===== 武器系统回调 =====
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

    // 掉经验球
    const expValue = Config.EXP_PER_BRICK + Config.EXP_PER_HP * brick.maxHp;
    this._spawnExpOrbs(center.x, center.y, expValue);

    // 掉道具
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
        const bonus = 50 * this.level;
        this.score += bonus;
        this._addFloatingText('+' + bonus, powerUp.x, powerUp.y, Config.NEON_GREEN, 14);
        break;
    }
  }

  // ===== 砖块前移 =====
  _advanceBricks(dtMs) {
    this.advanceTimer += dtMs;
    this.advanceWarning = (this.advanceTimer > this.advanceInterval - 2000);

    if (this.advanceTimer >= this.advanceInterval) {
      this.advanceTimer = 0;
      const dangerY = this.gameHeight * Config.BRICK_DANGER_Y;
      for (let i = 0; i < this.bricks.length; i++) {
        if (!this.bricks[i].alive) continue;
        this.bricks[i].advance(Config.BRICK_ADVANCE_STEP);
        if (this.bricks[i].y + this.bricks[i].height >= dangerY) {
          this.state = Config.STATE.GAME_OVER;
          return;
        }
      }
      this.particles.emitAdvanceWarning(this.gameWidth);
      Sound.advanceWarning();
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
          this.level = 1;
          this.score = 0;
          this.lives = Config.INITIAL_LIVES;
          this.combo = 0;
          this.maxCombo = 0;
          this.playerLevel = 1;
          this.exp = 0;
          this.expToNext = this._calcExpToLevel(1);
          this.expOrbs = [];
          this.pendingLevelUps = 0;
          this.upgrades.reset();
          this.evolveNotifications = [];
          this._initLevel();
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

      case Config.STATE.LEVEL_CLEAR:
        this._updateLevelClear(dt);
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

    this._advanceBricks(dtMs);
    if (this.state === Config.STATE.GAME_OVER) return;

    this.advanceSlowMult = 1;
    this.upgrades.updateWeapons(dtMs, this);

    this._updateBullets(dt);
    this._updatePowerUps(dt);
    this._updateExpOrbs(dt);
    this.particles.update(dt);
    this._updateFloatingTexts(dt);

    // 检查升级
    this._tryShowLevelUpChoice();
    if (this.state === Config.STATE.LEVEL_UP) return;

    // 关卡完成
    const allDead = this.bricks.every(b => !b.alive);
    if (allDead && this.bricks.length > 0) this._onLevelClear();
  }

  _updateBoss(dt, dtMs) {
    this._handleInput();
    this.launcher.update(dt, dtMs);

    // 自动发射子弹
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
      this.score += 500 * this.level;
      this._addFloatingText('BOSS DEFEATED!', this.gameWidth / 2, this.gameHeight / 3, Config.NEON_YELLOW, 22);
      this._onLevelClear();
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

            // 应用新数值到发射器
            this._syncLauncherStats();

            // 检查进化
            const evolves = this.upgrades.checkEvolve();
            for (const ev of evolves) {
              Sound.evolve();
              this.evolveNotifications.push({
                name: ev.name, icon: ev.icon, color: ev.color, timer: 120,
              });
              this._addFloatingText('进化! ' + ev.name, this.gameWidth / 2, this.gameHeight / 2, ev.color, 20);
            }

            if (ug.type === 'buff' && ug.key === 'extraLife') this.lives++;

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

  /** 同步升级后的数值到发射器 */
  _syncLauncherStats() {
    if (!this.launcher) return;
    this.launcher.permFireRateBonus = this.upgrades.getFireRateBonus();
    this.launcher.permSpreadBonus = this.upgrades.getSpreadBonus();
    this.launcher.bulletDamage = 1 + this.upgrades.getBulletDamageBonus();
  }

  _updateLevelClear(dt) {
    this._levelClearTimer = (this._levelClearTimer || 0) + dt;
    this._updateExpOrbs(dt);
    this._updateFloatingTexts(dt);
    this.particles.update(dt);

    if (this._levelClearTimer > 40) {
      this._levelClearTimer = 0;
      this.level++;
      this._initLevel();
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

      // 出界
      if (bullet.isOutOfBounds(this.gameWidth, this.gameHeight)) {
        this.bullets.splice(i, 1);
        continue;
      }

      let removed = false;

      // 碰撞砖块
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

          this.combo++;

          if (bullet.pierce > 0) {
            bullet.pierce--;
            // 穿透，继续飞
          } else {
            this.bullets.splice(i, 1);
            removed = true;
            break;
          }
        }
      }

      if (removed) continue;

      // 碰撞Boss
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

  _onLevelClear() {
    this._levelClearTimer = 0;
    this.state = Config.STATE.LEVEL_CLEAR;
    Sound.levelClear();
    this._addFloatingText('CLEAR!', this.gameWidth / 2, this.gameHeight * 0.35, Config.NEON_GREEN, 24);
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
      case Config.STATE.LEVEL_CLEAR:
        this._renderGame();
        break;
      case Config.STATE.GAME_OVER:
        this._renderGame();
        this.renderer.drawGameOver(this.score, this.level, this.playerLevel, this.upgrades.getOwnedList());
        break;
    }

    // 进化通知
    if (this.evolveNotifications.length > 0) {
      this.renderer.drawEvolveNotification(this.evolveNotifications[0]);
    }
  }

  _renderGame() {
    const dangerY = this.gameHeight * Config.BRICK_DANGER_Y;
    this.renderer.drawDangerLine(dangerY, this.advanceWarning);
    this.renderer.drawAdvanceBar(this.advanceTimer, this.advanceInterval);

    for (let i = 0; i < this.bricks.length; i++) this.renderer.drawBrick(this.bricks[i]);
    if (this.boss && this.boss.alive) this.renderer.drawBoss(this.boss);
    for (let i = 0; i < this.powerUps.length; i++) this.renderer.drawPowerUp(this.powerUps[i]);

    // 经验球
    this.renderer.drawExpOrbs(this.expOrbs);

    this.renderer.drawWeapons(this.upgrades.weapons, this.launcher);
    for (let i = 0; i < this.bullets.length; i++) this.renderer.drawBullet(this.bullets[i]);
    if (this.launcher) this.renderer.drawLauncher(this.launcher);

    this.renderer.drawParticles(this.particles.particles);
    this.renderer.drawFloatingTexts(this.floatingTexts);
    this.renderer.drawPassiveBar(this.upgrades.getOwnedList());

    // HUD + 经验条
    this.renderer.drawHUD(this.score, this.lives, this.combo, this.level, Sound.enabled);
    this.renderer.drawExpBar(this.exp, this.expToNext, this.playerLevel);
  }
}

module.exports = Game;
