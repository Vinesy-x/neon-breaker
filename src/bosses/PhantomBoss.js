const BossBase = require('./BossBase');
const Config = require('../Config');
const BrickFactory = require('../BrickFactory');

class PhantomBoss extends BossBase {
  constructor(hpMult, cycle, gameAreaWidth) {
    super('phantom', 4480, hpMult, cycle, gameAreaWidth);
    this.blinkInterval = cycle >= 3 ? 3000 : 4000;
    this.appearWindowTime = 1000; this.invisTimer = 0; this.appearTimer = 0;
    this.speed = Config.BOSS_SPEED * 1.5; this._afterImages = [];
    var bw = 28, bh = 18;
    this._initParts([
      { ox: bw * 2, oy: 0, w: bw * 2, h: bh },
      { ox: bw, oy: bh, w: bw * 4, h: bh },
      { ox: 0, oy: bh * 2, w: bw * 6, h: bh },
      { ox: bw, oy: bh * 3, w: bw * 4, h: bh },
      { ox: bw * 2, oy: bh * 4, w: bw * 2, h: bh },
    ]);
  }
  getPhaseColor() { return '#DDDDDD'; }
  update(dtMs) {
    // 沙盒简化模式：只左右移动+缓慢下移
    if (this._simpleBoss) { var dt=dtMs/16.67; if(this.flashTimer>0)this.flashTimer-=dtMs; this._moveLeftRight(dt,1); this._descend(dt); this._checkPhaseChange(); return; }
    var dt = dtMs / 16.67;
    if (this.flashTimer > 0) this.flashTimer -= dtMs;
    this._descend(dt);
    switch (this.state) {
      case 'idle':
        this._moveLeftRight(dt, 1.2); this.appearTimer += dtMs;
        this.damageMult = this.appearTimer < this.appearWindowTime ? 2.0 : 1.0;
        this.actionTimer += dtMs;
        if (this.actionTimer >= this.blinkInterval) {
          this.actionTimer = 0; this.state = 'blinking'; this.stateTimer = 0; this.invisTimer = 500;
          if (this.cycle >= 1) this._afterImages.push({ x: this.x, y: this.y, timer: 2000, width: this.width, height: this.height });
        } break;
      case 'blinking':
        this.damageMult = 0; this.stateTimer += dtMs;
        if (this.stateTimer >= this.invisTimer) {
          this.x = Math.random() * (this.gameAreaWidth - this.width);
          this.y = this.y + (Math.random() - 0.5) * 30;
          this.state = 'idle'; this.appearTimer = 0; this.damageMult = 2.0; this._spawnAppearBricks();
        } break;
    }
    for (var i = this._afterImages.length - 1; i >= 0; i--) { this._afterImages[i].timer -= dtMs; if (this._afterImages[i].timer <= 0) this._afterImages.splice(i, 1); }
  }
  _spawnAppearBricks() {
    var y = this.y + this.height + 5;
    var phase = { types: this.cycle >= 2 ? ['split'] : ['fast'], timeCurve: [1.5, 2.0], spawnMult: 1.0 };
    var config = { baseHP: 1, chapterScale: this.hpMult * 0.5, gapChance: 0.3 };
    this._spawnedBricks = this._spawnedBricks.concat(BrickFactory.generateRow(this.gameAreaWidth, y, phase, config));
  }
  getRenderData() { return { type: 'phantom', state: this.state, stateTimer: this.stateTimer, cycle: this.cycle, afterImages: this._afterImages, appearTimer: this.appearTimer, appearWindowTime: this.appearWindowTime }; }
}

module.exports = PhantomBoss;
