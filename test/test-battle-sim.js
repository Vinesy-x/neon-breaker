/**
 * test-battle-sim.js - 完整战斗模拟器
 * 模拟一局完整游戏（8分钟），跟踪所有数值变化
 *
 * 假设条件：
 * - 不考虑飞机改造（商店升级全0）
 * - 均匀升级武器和飞机（交替选择）
 * - 无手动操作buff（纯自动战斗）
 */
require('./wx-mock');

const Config = require('../src/Config');
const ChapterConfig = require('../src/ChapterConfig');
const BrickFactory = require('../src/BrickFactory');
const { Brick } = require('../src/Brick');
const ExpSystem = require('../src/systems/ExpSystem');
const UpgradeManager = require('../src/systems/UpgradeManager');

// ===== 模拟参数 =====
const SIM_CHAPTERS = [1, 5, 10, 20, 30, 50];
const TICK_MS = 100; // 每tick 100ms
const BASE_ATTACK_INITIAL = 1; // 商店0级时 getBaseAttack() = 1 + 0 = 1

function section(name) { console.log(`\n${'='.repeat(60)}\n${name}\n${'='.repeat(60)}`); }

/**
 * 模拟一局完整战斗
 */
function simulateBattle(chapter) {
  const chapterConfig = ChapterConfig.get(chapter);
  const timeline = ChapterConfig._getTimeline(chapter);
  const totalMs = Config.CHAPTER_DURATION; // 480000ms = 8min

  // 初始化系统
  const upgrades = new UpgradeManager(null);
  upgrades.setChapter(chapter);
  const expSystem = new ExpSystem();

  // 游戏状态
  let elapsedMs = 0;
  let baseAttack = BASE_ATTACK_INITIAL;
  let bricks = [];
  let spawnTimer = 0;
  let fireTimer = 0;
  let lastCrateTime = -Config.SKILL_CRATE_COOLDOWN;
  let bossPhase = false;
  let bossHP = 0;
  let bossMaxHP = 0;

  // 统计
  const stats = {
    totalDamage: 0,
    bulletDamage: 0,
    weaponDamage: {},
    bricksDestroyed: 0,
    bricksSpawned: 0,
    expGained: 0,
    levelUps: 0,
    upgradeChoices: [],
    coinsEarned: 0,
    skillCrates: 0,
    bossDefeated: false,
    timeline: [],       // 每30秒快照
    dpsTimeline: [],    // 每30秒的DPS
  };

  // 每30秒记录快照
  let snapshotTimer = 0;
  let lastSnapshotDamage = 0;

  /**
   * 获取当前阶段
   */
  function getCurrentPhase(ms) {
    let phase = timeline[0];
    for (const p of timeline) {
      if (ms >= p.time) phase = p;
      else break;
    }
    return phase;
  }

  /**
   * 计算子弹伤害
   */
  function getBulletDamage() {
    const atkMult = upgrades.getAttackMult();
    return Math.max(0.1, baseAttack * atkMult);
  }

  /**
   * 计算射击间隔
   */
  function getFireInterval() {
    const fireRateMult = upgrades.getFireRateMult();
    const bonus = 1 - 1 / fireRateMult;
    return Math.max(80, Config.BULLET_FIRE_INTERVAL * (1 - bonus));
  }

  /**
   * 计算子弹数（含散射）
   */
  function getBulletCount() {
    return 1 + upgrades.getSpreadBonus();
  }

  /**
   * 模拟武器DPS（简化：假设所有武器都能命中）
   */
  function getWeaponDPS() {
    let totalDPS = 0;
    const weaponDetails = {};
    for (const key in upgrades.weapons) {
      const weapon = upgrades.weapons[key];
      const dmg = weapon.getDamage(baseAttack * upgrades.getAttackMult());
      const def = Config.WEAPON_TREES[key];

      // 基础DPS
      const freqLv = weapon.getBranch('freq') || weapon.getBranch('speed') || 0;
      const freqMult = key === 'meteor' ? Math.pow(0.85, freqLv) : Math.pow(0.8, freqLv);
      const interval = def.interval * freqMult;
      let dps = dmg / (interval / 1000);

      // 数量加成
      const countLv = weapon.getBranch('count') || 0;
      dps *= (1 + countLv);

      // 闪电链跳加成
      if (key === 'lightning') {
        const chainLv = weapon.getBranch('chains') || 0;
        const baseChains = 3 + chainLv * 2;
        const chargeLv = weapon.getBranch('charge') || 0;
        const chainDmgMult = chargeLv > 0 ? 1 + 0.25 * chargeLv * baseChains / 2 : 1;
        dps *= chainDmgMult;
        // 风暴双发
        const stormLv = weapon.getBranch('storm') || 0;
        dps *= (1 + stormLv);
      }

      // 无人机阵列
      if (key === 'drone') {
        const arrayCount = 2 + countLv;
        const laserLines = arrayCount; // 简化：每台无人机1条激光线
        dps = dmg * laserLines / (def.tickInterval / 1000);
        const focusLv = weapon.getBranch('focus') || 0;
        if (focusLv > 0) dps *= 1.3;
      }

      weaponDetails[key] = dps;
      totalDPS += dps;
    }
    return { totalDPS, details: weaponDetails };
  }

  /**
   * 模拟升级选择 — 均匀分配（武器和飞机交替）
   */
  function handleLevelUp() {
    const choices = upgrades.generateChoices();
    if (choices.length === 0) return;

    // 优先级：新武器 > 飞机基础 > 武器分支
    let picked = null;

    // 先看有没有新武器
    const newWeapons = choices.filter(c => c.type === 'newWeapon');
    if (newWeapons.length > 0 && upgrades.getWeaponCount() < 4) {
      picked = newWeapons[0];
    }

    if (!picked) {
      // 交替选飞机和武器
      const shipChoices = choices.filter(c => c.type === 'shipBranch');
      const weaponChoices = choices.filter(c => c.type === 'weaponBranch');

      if (stats.levelUps % 2 === 0 && shipChoices.length > 0) {
        picked = shipChoices[0];
      } else if (weaponChoices.length > 0) {
        picked = weaponChoices[0];
      } else if (shipChoices.length > 0) {
        picked = shipChoices[0];
      } else {
        picked = choices[0];
      }
    }

    if (picked) {
      upgrades.applyChoice(picked);
      stats.upgradeChoices.push({
        time: (elapsedMs / 1000).toFixed(0) + 's',
        name: picked.name,
        type: picked.type,
      });
    }
    stats.levelUps++;
  }

  // ===== 主循环 =====
  while (elapsedMs < totalMs) {
    const phase = getCurrentPhase(elapsedMs);

    // 检查是否进入Boss阶段
    if (phase.phase === 'boss' && !bossPhase) {
      bossPhase = true;
      const bossBaseHP = Config.BOSS_BASE_HP[Math.min(chapterConfig.bossCycle, Config.BOSS_BASE_HP.length - 1)];
      bossHP = Math.floor(bossBaseHP * chapterConfig.bossHpMultiplier);
      bossMaxHP = bossHP;
    }

    // ===== 砖块生成（非Boss阶段）=====
    if (!bossPhase && phase.spawnMult > 0) {
      const tip = (elapsedMs - phase.time) / 1000;
      const iv = chapterConfig.spawnInterval / (phase.spawnMult * (1 + Math.min(tip / 60, 0.15)));
      spawnTimer += TICK_MS;
      if (spawnTimer >= iv) {
        spawnTimer -= iv;
        // 生成一行砖块
        const row = BrickFactory.generateRow(375, 50, phase, chapterConfig);
        bricks = bricks.concat(row);
        stats.bricksSpawned += row.length;
      }
    }

    // ===== 子弹射击 =====
    fireTimer += TICK_MS;
    const fireInterval = getFireInterval();
    while (fireTimer >= fireInterval) {
      fireTimer -= fireInterval;
      const bulletDmg = getBulletDamage();
      const bulletCount = getBulletCount();
      const pierce = upgrades.getPierceCount();

      if (bossPhase && bossHP > 0) {
        // 打Boss
        const totalBulletDmg = bulletDmg * bulletCount * (1 + pierce * 0.3);
        bossHP -= totalBulletDmg;
        stats.bulletDamage += totalBulletDmg;
        stats.totalDamage += totalBulletDmg;
      } else {
        // 打砖块 — 命中最前排存活砖块
        let hits = 0;
        for (let i = 0; i < bricks.length && hits < bulletCount; i++) {
          if (!bricks[i].alive) continue;
          const dmg = bulletDmg;
          const totalHits = 1 + pierce; // 穿透可以打多个
          for (let p = 0; p < totalHits && i + p < bricks.length; p++) {
            const target = bricks[i + p];
            if (!target || !target.alive) continue;
            if (target.hit(dmg)) {
              stats.bricksDestroyed++;
              const brickExp = expSystem.calcBrickExp(target);
              expSystem.addExp(brickExp);
              stats.expGained += brickExp;

              // 掉落
              if (Math.random() < Config.COIN_DROP_CHANCE) stats.coinsEarned++;
              if (Math.random() < Config.SKILL_CRATE_CHANCE && elapsedMs - lastCrateTime >= Config.SKILL_CRATE_COOLDOWN) {
                stats.skillCrates++;
                lastCrateTime = elapsedMs;
                handleLevelUp(); // 宝箱触发选择
              }
            }
            stats.bulletDamage += dmg;
            stats.totalDamage += dmg;
          }
          hits++;
        }
      }
    }

    // ===== 武器伤害（简化：按DPS * tickTime） =====
    const weaponDPS = getWeaponDPS();
    const weaponDmgThisTick = weaponDPS.totalDPS * (TICK_MS / 1000);
    if (weaponDmgThisTick > 0) {
      if (bossPhase && bossHP > 0) {
        bossHP -= weaponDmgThisTick;
        stats.totalDamage += weaponDmgThisTick;
        for (const wk in weaponDPS.details) {
          const wd = weaponDPS.details[wk] * (TICK_MS / 1000);
          stats.weaponDamage[wk] = (stats.weaponDamage[wk] || 0) + wd;
        }
      } else {
        // 武器AOE打砖块
        let weaponRemaining = weaponDmgThisTick;
        for (let i = 0; i < bricks.length && weaponRemaining > 0; i++) {
          if (!bricks[i].alive) continue;
          const dmg = Math.min(weaponRemaining, bricks[i].hp);
          if (bricks[i].hit(dmg)) {
            stats.bricksDestroyed++;
            const brickExp = expSystem.calcBrickExp(bricks[i]);
            expSystem.addExp(brickExp);
            stats.expGained += brickExp;
            if (Math.random() < Config.COIN_DROP_CHANCE) stats.coinsEarned++;
          }
          weaponRemaining -= dmg;
          stats.totalDamage += dmg;
        }
        for (const wk in weaponDPS.details) {
          const wd = weaponDPS.details[wk] * (TICK_MS / 1000);
          stats.weaponDamage[wk] = (stats.weaponDamage[wk] || 0) + wd;
        }
      }
    }

    // ===== 经验升级检查 =====
    while (expSystem.hasPendingLevelUp()) {
      expSystem.consumeLevelUp();
      handleLevelUp();
    }

    // ===== Boss击败检查 =====
    if (bossPhase && bossHP <= 0 && !stats.bossDefeated) {
      stats.bossDefeated = true;
      stats.bossDefeatTime = (elapsedMs / 1000).toFixed(1) + 's';
    }

    // ===== 清理死砖 =====
    bricks = bricks.filter(b => b.alive);

    // ===== 快照（每30秒） =====
    snapshotTimer += TICK_MS;
    if (snapshotTimer >= 30000) {
      snapshotTimer -= 30000;
      const bulletDPS = getBulletDamage() * getBulletCount() / (getFireInterval() / 1000);
      const wDPS = getWeaponDPS();
      const intervalDamage = stats.totalDamage - lastSnapshotDamage;
      const intervalDPS = intervalDamage / 30;
      lastSnapshotDamage = stats.totalDamage;

      stats.timeline.push({
        time: (elapsedMs / 1000).toFixed(0) + 's',
        level: expSystem.playerLevel,
        bulletDPS: bulletDPS.toFixed(1),
        weaponDPS: wDPS.totalDPS.toFixed(1),
        totalTheoreticalDPS: (bulletDPS + wDPS.totalDPS).toFixed(1),
        actualDPS: intervalDPS.toFixed(1),
        aliveBricks: bricks.length,
        destroyed: stats.bricksDestroyed,
        weapons: Object.keys(upgrades.weapons).length,
        bossHP: bossPhase ? Math.max(0, Math.floor(bossHP)) : '-',
      });
    }

    elapsedMs += TICK_MS;
  }

  // 最终快照
  const bulletDPS = getBulletDamage() * getBulletCount() / (getFireInterval() / 1000);
  const wDPS = getWeaponDPS();

  return {
    chapter,
    chapterConfig,
    expSystem,
    upgrades,
    stats,
    finalBulletDPS: bulletDPS,
    finalWeaponDPS: wDPS,
    finalTotalDPS: bulletDPS + wDPS.totalDPS,
    aliveBricks: bricks.length,
    bossMaxHP,
  };
}

