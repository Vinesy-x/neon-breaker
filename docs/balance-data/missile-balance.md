# 穿甲弹（Missile）平衡记录

## 当前配置
```
basePct: 2.8, interval: 4500, damageType: physical
分支总点数: 24 (damage10+pierce2+salvo3+dotExploit1+twinCannon2+shockwave2+deepPierce2+hyperVelocity1+twinCannonAdv1)
爽点: salvo型, base=1发, delta=1发
解锁: Lv2:deepPierce, Lv10:hyperVelocity, Lv18:twinCannonAdv
```

## 被动一览
| Lv | Key | 名称 | 效果 | 代码验证 |
|----|-----|------|------|---------|
| 6 | armorBreak | 碎甲标记 | 命中降防10%持续3秒 | ✅ |
| 14 | pierceNoDecay | 穿透不衰减 | 穿透不再降低伤害 | ✅ |
| 22 | pierceBonus | 穿透+3 | 基础穿透数额外+3 | ✅ |
| 26 | shockwaveUp | 冲击波强化 | 溅射伤害30%→100% | ✅ |
| 30 | doomPierce | 毁灭穿甲 | 穿透10个后全列爆炸 | ✅ |

## 模型预测（n=1.25, 被动×1.25）

分支解锁: Lv2:deepPierce(2), Lv10:hyperVelocity(1), Lv18:twinCannonAdv(1)
- Lv1: 19pts(基础), Lv10: 22pts(+deepPierce), Lv20: 23pts(+hyperVelocity), Lv30: 24pts(+twinCannonAdv)

爽点: salvo型 base=1, delta=1 → 乘数=发数/基础发数

| ShopLv | 分支点 | 分支乘数 | 共享曲线 | 爽点 | 被动 | 预测DPS |
|--------|--------|---------|---------|------|------|---------|
| 1 | 19 | ×69.4 | ×1.00 | ×1.0 | ×1.0(0) | 69 |
| 10 | 22 | ×135.5 | ×2.10 | ×3.0 | ×1.25(1) | 1,067 |
| 20 | 23 | ×169.4 | ×4.90 | ×5.0 | ×1.56(2) | 6,485 |
| 30 | 24 | ×211.8 | ×8.90 | ×7.0 | ×3.05(5) | 40,225 |

注意：穿甲弹爽点是salvo(+1发/5级)，乘数增长很猛(Lv30=×7.0)，导致模型预测Lv30极高。

## 调参历史
| 轮次 | 改动 | Lv1 | Lv10 | Lv20 | Lv30 |
|------|------|-----|------|------|------|
| R0(当前) | basePct=2.8 | 88 | 1,589 | 6,744 | 31,024 |

## 最终实测 vs 模型（R0, @10x 120s noShip）
| ShopLv | 模型 | 实测 | 误差 | 状态 |
|--------|------|------|------|------|
| 1 | 69 | 88 | +28% | ✅ |
| 10 | 1,067 | 1,589 | +49% | ⚠️偏高(shockwave占比大) |
| 20 | 6,485 | 6,744 | +4% | ✅ 完美 |
| 30 | 40,225 | 31,024 | -23% | ✅ |

## 曲线特征
- 中期偏强型：pierceNoDecay@Lv14 使穿透伤害不衰减，中期DPS跃升
- Lv30=31K 与回旋刃(31K)、冰爆弹(34K)同档
- shockwave 溅射占比高（Lv10约39%，Lv30约58%）
- doomPierce@Lv30 全列爆炸实际贡献仅约2%（触发条件苛刻）

## 结论：R0即接受，无需调参 ✅

