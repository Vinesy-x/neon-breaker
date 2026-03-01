/**
 * ElementSystem.js - 元素效果桥接层 v2.0
 * 
 * 飞机元素弹的效果施加入口
 * 实际buff逻辑全部委托给 BuffSystem
 */
const Sound = require('./SoundManager');

class ElementSystem {
  constructor(game) {
    this.game = game;
  }

  /**
   * 根据元素类型施加效果
   * @param {string} element - 'fire' | 'ice' | 'thunder'
   * @param {Brick} brick - 目标砖块
   * @param {number} elementLv - 元素等级（决定叠加层数）
   * @param {number} bulletDmg - 子弹伤害（雷电电弧用）
   */
  applyElement(element, brick, elementLv, bulletDmg) {
    if (!brick || !brick.alive) return;
    var bs = this.game.buffSystem;
    if (!bs) return;

    switch (element) {
      case 'fire':
        // 火焰弹：叠灼烧，等级越高叠层越多
        bs.applyBurn(brick, Math.max(1, elementLv));
        if (this.game.particles) {
          this.game.particles.emitHitSpark(brick.getCenter().x, brick.getCenter().y, '#FF4400');
        }
        break;

      case 'ice':
        // 冰爆弹：叠冰缓（满层自动冻结由BuffSystem处理）
        bs.applyChill(brick, Math.max(1, elementLv));
        if (this.game.particles) {
          this.game.particles.emitHitSpark(brick.getCenter().x, brick.getCenter().y, '#44DDFF');
        }
        break;

      case 'thunder':
        // 雷电弹：叠感电
        bs.applyShock(brick, Math.max(1, elementLv));
        if (this.game.particles) {
          this.game.particles.emitHitSpark(brick.getCenter().x, brick.getCenter().y, '#FFF050');
        }
        Sound.lightning();
        break;
    }
  }
}

module.exports = ElementSystem;
