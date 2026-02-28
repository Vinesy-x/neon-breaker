#!/usr/bin/env node
/**
 * dps-sim.js - 武器DPS模拟器
 * 
 * 用法：
 *   node tools/dps-sim.js                    → 所有武器，推荐点法
 *   node tools/dps-sim.js kunai              → 指定武器
 *   node tools/dps-sim.js kunai --plan burst → 指定武器+点法风格
 *   node tools/dps-sim.js --all              → 所有武器所有点法对比
 * 
 * 每个分支效果建模为DPS乘区，模拟逐级点亮后的DPS成长
 */

// ═══════════════════════════════════════
// 分支效果建模（每个分支对DPS的影响）
// 效果类型：
//   additive: 加到同一乘区（如damage每级+0.5→累加后×basePct）
//   multiply: 独立乘区（直接×总DPS）
//   hits:     改变命中数（影响DPS公式中的有效命中）
// ═══════════════════════════════════════

const WEAPON_MODELS = {
  kunai: {
    name: '寒冰弹', cd: 6, baseHits: 5,
    branches: {
      damage:      { max: 10, zone: 'A', perLevel: 0.50, desc: '+50%伤害/级' },
      count:       { max: 3,  zone: 'B', type: 'bullets', perLevel: 1, penalty: -0.20, desc: '+1弹-20%伤/级' },
      aoe:         { max: 3,  zone: 'C', type: 'aoeRadius', perLevel: 0.30, desc: '+30%半径→命中数²增长' },
      pierce:      { max: 2,  zone: 'D', type: 'multiply', perLevel: 0.10, desc: '穿透+衰减,约+10%DPS/级' },
      pierceBlast: { max: 1,  zone: 'D', type: 'multiply', perLevel: 0.80, desc: '穿透都爆→+80%DPS', req: { pierce: 2 } },
      chain:       { max: 2,  zone: 'D', type: 'multiply', perLevel: 0.25, desc: '连锁爆炸+25%DPS/级' },
      splitBomb:   { max: 3,  zone: 'D', type: 'multiply', perLevel: 0.20, desc: '分裂弹+20%DPS/级' },
      giant:       { max: 1,  zone: 'C', type: 'aoeRadius', perLevel: 1.00, desc: '范围翻倍→命中数~4x' },
    },
  },

  lightning: {
    name: '闪电链', cd: 4, baseHits: 2.98,
    branches: {
      damage:   { max: 10, zone: 'A', perLevel: 0.50, desc: '+50%伤害/级' },
      chains:   { max: 4,  zone: 'C', type: 'multiply', perLevel: 0.28, desc: '+1链(含衰减)≈+28%DPS/级' },
      charge:   { max: 2,  zone: 'D', type: 'multiply', perLevel: 0.25, desc: '链跳增伤+25%DPS/级', req: { chains: 2 } },
      shock:    { max: 2,  zone: 'D', type: 'multiply', perLevel: 0.15, desc: 'DOT+15%DPS/级', req: { damage: 2 } },
      echo:     { max: 2,  zone: 'D', type: 'multiply', perLevel: 0.20, desc: '末端重释放+20%DPS/级', req: { chains: 3 } },
      paralyze: { max: 2,  zone: 'D', type: 'multiply', perLevel: 0.05, desc: '减速(辅助)+5%/级', req: { chains: 2 } },
      storm:    { max: 2,  zone: 'B', type: 'bullets', perLevel: 1, penalty: 0, desc: '+1道闪电(无惩罚)' },
      overload: { max: 1,  zone: 'D', type: 'multiply', perLevel: 0.40, desc: '末端AOE+40%DPS', req: { chains: 4, damage: 3 } },
    },
  },

  missile: {
    name: '穿甲弹', cd: 8, baseHits: 2.35,
    branches: {
      damage:        { max: 10, zone: 'A', perLevel: 0.50, desc: '+50%伤害/级' },
      pierce:        { max: 2,  zone: 'D', type: 'multiply', perLevel: 0.15, desc: '衰减降低+15%DPS/级' },
      salvo:         { max: 3,  zone: 'B', type: 'bullets', perLevel: 1, penalty: 0, desc: '+1连射(无惩罚)' },
      dotExploit:    { max: 3,  zone: 'D', type: 'multiply', perLevel: 0.15, desc: 'DOT增伤+15%/级', req: { damage: 2 } },
      twinCannon:    { max: 2,  zone: 'B', type: 'bullets', perLevel: 1, penalty: 0, desc: '+1管(双管)', req: { salvo: 2 } },
      shockwave:     { max: 2,  zone: 'D', type: 'multiply', perLevel: 0.25, desc: '溅射+25%DPS/级', req: { damage: 2, pierce: 1 } },
      deepPierce:    { max: 2,  zone: 'D', type: 'multiply', perLevel: 0.20, desc: '深穿+20%DPS/级' },
      hyperVelocity: { max: 1,  zone: 'D', type: 'multiply', perLevel: 0.50, desc: '穿透增伤+50%DPS', },
      twinCannonAdv: { max: 1,  zone: 'D', type: 'multiply', perLevel: 0.30, desc: '双管瞄准+30%DPS' },
    },
  },

  meteor: {
    name: '轰炸机', cd: 12, baseHits: 4.0,
    branches: {
      damage:     { max: 10, zone: 'A', perLevel: 0.50, desc: '+50%伤害/级' },
      bombs:      { max: 3,  zone: 'B', type: 'bullets', perLevel: 2, penalty: 0, desc: '+2弹/级(无惩罚)' },
      radius:     { max: 3,  zone: 'C', type: 'aoeRadius', perLevel: 0.25, desc: '+25%半径→命中²' },
      napalm:     { max: 2,  zone: 'D', type: 'multiply', perLevel: 0.30, desc: '燃烧DOT+30%DPS/级', req: { damage: 2 } },
      carpet:     { max: 2,  zone: 'D', type: 'multiply', perLevel: 0.20, desc: '扩宽+20%DPS/级', req: { bombs: 2 } },
      escort:     { max: 2,  zone: 'B', type: 'bullets', perLevel: 4, penalty: 0, desc: '+1僚机(+4弹)' },
      incendiary: { max: 1,  zone: 'D', type: 'multiply', perLevel: 0.50, desc: '燃烧增强+50%DPS' },
      b52:        { max: 1,  zone: 'D', type: 'multiply', perLevel: 1.00, desc: '弹数×2+范围×1.5→约+100%DPS' },
    },
  },

  drone: {
    name: '无人机', cd: 0.5, baseHits: 2.0,
    branches: {
      damage:     { max: 10, zone: 'A', perLevel: 0.50, desc: '+50%伤害/级' },
      count:      { max: 3,  zone: 'B', type: 'bullets', perLevel: 1, penalty: 0, desc: '+1台无人机' },
      width:      { max: 2,  zone: 'D', type: 'multiply', perLevel: 0.20, desc: '激光变粗+20%DPS/级', req: { damage: 2 } },
      deploy:     { max: 2,  zone: 'D', type: 'multiply', perLevel: 0.10, desc: '阵型优化+10%/级', req: { count: 1 } },
      overcharge: { max: 1,  zone: 'D', type: 'multiply', perLevel: 0.50, desc: '交叉增伤+50%', req: { count: 2, damage: 3 } },
      arc:        { max: 2,  zone: 'D', type: 'multiply', perLevel: 0.20, desc: '电弧扩散+20%/级' },
      focus:      { max: 2,  zone: 'D', type: 'multiply', perLevel: 0.25, desc: '聚焦低HP+25%/级' },
      pulse:      { max: 1,  zone: 'D', type: 'multiply', perLevel: 0.30, desc: 'AOE脉冲+30%DPS' },
    },
  },

  spinBlade: {
    name: '回旋刃', cd: 10, baseHits: 3.75,
    branches: {
      damage:    { max: 10, zone: 'A', perLevel: 0.50, desc: '+50%伤害/级' },
      duration:  { max: 3,  zone: 'D', type: 'multiply', perLevel: 0.40, desc: '+2秒(+40%存活→+40%DPS)' },
      giant:     { max: 3,  zone: 'D', type: 'multiply', perLevel: 0.25, desc: '变大+25%命中/级' },
      pierce:    { max: 1,  zone: 'D', type: 'multiply', perLevel: 0.30, desc: '贯穿+30%', req: { damage: 2 } },
      shockwave: { max: 2,  zone: 'D', type: 'multiply', perLevel: 0.20, desc: '弹墙刀气+20%/级', req: { damage: 2 } },
      ramp:      { max: 3,  zone: 'D', type: 'multiply', perLevel: 0.15, desc: '递增伤害+15%/级', req: { duration: 2 } },
      bleed:     { max: 2,  zone: 'D', type: 'multiply', perLevel: 0.15, desc: '流血DOT+15%/级' },
      split:     { max: 2,  zone: 'D', type: 'multiply', perLevel: 0.20, desc: '分裂+20%/级' },
      superBlade:{ max: 1,  zone: 'D', type: 'multiply', perLevel: 0.50, desc: '频率翻倍+50%DPS' },
    },
  },

  blizzard: {
    name: '白磷弹', cd: 8, baseHits: 7.0,
    branches: {
      damage:     { max: 10, zone: 'A', perLevel: 0.50, desc: '+50%伤害/级' },
      radius:     { max: 3,  zone: 'C', type: 'aoeRadius', perLevel: 0.25, desc: '+25%范围→命中²' },
      duration:   { max: 3,  zone: 'D', type: 'multiply', perLevel: 0.30, desc: '+30%持续时间/级' },
      count:      { max: 2,  zone: 'B', type: 'bullets', perLevel: 1, penalty: 0, desc: '+1发白磷弹' },
      frostbite:  { max: 2,  zone: 'D', type: 'multiply', perLevel: 0.15, desc: 'DOT+15%/级', req: { damage: 2 } },
      slow:       { max: 3,  zone: 'D', type: 'multiply', perLevel: 0.05, desc: '减速(辅助)+5%/级' },
      shatter:    { max: 2,  zone: 'D', type: 'multiply', perLevel: 0.25, desc: '蔓延+爆燃+25%/级' },
      permafrost: { max: 1,  zone: 'D', type: 'multiply', perLevel: 0.20, desc: '频率提升+20%DPS' },
    },
  },

  ionBeam: {
    name: '离子射线', cd: 7, baseHits: 0.37,
    branches: {
      damage:   { max: 10, zone: 'A', perLevel: 0.50, desc: '+50%伤害/级' },
      duration: { max: 3,  zone: 'D', type: 'multiply', perLevel: 0.35, desc: '+1秒射击→+35%DPS/级' },
      mark:     { max: 3,  zone: 'D', type: 'multiply', perLevel: 0.20, desc: '标记叠伤+20%DPS/级', req: { damage: 1 } },
      pierce:   { max: 2,  zone: 'D', type: 'multiply', perLevel: 0.30, desc: '穿透+30%DPS/级', req: { damage: 2 } },
      split:    { max: 2,  zone: 'D', type: 'multiply', perLevel: 0.25, desc: '溅射+25%DPS/级', req: { duration: 1 } },
      overload: { max: 2,  zone: 'D', type: 'multiply', perLevel: 0.35, desc: '结束AOE+35%DPS/级', req: { damage: 3, duration: 2 } },
      charge:   { max: 2,  zone: 'D', type: 'multiply', perLevel: 0.30, desc: '首击爆发+30%DPS/级' },
      superOrb: { max: 2,  zone: 'D', type: 'multiply', perLevel: 0.25, desc: '超级离子球+25%/级' },
      prism:    { max: 2,  zone: 'D', type: 'multiply', perLevel: 0.30, desc: '射线分叉+30%/级' },
    },
  },

  frostStorm: {
    name: '寒冰发生器', cd: 10, baseHits: 1,
    branches: {
      damage:     { max: 10, zone: 'A', perLevel: 0.50, desc: '+50%墙HP/级' },
      freeze:     { max: 2,  zone: 'D', type: 'multiply', perLevel: 0.20, desc: '叠冰缓+20%控制价值/级' },
      count:      { max: 2,  zone: 'B', type: 'bullets', perLevel: 1, penalty: 0, desc: '+1面墙' },
      frostArmor: { max: 3,  zone: 'D', type: 'multiply', perLevel: 0.30, desc: '碰撞增伤+30%/级', req: { freeze: 1 } },
      aura:       { max: 2,  zone: 'D', type: 'multiply', perLevel: 0.15, desc: '光环叠冰+15%/级', req: { freeze: 2 } },
      stack:      { max: 2,  zone: 'D', type: 'multiply', perLevel: 0.20, desc: '叠加上限+脉冲+20%/级' },
      permafrost: { max: 2,  zone: 'D', type: 'multiply', perLevel: 0.25, desc: '冻结+25%控制/级' },
      shatter:    { max: 2,  zone: 'D', type: 'multiply', perLevel: 0.35, desc: '碎裂AOE+35%DPS/级' },
    },
  },

  gravityWell: {
    name: '奇点引擎', cd: 14, baseHits: 1,
    branches: {
      damage:      { max: 10, zone: 'A', perLevel: 0.20, desc: '吸力+20%/级(弱于其他)' },
      horizon:     { max: 2,  zone: 'D', type: 'multiply', perLevel: 0.40, desc: '事件视界+40%DPS/级', req: { damage: 2 } },
      singularity: { max: 2,  zone: 'D', type: 'multiply', perLevel: 0.35, desc: '持续+中心增伤+35%/级', req: { horizon: 1 } },
      negaEnergy:  { max: 3,  zone: 'D', type: 'multiply', perLevel: 0.20, desc: '负能量转化+20%/级' },
      count:       { max: 2,  zone: 'B', type: 'bullets', perLevel: 1, penalty: 0, desc: '+1个黑洞' },
      darkMatter:  { max: 2,  zone: 'D', type: 'multiply', perLevel: 0.15, desc: '暗物质增强+15%/级' },
      annihilate:  { max: 2,  zone: 'D', type: 'multiply', perLevel: 0.20, desc: '湮灭冲击+20%/级' },
      lens:        { max: 2,  zone: 'D', type: 'multiply', perLevel: 0.12, desc: '引力透镜+12%/级' },
    },
  },
};

