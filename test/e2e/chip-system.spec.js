const { test, expect } = require('@playwright/test');

test.describe('芯片系统集成测试', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // 等待游戏初始化
    await page.waitForFunction(() => typeof window.game !== 'undefined', { timeout: 10000 });
  });

  test('游戏加载 - chipManager/gachaManager 存在', async ({ page }) => {
    const has = await page.evaluate(() => ({
      chip: !!window.game.chipManager,
      gacha: !!window.game.gachaManager,
      save: !!window.game.saveManager,
    }));
    expect(has.chip).toBe(true);
    expect(has.gacha).toBe(true);
    expect(has.save).toBe(true);
  });

  test('芯片生成 - 各品质', async ({ page }) => {
    const results = await page.evaluate(() => {
      const cm = window.game.chipManager;
      return ['white','green','blue','purple','orange','red'].map(q => {
        const c = cm.generateChip('fireControl', q);
        return { quality: c.quality, hasAffix: !!c.affix, value: c.affix.value };
      });
    });
    for (const r of results) {
      expect(r.hasAffix).toBe(true);
      expect(r.value).toBeGreaterThan(0);
    }
  });

  test('装备流程 - 生成→装备→效果汇总', async ({ page }) => {
    const stats = await page.evaluate(() => {
      const cm = window.game.chipManager;
      const chip = cm.generateChip('fireControl', 'purple');
      cm.addChip(chip);
      cm.equip(chip.uid, 'fireControl', 0);
      return cm.getStats();
    });
    // 应有至少一个效果
    expect(Object.keys(stats).length).toBeGreaterThan(0);
  });

  test('5合1合成', async ({ page }) => {
    const result = await page.evaluate(() => {
      const cm = window.game.chipManager;
      for (let i = 0; i < 5; i++) cm.addChip(cm.generateChip('armorBay', 'white'));
      if (!cm.canMerge('armorBay', 'white')) return null;
      return cm.merge('armorBay', 'white');
    });
    expect(result).not.toBeNull();
    expect(result.quality).toBe('green');
  });

  test('普通抽奖 - 10连', async ({ page }) => {
    const result = await page.evaluate(() => {
      window.game.saveManager._data.coins = 50000;
      const gm = window.game.gachaManager;
      return gm.drawNormal(10).map(c => c.quality);
    });
    expect(result.length).toBe(10);
  });

  test('Boss掉落 - 首通3颗', async ({ page }) => {
    const result = await page.evaluate(() => {
      const gm = window.game.gachaManager;
      return gm.bossDropChip(25, true).map(c => ({ q: c.quality, p: c.part }));
    });
    expect(result.length).toBe(3);
    // Boss不掉红
    for (const r of result) {
      expect(r.q).not.toBe('red');
    }
  });

  test('洗练 - 消耗试剂二选一', async ({ page }) => {
    const result = await page.evaluate(() => {
      const cm = window.game.chipManager;
      const sm = window.game.saveManager;
      sm._data.solvents = 5;
      const chip = cm.generateChip('fireControl', 'orange');
      cm.addChip(chip);
      const rr = cm.reroll(chip.uid);
      cm.confirmReroll(chip.uid, true);
      return { oldType: rr.old.type, newType: rr.new.type, solvents: sm.getSolvents() };
    });
    expect(result.solvents).toBe(4);
    expect(result.oldType).toBeTruthy();
    expect(result.newType).toBeTruthy();
  });

  test('芯片效果应用 - getStats 多芯片叠加', async ({ page }) => {
    const result = await page.evaluate(() => {
      const cm = window.game.chipManager;
      // 清空之前的装备
      const c1 = cm.generateChip('fireControl', 'blue');
      const c2 = cm.generateChip('fireControl', 'blue');
      c1.affix = { type: 'all_dmg', value: 0.05 };
      c2.affix = { type: 'all_dmg', value: 0.03 };
      cm.addChip(c1); cm.addChip(c2);
      cm.equip(c1.uid, 'fireControl', 0);
      cm.equip(c2.uid, 'fireControl', 1);
      const stats = cm.getStats();
      return { all_dmg: stats.all_dmg, count: Object.keys(stats).length };
    });
    expect(result.all_dmg).toBeCloseTo(0.08, 2);
    expect(result.count).toBeGreaterThan(0);
  });

});
