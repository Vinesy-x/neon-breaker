/**
 * IonBeam.js - 离子射线
 * 持续锁定单体目标的高伤激光束，Boss杀手
 * 标记机制：持续命中叠加标记层数，每层增伤
 * 蓄能大球：周期性蓄能→释放超级能量球→大伤害+击退
 */
const Weapon = require('./Weapon');
const Config = require('../Config');
const Sound = require('../systems/SoundManager');

class IonBeamWeapon extends Weapon {
  constructor() {
    super('ionBeam');
    this.beam = null;
    this.chargeTimer = 0;
    this.firingTimer = 0;
    this.isFiring = false;
    this.burstReady = false;
    this.burstFlash = 0;
    this.markStacks = 0;
    this.markTarget = null;
    this.lockedTarget = null;
    this.hitSparks = [];

    // 蓄能大球系统
    this.superOrb = null;          // 当前飞行中的超级能量球
    this.superChargeTimer = 0;     // 蓄能计时
    this.superCharging = false;    // 是否正在蓄能
    this.superChargeProgress = 0;  // 蓄能进度 0-1
  }

  getDamage(baseAttack) {
    return Math.max(0.1, baseAttack * this.def.basePct * (1 + (this.branches.damage || 0) * 0.7));  // 0.5→0.7 buff
  }

