/**
 * balance-sim.js v2.0 - 无限飞机 balance simulator
 *
 * Full game loop simulation: exp gain, level-up, 3-choice upgrades, weapon unlocking.
 *
 * Usage:
 *   node tools/balance-sim.js <chapter> [options]
 *
 * Options:
 *   --base-attack <n>    Base upgrade attack level (SaveManager, default 0)
 *   --base-firerate <n>  Base upgrade fire rate level (default 0)
 *   --base-crit <n>      Base upgrade crit level (default 0)
 *   --base-startlv <n>   Start level (default 0)
 *   --base-exp <n>       Exp multiplier level (default 0)
 *   --weapons <list>     Comma-separated weapon ids to allow in pool (default: all unlocked)
 *   --strategy <name>    Upgrade strategy: dps | balanced | ship-first | weapon-first (default: balanced)
 *   --duration <sec>     Sim duration in seconds (default: 480)
 *   --runs <n>           Run N simulations and average (default: 1)
 *   --verbose            Print per-phase details
 *   --shop-levels <json> Weapon shop levels, e.g. '{"kunai":3,"ship":2}'
 *
 * Examples:
 *   node tools/balance-sim.js 1
 *   node tools/balance-sim.js 10 --base-attack 5 --weapons kunai,lightning,missile,drone --strategy dps
 *   node tools/balance-sim.js 50 --base-attack 20 --strategy balanced --runs 5
 */
'use strict';

// Mock wx
if (typeof wx === 'undefined') {
  global.wx = {
    getSystemInfoSync: function() { return { windowWidth:375, windowHeight:667, pixelRatio:2, screenHeight:667, safeArea:{bottom:647} }; },
    getMenuButtonBoundingClientRect: function() { return { bottom:80 }; },
    createCanvas: function() { return { width:0, height:0, getContext:function(){return {};} }; },
    createImage: function() { return {}; },
  };
}

var path = require('path');
var projRoot = path.resolve(__dirname, '..');
var WeaponDefs = require(projRoot + '/src/config/WeaponDefs');
var ChapterConfig = require(projRoot + '/src/ChapterConfig');
var Config = require(projRoot + '/src/Config');

// ==================== ARG PARSE ====================
var args = process.argv.slice(2);
function getArg(name, def) {
  var i = args.indexOf('--' + name);
  if (i === -1) return def;
  return args[i + 1];
}
function hasFlag(name) { return args.indexOf('--' + name) !== -1; }

var SIM_CHAPTER = parseInt(args[0]) || 1;
var BASE_ATTACK_LV = parseInt(getArg('base-attack', '0'));
var BASE_FIRERATE_LV = parseInt(getArg('base-firerate', '0'));
var BASE_CRIT_LV = parseInt(getArg('base-crit', '0'));
var BASE_START_LV = parseInt(getArg('base-startlv', '0'));
var BASE_EXP_LV = parseInt(getArg('base-exp', '0'));
var ALLOWED_WEAPONS = getArg('weapons', 'auto');
var STRATEGY = getArg('strategy', 'balanced');
var SIM_DURATION = parseInt(getArg('duration', '480')) * 1000;
var NUM_RUNS = parseInt(getArg('runs', '1'));
var VERBOSE = hasFlag('verbose');
var SHOP_LEVELS = {};
try { SHOP_LEVELS = JSON.parse(getArg('shop-levels', '{}')); } catch(e) {}

var TICK_MS = 100;
var BRICK_COLS = Config.BRICK_COLS || 6;
var MAX_WEAPONS = Config.MAX_WEAPONS || 4;
var EXP_PER_BRICK = Config.EXP_PER_BRICK || 3;
var DANGER_Y = 200 * (Config.BRICK_DANGER_Y || 0.78);
var CRATE_CHANCE = Config.SKILL_CRATE_CHANCE || 0.05;
var CRATE_CD = Config.SKILL_CRATE_COOLDOWN || 15000;  // y=156 in sim units (screen=200)

// ==================== WEAPON UNLOCK ====================
var WEAPON_UNLOCK = { kunai:1, lightning:1, missile:1, meteor:1, drone:10, spinBlade:15, blizzard:25, ionBeam:40, frostStorm:55, gravityWell:70 };

// ==================== SIM BRICK ====================
function Brick(hp, type, col) {
  this.hp = hp; this.maxHp = hp; this.type = type; this.col = col;
  this.y = 0; this.alive = true; this.dots = [];
}

