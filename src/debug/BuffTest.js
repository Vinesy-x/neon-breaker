/**
 * BuffTest.js - Buff系统自动化测试
 * 
 * 在浏览器环境下通过 window.__buffTest() 执行
 * 逐个验证灼烧/冰缓/冻结/感电的核心机制
 * 
 * 输出结构化测试报告
 */
const BuffConfig = require('../config/BuffConfig');
const BuffSystem = require('../systems/BuffSystem');

class BuffTest {
  constructor() {
    this.results = [];
    this.passCount = 0;
    this.failCount = 0;
  }

  // ===== 工具方法 =====
  
  _assert(name, condition, detail) {
    var passed = !!condition;
    this.results.push({ name: name, passed: passed, detail: detail || '' });
    if (passed) this.passCount++;
    else this.failCount++;
    return passed;
  }

  _makeBrick(hp, isBoss) {
    return {
      alive: true,
      hp: hp || 100,
      maxHp: hp || 100,
      isBoss: !!isBoss,
      _buffs: {},
      _frozen: false,
      _freezeTimer: 0,
      _freezeCount: 0,
      _baseSpeedMult: 1.0,
      speedMult: 1.0,
      getCenter: function() { return { x: 100, y: 100 }; },
    };
  }

  _makeGame() {
    var self = this;
    return {
      bricks: [],
      particles: { emitHitSpark: function(){} },
      combat: {
        _damages: [],
        damageBrick: function(brick, dmg, source, type) {
          this._damages.push({ brick: brick, dmg: dmg, source: source, type: type });
          brick.hp -= dmg;
          if (brick.hp <= 0) brick.alive = false;
        }
      },
      upgrades: { shipTree: {} },
    };
  }

  // ===== 测试套件 =====

  runAll() {
    console.log('========== BuffSystem 测试开始 ==========');
    this.results = []; this.passCount = 0; this.failCount = 0;

    this.testBurnBasic();
    this.testBurnDamage();
    this.testBurnBossReduction();
    this.testBurnDecay();
    this.testBurnMaxStacks();
    this.testChillBasic();
    this.testChillSlowDown();
    this.testChillDecay();
    this.testChillToFreeze();
    this.testFreezeImmunity();
    this.testFreezeDamageBonus();
    this.testFreezeBossDecay();
    this.testShockBasic();
    this.testShockDecay();
    this.testShockArc();
    this.testShockArcChain();

    console.log('========== 测试完成 ==========');
    console.log('通过: ' + this.passCount + ' / 失败: ' + this.failCount + ' / 总计: ' + this.results.length);
    
    return this._generateReport();
  }

  // ----- 灼烧测试 -----

  testBurnBasic() {
    var game = this._makeGame();
    var bs = new BuffSystem(game);
    var brick = this._makeBrick(100);

    bs.applyBurn(brick, 1);
    var stacks = bs.getStacks(brick, 'burn');
    this._assert('灼烧-叠加1层', stacks === 1, '期望1层，实际' + stacks);

    bs.applyBurn(brick, 3);
    stacks = bs.getStacks(brick, 'burn');
    this._assert('灼烧-叠加到4层', stacks === 4, '期望4层，实际' + stacks);
  }

  testBurnDamage() {
    var game = this._makeGame();
    var bs = new BuffSystem(game);
    var brick = this._makeBrick(1000);

    bs.applyBurn(brick, 5); // 5层
    game.combat._damages = [];
    
    // 模拟1秒(1000ms) — 应触发1次tick
    bs.update(1000, [brick]);
    
    var totalDmg = 0;
    for (var i = 0; i < game.combat._damages.length; i++) {
      totalDmg += game.combat._damages[i].dmg;
    }
    // 5层 × 1%当前HP(1000) = 50
    var expected = 1000 * 0.01 * 5;
    this._assert('灼烧-伤害计算', Math.abs(totalDmg - expected) < 0.1,
      '期望' + expected + '，实际' + totalDmg.toFixed(2));
  }

  testBurnBossReduction() {
    var game = this._makeGame();
    var bs = new BuffSystem(game);
    var boss = this._makeBrick(10000, true);

    bs.applyBurn(boss, 5); // 5层
    game.combat._damages = [];
    
    bs.update(1000, [boss]);
    
    var totalDmg = 0;
    for (var i = 0; i < game.combat._damages.length; i++) {
      totalDmg += game.combat._damages[i].dmg;
    }
    // Boss: 5层 × 1% × (1-0.8) × 10000 = 5 × 0.002 × 10000 = 100
    var expected = 10000 * 0.01 * (1 - BuffConfig.burn.bossReduction) * 5;
    this._assert('灼烧-Boss减伤80%', Math.abs(totalDmg - expected) < 0.1,
      '期望' + expected + '，实际' + totalDmg.toFixed(2));
  }

