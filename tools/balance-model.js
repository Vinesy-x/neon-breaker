#!/usr/bin/env node
/**
 * balance-model.js - 武器DPS纯数学建模
 * Phase 1: 不运行游戏，纯粹从配置文件计算理论DPS
 * 
 * 用法: node tools/balance-model.js [--json]
 */

var WBC = require('../src/config/WeaponBalanceConfig');
var WSD = require('../src/config/WeaponShopDefs');

var baseAttack = 1; // 标准化

// ===== 有效命中数标定（固定环境下的经验值）=====
// 这些值需要通过 Phase 3 校准，初始值来自 BALANCE_MODEL.md
var EFFECTIVE_HITS = {
  kunai: function(shopLv) {
    // AOE r=1.1列，常规密度约6命中
    return 6;
  },
  lightning: function(shopLv) {
    // N链，每跳衰减15%
    var chains = WSD.getSweetSpotValue('lightning', shopLv);
    var total = 0;
    for (var c = 0; c < chains; c++) total += Math.pow(1 - WBC.lightning.chainDecayBase, c);
    return total;
  },
  missile: function(shopLv) {
    // M发齐射 × 每发穿P个 × 衰减
    var salvos = WSD.getSweetSpotValue('missile', shopLv);
    var pierce = WBC.missile.basePierce;
    // 实际每列砖块高度有限，取min(pierce, 5)
    var effectivePierce = Math.min(pierce, 5);
    var pierceMult = 0;
    for (var p = 0; p < effectivePierce; p++) pierceMult += Math.pow(1 - WBC.missile.decayRate, p);
    return salvos * pierceMult;
  },
  meteor: function(shopLv) {
    // B颗弹 × 每弹命中H个(半径0.5列≈2个)
    var bombs = WBC.meteor.baseBombs;
    var hitsPerBomb = 2;
    return bombs * hitsPerBomb;
  },
};

// ===== CD计算 =====
function getCD(weapon, shopLv) {
  var ss = WSD.WEAPON_SHOP[weapon];
  if (!ss) return WBC[weapon].interval;
  
  var sweetSpotVal = WSD.getSweetSpotValue(weapon, shopLv);
  
  if (ss.sweetSpot.type === 'cd') {
    // CD型爽点：直接用爽点值作为CD
    // 注意冰爆弹有3000ms下限
    var cd = sweetSpotVal;
    if (weapon === 'kunai') cd = Math.max(cd, 3000);
    return cd;
  }
  
  // 非CD型爽点（链数/齐射/持续时间等）：CD不变
  return WBC[weapon].interval;
}

// ===== 主计算 =====
var WEAPONS = ['kunai', 'lightning', 'missile', 'meteor'];
var LEVELS = [1, 5, 10, 15, 20, 25, 30];
var COMPARE_LEVELS = [10, 20, 30];

var results = {};
var isJson = process.argv.includes('--json');

for (var wi = 0; wi < WEAPONS.length; wi++) {
  var w = WEAPONS[wi];
  var wName = WSD.WEAPON_SHOP[w] ? WSD.WEAPON_SHOP[w].name : w;
  var basePct = WBC[w].basePct;
  
  results[w] = { name: wName, basePct: basePct, levels: {} };
  
  for (var li = 0; li < LEVELS.length; li++) {
    var lv = LEVELS[li];
    var dmgMult = WSD.getDmgMultiplier(lv);
    var baseDmg = basePct * baseAttack * dmgMult;
    var cd = getCD(w, lv);
    var effectiveHits = EFFECTIVE_HITS[w](lv);
    var theoryDPS = baseDmg * effectiveHits / (cd / 1000);
    
    results[w].levels[lv] = {
      dmgMult: +dmgMult.toFixed(3),
      baseDmg: +baseDmg.toFixed(2),
      cd: cd,
      effectiveHits: +effectiveHits.toFixed(2),
      theoryDPS: +theoryDPS.toFixed(1),
    };
  }
  
  // 倍率计算
  var d10 = results[w].levels[10].theoryDPS;
  var d20 = results[w].levels[20].theoryDPS;
  var d30 = results[w].levels[30].theoryDPS;
  results[w].ratios = {
    '10to20': +(d20 / d10).toFixed(2),
    '20to30': +(d30 / d20).toFixed(2),
    '1to30': +(d30 / results[w].levels[1].theoryDPS).toFixed(1),
  };
}

// ===== 平衡检查 =====
var lv30DPS = {};
for (var wi = 0; wi < WEAPONS.length; wi++) {
  var w = WEAPONS[wi];
  lv30DPS[w] = results[w].levels[30].theoryDPS;
}
var maxDPS = Math.max.apply(null, Object.values(lv30DPS));
var minDPS = Math.min.apply(null, Object.values(lv30DPS));
var balance = {
  lv30_max_min_ratio: +(maxDPS / minDPS).toFixed(1),
  lv30_ranking: Object.keys(lv30DPS).sort(function(a,b) { return lv30DPS[b] - lv30DPS[a]; }),
};

