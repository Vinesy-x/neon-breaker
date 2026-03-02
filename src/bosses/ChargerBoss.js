const BossBase = require('./BossBase');
const Config = require('../Config');

class ChargerBoss extends BossBase {
  constructor(hpMult, cycle, gameAreaWidth) {
    super('charger', 4800, hpMult, cycle, gameAreaWidth);
    this.chargeInterval = cycle >= 3 ? 5000 : 6000;
    this.chargeTime = cycle >= 3 ? 1000 : 1500;
    this.chargeDist = 120;
    this.originalY = this.y;
    this.chargeTargetY = this.y + this.chargeDist;
    this.stunTimer = 0;
    this.returnSpeed = 2;
    this._fireTrails = [];
    var bw = 30, bh = 20;
    this._initParts([
      { ox: 0, oy: 0, w: bw * 7, h: bh },
      { ox: bw, oy: bh, w: bw * 5, h: bh },
      { ox: bw * 2, oy: bh * 2, w: bw * 3, h: bh },
      { ox: bw * 3, oy: bh * 3, w: bw, h: bh },
    ]);
  }
  getPhaseColor() { return '#FF3333'; }
  update(dtMs) {
    // 沙盒简化模式：只左右移动+缓慢下移
    if (this._simpleBoss) { var dt=dtMs/16.67; if(this.flashTimer>0)this.flashTimer-=dtMs; this._moveLeftRight(dt,1); this._descend(dt); this._checkPhaseChange(); return; }
    var dt = dtMs / 16.67;
    if (this.flashTimer > 0) this.flashTimer -= dtMs;
    this.originalY += this.descendSpeed * dt;
    switch (this.state) {
      case 'idle':
        this.damageMult = 1.0; this.y = this.originalY; this._moveLeftRight(dt, 1); this.actionTimer += dtMs;
        if (this.actionTimer >= this.chargeInterval) { this.actionTimer = 0; this.state = 'charging'; this.stateTimer = 0; } break;
      case 'charging':
        this.damageMult = 1.0; this.y = this.originalY; this.stateTimer += dtMs;
        if (this.stateTimer >= this.chargeTime) { this.state = 'rushing'; this.stateTimer = 0; this.chargeTargetY = this.y + this.chargeDist; } break;
      case 'rushing':
        this.damageMult = 0.5; this.y += 6 * dt; this.stateTimer += dtMs;
        if (this.y >= this.chargeTargetY || this.stateTimer > 1500) {
          if (this.cycle >= 1) this._fireTrails.push({ x: this.x, y: this.y, width: this.width, timer: 2000 });
          this.state = 'stunned'; this.stateTimer = 0; this.stunTimer = 1000;
        } break;
      case 'stunned':
        this.damageMult = 2.0; this.stateTimer += dtMs;
        if (this.stateTimer >= this.stunTimer) { this.state = 'returning'; this.stateTimer = 0; } break;
      case 'returning':
        this.damageMult = 1.0; this.y -= this.returnSpeed * dt;
        if (this.y <= this.originalY) { this.y = this.originalY; this.state = 'idle'; this.actionTimer = 0; } break;
    }
    for (var i = this._fireTrails.length - 1; i >= 0; i--) { this._fireTrails[i].timer -= dtMs; if (this._fireTrails[i].timer <= 0) this._fireTrails.splice(i, 1); }
  }
  getRenderData() { return { type: 'charger', state: this.state, stateTimer: this.stateTimer, chargeTime: this.chargeTime, cycle: this.cycle, fireTrails: this._fireTrails }; }
}

module.exports = ChargerBoss;
