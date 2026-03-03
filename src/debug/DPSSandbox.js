/**
 * DPSSandbox.js v6 - 武器DPS精确测试沙盘
 * 
 * 规范文档: docs/SANDBOX_SPEC.md
 * 
 * 用法:
 *   __dpsSandbox({ weapon: 'kunai', shopLv: 1, duration: 120, speed: 10 })
 *   __stopSandbox()
 *   __sandboxReport()    // 纯文本报告
 *   __sandboxResult()    // 结构化JSON
 */

var BrickFactory = require('../BrickFactory');
var ConfigRef = require('../Config');
var WSD = require('../config/WeaponShopDefs');
var WU = require('../config/WeaponUnlockConfig');
var WeaponDefs = require('../config/WeaponDefs');
var SaveManager = require('../systems/SaveManager');

class DPSSandbox {
  constructor(game, Config) {
    this.game = game;
    this.Config = Config || ConfigRef;
    this.running = false;
    this.stats = null;
    this._result = null;
    this._lastReport = '';
    this._cleanups = [];
  }

  start(opts) {
    if (this.running) this.stop();
    opts = opts || {};

    var weaponFilter = opts.weapon || 'all';
    var shopLv = opts.shopLv || 1;
    var duration = opts.duration || 120;
    var speed = opts.speed || 10;
    var targetAlive = opts.targetAlive || 60;
    var fullBranch = opts.fullBranch !== false;  // 默认true
    var shipTree = opts.shipTree !== false;      // 默认true

    var g = this.game;
    var Config = this.Config;

    // ========== 1. 清理环境 ==========
    // 清存档防止旧数据污染
    if (typeof localStorage !== 'undefined') localStorage.clear();

    // ========== 2. 设置商店等级 ==========
    // 在 _initGame 之前写入 save 数据，这样初始化时能读到正确等级
    if (g.saveManager && g.saveManager._data) {
      if (!g.saveManager._data.weaponLevels) g.saveManager._data.weaponLevels = {};
      // 设置指定武器的商店等级
      if (weaponFilter !== 'all') {
        var weapons = weaponFilter.split(',');
        for (var i = 0; i < weapons.length; i++) {
          g.saveManager._data.weaponLevels[weapons[i]] = shopLv;
        }
      } else {
        for (var wk in WU) {
          g.saveManager._data.weaponLevels[wk] = shopLv;
        }
      }
      // 飞机也设到同等级
      g.saveManager._data.weaponLevels['ship'] = shopLv;
    }

    // ========== 3. 初始化游戏 ==========
    g._initGame();
    g._devInvincible = true;
    g._sandboxMode = true;
    g._devTimeScale = speed;

    // ========== 4. 武器上限解除 ==========
    var origMaxWeapons = Config.MAX_WEAPONS;
    Config.MAX_WEAPONS = 99;
    this._cleanups.push(function() { Config.MAX_WEAPONS = origMaxWeapons; });

    // ========== 5. 武器锁定 ==========
    var allowedWeapons = weaponFilter === 'all' ? null : weaponFilter.split(',');

    if (allowedWeapons) {
      // 添加指定武器
      for (var i = 0; i < allowedWeapons.length; i++) {
        var w = allowedWeapons[i];
        if (w !== 'ship' && !g.upgrades.weapons[w]) {
          g.upgrades.addWeapon(w);
        }
      }
      // 删除非指定武器
      var toRemove = [];
      for (var key in g.upgrades.weapons) {
        if (allowedWeapons.indexOf(key) === -1) toRemove.push(key);
      }
      for (var i = 0; i < toRemove.length; i++) {
        delete g.upgrades.weapons[toRemove[i]];
      }
    }

    // 阻止新武器加入
    var origAddWeapon = g.upgrades.addWeapon.bind(g.upgrades);
    g.upgrades.addWeapon = function(key) {
      if (allowedWeapons && allowedWeapons.indexOf(key) === -1) return;
      origAddWeapon(key);
    };
    this._cleanups.push(function() { g.upgrades.addWeapon = origAddWeapon; });

    // ========== 6. 接管砖块生成 ==========
    var origUpdateSpawn = g._updateBrickSpawn.bind(g);
    g._updateBrickSpawn = function() {};
    this._cleanups.push(function() { g._updateBrickSpawn = origUpdateSpawn; });

    // ========== 7. 分支满级（fullBranch） ==========
    var customBranches = opts.branches || null; // {damage:10, horizon:2, ...}
    if (fullBranch) {
      // 获取当前 shopLv 下已解锁的分支列表
      var weaponsToMax = allowedWeapons || Object.keys(g.upgrades.weapons);
      for (var i = 0; i < weaponsToMax.length; i++) {
        var wk = weaponsToMax[i];
        if (wk === 'ship') continue;
        var weapon = g.upgrades.weapons[wk];
        if (!weapon) continue;
        var treeDef = WeaponDefs[wk];
        if (!treeDef) continue;

        // 构建解锁等级映射：分支名 → 解锁所需shopLv
        var shopDef = WSD.WEAPON_SHOP[wk];
        var branchUnlockLv = {};  // 默认分支解锁等级=1
        if (shopDef && shopDef.unlockBranches) {
          for (var ulv in shopDef.unlockBranches) {
            branchUnlockLv[shopDef.unlockBranches[ulv]] = parseInt(ulv);
          }
        }
        // 所有分支：shopLv >= 解锁等级则点满
        for (var bk in treeDef.branches) {
          var bDef = treeDef.branches[bk];
          var reqLv = branchUnlockLv[bk] || 1;  // 无解锁等级=默认Lv1可用
          if (shopLv >= reqLv) {
            weapon.branches[bk] = bDef.max || 1;
          } else {
            weapon.branches[bk] = 0;
          }
        }
      }

      // 飞机树
      if (shipTree) {
        var ST = Config.SHIP_TREE;
        for (var sk in ST) {
          var sb = ST[sk];
          if (sb.exclusiveGroup) continue;
          if (sb.shopGated) continue;  // TODO: check shopLv for ship gated branches
          if (sb.requires) {
            var skip = false;
            for (var rk in sb.requires) {
              if (ST[rk] && (ST[rk].shopGated || ST[rk].exclusiveGroup)) skip = true;
            }
            if (skip) continue;
          }
          g.upgrades.shipTree[sk] = sb.max || 5;
        }
        g._syncLauncherStats && g._syncLauncherStats();
      }

      // 屏蔽经验/升级系统 → 玩家直接满级
      if (g.expSystem) {
        g.expSystem.addExp = function() {};  // 不再获得经验
        g.expSystem.level = 99;              // 满级
      }
      // 屏蔽三选一弹框
      if (g.upgrades.generateChoices) {
        g.upgrades.generateChoices = function() { return []; };
      }
    }

    // ========== 7b. 自定义分支覆盖 ==========
    var testWeapon = g.upgrades && g.upgrades.weapons && g.upgrades.weapons[weaponFilter];
    if (customBranches && testWeapon) {
      for (var cbk in customBranches) {
        testWeapon.branches[cbk] = customBranches[cbk];
      }
      var treeDef2 = WeaponDefs[weaponFilter];
      if (treeDef2) {
        for (var bk3 in treeDef2.branches) {
          if (!(bk3 in customBranches)) testWeapon.branches[bk3] = 0;
        }
      }
    }

        // ========== 8. 水位控制器 ==========
    this._ctrl = {
      targetAlive: targetAlive,
      currentHP: 1,
      spawnCd: 0,
      baseInterval: 1000,
      stableCount: 0,
      stableThreshold: 5,
    };

    // ========== 9. 统计初始化 ==========
    this.stats = {
      weapon: weaponFilter,
      shopLv: shopLv,
      duration: duration,
      speed: speed,
      targetAlive: targetAlive,
      fullBranch: fullBranch,
      customBranches: customBranches,
      warmupElapsed: 0,
      isWarmedUp: false,
      measureElapsed: 0,
      totalDamage: 0,
      damageBySource: {},
      branchSnapshot: null,
      branchTotalPts: 0,
      killCount: 0,
      buffEvents: { burn: 0, chill: 0, freeze: 0, shock: 0, arc: 0 },
      dpsSnapshots: [],
      _lastSnapshotMs: 0,
      _lastDamage: 0,
      stopReason: '',
      _totalElapsed: 0,
    };
    // 记录分支快照（stats已初始化）
    var wk2 = weaponFilter || Object.keys(g.upgrades.weapons)[0];
    var w2 = g.upgrades.weapons[wk2];
    if (w2) {
      this.stats.branchSnapshot = Object.assign({}, w2.branches);
      var tp2 = 0; for (var bk2 in w2.branches) tp2 += w2.branches[bk2];
      this.stats.branchTotalPts = tp2;
    }
    this.running = true;
    this._result = null;

    // ========== 10. Hooks ==========
    this._hookDamage();
    this._hookBuffs();

    var self = this;
    g._sandboxUpdate = function(dtMs) { self._onUpdate(dtMs); };
    this._cleanups.push(function() { g._sandboxUpdate = null; });

    // ========== 10b. 禁用飞机射击 ==========
    if (opts.noShip !== false) {  // 默认禁用飞机
      var origFire = g.combat.fireBullets.bind(g.combat);
      g.combat.fireBullets = function() {};
      this._cleanups.push(function() { g.combat.fireBullets = origFire; });
    }

    // ========== 11. AutoBattle ==========
    if (typeof window.__autoBattle === 'function') {
      window.__autoBattle('aggressive');
    }

    // ========== 12. 初始铺砖 ==========
    var initRows = Math.ceil(targetAlive / 6 / 2);
    this._fillInitialBricks(initRows);

    console.log('');
    console.log('╔══════════════════════════════════════════╗');
    console.log('║     🎯 DPS沙盘 v6                        ║');
    console.log('╚══════════════════════════════════════════╝');
    console.log('  武器: ' + weaponFilter + ' | 商店Lv: ' + shopLv);
    if (customBranches) {
      var cbStr = [];
      for (var ck in customBranches) cbStr.push(ck + '=' + customBranches[ck]);
      console.log('  分支: 自定义[' + cbStr.join(', ') + ']');
    } else {
      console.log('  分支: ' + (fullBranch ? '满级(shopLv已解锁)' : '无'));
    }
    console.log('  目标存活: ' + targetAlive + ' | 测量: ' + duration + 's | 倍速: ' + speed + 'x');
    console.log('');

    return '沙盘v6已启动: ' + weaponFilter + ' shopLv=' + shopLv + ' @' + speed + 'x';
  }

