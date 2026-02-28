#!/usr/bin/env node
/**
 * balance-calc.js - 武器数值平衡计算器
 * 
 * 用法：
 *   node tools/balance-calc.js          → 计算并显示对比表
 *   node tools/balance-calc.js --write  → 计算并写入 WeaponBalanceConfig.js
 *   node tools/balance-calc.js --help   → 显示帮助
 * 
 * 修改武器参数 → 跑脚本 → 自动重算所有basePct → 一键写入配置
 */

const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════════
// 全局基准参数（改这里影响所有武器）
// ═══════════════════════════════════════════
const GLOBAL = {
  targetDPS: 4.0,           // 目标有效DPS（所有武器统一锚点）
  screenWidth: 375,         // 基准屏幕宽度(px)
  brickCols: 7,             // 砖块列数
  brickPadding: 4,          // 砖块间距
  brickHeight: 20,          // 砖块高度
};

// 自动计算列宽
GLOBAL.colWidth = (GLOBAL.screenWidth - GLOBAL.brickPadding * (GLOBAL.brickCols + 1)) / GLOBAL.brickCols + GLOBAL.brickPadding;

// ═══════════════════════════════════════════
// AOE命中数查表（半径列宽 → 命中数）
// 基于公式: π×(r×colW)² / (colW×brickH) × fillRate
// ═══════════════════════════════════════════
function aoeHits(radiusCol, densityMode) {
  const rpx = radiusCol * GLOBAL.colWidth;
  const fillRate = densityMode === 'dense' ? 0.85 : densityMode === 'normal' ? 0.55 : 0.70;
  return Math.round(Math.PI * rpx * rpx / (GLOBAL.colWidth * GLOBAL.brickHeight) * fillRate);
}

// ═══════════════════════════════════════════
// 武器定义（改这里调单个武器参数）
// ═══════════════════════════════════════════
const WEAPONS = {
  kunai: {
    name: '寒冰弹',
    type: 'burst',           // burst=瞬发, sustain=持续
    cd: 6,
    mechDesc: 'AOE 1.2列, 直接伤害',
    // 有效倍率 = hits × decayMult × mechCoef
    hits: () => aoeHits(1.2, 'avg'),   // 函数：自动查表
    decayMult: 1.0,
    mechCoef: 1.0,
  },

  lightning: {
    name: '闪电链',
    type: 'burst',
    cd: 4,
    mechDesc: '3链, 每跳衰减10%, 自动瞄准+10%',
    hits: 1,
    decayMult: 1 + 0.9 + 0.81,        // 3链衰减总和
    mechCoef: 1.1,                      // 自动瞄准加成
  },

  missile: {
    name: '穿甲弹',
    type: 'burst',
    cd: 8,
    mechDesc: '5穿, 每穿衰减20%, 单列限制×0.7',
    hits: 1,
    decayMult: 1 + 0.8 + 0.64 + 0.51 + 0.41,  // 5穿衰减总和
    mechCoef: 0.7,                      // 单列位置限制
  },

  meteor: {
    name: '轰炸机',
    type: 'burst',
    cd: 12,
    mechDesc: '4弹×每弹0.5列AOE',
    hits: 4,
    decayMult: () => aoeHits(0.5, 'avg'),  // 每弹命中数
    mechCoef: 1.0,
  },

  blizzard: {
    name: '白磷弹',
    type: 'sustain',
    cd: 8,
    mechDesc: 'DOT区域0.6列, 持续5s, tick 0.5s',
    duration: 5,
    tickInterval: 0.5,
    hits: () => aoeHits(0.6, 'avg'),    // DOT区域命中
    mechCoef: 0.35,                     // DOT效率（非满命中）
  },

  ionBeam: {
    name: '离子射线',
    type: 'sustain',
    cd: 7,
    mechDesc: '持续2s射击, 单目标, 标记叠伤+30%',
    duration: 2,
    hits: 1,
    decayMult: 1.0,
    mechCoef: 1.3,                      // 标记增伤
    // 占用率自动算: duration/cd
  },

  spinBlade: {
    name: '回旋刃',
    type: 'sustain',
    cd: 10,
    mechDesc: '存活5s, tick 0.2s, 每tick命中1.5个',
    duration: 5,
    tickInterval: 0.2,
    hits: 1.5,                          // 每tick命中数
    mechCoef: 0.1,                      // 弹墙不稳定系数
  },

  drone: {
    name: '无人机',
    type: 'sustain',
    cd: 0.5,
    mechDesc: '常驻2台, 每0.5s打1目标',
    hits: 2,                            // 2台无人机
    decayMult: 1.0,
    mechCoef: 1.0,
    isPermanent: true,                  // 常驻型
  },

  frostStorm: {
    name: '寒冰发生器',
    type: 'special',
    cd: 10,
    mechDesc: '2墙, 被动碰撞, 墙HP=basePct×baseAtk',
    fixedBasePct: 12.0,                 // 特殊机制，手动指定
    note: '墙HP型，DPS取决于砖块碰撞频率',
  },

  gravityWell: {
    name: '奇点引擎',
    type: 'special',
    cd: 14,
    mechDesc: '5s持续, %HP伤害+引力吸引',
    fixedBasePct: 12.0,
    note: '%HP+引力场，特殊机制',
  },
};

