# 🎯 无限飞机 · 数值平衡框架

> 从设计者角度出发的完整数值体系，告别手测盲调

---

## 一、核心公式一览

### 砖块 HP 公式（已有）
```
HP = floor( baseHP × chapterScale × timeCurve × typeMult × formMult )

baseHP      = 1 + (chapter-1) × 0.3
chapterScale = 1 + (chapter-1) × 0.04
timeCurve   = [tMin, tMax] 随机，按阶段递增
typeMult    = normal:1.0 / fast:0.7 / shield:1.2 / split:0.8 / stealth:0.6 / healer:0.5
formMult    = 阵型1.3 / 非阵型1.0
```

### 武器伤害公式（已有）
```
伤害 = baseAttack × basePct × (1 + damageLv × 0.5)

baseAttack = 1 + 攻击力升级加成
basePct    = 武器定义的基础倍率（见下表）
```

### ⭐ 缺的关键环节：DPS 预算 ← 本文档核心

---

## 二、DPS 预算体系

### 2.1 设计目标

**核心原则：砖块的 HP 增长速度 = 玩家 DPS 增长速度 × 难度系数**

```
                    DPS                HP
时间   ────────────────────    ────────────────
warmup    玩家刚进场，0武器     HP低，只有1个武器在输出
wave1     1-2个武器生效         HP开始爬升
surge1    武器开始升级          HP加速，密度增加
wave2     3-4个武器在线         HP大跳（第二波）
sprint    武器接近满级          HP到顶
boss      全火力               Boss独立数值
```

### 2.2 每分钟 DPS 预算表

**假设：章节1，baseAttack=1，所有武器0级**

| 武器 | basePct | interval(ms) | 理论DPS(每秒) | 占比目标 |
|------|---------|-------------|---------------|----------|
| 飞机子弹（主炮） | - | 持续 | 基准线 | 35-45% |
| 光能寒冰弹 kunai | 2.0 | 2700 | 2.0/2.7≈0.74 | 8-12% |
| 闪电链 lightning | 1.5 | 3000 | 1.5/3.0=0.50 | 6-10% |
| 穿甲弹 missile | 8.0 | 2500 | 8.0/2.5=3.20 ×衰减 | 15-20% |
| 轰炸机 meteor | 6.0 | 8000 | 6.0×4弹/8.0=3.0 | 8-12% |
| 无人机 drone | 1.2 | 450 | 1.2/0.45=2.67 | 10-15% |
| 回旋刃 spinBlade | 0.8 | 8000/200tick | ~4.0/8.0=0.5 | 5-8% |
| 白磷弹 blizzard | 1.0 | 7000 | DOT持续 | 5-8% |
| 离子射线 ionBeam | 3.2 | 4500 | 脉冲型 | 8-12% |
| 寒冰发生器 frostStorm | 40.0 (墙HP) | 6000 | 间接(碰撞) | 5-10% |
| 奇点引擎 gravityWell | 40.0 (%HP) | 10000 | 间接(吸引) | 5-10% |

> **注意**：上表是"理论单武器DPS"，实际一局中玩家有多把武器同时运作

### 2.3 阶段 DPS 预算

```
阶段         时间段        砖块HP范围(ch1)    需要总DPS
──────────────────────────────────────────────────────
warmup       0-20s         0.8-1.0           ~1.0/s（主炮够用）
wave1        20-55s        1.2-1.8           ~2.0/s（+1把武器）
surge1       55-85s        2.5-4.0           ~4.0/s（+2把武器）
breather1    85-100s       1.5-2.5           休息期
wave2        100-145s      4.0-6.0           ~6.0/s（3-4把武器+升级）
highpres     145-190s      6.0-8.0           ~8.0/s（接近满配）
breather2    190-210s      3.5-4.5           休息期
wave3        210-260s      7.0-10.0          ~10.0/s（全武器在线）
sprint       260-380s      9.0-13.0          ~12.0/s（武器满级）
boss         480s+         独立              全力输出
```

**关键等式：**
```
所需总DPS ≈ (砖块平均HP × 每秒生成砖块数) / 期望存活砖块行数

每秒生成砖块数 ≈ BRICK_COLS / (spawnInterval/1000) × spawnMult
期望存活行数 ≈ 屏幕高度内同时可见 8-12 行
```

---

## 三、武器 DPS 系数表

### 3.1 统一 DPS 计算方法

为了横向对比，所有武器统一按以下方式计算 **"标准化 DPS"**：

```javascript
// 计算武器标准化DPS（每秒每baseAttack的伤害输出）
function weaponDPS(basePct, interval, hitCount, damageLv) {
  var dmgMult = 1 + damageLv * 0.5;
  return (basePct * dmgMult * hitCount) / (interval / 1000);
}
```