  update(dtMs, ctx) {
    const dt = dtMs / 16.67;
    const baseAttack = ctx.getBaseAttack ? ctx.getBaseAttack() : 1;
    const tickDamage = this.getDamage(baseAttack);
    const durationLv = this.branches.duration || 0;
    const pierceLv = this.branches.pierce || 0;
    const chargeLv = this.branches.charge || 0;
    const markLv = this.branches.mark || 0;
    const overloadLv = this.branches.overload || 0;
    const splitLv = this.branches.split || 0;
    const superOrbLv = this.branches.superOrb || 0;

    const fireInterval = this.def.interval * Math.pow(0.8, this.branches.freq || 0);
    const fireDuration = 3000 + durationLv * 1000;

    if (this.burstFlash > 0) this.burstFlash -= dtMs;

    // 更新命中火花
    for (let i = this.hitSparks.length - 1; i >= 0; i--) {
      const s = this.hitSparks[i];
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.alpha -= 0.04 * dt;
      if (s.alpha <= 0) this.hitSparks.splice(i, 1);
    }
    while (this.hitSparks.length > 40) this.hitSparks.shift();

    // 更新超级能量球
    if (this.superOrb) {
      const oldProgress = this.superOrb.progress;
      this.superOrb.progress += this.superOrb.speed * dt;

      // 沿途伤害检测
      this._superOrbPathDamage(this.superOrb, oldProgress, ctx, tickDamage * 0.8);

      if (this.superOrb.progress >= 1) {
        // 命中！超级伤害 + 击退
        this._superOrbHit(this.superOrb, ctx, tickDamage);
        this.superOrb = null;
      }
    }

    let lastTarget = null;

    if (!this.isFiring) {
      this.chargeTimer += dtMs;
      if (this.chargeTimer >= fireInterval) {
        this.chargeTimer = 0;
        this.isFiring = true;
        this.firingTimer = 0;
        this.markStacks = 0;
        this.markTarget = null;
        this.lockedTarget = null;
        this.superChargeTimer = 0;
        this.superCharging = false;
        this.superChargeProgress = 0;
        this._overloadPulseTimer = 0;
        if (chargeLv > 0) this.burstReady = true;
        Sound.ionBeamStart();
      }
      this.beam = null;
    } else {
      this.firingTimer += dtMs;

      // 锁定目标
      if (!this.lockedTarget || !this._isAlive(this.lockedTarget)) {
        this.lockedTarget = this._findTarget(ctx);
        if (markLv > 0) {
          this.markStacks = 0;
          this.markTarget = this.lockedTarget ? this.lockedTarget.ref : null;
        }
      } else {
        this._refreshTargetPos(this.lockedTarget, ctx);
      }

      const target = this.lockedTarget;
      lastTarget = target;

      if (target) {
        const sx = ctx.launcher.getCenterX();
        const sy = ctx.launcher.y - 10;
        const tx = target.x;
        const ty = target.y;

        this.beam = {
          sx, sy, tx, ty, alpha: 1.0,
          markStacks: this.markStacks,
          superCharging: this.superCharging,
          superChargeProgress: this.superChargeProgress,
        };

        // === 常规tick伤害 ===
        this.timer += dtMs;
        if (this.timer >= 100) {
          this.timer -= 100;
          let dmg = tickDamage;

          // 充能爆发（开场）
          if (this.burstReady) {
            dmg *= (2.5 + chargeLv * 1.5);
            this.burstReady = false;
            this.burstFlash = 400;
            ctx.screenShake = Math.min((ctx.screenShake || 0) + 3, 6);
            this._emitHitSparks(tx, ty, 8);
          }

          // 标记增伤
          if (markLv > 0 && this.markStacks > 0) {
            dmg *= (1 + this.markStacks * 0.12 * markLv);  // 0.08→0.12 buff
          }

          // 造成伤害
          if (target.isNegaBrick) {
            // === 奇点引擎联动：对负能量砖块充能 ===
            const gravityWell = ctx.upgrades && ctx.upgrades.weapons && ctx.upgrades.weapons.gravityWell;
            if (gravityWell) {
              gravityWell.damageNegaBrick(target.ref, dmg);
            }
          } else if (target.isBoss) {
            ctx.damageBoss(dmg, 'ionBeam');
          } else {
            ctx.damageBrick(target.ref, dmg, 'ionBeam', 'energy');
          }

          // 离子灼烧DOT：每tick造成目标当前HP 1%的伤害，上限为baseAttack × 20
          if (target.ref && target.ref.alive && !target.isNegaBrick) {
            const currentHp = target.isBoss ? target.ref.hp : target.ref.hp;
            const pctDmg = Math.min(currentHp * 0.01, baseAttack * 20);
            if (pctDmg > 0.1) {
              if (target.isBoss) {
                ctx.damageBoss(pctDmg, 'ionBeam_burn');
              } else {
                ctx.damageBrick(target.ref, pctDmg, 'ionBeam_burn', 'energy');
              }
            }
          }

          // 叠加标记
          if (markLv > 0) {
            this.markStacks = Math.min(this.markStacks + 1, 30);
          }

          // 穿透
          if (pierceLv > 0) {
            this._pierceDamage(sx, sy, tx, ty, dmg * 0.2 * pierceLv, target, ctx);
          }

          // 分裂
          if (splitLv > 0) {
            this._splitDamage(tx, ty, dmg * 0.2 * splitLv, target, ctx);
          }

          // 过载脉冲：射击期间每800ms触发一次小范围过载
          if (overloadLv > 0) {
            if (!this._overloadPulseTimer) this._overloadPulseTimer = 0;
            this._overloadPulseTimer += 100; // 每tick +100ms
            if (this._overloadPulseTimer >= 800) {
              this._overloadPulseTimer = 0;
              this._overloadBurst(tx, ty, tickDamage * (4 + overloadLv * 3), ctx);  // (3+2x)→(4+3x) buff
            }
          }

          this._emitHitSparks(tx, ty, 2);
        }

        // === 超级能量球（需要 superOrb 分支） ===
        if (superOrbLv > 0) {
          const SUPER_CYCLE = 1500;  // 周期
          const CHARGE_TIME = 400;   // 蓄能时间

          this.superChargeTimer += dtMs;

          if (this.superChargeTimer >= SUPER_CYCLE - CHARGE_TIME && !this.superCharging && !this.superOrb) {
            // 开始蓄能
            this.superCharging = true;
          }

          if (this.superCharging) {
            const chargeElapsed = this.superChargeTimer - (SUPER_CYCLE - CHARGE_TIME);
            this.superChargeProgress = Math.min(1, chargeElapsed / CHARGE_TIME);

            if (this.superChargeTimer >= SUPER_CYCLE) {
              // 蓄能完成 → 发射超级能量球！
              this.superOrb = {
                sx, sy, tx, ty,
                progress: 0,
                speed: 0.06,
                size: 15 + Math.min(this.markStacks, 30) * 0.5,
                damage: tickDamage * (30 * superOrbLv + this.markStacks * 0.5), // 30倍×等级
                targetRef: target.ref,
                isBoss: target.isBoss,
              };
            this.superChargeTimer = 0;
            this.superCharging = false;
            this.superChargeProgress = 0;
            Sound.ionBeamBurst();
          }
        }
        } // end superOrbLv

      } else {
        this.beam = null;
      }

      if (this.firingTimer >= fireDuration) {
        this.isFiring = false;
        this.beam = null;

        if (overloadLv > 0 && lastTarget) {
          this._overloadBurst(lastTarget.x, lastTarget.y, tickDamage * (6 + overloadLv * 5), ctx);  // (5+4x)→(6+5x) buff
        }

        this.markStacks = 0;
        this.markTarget = null;
        this.lockedTarget = null;
        this.superOrb = null;
        this.superChargeTimer = 0;
        this.superCharging = false;
        this.superChargeProgress = 0;
      }
    }
  }

