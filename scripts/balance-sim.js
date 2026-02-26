#!/usr/bin/env node
/**
 * balance-sim.js - 纯数值平衡模拟器
 * 不需要渲染，只跑伤害计算逻辑
 * 
 * 用法: node scripts/balance-sim.js [章节] [秒数]
 * 默认: 70关 60秒
 */

const WEAPON_TREES = require('../src/config/WeaponDefs');

// ===== 配置 =====
const CHAPTER = parseInt(process.argv[2]) || 70;
const DURATION_SEC = parseInt(process.argv[3]) || 60;
const TICK_MS = 16.67;  // 60fps

// 砖块配置
const BRICK_BASE_HP = 10;
const BRICK_HP_SCALE = 0.06;  // 每章+6%
const SPAWN_INTERVAL_BASE = 2000;  // 基础生成间隔
const BRICKS_PER_SPAWN = 5;

// 飞机配置（满级）
const SHIP_TREE = {
  damage: { max: 5, perLevel: 0.2 },      // +20%伤害/级
  fireRate: { max: 5, perLevel: 0.15 },   // +15%射速/级
  thunder: { max: 3 },                     // 雷弹
};

// ===== 模拟状态 =====
let damageStats = {};
let bricks = [];
let brickIdCounter = 0;
let totalTime = 0;

// 武器状态
const weapons = {};
const weaponTimers = {};

// ===== 工具函数 =====
function getBaseAttack() {
  // 基础攻击 + 永久升级模拟
  return 1 + Math.floor(CHAPTER * 0.5);
}

function getBrickHp() {
  return BRICK_BASE_HP * (1 + (CHAPTER - 1) * BRICK_HP_SCALE);
}

function recordDamage(source, amount) {
  damageStats[source] = (damageStats[source] || 0) + amount;
}

function spawnBrick() {
  bricks.push({
    id: brickIdCounter++,
    hp: getBrickHp(),
    maxHp: getBrickHp(),
    shockStacks: 0,
    alive: true,
  });
}

function damageBrick(brick, damage, source) {
  if (!brick.alive) return;
  const actualDmg = Math.min(brick.hp, damage);
  brick.hp -= actualDmg;
  recordDamage(source, actualDmg);
  if (brick.hp <= 0) brick.alive = false;
}

// ===== 武器模拟 =====

// 闪电链
function simLightning(dt, baseAttack) {
  const def = WEAPON_TREES.lightning;
  const branches = { damage: 5, chain: 5, freq: 3, explode: 2, shock: 3, arc: 2 };
  
  weaponTimers.lightning = (weaponTimers.lightning || 0) + dt;
  const interval = def.interval * (1 - branches.freq * 0.15);
  
  if (weaponTimers.lightning >= interval) {
    weaponTimers.lightning = 0;
    
    const damage = baseAttack * def.basePct * (1 + branches.damage * 0.5);
    const chainCount = 3 + branches.chain * 2;  // 3 + 10 = 13跳
    
    // 主链伤害
    let hitCount = 0;
    for (const brick of bricks) {
      if (!brick.alive || hitCount >= chainCount) continue;
      
      damageBrick(brick, damage, 'lightning');
      hitCount++;
      
      // 感电叠层
      brick.shockStacks = Math.min(3, (brick.shockStacks || 0) + 1);
      
      // 雷电链弧（链式传导，0.2系数）
      const chainDmg = damage * 0.2;
      for (const other of bricks) {
        if (other.alive && other !== brick) {
          damageBrick(other, chainDmg, 'shock_chain');
          other.shockStacks = Math.min(3, (other.shockStacks || 0) + 1);
          break;
        }
      }
      
      // 闪电爆炸（30%几率）
      if (branches.explode > 0 && Math.random() < 0.3) {
        const explodeDmg = damage * 0.6;
        for (const other of bricks) {
          if (other.alive && other !== brick) {
            damageBrick(other, explodeDmg, 'lightning_explode');
            break;
          }
        }
      }
    }
  }
}

// 感电电弧触发（在每次伤害时检查）
function checkShockArc(brick, damage, baseAttack) {
  if (brick.shockStacks > 0 && Math.random() < 0.15) {
    const arcDmg = damage * 0.1 * brick.shockStacks;
    for (const other of bricks) {
      if (other.alive && other !== brick) {
        damageBrick(other, arcDmg, 'shock_arc');
        break;
      }
    }
  }
}

