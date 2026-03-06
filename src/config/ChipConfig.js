/**
 * ChipConfig.js - 芯片系统配置表
 * 纯数据，无逻辑代码
 * 
 * QUALITIES: 品质定义（颜色/名称/数值倍率区间）
 * PARTS: 飞机部件定义（名称/图标/解锁章节）
 * AFFIX_POOL: 各部位词条池（74种词条）
 * SLOTS_PER_PART: 每个部件的芯片槽数
 */

// ============================================================
// 品质定义
// multiplier: [min, max] 基于白色基础值的倍率区间
// ============================================================
const QUALITIES = {
  white:  { color: '#AAAAAA', name: '普通', multiplier: [1.0, 1.0] },
  green:  { color: '#44CC44', name: '精良', multiplier: [1.5, 1.8] },
  blue:   { color: '#4488FF', name: '稀有', multiplier: [2.0, 2.5] },
  purple: { color: '#BB44FF', name: '史诗', multiplier: [3.0, 3.8] },
  orange: { color: '#FF8800', name: '传说', multiplier: [4.5, 5.5] },
  red:    { color: '#FF2222', name: '至尊', multiplier: [6.0, 7.0] },
};

// ============================================================
// 部件定义
// unlock: 解锁所需章节（1=初始）
// ============================================================
const PARTS = {
  fireControl: { name: '火控系统', icon: '🔫', unlock: 1 },
  powerCore:   { name: '动力炉',   icon: '🔋', unlock: 1 },
  armorBay:    { name: '装甲模块', icon: '🛡', unlock: 1 },
  mobility:    { name: '机动引擎', icon: '💨', unlock: 15 },
  tactical:    { name: '战术链路', icon: '📡', unlock: 30 },
  expansion:   { name: '改装坞',   icon: '🔩', unlock: 50 },
};

// ============================================================
// 词条池
// id: 唯一标识
// name: 显示名
// format: 数值显示格式（N=数值占位）
// baseValue: 白色品质基础值（实际值 = baseValue × 品质倍率）
// redOnly: true = 红色专属词条（低品质不会出）
//
// 特殊说明：
//   百分比词条 baseValue 为小数（0.02 = 2%）
//   整数词条 baseValue 为整数（1 = +1层/次/秒等）
//   regen_interval 特殊：数值越低越好，倍率反向使用
// ============================================================

