/**
 * DPSSandbox.js - 武器DPS精确测试沙盘 v5
 * 
 * 核心：存活砖块比例控制
 *   - 每行生成 N 个砖块，统计屏幕上存活砖块数
 *   - 存活数 vs 目标数的比例决定HP调节方向
 *   - 存活少 → 打得快 → 提HP
 *   - 存活多 → 打不动 → 降HP
 *   - 水位稳定后开始正式计时测DPS
 * 
 * 用法:
 *   __dpsSandbox({ weapon: 'kunai' })
 *   __dpsSandbox({ weapon: 'lightning', duration: 60 })
 *   __dpsSandbox({ weapon: 'all', targetAlive: 80 })
 *   __stopSandbox()
 *   __sandboxReport()
 */

var BrickFactory = require('../BrickFactory');
var ConfigRef = require('../Config');

class DPSSandbox {
  constructor(game, Config) {
    this.game = game;
    this.Config = Config || ConfigRef;
    this.running = false;
    this.stats = null;
    this._lastReport = '';
    this._cleanups = [];
  }

  start(opts) {
    if (this.running) this.stop();
    opts = opts || {};
    
    var weaponFilter = opts.weapon || 'all';
    var duration = opts.duration || 60;
    var speed = opts.speed || 5;
    var warmup = opts.warmup || 20;
    var targetAlive = opts.targetAlive || 60;  // 目标存活砖块数

    var g = this.game;
    var Config = this.Config;

    // 1. 启动游戏
    g._initGame(30);
    g._devInvincible = true;
    g._devTimeScale = speed;
    
    // 2. 武器锁定
    if (weaponFilter !== 'all') {
      if (weaponFilter !== 'ship' && !g.upgrades.weapons[weaponFilter]) {
        g.upgrades.addWeapon(weaponFilter);
      }
      var toRemove = [];
      for (var key in g.upgrades.weapons) {
        if (key !== weaponFilter) toRemove.push(key);
      }
      for (var i = 0; i < toRemove.length; i++) {
        delete g.upgrades.weapons[toRemove[i]];
      }
    }
    
    // 3. 阻止新武器
    var origAddWeapon = g.upgrades.addWeapon.bind(g.upgrades);
    g.upgrades.addWeapon = function(key) {
      if (weaponFilter !== 'all') return;
      origAddWeapon(key);
    };

    this._cleanups.push(function() { g.upgrades.addWeapon = origAddWeapon; });

    // 4. 接管砖块生成
    var origUpdateSpawn = g._updateBrickSpawn.bind(g);
    g._updateBrickSpawn = function() {};
    this._cleanups.push(function() { g._updateBrickSpawn = origUpdateSpawn; });
    
    // 5. 控制器
    this._ctrl = {
      targetAlive: targetAlive,
      currentHP: 1,
      spawnCd: 0,
      baseInterval: 1000,  // ms
      // 平滑统计
      stableCount: 0,      // 连续"水位在±20%范围内"的次数
      stableThreshold: 5,   // 达到5次算稳定
    };
    
    // 6. 统计
    g.damageStats = {};
    this.stats = {
      weapon: weaponFilter,
      duration: duration,
      speed: speed,
      warmup: warmup,
      targetAlive: targetAlive,
      // 预热
      warmupElapsed: 0,
      isWarmedUp: false,
      autoWarmup: !opts.warmup, // 没指定warmup时用自动检测
      // 正式测量
      measureElapsed: 0,
      totalDamage: 0,
      damageBySource: {},
      killCount: 0,
      buffEvents: { burn: 0, chill: 0, freeze: 0, shock: 0, arc: 0 },
      dpsSnapshots: [],
      _lastSnapshotMs: 0,
      _lastDamage: 0,
      stopReason: '',
      _totalElapsed: 0,
    };
    this.running = true;

    // 7. Hooks
    this._hookDamage();
    this._hookBuffs();

    // 8. 主循环回调
    var self = this;
    g._sandboxUpdate = function(dtMs) { self._onUpdate(dtMs); };
    this._cleanups.push(function() { g._sandboxUpdate = null; });

    // 9. AutoBattle
    if (typeof window.__autoBattle === 'function') {
      window.__autoBattle('aggressive');
    }

    // 10. 直接点满所有非shopGated分支
    // 确保初始武器已添加
    var WU = require('../config/WeaponUnlockConfig');
    if (weaponFilter === 'all') {
      for (var uk in WU) {
        if (uk === 'ship') continue;
        if (WU[uk].unlockChapter <= 1 && !g.upgrades.weapons[uk]) {
          g.upgrades.addWeapon(uk);
        }
      }
    }
    // 飞机树
    var Config = this.Config;
    var ST = Config.SHIP_TREE;
    for (var sk in ST) {
      var sb = ST[sk];
      if (sb.shopGated || sb.exclusiveGroup) continue;
      if (sb.requires) {
        var skip = false;
        for (var rk in sb.requires) { if (ST[rk] && (ST[rk].shopGated || ST[rk].exclusiveGroup)) skip = true; }
        if (skip) continue;
      }
      g.upgrades.shipTree[sk] = sb.max || 5;
    }
    g._syncLauncherStats && g._syncLauncherStats();
    // 武器分支
    for (var wk in g.upgrades.weapons) {
      var w = g.upgrades.weapons[wk];
      if (!w || !w.def || !w.def.branches) continue;
      var tree = w.def.branches;
      for (var bk in tree) {
        var bd = tree[bk];
        if (bd.shopGated) continue;
        w.branches[bk] = bd.max || 5;
      }
    }

    // 11. 初始铺砖（约一半目标量）

    var initRows = Math.ceil(targetAlive / 6 / 2); // 假设每行~6个
    this._fillInitialBricks(initRows);

    console.log('');
    console.log('╔══════════════════════════════════════════╗');
    console.log('║     🎯 DPS沙盘 v5 - 存活比例控制        ║');
    console.log('╚══════════════════════════════════════════╝');
    console.log('  武器: ' + weaponFilter);
    console.log('  目标存活: ' + targetAlive + '个砖块');
    console.log('  预热: ' + (this.stats.autoWarmup ? '自动(水位稳定后)' : warmup + 's'));
    console.log('  测量: ' + duration + 's | 倍速: ' + speed + 'x');
    console.log('');
    
    return '沙盘已启动: ' + weaponFilter + ' @' + speed + 'x';
  }

