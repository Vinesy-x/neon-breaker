# 霓虹碎核 - 武器设计文档

*最后更新: 2026-02-21*

---

## 通用设计原则

### 伤害公式
```
实际伤害 = baseAttack × basePct × (1 + damageLv × 0.5) × 其他乘数
```
- `baseAttack`: 玩家基础攻击力
- `basePct`: 武器基础伤害百分比
- `damageLv`: 伤害分支等级（每级+50%）

### 冷却机制
- **标准模式**: 释放后立即开始冷却
- **持续型武器**: 持续时间结束后才进入冷却（如旋刃）

### 升级树设计
- 基础分支: 无前置，直接可升
- 进阶分支: 需要前置条件
- 终极分支: 多前置，强力效果

---

## 1. 光能迫击炮 (kunai)

**定位**: AOE范围输出，适合清密集砖块

| 属性 | 值 |
|------|-----|
| icon | 💣 |
| color | #00FFFF |
| basePct | 1.2 |
| interval | 1800ms |

### 升级分支

| 分支 | 名称 | 描述 | 最大等级 | 前置 |
|------|------|------|----------|------|
| damage | 伤害 | +50%基础伤害 | 5 | - |
| count | 弹数 | +1发炮弹 | 3 | - |
| aoe | 爆炸范围 | +25%爆炸半径，弹体变大 | 3 | - |
| speed | 冷却缩减 | -20%技能CD | 3 | - |
| pierce | 穿透 | 穿透砖块，最后一击爆炸 | 2 | count:2 |
| pierceBlast | 穿透爆炸 | 每次穿透都爆炸 | 1 | pierce:2 |
| homing | 制导 | 炮弹追踪最近砖块 | 2 | speed:2 |
| chain | 连锁爆炸 | 被击杀砖块也会爆炸 | 2 | aoe:2, damage:2 |
| giant | 巨型弹头 | 弹体+爆炸范围翻倍 | 1 | aoe:3, pierce:2 |

### 推荐Build
- **AOE流**: damage → aoe → chain → giant
- **穿透流**: count → pierce → pierceBlast
- **速射流**: speed → homing → count

---

## 2. 闪电链 (lightning)

**定位**: 链式传导，适合分散目标

| 属性 | 值 |
|------|-----|
| icon | ⚡ |
| color | #FFF050 |
| basePct | 2.0 |
| interval | 1800ms |

### 升级分支

| 分支 | 名称 | 描述 | 最大等级 | 前置 |
|------|------|------|----------|------|
| damage | 伤害 | +50%基础伤害 | 5 | - |
| chains | 链数 | +1跳跃目标 | 4 | - |
| freq | 频率 | -20%冷却 | 3 | - |
| paralyze | 麻痹 | 命中减速30% | 2 | chains:2 |
| storm | 雷暴 | 同时释放2道闪电 | 2 | freq:2 |
| charge | 蓄能 | 每次链跳+25%伤害 | 2 | chains:2 |
| shock | 感电 | 命中留DOT(30%/秒×2秒) | 2 | damage:2 |
| echo | 回响 | 链末端20%再次释放 | 2 | chains:3 |
| overload | 超载 | 链末端爆炸AOE | 1 | chains:4, damage:3 |

### 推荐Build
- **连锁流**: chains → charge → echo → overload
- **DOT流**: damage → shock → freq
- **控制流**: chains → paralyze → storm

---

## 3. 追踪导弹 (missile)

**定位**: 精准打击，单体高伤

| 属性 | 值 |
|------|-----|
| icon | 🚀 |
| color | #FF14FF |
| basePct | 1.5 |
| interval | 3500ms |

### 升级分支

