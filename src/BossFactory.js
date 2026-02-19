/**
 * BossFactory.js - 5种Boss类型工厂
 * charger / guardian / summoner / laser / phantom
 * 每种Boss有独立的 update() 和 getRenderData()
 */
const Config = require('./Config');
const BrickFactory = require('./BrickFactory');

// ===== Boss 基类 =====
class BossBase {
  constructor(type, baseHp, hpMult, cycle, gameAreaWidth) {
    this.type = type;
    this.width = Config.BOSS_WIDTH;
    this.height = Config.BOSS_HEIGHT;
    this.x = (gameAreaWidth - this.width) / 2;
    this.y = 60;
    this.gameAreaWidth = gameAreaWidth;
    this.alive = true;
    this.direction = 1;
    this.speed = Config.BOSS_SPEED;

    this.maxHp = Math.floor(baseHp * hpMult);
    this.hp = this.maxHp;
    this.cycle = cycle;
    this.hpMult = hpMult;

    this.actionTimer = 0;
    this.state = 'idle';
    this.stateTimer = 0;
    this.flashTimer = 0;

    // Boss击杀标记
    this.phase = 0;
    this.phaseChangeFlash = 0;

    // 弱点倍率（某些状态受额外伤害）
    this.damageMult = 1.0;

    // 子类可覆盖
    this._spawnedBricks = [];   // Boss召唤的砖块（给Game.js收集）
    this._fireTrails = [];      // 火焰地带等特殊区域
    this._laserData = null;     // 激光数据
  }

  hit(damage) {
    var actual = Math.floor(damage * this.damageMult);
    this.hp -= actual;
    this.flashTimer = 100;
    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
      return true;
    }
    return false;
  }

  getCenterX() { return this.x + this.width / 2; }
  getCenterY() { return this.y + this.height / 2; }
  getHpRatio() { return this.hp / this.maxHp; }

  getPhaseColor() {
    // 子类覆盖
    return Config.NEON_CYAN;
  }

  /** 收集Boss召唤的砖块（调用后清空） */
  collectSpawnedBricks() {
    var bricks = this._spawnedBricks;
    this._spawnedBricks = [];
    return bricks;
  }

  _moveLeftRight(dt, speedMult) {
    this.x += this.speed * (speedMult || 1) * this.direction * dt;
    if (this.x <= 0) { this.x = 0; this.direction = 1; }
    if (this.x + this.width >= this.gameAreaWidth) {
      this.x = this.gameAreaWidth - this.width;
      this.direction = -1;
    }
  }

  update(dtMs) {
    // 子类覆盖
    var dt = dtMs / 16.67;
    if (this.flashTimer > 0) this.flashTimer -= dtMs;
    if (this.phaseChangeFlash > 0) this.phaseChangeFlash -= dtMs;
  }

  getRenderData() {
    return {
      type: this.type,
      state: this.state,
      stateTimer: this.stateTimer,
      cycle: this.cycle,
    };
  }
}

// ===== Charger（冲锋者）=====
class ChargerBoss extends BossBase {
  constructor(hpMult, cycle, gameAreaWidth) {
    super('charger', 300, hpMult, cycle, gameAreaWidth);
    this.chargeInterval = cycle >= 3 ? 5000 : 6000;
    this.chargeTime = cycle >= 3 ? 1000 : 1500;
    this.chargeDist = 120;
    this.originalY = this.y;
    this.chargeTargetY = this.y + this.chargeDist;
    this.stunTimer = 0;
    this.returnSpeed = 2;
    this._fireTrails = [];
  }

  getPhaseColor() { return '#FF3333'; }

