/**
 * Kunai.js - kunai 武器
 */
const Weapon = require('./Weapon');
const Config = require('../Config');
const Sound = require('../systems/SoundManager');

class Kunai extends Weapon {
  constructor() {
    super('kunai');
    this.knives = [];
  }

  update(dtMs, ctx) {
    const dt = dtMs / 16.67;
    this.timer += dtMs;
    const speedMult = 1 + (this.branches.speed || 0) * 0.3;
    const interval = this.def.interval / speedMult;

    if (this.timer >= interval) {
      this.timer = 0;
      this._fire(ctx);
    }

    const baseAttack = ctx.getBaseAttack ? ctx.getBaseAttack() : 1;
    const damage = this.getDamage(baseAttack);

    for (let i = this.knives.length - 1; i >= 0; i--) {
      const k = this.knives[i];
      k.x += k.vx * dt;
      k.y += k.vy * dt;
      k.life -= dtMs;
      k.tickTimer += dtMs;

      if (k.tickTimer >= 100) {
        k.tickTimer = 0;
        this._checkHit(k, damage, ctx);
      }

      if (k.returning) {
        const dx = k.homeX - k.x, dy = k.homeY - k.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 15) { this.knives.splice(i, 1); continue; }
        k.vx = (dx / dist) * 6;
        k.vy = (dy / dist) * 6;
      } else if ((this.branches.return || 0) > 0 && k.life <= k.maxLife * 0.4) {
        k.returning = true;
        k.homeX = ctx.launcher.getCenterX();
        k.homeY = ctx.launcher.y;
        k.hitSet = {};
      }

      if (!k.returning && (k.life <= 0 || k.y < -20 || k.x < -20 || k.x > Config.SCREEN_WIDTH + 20)) {
        this.knives.splice(i, 1);
      }
    }
  }

  _fire(ctx) {
    const count = 1 + (this.branches.count || 0);
    const scatterLv = this.branches.scatter || 0;
    const speedMult = 1 + (this.branches.speed || 0) * 0.3;
    const cx = ctx.launcher.getCenterX();
    const cy = ctx.launcher.y - 10;
    const baseSpeed = 5 * speedMult;
    const totalSpread = scatterLv > 0 ? (Math.PI / 6) * scatterLv : (count > 1 ? Math.PI / 8 : 0);

    for (let i = 0; i < count; i++) {
      let angle = -Math.PI / 2;
      if (count > 1) {
        angle = -Math.PI / 2 - totalSpread / 2 + (totalSpread / (count - 1)) * i;
      }
      const maxLife = 2500 + (this.branches.pierce || 0) * 500;
      this.knives.push({
        x: cx + (i - (count - 1) / 2) * 8, y: cy,
        vx: Math.cos(angle) * baseSpeed, vy: Math.sin(angle) * baseSpeed,
        pierce: this.branches.pierce || 0,
        life: maxLife, maxLife: maxLife,
        returning: false, homeX: cx, homeY: cy,
        tickTimer: 0, hitSet: {},
      });
    }
    Sound.bulletShoot();
  }

  _checkHit(knife, damage, ctx) {
    for (let j = 0; j < ctx.bricks.length; j++) {
      const brick = ctx.bricks[j];
      if (!brick.alive) continue;
      if (knife.hitSet[j] && !knife.returning) continue;
      const bc = brick.getCenter();
      if (Math.abs(knife.x - bc.x) < brick.width / 2 + 6 && Math.abs(knife.y - bc.y) < brick.height / 2 + 6) {
        knife.hitSet[j] = true;
        ctx.damageBrick(brick, damage, 'kunai');
        if (knife.pierce > 0) { knife.pierce--; }
        else if (!knife.returning) { knife.life = 0; }
      }
    }
    if (ctx.boss && ctx.boss.alive) {
      const bx = ctx.boss.getCenterX(), by = ctx.boss.getCenterY();
      if (Math.abs(knife.x - bx) < ctx.boss.width / 2 + 6 && Math.abs(knife.y - by) < ctx.boss.height / 2 + 6) {
        ctx.damageBoss(damage);
      }
    }
  }

  getRenderData() { return { knives: this.knives, color: this.def.color }; }
  getWingData(lcx, lcy) { return { type: 'kunai', color: this.def.color, x: lcx, y: lcy }; }
}

// ===== 闪电链 =====

module.exports = Kunai;