| 分支 | 名称 | 描述 | 最大等级 | 前置 |
|------|------|------|----------|------|
| damage | 直击伤害 | +50%直击伤害 | 4 | - |
| blastPower | 爆炸伤害 | +50%爆炸伤害 | 4 | - |
| count | 数量 | +1发导弹 | 3 | - |
| aoe | 爆炸范围 | +25%AOE | 3 | - |
| tracking | 追踪性能 | +30%转向 | 2 | - |
| split | 分裂弹 | 命中后分裂3小弹 | 2 | count:2 |
| nuke | 核弹头 | 巨型爆炸+屏震 | 1 | aoe:3, blastPower:3 |

### 推荐Build
- **爆炸流**: blastPower → aoe → nuke
- **分裂流**: count → split → tracking
- **混合流**: damage → blastPower → aoe

### 设计说明
- 直击伤害和爆炸伤害独立升级
- 直击: `baseAttack × 1.5 × (1 + damageLv × 0.5)`
- 爆炸: `baseAttack × 0.5 × (1 + blastLv × 0.5)`

---

## 4. 天降陨石 (meteor)

**定位**: 随机大范围AOE，高爆发

| 属性 | 值 |
|------|-----|
| icon | ☄ |
| color | #FF8800 |
| basePct | 2.5 |
| interval | 4000ms |

### 升级分支

| 分支 | 名称 | 描述 | 最大等级 | 前置 |
|------|------|------|----------|------|
| damage | 伤害 | +50%基础伤害 | 5 | - |
| count | 数量 | +1颗陨石 | 3 | - |
| radius | 范围 | +25%爆炸范围 | 3 | - |
| freq | 频率 | -15%冷却 | 3 | - |
| burn | 燃烧 | 落点留火焰地带 | 2 | damage:2 |
| rain | 陨石雨 | 同时砸下一排 | 1 | count:3, freq:2 |

### 推荐Build
- **覆盖流**: count → radius → rain
- **燃烧流**: damage → burn → freq

---

## 5. 战术无人机 (drone)

**定位**: 激光阵型，持续切割

| 属性 | 值 |
|------|-----|
| icon | 🤖 |
| color | #50FFB4 |
| basePct | 0.8 |
| interval | 300ms (tick间隔) |

### 核心机制
- 无人机飞到砖块区域自主布阵
- 全连接图激光网：2台=1线，3台=3线(△)，4台=6线(◇)，5台=10线(★)
- 智能追踪：每台独立追踪高权重砖块(y越大权重越高)

### 升级分支

| 分支 | 名称 | 描述 | 最大等级 | 前置 |
|------|------|------|----------|------|
| damage | 伤害 | +50%激光伤害 | 5 | - |
| count | 阵列 | +1台(2→3△→4◇→5★) | 3 | - |
| speed | 机动 | 阵型移动+tick频率提升30% | 3 | - |
| width | 光束 | 激光变粗+判定+40% | 2 | damage:2 |
| deploy | 部署 | 阵型半径+25,追踪更准 | 2 | count:1 |
| arc | 电弧 | 激光线释放电弧扩大范围 | 2 | count:2 |
| overcharge | 过载 | 阵型中心交叉点伤害×2 | 1 | count:2, damage:3 |
| focus | 聚焦 | 激光对低HP砖额外伤害+80% | 2 | damage:3, width:1 |
| pulse | 脉冲 | 每4秒阵型范围AOE爆发×4 | 1 | damage:4, arc:2 |

### 推荐Build
- **阵型流**: count → deploy → arc → pulse
- **聚焦流**: damage → width → focus
- **速切流**: speed → count → overcharge

---

## 6. 等离子旋刃 (spinBlade)

**定位**: 后排清扫器，单体大招型武器

| 属性 | 值 |
|------|-----|
| icon | 🌀 |
| color | #AA44FF |
| basePct | 0.5 |
| interval | 6000ms (冷却) |
| tickInterval | 200ms |

### 核心机制

**两阶段移动：**
1. **上冲阶段**: 从飞机发射，vy=-3.5快速冲顶
2. **横扫阶段**: 到达顶部后横向移动，智能追踪砖块密度高的区域

