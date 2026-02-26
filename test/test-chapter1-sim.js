/**
 * test-chapter1-sim.js - 第1章精确战斗模拟
 *
 * 模拟条件：
 * - 商店升级全0（baseAttack=1）
 * - 均匀升级武器和飞机
 * - 第1章，8分钟 + Boss阶段
 *
 * 精确模拟：
 * - 砖块HP严格按 calcHP 公式（每行随机）
 * - 生成间隔按 spawnInterval / (spawnMult × 时间加速)
 * - 子弹逐颗命中最前排砖块
 * - 武器按实际 interval 触发
 * - 经验球→升级→三选一全流程
 */
require('./wx-mock');

const Config = require('../src/Config');
const ChapterConfig = require('../src/ChapterConfig');
const BrickFactory = require('../src/BrickFactory');
const { Brick } = require('../src/Brick');
const ExpSystem = require('../src/systems/ExpSystem');
const UpgradeManager = require('../src/systems/UpgradeManager');

// ===== 配置 =====
const CHAPTER = 1;
const TICK_MS = 50; // 50ms 精度
const BASE_ATTACK = 1; // 商店0级

const chapterConfig = ChapterConfig.get(CHAPTER);
const timeline = ChapterConfig._getTimeline(CHAPTER);

function section(t) { console.log(`\n${'═'.repeat(60)}\n${t}\n${'═'.repeat(60)}`); }

// ===== 初始化 =====
const upgrades = new UpgradeManager(null);
upgrades.setChapter(CHAPTER);
const expSystem = new ExpSystem();

let bricks = [];
let elapsedMs = 0;
let spawnTimer = 0;
let fireTimer = 0;
let lastCrateTime = -Config.SKILL_CRATE_COOLDOWN;
let bossPhase = false;
let bossHP = 0, bossMaxHP = 0;

// 统计
const stats = {
  totalDmg: 0, bulletDmg: 0,
  weaponDmg: {},
  bricksSpawned: 0, bricksDestroyed: 0,
  totalBrickHP: 0,
  expGained: 0, levelUps: 0, skillCrates: 0, coins: 0,
  choices: [],
  snapshots: [],
  phaseLog: [],
};

let lastPhase = null;
let lastSnapshotDmg = 0;
let snapshotTimer = 0;

// ===== 辅助函数 =====

function getPhase(ms) {
  let p = timeline[0];
  for (let i = timeline.length - 1; i >= 0; i--) {
    if (ms >= timeline[i].time) { p = timeline[i]; break; }
  }
  return p;
}

function getBulletDmg() {
  return Math.max(0.1, BASE_ATTACK * upgrades.getAttackMult());
}

function getFireInterval() {
  const frMult = upgrades.getFireRateMult();
  return Math.max(80, Config.BULLET_FIRE_INTERVAL / frMult);
}

function getBulletCount() {
  return 1 + upgrades.getSpreadBonus();
}

/** 武器伤害模拟 — 逐个武器按 interval tick */
const weaponTimers = {};

function tickWeapons(dtMs) {
  const baseAtk = BASE_ATTACK * upgrades.getAttackMult();
  let totalWeaponDmg = 0;

  for (const key in upgrades.weapons) {
    const weapon = upgrades.weapons[key];
    const def = Config.WEAPON_TREES[key];
    if (!weaponTimers[key]) weaponTimers[key] = 0;
    weaponTimers[key] += dtMs;

    // 计算实际间隔（含freq/speed分支）
    let interval = def.interval;
    const freqLv = weapon.getBranch('freq') || weapon.getBranch('speed') || 0;
    if (key === 'meteor') interval *= Math.pow(0.85, freqLv);
    else interval *= Math.pow(0.8, freqLv);

    if (weaponTimers[key] >= interval) {
      weaponTimers[key] -= interval;
      const dmg = weapon.getDamage(baseAtk);
      const countLv = weapon.getBranch('count') || 0;
      const count = 1 + countLv;

      // 闪电链特殊：链数 = 3 + chainLv*2
      let totalHits = count;
      if (key === 'lightning') {
        const chainLv = weapon.getBranch('chains') || 0;
        totalHits = count * (3 + chainLv * 2);
        // 风暴双发
        const stormLv = weapon.getBranch('storm') || 0;
        totalHits *= (1 + stormLv);
      }

      // 无人机：高频低伤，模拟为一次性累计
      if (key === 'drone') {
        const arrayCount = 2 + countLv;
        const ticks = Math.floor(interval / 300); // 每300ms一次
        totalHits = arrayCount * ticks;
      }

      // 应用伤害到砖块/Boss
      let weaponTotalDmg = 0;
      if (bossPhase && bossHP > 0) {
        const d = dmg * totalHits;
        bossHP -= d;
        weaponTotalDmg = d;
      } else {
        let remaining = totalHits;
        for (let i = 0; i < bricks.length && remaining > 0; i++) {
          if (!bricks[i].alive) continue;
          const d = Math.min(dmg, bricks[i].hp);
          if (bricks[i].hit(d)) {
            stats.bricksDestroyed++;
            grantBrickReward(bricks[i]);
          }
          weaponTotalDmg += d;
          remaining--;
        }
      }

      stats.weaponDmg[key] = (stats.weaponDmg[key] || 0) + weaponTotalDmg;
      stats.totalDmg += weaponTotalDmg;
    }
  }
}