// ═══════════════════════════════════════
// 点法策略（指定每级点哪个分支）
// ═══════════════════════════════════════

function generatePlan(wk, style) {
  const model = WEAPON_MODELS[wk];
  const branches = model.branches;
  const levels = {};
  for (const bk in branches) levels[bk] = 0;
  const plan = [];
  const totalLevels = Object.values(branches).reduce((s, b) => s + b.max, 0);

  // 优先级排序
  function getPriority(bk) {
    const b = branches[bk];
    if (levels[bk] >= b.max) return -1;
    // 检查前置
    if (b.req) {
      for (const rk in b.req) {
        if ((levels[rk] || 0) < b.req[rk]) return -1;
      }
    }
    if (style === 'balanced') {
      // 均衡：damage优先到5，然后各分支轮流
      if (bk === 'damage' && levels[bk] < 5) return 100;
      if (bk === 'damage') return 10;
      return 50 - levels[bk] * 10; // 低等级优先
    } else if (style === 'burst') {
      // 爆发：damage全点→高乘区分支
      if (bk === 'damage') return 100;
      if (b.type === 'multiply' && b.perLevel >= 0.30) return 80;
      if (b.type === 'bullets') return 60;
      return 40;
    } else { // dps（默认）
      // DPS最优：按perLevel/级收益排序
      if (bk === 'damage' && levels[bk] < 3) return 100; // 前3级damage
      var eff = b.perLevel || 0;
      if (b.type === 'bullets') eff = 0.35; // 弹数价值约35%
      if (b.type === 'aoeRadius') eff = b.perLevel * 1.8; // 范围²增长
      return eff * 100;
    }
  }

  for (let i = 0; i < totalLevels; i++) {
    let bestBk = null, bestPri = -2;
    for (const bk in branches) {
      const pri = getPriority(bk);
      if (pri > bestPri) { bestPri = pri; bestBk = bk; }
    }
    if (!bestBk) break;
    levels[bestBk]++;
    plan.push(bestBk);
  }
  return plan;
}