// ==================== SIM WEAPON ====================
function SimWeapon(id, def) {
  this.id = id; this.def = def;
  this.branches = {}; this.timer = 0;
}
SimWeapon.prototype.getBranch = function(k) { return this.branches[k] || 0; };
SimWeapon.prototype.getDmgMult = function() { return 1 + (this.branches.damage || 0) * 0.5; };
SimWeapon.prototype.getInterval = function() {
  var freqLv = this.branches.freq || this.branches.speed || 0;
  return this.def.interval * Math.pow(0.8, freqLv);
};
SimWeapon.prototype.getDamage = function(baseAtk) {
  return Math.max(0.1, baseAtk * (this.def.basePct + (this.branches.damage || 0) * 0.5));
};
SimWeapon.prototype.getTotalLevel = function() {
  var s = 0; for (var k in this.branches) s += this.branches[k]; return s;
};
SimWeapon.prototype.canUpgrade = function(bk) {
  var bd = this.def.branches[bk];
  if (!bd || (this.branches[bk] || 0) >= bd.max) return false;
  if (bd.requires) {
    for (var rk in bd.requires) {
      if ((this.branches[rk] || 0) < bd.requires[rk]) return false;
    }
  }
  return true;
};
SimWeapon.prototype.upgrade = function(bk) {
  if (!this.canUpgrade(bk)) return false;
  this.branches[bk] = (this.branches[bk] || 0) + 1;
  return true;
};

// ==================== EXP SYSTEM ====================
function ExpSys(startLv, expMult) {
  this.level = 1 + (startLv || 0);
  this.exp = 0;
  this.expMult = 1 + (expMult || 0) * 0.03;
  this.expToNext = this._calc(this.level);
  this.pendingLevelUps = 0;
}
ExpSys.prototype._calc = function(lv) { return 80 + (lv-1)*50 + (lv-1)*(lv-1)*5; };
ExpSys.prototype.addExp = function(amt) {
  this.exp += Math.floor(amt * this.expMult);
  while (this.exp >= this.expToNext) {
    this.exp -= this.expToNext;
    this.level++;
    this.expToNext = this._calc(this.level);
    this.pendingLevelUps++;
  }
};
ExpSys.prototype.consume = function() {
  if (this.pendingLevelUps > 0) { this.pendingLevelUps--; return true; }
  return false;
};

// ==================== UPGRADE STRATEGY ====================

// Strategies decide how to pick from the 3-choice pool
var Strategies = {
  // Pure DPS: always pick damage/count upgrades, prefer weapon branches
  dps: function(choices, sim) {
    var best = null, bestScore = -1;
    for (var i = 0; i < choices.length; i++) {
      var c = choices[i], score = 0;
      if (c.type === 'newWeapon') {
        score = 50 + (sim.weapons.length < 2 ? 100 : 0); // prioritize getting weapons early
      } else if (c.type === 'weaponBranch') {
        if (c.branchKey === 'damage') score = 80;
        else if (c.branchKey === 'count' || c.branchKey === 'bombs') score = 70;
        else if (c.branchKey === 'freq' || c.branchKey === 'speed') score = 60;
        else score = 30;
      } else if (c.type === 'shipBranch') {
        if (c.key === 'attack') score = 90;
        else if (c.key === 'fireRate') score = 75;
        else score = 20;
      }
      if (score > bestScore) { bestScore = score; best = c; }
    }
    return best;
  },

  // Balanced: mix of ship and weapon upgrades
  balanced: function(choices, sim) {
    var best = null, bestScore = -1;
    var weaponCount = sim.weapons.length;
    for (var i = 0; i < choices.length; i++) {
      var c = choices[i], score = 0;
      if (c.type === 'newWeapon') {
        score = weaponCount < 3 ? 90 : 40; // get 3 weapons, 4th is lower priority
      } else if (c.type === 'weaponBranch') {
        if (c.branchKey === 'damage') score = 60;
        else if (c.branchKey === 'count' || c.branchKey === 'bombs') score = 55;
        else score = 40 + Math.random() * 10;
      } else if (c.type === 'shipBranch') {
        if (c.key === 'attack') score = 70;
        else if (c.key === 'fireRate') score = 65;
        else if (c.key === 'spread') score = 50;
        else score = 35 + Math.random() * 10;
      }
      if (score > bestScore) { bestScore = score; best = c; }
    }
    return best;
  },

  // Ship-first: prioritize ship upgrades
  'ship-first': function(choices, sim) {
    var best = null, bestScore = -1;
    var weaponCount = sim.weapons.length;
    for (var i = 0; i < choices.length; i++) {
      var c = choices[i], score = 0;
      if (c.type === 'newWeapon') score = weaponCount < 2 ? 80 : 30;
      else if (c.type === 'shipBranch') {
        if (c.key === 'attack') score = 100;
        else if (c.key === 'fireRate') score = 90;
        else score = 70;
      } else score = 40;
      if (score > bestScore) { bestScore = score; best = c; }
    }
    return best;
  },

  // Weapon-first: prioritize weapon branch upgrades
  'weapon-first': function(choices, sim) {
    var best = null, bestScore = -1;
    var weaponCount = sim.weapons.length;
    for (var i = 0; i < choices.length; i++) {
      var c = choices[i], score = 0;
      if (c.type === 'newWeapon') score = weaponCount < MAX_WEAPONS ? 100 : 20;
      else if (c.type === 'weaponBranch') {
        if (c.branchKey === 'damage') score = 90;
        else score = 70 + Math.random() * 10;
      } else score = 30;
      if (score > bestScore) { bestScore = score; best = c; }
    }
    return best;
  },
};