// ═══════════════════════════════════════════
// 计算引擎
// ═══════════════════════════════════════════
function resolveVal(v) { return typeof v === 'function' ? v() : v; }

function calcWeapon(key, w) {
  const result = { key, name: w.name, cd: w.cd, type: w.type, mechDesc: w.mechDesc };

  if (w.type === 'special') {
    result.basePct = w.fixedBasePct;
    result.effMult = null;
    result.verifyDPS = null;
    result.note = w.note;
    return result;
  }

  const hits = resolveVal(w.hits);
  
  if (w.type === 'sustain' && !w.isPermanent) {
    // 持续型: 有效倍率 = tickCount × hitsPerTick × mechCoef × 占用率
    const duration = w.duration || 1;
    const tickInterval = w.tickInterval || (duration); // 默认1次
    const tickCount = Math.round(duration / tickInterval);
    const occupancy = duration / w.cd;
    
    if (w.tickInterval) {
      // tick型持续
      result.effMult = tickCount * hits * w.mechCoef;
    } else {
      // 射击型持续（如离子射线）
      result.effMult = hits * (w.decayMult || 1) * w.mechCoef * occupancy;
    }
    result.occupancy = occupancy;
    result.tickCount = tickCount;
  } else {
    // 瞬发型 / 常驻型
    const decay = resolveVal(w.decayMult || 1);
    result.effMult = hits * decay * w.mechCoef;
  }

  result.basePct = Math.round(GLOBAL.targetDPS * w.cd / result.effMult * 10) / 10;
  // 取整规则
  if (result.basePct >= 10) result.basePct = Math.round(result.basePct);
  else if (result.basePct >= 2) result.basePct = Math.round(result.basePct * 2) / 2;

  result.verifyDPS = result.basePct * result.effMult / w.cd;
  return result;
}

// ═══════════════════════════════════════════
// 主逻辑
// ═══════════════════════════════════════════
const args = process.argv.slice(2);
const doWrite = args.includes('--write');

if (args.includes('--help')) {
  console.log('武器数值平衡计算器');
  console.log('  node tools/balance-calc.js          显示对比表');
  console.log('  node tools/balance-calc.js --write   计算并写入配置');
  console.log('  node tools/balance-calc.js --help    帮助');
  process.exit(0);
}

// 计算所有武器
const results = {};
for (const [k, w] of Object.entries(WEAPONS)) {
  results[k] = calcWeapon(k, w);
}

// 读取当前配置对比
const configPath = path.resolve(__dirname, '../src/config/WeaponBalanceConfig.js');
let currentConfig;
try {
  delete require.cache[require.resolve(configPath)];
  currentConfig = require(configPath);
} catch (e) {
  currentConfig = null;
}

// ── 输出表格 ──
console.log('');
console.log('╔═══════════════════════════════════════════════════════════════════╗');
console.log('║  武器数值平衡计算器  │  目标DPS: ' + GLOBAL.targetDPS + '  │  列宽: ' + GLOBAL.colWidth.toFixed(0) + 'px          ║');
console.log('╚═══════════════════════════════════════════════════════════════════╝');
console.log('');
console.log('武器        │ CD    │ 有效倍率 │ 模型basePct │ 当前值  │ 验证DPS │ 状态');
console.log('───────────┼───────┼─────────┼────────────┼────────┼────────┼─────');