function grantBrickReward(brick) {
  const exp = expSystem.calcBrickExp(brick);
  expSystem.addExp(exp);
  stats.expGained += exp;
  if (Math.random() < Config.COIN_DROP_CHANCE) stats.coins++;
  if (Math.random() < Config.SKILL_CRATE_CHANCE && elapsedMs - lastCrateTime >= Config.SKILL_CRATE_COOLDOWN) {
    stats.skillCrates++;
    lastCrateTime = elapsedMs;
    doUpgrade('crate');
  }
}

function doUpgrade(source) {
  const choices = upgrades.generateChoices();
  if (choices.length === 0) return;

  let picked = null;
  const newWeps = choices.filter(c => c.type === 'newWeapon');
  const ships = choices.filter(c => c.type === 'shipBranch');
  const wepBranches = choices.filter(c => c.type === 'weaponBranch');

  // 策略：新武器优先（<4个时），然后飞机/武器交替
  if (newWeps.length > 0 && upgrades.getWeaponCount() < 4) {
    picked = newWeps[0];
  } else if (stats.levelUps % 2 === 0 && ships.length > 0) {
    picked = ships[0];
  } else if (wepBranches.length > 0) {
    picked = wepBranches[0];
  } else {
    picked = choices[0];
  }

  if (picked) {
    upgrades.applyChoice(picked);
    stats.choices.push({
      time: `${(elapsedMs / 1000).toFixed(0)}s`,
      name: picked.name,
      type: picked.type,
      source,
    });
  }
  stats.levelUps++;
}

// ===== 主循环 =====
section('🎮 第1章 精确战斗模拟');

console.log(`\n--- 第1章配置 ---`);
console.log(`  baseHP: ${chapterConfig.baseHP} | chapterScale: ${chapterConfig.chapterScale}`);
console.log(`  spawnInterval: ${chapterConfig.spawnInterval}ms | scrollSpeed: ${chapterConfig.scrollSpeed}`);
console.log(`  gapChance: ${chapterConfig.gapChance} | bossType: ${chapterConfig.bossType}`);
console.log(`  brickTypes: ${chapterConfig.brickTypes.join(', ')}`);
console.log(`\n--- 时间线 ---`);
for (const p of timeline) {
  if (p.spawnMult > 0 || p.phase === 'boss')
    console.log(`  ${(p.time / 1000).toFixed(0).padStart(4)}s | ${p.phase.padEnd(10)} | timeCurve: [${p.timeCurve}] | spawnMult: ${p.spawnMult} | types: ${p.types.join(',')}`);
}

console.log(`\n--- 第1章砖块HP采样（每阶段10个） ---`);
for (const p of timeline) {
  if (p.spawnMult <= 0) continue;
  const samples = [];
  for (let i = 0; i < 10; i++) samples.push(BrickFactory.calcHP(chapterConfig, p.timeCurve, 'normal', false));
  console.log(`  ${p.phase.padEnd(10)}: HP范围 ${Math.min(...samples)}-${Math.max(...samples)} | 样本: [${samples.join(', ')}]`);
}

// 运行模拟
const TOTAL_MS = 540000; // 跑到9分钟（含Boss阶段）