**冷却机制：**
- 持续型武器：旋刃存在时不计时
- 所有旋刃消失后才开始6秒冷却
- 冷却结束后发射下一把

**默认贯穿：**
- 每tick命中所有接触的砖块

**滞留/分裂互斥：**
- 滞留: 结束后原地旋转继续输出
- 分裂: 结束后炸出小旋刃

### 升级分支

| 分支 | 名称 | 描述 | 最大等级 | 前置 |
|------|------|------|----------|------|
| damage | 伤害 | +50%基础伤害 | 5 | - |
| duration | 续航 | +2秒存在时间 | 3 | - |
| giant | 巨型化 | 旋刃变大+判定范围↑ | 3 | - |
| pierce | 锋锐 | 贯穿伤害+30% | 1 | damage:2 |
| shockwave | 回旋斩 | 弹墙时释放环形刀气波 | 2 | damage:2 |
| ramp | 蓄势 | 存活每秒+12%伤害 | 3 | duration:2 |
| bleed | 撕裂 | 命中留DOT(15%/秒×2秒) | 2 | damage:3 |
| linger | 滞留 | 结束后原地旋转2秒 | 2 | duration:2, giant:1 |
| split | 分裂 | 结束后分裂2个小旋刃 | 2 | duration:2, damage:2 |
| superBlade | 超级旋刃 | 华丽特效+伤害频率翻倍 | 1 | giant:3, damage:3 |

### 数值细节
- 基础持续时间: 10秒（满级续航16秒）
- 基础体积: 20（满级巨型化50）
- 感知范围: 200px
- 垂直速度上限: 0.6（限制上下弹跳）
- 水平速度下限: 0.8（保持横向滑动）
- 分裂刃: 3-4个，持续5-8秒，75%体积

### 推荐Build
- **蓄势流**: duration → ramp → giant → superBlade
- **撕裂流**: damage → bleed → pierce
- **分裂流**: duration → damage → split（注意与滞留互斥）
- **滞留流**: duration → giant → linger

### 视觉效果
- **普通**: 4叶紫色旋刃
- **蓄势**: 紫→白渐变（存活越久越亮）
- **超级旋刃**: 6叶 + 外圈旋转虚线光环 + 轨道粒子 + 双层核心
- **回旋斩**: 弹墙时释放紫色扩散圆环

---

## 伤害统计来源标识

| 标识 | 中文名 | 来源 |
|------|--------|------|
| kunai | 光能迫击炮 | 炮弹直击 |
| kunai_blast | 迫击AOE | 爆炸范围伤害 |
| kunai_chain | 迫击连锁 | 连锁爆炸 |
| lightning | 闪电链 | 主链伤害 |
| lightning_blast | 闪电爆炸 | 超载终结爆炸 |
| shock | 感电 | 闪电DOT |
| missile | 追踪导弹 | 直击伤害 |
| missile_blast | 导弹爆炸 | 爆炸范围伤害 |
| meteor | 天降陨石 | 陨石伤害 |
| fire_dot | 燃烧DOT | 火焰地带 |
| drone | 无人机阵 | 激光线伤害 |
| drone_arc | 无人机电弧 | 电弧扩展伤害 |
| drone_cross | 无人机过载 | 交叉点伤害 |
| drone_pulse | 无人机脉冲 | AOE爆发伤害 |
| spinBlade | 等离子旋刃 | 旋刃tick伤害 |
| spinBlade_sw | 回旋斩 | 弹墙刀气波 |
| bleed | 撕裂DOT | 旋刃撕裂效果 |

---

## 平衡目标

理想伤害占比分布（全武器满级）：
- 迫击炮系: 20-25%
- 闪电链系: 15-20%
- 导弹系: 15-20%
- 陨石系: 10-15%
- 无人机系: 15-20%
- 旋刃系: 10-15%

单一武器不应超过30%，避免一家独大。