// 无人机
function simDrone(dt, baseAttack) {
  const def = WEAPON_TREES.drone;
  const branches = { damage: 5, speed: 3, count: 2, width: 2, arc: 2, overcharge: 1, pulse: 1 };
  
  weaponTimers.drone = (weaponTimers.drone || 0) + dt;
  const tickInterval = 300 / (1 + branches.speed * 0.3);
  
  if (weaponTimers.drone >= tickInterval) {
    weaponTimers.drone = 0;
    
    const droneCount = 2 + branches.count;
    const damage = baseAttack * def.basePct * (1 + branches.damage * 0.4);
    
    // 激光线伤害（每条线打多个砖块）
    const linesCount = (droneCount * (droneCount - 1)) / 2;
    let hitPerLine = Math.min(3, bricks.filter(b => b.alive).length);
    
    for (let line = 0; line < linesCount; line++) {
      let hitCount = 0;
      for (const brick of bricks) {
        if (!brick.alive || hitCount >= hitPerLine) continue;
        if (Math.random() < 0.6) {  // 60%几率被激光线命中
          damageBrick(brick, damage, 'drone_laser');
          hitCount++;
        }
      }
    }
    
    // 电弧
    if (branches.arc > 0) {
      const arcDmg = damage * 0.6;
      for (let a = 0; a < branches.arc * linesCount; a++) {
        for (const brick of bricks) {
          if (brick.alive && Math.random() < 0.3) {
            damageBrick(brick, arcDmg, 'drone_arc');
            break;
          }
        }
      }
    }
    
    // 过载
    if (branches.overcharge > 0 && droneCount >= 3) {
      const overDmg = damage * 2;
      for (const brick of bricks) {
        if (brick.alive && Math.random() < 0.2) {
          damageBrick(brick, overDmg, 'drone_cross');
        }
      }
    }
    
    // 脉冲
    weaponTimers.dronePulse = (weaponTimers.dronePulse || 0) + tickInterval;
    if (branches.pulse > 0 && weaponTimers.dronePulse >= 4000) {
      weaponTimers.dronePulse = 0;
      const pulseDmg = damage * 4;
      for (const brick of bricks) {
        if (brick.alive && Math.random() < 0.5) {
          damageBrick(brick, pulseDmg, 'drone_pulse');
        }
      }
    }
  }
}

// 离子射线
function simIonBeam(dt, baseAttack) {
  const def = WEAPON_TREES.ionBeam;
  const branches = { damage: 5, duration: 3, freq: 3, mark: 3, pierce: 2, split: 2, overload: 2, superOrb: 1 };
  
  weaponTimers.ionBeam = (weaponTimers.ionBeam || 0) + dt;
  const interval = def.interval * (1 - branches.freq * 0.2);
  
  // 射击状态
  if (!weapons.ionBeamFiring) {
    if (weaponTimers.ionBeam >= interval) {
      weapons.ionBeamFiring = true;
      weapons.ionBeamDuration = 3000 + branches.duration * 1000;
      weapons.ionBeamTarget = null;
      weapons.ionBeamMarks = 0;
      weaponTimers.ionBeam = 0;
    }
  } else {
    weapons.ionBeamDuration -= dt;
    
    // tick伤害 (每100ms一次)
    weaponTimers.ionBeamTick = (weaponTimers.ionBeamTick || 0) + dt;
    if (weaponTimers.ionBeamTick >= 100) {
      weaponTimers.ionBeamTick = 0;
      
      const tickDamage = baseAttack * def.basePct * (1 + branches.damage * 0.7);
      
      // 找目标
      if (!weapons.ionBeamTarget || !weapons.ionBeamTarget.alive) {
        weapons.ionBeamTarget = bricks.find(b => b.alive);
        weapons.ionBeamMarks = 0;
      }
      
      if (weapons.ionBeamTarget && weapons.ionBeamTarget.alive) {
        // 标记增伤
        let dmg = tickDamage;
        if (branches.mark > 0 && weapons.ionBeamMarks > 0) {
          dmg *= (1 + weapons.ionBeamMarks * 0.12 * branches.mark);
        }
        weapons.ionBeamMarks = Math.min(30, weapons.ionBeamMarks + 1);
        
        damageBrick(weapons.ionBeamTarget, dmg, 'ion_beam');
        
        // 穿透（较低几率）
        if (branches.pierce > 0 && Math.random() < 0.15) {
          const pierceDmg = dmg * 0.4;
          for (const brick of bricks) {
            if (brick.alive && brick !== weapons.ionBeamTarget) {
              damageBrick(brick, pierceDmg, 'ion_pierce');
              break;
            }
          }
        }
        
        // 溅射（较低几率）
        if (branches.split > 0 && Math.random() < 0.15) {
          const splitDmg = dmg * 0.25;
          for (const brick of bricks) {
            if (brick.alive && brick !== weapons.ionBeamTarget) {
              damageBrick(brick, splitDmg, 'ion_splash');
              break;
            }
          }
        }
      }
      
      // 过载脉冲（射击期间每800ms）
      weaponTimers.ionOverload = (weaponTimers.ionOverload || 0) + 100;
      if (branches.overload > 0 && weaponTimers.ionOverload >= 800) {
        weaponTimers.ionOverload = 0;
        const overDmg = tickDamage * (4 + branches.overload * 3);
        let hitCount = 0;
        for (const brick of bricks) {
          if (brick.alive && hitCount < 2 && Math.random() < 0.3) {
            damageBrick(brick, overDmg, 'ion_overload');
            hitCount++;
          }
        }
      }
    }
    
    // 射击结束
    if (weapons.ionBeamDuration <= 0) {
      weapons.ionBeamFiring = false;
      weaponTimers.ionBeamTick = 0;
      
      // 终结过载
      if (branches.overload > 0) {
        const tickDamage = baseAttack * def.basePct * (1 + branches.damage * 0.7);
        const endOverDmg = tickDamage * (6 + branches.overload * 5);
        let hitCount = 0;
        for (const brick of bricks) {
          if (brick.alive && hitCount < 3 && Math.random() < 0.4) {
            damageBrick(brick, endOverDmg, 'ion_overload_end');
            hitCount++;
          }
        }
      }
    }
  }
}

