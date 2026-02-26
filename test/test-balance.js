/**
 * test-balance.js - 数值平衡分析
 * 输出各章节/武器的理论数据
 */
require('./wx-mock');

const Config = require('../src/Config');
const ChapterConfig = require('../src/ChapterConfig');
const WEAPON_TREES = require('../src/config/WeaponDefs');
const SHIP_TREE = require('../src/config/ShipDefs');
const ExpSystem = require('../src/systems/ExpSystem');
const BrickFactory = require('../src/BrickFactory');

function section(name) { console.log(`\n${'='.repeat(50)}\n${name}\n${'='.repeat(50)}`); }

// ========== 1. 章节难度曲线 ==========
section('📊 章节难度曲线 (关键节点)');

console.log('章节 | baseHP | chScale | 实际HP范围 | scrollSpd | spawnInt | bossHP倍率 | Boss类型');
console.log('-----|--------|---------|-----------|-----------|---------|-----------|--------');

const keyChapters = [1, 2, 3, 5, 10, 15, 20, 30, 40, 50, 60, 75, 100];
for (const ch of keyChapters) {
  const cfg = ChapterConfig.get(ch);
  // sprint 阶段（最难）的HP范围
  const sprintPhase = ChapterConfig._getTimeline(ch).find(p => p.phase === 'sprint');
  const minHP = BrickFactory.calcHP(cfg, sprintPhase.timeCurve, 'normal', false);
  const maxHP = BrickFactory.calcHP(cfg, [sprintPhase.timeCurve[1], sprintPhase.timeCurve[1]], 'normal', false);
  console.log(
    `  ${String(ch).padStart(3)} | ${cfg.baseHP.toFixed(1).padStart(6)} | ${cfg.chapterScale.toFixed(2).padStart(7)} | ` +
    `${String(minHP).padStart(4)}-${String(maxHP).padStart(4)} | ` +
    `${cfg.scrollSpeed.toFixed(3).padStart(9)} | ${String(cfg.spawnInterval).padStart(7)} | ` +
    `${cfg.bossHpMultiplier.toFixed(1).padStart(9)} | ${cfg.bossType}`
  );
}

// ========== 2. Boss HP 绝对值 ==========
section('📊 Boss HP 绝对值');

console.log('章节 | Boss类型  | HP倍率 | baseHP[0] | 实际HP估算');
console.log('-----|----------|--------|-----------|----------');

for (const ch of [1, 5, 10, 20, 30, 50, 75, 100]) {
  const cfg = ChapterConfig.get(ch);
  const bossBaseHP = Config.BOSS_BASE_HP[Math.min(cfg.bossCycle, Config.BOSS_BASE_HP.length - 1)];
  const actualHP = Math.floor(bossBaseHP * cfg.bossHpMultiplier);
  console.log(
    `  ${String(ch).padStart(3)} | ${cfg.bossType.padEnd(8)} | ${cfg.bossHpMultiplier.toFixed(1).padStart(6)} | ` +
    `${String(bossBaseHP).padStart(9)} | ${String(actualHP).padStart(9)}`
  );
}

// ========== 3. 经验升级曲线 ==========
section('📊 经验升级曲线');

const expSys = new ExpSystem();
console.log('等级 | 升级所需EXP | 累计EXP | 假设每分钟40exp→所需分钟');
console.log('-----|-----------|---------|------------------------');

let cumExp = 0;
for (let lv = 1; lv <= 25; lv++) {
  const needed = 80 + (lv - 1) * 50 + (lv - 1) * (lv - 1) * 5;
  cumExp += needed;
  const minutes = (cumExp / 40).toFixed(1);
  console.log(`  ${String(lv).padStart(3)} | ${String(needed).padStart(9)} | ${String(cumExp).padStart(7)} | ${minutes.padStart(10)} min`);
}

// ========== 4. 武器理论 DPS ==========
section('📊 武器理论 DPS (baseAttack=10, 满分支)');

console.log('武器名 | basePct | interval(ms) | 基础DPS | 满级DPS(估) | 解锁章节');
console.log('-------|--------|-------------|--------|-----------|--------');

const UNLOCK = { kunai: 1, lightning: 1, missile: 3, meteor: 6, drone: 10, spinBlade: 15, blizzard: 25, ionBeam: 40 };
const baseAttack = 10;

for (const key in WEAPON_TREES) {
  const w = WEAPON_TREES[key];
  const baseDmg = baseAttack * w.basePct;
  const interval = w.interval / 1000;
  const baseDPS = (baseDmg / interval).toFixed(1);
  // 估算满级：damage 分支 max lv * 0.5 倍率 + freq 分支缩短间隔
  const damageBranch = w.branches.damage;
  const freqBranch = w.branches.freq;
  const maxDmg = baseDmg * (1 + (damageBranch ? damageBranch.max * 0.5 : 0));
  const maxInterval = interval * Math.pow(0.8, freqBranch ? freqBranch.max : 0);
  const maxDPS = (maxDmg / maxInterval).toFixed(1);
  console.log(
    `  ${w.name.padEnd(10)} | ${String(w.basePct).padStart(6)} | ${String(w.interval).padStart(11)} | ` +
    `${baseDPS.padStart(6)} | ${maxDPS.padStart(9)} | ${String(UNLOCK[key] || '?').padStart(6)}`
  );
}

