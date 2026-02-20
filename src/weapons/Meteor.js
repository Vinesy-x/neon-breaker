/**
 * Meteor.js - meteor 武器
 */
const Weapon = require('./Weapon');
const Config = require('../Config');
const Sound = require('../systems/SoundManager');

class MeteorWeapon extends Weapon {
  constructor() {
    super('meteor');
    this.meteors = [];
    this.burnZones = [];
  }

  update(dtMs, ctx) {
    const dt = dtMs / 16.67;
    this.timer += dtMs;
    const interval = this.def.interval * Math.pow(0.85, this.branches.freq || 0);

    if (this.timer >= interval) {
      this.timer = 0;
      this._drop(ctx);
    }

    const baseAttack = ctx.getBaseAttack ? ctx.getBaseAttack() : 1;
    const damage = this.getDamage(baseAttack);
    const baseRadius = 30 * (1 + (this.branches.radius || 0) * 0.25);

    for (let i = this.meteors.length - 1; i >= 0; i--) {
      const m = this.meteors[i];
      m.y += m.vy * dt;
      m.vy += 0.3 * dt;
      if (m.y >= m.targetY) {
        this._explodeArea(m.targetX, m.targetY, baseRadius, damage, ctx);
        if (ctx.particles) ctx.particles.emitBrickBreak(m.targetX - 15, m.targetY - 15, 30, 30, this.def.color);
        Sound.missileExplode();
        ctx.screenShake = Math.min((ctx.screenShake || 0) + 3, 8);
        if ((this.branches.burn || 0) > 0) {
          this.burnZones.push({
            x: m.targetX, y: m.targetY, radius: baseRadius * 0.8,
            life: 3000 + (this.branches.burn - 1) * 1500,
            tickTimer: 0, damage: damage * 0.3,
          });
        }
        this.meteors.splice(i, 1);
      }
    }

    for (let i = this.burnZones.length - 1; i >= 0; i--) {
      const z = this.burnZones[i];
      z.life -= dtMs;
      z.tickTimer += dtMs;
      if (z.tickTimer >= 500) {
        z.tickTimer = 0;
        this._explodeArea(z.x, z.y, z.radius, z.damage, ctx);
      }
      if (z.life <= 0) this.burnZones.splice(i, 1);
    }
  }

  _drop(ctx) {
    const count = 1 + (this.branches.count || 0);
    const rainLv = this.branches.rain || 0;
    if (rainLv > 0) {
      const cols = Config.BRICK_COLS;
      const bw = (Config.SCREEN_WIDTH - Config.BRICK_PADDING * (cols + 1)) / cols;
      for (let c = 0; c < cols; c++) {
        const tx = Config.BRICK_PADDING + c * (bw + Config.BRICK_PADDING) + bw / 2;
        const ty = Config.BRICK_TOP_OFFSET + Math.random() * (Config.SCREEN_HEIGHT * 0.4);
        this.meteors.push({ x: tx + (Math.random() - 0.5) * 30, y: -30, targetX: tx, targetY: ty, vy: 2 });
      }
    } else {
      for (let i = 0; i < count; i++) {
        const tx = 30 + Math.random() * (Config.SCREEN_WIDTH - 60);
        const ty = Config.BRICK_TOP_OFFSET + Math.random() * (Config.SCREEN_HEIGHT * 0.5);
        this.meteors.push({ x: tx + (Math.random() - 0.5) * 40, y: -30, targetX: tx, targetY: ty, vy: 2 + Math.random() * 2 });
      }
    }
    Sound.fireSurge();
  }

  _explodeArea(cx, cy, radius, damage, ctx) {
    for (let i = 0; i < ctx.bricks.length; i++) {
      const brick = ctx.bricks[i];
      if (!brick.alive) continue;
      const bc = brick.getCenter();
      if (Math.sqrt((bc.x - cx) ** 2 + (bc.y - cy) ** 2) <= radius) {
        ctx.damageBrick(brick, damage, 'meteor');
      }
    }
    if (ctx.boss && ctx.boss.alive) {
      if (Math.sqrt((ctx.boss.getCenterX() - cx) ** 2 + (ctx.boss.getCenterY() - cy) ** 2) <= radius) {
        ctx.damageBoss(damage, "meteor");
      }
    }
  }

  getRenderData() { return { meteors: this.meteors, burnZones: this.burnZones, color: this.def.color }; }
  getWingData(lcx, lcy) { return { type: 'meteor', color: this.def.color, x: lcx, y: lcy }; }
}

// ===== 攻击无人机 =====

module.exports = MeteorWeapon;
