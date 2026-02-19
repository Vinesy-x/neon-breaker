/**
 * Game.js - 游戏主逻辑（v2.0 被动技能 + 砖块前移 + 肉鸽）
 */
const Config = require('./Config');
const Ball = require('./Ball');
const Paddle = require('./Paddle');
const { Brick, generateBricks } = require('./Brick');
const { ParticleManager } = require('./Particle');
const { PowerUp, maybeDropPowerUp } = require('./PowerUp');
const PassiveManager = require('./Skill');
const Boss = require('./Boss');
const Renderer = require('./Renderer');
const InputManager = require('./InputManager');

class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new Renderer(canvas);
    this.input = new InputManager();

    this.gameWidth = Config.SCREEN_WIDTH;
    this.gameHeight = Config.SCREEN_HEIGHT;

    // 状态
    this.state = Config.STATE.LOADING;
    this.level = 1;
    this.score = 0;
    this.lives = Config.INITIAL_LIVES;
    this.combo = 0;
    this.maxCombo = 0;

    // 游戏对象
    this.balls = [];
    this.bricks = [];
    this.paddle = null;
    this.particles = new ParticleManager();
    this.powerUps = [];
    this.passives = new PassiveManager();
    this.boss = null;
    this.floatingTexts = [];

    // 砖块前移
    this.advanceTimer = 0;
    this.advanceInterval = Config.BRICK_ADVANCE_INTERVAL;
    this.advanceWarning = false; // 前移预警闪烁

    // 被动系统内部状态
    this.baseBallSpeed = Config.BALL_SPEED;

    // 升级选择
    this.pendingUpgradeChoices = [];

    // 计时
    this.lastTime = 0;
    this.loadTimer = 0;

    // 被动技能持有列表（用于 HUD 显示）
    this.ownedPassives = []; // [{key, name, icon, color, level}]

    this._startLoading();
  }

  _startLoading() {
    this.state = Config.STATE.LOADING;
    this.loadTimer = 60;
  }

  // ===== 初始化关卡 =====
  _initLevel() {
    const isBossLevel = (this.level % Config.BOSS_TRIGGER_INTERVAL === 0);

    this.paddle = new Paddle(this.gameWidth, this.gameHeight);
    this.paddle.applyPermWiden(this.passives.getPaddleBonus());
    this.paddle.reset(this.gameWidth, this.gameHeight);

    this.balls = [];
    this.powerUps = [];
    this.particles.clear();
    this.floatingTexts = [];
    this.combo = 0;

    // 砖块前移重置
    this.advanceTimer = 0;
    this.advanceInterval = Config.BRICK_ADVANCE_INTERVAL * this.passives.getAdvanceSlowMult();
    this.advanceWarning = false;

    if (isBossLevel) {
      this.state = Config.STATE.BOSS;
      this.bricks = [];
      this.boss = new Boss(this.level, this.gameWidth);
    } else {
      this.state = Config.STATE.PLAYING;
      this.bricks = generateBricks(this.level, this.gameWidth);
      this.boss = null;
    }

    this._spawnInitialBalls();
  }

  _spawnInitialBalls() {
    const count = this.passives.getStartBallCount();
    for (let i = 0; i < count; i++) {
      this._spawnBall();
    }
  }

  _spawnBall() {
    if (this.balls.length >= Config.BALL_MAX) return;
    const speed = this.baseBallSpeed * this.passives.getBallSpeedMult();
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.4;
    const ball = new Ball(
      this.paddle ? this.paddle.getCenterX() : this.gameWidth / 2,
      this.paddle ? this.paddle.y - 20 : this.gameHeight - 150,
      Math.cos(angle) * speed,
      Math.sin(angle) * speed
    );
    this.balls.push(ball);
    return ball;
  }

  // ===== 浮动文字 =====
  _addFloatingText(text, x, y, color, size) {
    this.floatingTexts.push({
      text: text, x: x, y: y,
      color: color || Config.NEON_YELLOW,
      size: size || 16,
      alpha: 1.0, vy: -1.5, life: 40,
    });
  }

  // ===== 被动触发：连锁闪电 =====
  _triggerChain(brick) {
    const chance = this.passives.getChainChance();
    if (chance <= 0 || Math.random() > chance) return;

    const bounces = this.passives.getChainBounces();
    const center = brick.getCenter();
    let lastX = center.x;
    let lastY = center.y;
    let hits = 0;

    for (let b = 0; b < bounces; b++) {
      // 找最近的活砖
      let nearest = null;
      let nearestDist = Infinity;
      for (let i = 0; i < this.bricks.length; i++) {
        const br = this.bricks[i];
        if (!br.alive) continue;
        const bc = br.getCenter();
        const dx = bc.x - lastX;
        const dy = bc.y - lastY;
        const dist = dx * dx + dy * dy;
        if (dist > 0 && dist < nearestDist) {
          nearestDist = dist;
          nearest = br;
        }
      }
      if (!nearest) break;

      const nc = nearest.getCenter();
      // 画闪电粒子
      this.particles.emitChainLightning(lastX, lastY, nc.x, nc.y);

      const destroyed = nearest.hit(1);
      if (destroyed) {
        this._onBrickDestroyedBasic(nearest);
      }
      lastX = nc.x;
      lastY = nc.y;
      hits++;
    }

    if (hits > 0) {
      this._addFloatingText(`⚡x${hits}`, lastX, lastY - 10, Config.NEON_CYAN, 13);
    }
  }

  // ===== 被动触发：爆炸 =====
  _triggerExplosion(brick) {
    const radius = this.passives.getExplosionRadius();
    if (radius <= 0) return;

    const center = brick.getCenter();
    let hits = 0;

    for (let i = 0; i < this.bricks.length; i++) {
      const br = this.bricks[i];
      if (!br.alive) continue;
      const bc = br.getCenter();
      const dx = bc.x - center.x;
      const dy = bc.y - center.y;
      if (Math.sqrt(dx * dx + dy * dy) <= radius) {
        const destroyed = br.hit(1);
        if (destroyed) {
          this._onBrickDestroyedBasic(br);
        }
        hits++;
      }
    }

    this.particles.emitExplosion(center.x, center.y, radius);
    if (hits > 0) {
      this._addFloatingText(`✸${hits}`, center.x, center.y - 15, Config.NEON_ORANGE, 14);
    }
  }

  // ===== 被动触发：击砖分裂 =====
  _triggerSplit(brick) {
    if (!this.passives.canSplitOnBrick()) return;
    if (Math.random() > this.passives.getSplitChance()) return;
    if (this.balls.length >= Config.BALL_MAX) return;

    const center = brick.getCenter();
    const speed = this.baseBallSpeed * this.passives.getBallSpeedMult();
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.6;
    const nb = new Ball(center.x, center.y, Math.cos(angle) * speed, Math.sin(angle) * speed);
    nb.color = Config.NEON_PINK;
    this.balls.push(nb);
  }

  // ===== 被动触发：暴击 =====
  _rollCrit() {
    const chance = this.passives.getCritChance();
    if (chance <= 0) return 1;
    return Math.random() < chance ? this.passives.getCritMult() : 1;
  }

  // ===== 被动触发：吸血 =====
  _triggerLifesteal() {
    const chance = this.passives.getLifestealChance();
    if (chance > 0 && Math.random() < chance) {
      this.lives++;
      this._addFloatingText('♥+1', this.gameWidth / 2, this.gameHeight / 2, Config.NEON_PINK, 16);
    }
  }

  // ===== 砖块破坏（基础，不触发被动，防连锁递归） =====
  _onBrickDestroyedBasic(brick) {
    const center = brick.getCenter();
    this.particles.emitBrickBreak(brick.x, brick.y, brick.width, brick.height, brick.color);

    this.combo++;
    if (this.combo > this.maxCombo) this.maxCombo = this.combo;
    const multiplier = 1 + Math.floor(this.combo / 5) * 0.5;
    const points = Math.floor(Config.COMBO_SCORE_BASE * brick.maxHp * multiplier);
    this.score += points;

    if (this.combo > 1 && this.combo % 3 === 0) {
      this._addFloatingText(`${this.combo} COMBO!`, center.x, center.y - 10, Config.NEON_YELLOW, 14 + Math.min(this.combo, 10));
      this.particles.emitCombo(center.x, center.y, this.combo);
    }

    const powerUp = maybeDropPowerUp(center.x, center.y);
    if (powerUp) this.powerUps.push(powerUp);
  }

  // ===== 砖块破坏（完整，触发被动） =====
  _onBrickDestroyed(brick) {
    this._onBrickDestroyedBasic(brick);

    // 触发被动
    this._triggerChain(brick);
    this._triggerExplosion(brick);
    this._triggerSplit(brick);
    this._triggerLifesteal();
  }

  // ===== 道具效果 =====
  _applyPowerUp(powerUp) {
    switch (powerUp.type) {
      case 'multiball':
        for (let i = 0; i < 2; i++) this._spawnBall();
        this._addFloatingText('+2球!', powerUp.x, powerUp.y, Config.NEON_PINK, 14);
        break;
      case 'widen':
        this.paddle.applyTempWiden();
        this._addFloatingText('加宽!', powerUp.x, powerUp.y, Config.NEON_GREEN, 14);
        break;
      case 'score':
        const bonus = 50 * this.level;
        this.score += bonus;
        this._addFloatingText(`+${bonus}`, powerUp.x, powerUp.y, Config.NEON_YELLOW, 14);
        break;
    }
  }

  // ===== 升级应用 =====
  _applyUpgrade(upgrade) {
    this.passives.upgrade(upgrade.key);

    // 特殊处理
    if (upgrade.key === 'extraLife') {
      this.lives++;
    }

    // 更新持有列表
    const existing = this.ownedPassives.find(p => p.key === upgrade.key);
    if (existing) {
      existing.level = this.passives.getLevel(upgrade.key);
    } else {
      this.ownedPassives.push({
        key: upgrade.key,
        name: upgrade.name,
        icon: upgrade.icon,
        color: upgrade.color,
        level: 1,
      });
    }
  }

  // ===== 选择3个升级（不超过上限，排除满级） =====
  _generateUpgradeChoices() {
    const pool = Config.UPGRADES.filter(u => {
      const cur = this.passives.getLevel(u.key);
      return cur < u.maxLevel;
    });
    // Shuffle
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, 3);
  }

  // ===== 砖块前移 =====
  _advanceBricks(dtMs) {
    this.advanceTimer += dtMs;

    // 预警（最后2秒闪烁）
    this.advanceWarning = (this.advanceTimer > this.advanceInterval - 2000);

    if (this.advanceTimer >= this.advanceInterval) {
      this.advanceTimer = 0;

      const dangerY = this.gameHeight * Config.BRICK_DANGER_Y;

      for (let i = 0; i < this.bricks.length; i++) {
        if (!this.bricks[i].alive) continue;
        this.bricks[i].advance(Config.BRICK_ADVANCE_STEP);

        // 砖块到达危险线 = 游戏结束
        if (this.bricks[i].y + this.bricks[i].height >= dangerY) {
          this.state = Config.STATE.GAME_OVER;
          return;
        }
      }

      // 屏幕震动效果
      this.particles.emitAdvanceWarning(this.gameWidth);
    }
  }

  // ===== 主更新 =====
  update(timestamp) {
    if (this.lastTime === 0) this.lastTime = timestamp;
    const dtMs = Math.min(timestamp - this.lastTime, 50);
    this.lastTime = timestamp;
    const dt = dtMs / 16.67;

    switch (this.state) {
      case Config.STATE.LOADING:
        this._updateLoading(dt);
        break;
      case Config.STATE.TITLE:
        this._updateTitle();
        break;
      case Config.STATE.PLAYING:
        this._updatePlaying(dt, dtMs);
        break;
      case Config.STATE.BOSS:
        this._updateBoss(dt, dtMs);
        break;
      case Config.STATE.LEVEL_CLEAR:
        this._updateLevelClear();
        break;
      case Config.STATE.GAME_OVER:
        this._updateGameOver();
        break;
    }
  }

  _updateLoading(dt) {
    this.loadTimer -= dt;
    if (this.loadTimer <= 0) {
      this.state = Config.STATE.TITLE;
    }
  }

  _updateTitle() {
    const tap = this.input.consumeTap();
    if (tap) {
      this.level = 1;
      this.score = 0;
      this.lives = Config.INITIAL_LIVES;
      this.combo = 0;
      this.maxCombo = 0;
      this.passives.reset();
      this.ownedPassives = [];
      this.baseBallSpeed = Config.BALL_SPEED;
      this._initLevel();
    }
  }

  _updatePlaying(dt, dtMs) {
    this._handleInput();
    this.paddle.update(dt);

    // 砖块前移！
    this._advanceBricks(dtMs);
    if (this.state === Config.STATE.GAME_OVER) return;

    // 更新球
    this._updateBalls(dt);
    this._updatePowerUps(dt);
    this.particles.update(dt);
    this._updateFloatingTexts(dt);

    // 检查关卡完成
    const allDead = this.bricks.every(b => !b.alive);
    if (allDead && this.bricks.length > 0) {
      this._onLevelClear();
    }

    if (this.balls.length === 0) {
      this._onAllBallsLost();
    }
  }

  _updateBoss(dt, dtMs) {
    this._handleInput();
    this.paddle.update(dt);

    if (this.boss && this.boss.alive) {
      this.boss.update(dtMs);
    }

    this._updateBalls(dt);
    this._updatePowerUps(dt);
    this.particles.update(dt);
    this._updateFloatingTexts(dt);

    if (this.boss && !this.boss.alive) {
      this.score += 500 * this.level;
      this._addFloatingText('BOSS DEFEATED!', this.gameWidth / 2, this.gameHeight / 3, Config.NEON_YELLOW, 22);
      this._onLevelClear();
    }

    if (this.balls.length === 0) {
      this._onAllBallsLost();
    }
  }

  _updateLevelClear() {
    const tap = this.input.consumeTap();
    if (tap && this.pendingUpgradeChoices.length > 0) {
      for (let i = 0; i < this.pendingUpgradeChoices.length; i++) {
        const ug = this.pendingUpgradeChoices[i];
        if (ug._hitArea) {
          const { x, y, w, h } = ug._hitArea;
          if (tap.x >= x && tap.x <= x + w && tap.y >= y && tap.y <= y + h) {
            this._applyUpgrade(ug);
            this.level++;
            this._initLevel();
            return;
          }
        }
      }
    }
  }

  _updateGameOver() {
    const tap = this.input.consumeTap();
    if (tap) {
      this.state = Config.STATE.TITLE;
    }
  }

  // ===== 输入 =====
  _handleInput() {
    const deltaX = this.input.getPaddleDeltaX();
    if (deltaX !== 0) {
      this.paddle.setX(this.paddle.x + this.paddle.width / 2 + deltaX);
    }
    // 消耗 tap（不再有技能按钮，但要消费 tap 防积压）
    // tap 在 PLAYING 状态不做任何事
  }

  // ===== 球更新 =====
  _updateBalls(dt) {
    for (let i = this.balls.length - 1; i >= 0; i--) {
      const ball = this.balls[i];
      ball.update(dt, 1);
      ball.wallBounce(this.gameWidth, 0);

      if (ball.collidePaddle(this.paddle)) {
        // 挡板反弹 ok
      }

      // 砖块碰撞（支持穿透）
      let pierceLeft = this.passives.getPierceCount();
      for (let j = 0; j < this.bricks.length; j++) {
        const brick = this.bricks[j];
        if (!brick.alive) continue;
        if (ball.collideBrick(brick)) {
          const critMult = this._rollCrit();
          const damage = Math.floor(1 * critMult);
          const destroyed = brick.hit(damage);

          if (critMult > 1) {
            const bc = brick.getCenter();
            this._addFloatingText('暴击!', bc.x, bc.y - 10, '#FF3333', 14);
          }

          if (destroyed) {
            this._onBrickDestroyed(brick);
          }

          if (pierceLeft > 0) {
            pierceLeft--;
            // 穿透：不break，继续检测下一个砖块
            // 恢复球的速度方向（穿过去）
            ball.undoLastBounce();
          } else {
            break;
          }
        }
      }

      // Boss 碰撞
      if (this.boss && this.boss.alive) {
        if (ball.collideBoss(this.boss)) {
          const critMult = this._rollCrit();
          const damage = Math.floor(5 * critMult);
          this.boss.hit(damage);
          this.particles.emitBossHit(ball.x, this.boss.y + this.boss.height);
          this.score += damage;
          if (critMult > 1) {
            this._addFloatingText('暴击!', ball.x, this.boss.y + this.boss.height + 10, '#FF3333', 14);
          }
        }
      }

      // 出界
      if (ball.isOutOfBounds(this.gameHeight)) {
        this.balls.splice(i, 1);
        this.combo = 0;
      }
    }
  }

  // ===== 道具更新 =====
  _updatePowerUps(dt) {
    const magnetTarget = this.passives.hasMagnet() ? {
      x: this.paddle.getCenterX(),
      y: this.paddle.y,
    } : null;

    for (let i = this.powerUps.length - 1; i >= 0; i--) {
      const pu = this.powerUps[i];
      pu.update(dt, magnetTarget);

      if (pu.collidePaddle(this.paddle)) {
        this._applyPowerUp(pu);
        this.powerUps.splice(i, 1);
        continue;
      }
      if (pu.isOutOfBounds(this.gameHeight)) {
        this.powerUps.splice(i, 1);
      }
    }
  }

  _updateFloatingTexts(dt) {
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const t = this.floatingTexts[i];
      t.y += t.vy * dt;
      t.life -= dt;
      t.alpha = Math.max(0, t.life / 40);
      if (t.life <= 0) {
        this.floatingTexts.splice(i, 1);
      }
    }
  }

  _onLevelClear() {
    this.pendingUpgradeChoices = this._generateUpgradeChoices();
    this.state = Config.STATE.LEVEL_CLEAR;
  }

  _onAllBallsLost() {
    this.lives--;
    if (this.lives <= 0) {
      this.state = Config.STATE.GAME_OVER;
    } else {
      this._spawnInitialBalls();
      this.combo = 0;
    }
  }

  // ===== 主渲染 =====
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
      case Config.STATE.LEVEL_CLEAR:
        this._renderGame();
        this.renderer.drawLevelClear(this.pendingUpgradeChoices, this.level, this.passives);
        break;
      case Config.STATE.GAME_OVER:
        this._renderGame();
        this.renderer.drawGameOver(this.score, this.level, this.ownedPassives);
        break;
    }
  }

  _renderGame() {
    // 危险线
    const dangerY = this.gameHeight * Config.BRICK_DANGER_Y;
    this.renderer.drawDangerLine(dangerY, this.advanceWarning);

    // 前移进度条
    this.renderer.drawAdvanceBar(this.advanceTimer, this.advanceInterval);

    // 砖块
    for (let i = 0; i < this.bricks.length; i++) {
      this.renderer.drawBrick(this.bricks[i]);
    }

    // Boss
    if (this.boss && this.boss.alive) {
      this.renderer.drawBoss(this.boss);
    }

    // 道具
    for (let i = 0; i < this.powerUps.length; i++) {
      this.renderer.drawPowerUp(this.powerUps[i]);
    }

    // 球
    for (let i = 0; i < this.balls.length; i++) {
      this.renderer.drawBall(this.balls[i]);
    }

    // 挡板
    if (this.paddle) {
      this.renderer.drawPaddle(this.paddle);
    }

    // 粒子
    this.renderer.drawParticles(this.particles.particles);

    // 浮动文字
    this.renderer.drawFloatingTexts(this.floatingTexts);

    // 被动技能图标栏
    this.renderer.drawPassiveBar(this.ownedPassives);

    // HUD
    this.renderer.drawHUD(this.score, this.lives, this.combo, this.level);
  }
}

module.exports = Game;