  update(dtMs) {
    var dt = dtMs / 16.67;
    if (this.flashTimer > 0) this.flashTimer -= dtMs;

    switch (this.state) {
      case 'idle':
        this.damageMult = 1.0;
        this._moveLeftRight(dt, 1);
        this.actionTimer += dtMs;
        if (this.actionTimer >= this.chargeInterval) {
          this.actionTimer = 0;
          this.state = 'charging';
          this.stateTimer = 0;
        }
        break;

      case 'charging':
        // 闪烁警告阶段
        this.damageMult = 1.0;
        this.stateTimer += dtMs;
        if (this.stateTimer >= this.chargeTime) {
          this.state = 'rushing';
          this.stateTimer = 0;
          this.chargeTargetY = this.y + this.chargeDist;
        }
        break;

      case 'rushing':
        // 加速下冲
        this.damageMult = 0.5; // 冲锋时不易打
        this.y += 6 * dt;
        this.stateTimer += dtMs;
        if (this.y >= this.chargeTargetY || this.stateTimer > 1500) {
          // cycle>=1: 留火焰地带
          if (this.cycle >= 1) {
            this._fireTrails.push({
              x: this.x, y: this.y, width: this.width,
              timer: 2000,
            });
          }
          this.state = 'stunned';
          this.stateTimer = 0;
          this.stunTimer = 1000;
        }
        break;

      case 'stunned':
        // 停顿1秒，受双倍伤害
        this.damageMult = 2.0;
        this.stateTimer += dtMs;
        if (this.stateTimer >= this.stunTimer) {
          this.state = 'returning';
          this.stateTimer = 0;
        }
        break;

      case 'returning':
        this.damageMult = 1.0;
        this.y -= this.returnSpeed * dt;
        if (this.y <= this.originalY) {
          this.y = this.originalY;
          this.state = 'idle';
          this.actionTimer = 0;
        }
        break;
    }

    // 更新火焰地带
    for (var i = this._fireTrails.length - 1; i >= 0; i--) {
      this._fireTrails[i].timer -= dtMs;
      if (this._fireTrails[i].timer <= 0) this._fireTrails.splice(i, 1);
    }
  }

  getRenderData() {
    return {
      type: 'charger',
      state: this.state,
      stateTimer: this.stateTimer,
      chargeTime: this.chargeTime,
      cycle: this.cycle,
      fireTrails: this._fireTrails,
    };
  }
}

// ===== Guardian（护盾卫士）=====
class GuardianBoss extends BossBase {
  constructor(hpMult, cycle, gameAreaWidth) {
    super('guardian', 350, hpMult, cycle, gameAreaWidth);
    this.shieldCount = cycle >= 1 ? 3 : 2;
    this.shieldMaxHp = Math.floor(80 * hpMult);
    this.shields = [];
    this.shieldAngle = 0;
    this.shieldSpeed = 0.02;
    this.shieldRegenTime = cycle >= 3 ? 5000 : 8000;
    this.shieldDownTimer = 0; // 护盾全碎后计时
    this.allShieldsDown = false;
    this.windowTimer = 0;     // 5秒窗口期

    this._initShields();
  }

  _initShields() {
    this.shields = [];
    for (var i = 0; i < this.shieldCount; i++) {
      this.shields.push({
        hp: this.shieldMaxHp,
        maxHp: this.shieldMaxHp,
        alive: true,
        angle: (Math.PI * 2 / this.shieldCount) * i,
      });
    }
    this.allShieldsDown = false;
    this.windowTimer = 0;
    this.shieldDownTimer = 0;
  }

  getPhaseColor() { return '#4488FF'; }