// ═══════════════════════════════════════
// DPS计算引擎
// ═══════════════════════════════════════

function calcDPS(wk, plan) {
  const model = WEAPON_MODELS[wk];
  const B = require('../src/config/WeaponBalanceConfig');
  const basePct = B[wk].basePct;
  const branches = model.branches;
  const results = [];
  const levels = {};
  for (const bk in branches) levels[bk] = 0;

  for (let lv = 0; lv <= plan.length; lv++) {
    // 计算各乘区
    var zoneA = 1.0; // 加法区(damage)
    var zoneB = 1.0; // 弹数区
    var zoneC = 1.0; // 范围/命中区
    var zoneD = 1.0; // 特殊机制乘区

    for (const bk in branches) {
      const b = branches[bk];
      const curLv = levels[bk];
      if (curLv === 0) continue;

      if (b.zone === 'A') {
        zoneA += curLv * b.perLevel;
      } else if (b.type === 'bullets') {
        var baseBullets = (wk === 'drone') ? 2 : (wk === 'meteor') ? 4 : 1;
        var added = curLv * b.perLevel;
        var pen = b.penalty ? Math.max(0.2, 1 + curLv * b.penalty) : 1;
        zoneB = (baseBullets + added) / baseBullets * pen;
      } else if (b.type === 'aoeRadius') {
        // 真实命中数查表（基于屏幕砖块密度）
        // 不用²公式，直接用π×r²/砖块面积×填充率，cap到60
        var rMult = 1 + curLv * b.perLevel;
        zoneC *= rMult; // 先累积半径倍率，最后统一算命中
      } else if (b.zone === 'D' || b.type === 'multiply') {
        zoneD *= (1 + curLv * b.perLevel);
      }
    }

    // zoneC是半径累积倍率，转为真实命中数倍率
    if (zoneC !== 1.0) {
      var baseRadiusCol = (wk === 'meteor') ? 0.5 : (wk === 'blizzard') ? 0.6 : 1.2;
      var realRadius = baseRadiusCol * zoneC;
      var colW = 53, brickH = 20, fillRate = 0.70, maxBricks = 60;
      var rpx = realRadius * colW;
      var realHits = Math.min(Math.round(Math.PI * rpx * rpx / (colW * brickH) * fillRate), maxBricks);
      var baseRpx = baseRadiusCol * colW;
      var baseHits = Math.max(1, Math.min(Math.round(Math.PI * baseRpx * baseRpx / (colW * brickH) * fillRate), maxBricks));
      zoneC = realHits / baseHits;
    }
    var totalMult = zoneA * zoneB * zoneC * zoneD;
    var dps = basePct * totalMult * model.baseHits / model.cd;

    results.push({
      lv, totalMult,
      zones: { A: zoneA, B: zoneB, C: zoneC, D: zoneD },
      dps,
      branch: lv > 0 ? plan[lv - 1] : '-',
    });

    // 点下一级
    if (lv < plan.length) levels[plan[lv]]++;
  }
  return results;
}

