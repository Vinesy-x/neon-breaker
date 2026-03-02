const BossBase = require('./BossBase');
const Config = require('../Config');

class GuardianBoss extends BossBase {
  constructor(hpMult, cycle, gameAreaWidth) {
    super('guardian', 5600, hpMult, cycle, gameAreaWidth);
    this.shieldCount = cycle >= 1 ? 3 : 2;
    this.shieldMaxHp = Math.floor(80 * hpMult);
    this.shields = []; this.shieldAngle = 0; this.shieldSpeed = 0.02;
    this.shieldRegenTime = cycle >= 3 ? 5000 : 8000;
    this.shieldDownTimer = 0; this.allShieldsDown = false; this.windowTimer = 0;
    var bw = 25, bh = 20;
    this._initParts([
      { ox: 0, oy: 0, w: bw * 2, h: bh },
      { ox: bw * 6, oy: 0, w: bw * 2, h: bh },
      { ox: 0, oy: bh, w: bw * 8, h: bh },
      { ox: 0, oy: bh * 2, w: bw * 8, h: bh },
      { ox: bw, oy: bh * 3, w: bw * 6, h: bh },
    ]);
    this._initShields();
  }
  _initShields() {
    this.shields = [];
    for (var i = 0; i < this.shieldCount; i++) this.shields.push({ hp: this.shieldMaxHp, maxHp: this.shieldMaxHp, alive: true, angle: (Math.PI * 2 / this.shieldCount) * i });
    this.allShieldsDown = false; this.windowTimer = 0; this.shieldDownTimer = 0;
  }
  getPhaseColor() { return '#4488FF'; }
  hitShield(bulletX, bulletY, bulletRadius) {
    if (this.allShieldsDown) return false;
    var cx = this.getCenterX(), cy = this.getCenterY(), shieldRadius = 50;
    for (var i = 0; i < this.shields.length; i++) {
      var s = this.shields[i]; if (!s.alive) continue;
      var sx = cx + Math.cos(s.angle + this.shieldAngle) * shieldRadius;
      var sy = cy + Math.sin(s.angle + this.shieldAngle) * shieldRadius;
      var dist = Math.sqrt((bulletX - sx) * (bulletX - sx) + (bulletY - sy) * (bulletY - sy));
      if (dist < 20 + bulletRadius) {
        s.hp--; if (s.hp <= 0) { s.alive = false; var anyAlive = false;
          for (var j = 0; j < this.shields.length; j++) { if (this.shields[j].alive) { anyAlive = true; break; } }
          if (!anyAlive) { this.allShieldsDown = true; this.windowTimer = 5000; this.shieldDownTimer = 0; }
        } return true;
      }
    } return false;
  }
  update(dtMs) {
    // 沙盒简化模式：只左右移动+缓慢下移
    if (this._simpleBoss) { var dt=dtMs/16.67; if(this.flashTimer>0)this.flashTimer-=dtMs; this._moveLeftRight(dt,1); this._descend(dt); this._checkPhaseChange(); return; }
    var dt = dtMs / 16.67;
    if (this.flashTimer > 0) this.flashTimer -= dtMs;
    this._descend(dt); this._moveLeftRight(dt, 0.8); this.shieldAngle += this.shieldSpeed * dt;
    if (this.allShieldsDown) {
      this.damageMult = 1.5; this.windowTimer -= dtMs;
      if (this.windowTimer <= 0) { this.shieldDownTimer += dtMs; this.damageMult = 1.0; if (this.shieldDownTimer >= this.shieldRegenTime) this._initShields(); }
    } else { this.damageMult = 1.0; }
  }
  getRenderData() { return { type: 'guardian', state: this.allShieldsDown ? 'vulnerable' : 'shielded', shields: this.shields, shieldAngle: this.shieldAngle, cycle: this.cycle, windowTimer: this.windowTimer }; }
}

module.exports = GuardianBoss;
