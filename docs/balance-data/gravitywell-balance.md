# 奇点引擎（GravityWell）平衡记录

## 当前配置（2026-03-03 R7）
```
basePct: 0.2
interval: 14000 (CD), sweetSpot: CD减少 -800ms/档
tickInterval: 400ms
baseDuration: 5000ms
baseRadius: 120px
damageType: energy
```

## 分支设计（共25点, 实际可分配19点@Lv1）
| 分支 | 最大等级 | 效果 | 点数 |
|------|---------|------|------|
| damage | 10 | +50%/级 tick伤害 | 10 |
| horizon | 2 | 距中心越近伤害越高: Lv1中心+50%, Lv2中心+100% | 2 |
| singularity | 2 | 范围+20px/级 + pullBonus(范围内砖数×2%/级, 硬上限+50%) | 2 |
| negaEnergy | 3 | 转化率10%/级, 击败砖块概率生成黑洞体 | 3 |
| sustain | 2 | 击败砖块延长黑洞: 300ms/杀@Lv1, 500ms/杀@Lv2, 总延长上限=1×原始duration | 2 |
| negaShield | 2 | 20%/级概率消耗仅50% negaEnergy | 2 |
| annihilate | 2 | 湮灭冲击波 (shopLv10解锁) | 2 |
| lens | 2 | 引力透镜+12%/级 (shopLv18解锁) | 2 |

## 被动一览
| Lv | Key | 名称 | 效果 |
|----|-----|------|------|
| 6 | siphon | 虹吸 | 引力范围内砖块受伤+20% |
| 14 | singBurst | 奇点爆发 | 黑洞结束爆炸累积伤害8% |
| 22 | gravityX2 | 引力倍增 | 吸力×2 |
| 26 | binarySystem | 双星系统 | 同时+1个黑洞 |
| 30 | superHole | 超级黑洞 | 持续×2+可吸收弹幕 |

## DPS数据（basePct=0.2, R7）

### 全等级测试
| 测试 | DPS | 八武器参考区间 | 状态 |
|------|-----|---------------|------|
| 无分支 Lv1 | 2.8 | ~1.0 | 偏高×2.8 |
| 全分支 Lv1 | 62 | 83~107 | 略低 |
| 全分支 Lv10 | 365 | 496~1,589 | 偏低 |
| 全分支 Lv20 | 2,660 | 2,149~7,437 | 中间 ✅ |
| 全分支 Lv30 | 14,346 | 15,298~33,779 | 低端 ✅ |

### Lv30伤害构成
| 来源 | DPS | 占比 |
|------|-----|------|
| tick伤害 | 1,922 | 13% |
| burst(奇点爆发) | 8,344 | 58% |
| negaBrick | 1,045 | 7% |
| negaBrick_splash | 3,035 | 21% |

### 逐分支诊断（Lv1 basePct=8时）
| 分支 | 点数 | DPS | 相对基准 |
|------|------|-----|---------|
| 无分支(基准) | 0 | 106 | ×1.0 |
| damage×10 | 10 | 356 | ×3.4 |
| singularity×2 | 2 | 239 | ×2.3 |
| sustain×2 | 2 | 179 | ×1.7 |
| negaEnergy×3 | 3 | 147 | ×1.4 |
| horizon×2 | 2 | 154 | ×1.5 |
| dmg10+hor2 | 12 | 776 | ×7.3 |
| dmg10+sing2 | 12 | 1,453 | ×13.7 |
| 全分支 | 19 | 4,961 | ×46.8 |

## 调参历史
| 轮次 | 改动 | 结果 |
|------|------|------|
| R0 | basePct=2.6, count分支, singBurst=50% | f1=11.9 |
| R1 | basePct=8 校准nb1=1.0 | nb1=1.0✅ |
| R2 | singBurst 50%→8% | burst占比96%→68% |
| R3 | count→sustain(击杀延长持续) | 修复count无效问题 |
| R4 | pullBonus bug修(累积→per-tick) | — |
| R5 | horizon 1.0→0.5/级, sustain总量上限, pullBonus cap ×1.5 | f1=4961(仍高) |
| R6 | damage 15%→50%/级(修正设计值) | 逐分支诊断完成 |
| R7 | basePct 8→0.2 (AOE总DPS校准) | nb1=2.8, f1=62, f30=14346 |

## 关键经验
1. **AOE武器DPS = 总伤害/时间**, 每tick打N个砖天然放大N倍
2. **singularity范围增大 = 隐性AOE倍率**, 不只是pullBonus
3. **sustain + pullBonus正反馈**: 需双重上限(总延长量+pullBonus cap)
4. **沙盒自定义branches**: `opts.branches = {damage:10}` 逐分支测试