  /**
   * 检查子弹是否碰到护盾
   * 返回 true 表示被护盾挡住
   */
  hitShield(bulletX, bulletY, bulletRadius) {
    if (this.allShieldsDown) return false;
    var cx = this.getCenterX();
    var cy = this.getCenterY();
    var shieldRadius = 50;
    var shieldArc = Math.PI * 0.5; // 每块护盾覆盖90度弧

    for (var i = 0; i < this.shields.length; i++) {
      var s = this.shields[i];
      if (!s.alive) continue;
      // 护盾位置
      var sx = cx + Math.cos(s.angle + this.shieldAngle) * shieldRadius;
      var sy = cy + Math.sin(s.angle + this.shieldAngle) * shieldRadius;
      var dist = Math.sqrt((bulletX - sx) * (bulletX - sx) + (bulletY - sy) * (bulletY - sy));
      if (dist < 20 + bulletRadius) {
        s.hp--;
        if (s.hp <= 0) {
          s.alive = false;
          // 检查是否全碎
          var anyAlive = false;
          for (var j = 0; j < this.shields.length; j++) {
            if (this.shields[j].alive) { anyAlive = true; break; }
          }
          if (!anyAlive) {
            this.allShieldsDown = true;
            this.windowTimer = 5000;
            this.shieldDownTimer = 0;
          }
        }
        return true;
      }
    }
    return false;
  }

  update(dtMs) {
    var dt = dtMs / 16.67;
    if (this.flashTimer > 0) this.flashTimer -= dtMs;

    this._moveLeftRight(dt, 0.8);
    this.shieldAngle += this.shieldSpeed * dt;

    if (this.allShieldsDown) {
      this.damageMult = 1.5; // 窗口期加伤
      this.windowTimer -= dtMs;
      if (this.windowTimer <= 0) {
        // 窗口期过了开始再生计时
        this.shieldDownTimer += dtMs;
        this.damageMult = 1.0;
        if (this.shieldDownTimer >= this.shieldRegenTime) {
          this._initShields();
        }
      }
    } else {
      this.damageMult = 1.0;
    }
  }

  getRenderData() {
    return {
      type: 'guardian',
      state: this.allShieldsDown ? 'vulnerable' : 'shielded',
      shields: this.shields,
      shieldAngle: this.shieldAngle,
      cycle: this.cycle,
      windowTimer: this.windowTimer,
    };
  }
}

// ===== Summoner（召唤师）=====
class SummonerBoss extends BossBase {
  constructor(hpMult, cycle, gameAreaWidth) {
    super('summoner', 250, hpMult, cycle, gameAreaWidth);
    this.summonInterval = cycle >= 1 ? 4000 : 5000;
    this.summonInvulnTime = 2000;
    this.invulnTimer = 0;
  }

  getPhaseColor() { return '#AA44FF'; }

  update(dtMs) {
    var dt = dtMs / 16.67;
    if (this.flashTimer > 0) this.flashTimer -= dtMs;

    switch (this.state) {
      case 'idle':
        this.damageMult = 1.0;
        this._moveLeftRight(dt, 0.6);
        this.actionTimer += dtMs;
        if (this.actionTimer >= this.summonInterval) {
          this.actionTimer = 0;
          this.state = 'summoning';
          this.stateTimer = 0;
          this.invulnTimer = this.summonInvulnTime;
          this.damageMult = 0; // 无敌
          this._summonBricks();
        }
        break;

      case 'summoning':
        this.damageMult = 0; // 无敌
        this.stateTimer += dtMs;
        this.invulnTimer -= dtMs;
        if (this.invulnTimer <= 0) {
          this.state = 'idle';
          this.damageMult = 1.0;
        }
        break;
    }
  }

  _summonBricks() {
    var y = this.y + this.height + 10;
    // 简单阶段配置用于生成
    var phase = {
      types: ['normal'],
      hpRange: [1, 2],
      spawnMult: 1.0,
    };

    // cycle增强：特殊砖块
    if (this.cycle >= 2) {
      phase.types = ['normal', 'fast', 'shield'];
    }

    var config = {
      hpMultiplier: this.hpMult,
      gapChance: 0.2,
    };

    var row = BrickFactory.generateRow(this.gameAreaWidth, y, phase, config);
    this._spawnedBricks = this._spawnedBricks.concat(row);

    // cycle>=3: 召唤两行
    if (this.cycle >= 3) {
      var y2 = y - Config.BRICK_HEIGHT - Config.BRICK_PADDING;
      var row2 = BrickFactory.generateRow(this.gameAreaWidth, y2, phase, config);
      this._spawnedBricks = this._spawnedBricks.concat(row2);
    }
  }