// ==================== MAIN SIMULATOR ====================
function Sim() {
  this.cc = ChapterConfig.get(SIM_CHAPTER);
  // Base upgrades
  this.baseAttack = 1 + BASE_ATTACK_LV;
  this.critRate = BASE_CRIT_LV * 0.01;
  this.fireRateBonus = BASE_FIRERATE_LV * 0.02;

  this.weapons = [];  // SimWeapon[]
  this.shipTree = {};
  for (var sk in Config.SHIP_TREE) this.shipTree[sk] = 0;

  this.bricks = [];
  this.stats = {};
  this.stats.bullet = { d:0, h:0, k:0 };
  this.elapsed = 0;
  this.spawned = 0; this.killed = 0;
  this.spawnTimer = 0;
  this.phase = null;
  this._ps = 0; this._pd = {};
  this.levelUpLog = [];
  this.dead = false;
  this.deathTime = 0;
  this.lastCrateTime = -CRATE_CD;  // can drop immediately
  this.crateChoices = 0;

  // Allowed weapon pool
  if (ALLOWED_WEAPONS === 'auto') {
    this.allowedWeapons = null; // all unlocked
  } else {
    this.allowedWeapons = ALLOWED_WEAPONS.split(',').map(function(s){return s.trim();});
    // Pre-equip specified weapons (skip 3-choice RNG for weapon acquisition)
    var self = this;
    this.allowedWeapons.forEach(function(wk) {
      if (WeaponDefs[wk] && self.weapons.length < MAX_WEAPONS) {
        self.weapons.push(new SimWeapon(wk, WeaponDefs[wk]));
        if (!self.stats[wk]) self.stats[wk] = {d:0,h:0,k:0};
      }
    });
  }

  // Exp system
  this.expSys = new ExpSys(BASE_START_LV, BASE_EXP_LV);

  // Bullet timer
  this.bulletTimer = 0;
  this.bulletInterval = 200; // ms base
}

Sim.prototype.getBaseAttack = function() {
  var shipMult = 1 + (this.shipTree.attack || 0) * 0.5;
  return Math.max(1, this.baseAttack * shipMult);
};

Sim.prototype.getBulletInterval = function() {
  var shipMult = 1 + (this.shipTree.fireRate || 0) * 0.5;
  var base = this.bulletInterval / (1 + this.fireRateBonus);
  return base / shipMult;
};

Sim.prototype.getBulletDamage = function() {
  var atk = this.getBaseAttack();
  var spread = 1 + (this.shipTree.spread || 0);
  var pierce = this.shipTree.pierce || 0;
  // crit
  var crit = Math.random() < this.critRate ? 2.0 : 1.0;
  return atk * crit * spread; // simplified: spread means more bullets per shot
};