  _superOrbHit(orb, ctx, baseDmg) {
    const tx = orb.tx, ty = orb.ty;
    const dmg = orb.damage;

    // 造成超级伤害
    if (orb.isBoss && ctx.boss && ctx.boss.alive) {
      ctx.damageBoss(dmg, 'ionBeam_super');
      // Boss击退（向上推）
      if (ctx.boss.knockback !== undefined) {
        ctx.boss.knockback = Math.min((ctx.boss.knockback || 0) - 15, -15);
      }
    } else if (orb.targetRef && orb.targetRef.alive) {
      ctx.damageBrick(orb.targetRef, dmg, 'ionBeam_super', 'energy');
      // 砖块击退（向上推）
      if (orb.targetRef.knockbackY !== undefined) {
        orb.targetRef.knockbackY = -20;
      } else {
        orb.targetRef.knockbackY = -20;
      }
    }

    // 超级命中特效
    this.burstFlash = 500;
    ctx.screenShake = Math.min((ctx.screenShake || 0) + 6, 10);
    this._emitHitSparks(tx, ty, 15);

    // 周围溅射伤害
    const splashRadius = 40;
    for (let i = 0; i < ctx.bricks.length; i++) {
      const b = ctx.bricks[i];
      if (!b.alive || b === orb.targetRef) continue;
      const bc = b.getCenter();
      const dist = Math.sqrt((bc.x - tx) ** 2 + (bc.y - ty) ** 2);
      if (dist <= splashRadius) {
        ctx.damageBrick(b, dmg * 0.3, 'ionBeam_splash', 'energy');
        b.knockbackY = -10;
      }
    }
  }

  // 能量球沿途伤害（飞行路径上的砖块）
  _superOrbPathDamage(orb, oldProgress, ctx, damage) {
    if (!orb.hitBricks) orb.hitBricks = new Set();

    const oldX = orb.sx + (orb.tx - orb.sx) * oldProgress;
    const oldY = orb.sy + (orb.ty - orb.sy) * oldProgress;
    const newX = orb.sx + (orb.tx - orb.sx) * orb.progress;
    const newY = orb.sy + (orb.ty - orb.sy) * orb.progress;

    const hitRadius = orb.size * 1.5;

    for (let i = 0; i < ctx.bricks.length; i++) {
      const b = ctx.bricks[i];
      if (!b.alive || orb.hitBricks.has(i) || b === orb.targetRef) continue;

      const bc = b.getCenter();
      // 检测点到线段距离
      const dx = newX - oldX, dy = newY - oldY;
      const len2 = dx * dx + dy * dy;
      let closestX, closestY;
      if (len2 < 1) {
        closestX = newX; closestY = newY;
      } else {
        const t = Math.max(0, Math.min(1, ((bc.x - oldX) * dx + (bc.y - oldY) * dy) / len2));
        closestX = oldX + t * dx;
        closestY = oldY + t * dy;
      }

      const dist = Math.sqrt((bc.x - closestX) ** 2 + (bc.y - closestY) ** 2);
      if (dist <= hitRadius + b.width * 0.5) {
        // 命中！沿途伤害 + 小击退
        orb.hitBricks.add(i);
        ctx.damageBrick(b, damage, 'ionBeam_path', 'energy');
        b.knockbackY = -8;
        this._emitHitSparks(bc.x, bc.y, 3);
      }
    }
  }

  _findTarget(ctx) {
    // === 奇点引擎联动：优先攻击负能量砖块 ===
    const gravityWell = ctx.upgrades && ctx.upgrades.weapons && ctx.upgrades.weapons.gravityWell;
    if (gravityWell && gravityWell.negaBricks && gravityWell.negaBricks.length > 0) {
      const nb = gravityWell.negaBricks[0]; // 取第一个负能量砖块
      return {
        x: nb.x, y: nb.y,
        isBoss: false, isNegaBrick: true, ref: nb,
      };
    }
    
    if (ctx.boss && ctx.boss.alive) {
      return {
        x: ctx.boss.getCenterX(), y: ctx.boss.getCenterY(),
        isBoss: true, ref: ctx.boss,
      };
    }

    let best = null, bestScore = -1;
    for (let i = 0; i < ctx.bricks.length; i++) {
      const b = ctx.bricks[i];
      if (!b.alive) continue;
      if (b.type === 'stealth' && !b.visible) continue;
      const score = b.hp + (b.y / Config.SCREEN_HEIGHT) * 2;
      if (score > bestScore) { bestScore = score; best = b; }
    }

    if (!best) return null;
    const bc = best.getCenter();
    return { x: bc.x, y: bc.y, isBoss: false, ref: best };
  }

  _isAlive(target) {
    if (!target || !target.ref) return false;
    // 负能量砖块：hp < 0 表示存活
    if (target.isNegaBrick) return target.ref.hp < 0;
    return target.ref.alive;
  }

