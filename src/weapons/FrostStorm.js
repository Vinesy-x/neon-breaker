/**
 * FrostStorm.js - 冰墙
 * 生成冰墙阻挡砖块，砖块撞上互相消耗HP完成伤害
 * 智能选位：砖块最密集的列，放在前沿
 * 叠加机制：同位置再次释放=HP叠加
 */
var Weapon = require('./Weapon');
var Config = require('../Config');
var Sound = require('../systems/SoundManager');

var MAX_WALLS_BASE = 2;
var WALL_WIDTH_BASE = 0;   // 0表示自动跟随砖块列宽
var WALL_HEIGHT = 22;
var STACK_LIMIT_BASE = 3;  // 基础叠加倍数上限
var AURA_RANGE = 80;       // 寒气场范围(像素)

class FrostStormWeapon extends Weapon {
  constructor() {
    super('frostStorm');
    this.walls = [];      // 场上的冰墙 [{x,y,hp,maxHp,width,frozenTimer,pulseTimer,birthTime}]
    this.particles = [];  // 冰屑粒子
    this.shatterQueue = []; // 待处理的碎冰爆炸
  }

  /** 冰墙HP = baseAttack × basePct × (1 + damageLv×0.5) */
  getWallHP(baseAttack) {
    return Math.max(1, baseAttack * this.def.basePct * (1 + (this.branches.damage || 0) * 0.5));
  }

  getMaxWalls() {
    return MAX_WALLS_BASE + (this.branches.count || 0);
  }

  getWallWidth() {
    // 跟随砖块列宽：(屏幕宽 - 两侧padding) / 列数
    var cols = Config.BRICK_COLS || 7;
    var pad = Config.BRICK_PADDING || 4;
    return (Config.SCREEN_WIDTH - pad * (cols + 1)) / cols;
  }

  /** 获取砖块列的中心X坐标 */
  _getColCenterX(col) {
    var cols = Config.BRICK_COLS || 7;
    var pad = Config.BRICK_PADDING || 4;
    var brickW = (Config.SCREEN_WIDTH - pad * (cols + 1)) / cols;
    return pad + col * (brickW + pad) + brickW * 0.5;
  }

  getStackLimit() {
    return STACK_LIMIT_BASE + (this.branches.stack || 0);
  }

  update(dtMs, ctx) {
    var dt = dtMs / 16.67;
    this.timer += dtMs;
    var interval = Math.max(2000, this.def.interval - (this.branches.freq || 0) * 1000);

    // CD到 → 放墙
    if (this.timer >= interval) {
      this.timer = 0;
      this._placeWall(ctx);
    }

    var frostArmorLv = this.branches.frostArmor || 0;
    var freezeLv = this.branches.freeze || 0;
    var auraLv = this.branches.aura || 0;
    var permafrostLv = this.branches.permafrost || 0;
    var shatterLv = this.branches.shatter || 0;

    // ===== 更新冰墙：与砖块碰撞 =====
    for (var i = this.walls.length - 1; i >= 0; i--) {
      var wall = this.walls[i];

      // 脉冲动画计时
      wall.pulseTimer = (wall.pulseTimer || 0) + dtMs;

      // 寒气场（每500ms tick一次）
      if (auraLv > 0) {
        wall.auraTimer = (wall.auraTimer || 0) + dtMs;
        if (wall.auraTimer >= 500) {
          wall.auraTimer -= 500;
          this._applyAura(wall, freezeLv, auraLv, ctx);
        }
      }

      // 每帧检测碰撞（砖块碰到冰墙即时扣血）
      var hadCollision = this._checkCollisions(wall, frostArmorLv, freezeLv, permafrostLv, ctx);

      // 墙体回复：未被碰撞时每秒回复maxHP的3%
      if (hadCollision) {
        wall.regenCooldown = 1500; // 被撞后1.5秒内不回血
      } else {
        wall.regenCooldown = Math.max(0, (wall.regenCooldown || 0) - dtMs);
        if (wall.regenCooldown <= 0) {
          wall.regenTimer = (wall.regenTimer || 0) + dtMs;
          if (wall.regenTimer >= 1000) {
            wall.regenTimer -= 1000;
            var regenAmt = wall.maxHp * 0.015;
            wall.hp = Math.min(wall.maxHp, wall.hp + regenAmt);
          }
        }
      }

      // 冰墙碎裂
      if (wall.hp <= 0) {
        if (shatterLv > 0) {
          this._shatter(wall, shatterLv, ctx);
        }
        // 碎裂粒子
        this._emitShatterParticles(wall);
        this.walls.splice(i, 1);
        Sound.blizzardShatter();
      }
    }

    // ===== 更新粒子 =====
    while (this.particles.length > 60) this.particles.shift();
    for (var i = this.particles.length - 1; i >= 0; i--) {
      var p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.alpha -= p.decay * dt;
      if (p.alpha <= 0) this.particles.splice(i, 1);
    }

    // ===== 墙体持续产生微小冰屑 =====
    for (var i = 0; i < this.walls.length; i++) {
      var w = this.walls[i];
      w.ambientTimer = (w.ambientTimer || 0) + dtMs;
      if (w.ambientTimer >= 400 && this.particles.length < 50) {
        w.ambientTimer = 0;
        var px = w.x + (Math.random() - 0.5) * w.width;
        this.particles.push({
          x: px, y: w.y - 2,
          vx: (Math.random() - 0.5) * 0.15,
          vy: -0.3 - Math.random() * 0.5,
          alpha: 0.4 + Math.random() * 0.2,
          size: 1 + Math.random(),
          color: Math.random() > 0.6 ? '#FFFFFF' : '#AAEEFF',
          decay: 0.02 + Math.random() * 0.015,
        });
      }
    }
  }