Sim.prototype.run = function() {
  var plog = [], lastP = '';

  for (this.elapsed = 0; this.elapsed < SIM_DURATION; this.elapsed += TICK_MS) {
    this.phase = ChapterConfig.getPhaseAt(SIM_CHAPTER, this.elapsed);
    if (this.phase.phase !== lastP) {
      if (lastP) plog.push(this._phaseStats(lastP));
      lastP = this.phase.phase;
      this._ps = this.elapsed; this._pd = {};
    }
    this._spawn();
    this._bullet();
    this._weaponUpdate();
    this._dot();
    this.bricks = this.bricks.filter(function(b){return b.alive;});
    this._scroll();

    // Death check: any brick past danger line?
    for (var di = 0; di < this.bricks.length; di++) {
      if (this.bricks[di].alive && this.bricks[di].y >= DANGER_Y) {
        this.dead = true;
        this.deathTime = this.elapsed;
        break;
      }
    }
    if (this.dead) break;

    // Process pending level-ups
    while (this.expSys.pendingLevelUps > 0) {
      this.expSys.consume();
      this._doLevelUp();
    }
    // Process crate drops
    if (this._pendingCrate) {
      this._pendingCrate = false;
      this._doLevelUp();
    }
  }
  if (lastP) plog.push(this._phaseStats(lastP));
  return { plog: plog, stats: this.stats, killed: this.killed, spawned: this.spawned,
           finalLevel: this.expSys.level, weapons: this.weapons, shipTree: this.shipTree,
           levelUpLog: this.levelUpLog, dead: this.dead, survivalSec: (this.dead ? this.deathTime : this.elapsed) / 1000 };
};

Sim.prototype._doLevelUp = function() {
  var choices = this._generateChoices();
  if (choices.length === 0) return;
  var stratFn = Strategies[STRATEGY] || Strategies.balanced;
  var pick = stratFn(choices, this);
  if (!pick) pick = choices[0];
  this._applyChoice(pick);
  this.levelUpLog.push({
    level: this.expSys.level,
    time: (this.elapsed / 1000).toFixed(0) + 's',
    choice: pick.type === 'newWeapon' ? '+' + pick.key :
            pick.type === 'weaponBranch' ? pick.weaponKey + '.' + pick.branchKey + ' Lv' + ((this.weapons.filter(function(w){return w.id===pick.weaponKey;})[0] || {}).getBranch ? '' : '') :
            'ship.' + pick.key,
    desc: pick.name || pick.key,
  });
};

Sim.prototype._generateChoices = function() {
  var pool = [];
  var wCount = this.weapons.length;
  var self = this;

  // New weapons
  if (wCount < MAX_WEAPONS) {
    var allW = Object.keys(WeaponDefs);
    allW.forEach(function(wk) {
      // Already have?
      for (var i = 0; i < self.weapons.length; i++) if (self.weapons[i].id === wk) return;
      // Unlocked?
      if ((WEAPON_UNLOCK[wk] || 1) > SIM_CHAPTER) return;
      // Allowed?
      if (self.allowedWeapons && self.allowedWeapons.indexOf(wk) === -1) return;
      pool.push({ type: 'newWeapon', key: wk, name: WeaponDefs[wk].name, priority: 3 });
    });
  }

  // Weapon branch upgrades
  this.weapons.forEach(function(w) {
    var wDef = WeaponDefs[w.id];
    for (var bk in wDef.branches) {
      if (!w.canUpgrade(bk)) continue;
      var curLv = w.getBranch(bk);
      pool.push({
        type: 'weaponBranch', weaponKey: w.id, branchKey: bk,
        name: wDef.name + '.' + bk, priority: curLv === 0 ? 2 : 1,
      });
    }
  });

  // Ship upgrades
  for (var sk in Config.SHIP_TREE) {
    var def = Config.SHIP_TREE[sk];
    if (!def || (this.shipTree[sk] || 0) >= def.max) continue;
    if (def.requires) {
      var ok = true;
      for (var rk in def.requires) if ((this.shipTree[rk]||0) < def.requires[rk]) { ok = false; break; }
      if (!ok) continue;
    }
    pool.push({ type: 'shipBranch', key: sk, name: 'ship.' + sk, priority: (this.shipTree[sk]||0) === 0 ? 2 : 1 });
  }

  // Sort and pick 3
  pool.sort(function(a,b) { return b.priority !== a.priority ? b.priority - a.priority : Math.random() - 0.5; });
  return pool.slice(0, 3);
};

