/**
 * BossBase.js - Boss 基类
 * 通用的HP/部件/移动/碰撞/下压逻辑
 */
const Config = require('../Config');

class BossBase {
  constructor(type, baseHp, hpMult, cycle, gameAreaWidth) {
    this.type = type;
    this.width = Config.BOSS_WIDTH;
    this.height = Config.BOSS_HEIGHT;
    this.x = (gameAreaWidth - this.width) / 2;
    this.y = Config.SAFE_TOP + 20;
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
    this.phase = 0;
    this.phaseChangeFlash = 0;
    this.damageMult = 1.0;

    this._spawnedBricks = [];
    this._fireTrails = [];
    this._laserData = null;

    this.descendSpeed = 0.08 + cycle * 0.01;
    this.parts = [{ ox: 0, oy: 0, w: this.width, h: this.height }];
  }

  _initParts(partDefs) {
    this.parts = partDefs;
    var minX = Infinity, maxX = -Infinity;
    for (var i = 0; i < partDefs.length; i++) {
      var p = partDefs[i];
      if (p.ox < minX) minX = p.ox;
      if (p.ox + p.w > maxX) maxX = p.ox + p.w;
    }
    var minY = Infinity, maxY = -Infinity;
    for (var i = 0; i < partDefs.length; i++) {
      var p = partDefs[i];
      if (p.oy < minY) minY = p.oy;
      if (p.oy + p.h > maxY) maxY = p.oy + p.h;
    }
    this.width = maxX - minX;
    this.height = maxY - minY;
    this._partsOffsetX = minX;
    this._partsOffsetY = minY;
    this.x = (this.gameAreaWidth - this.width) / 2 - this._partsOffsetX;
  }

  hit(damage) {
    var actual = damage * this.damageMult;
    this.hp -= actual;
    this.flashTimer = 100;
    if (this.hp <= 0) { this.hp = 0; this.alive = false; return true; }
    return false;
  }

  getCenterX() { return this.x + this.width / 2; }
  getCenterY() { return this.y + this.height / 2; }
  getHpRatio() { return this.hp / this.maxHp; }
  getPhaseColor() { return Config.NEON_CYAN; }

  collectSpawnedBricks() { var b = this._spawnedBricks; this._spawnedBricks = []; return b; }

  hitTestPoint(px, py) {
    for (var i = 0; i < this.parts.length; i++) {
      var p = this.parts[i], rx = this.x + p.ox, ry = this.y + p.oy;
      if (px >= rx && px <= rx + p.w && py >= ry && py <= ry + p.h) return true;
    }
    return false;
  }

  hitTestRect(rx, ry, rw, rh) {
    for (var i = 0; i < this.parts.length; i++) {
      var p = this.parts[i], px = this.x + p.ox, py = this.y + p.oy;
      if (rx < px + p.w && rx + rw > px && ry < py + p.h && ry + rh > py) return true;
    }
    return false;
  }

  _moveLeftRight(dt, speedMult) {
    this.x += this.speed * (speedMult || 1) * this.direction * dt;
    var minOx = this._partsOffsetX || 0;
    if (this.x + minOx <= 0) { this.x = -minOx; this.direction = 1; }
    var maxRight = 0;
    for (var i = 0; i < this.parts.length; i++) { var r = this.parts[i].ox + this.parts[i].w; if (r > maxRight) maxRight = r; }
    if (this.x + maxRight >= this.gameAreaWidth) { this.x = this.gameAreaWidth - maxRight; this.direction = -1; }
  }

  _descend(dt) { this.y += this.descendSpeed * dt; }

  isPastDangerLine() {
    var dangerY = Config.SCREEN_HEIGHT * Config.BRICK_DANGER_Y;
    for (var i = 0; i < this.parts.length; i++) { if (this.y + this.parts[i].oy + this.parts[i].h >= dangerY) return true; }
    return false;
  }

  update(dtMs) {
    var dt = dtMs / 16.67;
    if (this.flashTimer > 0) this.flashTimer -= dtMs;
    if (this.phaseChangeFlash > 0) this.phaseChangeFlash -= dtMs;
  }

  getRenderData() { return { type: this.type, state: this.state, stateTimer: this.stateTimer, cycle: this.cycle, parts: this.parts }; }
}

module.exports = BossBase;