  /** 智能选位 + 放墙/叠加 */
  _placeWall(ctx) {
    var baseAttack = ctx.getBaseAttack ? ctx.getBaseAttack() : 1;
    var wallHP = this.getWallHP(baseAttack);
    var maxWalls = this.getMaxWalls();
    var wallW = this.getWallWidth();
    var stackLimit = this.getStackLimit();
    var stackLv = this.branches.stack || 0;

    // 找最佳放置位置
    var target = this._findBestPosition(ctx);
    if (!target) return;

    // 检查是否已有冰墙在附近 → 叠加
    for (var i = 0; i < this.walls.length; i++) {
      var w = this.walls[i];
      var dx = Math.abs(w.x - target.x);
      var dy = Math.abs(w.y - target.y);
      if (dx < wallW * 0.8 && dy < 30) {
        // 叠加HP
        var maxHP = wallHP * stackLimit;
        var oldHP = w.hp;
        w.hp = Math.min(w.hp + wallHP, maxHP);
        w.maxHp = Math.max(w.maxHp, w.hp);

        // 叠加特效
        this._emitStackParticles(w);
        Sound.blizzard();

        // 叠甲触发冰冻脉冲
        if (stackLv > 0) {
          this._stackPulse(w, ctx);
        }
        return;
      }
    }

    // 达到墙体上限 → 为所有墙恢复maxHP的20%
    if (this.walls.length >= maxWalls) {
      var HEAL_RATIO = 0.10;
      for (var i = 0; i < this.walls.length; i++) {
        var w = this.walls[i];
        var healAmt = w.maxHp * HEAL_RATIO;
        w.hp = Math.min(w.maxHp, w.hp + healAmt);
      }
      // 回复特效：所有墙闪光
      for (var i = 0; i < this.walls.length; i++) {
        this._emitHealParticles(this.walls[i]);
      }
      Sound.blizzard();

      // 叠甲触发冰冻脉冲（对所有墙）
      if (stackLv > 0) {
        for (var i = 0; i < this.walls.length; i++) {
          this._stackPulse(this.walls[i], ctx);
        }
      }
      return;
    }

    this.walls.push({
      x: target.x,
      y: target.y,
      hp: wallHP,
      maxHp: wallHP,
      width: wallW,
      collisionTimer: 0,
      pulseTimer: 0,
      auraTimer: 0,
      ambientTimer: 0,
      birthTime: Date.now(),
    });

    // 生成特效
    this._emitBirthParticles(target.x, target.y, wallW);
    Sound.blizzard();

    // 检查相邻墙融合
    this._tryMergeWalls();
  }