// ═══════════════════════════════════════
// 主逻辑
// ═══════════════════════════════════════

const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
const flags = process.argv.slice(2).filter(a => a.startsWith('--'));
const style = flags.includes('--burst') ? 'burst' : flags.includes('--balanced') ? 'balanced' : 'dps';
const showAll = flags.includes('--all');

const weaponKeys = args.length > 0 ? args : Object.keys(WEAPON_MODELS);

for (const wk of weaponKeys) {
  if (!WEAPON_MODELS[wk]) { console.log('Unknown weapon: ' + wk); continue; }
  const model = WEAPON_MODELS[wk];
  const styles = showAll ? ['dps', 'burst', 'balanced'] : [style];

  for (const st of styles) {
    const plan = generatePlan(wk, st);
    const results = calcDPS(wk, plan);

    console.log('');
    console.log('━━━ ' + model.name + ' (' + wk + ') │ 点法: ' + st + ' │ 总级数: ' + plan.length + ' ━━━');
    console.log(' Lv │ 倍率    │ DPS    │ A(伤害) │ B(弹数) │ C(范围) │ D(特殊) │ 点了');
    console.log('────┼────────┼───────┼────────┼────────┼────────┼────────┼─────');

    for (const r of results) {
      if (r.lv > 25) break; // 最多显示25级
      if (r.lv > 0 && r.lv < results.length - 1 && r.lv % 5 !== 0 && r.lv !== 1 && r.lv !== 10) continue;
      console.log(
        String(r.lv).padStart(3) + ' │ ' +
        r.totalMult.toFixed(1).padStart(5) + 'x │ ' +
        r.dps.toFixed(1).padStart(5) + ' │ ' +
        r.zones.A.toFixed(1).padStart(5) + 'x │ ' +
        r.zones.B.toFixed(1).padStart(5) + 'x │ ' +
        r.zones.C.toFixed(1).padStart(5) + 'x │ ' +
        r.zones.D.toFixed(1).padStart(5) + 'x │ ' +
        r.branch
      );
    }
  }
}

// 汇总对比
if (weaponKeys.length > 1) {
  console.log('');
  console.log('═══ 各武器DPS里程碑对比（' + style + '点法）═══');
  console.log('武器        │ Lv0   │ Lv5   │ Lv10  │ Lv15  │ Lv20  │ Lv25');
  console.log('───────────┼───────┼───────┼───────┼───────┼───────┼──────');
  for (const wk of weaponKeys) {
    const plan = generatePlan(wk, style);
    const results = calcDPS(wk, plan);
    const milestones = [0, 5, 10, 15, 20, 25].map(lv => {
      const r = results[Math.min(lv, results.length - 1)];
      return r ? r.dps.toFixed(1).padStart(5) : '  -  ';
    });
    console.log(WEAPON_MODELS[wk].name.padEnd(8) + '   │ ' + milestones.join(' │ '));
  }
}