// 奇点引擎 - 简化模拟（基于实际能量累积机制）
function simGravityWell(dt, baseAttack) {
  const def = WEAPON_TREES.gravityWell;
  const branches = { damage: 5, horizon: 2, singularity: 2, negaEnergy: 3, darkMatter: 2, annihilate: 2, freq: 3, count: 2, lens: 2 };
  
  weaponTimers.gravityWell = (weaponTimers.gravityWell || 0) + dt;
  const interval = def.interval - branches.freq * 2000;  // 4000ms
  
  if (weaponTimers.gravityWell >= interval) {
    weaponTimers.gravityWell = 0;
    
    const wellCount = 1 + branches.count;  // 3个黑洞
    const duration = 3000 + branches.singularity * 1500;  // 6000ms
    const baseDmg = baseAttack * (def.basePct / 100);  // 14.4
    const lensMult = 1 + branches.lens * 0.12;  // 1.24
    const ticks = Math.floor(duration / 400);  // 15 ticks
    
    for (let w = 0; w < wellCount; w++) {
      // 黑洞基础tick伤害
      for (let t = 0; t < ticks; t++) {
        for (const brick of bricks) {
          if (brick.alive && Math.random() < 0.35) {
            damageBrick(brick, baseDmg * lensMult, 'gravity_well');
          }
        }
        
        // 事件视界（%HP伤害）
        if (branches.horizon > 0) {
          for (const brick of bricks) {
            if (brick.alive && Math.random() < 0.25) {
              let pctDmg = brick.maxHp * 0.02 * branches.horizon;
              pctDmg = Math.min(pctDmg, baseAttack * 8);
              damageBrick(brick, pctDmg, 'event_horizon');
            }
          }
        }
      }
      
      // 湮灭（基于全局能量累积 — 用全局统计的能量伤害估算）
      if (branches.negaEnergy > 0) {
        // 估算：离子射线 + 闪电链 + 无人机 的能量伤害
        const energyDmgSources = ['ion_beam', 'ion_pierce', 'ion_splash', 'ion_overload', 'lightning', 'shock_chain', 'drone_laser'];
        let totalEnergyDmg = 0;
        for (const src of energyDmgSources) {
          totalEnergyDmg += (damageStats[src] || 0);
        }
        
        // 每次黑洞只累积一小部分
        const negaRate = 0.06 + branches.negaEnergy * 0.1;  // 0.36
        const energyPerWell = totalEnergyDmg * 0.02 * negaRate;  // 2%能量转为负能量
        const negaHp = Math.max(10, energyPerWell);
        
        // 湮灭
        for (const brick of bricks) {
          if (brick.alive) {
            const dmg = Math.min(negaHp, brick.hp) * 0.7;
            damageBrick(brick, dmg, 'annihilate');
            
            // 湮灭溅射
            if (branches.annihilate > 0) {
              const splashDmg = dmg * 0.05 * branches.annihilate;
              for (const other of bricks) {
                if (other.alive && other !== brick && Math.random() < 0.5) {
                  damageBrick(other, splashDmg, 'annihilate_splash');
                }
              }
            }
            break;
          }
        }
      }
    }
  }
}

