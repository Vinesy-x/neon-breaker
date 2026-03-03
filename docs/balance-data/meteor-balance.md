# 轰炸机（Meteor）平衡记录

## 当前配置
- basePct: 12
- interval: 12000
- sweetSpot: CD base=12000 delta=-1500 → Lv30 CD=3000ms → ×4.0 频率
- branches (24pts): damage(10)+bombs(3)+radius(3)+napalm(2)+carpet(2)+escort(2)+incendiary(1)+b52(1)
- passives: fireBomb(6)/napalmBelt(14)/scorchEarth(22)/doublePass(26)/nuke(30)
- shop解锁: escort(Lv2), incendiary(Lv10), b52(Lv18)

## 基线沙盒数据 (@10x 120s targetAlive=60)

| ShopLv | DPS | 状态 |
|--------|-----|------|
| 1 | 482.6 | ❌ ×4.5~5.9 超标 |
| 10 | 2,559 | ❌ ×1.7~5.2 超标 |
| 20 | 37,526 | ❌ ×5.0~12.9 严重超标 |
| 30 | 328,103 | ❌ ×9.7~14.9 严重超标 |

### Lv30 伤害来源
- bomber: 37,461,296 (95%)
- bomber_napalm: 1,911,083 (5%)

## 诊断
1. **basePct=12** 是其他武器的 4~80 倍
2. **sweetSpot ×4.0** 频率乘数（其他武器 ×2.0~×3.0）
3. **doublePass(Lv26)** = 直接 ×2 DPS（双轨轰炸）
4. **nuke(Lv30)** = 范围×3 伤害×5（核弹级被动）
5. Lv20→30 ×8.7 增长太陡

## 待调整方案（未实施）
- basePct 12→~2.2
- sweetSpot delta -1500→-1000（Lv30 CD ×2.0 而非 ×4.0）
- doublePass/nuke 需要削弱或重设计
- 目标: Lv30 对齐 22K~34K 区间

## 状态: ⏸ 等待排期