  _fillInitialBricks(rows) {
    var g = this.game;
    var Config = this.Config;
    var brickH = Config.BRICK_HEIGHT;
    var padding = Config.BRICK_PADDING;
    var phase = { types: ['normal'], timeCurve: [1.0, 1.0], spawnMult: 1 };
    var chapterConfig = { baseHP: 1, chapterScale: 1, gapChance: 0.08 };
    for (var r = 0; r < rows; r++) {
      var y = Config.BRICK_TOP_OFFSET + r * (brickH + padding);
      var newBricks = BrickFactory.generateRow(g.gameWidth, y, phase, chapterConfig);
      g.bricks = g.bricks.concat(newBricks);
    }
  }

  _countAlive() {
    var count = 0;
    var bricks = this.game.bricks;
    for (var i = 0; i < bricks.length; i++) {
      if (bricks[i].alive) count++;
    }
    return count;
  }

  _spawnRow(hp) {
    var g = this.game;
    var Config = this.Config;
    var phase = { types: ['normal', 'fast'], timeCurve: [hp, hp], spawnMult: 1 };
    var chapterConfig = { baseHP: 1, chapterScale: 1, gapChance: 0.08 };
    var y = Config.BRICK_TOP_OFFSET - Config.BRICK_HEIGHT - Config.BRICK_PADDING;
    var newBricks = BrickFactory.generateRow(g.gameWidth, y, phase, chapterConfig);
    g.bricks = g.bricks.concat(newBricks);
  }