// 检查通过条件
var issues = [];
for (var wi = 0; wi < WEAPONS.length; wi++) {
  var w = WEAPONS[wi];
  var r = results[w].ratios;
  if (r['10to20'] < 2.0 || r['10to20'] > 4.0)
    issues.push(w + ' 10→20 = x' + r['10to20'] + ' (期望 2.0~4.0)');
  if (r['20to30'] < 2.0 || r['20to30'] > 4.0)
    issues.push(w + ' 20→30 = x' + r['20to30'] + ' (期望 2.0~4.0)');
}
if (balance.lv30_max_min_ratio > 3.0)
  issues.push('Lv30 最强/最弱 = ' + balance.lv30_max_min_ratio + 'x (期望 <3x)');

balance.issues = issues;
balance.verdict = issues.length === 0 ? 'PASS' : 'FAIL (' + issues.length + ' issues)';

// ===== 输出 =====
if (isJson) {
  console.log(JSON.stringify({ results: results, balance: balance }, null, 2));
} else {
  console.log('');
  console.log('╔════════════════════════════════════════════════════╗');
  console.log('║       ⚔️  武器DPS数学模型 (Phase 1)                ║');
  console.log('╚════════════════════════════════════════════════════╝');
  console.log('');
  
  // DPS表格
  console.log('## 理论DPS (baseAttack=1)');
  console.log('┌────────────┬─────────┬─────────┬─────────┬─────────┬─────────┐');
  console.log('│ 武器       │ Lv1     │ Lv10    │ Lv20    │ Lv30    │ 1→30    │');
  console.log('├────────────┼─────────┼─────────┼─────────┼─────────┼─────────┤');
  for (var wi = 0; wi < WEAPONS.length; wi++) {
    var w = WEAPONS[wi];
    var r = results[w];
    console.log('│ ' + pad(r.name, 10) + ' │' + 
      pad(r.levels[1].theoryDPS.toFixed(0), 8) + ' │' +
      pad(r.levels[10].theoryDPS.toFixed(0), 8) + ' │' +
      pad(r.levels[20].theoryDPS.toFixed(0), 8) + ' │' +
      pad(r.levels[30].theoryDPS.toFixed(0), 8) + ' │' +
      pad('x' + r.ratios['1to30'], 8) + ' │');
  }
  console.log('└────────────┴─────────┴─────────┴─────────┴─────────┴─────────┘');
  
  // 倍率
  console.log('');
  console.log('## 等级倍率');
  console.log('┌────────────┬──────────┬──────────┬────────┐');
  console.log('│ 武器       │ 10→20    │ 20→30    │ 状态   │');
  console.log('├────────────┼──────────┼──────────┼────────┤');
  for (var wi = 0; wi < WEAPONS.length; wi++) {
    var w = WEAPONS[wi];
    var r = results[w].ratios;
    var ok1 = r['10to20'] >= 2.0 && r['10to20'] <= 4.0;
    var ok2 = r['20to30'] >= 2.0 && r['20to30'] <= 4.0;
    var status = (ok1 && ok2) ? '✅' : '❌';
    console.log('│ ' + pad(results[w].name, 10) + ' │' +
      pad('x' + r['10to20'], 9) + ' │' +
      pad('x' + r['20to30'], 9) + ' │ ' + pad(status, 6) + '│');
  }
  console.log('└────────────┴──────────┴──────────┴────────┘');
  
  // 详细参数
  console.log('');
  console.log('## 详细参数');
  for (var wi = 0; wi < WEAPONS.length; wi++) {
    var w = WEAPONS[wi];
    var r = results[w];
    console.log('');
    console.log('### ' + r.name + ' (basePct=' + r.basePct + ')');
    console.log('  Lv  │ dmgMult │ baseDmg │   CD    │ effHits │ DPS');
    console.log('  ────┼─────────┼─────────┼─────────┼─────────┼────────');
    for (var li = 0; li < LEVELS.length; li++) {
      var lv = LEVELS[li];
      var d = r.levels[lv];
      console.log('  ' + pad(lv, 4) + '│' + pad(d.dmgMult, 8) + ' │' + pad(d.baseDmg.toFixed(1), 8) + ' │' +
        pad(d.cd + 'ms', 8) + ' │' + pad(d.effectiveHits, 8) + ' │' + pad(d.theoryDPS.toFixed(1), 8));
    }
  }
  
  // 平衡总结
  console.log('');
  console.log('═══════════════════════════════════════');
  console.log('  Lv30 最强/最弱: ' + balance.lv30_max_min_ratio + 'x');
  console.log('  排名: ' + balance.lv30_ranking.map(function(w) { return results[w].name; }).join(' > '));
  console.log('  判定: ' + balance.verdict);
  if (issues.length > 0) {
    console.log('');
    console.log('  ⚠️ 问题:');
    for (var i = 0; i < issues.length; i++) {
      console.log('    - ' + issues[i]);
    }
  }
  console.log('═══════════════════════════════════════');
}

function pad(val, len) { var s = String(val); while (s.length < len) s = ' ' + s; return s; }