### 3.2 各武器 DPS 缩放表

**damageLv=0 → damageLv=5 的DPS增长**

| 武器 | Lv0 DPS | Lv1 | Lv2 | Lv3 | Lv4 | Lv5 | 增长倍数 |
|------|---------|-----|-----|-----|-----|-----|----------|
| 寒冰弹 | 0.74 | 1.11 | 1.48 | 1.85 | 2.22 | 2.59 | ×3.5 |
| 闪电链 | 0.50 | 0.75 | 1.00 | 1.25 | 1.50 | 1.75 | ×3.5 |
| 穿甲弹 | 3.20 | 4.80 | 6.40 | 8.00 | 9.60 | 11.20 | ×3.5 |
| 轰炸机(4弹) | 3.00 | 4.50 | 6.00 | 7.50 | 9.00 | 10.50 | ×3.5 |
| 无人机 | 2.67 | 4.00 | 5.33 | 6.67 | 8.00 | 9.33 | ×3.5 |
| 回旋刃 | ~0.50 | 0.75 | 1.00 | 1.25 | 1.50 | 1.75 | ×3.5 |
| 白磷弹 | DOT | - | - | - | - | - | 看DOT |
| 离子射线 | 脉冲 | - | - | - | - | - | 看持续 |

**观察**：所有武器 damage 分支都是 +50%/级，所以 Lv0→Lv5 恒定 ×3.5 倍增长。
**问题**：这意味着武器之间的 DPS 差距在 Lv0 就决定了，升级不会改变相对排名！

### 3.3 ⚠️ 发现的失衡点

#### 问题1: 穿甲弹 basePct=8.0 远高于其他
穿甲弹 Lv0 DPS=3.2，是闪电链的 6.4 倍！即使考虑衰减(decayRate=0.15)，每发平均命中3-5块砖，有效DPS仍然远超。

**建议**：穿甲弹的高倍率是为了"单发打一列"的定位，但需要考虑：
- 实际穿透命中数 × 衰减后的平均倍率
- 与其他武器的对比应基于"有效DPS"而非面板DPS

#### 问题2: 无人机 interval=450ms 持续输出
无人机是持续型武器，Lv0 DPS=2.67 已经很高，而且没有CD期。
当 count 分支升级后（2→3→4→5台），DPS 翻 2-3 倍。

**建议**：关注 无人机满分支 的 DPS 占比是否超标

#### 问题3: 冰霜/奇点 是间接伤害，难以用 DPS 衡量
- 冰墙 basePct=40 是"墙的HP"，不是伤害倍率
- 黑洞 basePct=40 也是"吸引力"参数

**建议**：这两个武器需要用"间接贡献值"衡量（控制时间、墙消耗砖块数）

---

## 四、数值平衡工具

### 4.1 DPS 追踪器（埋点代码）

在 Game.js 中添加 DPS 追踪：

```javascript
// === DPS TRACKER ===
// 在 Game 构造函数中
this._dpsTracker = {};
this._dpsStartTime = 0;

// 在 damageBrick 或类似方法中
_trackDamage(source, amount) {
  if (!this._dpsTracker[source]) this._dpsTracker[source] = 0;
  this._dpsTracker[source] += amount;
}

// 定时输出（每10秒）
_printDPS() {
  var elapsed = (Date.now() - this._dpsStartTime) / 1000;
  if (elapsed < 1) return;
  var total = 0;
  var lines = [];
  for (var key in this._dpsTracker) {
    var dps = this._dpsTracker[key] / elapsed;
    total += dps;
    lines.push(key + ': ' + dps.toFixed(2) + '/s');
  }
  lines.push('--- TOTAL: ' + total.toFixed(2) + '/s');
  lines.forEach(function(l) {
    var pct = parseFloat(l.split(':')[1]) / total * 100;
    console.log(l + (pct ? ' (' + pct.toFixed(1) + '%)' : ''));
  });
}
```

### 4.2 平衡验证检查表

每次调整数值后跑一局标准测试：

```
□ 章节1通关时间在 6-8 分钟？
□ warmup 期（0-20s）主炮能清场？
□ surge1 期（55-85s）开始有压力？
□ sprint 期（260s+）确实很难但不绝望？
□ 没有单武器 DPS 占比 > 35%？
□ 没有武器 DPS 占比 < 3%（沦为装饰品）？
□ Boss 击杀时间 30-60 秒？
□ 回旋刃+白磷弹 DOT 没有叠加爆炸？
```

---

## 五、推荐调整方案

### 方案A: 微调倍率（保守）
维持现有体系，只调个别武器的 basePct：