  _onUpdate(dtMs) {
    if (!this.running) return;
    var st = this.stats;
    var ctrl = this._ctrl;
    st._totalElapsed += dtMs;
    
    // === 水位控制 ===
    ctrl.spawnCd -= dtMs;
    if (ctrl.spawnCd <= 0) {
      ctrl.spawnCd = ctrl.baseInterval;
      var alive = this._countAlive();
      var ratio = alive / ctrl.targetAlive; // <1=砖少，>1=砖多
      
      // ratio < 1 = 砖少(打得快), ratio > 1 = 砖多(打不动)
      var shouldSpawn = false;
      
      if (ratio < 0.5) {
        // 严重不足：双行补砖 + 大幅提HP
        shouldSpawn = true;
        this._spawnRow(ctrl.currentHP);
        ctrl.currentHP *= 1.25;
      } else if (ratio < 0.8) {
        // 偏少：补砖 + 提HP
        shouldSpawn = true;
        ctrl.currentHP *= 1.10;
      } else if (ratio > 1.5) {
        // 严重过多：停止生砖，等消化
        // 不降HP！让玩家慢慢打掉，维持当前HP
      } else if (ratio > 1.1) {
        // 偏多：停止生砖
      } else {
        // 水位正好(0.8~1.1)：正常维持
        shouldSpawn = true;
      }
      
      if (shouldSpawn) {
        this._spawnRow(ctrl.currentHP);
      }
      
      // 稳定检测（ratio在0.7~1.3持续N次）
      if (ratio >= 0.7 && ratio <= 1.3) {
        ctrl.stableCount++;
      } else {
        ctrl.stableCount = Math.max(0, ctrl.stableCount - 1);
      }
    }
    
    // === 预热期 ===
    if (!st.isWarmedUp) {
      st.warmupElapsed += dtMs;
      
      var warmupDone = false;
      if (st.autoWarmup) {
        // 自动模式：水位稳定就开始
        warmupDone = ctrl.stableCount >= ctrl.stableThreshold;
      } else {
        warmupDone = st.warmupElapsed >= st.warmup * 1000;
      }
      
      if (warmupDone) {
        st.isWarmedUp = true;
        st.totalDamage = 0;
        st.damageBySource = {};
        st.killCount = 0;
        st.buffEvents = { burn: 0, chill: 0, freeze: 0, shock: 0, arc: 0 };
        st.dpsSnapshots = [];
        st._lastSnapshotMs = 0;
        st._lastDamage = 0;
        
        var alive = this._countAlive();
        console.log('');
        console.log('✅ 预热完成！(耗时' + Math.round(st.warmupElapsed / 1000) + 's)');
        console.log('   存活砖: ' + alive + '/' + ctrl.targetAlive + ' | HP: ' + ctrl.currentHP.toFixed(1));
        console.log('   开始正式测量 ' + st.duration + '秒...');
        console.log('');
      }
      return;
    }
    
    // === 正式测量 ===
    st.measureElapsed += dtMs;
    var mSec = st.measureElapsed / 1000;
    
    // 每5秒快照
    if (st.measureElapsed - st._lastSnapshotMs >= 5000) {
      var intervalDmg = st.totalDamage - st._lastDamage;
      var intervalSec = (st.measureElapsed - st._lastSnapshotMs) / 1000;
      var alive = this._countAlive();
      var snap = {
        time: Math.round(mSec),
        totalDmg: Math.round(st.totalDamage),
        intervalDps: intervalSec > 0 ? (intervalDmg / intervalSec) : 0,
        avgDps: mSec > 0 ? (st.totalDamage / mSec) : 0,
        kills: st.killCount,
        alive: alive,
        hp: Math.round(ctrl.currentHP * 10) / 10,
      };
      st.dpsSnapshots.push(snap);
      st._lastSnapshotMs = st.measureElapsed;
      st._lastDamage = st.totalDamage;
      
      var ratio = alive / ctrl.targetAlive;
      console.log('🎯 [' + snap.time + 's] DPS:' + snap.avgDps.toFixed(1) + 
        ' | 区间:' + snap.intervalDps.toFixed(1) +
        ' | 存活:' + alive + '(' + Math.round(ratio * 100) + '%)' +
        ' | HP:' + snap.hp +
        ' | 杀:' + snap.kills);
    }
    
    if (mSec >= st.duration) {
      st.stopReason = '测量完成 (' + st.duration + 's)';
      this.stop();
    }
  }