  testBurnDecay() {
    var game = this._makeGame();
    var bs = new BuffSystem(game);
    var brick = this._makeBrick(100);

    bs.applyBurn(brick, 3);
    // 2秒后应减1层 → 2层
    bs.update(2000, [brick]);
    var stacks = bs.getStacks(brick, 'burn');
    this._assert('灼烧-2秒减1层', stacks === 2, '期望2层，实际' + stacks);

    // 再2秒 → 1层
    bs.update(2000, [brick]);
    stacks = bs.getStacks(brick, 'burn');
    this._assert('灼烧-4秒减到1层', stacks === 1, '期望1层，实际' + stacks);
  }

  testBurnMaxStacks() {
    var game = this._makeGame();
    var bs = new BuffSystem(game);
    var brick = this._makeBrick(100);

    bs.applyBurn(brick, 15); // 超过上限
    var stacks = bs.getStacks(brick, 'burn');
    this._assert('灼烧-上限10层', stacks === BuffConfig.burn.maxStacks,
      '期望' + BuffConfig.burn.maxStacks + '，实际' + stacks);
  }

  // ----- 冰缓测试 -----

  testChillBasic() {
    var game = this._makeGame();
    var bs = new BuffSystem(game);
    var brick = this._makeBrick(100);

    bs.applyChill(brick, 1);
    this._assert('冰缓-叠加1层', bs.getStacks(brick, 'chill') === 1,
      '实际' + bs.getStacks(brick, 'chill'));
  }

  testChillSlowDown() {
    var game = this._makeGame();
    var bs = new BuffSystem(game);
    var brick = this._makeBrick(100);

    bs.applyChill(brick, 3); // 3层 = 30%减速
    var slow = bs.getSlowMult(brick);
    this._assert('冰缓-3层减速30%', Math.abs(slow - 0.7) < 0.01,
      '期望0.7，实际' + slow.toFixed(3));
  }

  testChillDecay() {
    var game = this._makeGame();
    var bs = new BuffSystem(game);
    var brick = this._makeBrick(100);

    bs.applyChill(brick, 3);
    bs.update(2000, [brick]); // 2秒减1层
    this._assert('冰缓-2秒减1层', bs.getStacks(brick, 'chill') === 2,
      '实际' + bs.getStacks(brick, 'chill'));
  }

  testChillToFreeze() {
    var game = this._makeGame();
    var bs = new BuffSystem(game);
    var brick = this._makeBrick(100);

    bs.applyChill(brick, 5); // 满层 → 自动冻结
    this._assert('冰缓满层→冻结', bs.isFrozen(brick), '冻结=' + bs.isFrozen(brick));
    this._assert('冻结后冰缓清零', bs.getStacks(brick, 'chill') === 0,
      '实际' + bs.getStacks(brick, 'chill'));
    this._assert('冻结后速度=0', bs.getSlowMult(brick) === 0,
      '实际' + bs.getSlowMult(brick));
  }

  // ----- 冻结测试 -----

  testFreezeImmunity() {
    var game = this._makeGame();
    var bs = new BuffSystem(game);
    var brick = this._makeBrick(100);

    bs.applyChill(brick, 5); // 冻结
    this._assert('冻结免疫-已冻结', bs.isFrozen(brick), '');
    
    bs.applyChill(brick, 5); // 再叠5层，不应触发新冻结
    this._assert('冻结中叠冰缓无效', bs.getStacks(brick, 'chill') === 0,
      '实际' + bs.getStacks(brick, 'chill'));
  }

  testFreezeDamageBonus() {
    var game = this._makeGame();
    var bs = new BuffSystem(game);
    var brick = this._makeBrick(100);

    bs.applyChill(brick, 5); // 冻结
    var iceMult = bs.getFreezeDamageMult(brick, 'ice');
    var physMult = bs.getFreezeDamageMult(brick, 'physical');
    this._assert('冻结-冰伤+50%', Math.abs(iceMult - 1.5) < 0.01,
      '期望1.5，实际' + iceMult);
    this._assert('冻结-物理无加成', physMult === 1,
      '期望1，实际' + physMult);
  }

