/**
 * SoundManager.js - 合成音效系统（零资源，纯WebAudio）
 * 赛博朋克电子音风格，所有音效用代码生成
 */

class SoundManager {
  constructor() {
    this.enabled = true;
    this.ctx = null;
    this.masterGain = null;
    this._initAttempted = false;
  }

  /** 必须在用户交互后调用（微信要求） */
  init() {
    if (this.ctx) return;
    if (this._initAttempted) return;
    this._initAttempted = true;

    try {
      if (typeof wx !== 'undefined' && wx.createWebAudioContext) {
        this.ctx = wx.createWebAudioContext();
      } else if (typeof AudioContext !== 'undefined') {
        this.ctx = new AudioContext();
      } else if (typeof webkitAudioContext !== 'undefined') {
        this.ctx = new webkitAudioContext();
      }

      if (this.ctx) {
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.4;
        this.masterGain.connect(this.ctx.destination);
      }
    } catch (e) {
      this.ctx = null;
    }
  }

  setVolume(v) {
    if (this.masterGain) this.masterGain.gain.value = Math.max(0, Math.min(1, v));
  }

  toggle() {
    this.enabled = !this.enabled;
    return this.enabled;
  }

  // ===== 基础音效工具 =====

  _osc(type, freq, duration, startTime, gainVal) {
    if (!this.ctx || !this.enabled) return;
    const t = startTime || this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(gainVal || 0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + duration);
  }

  _noise(duration, startTime, gainVal) {
    if (!this.ctx || !this.enabled) return;
    const t = startTime || this.ctx.currentTime;
    const bufferSize = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(gainVal || 0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    source.connect(gain);
    gain.connect(this.masterGain);
    source.start(t);
    source.stop(t + duration);
  }

  // ===== 游戏音效 =====

  /** 球碰砖块 */
  brickHit() {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    // 短促高频 click
    this._osc('square', 800 + Math.random() * 400, 0.06, t, 0.15);
  }

  /** 砖块碎裂 */
  brickBreak() {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    // 下滑音 + 碎裂噪声
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(600, t);
    osc.frequency.exponentialRampToValueAtTime(150, t + 0.12);
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.15);
    this._noise(0.08, t, 0.1);
  }

  /** 球碰挡板 */
  paddleHit() {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    // 厚重的低频 thud
    this._osc('sine', 200, 0.1, t, 0.25);
    this._osc('square', 400, 0.05, t + 0.01, 0.08);
  }

  /** 球碰墙壁 */
  wallBounce() {
    if (!this.ctx || !this.enabled) return;
    this._osc('sine', 300, 0.04, undefined, 0.08);
  }

  /** 拾取道具 */
  powerUp() {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    // 上升音阶 ding-ding-ding
    this._osc('sine', 523, 0.08, t, 0.2);
    this._osc('sine', 659, 0.08, t + 0.06, 0.2);
    this._osc('sine', 784, 0.12, t + 0.12, 0.2);
  }

  /** 经验球收集 */
  expCollect() {
    if (!this.ctx || !this.enabled) return;
    // 极短的 pling
    this._osc('sine', 1200 + Math.random() * 400, 0.04, undefined, 0.08);
  }

  /** 升级! */
  levelUp() {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    // 华丽上升音阶
    this._osc('sine', 523, 0.1, t, 0.25);
    this._osc('sine', 659, 0.1, t + 0.08, 0.25);
    this._osc('sine', 784, 0.1, t + 0.16, 0.25);
    this._osc('sine', 1047, 0.2, t + 0.24, 0.3);
    // 闪亮噪声
    this._noise(0.15, t + 0.3, 0.08);
  }

  /** 选择技能 */
  selectSkill() {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    this._osc('sine', 880, 0.06, t, 0.2);
    this._osc('sine', 1100, 0.1, t + 0.05, 0.2);
  }

  /** Combo 提示 */
  combo(count) {
    if (!this.ctx || !this.enabled) return;
    // combo 越高音越高
    const freq = 400 + Math.min(count, 20) * 40;
    this._osc('sawtooth', freq, 0.08, undefined, 0.12);
  }

  /** 暴击 */
  crit() {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    // 重击感
    this._osc('sawtooth', 150, 0.15, t, 0.3);
    this._osc('square', 800, 0.08, t, 0.15);
    this._noise(0.1, t, 0.12);
  }

  // ===== 武器音效 =====

  /** 等离子刃命中 */
  bladeHit() {
    if (!this.ctx || !this.enabled) return;
    // 嗡嗡切割声
    this._osc('sawtooth', 300, 0.05, undefined, 0.08);
  }

