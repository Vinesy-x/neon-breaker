# 武器平衡沙盒测试方案

## 测试目标
通过 DPSSandbox v5 在 Web 沙盒中自动跑全部 11 把武器，收集 DPS 数据，输出对比表格，用于调整 WeaponBalanceConfig.js。

## 武器清单（11把）

| # | 武器 | key | 伤害类型 | basePct | interval(ms) | 解锁章节 |
|---|------|-----|----------|---------|--------------|----------|
| 1 | 飞机子弹 | ship | physical | (固定) | (固定) | 1 |
| 2 | 寒冰弹 | kunai | ice | 5 | 6000 | 1 |
| 3 | 闪电链 | lightning | energy | 4.5 | 4000 | 1 |
| 4 | 穿甲弹 | missile | physical | 11 | 8000 | 1 |
| 5 | 寒冰发生器 | frostStorm | ice | 12 | 10000 | 10 |
| 6 | 轰炸机 | meteor | fire | 12 | 12000 | 1 |
| 7 | 战术无人机 | drone | energy | 1 | 500 | 10 |
| 8 | 回旋刃 | spinBlade | physical | 11 | 10000 | 15 |
| 9 | 白磷弹 | blizzard | fire | 4.5 | 8000 | 20 |
| 10 | 离子射线 | ionBeam | energy | 75 | 7000 | 25 |
| 11 | 奇点引擎 | gravityWell | energy | 12 | 14000 | 30 |

## 测试方案

### 方案一：逐武器单测（推荐首选）
每把武器单独跑，确保不受其他武器干扰。

**标准参数**：
```javascript
{ weapon: '<key>', duration: 60, speed: 5, targetAlive: 60 }
```

**批量执行脚本**（浏览器 evaluate 注入）：
```javascript
var weapons = ['kunai','lightning','missile','frostStorm','meteor','drone','spinBlade','blizzard','ionBeam','gravityWell'];
var results = {};
var idx = 0;

function runNext() {
  if (idx >= weapons.length) {
    console.log('===== 全部完成 =====');
    console.log(JSON.stringify(results, null, 2));
    window.__balanceResults = results;
    return;
  }
  var w = weapons[idx];
  console.log('>>> 开始测试: ' + w + ' (' + (idx+1) + '/' + weapons.length + ')');
  window.__dpsSandbox({ weapon: w, duration: 60, speed: 5, targetAlive: 60 });
  
  // 等待测完（预热+测量，5x倍速≈25s实际时间）
  setTimeout(function() {
    var g = window.__game;
    var sb = g.dpsSandbox;
    if (sb && sb.stats) {
      var st = sb.stats;
      var ctrl = sb._ctrl;
      var sec = st.measureElapsed / 1000;
      results[w] = {
        avgDps: sec > 0 ? +(st.totalDamage / sec).toFixed(1) : 0,
        totalDmg: Math.round(st.totalDamage),
        kills: st.killCount,
        stableHP: +ctrl.currentHP.toFixed(1),
        sources: Object.assign({}, st.damageBySource),
        buffs: Object.assign({}, st.buffEvents),
      };
    }
    idx++;
    setTimeout(runNext, 2000);
  }, 25000);
}
runNext();
```

**预计耗时**：10把 × 27秒 ≈ 4.5分钟

### 方案二：全武器联测
```javascript
window.__dpsSandbox({ weapon: 'all', duration: 60, speed: 5, targetAlive: 60 });
```

### 方案三：阶段对比（模拟不同章节）
| 阶段 | 章节 | 拥有武器 |
|------|------|----------|
| 初期 | 1-9 | kunai, lightning, missile, meteor |
| 中期 | 10-19 | + frostStorm, drone |
| 后期 | 20-29 | + spinBlade, blizzard |
| 终局 | 30+ | + ionBeam, gravityWell |

## 关注指标

### 核心
| 指标 | 说明 | 健康范围 |
|------|------|----------|
| 平均 DPS | 总伤害/时间 | 各武器差距不超过 3x |
| 稳定 DPS | 去首尾后平均 | 和平均DPS偏差 < 20% |
| 稳定砖 HP | 水位控制后的砖块血量 | 反映武器真实输出 |
| 击杀数 | 总击杀砖块 | 高=范围广/频率高 |

### 红灯
- ❌ 某武器 DPS 超过最高的 50%+ → 过强
- ❌ 某武器 DPS 低于最低的 50%- → 过弱
- ❌ 存活比例长期 >150% → 打不动
- ❌ 存活比例长期 <50% → 秒杀太快

## 调参指南
```
DPS ≈ basePct × baseAttack / (interval / 1000)
```
| 要调什么 | 改哪里 | 影响 |
|----------|--------|------|
| 单发伤害 | basePct | 直接影响每次攻击伤害 |
| 攻击频率 | interval | 影响 DPS 和手感 |
| 范围伤害 | aoeRadius / baseRadius | 影响清屏效率 |
| 持续伤害 | DOT 相关参数 | 影响总伤害占比 |
| 成长性 | branchDmgScale | 影响升级后强度 |

## 执行流程
1. 打包：`npx browserify web/entry.js -o web/bundle.js`
2. 启动服务器：`npx http-server . -p 8080 -c-1 --cors &`
3. 浏览器打开：`http://127.0.0.1:8080/web/index.html`
4. 重建 rAF：evaluate safeLoop
5. 注入批量脚本：evaluate 方案一的批量执行脚本
6. 等待 ~5 分钟：所有武器跑完
7. 取结果：`window.__balanceResults`
8. 分析 + 调参：根据红灯指标调整 WeaponBalanceConfig.js
9. 重新打包测试：验证调参效果