Sim.prototype._applyChoice = function(c) {
  if (c.type === 'newWeapon') {
    var w = new SimWeapon(c.key, WeaponDefs[c.key]);
    this.weapons.push(w);
    if (!this.stats[c.key]) this.stats[c.key] = { d:0, h:0, k:0 };
  } else if (c.type === 'weaponBranch') {
    for (var i = 0; i < this.weapons.length; i++) {
      if (this.weapons[i].id === c.weaponKey) { this.weapons[i].upgrade(c.branchKey); break; }
    }
  } else if (c.type === 'shipBranch') {
    this.shipTree[c.key] = (this.shipTree[c.key] || 0) + 1;
  }
};

// ==================== SPAWN ====================
Sim.prototype._spawn = function() {
  if (!this.phase || this.phase.spawnMult <= 0) return;
  this.spawnTimer += TICK_MS;
  var iv = this.cc.spawnInterval / this.phase.spawnMult;
  if (this.spawnTimer < iv) return;
  this.spawnTimer -= iv;
  var ts = this.phase.types; if (!ts || !ts.length) return;
  var tA = this.phase.timeCurve[0], tB = this.phase.timeCurve[1];
  var TM = {normal:1,fast:.7,formation:1,shield:1.2,split:.8,stealth:.6,healer:.5};
  for (var c = 0; c < BRICK_COLS; c++) {
    if (Math.random() < this.cc.gapChance) continue;
    var t = ts[Math.floor(Math.random()*ts.length)];
    var hp = Math.max(1, Math.floor(this.cc.baseHP * this.cc.chapterScale * (tA+Math.random()*(tB-tA)) * (TM[t]||1)));
    this.bricks.push(new Brick(hp, t, c));
    this.spawned++;
  }
};

// ==================== BULLET ====================
Sim.prototype._bullet = function() {
  this.bulletTimer += TICK_MS;
  if (this.bulletTimer < this.getBulletInterval()) return;
  this.bulletTimer -= this.getBulletInterval();

  if (!this.bricks.length) return;
  var spread = 1 + (this.shipTree.spread || 0);
  var pierceLv = this.shipTree.pierce || 0;
  var atk = this.getBaseAttack();
  var crit = Math.random() < this.critRate ? 2.0 : 1.0;

  // Each spread fires a bullet that can pierce
  for (var s = 0; s < spread; s++) {
    // Pick a target column
    var col = Math.floor(Math.random() * BRICK_COLS);
    var colBricks = this.bricks.filter(function(b) { return b.alive && b.col === col; });
    colBricks.sort(function(a,b) { return b.y - a.y; }); // front first
    var hits = Math.min(1 + pierceLv, colBricks.length);
    for (var i = 0; i < hits; i++) {
      this._dmg(colBricks[i], atk * crit, 'bullet');
    }
  }
};

// ==================== WEAPONS ====================
Sim.prototype._weaponUpdate = function() {
  var self = this;
  this.weapons.forEach(function(w) {
    w.timer += TICK_MS;
    if (w.timer < w.getInterval()) return;
    w.timer -= w.getInterval();
    var fn = '_w_' + w.id;
    if (self[fn]) self[fn](w);
  });
};

Sim.prototype._randB = function(n) {
  var a = this.bricks.filter(function(b){return b.alive;});
  if (a.length <= n) return a.slice();
  var r = [], u = {};
  while (r.length < n) { var i = Math.floor(Math.random()*a.length); if (!u[i]) {u[i]=1;r.push(a[i]);} }
  return r;
};

Sim.prototype._dmg = function(b, amt, src) {
  if (!b.alive || amt <= 0) return;
  var actual = Math.min(b.hp, amt);
  b.hp -= actual;
  if (!this.stats[src]) this.stats[src] = {d:0,h:0,k:0};
  this.stats[src].d += actual; this.stats[src].h++;
  if (!this._pd[src]) this._pd[src] = 0; this._pd[src] += actual;
  if (b.hp <= 0) {
    b.alive = false; this.stats[src].k++; this.killed++;
    // Grant exp
    var expVal = EXP_PER_BRICK;
    if (b.type === 'shield' || b.type === 'stealth') expVal += 1;
    if (b.type === 'healer') expVal += 2;
    this.expSys.addExp(expVal);
      // Skill crate drop
      var crateCD = (this.elapsed - this.lastCrateTime) >= CRATE_CD;
      if (crateCD && Math.random() < CRATE_CHANCE) {
        this.lastCrateTime = this.elapsed;
        this.crateChoices++;
        this._pendingCrate = true;
      }
  }
};