  getRenderData() {
    return {
      type: 'summoner',
      state: this.state,
      stateTimer: this.stateTimer,
      invulnTimer: this.invulnTimer,
      cycle: this.cycle,
    };
  }
}

// ===== LaserTurret（激光炮台）=====
class LaserTurretBoss extends BossBase {
  constructor(hpMult, cycle, gameAreaWidth) {
    super('laser', 400, hpMult, cycle, gameAreaWidth);
    this.fireInterval = cycle >= 3 ? 6000 : 8000;
    this.chargeTime = 2000;
    this.laserDuration = 1500;
    this._laserData = null;
  }

  getPhaseColor() { return '#FFF050'; }

  update(dtMs) {
    var dt = dtMs / 16.67;
    if (this.flashTimer > 0) this.flashTimer -= dtMs;

    switch (this.state) {
      case 'idle':
        this.damageMult = 1.0;
        this._moveLeftRight(dt, 0.8);
        this.actionTimer += dtMs;
        if (this.actionTimer >= this.fireInterval) {
          this.actionTimer = 0;
          this.state = 'charging';
          this.stateTimer = 0;
        }
        break;

      case 'charging':
        // 充能期间停止移动，头顶受3倍伤害
        this.damageMult = 3.0;
        this.stateTimer += dtMs;
        this._laserData = {
          charging: true,
          x: this.getCenterX(),
          progress: this.stateTimer / this.chargeTime,
        };
        if (this.stateTimer >= this.chargeTime) {
          this.state = 'firing';
          this.stateTimer = 0;
        }
        break;

      case 'firing':
        this.damageMult = 1.0;
        this.stateTimer += dtMs;
        var laserWidth = 30;
        // cycle>=2: 双炮管
        this._laserData = {
          charging: false,
          firing: true,
          x: this.getCenterX(),
          width: laserWidth,
          dual: this.cycle >= 2,
          dualOffsets: this.cycle >= 2 ? [-30, 30] : [0],
        };
        if (this.stateTimer >= this.laserDuration) {
          this.state = 'idle';
          this._laserData = null;
          // cycle>=1: 灼烧带
          if (this.cycle >= 1) {
            this._fireTrails.push({
              x: this.getCenterX() - laserWidth / 2,
              y: this.y + this.height,
              width: laserWidth,
              timer: 3000,
            });
          }
        }
        break;
    }

    // 更新灼烧带
    for (var i = this._fireTrails.length - 1; i >= 0; i--) {
      this._fireTrails[i].timer -= dtMs;
      if (this._fireTrails[i].timer <= 0) this._fireTrails.splice(i, 1);
    }
  }

  /** 检查子弹是否在激光范围内（范围内子弹被消除） */
  isInLaserZone(bulletX, bulletY) {
    if (!this._laserData || !this._laserData.firing) return false;
    var offsets = this._laserData.dualOffsets || [0];
    for (var i = 0; i < offsets.length; i++) {
      var lx = this._laserData.x + offsets[i];
      if (Math.abs(bulletX - lx) < this._laserData.width / 2) {
        return true;
      }
    }
    return false;
  }

  getRenderData() {
    return {
      type: 'laser',
      state: this.state,
      stateTimer: this.stateTimer,
      cycle: this.cycle,
      laserData: this._laserData,
      fireTrails: this._fireTrails,
    };
  }
}

// ===== Phantom（幽影刺客）=====
class PhantomBoss extends BossBase {
  constructor(hpMult, cycle, gameAreaWidth) {
    super('phantom', 280, hpMult, cycle, gameAreaWidth);
    this.blinkInterval = cycle >= 3 ? 3000 : 4000;
    this.appearWindowTime = 1000; // 出现后1秒双倍伤害
    this.invisTimer = 0;
    this.appearTimer = 0;
    this.speed = Config.BOSS_SPEED * 1.5;
    this._afterImages = []; // 残影
  }

