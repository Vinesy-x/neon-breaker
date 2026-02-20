/**
 * InputManager.js - 触摸输入管理
 */
const Config = require('../Config');

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

    this.onDragY = null; // 拖动回调（dev panel滚动用）

    this._bindEvents();
  }

  _bindEvents() {
    wx.onTouchStart((e) => {
      if (e.touches.length === 0) return;
      const t = e.touches[0];
      this.touchStartX = t.clientX;
      this.touchCurrentX = t.clientX;
      this._lastTouchY = t.clientY;
      this.isTouching = true;
      this._tapCandidate = { x: t.clientX, y: t.clientY };
      this._tapCancelled = false;
    });

    wx.onTouchMove((e) => {
      if (e.touches.length === 0) return;
      const t = e.touches[0];
      const prevY = this._lastTouchY || t.clientY;
      this._lastTouchY = t.clientY;
      this.touchCurrentX = t.clientX;
      // 如果移动了太多距离，取消 tap
      if (this._tapCandidate) {
        const dx = Math.abs(t.clientX - this._tapCandidate.x);
        const dy = Math.abs(t.clientY - this._tapCandidate.y);
        if (dx > 10 || dy > 10) {
          this._tapCancelled = true;
        }
      }
      // 拖动回调
      if (this.onDragY) {
        this.onDragY(t.clientY - prevY);
      }
    });

    wx.onTouchEnd(() => {
      this.isTouching = false;
      // 只有没被取消的才算 tap
      if (this._tapCandidate && !this._tapCancelled) {
        this.tapX = this._tapCandidate.x;
        this.tapY = this._tapCandidate.y;
        this.hasTap = true;
      }
      this._tapCandidate = null;
    });

    wx.onTouchCancel(() => {
      this.isTouching = false;
      this._tapCandidate = null;
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
   * 查看 tap 但不消费
   */
  peekTap() {
    if (this.hasTap) {
      return { x: this.tapX, y: this.tapY };
    }
    return null;
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