const AFFIX_POOL = {

  // ──────────────────────────────────────────
  // 🔫 火控系统（18种：16通用 + 2红色专属）
  // ──────────────────────────────────────────
  fireControl: [
    // --- 通用伤害 ---
    { id: 'all_dmg',          name: '全武器伤害',     format: '+N%', baseValue: 0.02, redOnly: false },
    { id: 'crit_rate',        name: '暴击率',         format: '+N%', baseValue: 0.01, redOnly: false },
    { id: 'crit_dmg',         name: '暴击伤害',       format: '+N%', baseValue: 0.05, redOnly: false },
    { id: 'fire_rate',        name: '射速',           format: '+N%', baseValue: 0.02, redOnly: false },
    { id: 'boss_dmg',         name: '对Boss伤害',     format: '+N%', baseValue: 0.03, redOnly: false },
    { id: 'shield_pierce',    name: '无视护盾',       format: '+N%', baseValue: 0.02, redOnly: false },
    { id: 'kill_explode',     name: '击杀爆炸概率',   format: '+N%', baseValue: 0.03, redOnly: false },
    // --- 武器专精 ---
    { id: 'phys_dmg',         name: '物理武器伤害',   format: '+N%', baseValue: 0.04, redOnly: false },
    { id: 'fire_wpn_dmg',     name: '火焰武器伤害',   format: '+N%', baseValue: 0.04, redOnly: false },
    { id: 'ice_wpn_dmg',      name: '寒冰武器伤害',   format: '+N%', baseValue: 0.04, redOnly: false },
    { id: 'energy_wpn_dmg',   name: '能量武器伤害',   format: '+N%', baseValue: 0.04, redOnly: false },
    { id: 'melee_dmg',        name: '近战武器伤害',   format: '+N%', baseValue: 0.05, redOnly: false },
    { id: 'ranged_dmg',       name: '远程武器伤害',   format: '+N%', baseValue: 0.03, redOnly: false },
    // --- 机制新增 ---
    { id: 'bullet_pierce',    name: '子弹穿透',       format: '+N层', baseValue: 1,   redOnly: false },
    { id: 'bullet_split',     name: '子弹分裂概率',   format: '+N%', baseValue: 0.03, redOnly: false },
    { id: 'ammo_save',        name: '弹药节省概率',   format: '+N%', baseValue: 0.03, redOnly: false },
    // --- 红色专属 ---
    { id: 'execute',          name: '秒杀(血量<N%瞬杀)',         format: 'N%',  baseValue: 0.05, redOnly: true },
    { id: 'chain_lightning',  name: '连锁闪电(击杀弹射N次)',     format: 'N次', baseValue: 3,    redOnly: true },
  ],

  // ──────────────────────────────────────────
  // 🔋 动力炉（16种：13通用 + 3红色专属）
  // ──────────────────────────────────────────
  powerCore: [
    // --- 元素伤害 ---
    { id: 'fire_ele_dmg',     name: '火属性伤害',     format: '+N%', baseValue: 0.03, redOnly: false },
    { id: 'ice_ele_dmg',      name: '冰属性伤害',     format: '+N%', baseValue: 0.03, redOnly: false },
    { id: 'energy_ele_dmg',   name: '能量属性伤害',   format: '+N%', baseValue: 0.03, redOnly: false },
    { id: 'dual_ele_dmg',     name: '元素武器≥2时伤害', format: '+N%', baseValue: 0.04, redOnly: false },
    { id: 'all_ele_dmg',      name: '全元素伤害',     format: '+N%', baseValue: 0.02, redOnly: false },
    // --- 元素效果 ---
    { id: 'burn_chance',      name: '攻击附带燃烧概率', format: '+N%', baseValue: 0.03, redOnly: false },
    { id: 'freeze_chance',    name: '攻击附带冰冻概率', format: '+N%', baseValue: 0.02, redOnly: false },
    { id: 'burn_dmg',         name: '燃烧伤害',       format: '+N%', baseValue: 0.04, redOnly: false },
    { id: 'freeze_dur',       name: '冰冻持续时间',   format: '+N%', baseValue: 0.10, redOnly: false },
    { id: 'burn_stack',       name: '燃烧叠加上限',   format: '+N层', baseValue: 1,   redOnly: false },
    { id: 'freeze_slow',      name: '冰冻减速效果',   format: '+N%', baseValue: 0.05, redOnly: false },
    // --- 机制新增 ---
    { id: 'ele_spread',       name: '元素效果扩散',   format: '+N格', baseValue: 1,   redOnly: false },
    { id: 'dual_ele_explode', name: '双元素触发时爆炸', format: '+N%攻击', baseValue: 0.30, redOnly: false },
    // --- 红色专属 ---
    { id: 'ele_dot_dmg',      name: '元素DOT伤害',    format: '+N%', baseValue: 0.25, redOnly: true },
    { id: 'ele_ignore_resist', name: '元素免疫穿透(无视抗性)', format: 'N%', baseValue: 1.00, redOnly: true },
    { id: 'ele_mastery',      name: '元素精通(全元素效果+N%)', format: '+N%', baseValue: 0.15, redOnly: true },
  ],

  // ──────────────────────────────────────────
  // 🛡 装甲模块（14种：11通用 + 3红色专属）
  // ──────────────────────────────────────────
  armorBay: [
    // --- 基础防御 ---
    { id: 'max_hp',           name: '最大生命',       format: '+N%', baseValue: 0.02, redOnly: false },
    { id: 'shield',           name: '护盾值',         format: '+N%', baseValue: 0.03, redOnly: false },
    { id: 'damage_reduce',    name: '减伤',           format: '+N%', baseValue: 0.01, redOnly: false },
    { id: 'reflect',          name: '受击反弹伤害',   format: '+N%', baseValue: 0.03, redOnly: false },
    // --- 回复 ---
    { id: 'kill_heal',        name: '击杀回复生命',   format: '+N%', baseValue: 0.001, redOnly: false },
    { id: 'regen_interval',   name: '每N秒回1%生命',  format: 'N秒', baseValue: 60,   redOnly: false },
    { id: 'hit_heal',         name: '受击回复生命(5秒CD)', format: '+N%', baseValue: 0.01, redOnly: false },
    // --- 机制新增 ---
    { id: 'shield_break_explode', name: '护盾破碎时爆炸', format: '+N%攻击', baseValue: 0.30, redOnly: false },
    { id: 'hit_invincible',   name: '受伤时概率获得1秒无敌', format: '+N%', baseValue: 0.03, redOnly: false },
    { id: 'low_hp_dmg',       name: '血量<30%时伤害', format: '+N%', baseValue: 0.05, redOnly: false },
    { id: 'thorns',           name: '荆棘(受击对周围造成伤害)', format: '+N%', baseValue: 0.02, redOnly: false },
    // --- 红色专属 ---
    { id: 'cheat_death',      name: '免死1次(每局)',   format: 'N次', baseValue: 1,    redOnly: true },
    { id: 'dmg_over_time',    name: '受伤转化为DOT(3秒内承受)', format: 'N%转化', baseValue: 0.50, redOnly: true },
    { id: 'shield_regen',     name: '护盾不灭(每10秒恢复1层)', format: '自动回盾', baseValue: 1, redOnly: true },
  ],

  // ──────────────────────────────────────────
  // 💨 机动引擎（12种：9通用 + 3红色专属）
  // ──────────────────────────────────────────
  mobility: [
    // --- 基础机动 ---
    { id: 'move_speed',       name: '移速',           format: '+N%', baseValue: 0.03, redOnly: false },
    { id: 'dodge',            name: '闪避概率',       format: '+N%', baseValue: 0.01, redOnly: false },
    { id: 'pickup_range',     name: '拾取范围',       format: '+N%', baseValue: 0.05, redOnly: false },
    { id: 'slow_aura',        name: '周围敌人减速',   format: '+N%', baseValue: 0.03, redOnly: false },
    // --- 机制新增 ---
    { id: 'hit_speed_boost',  name: '受击后加速(1秒)', format: '+N%', baseValue: 0.15, redOnly: false },
    { id: 'fire_trail',       name: '冲刺留下火痕',   format: '+N秒', baseValue: 1,   redOnly: false },
    { id: 'move_shockwave',   name: '停下释放冲击波', format: '+N%攻击', baseValue: 0.50, redOnly: false },
    { id: 'pickup_speed',     name: '拾取时加速(0.5秒)', format: '+N%', baseValue: 0.10, redOnly: false },
    { id: 'move_shield',      name: '每移动N像素获得护盾', format: 'N像素', baseValue: 500, redOnly: false },
    // --- 红色专属 ---
    { id: 'teleport',         name: '传送(击杀概率闪现到安全区)', format: 'N%', baseValue: 0.04, redOnly: true },
    { id: 'afterimage',       name: '分身残影(移动留下攻击影子)', format: '+N%攻击', baseValue: 0.30, redOnly: true },
    { id: 'bullet_time',      name: '子弹时间(受击全屏慢速2秒,15sCD)', format: 'N秒', baseValue: 2, redOnly: true },
  ],

  // ──────────────────────────────────────────
  // 📡 战术链路（14种：11通用 + 3红色专属）
  // ──────────────────────────────────────────
  tactical: [
    // --- 收益 ---
    { id: 'coin_drop',        name: '金币掉落',       format: '+N%', baseValue: 0.03, redOnly: false },
    { id: 'exp_gain',         name: '经验获取',       format: '+N%', baseValue: 0.03, redOnly: false },
    { id: 'drop_quality',     name: '掉落品质提升',   format: '+N%', baseValue: 0.02, redOnly: false },
    // --- 辅助 ---
    { id: 'tac_crit_rate',    name: '暴击率',         format: '+N%', baseValue: 0.01, redOnly: false },
    { id: 'skill_cdr',        name: '技能CD',         format: '-N%', baseValue: 0.02, redOnly: false },
    { id: 'start_level',      name: '初始等级',       format: '+N',  baseValue: 1,    redOnly: false },
    { id: 'boss_delay',       name: 'Boss出现延迟',   format: '+N秒', baseValue: 5,   redOnly: false },
    { id: 'wpn_exp',          name: '武器经验获取',   format: '+N%', baseValue: 0.05, redOnly: false },
    // --- 机制新增 ---
    { id: 'extra_choice',     name: '三选一升级多N个选项', format: '+N', baseValue: 1, redOnly: false },
    { id: 'boss_extra_chip',  name: 'Boss掉落额外芯片', format: '+N个', baseValue: 1, redOnly: false },
    { id: 'start_invincible', name: '战斗开始无敌',   format: '+N秒', baseValue: 3,   redOnly: false },
    // --- 红色专属 ---
    { id: 'all_wpn_upgrade',  name: '全武器同时升级(选1个全体+1)', format: '全体+1', baseValue: 1, redOnly: true },
    { id: 'time_accel',       name: '时间加速(游戏速度+N%,奖励+N%)', format: '+N%', baseValue: 0.20, redOnly: true },
    { id: 'treasure_radar',   name: '宝箱雷达(每30秒标记隐藏奖励)', format: 'N秒', baseValue: 30, redOnly: true },
  ],

  // ──────────────────────────────────────────
  // 🔩 改装坞 = 所有其他部位词条合并（运行时生成）
  // ──────────────────────────────────────────
  expansion: null, // ChipManager 初始化时合并所有部位词条池
};

// ============================================================
// 每个部件的芯片槽数
// ============================================================
const SLOTS_PER_PART = 5;

module.exports = {
  QUALITIES,
  PARTS,
  AFFIX_POOL,
  SLOTS_PER_PART,
};