  getPhaseColor() { return '#DDDDDD'; }

  update(dtMs) {
    var dt = dtMs / 16.67;
    if (this.flashTimer > 0) this.flashTimer -= dtMs;

    switch (this.state) {
      case 'idle':
        this._moveLeftRight(dt, 1.2);
        this.appearTimer += dtMs;
        // 出现后1秒双倍伤害
        if (this.appearTimer < this.appearWindowTime) {
          this.damageMult = 2.0;
        } else {
          this.damageMult = 1.0;
        }
        this.actionTimer += dtMs;
        if (this.actionTimer >= this.blinkInterval) {
          this.actionTimer = 0;
          this.state = 'blinking';
          this.stateTimer = 0;
          this.invisTimer = 500; // 消失0.5秒
          // cycle>=1: 留残影
          if (this.cycle >= 1) {
            this._afterImages.push({
              x: this.x, y: this.y, timer: 2000,
              width: this.width, height: this.height,
            });
          }
        }
        break;

      case 'blinking':
        // 消失中，完全无敌
        this.damageMult = 0;
        this.stateTimer += dtMs;
        if (this.stateTimer >= this.invisTimer) {
          // 随机位置出现
          this.x = Math.random() * (this.gameAreaWidth - this.width);
          this.y = 40 + Math.random() * 40;
          this.state = 'idle';
          this.appearTimer = 0;
          this.damageMult = 2.0;
          // 出现瞬间释放一排快速砖块
          this._spawnAppearBricks();
        }
        break;
    }

    // 更新残影
    for (var i = this._afterImages.length - 1; i >= 0; i--) {
      this._afterImages[i].timer -= dtMs;
      if (this._afterImages[i].timer <= 0) this._afterImages.splice(i, 1);
    }
  }

  _spawnAppearBricks() {
    var y = this.y + this.height + 5;
    var phase = {
      types: this.cycle >= 2 ? ['split'] : ['fast'],
      hpRange: [1, 1],
      spawnMult: 1.0,
    };
    var config = {
      hpMultiplier: this.hpMult * 0.5,
      gapChance: 0.3,
    };
    var row = BrickFactory.generateRow(this.gameAreaWidth, y, phase, config);
    this._spawnedBricks = this._spawnedBricks.concat(row);
  }

  getRenderData() {
    return {
      type: 'phantom',
      state: this.state,
      stateTimer: this.stateTimer,
      cycle: this.cycle,
      afterImages: this._afterImages,
      appearTimer: this.appearTimer,
      appearWindowTime: this.appearWindowTime,
    };
  }
}

// ===== 工厂函数 =====

function createBoss(type, chapter, gameAreaWidth) {
  var cycle = Math.floor((chapter - 1) / 5);
  var hpMult = 1.0 + (chapter - 1) * 0.12;
  switch (type) {
    case 'charger':  return new ChargerBoss(hpMult, cycle, gameAreaWidth);
    case 'guardian':  return new GuardianBoss(hpMult, cycle, gameAreaWidth);
    case 'summoner':  return new SummonerBoss(hpMult, cycle, gameAreaWidth);
    case 'laser':     return new LaserTurretBoss(hpMult, cycle, gameAreaWidth);
    case 'phantom':   return new PhantomBoss(hpMult, cycle, gameAreaWidth);
    default:          return new ChargerBoss(hpMult, cycle, gameAreaWidth);
  }
}

module.exports = {
  createBoss: createBoss,
  BossBase: BossBase,
  ChargerBoss: ChargerBoss,
  GuardianBoss: GuardianBoss,
  SummonerBoss: SummonerBoss,
  LaserTurretBoss: LaserTurretBoss,
  PhantomBoss: PhantomBoss,
};