Sim.prototype._dot = function() {
  var self = this;
  this.bricks.forEach(function(b) {
    if (!b.alive || !b.dots.length) return;
    b.dots = b.dots.filter(function(d) {
      self._dmg(b, d.dps*(TICK_MS/1000), d.source);
      d.remaining -= TICK_MS; return d.remaining > 0 && b.alive;
    });
  });
};

Sim.prototype._scroll = function() {
  var sp = this.cc.scrollSpeed * (TICK_MS / 16);
  this.bricks.forEach(function(b) { b.y += sp; });
  this.bricks = this.bricks.filter(function(b) { return b.y < 200; });
};

// ==================== WEAPON IMPLS ====================
Sim.prototype._w_kunai = function(w) {
  var d = w.getDamage(this.getBaseAttack());
  var cnt = 1+(w.branches.count||0), aoe = 2+(w.branches.aoe||0);
  for(var n=0;n<cnt;n++){var t=this._randB(aoe);for(var i=0;i<t.length;i++)this._dmg(t[i],d,w.id);}
};
Sim.prototype._w_lightning = function(w) {
  var d = w.getDamage(this.getBaseAttack());
  var ch=2+(w.branches.chains||0),st=1+(w.branches.storm||0),cl=w.branches.charge||0;
  for(var s=0;s<st;s++){var t=this._randB(ch);for(var i=0;i<t.length;i++)this._dmg(t[i],d*(1+(cl>0?i*.25*cl:0)),w.id);}
};
Sim.prototype._w_missile = function(w) {
  var d = w.getDamage(this.getBaseAttack());
  var pi=(w.def.basePierce||5)+(w.branches.deepPierce||0)*3;
  var dc=Math.max(0,(w.def.decayRate||.15)-(w.branches.pierce||0)*.15);
  var sa=1+(w.branches.salvo||0),tw=1+(w.branches.twinCannon||0);
  for(var t=0;t<tw;t++)for(var s=0;s<sa;s++){
    var col=Math.floor(Math.random()*BRICK_COLS);
    var cb=this.bricks.filter(function(b){return b.alive&&b.col===col;});
    for(var i=0;i<Math.min(pi,cb.length);i++)this._dmg(cb[i],d*Math.pow(1-dc,i),w.id);
  }
};
Sim.prototype._w_meteor = function(w) {
  var d = w.getDamage(this.getBaseAttack());
  var bm=(w.def.baseBombs||4)+(w.branches.bombs||0)*2,ec=1+(w.branches.escort||0),rh=2+(w.branches.radius||0);
  for(var e=0;e<ec;e++)for(var b=0;b<bm;b++){var t=this._randB(rh);for(var i=0;i<t.length;i++)this._dmg(t[i],d,w.id);}
};
Sim.prototype._w_drone = function(w) {
  var d = w.getDamage(this.getBaseAttack());
  var cnt=2+(w.branches.count||0);
  for(var i=0;i<cnt;i++){var t=this._randB(1);if(t.length)this._dmg(t[0],d,w.id);}
};
Sim.prototype._w_spinBlade = function(w) {
  var d = w.getDamage(this.getBaseAttack());
  var dur=4000+(w.branches.duration||0)*2000,tk=Math.floor(dur/(w.def.tickInterval||200));
  var rl=w.branches.ramp||0;
  for(var t=0;t<tk;t++){var m=1+(rl>0?(t*200/1000)*.12*rl:0);var b=this._randB(1);if(b.length)this._dmg(b[0],d*m,w.id);}
};
Sim.prototype._w_blizzard = function(w) {
  var d = w.getDamage(this.getBaseAttack());
  var cnt=1+(w.branches.count||0),dur=3000+(w.branches.duration||0)*1500,rh=3+(w.branches.radius||0);
  for(var c=0;c<cnt;c++){var t=this._randB(rh);for(var i=0;i<t.length;i++){
    this._dmg(t[i],d,w.id);t[i].dots.push({source:w.id+'_dot',dps:d*.5,remaining:dur});
  }}
};
Sim.prototype._w_ionBeam = function(w) {
  var d = w.getDamage(this.getBaseAttack());
  var dur=2000+(w.branches.duration||0)*1000,ml=w.branches.mark||0,tk=Math.floor(dur/200);
  var t=this._randB(1);if(!t.length)return;var tg=t[0];
  for(var i=0;i<tk&&tg.alive;i++)this._dmg(tg,d*(1+(ml>0?i*.08*ml:0)),w.id);
};
Sim.prototype._w_frostStorm = function(w) {
  var hp=this.getBaseAttack()*w.def.basePct*w.getDmgMult(),cnt=1+(w.branches.count||0);
  for(var c=0;c<cnt;c++){var r=hp;while(r>0){var t=this._randB(1);if(!t.length)break;
    var dealt=Math.min(r,t[0].hp);this._dmg(t[0],dealt,w.id);r-=dealt;}}
};
Sim.prototype._w_gravityWell = function(w) {
  var hl=w.branches.horizon||0,dur=3000+(w.branches.singularity||0)*1500;
  var tk=Math.floor(dur/500),cnt=1+(w.branches.count||0),pt=4+(w.branches.damage||0)*2;
  for(var c=0;c<cnt;c++)for(var t=0;t<tk;t++){var bs=this._randB(pt);
    for(var i=0;i<bs.length;i++){var d=this.getBaseAttack()*(w.def.basePct/100)*w.getDmgMult();
      if(hl>0)d+=Math.min(bs[i].maxHp*.02*hl,this.getBaseAttack()*8);
      this._dmg(bs[i],d,w.id);}}
};

