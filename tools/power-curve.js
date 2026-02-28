#!/usr/bin/env node
/**
 * power-curve.js - 武器等级成长曲线计算器
 * 
 * 用法：
 *   node tools/power-curve.js                → 显示默认曲线
 *   node tools/power-curve.js --max 8 --cap 25  → 自定义最终倍率和满级
 *   node tools/power-curve.js --write        → 写入配置文件
 * 
 * 设计原则：
 *   Lv0 = 100%（basePct就是Lv0输出）
 *   每级选一个分支 → 获得一次成长
 *   曲线递减：前期涨得快，后期收益递减
 */

// ═══════════════════════════════════════
// 可调参数
// ═══════════════════════════════════════
const args = process.argv.slice(2);
function getArg(name, def) {
  const i = args.indexOf('--' + name);
  return i >= 0 && args[i + 1] ? Number(args[i + 1]) : def;
}

const MAX_LEVEL = getArg('cap', 20);        // 武器满级（所有分支点满）
const FINAL_MULT = getArg('max', 6.0);      // 满级时总倍率（Lv0=1.0）
const CURVE_POWER = getArg('curve', 0.6);   // 曲线弯曲度（<1递减，=1线性，>1递增）
const doWrite = args.includes('--write');

// ═══════════════════════════════════════
// 曲线计算: mult(lv) = 1 + (FINAL_MULT - 1) * (lv/MAX_LEVEL)^CURVE_POWER
// ═══════════════════════════════════════
function getMultiplier(lv) {
  if (lv <= 0) return 1.0;
  if (lv >= MAX_LEVEL) return FINAL_MULT;
  return 1.0 + (FINAL_MULT - 1.0) * Math.pow(lv / MAX_LEVEL, CURVE_POWER);
}

// 输出表格
console.log('');
console.log('╔════════════════════════════════════════════════════════╗');
console.log('║  武器等级成长曲线  │  满级:Lv' + MAX_LEVEL + '  │  终倍率:' + FINAL_MULT + 'x  │  弯曲:' + CURVE_POWER + '  ║');
console.log('╚════════════════════════════════════════════════════════╝');
console.log('');
console.log(' Lv │ 总倍率  │ 本级增幅 │ 条形图');
console.log('────┼────────┼─────────┼' + '─'.repeat(40));

let prevMult = 1.0;
const table = [];
for (let lv = 0; lv <= MAX_LEVEL; lv++) {
  const mult = getMultiplier(lv);
  const delta = mult - prevMult;
  const deltaPct = lv === 0 ? '  base' : ('+' + (delta * 100).toFixed(0) + '%').padStart(6);
  const bar = '█'.repeat(Math.round(mult / FINAL_MULT * 35));
  const mark = lv === 0 ? ' ← basePct' : lv === 5 ? ' ← 前期结束' : lv === 10 ? ' ← 中期' : lv === 15 ? ' ← 后期开始' : lv === MAX_LEVEL ? ' ← 满级' : '';
  console.log(
    String(lv).padStart(3) + ' │ ' + mult.toFixed(2).padStart(5) + 'x │ ' + deltaPct + '  │ ' + bar + mark
  );
  table.push({ lv, mult: Math.round(mult * 100) / 100, delta: Math.round(delta * 100) / 100 });
  prevMult = mult;
}

// 关键节点汇总
console.log('');
console.log('── 关键节点 ──');
const milestones = [0, 1, 3, 5, 10, 15, MAX_LEVEL];
for (const lv of milestones) {
  if (lv > MAX_LEVEL) continue;
  const m = getMultiplier(lv);
  console.log('  Lv' + String(lv).padStart(2) + ': ' + m.toFixed(2) + 'x (' + (m * 100).toFixed(0) + '%)');
}

// 反推basePct：已知Lv0的DPS=4.0，basePct就是balance-calc算出的值
// 任意等级的实际DPS = 4.0 × mult(lv)
console.log('');
console.log('── 各等级预期DPS（基准DPS=4.0）──');
for (const lv of [0, 1, 3, 5, 10, 15, MAX_LEVEL]) {
  if (lv > MAX_LEVEL) continue;
  const dps = 4.0 * getMultiplier(lv);
  console.log('  Lv' + String(lv).padStart(2) + ': DPS=' + dps.toFixed(1));
}

// 写入配置
if (doWrite) {
  const configPath = require('path').resolve(__dirname, '../src/config/PowerCurveConfig.js');
  let lines = [];
  lines.push('/**');
  lines.push(' * PowerCurveConfig.js - 武器等级成长曲线（纯数据）');
  lines.push(' * ');
  lines.push(' * 由 tools/power-curve.js 生成，勿手动修改');
  lines.push(' * 满级:Lv' + MAX_LEVEL + ' | 终倍率:' + FINAL_MULT + 'x | 曲线弯曲度:' + CURVE_POWER);
  lines.push(' * ');
  lines.push(' * mult(lv) = 1 + ' + (FINAL_MULT - 1) + ' × (lv/' + MAX_LEVEL + ')^' + CURVE_POWER);
  lines.push(' * 用法: const mult = PowerCurve.getMultiplier(weaponLevel);');
  lines.push(' *       const realDmg = basePct × mult × baseAtk;');
  lines.push(' */');
  lines.push('');
  lines.push('const PARAMS = {');
  lines.push('  maxLevel: ' + MAX_LEVEL + ',');
  lines.push('  finalMult: ' + FINAL_MULT + ',');
  lines.push('  curvePower: ' + CURVE_POWER + ',');
  lines.push('};');
  lines.push('');
  lines.push('// 预计算查找表（避免运行时pow）');
  lines.push('const MULT_TABLE = [');
  for (let lv = 0; lv <= MAX_LEVEL; lv++) {
    const m = getMultiplier(lv);
    lines.push('  ' + m.toFixed(3) + ',  // Lv' + lv);
  }
  lines.push('];');
  lines.push('');
  lines.push('function getMultiplier(lv) {');
  lines.push('  if (lv <= 0) return 1.0;');
  lines.push('  if (lv >= ' + MAX_LEVEL + ') return ' + FINAL_MULT + ';');
  lines.push('  return MULT_TABLE[lv] || 1.0;');
  lines.push('}');
  lines.push('');
  lines.push('module.exports = { PARAMS, MULT_TABLE, getMultiplier };');

  require('fs').writeFileSync(configPath, lines.join('\n'));
  console.log('');
  console.log('✅ 已写入 ' + configPath);
}

if (!doWrite) {
  console.log('');
  console.log('💡 使用 --write 写入 PowerCurveConfig.js');
  console.log('💡 使用 --max N 调终倍率，--cap N 调满级，--curve N 调弯曲度');
}
