/**
 * InputManager.js - 触摸输入管理
 */
const Config = require('./Config');

class InputManager {
  constructor() {
    this.touchStartX = 0;
    this.touchCurrentX = 0;
    this.paddleStartX = 0;
    this.isTouching = false;
    this.tapX = 0;
    this.tapY = 0;
    this.hasTap = false;  // 单次点击事件
    this.onSkillTap = null; // 技能按钮回调
    this.onUpgradeTap = null; // 升级选择回调
    this.onTitleTap = null; // 标题页回调
    this.onGameOverTap = null; // Game over 回调

    this._bindEvents();
  }

  _bindEvents() {
    wx.onTouchStart((e) => {
      if (e.touches.length === 0) return;
      const t = e.touches[0];
      this.touchStartX = t.clientX;
      this.touchCurrentX = t.clientX;
      this.isTouching = true;
      this.tapX = t.clientX;
      this.tapY = t.clientY;
      this.hasTap = true;
    });

    wx.onTouchMove((e) => {
      if (e.touches.length === 0) return;
      const t = e.touches[0];
      this.touchCurrentX = t.clientX;
      // 如果移动了太多距离，取消 tap
      const dx = Math.abs(t.clientX - this.touchStartX);
      const dy = Math.abs(t.clientY - this.tapY);
      if (dx > 10 || dy > 10) {
        this.hasTap = false;
      }
    });

    wx.onTouchEnd(() => {
      this.isTouching = false;
    });

    wx.onTouchCancel(() => {
      this.isTouching = false;
    });
  }

  /**
   * 获取挡板目标 X 位置（基于触控拖拽）
   */
  getPaddleDeltaX() {
    if (!this.isTouching) return 0;
    const delta = this.touchCurrentX - this.touchStartX;
    this.touchStartX = this.touchCurrentX;
    return delta;
  }

  /**
   * 消耗 tap 事件
   */
  consumeTap() {
    if (this.hasTap) {
      this.hasTap = false;
      return { x: this.tapX, y: this.tapY };
    }
    return null;
  }
}

module.exports = InputManager;