  /** 相邻冰墙融合：X相邻且Y接近 → 合并成宽墙 */
  _tryMergeWalls() {
    if (this.walls.length < 2) return;
    var colW = this.getWallWidth();
    var MERGE_DY = 25; // Y坐标差在25px内可融合
    var MERGE_DX = colW * 1.3; // X距离在1.3列宽内可融合（相邻列）

    var merged = true;
    while (merged) {
      merged = false;
      for (var i = 0; i < this.walls.length; i++) {
        for (var j = i + 1; j < this.walls.length; j++) {
          var a = this.walls[i], b = this.walls[j];
          var dx = Math.abs(a.x - b.x);
          var dy = Math.abs(a.y - b.y);
          if (dx <= MERGE_DX && dy <= MERGE_DY) {
            // 融合：取两墙的最左和最右边缘
            var leftEdge = Math.min(a.x - a.width * 0.5, b.x - b.width * 0.5);
            var rightEdge = Math.max(a.x + a.width * 0.5, b.x + b.width * 0.5);
            var newWidth = rightEdge - leftEdge;
            var newX = (leftEdge + rightEdge) * 0.5;
            var newY = (a.y + b.y) * 0.5;
            var newHp = a.hp + b.hp;
            var newMaxHp = a.maxHp + b.maxHp;

            // 用融合后的墙替换a，删除b
            a.x = newX;
            a.y = newY;
            a.width = newWidth;
            a.hp = newHp;
            a.maxHp = newMaxHp;
            this.walls.splice(j, 1);

            // 融合特效：连接线粒子
            this._emitMergeParticles(a);

            merged = true;
            break;
          }
        }
        if (merged) break;
      }
    }
  }

  /** 融合特效 */
  _emitMergeParticles(wall) {
    for (var k = 0; k < 10; k++) {
      var px = wall.x + (Math.random() - 0.5) * wall.width;
      if (this.particles.length >= 55) return;
      this.particles.push({
        x: px, y: wall.y,
        vx: (Math.random() - 0.5) * 0.5,
        vy: -0.5 - Math.random() * 0.8,
        alpha: 0.9,
        size: 2.5 + Math.random() * 2,
        color: '#66EEFF',
        decay: 0.02,
      });
    }
  }

  /** 回复特效：墙体向上飘绿色冰晶 */
  _emitHealParticles(wall) {
    for (var k = 0; k < 6; k++) {
      var px = wall.x + (Math.random() - 0.5) * wall.width;
      if (this.particles.length >= 55) return;
      this.particles.push({
        x: px, y: wall.y,
        vx: (Math.random() - 0.5) * 0.3,
        vy: -1.0 - Math.random() * 0.8,
        alpha: 0.9,
        size: 2 + Math.random() * 2,
        color: '#88FFCC',
        decay: 0.025,
      });
    }
  }

  /** 找砖块最密集的列，放在其下方前沿（对齐砖块列） */
  _findBestPosition(ctx) {
    var aliveBricks = ctx.bricks.filter(function(b) { return b.alive; });
    if (aliveBricks.length === 0) return null;

    var cols = Config.BRICK_COLS || 7;
    var pad = Config.BRICK_PADDING || 4;
    var brickW = (Config.SCREEN_WIDTH - pad * (cols + 1)) / cols;
    var colScores = [];
    var colMaxY = [];

    for (var c = 0; c < cols; c++) {
      colScores[c] = 0;
      colMaxY[c] = 0;
    }

    for (var i = 0; i < aliveBricks.length; i++) {
      var bc = aliveBricks[i].getCenter();
      // 根据砖块X坐标算出所在列
      var col = Math.floor((bc.x - pad) / (brickW + pad));
      if (col < 0) col = 0;
      if (col >= cols) col = cols - 1;
      colScores[col]++;
      if (bc.y > colMaxY[col]) colMaxY[col] = bc.y;
    }

    // 排除已有冰墙覆盖的列（降低优先级）
    for (var i = 0; i < this.walls.length; i++) {
      var wCol = Math.round((this.walls[i].x - pad - brickW * 0.5) / (brickW + pad));
      if (wCol >= 0 && wCol < cols) {
        colScores[wCol] *= 0.3;
      }
    }

    // 选得分最高的列
    var bestCol = 0, bestScore = colScores[0];
    for (var c = 1; c < cols; c++) {
      if (colScores[c] > bestScore) {
        bestScore = colScores[c];
        bestCol = c;
      }
    }

    if (bestScore <= 0) return null;

    // 冰墙放在该列中心，最低砖块下方20像素
    var wallY = colMaxY[bestCol] + 20;
    var maxY = Config.SCREEN_HEIGHT - 80;
    if (wallY > maxY) wallY = maxY;
    var minY = Config.BRICK_TOP_OFFSET + 40;
    if (wallY < minY) wallY = colMaxY[bestCol] > 0 ? colMaxY[bestCol] : minY;

    return {
      x: this._getColCenterX(bestCol),
      y: wallY,
      col: bestCol,
    };
  }

