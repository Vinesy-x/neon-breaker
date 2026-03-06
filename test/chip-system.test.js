/**
 * 芯片系统单元测试
 * 运行: node test/chip-system.test.js
 */

// Mock wx API
global.wx = { getStorageSync: () => null, setStorageSync: () => {} };

const SaveManager = require('../src/systems/SaveManager');
const ChipManager = require('../src/systems/ChipManager');
const GachaManager = require('../src/systems/GachaManager');
const ChipConfig = require('../src/config/ChipConfig');
const GachaConfig = require('../src/config/GachaConfig');

let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; }
  else { failed++; console.error('  ❌ FAIL:', msg); }
}

function section(name) { console.log('\n📦 ' + name); }

// === Setup ===
const sm = new SaveManager();
const cm = new ChipManager(sm);
const gm = new GachaManager(cm, sm);

// ==========================================
section('ChipConfig 数据完整性');
// ==========================================

assert(Object.keys(ChipConfig.QUALITIES).length === 6, '应有6个品质');
assert(Object.keys(ChipConfig.PARTS).length === 6, '应有6个部件');
assert(ChipConfig.SLOTS_PER_PART === 5, '每部件5槽');

// 词条数量
const affixCounts = {};
let totalAffixes = 0;
for (const part in ChipConfig.AFFIX_POOL) {
  if (part === 'expansion') continue;
  affixCounts[part] = ChipConfig.AFFIX_POOL[part].length;
  totalAffixes += affixCounts[part];
}
console.log('  词条数:', JSON.stringify(affixCounts), '总计:', totalAffixes);
assert(totalAffixes >= 70, '总词条应>=70种 (设计74)');

// ==========================================
section('芯片生成');
// ==========================================

for (const q of ['white','green','blue','purple','orange','red']) {
  const chip = cm.generateChip('fireControl', q);
  assert(chip !== null, q + '品质应能生成');
  assert(chip.quality === q, '品质应为' + q);
  assert(chip.part === 'fireControl', '部位应为fireControl');
  assert(chip.affix && chip.affix.type, '应有词条');
  assert(chip.affix.value > 0 || chip.affix.value === 0, '词条值应>=0');
}

// expansion 应能出所有部位的词条
const expTypes = new Set();
for (let i = 0; i < 200; i++) {
  const c = cm.generateChip('expansion', 'purple');
  expTypes.add(c.affix.type);
}
assert(expTypes.size >= 20, 'expansion应能出>=20种词条 (got ' + expTypes.size + ')');

// redOnly词条只在red品质出
const redOnlyIds = [];
for (const part in ChipConfig.AFFIX_POOL) {
  if (part === 'expansion') continue;
  ChipConfig.AFFIX_POOL[part].forEach(a => { if (a.redOnly) redOnlyIds.push(a.id); });
}
for (let i = 0; i < 200; i++) {
  const c = cm.generateChip('fireControl', 'purple');
  assert(!redOnlyIds.includes(c.affix.type), '紫色不应出redOnly词条: ' + c.affix.type);
}

// ==========================================
section('装配');
// ==========================================

const chip1 = cm.generateChip('fireControl', 'blue');
cm.addChip(chip1);
assert(cm.equip(chip1.uid, 'fireControl', 0) !== false, '装配应成功');
assert(cm.getEquipped('fireControl')[0] === chip1.uid, '槽0应有芯片');
cm.unequip('fireControl', 0);
assert(cm.getEquipped('fireControl')[0] === null, '卸下后应为null');

// expansion 可装任意部位芯片
const expChip = cm.generateChip('expansion', 'green');
cm.addChip(expChip);
// expansion需Ch.50解锁，maxChapter=1时装不上是对的
assert(cm.isPartUnlocked('expansion') === false, 'expansion应未解锁(Ch.50)');

// 未解锁部位不能装
assert(cm.isPartUnlocked('mobility') === false, 'mobility应未解锁(maxChapter=1)');

// ==========================================
section('5合1合成');
// ==========================================

for (let i = 0; i < 5; i++) cm.addChip(cm.generateChip('armorBay', 'white'));
assert(cm.canMerge('armorBay', 'white') === true, '5个白应可合成');
const merged = cm.merge('armorBay', 'white');
assert(merged.quality === 'green', '白合成应为绿');
assert(merged.affix.type, '合成芯片应有词条');

