/**
 * test-systems.js - 单元测试：验证重构后系统模块的逻辑正确性
 */
require('./wx-mock');

const Config = require('../src/Config');
const { Brick } = require('../src/Brick');
const Bullet = require('../src/Bullet');
const Launcher = require('../src/Launcher');
const BrickFactory = require('../src/BrickFactory');
const ChapterConfig = require('../src/ChapterConfig');
const ExpSystem = require('../src/systems/ExpSystem');
const DotSystem = require('../src/systems/DotSystem');

let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; }
  else { failed++; console.error(`  ❌ FAIL: ${msg}`); }
}
function section(name) { console.log(`\n=== ${name} ===`); }

// ========== Brick 基础 ==========
section('Brick 基础');

const b1 = new Brick(10, 10, 40, 20, 5, '#FF0000');
assert(b1.alive === true, 'brick alive');
assert(b1.hp === 5, 'brick hp');
assert(b1.maxHp === 5, 'brick maxHp');

b1.hit(2);
assert(b1.hp === 3, 'brick hit 2 → hp=3');
assert(b1.alive === true, 'brick still alive');

b1.hit(3);
assert(b1.hp === 0, 'brick hit 3 → hp=0');
assert(b1.alive === false, 'brick dead');

// 护盾砖
const shieldBrick = new Brick(0, 0, 40, 20, 3, '#4488FF');
shieldBrick.type = 'shield';
shieldBrick.shieldHp = 2;
shieldBrick.hit(10); // 第一击吸收
assert(shieldBrick.shieldHp === 1, 'shield absorb 1st hit');
assert(shieldBrick.hp === 3, 'hp unchanged after shield');
shieldBrick.hit(10); // 第二击吸收
assert(shieldBrick.shieldHp === 0, 'shield absorb 2nd hit');
shieldBrick.hit(2); // 第三击扣HP
assert(shieldBrick.hp === 1, 'hp after shield gone: 3-2=1');

// 冻结增伤
const frozenBrick = new Brick(0, 0, 40, 20, 10, '#44DDFF');
frozenBrick.frozen = true;
assert(frozenBrick.getDamageMult() === 1.5, 'frozen damage mult = 1.5');

// 元素状态
const elemBrick = new Brick(0, 0, 40, 20, 5, '#FFFFFF');
elemBrick._baseSpeedMult = 1.0;
elemBrick.iceStacks = 2;
elemBrick.iceDuration = 5000;
elemBrick.updateStatus(0);
assert(Math.abs(elemBrick.speedMult - 0.7) < 0.01, `ice 2 stacks → speed=${elemBrick.speedMult.toFixed(2)} (expect 0.70)`);

console.log(`  ✅ Brick tests: ${passed} passed`);
const brickPassed = passed;

// ========== Bullet 碰撞 ==========
section('Bullet 碰撞');

const bullet = new Bullet(25, 15, 0, -10, 5);
const targetBrick = new Brick(10, 10, 40, 20, 3, '#FF0000');
assert(bullet.collideBrick(targetBrick) === true, 'bullet inside brick → collide');

const farBullet = new Bullet(200, 200, 0, -10, 5);
assert(farBullet.collideBrick(targetBrick) === false, 'far bullet → no collide');

// 边界反弹
const bounceBullet = new Bullet(2, 100, -5, 0, 1);
bounceBullet.wallBounce = 2;
bounceBullet.bounceDmgMult = 0.25;
bounceBullet.update(1);
assert(bounceBullet.vx > 0, `wall bounce: vx flipped to ${bounceBullet.vx}`);
assert(bounceBullet.wallBounce === 1, 'wall bounce count decreased');
assert(bounceBullet.damage > 1, `damage after bounce: ${bounceBullet.damage.toFixed(2)}`);

console.log(`  ✅ Bullet tests: ${passed - brickPassed} passed`);
const bulletPassed = passed;

// ========== BrickFactory ==========
section('BrickFactory');

const ch1 = ChapterConfig.get(1);
const phase1 = ChapterConfig.getPhaseAt(1, 0);
const row = BrickFactory.generateRow(375, 100, phase1, ch1);
assert(row.length > 0, `row generated: ${row.length} bricks`);
assert(row.every(b => b.alive), 'all bricks alive');
assert(row.every(b => b.hp >= 1), 'all bricks hp >= 1');

// 阵型
const formation = BrickFactory.generateFormation(375, 100, 'vShape', 3);
assert(formation.length === 7, `vShape formation: ${formation.length} bricks`);
assert(formation.every(b => b.type === 'formation'), 'all formation type');