while (elapsedMs < TOTAL_MS) {
  const phase = getPhase(elapsedMs);

  // 阶段变化日志
  if (phase.phase !== lastPhase) {
    stats.phaseLog.push({ time: `${(elapsedMs / 1000).toFixed(0)}s`, phase: phase.phase });
    lastPhase = phase.phase;
  }

  // Boss
  if (phase.phase === 'boss' && !bossPhase) {
    bossPhase = true;
    const bossBaseHP = Config.BOSS_BASE_HP[Math.min(chapterConfig.bossCycle, Config.BOSS_BASE_HP.length - 1)];
    bossHP = Math.floor(bossBaseHP * chapterConfig.bossHpMultiplier);
    bossMaxHP = bossHP;
  }

  // 砖块生成
  if (!bossPhase && phase.spawnMult > 0) {
    const tip = (elapsedMs - phase.time) / 1000;
    const iv = chapterConfig.spawnInterval / (phase.spawnMult * (1 + Math.min(tip / 60, 0.15)));
    spawnTimer += TICK_MS;
    if (spawnTimer >= iv) {
      spawnTimer -= iv;
      const row = BrickFactory.generateRow(375, 50 + (stats.bricksSpawned * 2) % 300, phase, chapterConfig);
      for (const b of row) stats.totalBrickHP += b.hp;
      bricks = bricks.concat(row);
      stats.bricksSpawned += row.length;
    }
  }

  // 子弹射击
  fireTimer += TICK_MS;
  const fireIv = getFireInterval();
  while (fireTimer >= fireIv) {
    fireTimer -= fireIv;
    const dmg = getBulletDmg();
    const count = getBulletCount();
    const pierce = upgrades.getPierceCount();

    if (bossPhase && bossHP > 0) {
      const d = dmg * count * (1 + pierce * 0.5);
      bossHP -= d;
      stats.bulletDmg += d;
      stats.totalDmg += d;
    } else {
      let hits = 0;
      for (let i = 0; i < bricks.length && hits < count; i++) {
        if (!bricks[i].alive) continue;
        // 穿透：命中后继续往后打
        let p = 0;
        let j = i;
        while (j < bricks.length && p <= pierce) {
          if (!bricks[j].alive) { j++; continue; }
          const d = Math.min(dmg, bricks[j].hp + 0.001); // 保证能打
          if (bricks[j].hit(dmg)) {
            stats.bricksDestroyed++;
            grantBrickReward(bricks[j]);
          }
          stats.bulletDmg += dmg;
          stats.totalDmg += dmg;
          p++;
          j++;
        }
        hits++;
      }
    }
  }

  // 武器伤害
  tickWeapons(TICK_MS);

  // 经验升级
  while (expSystem.hasPendingLevelUp()) {
    expSystem.consumeLevelUp();
    doUpgrade('levelUp');
  }

  // Boss击败
  if (bossPhase && bossHP <= 0 && !stats.bossDefeated) {
    stats.bossDefeated = true;
    stats.bossDefeatTime = `${(elapsedMs / 1000).toFixed(1)}s`;
  }

  // 清理
  bricks = bricks.filter(b => b.alive);

  // 快照（每15秒）
  snapshotTimer += TICK_MS;
  if (snapshotTimer >= 15000) {
    snapshotTimer -= 15000;
    const bulletDPS = getBulletDmg() * getBulletCount() * (1 + upgrades.getPierceCount() * 0.3) / (getFireInterval() / 1000);
    const intervalDmg = stats.totalDmg - lastSnapshotDmg;
    lastSnapshotDmg = stats.totalDmg;
    const weaponNames = Object.keys(upgrades.weapons).map(k => Config.WEAPON_TREES[k].name.substring(0, 4)).join('+') || '无';

    stats.snapshots.push({
      time: `${(elapsedMs / 1000).toFixed(0)}s`,
      phase: getPhase(elapsedMs).phase,
      level: expSystem.playerLevel,
      bulletDPS: bulletDPS.toFixed(1),
      actualDPS: (intervalDmg / 15).toFixed(1),
      alive: bricks.length,
      destroyed: stats.bricksDestroyed,
      spawned: stats.bricksSpawned,
      weapons: weaponNames,
      bossHP: bossPhase ? Math.max(0, Math.floor(bossHP)) : '-',
    });
  }

  elapsedMs += TICK_MS;
}

// ===== 输出结果 =====

section('📊 阶段进入时间');
for (const p of stats.phaseLog) {
  console.log(`  ${p.time.padStart(5)} → ${p.phase}`);
}