// red不能再合
assert(cm.canMerge('armorBay', 'red') === false, '红色不能再合');

// ==========================================
section('洗练');
// ==========================================

sm._data.solvents = 10;
const washChip = cm.generateChip('fireControl', 'orange');
cm.addChip(washChip);
const oldAffix = { ...washChip.affix };
const result = cm.reroll(washChip.uid);
assert(result.old.type === oldAffix.type, '旧词条应匹配');
assert(result.new.type, '新词条应存在');
cm.confirmReroll(washChip.uid, false); // 保留旧的
const afterChip = cm.getChipByUid(washChip.uid);
assert(afterChip.affix.type === oldAffix.type, '保留旧的应不变');
assert(sm.getSolvents() === 9, '应消耗1瓶试剂');

// ==========================================
section('分解');
// ==========================================

const junk = cm.generateChip('tactical', 'blue');
cm.addChip(junk);
const scrapsBefore = sm.getScraps();
cm.disassemble(junk.uid);
assert(sm.getScraps() === scrapsBefore + GachaConfig.scraps.blue, '蓝色分解应得25碎片');

const orangeJunk = cm.generateChip('tactical', 'orange');
cm.addChip(orangeJunk);
const solventsBefore = sm.getSolvents();
cm.disassemble(orangeJunk.uid);
assert(sm.getSolvents() === solventsBefore + 2, '橙色分解应额外+2试剂');

// ==========================================
section('效果汇总');
// ==========================================

// 清空装备，装2个芯片看叠加
const sm2 = new SaveManager();
const cm2 = new ChipManager(sm2);
const c1 = cm2.generateChip('fireControl', 'white');
const c2 = cm2.generateChip('fireControl', 'white');
// 强制设相同词条方便测试
c1.affix = { type: 'all_dmg', value: 0.02 };
c2.affix = { type: 'all_dmg', value: 0.03 };
cm2.addChip(c1); cm2.addChip(c2);
cm2.equip(c1.uid, 'fireControl', 0);
cm2.equip(c2.uid, 'fireControl', 1);
const stats = cm2.getStats();
assert(Math.abs(stats.all_dmg - 0.05) < 0.001, '同词条应加法叠加: ' + stats.all_dmg);

// ==========================================
section('普通抽奖');
// ==========================================

const sm3 = new SaveManager();
const cm3 = new ChipManager(sm3);
const gm3 = new GachaManager(cm3, sm3);
sm3._data.coins = 50000;

// 每日免费
const free = gm3.drawNormal(1);
assert(free.length === 1, '免费抽应得1个');
assert(sm3.getFreeDrawToday() === true, '免费次数应用完');

// 十连
const ten = gm3.drawNormal(10);
assert(ten.length === 10, '十连应得10个');
assert(sm3.getCoins() < 50000, '应扣了金币');

// ==========================================
section('高级抽+保底');
// ==========================================

const sm4 = new SaveManager();
const cm4 = new ChipManager(sm4);
const gm4 = new GachaManager(cm4, sm4);
sm4._data.diamonds = 500;

// 模拟保底
sm4._data.premiumPity = 99;
const pityDraw = gm4.drawPremium(1);
assert(pityDraw.length === 1, '保底抽应得1个');
assert(pityDraw[0].quality === 'red' || pityDraw[0].quality === 'orange', 
  '100抽保底应为红或橙: ' + pityDraw[0].quality);

// ==========================================
section('Boss掉落');
// ==========================================

const sm5 = new SaveManager();
const cm5 = new ChipManager(sm5);
const gm5 = new GachaManager(cm5, sm5);

const drop1 = gm5.bossDropChip(5, false);
assert(drop1.length === 1, '非首通应掉1个');
const drop2 = gm5.bossDropChip(50, true);
assert(drop2.length === 3, '首通应掉3个');

// Boss不掉红
for (let i = 0; i < 100; i++) {
  const drops = gm5.bossDropChip(99, false);
  drops.forEach(d => assert(d.quality !== 'red', 'Boss不应掉红色'));
}

// ==========================================
// 结果
// ==========================================
console.log('\n' + '='.repeat(40));
console.log('✅ Passed: ' + passed);
if (failed > 0) console.log('❌ Failed: ' + failed);
else console.log('🎉 ALL TESTS PASSED!');
console.log('='.repeat(40));
process.exit(failed > 0 ? 1 : 0);
