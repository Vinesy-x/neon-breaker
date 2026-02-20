/**
 * PowerUp.js - v6.0 掉落系统（金币 + 技能宝箱）
 * 砖块击碎 → 金币(100%) + 技能宝箱(低概率+冷却)
 */
const Config = require('./Config');

class PowerUp {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.type = type; // 'coin' | 'skillCrate'
    this.size = Config.POWERUP_SIZE;
    this.speed = Config.POWERUP_SPEED;
    this.alive = true;
    this.time = 0;

    if (type === 'coin') {
      this.color = '#FFD700';
      this.icon = '●';
      this.size = 10;
    } else {
      this.color = '#FF14FF';
      this.icon = '📦';
      this.size = 22;
      this.speed = 1.5; // 宝箱掉慢一点
    }
  }

  update(dt, magnetTarget) {
    this.time += dt;

    if (magnetTarget) {
      const dx = magnetTarget.x - this.x;
      const dy = magnetTarget.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 5) {
        const magnetSpeed = this.type === 'skillCrate' ? 5 : 4;
        this.x += (dx / dist) * magnetSpeed * dt;
        this.y += (dy / dist) * magnetSpeed * dt;
      }
    } else {
      this.y += this.speed * dt;
    }
  }

  collideLauncher(launcher) {
    return (
      this.y + this.size / 2 >= launcher.y &&
      this.y - this.size / 2 <= launcher.y + launcher.height &&
      this.x + this.size / 2 >= launcher.x &&
      this.x - this.size / 2 <= launcher.x + launcher.width
    );
  }

  isOutOfBounds(bottomY) {
    return this.y - this.size / 2 > bottomY;
  }
}

/**
 * 生成掉落物
 * @param {number} x
 * @param {number} y
 * @param {number} lastCrateTime - 上次宝箱掉落时间戳
 * @param {number} now - 当前时间戳(ms)
 * @returns {{ items: PowerUp[], crateDropped: boolean }}
 */
function generateDrops(x, y, lastCrateTime, now) {
  const items = [];
  let crateDropped = false;

  // 金币（高概率）
  if (Math.random() < Config.COIN_DROP_CHANCE) {
    items.push(new PowerUp(x + (Math.random() - 0.5) * 10, y, 'coin'));
  }

  // 技能宝箱（低概率 + 冷却控制）
  const cooldownOk = (now - lastCrateTime) >= Config.SKILL_CRATE_COOLDOWN;
  if (cooldownOk && Math.random() < Config.SKILL_CRATE_CHANCE) {
    items.push(new PowerUp(x, y - 5, 'skillCrate'));
    crateDropped = true;
  }

  return { items, crateDropped };
}

module.exports = { PowerUp, generateDrops };
