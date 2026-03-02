# 武器平衡标准化流水线（Balance Pipeline）

> 2026-03-02 by 阿喵 & Vin
>
> **目标**：彻底消灭"改→跑→发现bug→修→再跑"的死循环。
> 建立一套从数学模型到最终数值的**可复现、自动化、无人工干预**的标准流水线。

---

## 一、当前问题诊断

### 为什么一直在兜圈子？

1. **测试环境不稳定** — 高倍速下物理碰撞精度下降，不同武器受影响程度不同
2. **水位控制器和武器互相影响** — 动态调砖块HP导致不同武器面对完全不同的环境
3. **没有基准测试** — 每次改完跑一次，数据无法和之前对比
4. **数学模型和实际代码脱节** — 文档公式参数跟配置文件对不上
5. **修bug和调数值混在一起** — 一次改动同时修bug+调数值，分不清效果来源

### 核心原则

> 一次只做一件事。先确保测试工具准确，再用准确的工具去测数值。

---

## 二、流水线总览

```
Phase 0: 环境校准（一次性）
  → 确保1x和Nx速度下同一武器DPS误差<5%
  → 确保固定环境沙盒输出可复现

Phase 1: 纯数学建模（不写代码）
  → node tools/balance-model.js
  → 输出每武器 Lv10/20/30 的理论DPS + 倍率检查

Phase 2: 单元测试（验证代码=数学）
  → node tools/unit-test-damage.js
  → 验证 getDamage/getInterval/爽点 = 数学预期

Phase 3: 固定环境测试（验证沙盒=代码）
  → 浏览器 runFixedEnvTest()
  → 固定砖块HP+固定生成间隔，验证实测DPS≈理论DPS

Phase 4: 对比 & 调整
  → node tools/compare-model-vs-actual.js
  → 偏差<30% PASS，偏差>50% 排查bug
```

---

## 三、Phase 0: 环境校准

### 0.1 倍速精度测试

同一武器+同一环境，分别跑1x、5x、10x，对比DPS：

| 倍速 | 要求 |
|------|------|
| 1x   | 基准值 |
| 5x   | 与1x误差 < 5% |
| 10x  | 与1x误差 < 10% |

超过阈值则该倍速不可用于平衡测试。

### 0.2 固定环境沙盒（替代旧水位控制器）

**核心改变**：平衡测试不再用"动态水位控制"，改用**固定环境**：

```
砖块HP:       固定值 = baseAttack × getDmgMultiplier(shopLv) × HP_FACTOR
砖块生成:     固定间隔 1200ms/行（游戏时间）
砖块密度:     7列 × gapChance=8% ≈ 每行6.4个
无Boss:       跳过boss阶段
无经验/升级:  纯输出测试
```

**HP_FACTOR** 是唯一的调节旋钮：
- 太低 → 砖块秒杀，测不出差异
- 太高 → 砖块打不动，堆积到溢出
- 目标：武器大约需要3~8次命中击杀1砖

### 0.3 DPS计量

```
DPS = 总伤害 / 测量游戏时间（秒）
预热期 = 前10秒（不计入）
测量期 = 60秒
每组跑3次取平均（消除随机性）
标准差 < 均值的10% 才算可复现
```

---

## 四、Phase 1: 纯数学建模

### tools/balance-model.js

纯 Node.js 脚本，直接 require 配置文件：

```
输入：WeaponBalanceConfig + ShopCurveConfig + WeaponShopDefs
参数：baseAttack = 1（标准化）

每把武器输出：
  baseDmg(shopLv) = basePct × getDmgMultiplier(shopLv)
  CD(shopLv) = interval 或 sweetSpot 修正
  effectiveHits = 手动标定的常数（从AOE对照表查）
  theoryDPS = baseDmg × effectiveHits / (CD / 1000)

检查：
  ✅ 10→20 倍率在 ×2.0~×4.0
  ✅ 20→30 倍率在 ×2.0~×4.0
  ❌ 超出范围则标红，需要调参数
```

**effectiveHits 标定表**（固定环境下）：

| 武器 | 机制 | effectiveHits | 说明 |
|------|------|--------------|------|
| 冰爆弹 | AOE r=1.1列 | 6 | 查AOE对照表，常规密度 |
| 闪电链 | N链×衰减 | Σ(0.85^i) | 随链数变化 |
| 穿甲弹 | M发×P穿×衰减 | M×Σ(0.92^j) | 随齐射数变化 |
| 轰炸机 | B弹×H命中 | B×2 | 4弹×2=8 |

---

## 五、Phase 2: 单元测试

### tools/unit-test-damage.js

```
测试项：
1. getDamage(baseAttack=100, shopLv) 是否 = basePct × 100 × getDmgMultiplier(shopLv)
2. _getInterval(shopLv) 是否 = sweetSpot计算值（含下限）
3. 齐射数/链数/弹数 是否 = getSweetSpotValue()
4. 被动倍率是否在安全范围

全部 PASS 才进入 Phase 3。
```

---

## 六、Phase 3: 固定环境测试

### web/fixed-env-test.js

```js
输入：
  weapons: ['kunai','lightning','missile','meteor']
  levels: [10, 20, 30]
  speed: 5 (校准通过的倍速)
  duration: 60 (游戏秒)
  repeat: 3
  hpFactor: 5 (砖块HP = baseDmg × hpFactor)

输出(JSON)：
  每武器×每等级: { avgDps, runs:[N,N,N], stddev }
  倍率: { 10to20, 20to30 }
  Lv30排名 + 最强/最弱比
  PASS/FAIL 判定

通过标准：
  - 3次标准差 < 均值 10%
  - 10→20 在 ×2.0~×4.0
  - 20→30 在 ×2.0~×4.0
  - Lv30 最强/最弱 < 3x
```

---

## 七、数值调整规则

```
1. 先在 balance-model.js 里改参数，算出预期
2. 确认预期合理后，改 WeaponBalanceConfig.js（只改配置文件）
3. browserify 重新打包
4. 浏览器跑 fixed-env-test.js
5. 对比实测和预期，偏差<30%则通过
6. 每轮只改1个武器的1个参数
```

---

## 八、脚本清单

| 脚本 | 位置 | 功能 | 运行环境 |
|------|------|------|---------|
| balance-model.js | tools/ | 纯数学建模 | Node.js |
| unit-test-damage.js | tools/ | getDamage等单元测试 | Node.js |
| calibration-test.js | web/ | 倍速校准 | 浏览器 |
| fixed-env-test.js | web/ | **核心**：固定环境批量DPS测试 | 浏览器 |
| compare-model-vs-actual.js | tools/ | 模型vs实测对比 | Node.js |

---

## 九、执行顺序

### 首次执行
1. ✅ 写流水线文档
2. 实现 balance-model.js + unit-test-damage.js
3. 跑 Phase 1+2，确认数学和代码一致
4. 实现 fixed-env-test.js
5. 跑 Phase 0 校准（确定可用倍速）
6. 跑 Phase 3，拿到基线数据
7. 按需调整 → 重跑 Phase 1+3

### 后续每次调数值
```
改配置 → balance-model.js（1秒）→ browserify → fixed-env-test（3分钟）→ 对比 → 完成
```

---

*"流程比天赋重要。一套好流程能让猫猫稳定出活。"* 🐾