  _refreshTargetPos(target, ctx) {
    if (!target) return;
    if (target.isNegaBrick) {
      // 负能量砖块位置更新
      target.x = target.ref.x;
      target.y = target.ref.y;
    } else if (target.isBoss && ctx.boss && ctx.boss.alive) {
      target.x = ctx.boss.getCenterX();
      target.y = ctx.boss.getCenterY();
    } else if (!target.isBoss && target.ref && target.ref.alive) {
      const bc = target.ref.getCenter();
      target.x = bc.x;
      target.y = bc.y;
    }
  }

  _pierceDamage(sx, sy, tx, ty, damage, primary, ctx) {
    const dx = tx - sx, dy = ty - sy;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1) return;
    const nx = dx / len, ny = dy / len;

    const candidates = [];
    for (let i = 0; i < ctx.bricks.length; i++) {
      const b = ctx.bricks[i];
      if (!b.alive || b === primary.ref) continue;
      const bc = b.getCenter();
      const bx = bc.x - sx, by = bc.y - sy;
      const proj = bx * nx + by * ny;
      if (proj < 10) continue;
      if (proj > len + 150) continue;
      const perpDist = Math.abs(bx * ny - by * nx);
      if (perpDist < 18) {
        candidates.push({ brick: b, proj: proj });
      }
    }

    candidates.sort((a, b) => a.proj - b.proj);

    let count = 0;
    for (let i = 0; i < candidates.length; i++) {
      if (candidates[i].proj < len - 5) continue;
      if (candidates[i].brick === primary.ref) continue;
      ctx.damageBrick(candidates[i].brick, damage, 'ionBeam_pierce', 'energy');
      count++;
      if (count >= this.branches.pierce) break;
    }
  }

  _splitDamage(cx, cy, damage, primary, ctx) {
    const radius = 50;
    let count = 0;
    for (let i = 0; i < ctx.bricks.length; i++) {
      const b = ctx.bricks[i];
      if (!b.alive || b === primary.ref) continue;
      const bc = b.getCenter();
      if (Math.sqrt((bc.x - cx) ** 2 + (bc.y - cy) ** 2) <= radius) {
        ctx.damageBrick(b, damage, 'ionBeam_split', 'energy');
        count++;
        if (count >= 3) break;
      }
    }
    if (ctx.boss && ctx.boss.alive && !primary.isBoss) {
      if (Math.sqrt((ctx.boss.getCenterX() - cx) ** 2 + (ctx.boss.getCenterY() - cy) ** 2) <= radius) {
        ctx.damageBoss(damage, 'ionBeam_split');
      }
    }
  }

  _overloadBurst(cx, cy, damage, ctx) {
    const radius = 70;
    for (let i = 0; i < ctx.bricks.length; i++) {
      const b = ctx.bricks[i];
      if (!b.alive) continue;
      const bc = b.getCenter();
      if (Math.sqrt((bc.x - cx) ** 2 + (bc.y - cy) ** 2) <= radius) {
        ctx.damageBrick(b, damage, 'ionBeam_overload', 'energy');
      }
    }
    if (ctx.boss && ctx.boss.alive) {
      if (Math.sqrt((ctx.boss.getCenterX() - cx) ** 2 + (ctx.boss.getCenterY() - cy) ** 2) <= radius) {
        ctx.damageBoss(damage, 'ionBeam_overload');
      }
    }
    if (ctx.particles) ctx.particles.emitBrickBreak(cx - 10, cy - 10, 20, 20, '#FF4444');
    ctx.screenShake = Math.min((ctx.screenShake || 0) + 3, 7);
    this._emitHitSparks(cx, cy, 12);
    Sound.ionBeamBurst();
  }

  _emitHitSparks(x, y, count) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const speed = 0.8 + Math.random() * 1.5;
      this.hitSparks.push({
        x: x, y: y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        alpha: 0.8 + Math.random() * 0.2,
        size: 1.5 + Math.random() * 2,
      });
    }
  }

  getRenderData() {
    return {
      beam: this.beam,
      isFiring: this.isFiring,
      chargeProgress: this.isFiring ? 1 : Math.min(1, this.chargeTimer / this.def.interval),
      burstFlash: this.burstFlash,
      markStacks: this.markStacks,
      hitSparks: this.hitSparks,
      superOrb: this.superOrb,
      superCharging: this.superCharging,
      superChargeProgress: this.superChargeProgress,
      color: this.def.color,
    };
  }

  getWingData(lcx, lcy) {
    return { type: 'ionBeam', color: this.def.color, x: lcx, y: lcy };
  }
}

module.exports = IonBeamWeapon;
