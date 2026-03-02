# 沙盒测试规范 v6

> 本文档是 DPSSandbox 的**唯一设计规范**。重写脚本时以此为准。

---

## 一、架构

```
web/entry.js             ← 唯一入口：创建 Game + 注册全局 API
src/debug/DPSSandbox.js  ← 唯一沙盒引擎
web/bundle.js            ← browserify 编译产物
web/wx-shim.js           ← 微信API适配层（保留）
web/index.html           ← 宿主页面
```

**禁止**在 `web/` 下放其他测试脚本。所有测试通过 `__dpsSandbox()` 调用完成。

---

## 二、全局 API

entry.js 暴露以下全局函数，**不暴露其他任何东西**：

```js
window.__game                           // Game 实例引用
window.__dpsSandbox(opts)               // 启动沙盒测试 → 返回状态字符串
window.__stopSandbox()                  // 手动停止
window.__sandboxReport()                // 获取最后一次报告（纯文本）
window.__sandboxResult()                // 获取最后一次结构化结果（JSON对象）
```

---

## 三、调用参数

```js
__dpsSandbox({
  weapon:      'kunai',     // 必填。武器key 或 'all'
  shopLv:      1,           // 商店等级，默认1
  duration:    120,         // 测量时长（秒），默认120
  speed:       10,          // 游戏倍速，默认10
  targetAlive: 60,          // 水位目标存活砖块数，默认60
  fullBranch:  true,        // 点满所有非shopGated分支，默认true
  shipTree:    true,        // 点满飞机树非shopGated分支，默认true
})
```

### 关键参数说明

| 参数 | 说明 |
|------|------|
| `weapon` | 锁定测试武器。非该武器一律不加入，升级三选一只出该武器分支 |
| `shopLv` | 设置商店等级 → 影响：共享伤害曲线、爽点属性值、被动技能解锁 |
| `speed` | 游戏时间倍速。推荐10x |
| `fullBranch` | true=满分支测理论上限；false=0分支测基线 |

---

## 四、沙盒环境屏蔽项

### 4.1 必须屏蔽

| 项目 | 方式 | 原因 |
|------|------|------|
| **存档读取** | 初始化前 `localStorage.clear()` | 防止旧存档污染 |
| **武器上限** | `Config.MAX_WEAPONS = 99` | 允许加载任意武器 |
| **新武器解锁** | hook `addWeapon`，拦截非指定武器 | 不会意外获得其他武器 |
| **砖块自然生成** | 替换 `_updateBrickSpawn` 为空函数 | 由水位控制器接管 |
| **掉落物生成** | `_sandboxMode = true` | 跳过经验球/道具掉落 |
| **玩家死亡** | `_devInvincible = true` | 无敌 |
| **渲染优化** | `_sandboxMode` 标志 | 高倍速不卡 |

### 4.2 必须保留

| 项目 | 原因 |
|------|------|
| **伤害计算全链路** | combat.damageBrick 正常走，只加钩子统计 |
| **Buff系统** | 灼烧/冰缓/感电正常触发 |
| **武器AI（AutoBattle）** | 自动选择攻击目标 |
| **物理碰撞** | 子弹/砖块碰撞正常 |

### 4.3 需要正确初始化

| 项目 | 方式 |
|------|------|
| **商店等级** | 根据 `shopLv` 设置：共享曲线、爽点属性、被动技能 |
| **武器分支** | `fullBranch=true` 时点满所有非 shopGated 分支 |
| **飞机树** | `shipTree=true` 时点满非 shopGated/非 exclusive 分支 |
| **初始砖块** | 铺约 targetAlive/2 数量的砖块 |

---

## 五、商店等级系统

沙盒必须正确模拟商店等级效果：

```
根据 shopLv 计算并设置：
  a. 共享伤害倍率 = WeaponShopDefs.getDmgMultiplier(shopLv)
  b. 爽点属性值 = WeaponShopDefs.getSweetSpotValue(weapon, shopLv)
  c. 被动技能列表 = WeaponShopDefs.getPassives(weapon, shopLv)
```

通过 UpgradeManager 或直接写入 save 数据生效。

---

## 六、水位控制器

**目标**：维持屏幕上约 `targetAlive` 个存活砖块。

### 控制逻辑（每1000ms游戏时间）

```
ratio = alive / targetAlive

ratio < 0.5   → 双行补砖 + HP ×1.12
ratio < 0.8   → 单行补砖 + HP ×1.05
ratio 0.8~1.1 → 正常补砖，HP不变
ratio 1.1~1.5 → 停止补砖
ratio > 1.5   → 停止补砖
```

### 预热与稳定检测

```
稳定条件：ratio 连续 5 次在 0.7~1.3 范围内
预热完成 → 清零所有统计 → 开始正式测量
```

---

## 七、数据收集

### 伤害钩子
- hook `combat.damageBrick` → 累计 totalDamage + 按source分类 + 检测击杀

### Buff钩子
- hook `applyBurn/applyChill/applyShock` → 统计触发次数 + 冻结转化率

### 快照（每5秒游戏时间）
```js
{ time, avgDps, intervalDps, alive, hp, kills }
```

---

## 八、输出格式

### `__sandboxReport()` — 纯文本
人类阅读用。包含核心指标、武器汇总、伤害源、Buff统计、时间线。

### `__sandboxResult()` — 结构化 JSON
程序化取数用：

```js
{
  weapon: 'kunai',
  shopLv: 1,
  speed: 10,
  duration: 120,
  fullBranch: true,
  avgDps: 1.5,
  stableDps: 1.4,
  peakDps: 2.1,
  totalDamage: 180,
  kills: 50,
  avgAlive: 62,
  stableHp: 15.3,
  warmupSec: 12,
  measureSec: 120,
  damageBySource: { ... },
  weaponDamage: { ... },     // 归类后
  buffEvents: { ... },
  snapshots: [ ... ],
}
```

---

## 九、阿喵调用规范

### 标准测试（3 calls）

```
1. evaluate: __dpsSandbox({weapon:'kunai', shopLv:1, duration:120, speed:10})
2. exec: sleep 25
3. evaluate: JSON.stringify(__sandboxResult())
```

### sleep 时间计算

```
实际等待 = duration / speed + 预热(约10s) + 余量(3s)
例：120s / 10x = 12s + 10s + 3s = 25s
```

**不要轮询。一次注入 → sleep 足够 → 一次取。**

---

## 十、注意事项

1. **清存档**：每次 reload 前 `localStorage.clear()`
2. **单例**：同时只有一个沙盒运行，start() 自动 stop() 上一次
3. **entry.js 不 require 测试脚本**：只注册 API
4. **报告在内存**：reload 后消失（正确行为）
5. **Config 引用一致性**：确认 UpgradeManager 和沙盒用同一份 Config