for (const [k, r] of Object.entries(results)) {
  const cur = currentConfig ? (currentConfig[k] ? currentConfig[k].basePct : '?') : '?';
  const eff = r.effMult !== null ? r.effMult.toFixed(2).padStart(6) : '  特殊';
  const dps = r.verifyDPS !== null ? r.verifyDPS.toFixed(2).padStart(5) : '   - ';
  const diff = (cur !== '?' && r.verifyDPS !== null) ? Math.abs(cur - r.basePct) / r.basePct : 0;
  const status = r.type === 'special' ? '🔧手动' : (diff < 0.01 ? '✅一致' : diff < 0.2 ? '⚠️偏差' : '🔴差距大');
  
  console.log(
    r.name.padEnd(8) + '  │ ' + (r.cd + 's').padStart(5) + ' │' + eff + '  │ ' +
    String(r.basePct).padStart(8) + '    │ ' + String(cur).padStart(6) + ' │' + dps + '  │ ' + status
  );
}

console.log('');

// AOE对照表
console.log('── AOE命中对照表（列宽=' + GLOBAL.colWidth.toFixed(0) + 'px, 砖高=' + GLOBAL.brickHeight + 'px）──');
console.log('半径  │ 密集  │ 常规  │ 均值');
for (const r of [0.5, 0.8, 1.0, 1.2, 1.5, 2.0, 2.5, 3.0]) {
  const d = aoeHits(r, 'dense'), n = aoeHits(r, 'normal'), a = aoeHits(r, 'avg');
  const mark = r === 1.2 ? ' ⭐寒冰弹' : r === 0.5 ? ' 轰炸机弹' : '';
  console.log(r.toFixed(1).padStart(4) + '列 │ ' + String(d).padStart(4) + '  │ ' + String(n).padStart(4) + '  │ ' + String(a).padStart(4) + mark);
}

// ── 写入配置 ──
if (doWrite) {
  console.log('');
  let config = fs.readFileSync(configPath, 'utf8');
  let changed = 0;
  
  for (const [k, r] of Object.entries(results)) {
    if (!currentConfig || !currentConfig[k]) continue;
    const cur = currentConfig[k].basePct;
    if (Math.abs(cur - r.basePct) > 0.001) {
      // 替换 basePct 值
      const regex = new RegExp('(// =+.*' + '\\n\\s+' + k.replace(/([A-Z])/g, (m) => m) + '[\\s\\S]*?basePct:\\s*)([\\d.]+)');
      // 简单方案：直接替换 "basePct: <old>"
      const oldStr = 'basePct: ' + cur + ',';
      const newStr = 'basePct: ' + r.basePct + ',';
      
      // 需要精确匹配到武器section，避免误替换
      // 找到该武器注释行后的第一个basePct
      const sectionNames = {
        kunai: '寒冰弹', lightning: '闪电链', missile: '穿甲弹', meteor: '轰炸机',
        blizzard: '白磷弹', ionBeam: '离子射线', spinBlade: '回旋刃', drone: '无人机',
        frostStorm: '寒冰发生器', gravityWell: '奇点引擎',
      };
      const sn = sectionNames[k] || k;
      const sectionIdx = config.indexOf(sn);
      if (sectionIdx >= 0) {
        const afterSection = config.indexOf('basePct:', sectionIdx);
        if (afterSection >= 0) {
          const lineEnd = config.indexOf(',', afterSection);
          const oldLine = config.substring(afterSection, lineEnd);
          config = config.substring(0, afterSection) + 'basePct: ' + r.basePct + config.substring(lineEnd);
          console.log('  ✏️  ' + r.name + ': ' + cur + ' → ' + r.basePct);
          changed++;
        }
      }
    }
  }
  
  if (changed > 0) {
    fs.writeFileSync(configPath, config);
    console.log('');
    console.log('✅ 已写入 ' + changed + ' 个武器的basePct到 WeaponBalanceConfig.js');
  } else {
    console.log('✅ 所有值已一致，无需写入');
  }
}

if (!doWrite) {
  console.log('');
  console.log('💡 使用 --write 参数可自动写入配置文件');
}
