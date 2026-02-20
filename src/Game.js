/**
 * Game.js - v7.1 主游戏循环
 * 经验升级三选一(主) + 技能宝箱三选一(额外)
 * v7.1: 飞机升级树重构（删除crit/barrage/shield/magnet，新增元素弹）
 */
const Config = require('./Config');
const Bullet = require('./Bullet');
const Launcher = require('./Launcher');
const BrickFactory = require('./BrickFactory');
const ChapterConfig = require('./ChapterConfig');
const { createBoss } = require('./BossFactory');
const SaveManager = require('./systems/SaveManager');
const { ParticleManager } = require('./Particle');
const { generateDrops } = require('./PowerUp');
const UpgradeManager = require('./systems/UpgradeManager');
const ExpSystem = require('./systems/ExpSystem');
const Renderer = require('./Renderer');
const InputManager = require('./input/InputManager');
const Sound = require('./systems/SoundManager');
const DevPanel = require('./DevPanel');

class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new Renderer(canvas);
    this.input = new InputManager();
    this.gameWidth = Config.SCREEN_WIDTH;
    this.gameHeight = Config.SCREEN_HEIGHT;
    this.state = Config.STATE.LOADING;
    this.score = 0; this.combo = 0; this.maxCombo = 0; this.comboTimer = 0;
    this.bullets = []; this.bricks = []; this.launcher = null;
    this.particles = new ParticleManager();
    this.powerUps = [];
    this.upgrades = new UpgradeManager();
    this.expSystem = new ExpSystem();
    this.boss = null; this.floatingTexts = []; this.screenShake = 0;
    this.fireTimer = 0; this.pendingSkillChoices = [];
    this._preChoiceState = null; this._choiceSource = null;
    this.lastCrateTime = 0;
    this.saveManager = new SaveManager();
    this.currentChapter = 1; this.chapterConfig = null;
    this.elapsedMs = 0; this.currentPhase = null;
    this.coinsEarned = 0; this.bricksDestroyed = 0;
    this.spawnTimer = 0; this.bossWarningTimer = 0; this.bossTriggered = false;
    this.lastTime = 0; this.loadTimer = 0;
    this.burnDots = [];
    this._devInvincible = false;
    this._devPauseFire = false;
    this.devPanel = new DevPanel();
    this.state = Config.STATE.LOADING; this.loadTimer = 60;

    // Dev panel 滚动
    this.input.onDragY = (dy) => {
      if (this.devPanel.open) this.devPanel.handleDrag(dy);
    };
  }

  getBaseAttack() { return this.upgrades.getBaseAttack() + this.saveManager.getAttackBonus(); }

  _initGame() {
    this.chapterConfig = ChapterConfig.get(this.currentChapter);
    this.elapsedMs = 0; this.currentPhase = ChapterConfig.getPhaseAt(this.currentChapter, 0);
    this.coinsEarned = 0; this.bricksDestroyed = 0; this.bossTriggered = false;
    this.bossWarningTimer = 0; this.lastCrateTime = 0;
    this.launcher = new Launcher(this.gameWidth, this.gameHeight);
    this.launcher.reset(this.gameWidth, this.gameHeight);
    this.bullets = []; this.bricks = []; this.powerUps = [];
    this.particles.clear(); this.floatingTexts = [];
    this.combo = 0; this.maxCombo = 0; this.fireTimer = 0; this.comboTimer = 0;
    this.spawnTimer = 0; this.boss = null; this.score = 0;
    this.upgrades.reset(); this.expSystem.reset();
    this.burnDots = [];
    this.launcher.bulletDamage = 1 + this.saveManager.getAttackBonus();
    this.launcher.permFireRateBonus = this.saveManager.getFireRateBonus();
    this._syncLauncherStats();
    for (var r = 0; r < Config.BRICK_INIT_ROWS; r++) {
      var y = Config.BRICK_TOP_OFFSET + r * (Config.BRICK_HEIGHT + Config.BRICK_PADDING);
      this.bricks = this.bricks.concat(BrickFactory.generateRow(this.gameWidth, y, this.currentPhase, this.chapterConfig));
    }
    this.state = Config.STATE.PLAYING;
  }

  _fireBullets() {
    var sp = this.upgrades.getSpreadBonus();
    var count = 1 + sp;
    var spread = count > 1 ? (count - 1) * 0.12 : 0;
    var cx = this.launcher.getCenterX(), sy = this.launcher.y - 5;
    var dmg = Math.max(1, Math.floor(this.launcher.bulletDamage * this.upgrades.getAttackMult()));
    var pierce = this.upgrades.getPierceCount();
    var element = this.upgrades.getElementType();
    var elementLv = this.upgrades.getElementLevel();

    for (var i = 0; i < count; i++) {
      if (this.bullets.length >= Config.BULLET_MAX) break;
      var a = count > 1 ? -Math.PI/2 - spread/2 + (spread/(count-1))*i : -Math.PI/2;
      var bul = new Bullet(cx, sy, Math.cos(a)*Config.BULLET_SPEED, Math.sin(a)*Config.BULLET_SPEED, dmg);
      bul.pierce = pierce;
      bul.element = element;
      bul.elementLv = elementLv;
      this.bullets.push(bul);
    }
    this.launcher.muzzleFlash = 3;
    if (this.launcher.getFireInterval() > 120) Sound.bulletShoot();
  }

  _addFloatingText(t,x,y,c,s) { this.floatingTexts.push({text:t,x:x,y:y,color:c||Config.NEON_YELLOW,size:s||16,alpha:1,vy:-1.5,life:40}); }
  _spawnNewRow() { if (!this.currentPhase||this.currentPhase.spawnMult<=0) return; this.bricks=this.bricks.concat(BrickFactory.generateRow(this.gameWidth,Config.BRICK_TOP_OFFSET-Config.BRICK_HEIGHT-Config.BRICK_PADDING,this.currentPhase,this.chapterConfig)); }

  damageBrick(brick, damage, source) {
    if (!brick.alive||(brick.type==='stealth'&&!brick.visible)) return;
    if (brick.hit(damage)) { Sound.brickBreak(); this._onBrickDestroyed(brick); }
    else { Sound.brickHit(); this.particles.emitHitSpark(brick.getCenter().x, brick.getCenter().y, brick.color); }
  }

  damageBoss(damage) {
    if (!this.boss||!this.boss.alive) return;
    this.boss.hit(damage); Sound.brickHit();
    this.particles.emitBossHit(this.boss.getCenterX(), this.boss.getCenterY());
    this.score += damage;
    this.expSystem.spawnOrbs(this.boss.getCenterX(), this.boss.getCenterY(), damage*2, this.saveManager.getExpMultiplier());
  }

  _onBrickDestroyed(brick) {
    var c = brick.getCenter();
    this.particles.emitBrickBreak(brick.x, brick.y, brick.width, brick.height, brick.color);
    if (brick.maxHp >= 3) this.screenShake = Math.min(this.screenShake+2, 8);
    this.combo++; this.comboTimer = 0;
    if (this.combo > this.maxCombo) this.maxCombo = this.combo;
    this.score += Math.floor(Config.COMBO_SCORE_BASE * brick.maxHp * (1+Math.floor(this.combo/5)*0.5));
    this.bricksDestroyed++;
    if (this.combo>1&&this.combo%5===0) { Sound.combo(this.combo); this._addFloatingText(this.combo+' COMBO!',c.x,c.y-10,Config.NEON_YELLOW,14+Math.min(this.combo,12)); this.particles.emitCombo(c.x,c.y,this.combo); }
    if (brick.type==='split'&&!brick.isSplitChild) this.bricks=this.bricks.concat(BrickFactory.spawnSplitChildren(brick));
    this.expSystem.spawnOrbs(c.x, c.y, this.expSystem.calcBrickExp(brick), this.saveManager.getExpMultiplier());
    var drops = generateDrops(c.x, c.y, this.lastCrateTime, this.elapsedMs);
    for (var i=0;i<drops.items.length;i++) this.powerUps.push(drops.items[i]);
    if (drops.crateDropped) this.lastCrateTime = this.elapsedMs;
  }

  _applyPowerUp(pu) {
    if (pu.type==='coin') { var v=Math.floor(this.saveManager.getCoinMultiplier()); this.coinsEarned+=v; this._addFloatingText('+'+v+'💰',pu.x,pu.y,'#FFD700',12); }
    else if (pu.type==='skillCrate') { Sound.powerUp(); this._addFloatingText('技能宝箱!',pu.x,pu.y,Config.NEON_PINK,16); this._triggerChoice('crate'); }
  }

  _triggerChoice(source) {
    this.pendingSkillChoices = this.upgrades.generateChoices();
    if (this.pendingSkillChoices.length > 0) {
      this._preChoiceState = this.state; this._choiceSource = source;
      this.state = source==='crate' ? Config.STATE.SKILL_CHOICE : Config.STATE.LEVEL_UP;
    }
  }

  _tryShowLevelUpChoice() {
    if (this.expSystem.hasPendingLevelUp() && this.state!==Config.STATE.LEVEL_UP && this.state!==Config.STATE.SKILL_CHOICE) {
      this.expSystem.consumeLevelUp();
      this._addFloatingText('LEVEL UP!', this.gameWidth/2, this.gameHeight*0.4, Config.NEON_GREEN, 20);
      this._triggerChoice('levelUp');
    }
  }

  _syncLauncherStats() {
    if (!this.launcher) return;
    var fireRateMult = this.upgrades.getFireRateMult();
    this.launcher.permFireRateBonus = 1 - 1 / fireRateMult + this.saveManager.getFireRateBonus();
    this.launcher.bulletDamage = 1 + this.saveManager.getAttackBonus();
  }

  update(timestamp) {
    if (this.lastTime===0) this.lastTime=timestamp;
    var dtMs=Math.min(timestamp-this.lastTime,50); this.lastTime=timestamp; var dt=dtMs/16.67;

    // Dev panel 优先处理点击
    var devTap = this.input.peekTap();
    if (devTap) {
      var devResult = this.devPanel.handleTap(devTap, this);
      if (devResult && devResult.consumed) {
        this.input.consumeTap(); // 消费掉，不传递给游戏
        return; // 这一帧不处理游戏逻辑
      }
    }

    // Dev panel 打开时暂停游戏逻辑（只处理渲染）
    if (this.devPanel.open) {
      return;
    }

    switch(this.state) {
      case Config.STATE.LOADING: this.loadTimer-=dt; if(this.loadTimer<=0) this.state=Config.STATE.TITLE; break;
      case Config.STATE.TITLE: if(this.input.consumeTap()){Sound.init();Sound.gameStart();this.state=Config.STATE.CHAPTER_SELECT;} break;
      case Config.STATE.CHAPTER_SELECT: this._updateChapterSelect(); break;
      case Config.STATE.UPGRADE_SHOP: this._updateUpgradeShop(); break;
      case Config.STATE.PLAYING: this._updatePlaying(dt,dtMs); break;
      case Config.STATE.BOSS: this._updateBoss(dt,dtMs); break;
      case Config.STATE.LEVEL_UP: case Config.STATE.SKILL_CHOICE:
        this.expSystem.update(dt); this._updateFloatingTexts(dt); this.particles.update(dt); this._updateSkillChoice(); break;
      case Config.STATE.CHAPTER_CLEAR: this._updateChapterClear(); break;
      case Config.STATE.GAME_OVER: this._updateGameOver(); break;
    }
  }

  _updateChapterSelect() { var t=this.input.consumeTap(); if(!t) return; var r=this.renderer.getChapterSelectHit(t); if(r==='upgrade') this.state=Config.STATE.UPGRADE_SHOP; else if(r==='sound') Sound.toggle(); else if(typeof r==='number'&&r>0&&r<=this.saveManager.getMaxChapter()){this.currentChapter=r;this._initGame();} }
  _updateUpgradeShop() { var t=this.input.consumeTap(); if(!t) return; var r=this.renderer.getUpgradeShopHit(t); if(r==='back') this.state=Config.STATE.CHAPTER_SELECT; else if(r&&typeof r==='string'){if(this.saveManager.upgradeLevel(r)) Sound.selectSkill();} }
  _updateChapterClear() { var t=this.input.consumeTap(); if(!t) return; var r=this.renderer.getChapterClearHit(t); if(r==='next'){this.currentChapter=Math.min(this.currentChapter+1,this.saveManager.getMaxChapter());this._initGame();}else if(r==='back') this.state=Config.STATE.CHAPTER_SELECT; }
  _updateGameOver() { var t=this.input.consumeTap(); if(!t) return; var coins=Math.floor((this.chapterConfig?this.chapterConfig.clearReward:0)*0.3*this.saveManager.getCoinMultiplier())+Math.min(50,Math.floor(this.bricksDestroyed/100)); if(coins>0) this.saveManager.addCoins(coins); this.state=Config.STATE.CHAPTER_SELECT; }

  _updatePlaying(dt,dtMs) {
    this._handleInput(dt); this.launcher.update(dt,dtMs);
    if(!this._devPauseFire){this.fireTimer+=dtMs; if(this.fireTimer>=this.launcher.getFireInterval()){this.fireTimer-=this.launcher.getFireInterval();this._fireBullets();}}
    this.elapsedMs+=dtMs; this.currentPhase=ChapterConfig.getPhaseAt(this.currentChapter,this.elapsedMs);
    if(!this.bossTriggered&&this.currentPhase.phase==='boss'){this.bossTriggered=true;this.bossWarningTimer=Config.BOSS_WARNING_DURATION;}
    if(this.bossWarningTimer>0){this.bossWarningTimer-=dtMs;if(this.bossWarningTimer<=0){this._startBoss();return;}}
    this._scrollBricks(dt); this._updateBrickSpawn(dtMs); BrickFactory.updateSpecialBricks(this.bricks,dtMs);
    if(this._checkDangerLine()){Sound.gameOver();this.state=Config.STATE.GAME_OVER;return;}
    this.upgrades.updateWeapons(dtMs,this); this._updateBullets(dt,dtMs); this._updateBurnDots(dtMs); this._updatePowerUps(dt);
    this.expSystem.update(dt); this.particles.update(dt); this._updateFloatingTexts(dt);
    if(this.combo>0){this.comboTimer+=dtMs;if(this.comboTimer>2000){this.combo=0;this.comboTimer=0;}}
    this._tryShowLevelUpChoice();
  }

  _updateBoss(dt,dtMs) {
    this._handleInput(dt); this.launcher.update(dt,dtMs);
    if(!this._devPauseFire){this.fireTimer+=dtMs; if(this.fireTimer>=this.launcher.getFireInterval()){this.fireTimer-=this.launcher.getFireInterval();this._fireBullets();}}
    if(this.boss&&this.boss.alive){this.boss.update(dtMs);var s=this.boss.collectSpawnedBricks();if(s.length>0) this.bricks=this.bricks.concat(s);}
    this._scrollBricks(dt); BrickFactory.updateSpecialBricks(this.bricks,dtMs);
    if(this._checkDangerLine()){Sound.gameOver();this.state=Config.STATE.GAME_OVER;return;}
    this.upgrades.updateWeapons(dtMs,this); this._updateBullets(dt,dtMs); this._updateBurnDots(dtMs); this._updatePowerUps(dt);
    this.expSystem.update(dt); this.particles.update(dt); this._updateFloatingTexts(dt);
    this._tryShowLevelUpChoice();
    if(this.state===Config.STATE.LEVEL_UP||this.state===Config.STATE.SKILL_CHOICE) return;
    if(this.boss&&!this.boss.alive) {
      Sound.bossDefeat(); this.score+=500;
      this._addFloatingText('BOSS DEFEATED!',this.gameWidth/2,this.gameHeight/3,Config.NEON_YELLOW,22);
      this.coinsEarned=Math.floor((this.chapterConfig?this.chapterConfig.clearReward:0)*this.saveManager.getCoinMultiplier()*(this.saveManager.isChapterCleared(this.currentChapter)?1:2));
      this.saveManager.setChapterRecord(this.currentChapter,this.score,this.expSystem.playerLevel);
      if(!this.saveManager.isChapterCleared(this.currentChapter)&&this.currentChapter>=this.saveManager.getMaxChapter()) this.saveManager.unlockNextChapter();
      this.saveManager.addCoins(this.coinsEarned); this.boss=null; this.state=Config.STATE.CHAPTER_CLEAR;
    }
  }

  _updateSkillChoice() {
    var t=this.input.consumeTap();
    if(t&&this.pendingSkillChoices.length>0) {
      for(var i=0;i<this.pendingSkillChoices.length;i++) {
        var ch=this.pendingSkillChoices[i]; if(!ch._hitArea) continue;
        var ha=ch._hitArea;
        if(t.x>=ha.x&&t.x<=ha.x+ha.w&&t.y>=ha.y&&t.y<=ha.y+ha.h) {
          Sound.selectSkill(); this.upgrades.applyChoice(ch); this._syncLauncherStats();
          if(this._choiceSource==='levelUp'&&this.expSystem.hasPendingLevelUp()) {
            this.expSystem.consumeLevelUp(); this.pendingSkillChoices=this.upgrades.generateChoices();
            if(this.pendingSkillChoices.length===0){this.state=this._preChoiceState||Config.STATE.PLAYING;this._preChoiceState=null;}
          } else { this.state=this._preChoiceState||Config.STATE.PLAYING; this._preChoiceState=null; }
          return;
        }
      }
    }
  }

  _startBoss() { for(var i=0;i<this.bricks.length;i++){if(this.bricks[i].alive&&this.bricks[i].y<this.gameHeight*0.3) this.bricks[i].alive=false;} this.state=Config.STATE.BOSS; this.boss=createBoss(this.chapterConfig.bossType,this.currentChapter,this.gameWidth); Sound.bossAppear(); }

  _scrollBricks(dt) { if(!this.chapterConfig) return; var bs=this.chapterConfig.scrollSpeed; var ac=(this.currentPhase&&this.currentPhase.scrollAccel)?this.currentPhase.scrollAccel:0; var tip=(this.elapsedMs-(this.currentPhase?this.currentPhase.time:0))/1000; var ds=Math.min(bs+ac*tip,bs*3); for(var i=0;i<this.bricks.length;i++){if(this.bricks[i].alive) this.bricks[i].y+=ds*this.bricks[i].speedMult*dt;} for(var j=this.bricks.length-1;j>=0;j--){if(!this.bricks[j].alive||this.bricks[j].y>this.gameHeight+50) this.bricks.splice(j,1);} }

  _checkDangerLine() { if (this._devInvincible) return false; var dy=this.gameHeight*Config.BRICK_DANGER_Y; for(var i=0;i<this.bricks.length;i++){if(this.bricks[i].alive&&this.bricks[i].y+this.bricks[i].height>=dy) return true;} return false; }

  _updateBrickSpawn(dtMs) { if(!this.chapterConfig||!this.currentPhase||this.currentPhase.spawnMult<=0) return; var tip=(this.elapsedMs-this.currentPhase.time)/1000; var iv=this.chapterConfig.spawnInterval/(this.currentPhase.spawnMult*(1+Math.min(tip/60,0.15))); this.spawnTimer+=dtMs; if(this.spawnTimer>=iv){this.spawnTimer-=iv;this._spawnNewRow();} }

  _handleInput(dt) { if (this.devPanel.open) return; var dx=this.input.getPaddleDeltaX(); if(dx!==0) this.launcher.setX(this.launcher.getCenterX()+dx); }

  // ===== 元素弹效果 =====

  _applyFireElement(brick, elementLv) {
    if (!brick.alive) return;
    var c = brick.getCenter();
    var dotDmg = Math.max(1, Math.floor(this.getBaseAttack() * 0.3 * elementLv));
    var duration = 1000 + elementLv * 500;
    this.burnDots.push({
      brickRef: brick, x: c.x, y: c.y,
      damage: dotDmg, remaining: duration, tickMs: 500, tickTimer: 0,
    });
    this.particles.emitHitSpark(c.x, c.y, '#FF4400');
  }

  _applyIceElement(brick, elementLv) {
    if (!brick.alive) return;
    brick.speedMult = Math.max(0.1, brick.speedMult * (1 - elementLv * 0.3));
    this.particles.emitHitSpark(brick.getCenter().x, brick.getCenter().y, '#44DDFF');
  }

  _applyThunderElement(brick, elementLv, bulletDmg) {
    if (!brick.alive) return;
    var c = brick.getCenter();
    var chainCount = elementLv;
    var chainDmg = Math.max(1, Math.floor(bulletDmg * 0.5));
    var hit = new Set();
    var lastX = c.x, lastY = c.y;
    for (var ch = 0; ch < chainCount; ch++) {
      var nearest = null, nearDist = Infinity;
      for (var j = 0; j < this.bricks.length; j++) {
        if (!this.bricks[j].alive || hit.has(j)) continue;
        if (this.bricks[j] === brick) continue;
        var bc = this.bricks[j].getCenter();
        var d = (bc.x-lastX)*(bc.x-lastX) + (bc.y-lastY)*(bc.y-lastY);
        if (d < nearDist && d < 10000) { nearDist = d; nearest = { idx: j, brick: this.bricks[j] }; }
      }
      if (!nearest) break;
      hit.add(nearest.idx);
      var nc = nearest.brick.getCenter();
      this.damageBrick(nearest.brick, chainDmg, 'thunder_chain');
      this.particles.emitHitSpark(nc.x, nc.y, '#FFF050');
      lastX = nc.x; lastY = nc.y;
    }
    if (chainCount > 0) Sound.lightning();
  }

  _updateBurnDots(dtMs) {
    for (var i = this.burnDots.length - 1; i >= 0; i--) {
      var dot = this.burnDots[i];
      dot.remaining -= dtMs;
      dot.tickTimer += dtMs;
      if (dot.tickTimer >= dot.tickMs) {
        dot.tickTimer -= dot.tickMs;
        if (dot.brickRef && dot.brickRef.alive) {
          this.damageBrick(dot.brickRef, dot.damage, 'fire_dot');
        }
      }
      if (dot.remaining <= 0 || !dot.brickRef || !dot.brickRef.alive) {
        this.burnDots.splice(i, 1);
      }
    }
  }

  _updateBullets(dt, dtMs) {
    var critChance = this.saveManager.getCritBonus();
    var critMult = 2.0;
    for(var i=this.bullets.length-1;i>=0;i--) {
      var b=this.bullets[i]; b.update(dt);
      if(b.isOutOfBounds(this.gameWidth,this.gameHeight)){this.bullets.splice(i,1);continue;}
      if(this.boss&&this.boss.alive&&this.boss.type==='laser'&&this.boss.isInLaserZone&&this.boss.isInLaserZone(b.x,b.y)){this.bullets.splice(i,1);continue;}
      var rm=false;
      for(var j=0;j<this.bricks.length;j++) {
        var bk=this.bricks[j]; if(!bk.alive||(bk.type==='stealth'&&!bk.visible)) continue;
        if(b.collideBrick(bk)) {
          var cm=(Math.random()<critChance)?critMult:1;
          var finalDmg = Math.max(1, Math.floor(b.damage * cm));
          this.damageBrick(bk, finalDmg, 'bullet');
          if(cm>1){Sound.crit();this._addFloatingText('暴击!',bk.getCenter().x,bk.getCenter().y-10,Config.NEON_RED,14);}
          if (b.element && bk.alive) {
            switch (b.element) {
              case 'fire': this._applyFireElement(bk, b.elementLv); break;
              case 'ice': this._applyIceElement(bk, b.elementLv); break;
              case 'thunder': this._applyThunderElement(bk, b.elementLv, finalDmg); break;
            }
          }
          if(b.pierce>0) b.pierce--; else{this.bullets.splice(i,1);rm=true;break;}
        }
      }
      if(rm) continue;
      if(this.boss&&this.boss.alive) {
        if(this.boss.type==='guardian'&&this.boss.hitShield&&this.boss.hitShield(b.x,b.y,b.radius)){this.bullets.splice(i,1);Sound.brickHit();continue;}
        if(b.collideBoss(this.boss)){var bc2=(Math.random()<critChance)?critMult:1;this.damageBoss(Math.floor(b.damage*3*bc2));if(bc2>1)this._addFloatingText('暴击!',b.x,this.boss.y+this.boss.height+10,Config.NEON_RED,14);this.bullets.splice(i,1);}
      }
    }
  }

  _updatePowerUps(dt) { for(var i=this.powerUps.length-1;i>=0;i--){var p=this.powerUps[i];p.update(dt,null);if(p.collideLauncher(this.launcher)){this._applyPowerUp(p);this.powerUps.splice(i,1);continue;}if(p.isOutOfBounds(this.gameHeight)) this.powerUps.splice(i,1);} }

  _updateFloatingTexts(dt) { for(var i=this.floatingTexts.length-1;i>=0;i--){var t=this.floatingTexts[i];t.y+=t.vy*dt;t.life-=dt;t.alpha=Math.max(0,t.life/40);if(t.life<=0) this.floatingTexts.splice(i,1);} }

  render() {
    this.renderer.clear();
    switch(this.state) {
      case Config.STATE.LOADING: this.renderer.drawLoading(); break;
      case Config.STATE.TITLE: this.renderer.drawTitle(); break;
      case Config.STATE.CHAPTER_SELECT: this.renderer.drawChapterSelect(this.saveManager.getMaxChapter(),this.saveManager.getData().chapterRecords,this.saveManager.getCoins()); break;
      case Config.STATE.UPGRADE_SHOP: this.renderer.drawUpgradeShop(this.saveManager); break;
      case Config.STATE.PLAYING: this._renderGame(); if(this.bossWarningTimer>0) this.renderer.drawBossWarning(this.chapterConfig.bossType); break;
      case Config.STATE.BOSS: this._renderGame(); break;
      case Config.STATE.LEVEL_UP: this._renderGame(); this.renderer.drawSkillChoice(this.pendingSkillChoices,this.upgrades,'⬆ LEVEL '+this.expSystem.playerLevel); break;
      case Config.STATE.SKILL_CHOICE: this._renderGame(); this.renderer.drawSkillChoice(this.pendingSkillChoices,this.upgrades,'📦 技能宝箱'); break;
      case Config.STATE.CHAPTER_CLEAR: this.renderer.drawChapterClear(this.currentChapter,this.score,this.expSystem.playerLevel,this.maxCombo,this.upgrades.getOwnedWeapons(),this.coinsEarned,false); break;
      case Config.STATE.GAME_OVER: this._renderGame(); this.renderer.drawGameOver(this.score,this.expSystem.playerLevel,this.upgrades.getOwnedWeapons()); break;
    }
    // Dev panel 最后绘制（在最上层）
    this.devPanel.draw(this.renderer.ctx, this);
  }

  _renderGame() {
    var shaking = this.screenShake > 0.5;
    if(shaking){this.renderer.ctx.save();this.renderer.ctx.translate((Math.random()-0.5)*this.screenShake*this.renderer.dpr,(Math.random()-0.5)*this.screenShake*this.renderer.dpr);this.screenShake*=0.85;if(this.screenShake<0.5)this.screenShake=0;}
    this.renderer.drawDangerLine(this.gameHeight*Config.BRICK_DANGER_Y);
    for(var i=0;i<this.bricks.length;i++) this.renderer.drawBrick(this.bricks[i]);
    if(this.boss&&this.boss.alive) this.renderer.drawBoss(this.boss);
    for(var j=0;j<this.powerUps.length;j++) this.renderer.drawPowerUp(this.powerUps[j]);
    this.renderer.drawExpOrbs(this.expSystem.orbs);
    this.renderer.drawWeapons(this.upgrades.weapons,this.launcher);
    this.renderer.drawWeaponWings(this.upgrades.weapons,this.launcher);
    for(var k=0;k<this.bullets.length;k++) this.renderer.drawBullet(this.bullets[k]);
    if(this.launcher) this.renderer.drawLauncher(this.launcher, this.upgrades);
    this.renderer.drawParticles(this.particles.particles);
    this.renderer.drawFloatingTexts(this.floatingTexts);
    this.renderer.drawWeaponHUD(this.upgrades.getOwnedWeapons());
    this.renderer.drawChapterHUD(this.currentChapter,this.score,this.combo,this.expSystem.playerLevel,this.elapsedMs,Sound.enabled);
    this.renderer.drawExpBar(this.expSystem.exp,this.expSystem.expToNext,this.expSystem.playerLevel);
    if(shaking) this.renderer.ctx.restore();
  }
}

module.exports = Game;