// ========== 5. 飞机升级树分析 ==========
section('📊 飞机升级树');

console.log('分支名 | 最大等级 | 品质 | 互斥组 | 前置要求');
console.log('-------|--------|------|--------|--------');

for (const key in SHIP_TREE) {
  const s = SHIP_TREE[key];
  const requires = s.requires ? Object.entries(s.requires).map(([k, v]) => `${k}>=${v}`).join(',') : '-';
  const excl = s.exclusiveGroup || '-';
  console.log(
    `  ${(s.name || key).padEnd(12)} | ${String(s.max).padStart(6)} | ${(s.quality || 'normal').padStart(9)} | ${excl.padEnd(10)} | ${requires}`
  );
}

// ========== 6. 子弹DPS（飞机升级影响） ==========
section('📊 飞机子弹DPS (baseAttack=10, 默认射速400ms)');

console.log('攻击等级 | 射速等级 | 散射数 | 弹道数 | 单弹伤害 | 射击间隔(ms) | 理论DPS');
console.log('---------|---------|--------|--------|---------|-------------|--------');

for (let atkLv = 0; atkLv <= 4; atkLv++) {
  for (let frLv = 0; frLv <= 4; frLv++) {
    if (atkLv + frLv > 6) continue; // 不太可能同时满
    const atkMult = 1.0 + atkLv * 0.5;
    const frMult = 1.0 + frLv * 0.5;
    const dmg = baseAttack * 1.0 * atkMult;
    const interval = Math.max(80, 400 * (1 - (1 - 1 / frMult)));
    const spreadBonus = Math.min(atkLv, 3); // 假设散射=攻击等级（简化）
    const bulletCount = 1 + 0; // 基础散射独立
    const dps = (dmg * bulletCount / (interval / 1000)).toFixed(1);
    if (frLv === 0 || atkLv === 0) {
      console.log(
        `    ${String(atkLv).padStart(4)}    |    ${String(frLv).padStart(2)}   |    ${String(0).padStart(2)}  |    ${String(bulletCount).padStart(2)}  | ` +
        `${dmg.toFixed(1).padStart(7)} | ${interval.toFixed(0).padStart(11)} | ${dps.padStart(7)}`
      );
    }
  }
}

// ========== 7. 难度跨度分析 ==========
section('📊 难度跨度对比: 玩家DPS vs 砖块HP增速');

console.log('章节 | 砖块HP(sprint均值) | 玩家基础DPS(10atk) | HP/DPS比(秒/砖) | 难度评级');
console.log('-----|-------------------|-------------------|----------------|--------');

const playerBaseDPS = baseAttack / 0.4; // 400ms 一发

for (const ch of [1, 5, 10, 20, 30, 50, 75, 100]) {
  const cfg = ChapterConfig.get(ch);
  const sprint = ChapterConfig._getTimeline(ch).find(p => p.phase === 'sprint');
  const avgTC = (sprint.timeCurve[0] + sprint.timeCurve[1]) / 2;
  const avgHP = Math.ceil(cfg.baseHP * cfg.chapterScale * avgTC);
  const ratio = (avgHP / playerBaseDPS).toFixed(2);
  let difficulty;
  if (ratio < 1) difficulty = '🟢 简单';
  else if (ratio < 3) difficulty = '🟡 适中';
  else if (ratio < 8) difficulty = '🟠 困难';
  else difficulty = '🔴 极难';
  console.log(
    `  ${String(ch).padStart(3)} | ${String(avgHP).padStart(17)} | ${playerBaseDPS.toFixed(1).padStart(17)} | ${ratio.padStart(14)} | ${difficulty}`
  );
}

// ========== 8. 砖块类型解锁时间线 ==========
section('📊 砖块类型解锁时间线');

const unlockMap = { normal: 1, fast: 1, formation: 1, shield: 2, split: 3, stealth: 5, healer: 8 };
for (const [type, ch] of Object.entries(unlockMap)) {
  console.log(`  第${String(ch).padStart(2)}章 → ${type}`);
}

// ========== 9. 掉落概率分析 ==========
section('📊 掉落物概率');

console.log(`  金币掉率: ${(Config.COIN_DROP_CHANCE * 100).toFixed(0)}%`);
console.log(`  技能宝箱掉率: ${(Config.SKILL_CRATE_CHANCE * 100).toFixed(1)}% (冷却 ${Config.SKILL_CRATE_COOLDOWN / 1000}s)`);
console.log(`  章节时长: ${Config.CHAPTER_DURATION / 1000}s = ${Config.CHAPTER_DURATION / 60000}min`);

// 预计每局宝箱数
const chapterSec = Config.CHAPTER_DURATION / 1000;
const avgBrickPerSec = 3; // 估算
const totalBricks = chapterSec * avgBrickPerSec;
const maxCrates = Math.floor(chapterSec / (Config.SKILL_CRATE_COOLDOWN / 1000));
const expectedCrates = Math.min(maxCrates, totalBricks * Config.SKILL_CRATE_CHANCE).toFixed(1);
console.log(`  估算每局砖块总数: ~${totalBricks}`);
console.log(`  宝箱冷却限制上限: ${maxCrates}个`);
console.log(`  预计每局宝箱数: ~${expectedCrates}个`);

console.log('\n✅ 数值分析完成');