  /** 烈焰涌动 */
  fireSurge() {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    // 呼啸上升
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(100, t);
    osc.frequency.exponentialRampToValueAtTime(600, t + 0.3);
    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.35);
    this._noise(0.25, t + 0.05, 0.06);
  }

  /** 闪电 */
  lightning() {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    // 电击噪声 + 高频
    this._noise(0.15, t, 0.2);
    this._osc('square', 2000, 0.03, t, 0.12);
    this._osc('square', 1500, 0.03, t + 0.04, 0.1);
    this._osc('square', 2500, 0.02, t + 0.07, 0.08);
  }

  /** 导弹发射 */
  missileLaunch() {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    // 上升呼啸
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(200, t);
    osc.frequency.exponentialRampToValueAtTime(800, t + 0.2);
    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.25);
  }

  /** 导弹爆炸 */
  missileExplode() {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    // 低频 boom + 噪声
    this._osc('sine', 80, 0.3, t, 0.3);
    this._noise(0.2, t, 0.2);
    this._osc('square', 200, 0.1, t + 0.02, 0.1);
  }

  /** 激光 */
  laserBeam() {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    // 持续高频嗡鸣
    this._osc('sawtooth', 1200, 0.3, t, 0.1);
    this._osc('sine', 600, 0.3, t, 0.08);
  }

  /** 冰锥 */
  iceShot() {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    // 清脆冰碎声
    this._osc('sine', 2000, 0.06, t, 0.1);
    this._osc('sine', 3000, 0.04, t + 0.03, 0.08);
    this._noise(0.05, t + 0.02, 0.05);
  }

  // ===== 系统音效 =====

  /** 球出界（失去生命） */
  ballLost() {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    // 下降低沉
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, t);
    osc.frequency.exponentialRampToValueAtTime(80, t + 0.4);
    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.5);
  }

  /** 过关 */
  levelClear() {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    // 胜利音阶
    this._osc('sine', 523, 0.12, t, 0.2);
    this._osc('sine', 659, 0.12, t + 0.1, 0.2);
    this._osc('sine', 784, 0.12, t + 0.2, 0.2);
    this._osc('sine', 1047, 0.25, t + 0.3, 0.25);
    this._osc('triangle', 1047, 0.3, t + 0.3, 0.15);
  }

  /** Game Over */
  gameOver() {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    // 悲伤下降
    this._osc('sine', 440, 0.2, t, 0.2);
    this._osc('sine', 370, 0.2, t + 0.2, 0.2);
    this._osc('sine', 330, 0.2, t + 0.4, 0.2);
    this._osc('sine', 262, 0.4, t + 0.6, 0.25);
  }

  /** 进化 */
  evolve() {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    // 超华丽上升 + 闪光
    this._osc('sine', 523, 0.08, t, 0.2);
    this._osc('sine', 659, 0.08, t + 0.06, 0.2);
    this._osc('sine', 784, 0.08, t + 0.12, 0.2);
    this._osc('sine', 1047, 0.08, t + 0.18, 0.25);
    this._osc('sine', 1319, 0.08, t + 0.24, 0.25);
    this._osc('sine', 1568, 0.15, t + 0.3, 0.3);
    this._noise(0.2, t + 0.35, 0.1);
    // 低频共鸣
    this._osc('sine', 130, 0.5, t + 0.2, 0.15);
  }

  /** 砖块前移警告 */
  advanceWarning() {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    // 低沉警报
    this._osc('square', 120, 0.15, t, 0.15);
    this._osc('square', 100, 0.15, t + 0.2, 0.15);
  }

  /** Boss 登场 */
  bossAppear() {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    // 震撼低音
    this._osc('sine', 60, 0.5, t, 0.3);
    this._osc('sawtooth', 80, 0.3, t + 0.1, 0.15);
    this._noise(0.3, t + 0.2, 0.1);
    this._osc('square', 200, 0.1, t + 0.4, 0.15);
  }

  /** Boss 击败 */
  bossDefeat() {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    // 爆炸 + 胜利
    this._noise(0.3, t, 0.2);
    this._osc('sine', 80, 0.4, t, 0.25);
    this._osc('sine', 523, 0.1, t + 0.3, 0.2);
    this._osc('sine', 784, 0.1, t + 0.4, 0.2);
    this._osc('sine', 1047, 0.2, t + 0.5, 0.25);
  }

  /** 游戏开始 */
  gameStart() {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    this._osc('sine', 330, 0.08, t, 0.15);
    this._osc('sine', 440, 0.08, t + 0.08, 0.15);
    this._osc('sine', 660, 0.15, t + 0.16, 0.2);
  }
}

// 全局单例
const soundManager = new SoundManager();
module.exports = soundManager;
