const BossBase = require('./BossBase');
const Config = require('../Config');
const BrickFactory = require('../BrickFactory');

class SummonerBoss extends BossBase {
  constructor(hpMult, cycle, gameAreaWidth) {
    super('summoner', 4000, hpMult, cycle, gameAreaWidth);
    this.summonInterval = cycle >= 1 ? 4000 : 5000;
    this.summonInvulnTime = 2000; this.invulnTimer = 0;
    var bw = 30, bh = 22;
    this._initParts([
      { ox: bw * 2, oy: 0, w: bw * 2, h: bh },
      { ox: 0, oy: bh, w: bw * 6, h: bh },
      { ox: bw * 2, oy: bh * 2, w: bw * 2, h: bh },
      { ox: bw * 2, oy: bh * 3, w: bw * 2, h: bh },
    ]);
  }
  getPhaseColor() { return '#AA44FF'; }
  update(dtMs) {
    var dt = dtMs / 16.67;
    if (this.flashTimer > 0) this.flashTimer -= dtMs;
    this._descend(dt);
    switch (this.state) {
      case 'idle':
        this.damageMult = 1.0; this._moveLeftRight(dt, 0.6); this.actionTimer += dtMs;
        if (this.actionTimer >= this.summonInterval) { this.actionTimer = 0; this.state = 'summoning'; this.stateTimer = 0; this.invulnTimer = this.summonInvulnTime; this.damageMult = 0; this._summonBricks(); } break;
      case 'summoning':
        this.damageMult = 0; this.stateTimer += dtMs; this.invulnTimer -= dtMs;
        if (this.invulnTimer <= 0) { this.state = 'idle'; this.damageMult = 1.0; } break;
    }
  }
  _summonBricks() {
    var y = this.y + this.height + 10;
    var phase = { types: ['normal'], timeCurve: [2.0, 3.0], spawnMult: 1.0 };
    if (this.cycle >= 2) { phase.types = ['normal', 'fast', 'shield']; phase.timeCurve = [3.0, 4.0]; }
    var config = { baseHP: 1 + this.cycle * 0.5, chapterScale: this.hpMult, gapChance: 0.2 };
    this._spawnedBricks = this._spawnedBricks.concat(BrickFactory.generateRow(this.gameAreaWidth, y, phase, config));
    if (this.cycle >= 3) { var y2 = y - Config.BRICK_HEIGHT - Config.BRICK_PADDING; this._spawnedBricks = this._spawnedBricks.concat(BrickFactory.generateRow(this.gameAreaWidth, y2, phase, config)); }
  }
  getRenderData() { return { type: 'summoner', state: this.state, stateTimer: this.stateTimer, invulnTimer: this.invulnTimer, cycle: this.cycle }; }
}

module.exports = SummonerBoss;