// 飞机子弹
function simPlaneBullets(dt, baseAttack) {
  weaponTimers.plane = (weaponTimers.plane || 0) + dt;
  const fireRate = 100 / (1 + SHIP_TREE.fireRate.max * SHIP_TREE.fireRate.perLevel);
  
  if (weaponTimers.plane >= fireRate) {
    weaponTimers.plane = 0;
    
    const damage = baseAttack * (1 + SHIP_TREE.damage.max * SHIP_TREE.damage.perLevel);
    
    // 射速×3，每次发射3发
    for (let shot = 0; shot < 3; shot++) {
      for (const brick of bricks) {
        if (brick.alive && Math.random() < 0.5) {
          damageBrick(brick, damage, 'plane_bullet');
          // 感电电弧触发
          if (brick.shockStacks > 0 && Math.random() < 0.15) {
            const arcDmg = damage * 0.1 * brick.shockStacks;
            for (const other of bricks) {
              if (other.alive && other !== brick) {
                damageBrick(other, arcDmg, 'shock_arc');
                break;
              }
            }
          }
          break;
        }
      }
    }
  }
}

// ===== 主循环 =====
function runSimulation() {
  console.log(`\n⚖ 平衡模拟器`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📍 章节: ${CHAPTER}`);
  console.log(`⏱ 时长: ${DURATION_SEC}秒`);
  console.log(`⚔ 基础攻击: ${getBaseAttack()}`);
  console.log(`💎 砖块HP: ${getBrickHp().toFixed(1)}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  
  const baseAttack = getBaseAttack();
  let spawnTimer = 0;
  
  // 初始砖块
  for (let i = 0; i < 20; i++) spawnBrick();
  
  // 模拟循环
  const totalTicks = (DURATION_SEC * 1000) / TICK_MS;
  
  for (let tick = 0; tick < totalTicks; tick++) {
    totalTime += TICK_MS;
    
    // 生成砖块
    spawnTimer += TICK_MS;
    if (spawnTimer >= SPAWN_INTERVAL_BASE) {
      spawnTimer = 0;
      for (let i = 0; i < BRICKS_PER_SPAWN; i++) spawnBrick();
    }
    
    // 清理死砖
    bricks = bricks.filter(b => b.alive);
    
    // 保持砖块数量
    while (bricks.length < 10) spawnBrick();
    
    // 武器更新
    simLightning(TICK_MS, baseAttack);
    simDrone(TICK_MS, baseAttack);
    simIonBeam(TICK_MS, baseAttack);
    simGravityWell(TICK_MS, baseAttack);
    simPlaneBullets(TICK_MS, baseAttack);
  }
  
  // 输出结果
  printResults();
}

function printResults() {
  const entries = Object.entries(damageStats).sort((a, b) => b[1] - a[1]);
  const totalDmg = entries.reduce((sum, e) => sum + e[1], 0);
  
  // 按武器分组
  const weaponGroups = {
    '闪电链': ['lightning', 'shock_chain', 'lightning_explode', 'shock_arc'],
    '无人机': ['drone_laser', 'drone_arc', 'drone_cross', 'drone_pulse'],
    '离子射线': ['ion_beam', 'ion_pierce', 'ion_splash', 'ion_overload', 'ion_overload_end'],
    '奇点引擎': ['gravity_well', 'event_horizon', 'annihilate', 'annihilate_splash'],
    '飞机子弹': ['plane_bullet'],
  };
  
  const groupTotals = {};
  for (const [group, sources] of Object.entries(weaponGroups)) {
    groupTotals[group] = sources.reduce((sum, src) => sum + (damageStats[src] || 0), 0);
  }
  
  console.log(`📊 武器伤害占比`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  
  const sortedGroups = Object.entries(groupTotals).sort((a, b) => b[1] - a[1]);
  for (const [group, dmg] of sortedGroups) {
    const pct = ((dmg / totalDmg) * 100).toFixed(1);
    const bar = '█'.repeat(Math.floor(pct / 2));
    const status = pct >= 18 && pct <= 22 ? '✅' : (pct > 25 ? '⬇️' : '⬆️');
    console.log(`${status} ${group.padEnd(8)} ${pct.padStart(5)}% ${bar}`);
  }
  
  console.log(`\n总伤害: ${formatNum(totalDmg)}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  
  // 详细伤害
  console.log(`📋 详细伤害来源`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  
  for (const [src, dmg] of entries) {
    const pct = ((dmg / totalDmg) * 100).toFixed(1);
    console.log(`  ${src.padEnd(20)} ${formatNum(dmg).padStart(10)} (${pct}%)`);
  }
}

function formatNum(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(2) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toFixed(0);
}

// 运行
runSimulation();