| 武器 | 当前 basePct | 建议 | 原因 |
|------|-------------|------|------|
| 穿甲弹 | 8.0 | 6.0 | DPS过高，5穿+衰减15%依然碾压 |
| 闪电链 | 1.5 | 2.0 | DPS偏低，提高存在感 |
| 回旋刃 | 0.8 | 1.2 | DPS过低，存在感弱 |
| 其他 | 不变 | - | 相对平衡 |

### 方案B: 引入"有效DPS"系统（推荐）
不同武器有不同的"有效命中率"，真实DPS = 面板DPS × 有效命中率：

```
武器         面板DPS   有效命中率   有效DPS    备注
────────────────────────────────────────────────
主炮         基准      1.0         基准       持续打最前排
寒冰弹       0.74      0.9(AOE)    0.67       爆炸范围大
闪电链       0.50      0.8(链)     0.40       可能打空
穿甲弹       3.20      0.6(衰减)   1.92       衰减15%×5=~60%总伤
轰炸机       3.00      0.7(覆盖)   2.10       不一定全覆盖
无人机       2.67      0.85(持续)  2.27       接近持续命中
回旋刃       0.50      0.7(弹墙)   0.35       有时打空区
```

### 方案C: 分阶段动态缩放（进阶）
武器的 basePct 随阶段变化，早期武器伤害占比高，后期下降：

```javascript
function getScaledPct(weapon, phase) {
  var phaseMult = {
    warmup: 1.0,    // 前期足额
    wave1: 0.95,
    surge1: 0.9,
    wave2: 0.85,    // 中期衰减（因为武器多了）
    sprint: 0.8,    // 后期再衰减
  };
  return weapon.basePct * (phaseMult[phase] || 1.0);
}
```
**好处**：防止武器多了以后总DPS爆炸
**风险**：玩家感知到"武器变弱了"会不爽

---

## 六、章节缩放验证

### 玩家攻击力 vs 砖块HP 增长对比

```
章节   baseAttack(假设)   砖块平均HP     HP/攻击比    感受
─────────────────────────────────────────────────────
ch1    1.0               1.0            1.0         基准
ch5    1.5               2.2×1.16=2.55  1.7         略难
ch10   2.0               3.7×1.36=5.03  2.5         明显难
ch20   3.0               6.7×1.76=11.8  3.9         很难
ch50   5.0               15.7×2.96=46.5 9.3         ⚠️ 差距巨大！
ch100  8.0               30.7×4.96=152  19.0        ⚠️ 几乎不可能
```

**问题**：砖块 HP 增长是二次方（baseHP × chapterScale 两个线性相乘），
而玩家攻击力增长是线性的 → 后期差距指数扩大！

**建议**：
- 要么让玩家攻击力也二次方增长（升级费用对应调整）
- 要么压缩 chapterScale 的斜率（0.04 → 0.02）
- 要么 ch50+ 引入新的 DPS 来源（觉醒/新武器/合体技）

---

## 七、DPS 预算配置表（可直接用）

```javascript
// BalanceBudget.js - DPS 预算配置
var DPS_BUDGET = {
  // 各武器的DPS占比目标
  targetShare: {
    bullet:     0.40,  // 主炮 40%
    kunai:      0.10,  // 寒冰弹 10%
    lightning:  0.08,  // 闪电链 8%
    missile:    0.15,  // 穿甲弹 15%
    meteor:     0.08,  // 轰炸机 8%
    drone:      0.12,  // 无人机 12%
    spinBlade:  0.05,  // 回旋刃 5%
    blizzard:   0.05,  // 白磷弹 5%（DOT）
    ionBeam:    0.10,  // 离子射线 10%
    frostStorm: 0.05,  // 冰霜（间接）5%
    gravityWell:0.05,  // 奇点（间接）5%
    // 注：占比加起来>100% 是因为不是所有武器同时在线
  },
  
  // 允许偏差
  tolerance: 0.05,  // ±5% 内可接受
  alertThreshold: 0.10,  // 超过10% 需要调整
  
  // 每阶段总DPS目标（基于ch1）
  phaseDPS: {
    warmup: 1.0,
    wave1: 2.0,
    surge1: 4.0,
    wave2: 6.0,
    highpres: 8.0,
    wave3: 10.0,
    sprint: 12.0,
  },
};

module.exports = DPS_BUDGET;
```

---

*创建: 2026-02-27 by 阿喵 🐱*
*基于: WeaponDefs.js + ChapterConfig.js + BrickFactory.js 实际代码分析*
*参考: 弹壳特攻队数值体系 + 腾讯GWB数值策划 + Roguelike DPS Budget 理论*