section('📊 每15秒快照');
console.log('  时间  | 阶段     | 等级 | 理论DPS | 实际DPS | 存活 | 已毁 | 已生 | 武器       | BossHP');
console.log('  ------|----------|------|---------|---------|------|------|------|-----------|------');
for (const s of stats.snapshots) {
  console.log(
    `  ${s.time.padStart(5)} | ${s.phase.padEnd(8)} | Lv${String(s.level).padStart(2)} | ` +
    `${s.bulletDPS.padStart(7)} | ${s.actualDPS.padStart(7)} | ` +
    `${String(s.alive).padStart(4)} | ${String(s.destroyed).padStart(4)} | ${String(s.spawned).padStart(4)} | ` +
    `${s.weapons.padEnd(9)} | ${String(s.bossHP).padStart(6)}`
  );
}

section('📊 最终统计');
console.log(`  总时长: ${(elapsedMs / 1000).toFixed(0)}s`);
console.log(`  砖块生成: ${stats.bricksSpawned} (总HP: ${Math.floor(stats.totalBrickHP)})`);
console.log(`  砖块摧毁: ${stats.bricksDestroyed} (清除率: ${(stats.bricksDestroyed / stats.bricksSpawned * 100).toFixed(1)}%)`);
console.log(`  场上剩余: ${bricks.length}`);
console.log(`  总伤害: ${Math.floor(stats.totalDmg)}`);
console.log(`  子弹伤害: ${Math.floor(stats.bulletDmg)} (${(stats.bulletDmg / stats.totalDmg * 100).toFixed(1)}%)`);
for (const [k, v] of Object.entries(stats.weaponDmg).sort((a, b) => b[1] - a[1])) {
  const name = Config.WEAPON_TREES[k] ? Config.WEAPON_TREES[k].name : k;
  console.log(`  ${name}: ${Math.floor(v)} (${(v / stats.totalDmg * 100).toFixed(1)}%)`);
}
console.log(`\n  最终等级: Lv${expSystem.playerLevel} | 总经验: ${stats.expGained}`);
console.log(`  升级次数: ${stats.levelUps} | 宝箱: ${stats.skillCrates} | 金币: ${stats.coins}`);
console.log(`  Boss HP: ${bossMaxHP} | 击败: ${stats.bossDefeated ? '✅ ' + stats.bossDefeatTime : '❌'}`);

console.log(`\n  最终攻击力: ${(BASE_ATTACK * upgrades.getAttackMult()).toFixed(1)}`);
console.log(`  射击间隔: ${getFireInterval().toFixed(0)}ms`);
console.log(`  散射: ${getBulletCount()}弹 | 穿透: ${upgrades.getPierceCount()}层`);
console.log(`  武器数: ${upgrades.getWeaponCount()}/4`);

section('📊 升级选择记录');
for (const c of stats.choices) {
  console.log(`  [${c.time.padStart(4)}] ${c.name.padEnd(16)} ← ${c.source}`);
}

// ===== 关键指标分析 =====
section('🔍 关键分析');

const avgBrickHP = stats.totalBrickHP / stats.bricksSpawned;
const finalDPS = getBulletDmg() * getBulletCount() / (getFireInterval() / 1000);
const timeToKillAvgBrick = avgBrickHP / finalDPS;

console.log(`  平均砖块HP: ${avgBrickHP.toFixed(1)}`);
console.log(`  最终子弹DPS: ${finalDPS.toFixed(1)}`);
console.log(`  击杀平均砖块耗时: ${timeToKillAvgBrick.toFixed(2)}s`);
console.log(`  砖块生成速率: ${(stats.bricksSpawned / (elapsedMs / 1000)).toFixed(1)}个/秒`);
console.log(`  砖块清除速率: ${(stats.bricksDestroyed / (elapsedMs / 1000)).toFixed(1)}个/秒`);
console.log(`  净堆积速率: ${((stats.bricksSpawned - stats.bricksDestroyed) / (elapsedMs / 1000)).toFixed(1)}个/秒（正数=越堆越多）`);

if (bricks.length > 100) {
  console.log(`\n  ⚠️ 场上${bricks.length}个砖块未清，说明DPS不足以应对生成速度`);
}
if (!stats.bossDefeated && bossMaxHP > 0) {
  console.log(`  ⚠️ Boss未击败！残余HP: ${Math.max(0, Math.floor(bossHP))}/${bossMaxHP}`);
}

console.log('\n✅ 第1章模拟完成');
