# 无人机（Drone）平衡记录

## 最终配置 (commit eb6b898+)
- basePct: 0.15
- interval: (默认)
- superDrone: +25%/+50% (max=2, Lv10解锁)
- overcharge: +30%/+60% per交汇线 (max=2, Lv2解锁)
- frequency: 射频+15%/级 (max=2, Lv1默认)
- pulse: ×12 @2s (max=1, Lv18解锁)
- annihilate: AOE ×机数×10 @1s (Lv30被动)
- crossfire: ×1.3 交叉点伤害 (Lv22被动)
- matrixPlus: +2机 (Lv26被动)

## 最终沙盒数据 (@10x 120s targetAlive=60)

| ShopLv | DPS | 分支(pts) | 被动 |
|--------|-----|-----------|------|
| 1 | 93 | damage10,count3,width2,deploy2,freq2 (19) | 无 |
| 10 | 845 | +superDrone2,overcharge2 (23) | shield@6 |
| 20 | 4,317 | +pulse1 (24) | +focus@14 |
| 30 | 21,734 | 同上 (24) | +crossfire@22,matrixPlus@26,annihilate@30 |

## Lv30 伤害来源
- drone_cross: 47% (过载交汇)
- drone_laser: 25% (基础激光)
- drone_pulse: 17% (脉冲AOE)
- drone_annihilate: 10% (歼灭)

## 调整历史
1. v4: crossfire ×1.5→×3.0, basePct 0.25→0.30 → Lv30=8,312 太低
2. v5: annihilate→AOE×10, pulse×12@2s, basePct→0.22 → Lv30=33,603 但Lv1=244太高
3. v6: superDrone去shopGated → Lv30=85,593 全面超标
4. v8: superDrone加shopGated, basePct→0.15 → Lv30=31,987 但分支解锁有bug
5. v11: 修复沙盒WSD.WEAPON_SHOP路径bug → Lv30=43,084
6. v12: superDrone +50%/+100%→+25%/+50% → Lv30=41,971
7. final: crossfire ×3.0→×1.3 → Lv30=21,734 ✅
