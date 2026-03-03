# 武器平衡数据目录

> neon-breaker 全武器平衡记录 | 2026-02-28 ~ 2026-03-03

## 文档结构

```
balance-data/
├── README.md                  ← 本文件（索引）
├── BALANCE_WORKFLOW.md        ← 标准5阶段平衡流程
├── branch-multiplier-model.md ← 分支乘数模型(n=1.25)
├── 5weapon-summary.md         ← 九武器DPS总览表
├── multi-weapon-test.md       ← 双/三武器联合测试
│
├── 单武器平衡记录
│   ├── lightning-balance.md   ← 闪电链 ✅
│   ├── kunai-balance.md       ← 冰爆弹 ✅
│   ├── missile-balance.md     ← 穿甲弹 ✅
│   ├── meteor-balance.md      ← 轰炸机 ✅
│   ├── drone-balance.md       ← 无人机 ✅
│   ├── spinblade-balance.md   ← 回旋刃 ✅
│   ├── blizzard-balance.md    ← 白磷弹 ✅
│   ├── ionbeam-balance.md     ← 离子射线 ✅ (单体定位)
│   ├── gravitywell-balance.md ← 奇点引擎 ✅ (basePct=1)
│   └── froststorm-balance.md  ← 寒冰发生器 ❌ (碰撞机制待重设计)
```

## 平衡状态总览

| 武器 | key | basePct | interval | 状态 |
|------|-----|---------|----------|------|
| 闪电链 | lightning | 0.83 | 3800 | ✅ 已平衡 |
| 冰爆弹 | kunai | 2.6 | 6000 | ✅ 已平衡 |
| 穿甲弹 | missile | 2.8 | — | ✅ 已平衡 |
| 轰炸机 | bomber | 2.6 | — | ✅ 已平衡 |
| 无人机 | drone | 0.15 | — | ✅ 已平衡 |
| 回旋刃 | spinBlade | 0.25 | 10000 | ✅ 已平衡 |
| 白磷弹 | blizzard | — | — | ✅ 已平衡 |
| 离子射线 | ionBeam | 0.8 | — | ✅ 单体定位 |
| 奇点引擎 | gravityWell | 1 | 14000 | ✅ AOE辅助 |
| 寒冰发生器 | frostStorm | — | — | ❌ 阻塞 |

## 平衡模型
- DPS = baseAttack × basePct% × shopDmgMult × sweetSpot × passiveMult × branchMult
- 分支: n=1.25/点，全武器统一
- 被动: ×1.25/个，5个被动@Lv30 = ×3.05
- 共享曲线: dmgMultPerBracket = [0.10, 0.20, 0.30, 0.40, 0.50]

## 关键结论
1. 9把武器Lv30 DPS范围: 15K~73K (最强/最弱 ≈ ×2.4)
2. 双武器搭配占比 40-60% 为健康区间
3. 三武器Lv30正常区间: 67K~97K
4. 奇点引擎+离子的singBurst协同可达290K(已知特性)
5. 沙盒damageBySource是总伤害，avgDps才是真DPS