  // ========== 砖块生成 ==========

  _fillInitialBricks(rows) {
    var g = this.game;
    var Config = this.Config;
    var phase = { types: ['normal'], timeCurve: [1.0, 1.0], spawnMult: 1 };
    var chapterConfig = { baseHP: 1, chapterScale: 1, gapChance: 0.08 };
    for (var r = 0; r < rows; r++) {
      var y = Config.BRICK_TOP_OFFSET + r * (Config.BRICK_HEIGHT + Config.BRICK_PADDING);
      g.bricks = g.bricks.concat(BrickFactory.generateRow(g.gameWidth, y, phase, chapterConfig));
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
    g.bricks = g.bricks.concat(BrickFactory.generateRow(g.gameWidth, y, phase, chapterConfig));
  }

  // ========== 主循环 ==========

  _onUpdate(dtMs) {
    if (!this.running) return;
    var st = this.stats;
    var ctrl = this._ctrl;
    st._totalElapsed += dtMs;

    // 水位控制
    ctrl.spawnCd -= dtMs;
    if (ctrl.spawnCd <= 0) {
      ctrl.spawnCd = ctrl.baseInterval;
      var alive = this._countAlive();
      var ratio = alive / ctrl.targetAlive;

      var shouldSpawn = false;
      if (ratio < 0.5) {
        shouldSpawn = true;
        this._spawnRow(ctrl.currentHP);
        ctrl.currentHP *= 1.12;
      } else if (ratio < 0.8) {
        shouldSpawn = true;
        ctrl.currentHP *= 1.05;
      } else if (ratio > 1.5) {
        // 严重过多：停
      } else if (ratio > 1.1) {
        // 偏多：停
      } else {
        shouldSpawn = true;
      }
      if (shouldSpawn) {
        this._spawnRow(ctrl.currentHP);
      }

      if (ratio >= 0.7 && ratio <= 1.3) {
        ctrl.stableCount++;
      } else {
        ctrl.stableCount = Math.max(0, ctrl.stableCount - 1);
      }
    }

    // 预热期
    if (!st.isWarmedUp) {
      st.warmupElapsed += dtMs;
      if (ctrl.stableCount >= ctrl.stableThreshold) {
        st.isWarmedUp = true;
        st.totalDamage = 0;
        st.damageBySource = {};
        st.killCount = 0;
        st.buffEvents = { burn: 0, chill: 0, freeze: 0, shock: 0, arc: 0 };
        st.dpsSnapshots = [];
        st._lastSnapshotMs = 0;
        st._lastDamage = 0;
        console.log('✅ 预热完成 (' + Math.round(st.warmupElapsed / 1000) + 's) | HP: ' + ctrl.currentHP.toFixed(1));
      }
      return;
    }

    // 正式测量
    st.measureElapsed += dtMs;
    var mSec = st.measureElapsed / 1000;

    // 每5秒快照
    if (st.measureElapsed - st._lastSnapshotMs >= 5000) {
      var intervalDmg = st.totalDamage - st._lastDamage;
      var intervalSec = (st.measureElapsed - st._lastSnapshotMs) / 1000;
      var alive = this._countAlive();
      st.dpsSnapshots.push({
        time: Math.round(mSec),
        avgDps: mSec > 0 ? +(st.totalDamage / mSec).toFixed(1) : 0,
        intervalDps: intervalSec > 0 ? +(intervalDmg / intervalSec).toFixed(1) : 0,
        alive: alive,
        hp: +ctrl.currentHP.toFixed(1),
        kills: st.killCount,
      });
      st._lastSnapshotMs = st.measureElapsed;
      st._lastDamage = st.totalDamage;
    }

    if (mSec >= st.duration) {
      st.stopReason = '测量完成 (' + st.duration + 's)';
      this.stop();
    }
  }

  // ========== Hooks ==========

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
        if (!bs[method]) return;
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

  // ========== 停止 ==========

  stop() {
    if (!this.running) return '沙盘未运行';
    this.running = false;
    if (typeof window.__stopAuto === 'function') window.__stopAuto();

    // 生成结果
    this._result = this._buildResult();
    this._lastReport = this._generateReport();
    console.log(this._lastReport);

    // 清理
    for (var i = 0; i < this._cleanups.length; i++) {
      try { this._cleanups[i](); } catch(e) {}
    }
    this._cleanups = [];
    this.game._devTimeScale = 1;
    this.game._devInvincible = false;
    this.game._sandboxMode = false;

    return this._lastReport;
  }

  // ========== 结构化结果 ==========

  _buildResult() {
    var st = this.stats;
    var ctrl = this._ctrl;
    var sec = st.measureElapsed / 1000;
    var avgDps = sec > 0 ? +(st.totalDamage / sec).toFixed(1) : 0;

    // 稳定DPS
    var stableSnaps = st.dpsSnapshots.slice(1, -1);
    var stableDps = 0;
    if (stableSnaps.length > 0) {
      var sum = 0;
      for (var i = 0; i < stableSnaps.length; i++) sum += stableSnaps[i].intervalDps;
      stableDps = +(sum / stableSnaps.length).toFixed(1);
    }

    // 峰值
    var peakDps = 0, peakTime = 0;
    for (var i = 0; i < st.dpsSnapshots.length; i++) {
      if (st.dpsSnapshots[i].intervalDps > peakDps) {
        peakDps = st.dpsSnapshots[i].intervalDps;
        peakTime = st.dpsSnapshots[i].time;
      }
    }

    // 平均存活
    var avgAlive = 0;
    if (st.dpsSnapshots.length > 0) {
      for (var i = 0; i < st.dpsSnapshots.length; i++) avgAlive += st.dpsSnapshots[i].alive;
      avgAlive = Math.round(avgAlive / st.dpsSnapshots.length);
    }

    // 武器归类
    var weaponDamage = this._classifyDamage(st.damageBySource);

    return {
      weapon: st.weapon,
      shopLv: st.shopLv,
      speed: st.speed,
      duration: st.duration,
      fullBranch: st.fullBranch,
      avgDps: avgDps,
      stableDps: stableDps,
      peakDps: +peakDps.toFixed(1),
      peakTime: peakTime,
      totalDamage: Math.round(st.totalDamage),
      kills: st.killCount,
      avgAlive: avgAlive,
      stableHp: +ctrl.currentHP.toFixed(1),
      warmupSec: Math.round(st.warmupElapsed / 1000),
      measureSec: +sec.toFixed(1),
      damageBySource: st.damageBySource,
      weaponDamage: weaponDamage,
      buffEvents: Object.assign({}, st.buffEvents),
      snapshots: st.dpsSnapshots,
      branchDetail: { branches: st.branchSnapshot || {}, totalPts: st.branchTotalPts || 0, passives: this._getPassiveList(st), mode: st.customBranches ? 'custom' : (st.fullBranch ? 'full' : 'none'), custom: st.customBranches || null },
    };
  }

  _getPassiveList(st) {
    var g = this.game;
    if (!g || !g.saveManager) return [];
    var wk = st.weapon;
    var passives = [];
    var pDef = WSD.WEAPON_SHOP[wk] && WSD.WEAPON_SHOP[wk].passives;
    if (pDef) {
      for (var lv in pDef) {
        var pk = pDef[lv].key;
        if (g.saveManager.hasWeaponPassive(wk, pk)) passives.push(pk + '@Lv' + lv);
      }
    }
    return passives;
  }

    _classifyDamage(sources) {
    var map = {
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
    var result = {};
    for (var src in sources) {
      var wk = map[src] || 'unknown';
      result[wk] = (result[wk] || 0) + sources[src];
    }
    return result;
  }

  // ========== 纯文本报告 ==========

  _generateReport() {
    var r = this._result;
    if (!r) return '无数据';
    var st = this.stats;
    var ctrl = this._ctrl;

    var weaponNames = {
      ship: '🔫飞机子弹', kunai: '❄️冰爆弹', lightning: '⚡闪电链',
      missile: '🚀穿甲弹', meteor: '💣轰炸机', frostStorm: '🌨寒冰发生器',
      drone: '🤖无人机', spinBlade: '🔪回旋刃', blizzard: '🔥白磷弹',
      ionBeam: '⚡离子射线', gravityWell: '🌀奇点引擎', dot: '🔥持续伤害',
      negaBrick: '💀负能砖', unknown: '❓未分类',
    };

    var L = [];
    L.push('');
    L.push('╔═══════════════════════════════════════════════════╗');
    L.push('║     🎯 DPS沙盘报告 v6                             ║');
    L.push('╚═══════════════════════════════════════════════════╝');
    L.push('');
    var branchLabel = r.fullBranch ? '满级' : '无';
    if (r.customBranches) {
      var parts = [];
      for (var rk in r.customBranches) parts.push(rk + '=' + r.customBranches[rk]);
      branchLabel = '自定义[' + parts.join(',') + ']';
    }
    L.push('  武器: ' + r.weapon + ' | 商店Lv: ' + r.shopLv + ' | 分支: ' + branchLabel);
    L.push('  测量: ' + r.measureSec + 's | 倍速: ' + r.speed + 'x | 预热: ' + r.warmupSec + 's');
    L.push('  停止: ' + (st.stopReason || '手动'));
    L.push('');
    L.push('┌─────────────────────────────────────┐');
    L.push('│  ⭐ 平均DPS:    ' + P(r.avgDps, 8) + '              │');
    L.push('│  📊 稳定DPS:    ' + P(r.stableDps, 8) + '              │');
    L.push('│  🔥 峰值DPS:    ' + P(r.peakDps, 8) + ' (@' + r.peakTime + 's)     │');
    L.push('│  💀 总伤害:     ' + P(r.totalDamage, 8) + '              │');
    L.push('│  🧱 击杀:       ' + P(r.kills, 8) + '              │');
    L.push('│  📏 平均存活:   ' + P(r.avgAlive, 8) + '/' + ctrl.targetAlive + '        │');
    L.push('│  ❤️ 稳定砖HP:   ' + P(r.stableHp, 8) + '              │');
    L.push('└─────────────────────────────────────┘');
    L.push('');

    // 武器汇总
    L.push('## 武器汇总');
    var wkeys = Object.keys(r.weaponDamage).sort(function(a,b) { return r.weaponDamage[b] - r.weaponDamage[a]; });
    for (var i = 0; i < wkeys.length; i++) {
      var wk = wkeys[i];
      var wdmg = r.weaponDamage[wk];
      var wpct = r.totalDamage > 0 ? (wdmg / r.totalDamage * 100) : 0;
      var bar = '';
      for (var b = 0; b < Math.round(wpct / 5); b++) bar += '█';
      L.push('  ' + P(weaponNames[wk] || wk, 14) + P(Math.round(wdmg), 8) + ' (' + P(wpct.toFixed(1), 5) + '%)  ' + bar);
    }
    L.push('');

    // 详细伤害源
    L.push('## 伤害来源(详细)');
    var sources = Object.keys(st.damageBySource).sort(function(a,b) { return st.damageBySource[b] - st.damageBySource[a]; });
    for (var i = 0; i < sources.length; i++) {
      var src = sources[i];
      var dmg = st.damageBySource[src];
      var pct = r.totalDamage > 0 ? (dmg / r.totalDamage * 100) : 0;
      var bar = '';
      for (var b = 0; b < Math.round(pct / 5); b++) bar += '█';
      L.push('  ' + P(src, 20) + P(Math.round(dmg), 8) + ' (' + P(pct.toFixed(1), 5) + '%)  ' + bar);
    }
    L.push('');

    // Buff
    L.push('## Buff触发');
    var bf = r.buffEvents;
    L.push('  🔥灼烧:' + bf.burn + '  ❄️冰缓:' + bf.chill + '  🧊冻结:' + bf.freeze + '  ⚡感电:' + bf.shock + '  ⛓电弧:' + bf.arc);
    L.push('');

    // 时间线
    L.push('## 时间线');
    L.push('  时间 │ 平均DPS│ 区间DPS│ 存活 │ 砖HP');
    L.push('  ─────┼────────┼────────┼──────┼─────');
    for (var i = 0; i < r.snapshots.length; i++) {
      var sn = r.snapshots[i];
      var pctA = Math.round(sn.alive / ctrl.targetAlive * 100);
      L.push('  ' + P(sn.time + 's', 5) + '│' + P(sn.avgDps, 7) + ' │' + P(sn.intervalDps, 7) + ' │' + P(sn.alive + '(' + pctA + '%)', 8) + '│ ' + sn.hp);
    }

    return L.join('\n');

    function P(val, len) { var s = String(val); while (s.length < len) s = ' ' + s; return s; }
  }

  // ========== 公共API ==========

  getReport() { return this._lastReport || '没有测试报告'; }
  getResult() { return this._result; }
}

module.exports = DPSSandbox;