// HP 公式各类型
const hpNormal = BrickFactory.calcHP(ch1, [1, 1], 'normal', false);
const hpFast = BrickFactory.calcHP(ch1, [1, 1], 'fast', false);
const hpShield = BrickFactory.calcHP(ch1, [1, 1], 'shield', false);
assert(hpFast <= hpNormal, `fast HP(${hpFast}) <= normal HP(${hpNormal})`);
assert(hpShield >= hpNormal, `shield HP(${hpShield}) >= normal HP(${hpNormal})`);

console.log(`  ✅ BrickFactory tests: ${passed - bulletPassed} passed`);
const factoryPassed = passed;

// ========== ExpSystem ==========
section('ExpSystem');

const exp = new ExpSystem();
assert(exp.playerLevel === 1, 'start level 1');
assert(exp.expToNext === 80, `exp to lv2: ${exp.expToNext}`);

exp.addExp(80);
assert(exp.playerLevel === 2, `after 80 exp → lv${exp.playerLevel}`);
assert(exp.pendingLevelUps === 1, 'pending level up');

exp.consumeLevelUp();
assert(exp.pendingLevelUps === 0, 'consumed level up');

// 大量经验 → 连升
exp.reset();
exp.addExp(500);
assert(exp.playerLevel > 1, `after 500 exp → lv${exp.playerLevel}`);
assert(exp.pendingLevelUps >= 1, `pending: ${exp.pendingLevelUps}`);

// 砖块经验 — 固定值
const normalBrick = new Brick(0, 0, 40, 20, 100, '#FFF');
normalBrick.type = 'normal';
const healerBrick = new Brick(0, 0, 40, 20, 100, '#FFF');
healerBrick.type = 'healer';
assert(exp.calcBrickExp(normalBrick) === Config.EXP_PER_BRICK, `normal exp = ${Config.EXP_PER_BRICK}`);
assert(exp.calcBrickExp(healerBrick) === Config.EXP_PER_BRICK + 2, `healer exp = ${Config.EXP_PER_BRICK}+2`);

console.log(`  ✅ ExpSystem tests: ${passed - factoryPassed} passed`);
const expPassed = passed;

// ========== DotSystem ==========
section('DotSystem');

// DamageType 映射
assert(DotSystem.getDamageType('fire') === 'fire', 'fire → fire');
assert(DotSystem.getDamageType('shock_field') === 'energy', 'shock_field → energy');
assert(DotSystem.getDamageType('shock') === 'energy', 'shock → energy');
assert(DotSystem.getDamageType('unknown_type') === 'physical', 'unknown → physical');

console.log(`  ✅ DotSystem tests: ${passed - expPassed} passed`);
const dotPassed = passed;

// ========== ChapterConfig 数值一致性 ==========
section('ChapterConfig 数值一致性');

const ch50 = ChapterConfig.get(50);
const ch100 = ChapterConfig.get(100);

assert(ch1.baseHP < ch50.baseHP, `ch1 baseHP(${ch1.baseHP}) < ch50(${ch50.baseHP})`);
assert(ch50.baseHP < ch100.baseHP, `ch50 baseHP(${ch50.baseHP}) < ch100(${ch100.baseHP})`);
assert(ch1.scrollSpeed < ch100.scrollSpeed, `scroll speed increases`);
assert(ch1.spawnInterval > ch100.spawnInterval, `spawn interval decreases`);
assert(ch100.scrollSpeed <= 0.6, `ch100 scroll capped: ${ch100.scrollSpeed}`);
assert(ch100.spawnInterval >= 800, `ch100 spawn floor: ${ch100.spawnInterval}`);

// Boss类型循环
assert(ch1.bossType === 'charger', `ch1 boss: ${ch1.bossType}`);
assert(ChapterConfig.get(2).bossType === 'guardian', `ch2 boss`);
assert(ChapterConfig.get(6).bossType === 'charger', `ch6 boss cycles back`);

// 时间线阶段
const phases = ChapterConfig._getTimeline(1);
assert(phases.length === 12, `timeline has ${phases.length} phases`);
assert(phases[0].phase === 'warmup', 'first phase = warmup');
assert(phases[phases.length - 1].phase === 'boss', 'last phase = boss');

console.log(`  ✅ ChapterConfig tests: ${passed - dotPassed} passed`);

// ========== 结果 ==========
console.log(`\n${'='.repeat(40)}`);
console.log(`总计: ${passed} 通过, ${failed} 失败`);
if (failed === 0) console.log('🎉 全部通过!');
else process.exit(1);
