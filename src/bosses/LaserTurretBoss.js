const BossBase = require('./BossBase');
const Config = require('../Config');

class LaserTurretBoss extends BossBase {
  constructor(hpMult, cycle, gameAreaWidth) {
    super('laser', 6400, hpMult, cycle, gameAreaWidth);
    this.fireInterval = cycle >= 3 ? 6000 : 8000;
    this.chargeTime = 2000; this.laserDuration = 1500; this._laserData = null;
    var bw = 25, bh = 18;
    this._initParts([
      { ox: 0, oy: 0, w: bw * 8, h: bh },
      { ox: 0, oy: bh, w: bw * 8, h: bh },
      { ox: bw * 2, oy: bh * 2, w: bw * 4, h: bh },
      { ox: bw * 2, oy: bh * 3, w: bw * 4, h: bh },
      { ox: bw, oy: bh * 4, w: bw * 6, h: bh },
    ]);
  }
  getPhaseColor() { return '#FFF050'; }
  update(dtMs) {
    var dt = dtMs / 16.67;
    if (this.flashTimer > 0) this.flashTimer -= dtMs;
    this._descend(dt);
    switch (this.state) {
      case 'idle':
        this.damageMult = 1.0; this._moveLeftRight(dt, 0.8); this.actionTimer += dtMs;
        if (this.actionTimer >= this.fireInterval) { this.actionTimer = 0; this.state = 'charging'; this.stateTimer = 0; } break;
      case 'charging':
        this.damageMult = 3.0; this.stateTimer += dtMs;
        this._laserData = { charging: true, x: this.getCenterX(), progress: this.stateTimer / this.chargeTime };
        if (this.stateTimer >= this.chargeTime) { this.state = 'firing'; this.stateTimer = 0; } break;
      case 'firing':
        this.damageMult = 1.0; this.stateTimer += dtMs;
        var laserWidth = 30;
        this._laserData = { charging: false, firing: true, x: this.getCenterX(), width: laserWidth, dual: this.cycle >= 2, dualOffsets: this.cycle >= 2 ? [-30, 30] : [0] };
        if (this.stateTimer >= this.laserDuration) {
          this.state = 'idle'; this._laserData = null;
          if (this.cycle >= 1) this._fireTrails.push({ x: this.getCenterX() - laserWidth / 2, y: this.y + this.height, width: laserWidth, timer: 3000 });
        } break;
    }
    for (var i = this._fireTrails.length - 1; i >= 0; i--) { this._fireTrails[i].timer -= dtMs; if (this._fireTrails[i].timer <= 0) this._fireTrails.splice(i, 1); }
  }
  isInLaserZone(bulletX, bulletY) {
    if (!this._laserData || !this._laserData.firing) return false;
    var offsets = this._laserData.dualOffsets || [0];
    for (var i = 0; i < offsets.length; i++) { if (Math.abs(bulletX - (this._laserData.x + offsets[i])) < this._laserData.width / 2) return true; }
    return false;
  }
  getRenderData() { return { type: 'laser', state: this.state, stateTimer: this.stateTimer, cycle: this.cycle, laserData: this._laserData, fireTrails: this._fireTrails }; }
}

module.exports = LaserTurretBoss;