Sim.prototype._phaseStats = function(name) {
  var dur=(this.elapsed-this._ps)/1000,pd=this._pd,tot=0;
  for(var k in pd) tot+=pd[k];
  return {phase:name,duration:dur,damage:pd,total:tot,dps:tot/Math.max(1,dur)};
};

// ==================== PRINT ====================
function printResults(results, single) {
  var r = results;
  var T = SIM_DURATION / 1000;
  var totalD = 0;
  var src = Object.keys(r.stats);
  src.forEach(function(s) { totalD += r.stats[s].d; });

  console.log('\n' + '='.repeat(55));
  console.log('  无限飞机 balance-sim v2.0');
  console.log('='.repeat(55));
  console.log('  Chapter: ' + SIM_CHAPTER + '  BaseAtk: ' + BASE_ATTACK_LV +
    '  Strategy: ' + STRATEGY);
  var survived = r.survivalSec || T;
  var status = r.dead ? 'DEAD at ' + survived.toFixed(1) + 's' : 'SURVIVED ' + T + 's (reached boss)';
  console.log('  Result: ' + status + '  Final Level: ' + r.finalLevel);
  console.log('  Weapons: ' + r.weapons.map(function(w){return w.id;}).join(', '));
  console.log('  Ship: ' + Object.keys(r.shipTree).filter(function(k){return r.shipTree[k]>0;})
    .map(function(k){return k+'='+r.shipTree[k];}).join(', '));
  console.log('-'.repeat(55));

  // DPS table
  console.log('\n  DPS Report:');
  src.sort(function(a,b){return r.stats[b].d-r.stats[a].d;});
  src.forEach(function(s) {
    var st = r.stats[s]; if (st.d < 0.01) return;
    var pct = totalD > 0 ? (st.d/totalD*100) : 0, dps = st.d/survived;
    var bar = ''; for(var i=0;i<Math.round(pct/2);i++) bar+='#';
    var name = s;
    if (WeaponDefs[s]) name = WeaponDefs[s].name;
    if (s === 'bullet') name = 'MainGun';
    if (s.endsWith('_dot')) name = s.replace('_dot','')+'(DOT)';
    name = (name+'                ').slice(0,16);
    console.log('  '+name+('        '+dps.toFixed(2)).slice(-8)+'/s  '+('     '+pct.toFixed(1)).slice(-5)+'%  '+bar);
  });
  console.log('  '+'-'.repeat(45));
  console.log('  TOTAL           '+(totalD/survived).toFixed(2)+'/s   100%');
  console.log('  Total Damage: '+totalD.toFixed(0)+'  Survived: '+survived.toFixed(1)+'s');
  console.log('  Killed: '+r.killed+'/'+r.spawned+'  Leaked: '+(r.spawned-r.killed));
  console.log('  Crate drops: '+(r.crateChoices||0));

  // Level-up log (compact)
  if (r.levelUpLog.length > 0) {
    console.log('\n  Upgrade Path (' + r.levelUpLog.length + ' level-ups):');
    var chunks = [];
    for (var i = 0; i < r.levelUpLog.length; i++) {
      var lu = r.levelUpLog[i];
      chunks.push('  Lv' + lu.level + '(' + lu.time + '): ' + lu.desc);
    }
    console.log(chunks.join('\n'));
  }

  // Phase breakdown
  if (VERBOSE && r.plog) {
    console.log('\n  Phase Breakdown:');
    r.plog.forEach(function(p) {
      if (p.duration < 1) return;
      console.log('\n  ['+p.phase+'] '+p.duration.toFixed(0)+'s  DPS='+p.dps.toFixed(2)+'/s');
      var ks = Object.keys(p.damage).sort(function(a,b){return p.damage[b]-p.damage[a];});
      ks.forEach(function(k) {
        var pct = p.total > 0 ? (p.damage[k]/p.total*100) : 0;
        if (pct < 2) return;
        var n = k; if(WeaponDefs[k]) n=WeaponDefs[k].name; if(k==='bullet') n='MainGun'; if(k.endsWith('_dot')) n=k.replace('_dot','')+'(DOT)';
        console.log('    '+n+': '+pct.toFixed(1)+'%');
      });
    });
  }

  // Alerts
  console.log('\n  Balance Alerts:');
  var alerts = 0;
  src.forEach(function(s) {
    var pct = totalD > 0 ? (r.stats[s].d/totalD*100) : 0;
    if (pct > 35) { console.log('  [!] '+s+' '+pct.toFixed(1)+'% -> TOO HIGH'); alerts++; }
    if (pct < 3 && pct > 0.1) { console.log('  [!] '+s+' '+pct.toFixed(1)+'% -> TOO LOW'); alerts++; }
  });
  if (!alerts) console.log('  All weapons within acceptable range.');
  console.log('');
}

