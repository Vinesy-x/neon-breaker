/**
 * Missile.js - missile 武器
 */
const Weapon = require('./Weapon');
const Config = require('../Config');
const Sound = require('../systems/SoundManager');

class MissileWeapon extends Weapon {
  constructor() {
    super('missile');
    this.missiles = [];
    this.explosions = [];
  }

  update(dtMs, ctx) {
    const dt = dtMs / 16.67;
    this.timer += dtMs;

    if (this.timer >= this.def.interval) {
      this.timer = 0;
      this._launch(ctx);
    }

    const baseAttack = ctx.getBaseAttack ? ctx.getBaseAttack() : 1;
    // 直击伤害 = baseAttack × 1.5 × (1 + damageLv × 0.5)
    const directDmg = this.getDamage(baseAttack);
    // 爆炸伤害 = baseAttack × 0.5 × (1 + blastLv × 0.5)
    const blastLv = this.branches.blastPower || 0;
    const blastDmg = Math.max(0.1, baseAttack * 0.5 * (1 + blastLv * 0.5));
    const trackMult = 1 + (this.branches.tracking || 0) * 0.3;
    const speed = 3 * trackMult;
    const baseAoe = 25 * (1 + (this.branches.aoe || 0) * 0.25);
    const splitLv = this.branches.split || 0;
    const nukeLv = this.branches.nuke || 0;

    for (let i = this.missiles.length - 1; i >= 0; i--) {
      const m = this.missiles[i];
      let tx = m.targetX, ty = m.targetY;
      if (m.targetBrick && m.targetBrick.alive) {
        const bc = m.targetBrick.getCenter(); tx = bc.x; ty = bc.y;
      } else if (ctx.boss && ctx.boss.alive) {
        tx = ctx.boss.getCenterX(); ty = ctx.boss.getCenterY();
      }
      const dx = tx - m.x, dy = ty - m.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 3) {
        m.x += (dx / dist) * speed * dt;
        m.y += (dy / dist) * speed * dt;
      }
      m.trail.push({ x: m.x, y: m.y });
      if (m.trail.length > 4) m.trail.shift();

      let hit = false;
      for (let j = 0; j < ctx.bricks.length; j++) {
        const brick = ctx.bricks[j];
        if (!brick.alive) continue;
        const bc = brick.getCenter();
        if (Math.abs(m.x - bc.x) < brick.width / 2 + 5 && Math.abs(m.y - bc.y) < brick.height / 2 + 5) {
          ctx.damageBrick(brick, directDmg, 'missile');
          const effectiveAoe = nukeLv > 0 ? baseAoe * 3 : baseAoe;
          const effectiveBlast = nukeLv > 0 ? blastDmg * 2 : blastDmg;
          this._explodeArea(m.x, m.y, effectiveAoe, effectiveBlast, ctx);
          this.explosions.push({ x: m.x, y: m.y, radius: effectiveAoe, alpha: 1.0 });
          if (this.explosions.length > 8) this.explosions.shift();
          if (nukeLv > 0) ctx.screenShake = Math.min((ctx.screenShake || 0) + 6, 12);
          if (splitLv > 0) this._spawnSplits(m.x, m.y, splitLv, ctx);
          Sound.missileExplode();
          hit = true; break;
        }
      }
      if (!hit && ctx.boss && ctx.boss.alive) {
        if (Math.abs(m.x - ctx.boss.getCenterX()) < ctx.boss.width / 2 + 5 &&
            Math.abs(m.y - ctx.boss.getCenterY()) < ctx.boss.height / 2 + 5) {
          ctx.damageBoss(directDmg, "missile"); hit = true;
        }
      }
      if (hit || m.y < -20 || m.y > Config.SCREEN_HEIGHT + 20 ||
          (m.isSplitChild && --m.splitLife <= 0)) {
        this.missiles.splice(i, 1);
      }
    }

    for (let i = this.explosions.length - 1; i >= 0; i--) {
      this.explosions[i].alpha -= 0.05 * dt;
      if (this.explosions[i].alpha <= 0) this.explosions.splice(i, 1);
    }
  }

  _launch(ctx) {
    const count = 1 + (this.branches.count || 0);
    const aliveBricks = ctx.bricks.filter(b => b.alive);
    Sound.missileLaunch();
    for (let i = 0; i < count; i++) {
      let targetBrick = aliveBricks.length > 0 ? aliveBricks[Math.floor(Math.random() * aliveBricks.length)] : null;
      this.missiles.push({
        x: ctx.launcher.getCenterX() + (i - (count - 1) / 2) * 20,
        y: ctx.launcher.y - 10,
        targetBrick: targetBrick,
        targetX: targetBrick ? targetBrick.getCenter().x : Config.SCREEN_WIDTH / 2,
        targetY: targetBrick ? targetBrick.getCenter().y : 100,
        trail: [],
      });
    }
  }

  _explodeArea(cx, cy, radius, damage, ctx) {
    for (let i = 0; i < ctx.bricks.length; i++) {
      const brick = ctx.bricks[i];
      if (!brick.alive) continue;
      const bc = brick.getCenter();
      if (Math.sqrt((bc.x - cx) ** 2 + (bc.y - cy) ** 2) <= radius) {
        ctx.damageBrick(brick, damage, 'missile_aoe');
      }
    }
  }

  _spawnSplits(cx, cy, level, ctx) {
    const n = 3 * level;
    // 限制同屏导弹数量，防止爆炸
    if (this.missiles.length >= 30) return;
    for (let i = 0; i < n; i++) {
      const angle = (Math.PI * 2 / n) * i;
      this.missiles.push({
        x: cx, y: cy,
        targetBrick: null,
        targetX: cx + Math.cos(angle) * 80,
        targetY: cy + Math.sin(angle) * 80,
        trail: [], isSplitChild: true, splitLife: 40,
      });
    }
  }

  /** 直击伤害 = baseAttack × basePct × (1 + damageLv × 0.5) */
  getDamage(baseAttack) {
    return Math.max(0.1, baseAttack * this.def.basePct * (1 + (this.branches.damage || 0) * 0.5));
  }

  getRenderData() { return { missiles: this.missiles, explosions: this.explosions, color: this.def.color }; }
  getWingData(lcx, lcy) { return { type: 'missile', color: this.def.color, x: lcx, y: lcy }; }
}

// ===== 天降陨石 =====

module.exports = MissileWeapon;