  testFreezeBossDecay() {
    var game = this._makeGame();
    var bs = new BuffSystem(game);
    var boss = this._makeBrick(1000, true);

    // 第1次冻结: 3000ms
    bs.applyChill(boss, 5);
    this._assert('Boss冻结-第1次', bs.isFrozen(boss), '');
    var timer1 = boss._freezeTimer;
    this._assert('Boss冻结-持续3秒', Math.abs(timer1 - 3000) < 1,
      '期望3000，实际' + timer1);

    // 解冻
    bs.update(3100, [boss]);
    this._assert('Boss解冻', !bs.isFrozen(boss), '');

    // 第2次冻结: 3000 × 0.8 = 2400ms
    bs.applyChill(boss, 5);
    var timer2 = boss._freezeTimer;
    var expected2 = 3000 * 0.8;
    this._assert('Boss冻结-第2次衰减20%', Math.abs(timer2 - expected2) < 1,
      '期望' + expected2 + '，实际' + timer2);

    // 解冻再冻第3次: 3000 × 0.8 × 0.8 = 1920ms
    bs.update(2500, [boss]);
    bs.applyChill(boss, 5);
    var timer3 = boss._freezeTimer;
    var expected3 = 3000 * 0.64;
    this._assert('Boss冻结-第3次衰减', Math.abs(timer3 - expected3) < 1,
      '期望' + expected3 + '，实际' + timer3);
  }

  // ----- 感电测试 -----

  testShockBasic() {
    var game = this._makeGame();
    var bs = new BuffSystem(game);
    var brick = this._makeBrick(100);

    bs.applyShock(brick, 1);
    this._assert('感电-叠加1层', bs.getStacks(brick, 'shock') === 1,
      '实际' + bs.getStacks(brick, 'shock'));

    bs.applyShock(brick, 3);
    this._assert('感电-叠加到4层', bs.getStacks(brick, 'shock') === 4,
      '实际' + bs.getStacks(brick, 'shock'));

    bs.applyShock(brick, 5); // 超上限
    this._assert('感电-上限5层', bs.getStacks(brick, 'shock') === 5,
      '实际' + bs.getStacks(brick, 'shock'));
  }

  testShockDecay() {
    var game = this._makeGame();
    var bs = new BuffSystem(game);
    var brick = this._makeBrick(100);

    bs.applyShock(brick, 3);
    bs.update(2000, [brick]);
    this._assert('感电-2秒减1层', bs.getStacks(brick, 'shock') === 2,
      '实际' + bs.getStacks(brick, 'shock'));
  }

  testShockArc() {
    var game = this._makeGame();
    var bs = new BuffSystem(game);
    
    var source = this._makeBrick(100);
    var nearby = this._makeBrick(50);
    nearby.getCenter = function() { return { x: 150, y: 100 }; }; // 50px距离
    game.bricks = [source, nearby];

    bs.applyShock(source, 5); // 5层 = 50%触发概率
    
    // 多次触发验证电弧
    var arcTriggered = false;
    for (var i = 0; i < 50; i++) {
      game.combat._damages = [];
      bs.onEnergyHit(source, 100);
      if (game.combat._damages.length > 0) {
        arcTriggered = true;
        var arcDmg = game.combat._damages[0].dmg;
        var expectedArc = 100 * BuffConfig.shock.arcDamageRatio;
        this._assert('感电-电弧伤害20%', Math.abs(arcDmg - expectedArc) < 0.1,
          '期望' + expectedArc + '，实际' + arcDmg.toFixed(2));
        this._assert('感电-电弧类型energy', game.combat._damages[0].type === 'energy',
          '实际' + game.combat._damages[0].type);
        break;
      }
    }
    this._assert('感电-电弧触发(50次内)', arcTriggered, '50次能量伤害中未触发电弧');
  }

  testShockArcChain() {
    var game = this._makeGame();
    var bs = new BuffSystem(game);
    
    var source = this._makeBrick(100);
    var nearby = this._makeBrick(500); // 高血量不会死
    nearby.getCenter = function() { return { x: 150, y: 100 }; };
    game.bricks = [source, nearby];

    bs.applyShock(source, 5);
    
    // 跑200次，看nearby有没有被叠加感电（10%概率连锁）
    var chainHappened = false;
    for (var i = 0; i < 200; i++) {
      bs.onEnergyHit(source, 100);
      if (bs.getStacks(nearby, 'shock') > 0) {
        chainHappened = true;
        break;
      }
    }
    this._assert('感电-电弧连锁叠感电(200次内)', chainHappened,
      '200次内未发生连锁');
  }

  // ===== 报告生成 =====

  _generateReport() {
    var lines = [];
    lines.push('# BuffSystem 测试报告');
    lines.push('');
    lines.push('| # | 测试项 | 结果 | 详情 |');
    lines.push('|---|--------|------|------|');
    for (var i = 0; i < this.results.length; i++) {
      var r = this.results[i];
      var icon = r.passed ? '✅' : '❌';
      lines.push('| ' + (i+1) + ' | ' + r.name + ' | ' + icon + ' | ' + r.detail + ' |');
    }
    lines.push('');
    lines.push('**通过: ' + this.passCount + ' / 失败: ' + this.failCount + ' / 总计: ' + this.results.length + '**');
    return lines.join('\n');
  }
}

module.exports = BuffTest;