  _hookDamage() {
    var combat = this.game.combat;
    var self = this;
    var orig = combat.damageBrick.bind(combat);
    combat.damageBrick = function(brick, damage, source, damageType) {
      if (self.running && self.stats && self.stats.isWarmedUp) {
        var key = source || 'unknown';
        self.stats.damageBySource[key] = (self.stats.damageBySource[key] || 0) + damage;
        self.stats.totalDamage += damage;
        var wasDead = !brick.alive || brick.hp <= 0;
        var result = orig(brick, damage, source, damageType);
        if (!wasDead && (brick.hp <= 0 || !brick.alive)) self.stats.killCount++;
        return result;
      }
      return orig(brick, damage, source, damageType);
    };
    this._cleanups.push(function() { combat.damageBrick = orig; });
  }

  _hookBuffs() {
    var bs = this.game.buffSystem;
    if (!bs) return;
    var self = this;
    var methods = ['applyBurn', 'applyChill', 'applyShock'];
    var keys = ['burn', 'chill', 'shock'];
    for (var i = 0; i < methods.length; i++) {
      (function(method, key) {
        var orig = bs[method].bind(bs);
        bs[method] = function(brick, stacks) {
          if (self.running && self.stats && self.stats.isWarmedUp) {
            self.stats.buffEvents[key]++;
          }
          if (key === 'chill') {
            var wasFrozen = bs.isFrozen && bs.isFrozen(brick);
            var result = orig(brick, stacks);
            if (self.running && self.stats && self.stats.isWarmedUp && !wasFrozen && bs.isFrozen && bs.isFrozen(brick)) {
              self.stats.buffEvents.freeze++;
            }
            return result;
          }
          return orig(brick, stacks);
        };
        self._cleanups.push(function() { bs[method] = orig; });
      })(methods[i], keys[i]);
    }
    if (bs.onEnergyHit) {
      var origArc = bs.onEnergyHit.bind(bs);
      bs.onEnergyHit = function(brick, dmg) {
        if (self.running && self.stats && self.stats.isWarmedUp) self.stats.buffEvents.arc++;
        return origArc(brick, dmg);
      };
      this._cleanups.push(function() { bs.onEnergyHit = origArc; });
    }
  }

  stop() {
    if (!this.running) return '沙盘未运行';
    this.running = false;
    if (typeof window.__stopAuto === 'function') window.__stopAuto();
    for (var i = 0; i < this._cleanups.length; i++) {
      try { this._cleanups[i](); } catch(e) {}
    }
    this._cleanups = [];
    this.game._devTimeScale = 1;
    this.game._devInvincible = false;
    var report = this._generateReport();
    console.log(report);
    this._lastReport = report;
    return report;
  }