  /** 即时碰撞检测：砖块碰到冰墙立刻扣血
   *  每个砖块带碰撞冷却，防止每帧都扣
   *  返回 true 表示本帧有碰撞发生
   */
  _checkCollisions(wall, frostArmorLv, freezeLv, permafrostLv, ctx) {
    var halfW = wall.width * 0.5;
    var HIT_RATIO = 0.40;
    var SPLASH_RANGE = 60;
    var COOLDOWN_MS = 500;
    var hadHit = false;

    // 伤害乘算层：
    // 第1层：基础 = maxHP × HIT_RATIO
    // 第2层：冰缓增伤 = 每层+20%（0~5层 = 1.0x~2.0x）
    // 第3层：寒霜护甲 = 每级+15%
    // 第4层：融合墙宽度加成 = 墙越宽伤害越高（宽度/基础宽度）
    var baseColW = this.getWallWidth();
    var widthMult = Math.max(1.0, wall.width / baseColW); // 融合2列=2.0x
    var armorMult = 1.0 + frostArmorLv * 0.30;

    for (var i = 0; i < ctx.bricks.length; i++) {
      var brick = ctx.bricks[i];
      if (!brick.alive) continue;

      var bc = brick.getCenter();
      var bw = brick.width || 30;
      var bh = brick.height || 15;

      var overlapX = (halfW + bw * 0.5) - Math.abs(bc.x - wall.x);
      var overlapY = (WALL_HEIGHT * 0.5 + bh * 0.5) - Math.abs(bc.y - wall.y);

      if (overlapX > 0 && overlapY > 0) {
        var cdKey = '_wallCD_' + (wall.birthTime || 0);
        var now = Date.now();
        if (brick[cdKey] && now - brick[cdKey] < COOLDOWN_MS) continue;
        brick[cdKey] = now;

        // ① 叠冰缓
        var stacksToAdd = 1 + freezeLv + frostArmorLv;
        brick.iceStacks = Math.min(5, (brick.iceStacks || 0) + stacksToAdd);
        brick.iceDuration = 5000;

        // ② 冰封
        if (permafrostLv > 0 && brick.iceStacks >= 5 && !brick.frozen) {
          brick.frozen = true;
          brick.frozenTimer = 1000 + permafrostLv * 500;
          brick.speedMult = 0;
          this._emitFreezeParticle(bc.x, bc.y);
          continue;
        }

        // ③ 多层乘算伤害
        var iceMult = 1.0 + (brick.iceStacks || 0) * 0.20; // 冰缓层增伤
        var rawDmg = wall.maxHp * HIT_RATIO * iceMult * armorMult * widthMult;
        var dmg = Math.min(brick.hp, rawDmg);

        // ④ 互扣（墙只扣基础值，不受增伤影响）
        wall.hp -= wall.maxHp * HIT_RATIO;
        ctx.damageBrick(brick, dmg, 'frostStorm', 'ice');
        hadHit = true;

        // ⑤ 前方溅射（用增伤后的rawDmg）
        for (var j = 0; j < ctx.bricks.length; j++) {
          if (j === i) continue;
          var other = ctx.bricks[j];
          if (!other.alive) continue;
          var oc = other.getCenter();
          var dx = oc.x - wall.x, dy = oc.y - wall.y;
          if (dy > WALL_HEIGHT) continue;
          if (Math.sqrt(dx * dx + dy * dy) <= SPLASH_RANGE) {
            var otherIceMult = 1.0 + (other.iceStacks || 0) * 0.20;
            ctx.damageBrick(other, wall.maxHp * HIT_RATIO * otherIceMult * armorMult * widthMult, 'frostStorm_splash', 'ice');
          }
        }

        // 碰撞火花
        if (this.particles.length < 55) {
          this.particles.push({
            x: bc.x + (Math.random() - 0.5) * 10,
            y: wall.y + (Math.random() - 0.5) * 6,
            vx: (Math.random() - 0.5) * 1.5,
            vy: -0.8 - Math.random() * 0.8,
            alpha: 0.6 + (brick.iceStacks || 0) * 0.08,
            size: 1.5 + Math.random() * 1.5,
            color: (brick.iceStacks || 0) >= 5 ? '#44FFFF' : (Math.random() > 0.5 ? '#FFFFFF' : '#88DDFF'),
            decay: 0.04 + Math.random() * 0.02,
          });
        }
      }
    }

    // Boss碰撞
    if (ctx.boss && ctx.boss.alive) {
      var bx = ctx.boss.getCenterX(), by = ctx.boss.getCenterY();
      var bossW = ctx.boss.width || 60, bossH = ctx.boss.height || 30;
      var ox = (halfW + bossW * 0.5) - Math.abs(bx - wall.x);
      var oy = (WALL_HEIGHT * 0.5 + bossH * 0.5) - Math.abs(by - wall.y);
      if (ox > 0 && oy > 0) {
        var now = Date.now();
        var bossKey = '_wallCD_' + (wall.birthTime || 0);
        if (!ctx.boss[bossKey] || now - ctx.boss[bossKey] >= COOLDOWN_MS) {
          ctx.boss[bossKey] = now;
          ctx.boss.iceStacks = Math.min(5, (ctx.boss.iceStacks || 0) + 1 + freezeLv);
          ctx.boss.iceDuration = 5000;
          var bossIceMult = 1.0 + (ctx.boss.iceStacks || 0) * 0.20;
          var bossDmg = wall.maxHp * HIT_RATIO * bossIceMult * armorMult * widthMult;
          ctx.damageBoss(bossDmg, 'frostStorm');
          wall.hp -= wall.maxHp * HIT_RATIO;
          hadHit = true;
        }
      }
    }

    return hadHit;
  }