// ==================== MULTI-RUN ====================
if (NUM_RUNS === 1) {
  var sim = new Sim();
  var result = sim.run();
  printResults(result, true);
} else {
  console.log('\nRunning ' + NUM_RUNS + ' simulations...\n');
  var avgStats = {};
  var totalKilled = 0, totalSpawned = 0, totalLevel = 0;

  for (var r = 0; r < NUM_RUNS; r++) {
    var sim = new Sim();
    var res = sim.run();
    totalKilled += res.killed;
    totalSpawned += res.spawned;
    totalLevel += res.finalLevel;
    for (var s in res.stats) {
      if (!avgStats[s]) avgStats[s] = {d:0,h:0,k:0};
      avgStats[s].d += res.stats[s].d;
      avgStats[s].h += res.stats[s].h;
      avgStats[s].k += res.stats[s].k;
    }
  }

  // Average
  for (var s in avgStats) {
    avgStats[s].d /= NUM_RUNS;
    avgStats[s].h /= NUM_RUNS;
    avgStats[s].k /= NUM_RUNS;
  }

  var T = SIM_DURATION / 1000;
  var totalD = 0;
  var src = Object.keys(avgStats);
  src.forEach(function(s) { totalD += avgStats[s].d; });

  console.log('='.repeat(55));
  console.log('  AVERAGED over ' + NUM_RUNS + ' runs');
  console.log('  Ch' + SIM_CHAPTER + '  BaseAtk:' + BASE_ATTACK_LV + '  Strategy:' + STRATEGY);
  console.log('  Avg Level: ' + (totalLevel/NUM_RUNS).toFixed(1));
  console.log('  Avg Kill%: ' + (totalSpawned>0?(totalKilled/totalSpawned*100).toFixed(1):'0') + '%');
  console.log('-'.repeat(55));

  src.sort(function(a,b){return avgStats[b].d-avgStats[a].d;});
  src.forEach(function(s) {
    var st = avgStats[s]; if (st.d < 0.01) return;
    var pct = totalD > 0 ? (st.d/totalD*100) : 0, dps = st.d/T;
    var bar = ''; for(var i=0;i<Math.round(pct/2);i++) bar+='#';
    var name = s;
    if (WeaponDefs[s]) name = WeaponDefs[s].name;
    if (s === 'bullet') name = 'MainGun';
    if (s.endsWith('_dot')) name = s.replace('_dot','')+'(DOT)';
    name = (name+'                ').slice(0,16);
    console.log('  '+name+('        '+dps.toFixed(2)).slice(-8)+'/s  '+('     '+pct.toFixed(1)).slice(-5)+'%  '+bar);
  });
  console.log('');
}