  _generateReport() {
    var st = this.stats;
    var ctrl = this._ctrl;
    var sec = st.measureElapsed / 1000;
    var avgDps = sec > 0 ? st.totalDamage / sec : 0;
    
    // 稳定DPS（去首尾快照）
    var stableSnaps = st.dpsSnapshots.slice(1, -1);
    var stableDps = 0;
    if (stableSnaps.length > 0) {
      var sum = 0;
      for (var s = 0; s < stableSnaps.length; s++) sum += stableSnaps[s].intervalDps;
      stableDps = sum / stableSnaps.length;
    }
    
    // 峰值
    var peakDps = 0, peakTime = 0;
    for (var p = 0; p < st.dpsSnapshots.length; p++) {
      if (st.dpsSnapshots[p].intervalDps > peakDps) {
        peakDps = st.dpsSnapshots[p].intervalDps;
        peakTime = st.dpsSnapshots[p].time;
      }
    }
    
    // 平均存活
    var avgAlive = 0;
    if (st.dpsSnapshots.length > 0) {
      for (var r = 0; r < st.dpsSnapshots.length; r++) avgAlive += st.dpsSnapshots[r].alive;
      avgAlive = avgAlive / st.dpsSnapshots.length;
    }
    
    var L = [];
    L.push('');
    L.push('╔═══════════════════════════════════════════════════╗');
    L.push('║     🎯 DPS沙盘报告 v5 (存活比例控制)             ║');
    L.push('╚═══════════════════════════════════════════════════╝');
    L.push('');
    L.push('  武器: ' + st.weapon + ' | 测量: ' + sec.toFixed(1) + 's | 倍速: ' + st.speed + 'x');
    L.push('  停止: ' + (st.stopReason || '手动停止'));
    L.push('');
    L.push('┌─────────────────────────────────────┐');
    L.push('│  ⭐ 平均DPS:    ' + P(avgDps.toFixed(1), 8) + '              │');
    L.push('│  📊 稳定DPS:    ' + P(stableDps.toFixed(1), 8) + '              │');
    L.push('│  🔥 峰值DPS:    ' + P(peakDps.toFixed(1), 8) + ' (@' + peakTime + 's)' + P('', 5) + '│');
    L.push('│  💀 总伤害:     ' + P(Math.round(st.totalDamage), 8) + '              │');
    L.push('│  🧱 击杀砖块:   ' + P(st.killCount, 8) + '              │');
    L.push('│  📏 平均存活:   ' + P(avgAlive.toFixed(0), 8) + '/' + ctrl.targetAlive + P('', 8) + '│');
    L.push('│  ❤️ 稳定砖HP:   ' + P(ctrl.currentHP.toFixed(1), 8) + '              │');
    L.push('└─────────────────────────────────────┘');
    L.push('');
    
    // === 武器汇总（子伤害源归类） ===
    L.push('## 武器汇总');
    var sourceToWeapon = {
      bullet: 'ship', fire_explosion: 'ship', ice_shatter: 'ship',
      kunai: 'kunai', kunai_aoe: 'kunai', kunai_chain: 'kunai', kunai_split: 'kunai',
      lightning: 'lightning', lightning_aoe: 'lightning', lightning_thor: 'lightning',
      shock_arc: 'lightning', shock: 'lightning',
      armorPiercing: 'missile', armorPiercing_shockwave: 'missile', missile_doom: 'missile',
      bomber: 'meteor', bomber_napalm: 'meteor',
      frostStorm: 'frostStorm', frostStorm_shatter: 'frostStorm', frostStorm_splash: 'frostStorm',
      drone_laser: 'drone', drone_arc: 'drone', drone_cross: 'drone', drone_pulse: 'drone',
      spinBlade: 'spinBlade', spinBlade_sw: 'spinBlade',
      blizzard: 'blizzard', blizzard_shatter: 'blizzard',
      ionBeam: 'ionBeam', ionBeam_burn: 'ionBeam', ionBeam_doom: 'ionBeam',
      ionBeam_overload: 'ionBeam', ionBeam_path: 'ionBeam', ionBeam_pierce: 'ionBeam',
      ionBeam_splash: 'ionBeam', ionBeam_split: 'ionBeam', ionBeam_super: 'ionBeam',
      gravityWell: 'gravityWell', gravityWell_burst: 'gravityWell', gravityWell_pctHp: 'gravityWell',
      burn: 'dot', negaBrick: 'negaBrick', negaBrick_splash: 'negaBrick',
    };
    var weaponNames = {
      ship: '🔫飞机子弹', kunai: '❄️冰爆弹', lightning: '⚡闪电链',
      missile: '🚀穿甲弹', meteor: '💣轰炸机', frostStorm: '🌨寒冰发生器',
      drone: '🤖无人机', spinBlade: '🔪回旋刃', blizzard: '🔥白磷弹',
      ionBeam: '⚡离子射线', gravityWell: '🌀奇点引擎', dot: '🔥持续伤害',
      negaBrick: '💀负能砖', unknown: '❓未分类',
    };
    var weaponDmg = {};
    for (var wsrc in st.damageBySource) {
      var wkey = sourceToWeapon[wsrc] || 'unknown';
      weaponDmg[wkey] = (weaponDmg[wkey] || 0) + st.damageBySource[wsrc];
    }
    var wkeys = Object.keys(weaponDmg).sort(function(a,b) { return weaponDmg[b] - weaponDmg[a]; });
    for (var wi = 0; wi < wkeys.length; wi++) {
      var wk = wkeys[wi];
      var wdmg = weaponDmg[wk];
      var wpct = st.totalDamage > 0 ? (wdmg / st.totalDamage * 100) : 0;
      var wbar = '';
      for (var wb = 0; wb < Math.round(wpct / 5); wb++) wbar += '█';
      L.push('  ' + P(weaponNames[wk] || wk, 14) + P(Math.round(wdmg), 8) + ' (' + P(wpct.toFixed(1), 5) + '%)  ' + wbar);
    }
    L.push('');
    
    L.push('## 伤害来源(详细)');
        L.push('## 伤害来源(详细)');
    var sources = Object.keys(st.damageBySource).sort(function(a,b) { return st.damageBySource[b] - st.damageBySource[a]; });
    for (var i = 0; i < sources.length; i++) {
      var src = sources[i];
      var dmg = st.damageBySource[src];
      var pct = st.totalDamage > 0 ? (dmg / st.totalDamage * 100) : 0;
      var bar = '';
      for (var b = 0; b < Math.round(pct / 5); b++) bar += '█';
      L.push('  ' + P(src, 20) + P(Math.round(dmg), 8) + ' (' + P(pct.toFixed(1), 5) + '%)  ' + bar);
    }
    L.push('');
    
    L.push('## Buff触发');
    L.push('  🔥灼烧:' + st.buffEvents.burn + '  ❄️冰缓:' + st.buffEvents.chill + 
      '  🧊冻结:' + st.buffEvents.freeze + '  ⚡感电:' + st.buffEvents.shock + '  ⛓电弧:' + st.buffEvents.arc);
    if (st.buffEvents.chill > 0) L.push('  冻结率: ' + (st.buffEvents.freeze / st.buffEvents.chill * 100).toFixed(1) + '%');
    L.push('');
    
    L.push('## 时间线');
    L.push('  时间 │ 平均DPS│ 区间DPS│ 存活 │ 砖HP');
    L.push('  ─────┼────────┼────────┼──────┼─────');
    for (var k = 0; k < st.dpsSnapshots.length; k++) {
      var sn = st.dpsSnapshots[k];
      var pctA = Math.round(sn.alive / ctrl.targetAlive * 100);
      L.push('  ' + P(sn.time + 's', 5) + '│' + P(sn.avgDps.toFixed(1), 7) + ' │' + P(sn.intervalDps.toFixed(1), 7) + ' │' + P(sn.alive + '(' + pctA + '%)', 8) + '│ ' + sn.hp);
    }
    
    return L.join('\n');
    
    function P(val, len) { var s = String(val); while (s.length < len) s = ' ' + s; return s; }
  }

  getReport() { return this._lastReport || '没有测试报告'; }
}

module.exports = DPSSandbox;
