# 白磷弹（Blizzard）平衡记录

## 最终配置（R3）
```
basePct: 0.25, interval: 8000, damageType: fire
分支总点数: 25 (damage10+radius3+duration3+count2+frostbite2+slow2+shatter2+permafrost1)
爽点: duration型, base=3s, delta=0.5s
```

## 被动一览
| Lv | Key | 名称 | 效果 |
|----|-----|------|------|
| 6 | extraCount | 白磷弹+1 | 每次多发射1颗 |
| 14 | fireSpread | 火焰蔓延 | 燃烧tick对区域外1.6倍范围砖块造成80%溅射伤害 |
| 22 | burnBlast | 白磷溅射 | 燃烧区结束时爆炸(400%伤害) |
| 26 | burnBoost | 烈焰强化 | 燃烧伤害×2.5 |
| 30 | burnExtra | 白磷覆盖 | 每次额外+3颗白磷弹 |

## 模型预测（n=1.25, 被动×1.25）
| ShopLv | 分支点 | 局外倍率 | 分支乘数 | 预测DPS |
|--------|--------|---------|---------|---------|
| 1 | 20 | ×1.00 | ×87 | 87 |
| 10 | 24 | ×3.50 | ×212 | 741 |
| 20 | 25 | ×12.75 | ×265 | 3,378 |
| 30 | 25 | ×54.3 | ×265 | 14,379 |

## 调参历史
| 轮次 | 改动 | Lv1 | Lv10 | Lv20 | Lv30 |
|------|------|-----|------|------|------|
| R0(原) | basePct=2.8 | 1,025 | 5,560 | 15,436 | 77,088 |
| R1 | basePct=0.25 | 102 | 433 | 1,313 | 6,546 |
| R2 | +fireSpread实现, burnBoost×2.0, burnBlast×3.0, burnExtra+3 | 95 | 490 | 1,823 | 14,274 |
| R3 | burnBoost×2.5, fireSpread溅射0.8, burnBlast×4.0 | 94 | 514 | 2,149 | 21,333 |

## 最终实测 vs 模型（R3, @10x 120s noShip）
| ShopLv | 模型 | 实测 | 误差 |
|--------|------|------|------|
| 1 | 87 | 94 | +8% ✅ |
| 10 | 741 | 514 | -31% ⚠️ |
| 20 | 3,378 | 2,149 | -36% ⚠️ |
| 30 | 14,379 | 21,333 | +48% ⚠️ |

## 曲线特征
- 后期爆发型：Lv22~30三个强被动(burnBlast+burnBoost+burnExtra)集中爆发
- 前中期偏低于模型预测（extraCount+fireSpread的实际贡献不如理论×1.25）
- Lv30偏高于模型（后期被动叠加效果超出×1.25假设）
- 最终Lv30=21.3K，与无人机(21.7K)、闪电链(22.0K)同档

## Bug修复
- **fireSpread@Lv14完全未实现** → 新增溅射伤害代码
- burnBlast/burnBoost/burnExtra均已验证生效

## 关键代码改动
- basePct: 2.8 → 0.25
- fireSpread: 新增实现（区域外1.6倍范围，80%溅射）
- burnBlast: ×2.0 → ×4.0
- burnBoost: ×1.5 → ×2.5
- burnExtra: +2弹 → +3弹