  /** 寒气场：范围内叠冰缓减益 */
  _applyAura(wall, freezeLv, auraLv, ctx) {
    var range = AURA_RANGE * (1 + auraLv * 0.3);

    for (var i = 0; i < ctx.bricks.length; i++) {
      var brick = ctx.bricks[i];
      if (!brick.alive || brick.frozen) continue;
      var bc = brick.getCenter();
      var dx = bc.x - wall.x, dy = bc.y - wall.y;
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= range) {
        // 寒气场叠冰缓（每tick 1层，较碰撞温和）
        brick.iceStacks = Math.min(5, (brick.iceStacks || 0) + 1);
        brick.iceDuration = 5000;
      }
    }
  }

  /** 叠甲脉冲：叠加时给周围砖块叠满冰缓 */
  _stackPulse(wall, ctx) {
    var range = 60;
    for (var i = 0; i < ctx.bricks.length; i++) {
      var brick = ctx.bricks[i];
      if (!brick.alive || brick.frozen) continue;
      var bc = brick.getCenter();
      var dx = bc.x - wall.x, dy = bc.y - wall.y;
      if (Math.sqrt(dx * dx + dy * dy) <= range) {
        // 直接叠满5层冰缓
        brick.iceStacks = 5;
        brick.iceDuration = 5000;
      }
    }
    // 脉冲特效
    for (var k = 0; k < 8; k++) {
      var a = Math.random() * Math.PI * 2;
      if (this.particles.length < 55) {
        this.particles.push({
          x: wall.x, y: wall.y,
          vx: Math.cos(a) * 2, vy: Math.sin(a) * 2,
          alpha: 0.9, size: 2.5,
          color: '#44FFFF',
          decay: 0.03,
        });
      }
    }
  }

  /** 碎冰爆炸：大范围冰属性AOE + 全部叠满冰缓 + 屏震 + 冰刺弹幕 */
  _shatter(wall, shatterLv, ctx) {
    var range = wall.width * 2.5 + shatterLv * 30; // 范围大幅增加
    // 碎冰伤害 = 冰墙最大HP × 20% × shatterLv
    var damage = wall.maxHp * 0.2 * shatterLv;

    // AOE伤害 + 叠满冰缓
    for (var i = 0; i < ctx.bricks.length; i++) {
      var brick = ctx.bricks[i];
      if (!brick.alive) continue;
      var bc = brick.getCenter();
      var dx = bc.x - wall.x, dy = bc.y - wall.y;
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= range) {
        // 范围内叠满5层冰缓
        brick.iceStacks = 5;
        brick.iceDuration = 5000;
        // 距离衰减：中心100%，边缘50%
        var falloff = 1.0 - 0.5 * (dist / range);
        ctx.damageBrick(brick, damage * falloff, 'frostStorm_shatter', 'ice');
      }
    }
    // Boss
    if (ctx.boss && ctx.boss.alive) {
      var dx = ctx.boss.getCenterX() - wall.x, dy = ctx.boss.getCenterY() - wall.y;
      if (Math.sqrt(dx * dx + dy * dy) <= range) {
        ctx.boss.iceStacks = Math.min(5, (ctx.boss.iceStacks || 0) + 3);
        ctx.boss.iceDuration = 5000;
        ctx.damageBoss(damage, 'frostStorm_shatter');
      }
    }

    // 冰刺弹幕：向四周发射冰刺（纯视觉+小额外伤害）
    var spikeCount = 6 + shatterLv * 3;
    for (var s = 0; s < spikeCount; s++) {
      var angle = (Math.PI * 2 / spikeCount) * s + (Math.random() - 0.5) * 0.3;
      var speed = 3 + Math.random() * 2;
      this.particles.push({
        x: wall.x, y: wall.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        alpha: 1.0,
        size: 4 + Math.random() * 3, // 大冰刺
        color: ['#FFFFFF', '#88EEFF', '#44FFFF'][Math.floor(Math.random() * 3)],
        decay: 0.012, // 慢衰减，飞得远
      });
    }

    // 强屏震
    ctx.screenShake = Math.min((ctx.screenShake || 0) + 5 + shatterLv * 2, 12);
  }

  // ===== 粒子特效 =====

  _emitBirthParticles(x, y, w) {
    for (var k = 0; k < 12; k++) {
      var px = x + (Math.random() - 0.5) * w;
      this.particles.push({
        x: px, y: y,
        vx: (Math.random() - 0.5) * 1.5,
        vy: -1 - Math.random() * 1.5,
        alpha: 0.9,
        size: 2 + Math.random() * 2,
        color: ['#FFFFFF', '#CCEFFF', '#88DDFF', '#44CCFF'][Math.floor(Math.random() * 4)],
        decay: 0.025,
      });
    }
  }

  _emitStackParticles(wall) {
    for (var k = 0; k < 8; k++) {
      var a = (Math.PI * 2 / 8) * k;
      this.particles.push({
        x: wall.x, y: wall.y,
        vx: Math.cos(a) * 1.2, vy: Math.sin(a) * 1.2 - 0.5,
        alpha: 0.9, size: 2.5,
        color: '#44FFFF',
        decay: 0.025,
      });
    }
  }

  _emitShatterParticles(wall) {
    // 碎冰：大量冰碎片四散
    for (var k = 0; k < 25; k++) {
      var a = Math.random() * Math.PI * 2;
      var speed = 2 + Math.random() * 3;
      this.particles.push({
        x: wall.x + (Math.random() - 0.5) * wall.width,
        y: wall.y + (Math.random() - 0.5) * WALL_HEIGHT,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed - 1.5,
        alpha: 1.0,
        size: 2.5 + Math.random() * 4,
        color: ['#FFFFFF', '#CCEFFF', '#44CCFF', '#88EEFF'][Math.floor(Math.random() * 4)],
        decay: 0.015, // 慢衰减，碎片飞得远
      });
    }
  }

  _emitFreezeParticle(x, y) {
    for (var k = 0; k < 5; k++) {
      if (this.particles.length >= 55) return;
      this.particles.push({
        x: x + (Math.random() - 0.5) * 10,
        y: y + (Math.random() - 0.5) * 10,
        vx: (Math.random() - 0.5) * 0.5,
        vy: -0.5 - Math.random() * 0.5,
        alpha: 0.8, size: 2 + Math.random(),
        color: '#AAFFFF',
        decay: 0.03,
      });
    }
  }

  getRenderData() {
    return {
      walls: this.walls,
      particles: this.particles,
      color: this.def.color,
      auraLv: this.branches.aura || 0,
      freezeLv: this.branches.freeze || 0,
    };
  }

  getWingData(lcx, lcy) {
    return { type: 'frostStorm', color: this.def.color, x: lcx, y: lcy };
  }
}

module.exports = FrostStormWeapon;