// ===== 运行模拟 =====

for (const ch of SIM_CHAPTERS) {
  section(`🎮 第${ch}章 完整战斗模拟`);

  const result = simulateBattle(ch);
  const s = result.stats;

  console.log(`\n--- 基础信息 ---`);
  console.log(`  章节: ${ch} | 砖块baseHP: ${result.chapterConfig.baseHP} | Boss类型: ${result.chapterConfig.bossType}`);
  console.log(`  初始攻击力: ${BASE_ATTACK_INITIAL} | 最终攻击力: ${(BASE_ATTACK_INITIAL * result.upgrades.getAttackMult()).toFixed(1)}`);
  console.log(`  射击间隔: ${Config.BULLET_FIRE_INTERVAL}ms → ${Math.max(80, Config.BULLET_FIRE_INTERVAL * (1 - (1 - 1 / result.upgrades.getFireRateMult()))).toFixed(0)}ms`);
  console.log(`  散射弹道: ${1 + result.upgrades.getSpreadBonus()} | 穿透层数: ${result.upgrades.getPierceCount()}`);

  console.log(`\n--- 战斗结果 ---`);
  console.log(`  砖块生成: ${s.bricksSpawned} | 砖块摧毁: ${s.bricksDestroyed} | 场上剩余: ${result.aliveBricks}`);
  console.log(`  总伤害: ${Math.floor(s.totalDamage)} | 子弹伤害占比: ${(s.bulletDamage / s.totalDamage * 100).toFixed(1)}%`);
  console.log(`  Boss HP: ${result.bossMaxHP} | 击败: ${s.bossDefeated ? '✅ ' + s.bossDefeatTime : '❌ 未击败'}`);

  console.log(`\n--- 成长曲线 ---`);
  console.log(`  最终等级: Lv${result.expSystem.playerLevel} | 总经验: ${s.expGained}`);
  console.log(`  升级次数: ${s.levelUps} | 技能宝箱: ${s.skillCrates}`);
  console.log(`  金币: ${s.coinsEarned}`);

  console.log(`\n--- DPS 分析 ---`);
  console.log(`  最终子弹DPS: ${result.finalBulletDPS.toFixed(1)}`);
  console.log(`  最终武器DPS: ${result.finalWeaponDPS.totalDPS.toFixed(1)}`);
  for (const wk in result.finalWeaponDPS.details) {
    console.log(`    └ ${Config.WEAPON_TREES[wk].name}: ${result.finalWeaponDPS.details[wk].toFixed(1)}`);
  }
  console.log(`  最终总DPS: ${result.finalTotalDPS.toFixed(1)}`);

  console.log(`\n--- 伤害占比 ---`);
  const sortedDmg = Object.entries(s.weaponDamage).sort((a, b) => b[1] - a[1]);
  console.log(`  子弹: ${Math.floor(s.bulletDamage)} (${(s.bulletDamage / s.totalDamage * 100).toFixed(1)}%)`);
  for (const [wk, dmg] of sortedDmg) {
    const name = Config.WEAPON_TREES[wk] ? Config.WEAPON_TREES[wk].name : wk;
    console.log(`  ${name}: ${Math.floor(dmg)} (${(dmg / s.totalDamage * 100).toFixed(1)}%)`);
  }

  console.log(`\n--- 30秒快照时间线 ---`);
  console.log('  时间  | 等级 | 子弹DPS | 武器DPS | 总DPS   | 实际DPS | 存活砖块 | 已摧毁 | 武器数 | BossHP');
  console.log('  ------|------|---------|---------|---------|---------|---------|--------|--------|------');
  for (const snap of s.timeline) {
    console.log(
      `  ${snap.time.padStart(5)} | Lv${String(snap.level).padStart(2)} | ` +
      `${snap.bulletDPS.padStart(7)} | ${snap.weaponDPS.padStart(7)} | ${snap.totalTheoreticalDPS.padStart(7)} | ` +
      `${snap.actualDPS.padStart(7)} | ${String(snap.aliveBricks).padStart(7)} | ${String(snap.destroyed).padStart(6)} | ` +
      `${String(snap.weapons).padStart(6)} | ${String(snap.bossHP).padStart(6)}`
    );
  }

  console.log(`\n--- 升级选择记录 ---`);
  for (const c of s.upgradeChoices) {
    console.log(`  [${c.time}] ${c.name} (${c.type})`);
  }
}

console.log('\n✅ 战斗模拟完成');
