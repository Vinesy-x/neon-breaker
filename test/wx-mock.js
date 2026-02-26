/**
 * wx-mock.js - 微信小游戏 API 模拟层
 * 让 src/ 代码可以在 Node.js 中 require
 */
global.wx = {
  getSystemInfoSync: () => ({
    windowWidth: 375, windowHeight: 667, pixelRatio: 2,
    screenHeight: 667, safeArea: { bottom: 647 },
  }),
  getMenuButtonBoundingClientRect: () => ({ bottom: 80 }),
  createCanvas: () => {
    const ctx = {
      scale: () => {}, save: () => {}, restore: () => {},
      translate: () => {}, rotate: () => {}, clearRect: () => {},
      fillRect: () => {}, strokeRect: () => {}, beginPath: () => {},
      moveTo: () => {}, lineTo: () => {}, arc: () => {}, fill: () => {},
      stroke: () => {}, closePath: () => {}, drawImage: () => {},
      measureText: () => ({ width: 50 }), setTransform: () => {},
      fillText: () => {}, strokeText: () => {},
      set fillStyle(v) {}, set strokeStyle(v) {}, set lineWidth(v) {},
      set font(v) {}, set textAlign(v) {}, set textBaseline(v) {},
      set globalAlpha(v) {}, set lineCap(v) {}, set lineJoin(v) {},
      set globalCompositeOperation(v) {},
    };
    return { width: 750, height: 1334, getContext: () => ctx };
  },
  getStorageSync: () => null,
  setStorageSync: () => {},
  createInnerAudioContext: () => ({
    src: '', loop: false, volume: 1,
    play: () => {}, stop: () => {}, pause: () => {}, destroy: () => {},
    onEnded: () => {}, offEnded: () => {},
  }),
  vibrateShort: () => {},
  vibrateLong: () => {},
  onTouchStart: () => {},
  onTouchMove: () => {},
  onTouchEnd: () => {},
  onTouchCancel: () => {},
};
