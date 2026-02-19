/**
 * Renderer.js - v3.0 带武器特效渲染
 */
const Config = require('./Config');

class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = Config.DPR;
    canvas.width = Config.CANVAS_WIDTH;
    canvas.height = Config.CANVAS_HEIGHT;
    this.ctx.scale(this.dpr, this.dpr);
  }

  clear() {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = Config.BG_COLOR;
    ctx.fillRect(0, 0, Config.SCREEN_WIDTH, Config.SCREEN_HEIGHT);
  }

  // ===== 球 =====
  drawBall(ball) {
    const ctx = this.ctx;
    for (let i = 0; i < ball.trail.length; i++) {
      const t = ball.trail[i];
      const alpha = (i + 1) / ball.trail.length * 0.5;
      const radius = ball.radius * (i + 1) / ball.trail.length;
      ctx.beginPath();
      ctx.arc(t.x, t.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 255, 255, ' + alpha + ')';
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fillStyle = ball.color;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius + 3, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.4)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // ===== 挡板 =====
  drawPaddle(paddle) {
    const ctx = this.ctx;
    const { x, y, width, height, color } = paddle;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, height / 2);
    ctx.fill();
    ctx.shadowColor = color;
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, height / 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // ===== 砖块 =====
  drawBrick(brick) {
    if (!brick.alive) return;
    const ctx = this.ctx;
    const { x, y, width, height, color, hp, maxHp } = brick;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 3);
    ctx.fill();
    if (maxHp > 1) {
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(x, y, width, height, 3);
      ctx.stroke();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(hp.toString(), x + width / 2, y + height / 2);
    }
  }

  // ===== 粒子 =====
  drawParticles(particles) {
    const ctx = this.ctx;
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      ctx.globalAlpha = p.getAlpha();
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  // ===== 道具 =====
  drawPowerUp(powerUp) {
    const ctx = this.ctx;
    const { x, y, size, color, time } = powerUp;
    const pulse = 0.8 + Math.sin(time * 0.15) * 0.2;
    const drawSize = size * pulse;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, drawSize / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, drawSize / 2 + 2, 0, Math.PI * 2);
    ctx.stroke();
  }

  // ===== Boss =====
  drawBoss(boss) {
    if (!boss || !boss.alive) return;
    const ctx = this.ctx;
    const { x, y, width, height } = boss;
    const color = boss.getPhaseColor();
    if (boss.phaseChangeFlash > 0) ctx.globalAlpha = 0.3 + Math.sin(boss.phaseChangeFlash * 0.05) * 0.7;
    ctx.fillStyle = boss.flashTimer > 0 ? '#FFFFFF' : color;
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 6);
    ctx.fill();
    ctx.shadowColor = color;
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 6);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    // 血条
    const barW = width, barH = 6, barX = x, barY = y - 12;
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = color;
    ctx.fillRect(barX, barY, barW * boss.getHpRatio(), barH);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barW, barH);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('BOSS P' + (boss.phase + 1), x + width / 2, y + height / 2);
  }

  // ===== 危险线 =====
  drawDangerLine(dangerY, warning) {
    const ctx = this.ctx;
    const alpha = warning ? 0.4 + Math.sin(Date.now() * 0.01) * 0.3 : 0.15;
    ctx.strokeStyle = 'rgba(255, 50, 50, ' + alpha + ')';
    ctx.lineWidth = 1;
    ctx.setLineDash([8, 4]);
    ctx.beginPath();
    ctx.moveTo(0, dangerY);
    ctx.lineTo(Config.SCREEN_WIDTH, dangerY);
    ctx.stroke();
    ctx.setLineDash([]);
    if (warning) {
      ctx.fillStyle = 'rgba(255, 50, 50, ' + alpha + ')';
      ctx.font = '10px monospace';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillText('DANGER', Config.SCREEN_WIDTH - 8, dangerY - 3);
    }
  }

  // ===== 前移进度条 =====
  drawAdvanceBar(timer, interval) {
    const ctx = this.ctx;
    const ratio = timer / interval;
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(0, 0, Config.SCREEN_WIDTH, 3);
    const r = Math.floor(255 * ratio);
    const g = Math.floor(100 * (1 - ratio));
    ctx.fillStyle = 'rgb(' + r + ', ' + g + ', 50)';
    ctx.fillRect(0, 0, Config.SCREEN_WIDTH * ratio, 3);
  }

  // ===== 武器视觉渲染 =====
  drawWeapons(weapons, paddle) {
    const ctx = this.ctx;
    const pcx = paddle.getCenterX();
    const pcy = paddle.y;

    for (const key in weapons) {
      const weapon = weapons[key];
      const data = weapon.getRenderData(pcx, pcy);

      switch (key) {
        case 'orbitBlade': this._drawOrbitBlade(data, ctx); break;
        case 'fireSurge': this._drawFireSurge(data, ctx); break;
        case 'lightning': this._drawLightning(data, ctx); break;
        case 'missile': this._drawMissile(data, ctx); break;
        case 'laserBeam': this._drawLaserBeam(data, ctx); break;
        case 'iceField': this._drawIceField(data, ctx); break;
      }
    }
  }

  _drawOrbitBlade(data, ctx) {
    const { blades, color } = data;

    // 轨迹圈（虚线圆环）
    if (blades.length > 0) {
      const first = blades[0];
      // 用第一个刀片的位置反推圆心和半径
      // 这里近似画一个圈
      const paddleCx = first.x - Math.cos(first.angle) * 70; // 近似
      const paddleCy = first.y - Math.sin(first.angle) * 70;
      ctx.strokeStyle = 'rgba(' + this._hexToRgb(color) + ', 0.12)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.arc(paddleCx, paddleCy, 70, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    for (const b of blades) {
      // 刀片拖影
      ctx.globalAlpha = 0.2;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(b.x, b.y, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      // 发光刀片
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.angle);
      ctx.shadowColor = color;
      ctx.shadowBlur = 15;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, -12);
      ctx.lineTo(6, 0);
      ctx.lineTo(0, 12);
      ctx.lineTo(-6, 0);
      ctx.closePath();
      ctx.fill();
      // 白色高光核心
      ctx.fillStyle = '#FFFFFF';
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.moveTo(0, -5);
      ctx.lineTo(2, 0);
      ctx.lineTo(0, 5);
      ctx.lineTo(-2, 0);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
      ctx.restore();
    }
  }

  _drawFireSurge(data, ctx) {
    const { waves, color } = data;
    for (const w of waves) {
      ctx.globalAlpha = w.alpha * 0.7;

      // 多层火焰（内焰+外焰）
      // 外焰（宽，暗）
      const outerGrad = ctx.createLinearGradient(w.x - w.width / 2, w.y, w.x + w.width / 2, w.y);
      outerGrad.addColorStop(0, 'rgba(255, 80, 0, 0)');
      outerGrad.addColorStop(0.2, 'rgba(255, 100, 0, 0.4)');
      outerGrad.addColorStop(0.5, color);
      outerGrad.addColorStop(0.8, 'rgba(255, 100, 0, 0.4)');
      outerGrad.addColorStop(1, 'rgba(255, 80, 0, 0)');
      ctx.fillStyle = outerGrad;
      ctx.fillRect(w.x - w.width / 2, w.y - 10, w.width, 20);

      // 内焰（窄，亮）
      ctx.fillStyle = 'rgba(255, 255, 150, 0.5)';
      ctx.fillRect(w.x - w.width / 4, w.y - 3, w.width / 2, 6);

      // 随机火星
      for (let s = 0; s < 3; s++) {
        const sx = w.x + (Math.random() - 0.5) * w.width * 0.8;
        const sy = w.y + (Math.random() - 0.5) * 12;
        ctx.fillStyle = 'rgba(255, 255, 100, 0.7)';
        ctx.fillRect(sx, sy, 2, 2);
      }
    }
    ctx.globalAlpha = 1;
  }

  _drawLightning(data, ctx) {
    const { bolts, color } = data;
    for (const bolt of bolts) {
      ctx.globalAlpha = bolt.alpha;

      // 外发光（宽，虚）
      ctx.strokeStyle = 'rgba(' + this._hexToRgb(color) + ', 0.3)';
      ctx.lineWidth = 6;
      ctx.shadowColor = color;
      ctx.shadowBlur = 15;
      ctx.beginPath();
      for (let i = 0; i < bolt.points.length; i++) {
        const p = bolt.points[i];
        const jx = (i > 0 && i < bolt.points.length - 1) ? (Math.random() - 0.5) * 15 : 0;
        const jy = (i > 0 && i < bolt.points.length - 1) ? (Math.random() - 0.5) * 10 : 0;
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x + jx, p.y + jy);
      }
      ctx.stroke();

      // 内核（细，亮白）
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < bolt.points.length; i++) {
        const p = bolt.points[i];
        const jx = (i > 0 && i < bolt.points.length - 1) ? (Math.random() - 0.5) * 8 : 0;
        const jy = (i > 0 && i < bolt.points.length - 1) ? (Math.random() - 0.5) * 5 : 0;
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x + jx, p.y + jy);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      // 命中光球（大发光圈）
      for (let i = 1; i < bolt.points.length; i++) {
        const p = bolt.points[i];
        ctx.shadowColor = color;
        ctx.shadowBlur = 12;
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        // 外圈
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  _drawMissile(data, ctx) {
    const { missiles, explosions, color } = data;
    for (const m of missiles) {
      // 推进尾焰（渐变）
      for (let i = 0; i < m.trail.length; i++) {
        const t = m.trail[i];
        const alpha = (i + 1) / m.trail.length * 0.6;
        const size = 2 + (i / m.trail.length) * 3;
        ctx.globalAlpha = alpha;
        // 外焰橙色
        ctx.fillStyle = Config.NEON_ORANGE;
        ctx.beginPath();
        ctx.arc(t.x, t.y, size, 0, Math.PI * 2);
        ctx.fill();
        // 内焰白色
        ctx.fillStyle = 'rgba(255,255,200,0.5)';
        ctx.beginPath();
        ctx.arc(t.x, t.y, size * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // 弹体（发光圆+三角箭头）
      ctx.shadowColor = color;
      ctx.shadowBlur = 10;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(m.x, m.y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      // 白色高光
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(m.x, m.y - 1, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // 爆炸效果（多层扩散环）
    for (const e of explosions) {
      // 外扩散环
      ctx.globalAlpha = e.alpha * 0.4;
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius * (1.2 - e.alpha * 0.5), 0, Math.PI * 2);
      ctx.stroke();
      // 内填充
      ctx.globalAlpha = e.alpha * 0.2;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius * (1 - e.alpha * 0.3), 0, Math.PI * 2);
      ctx.fill();
      // 中心闪光
      ctx.globalAlpha = e.alpha * 0.8;
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(e.x, e.y, 6 * e.alpha, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  _drawLaserBeam(data, ctx) {
    const { beams, color } = data;
    for (const b of beams) {
      ctx.globalAlpha = b.alpha;
      const bh = Config.SCREEN_HEIGHT;

      // 最外层发光（宽虚）
      ctx.fillStyle = 'rgba(255, 50, 50, 0.1)';
      ctx.fillRect(b.x - b.width * 3, b.topY, b.width * 6, bh);

      // 中层发光
      ctx.shadowColor = color;
      ctx.shadowBlur = 20;
      ctx.fillStyle = 'rgba(255, 80, 80, 0.3)';
      ctx.fillRect(b.x - b.width * 1.5, b.topY, b.width * 3, bh);

      // 主射线
      ctx.fillStyle = color;
      ctx.fillRect(b.x - b.width / 2, b.topY, b.width, bh);

      // 核心白线
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.fillRect(b.x - 1, b.topY, 2, bh);

      ctx.shadowBlur = 0;

      // 扫描线动画（横线上移）
      const scanY = (Date.now() * 0.3) % bh;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.fillRect(b.x - b.width * 2, scanY, b.width * 4, 2);
    }
    ctx.globalAlpha = 1;
  }

  _drawIceField(data, ctx) {
    const { icicles, color } = data;
    for (const ic of icicles) {
      // 冰晶尾迹
      for (let i = 0; i < ic.trail.length; i++) {
        const t = ic.trail[i];
        const alpha = (i + 1) / ic.trail.length * 0.5;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(t.x, t.y, 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // 冰锥本体（更大更锋利的三角形）
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(ic.x, ic.y + 10);
      ctx.lineTo(ic.x - 5, ic.y - 6);
      ctx.lineTo(ic.x + 5, ic.y - 6);
      ctx.closePath();
      ctx.fill();
      // 高光
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.beginPath();
      ctx.moveTo(ic.x, ic.y + 5);
      ctx.lineTo(ic.x - 2, ic.y - 3);
      ctx.lineTo(ic.x + 2, ic.y - 3);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  /** hex颜色转rgb字符串 */
  _hexToRgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return r + ',' + g + ',' + b;
  }

  // ===== 被动技能图标栏 =====
  drawPassiveBar(ownedList) {
    if (!ownedList || ownedList.length === 0) return;
    const ctx = this.ctx;
    const iconSize = 16;
    const gap = 4;
    const startX = Config.SCREEN_WIDTH - iconSize - 4;
    const startY = 46;

    for (let i = 0; i < ownedList.length && i < 12; i++) {
      const p = ownedList[i];
      const y = startY + i * (iconSize + gap);
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.beginPath();
      ctx.arc(startX + iconSize / 2, y + iconSize / 2, iconSize / 2 + 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = p.color;
      ctx.font = (iconSize - 2) + 'px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(p.icon, startX + iconSize / 2, y + iconSize / 2);
      if (p.level !== 'MAX' && p.level > 1) {
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.font = '7px monospace';
        ctx.fillText(p.level.toString(), startX + iconSize / 2, y + iconSize + 3);
      }
      if (p.level === 'MAX') {
        ctx.fillStyle = Config.NEON_YELLOW;
        ctx.font = '6px monospace';
        ctx.fillText('MAX', startX + iconSize / 2, y + iconSize + 3);
      }
    }
  }

  // ===== HUD =====
  drawHUD(score, lives, combo, level) {
    const ctx = this.ctx;
    ctx.fillStyle = Config.NEON_CYAN;
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('SCORE:' + score, 10, 8);
    ctx.fillStyle = Config.NEON_GREEN;
    ctx.textAlign = 'center';
    ctx.fillText('LV ' + level, Config.SCREEN_WIDTH / 2, 8);
    ctx.fillStyle = Config.NEON_PINK;
    ctx.textAlign = 'right';
    let livesText = '';
    for (let i = 0; i < Math.min(lives, 10); i++) livesText += '♥';
    ctx.fillText(livesText, Config.SCREEN_WIDTH - 26, 8);
    if (combo > 1) {
      ctx.fillStyle = Config.NEON_YELLOW;
      ctx.font = 'bold 13px monospace';
      ctx.textAlign = 'left';
      ctx.fillText('COMBO x' + combo, 10, 26);
    }
  }

  drawFloatingTexts(texts) {
    const ctx = this.ctx;
    for (let i = 0; i < texts.length; i++) {
      const t = texts[i];
      ctx.globalAlpha = t.alpha;
      ctx.fillStyle = t.color;
      ctx.font = 'bold ' + t.size + 'px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }

  // ===== 标题 =====
  drawTitle() {
    const ctx = this.ctx;
    const cx = Config.SCREEN_WIDTH / 2;
    const cy = Config.SCREEN_HEIGHT / 2;
    ctx.fillStyle = Config.NEON_CYAN;
    ctx.font = 'bold 32px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('NEON', cx, cy - 60);
    ctx.fillStyle = Config.NEON_PINK;
    ctx.fillText('BREAKER', cx, cy - 20);
    ctx.fillStyle = Config.NEON_GREEN;
    ctx.font = '14px monospace';
    ctx.fillText('霓虹碎核', cx, cy + 20);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '11px monospace';
    ctx.fillText('武器肉鸽 · 自动清砖 · 满屏特效', cx, cy + 45);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '16px monospace';
    ctx.fillText('点击屏幕开始', cx, cy + 90);
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '10px monospace';
    ctx.fillText('v3.2.0', cx, Config.SCREEN_HEIGHT - 30);
  }

  // ===== 经验球 =====
  drawExpOrbs(orbs) {
    if (!orbs || orbs.length === 0) return;
    const ctx = this.ctx;
    const size = Config.EXP_ORB_SIZE;
    for (let i = 0; i < orbs.length; i++) {
      const o = orbs[i];
      // 发光小球
      ctx.shadowColor = Config.EXP_ORB_COLOR;
      ctx.shadowBlur = 6;
      ctx.fillStyle = Config.EXP_ORB_COLOR;
      ctx.beginPath();
      ctx.arc(o.x, o.y, size, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      // 高光
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(o.x - 1, o.y - 1, size * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ===== 经验条 =====
  drawExpBar(exp, expToNext, playerLevel) {
    const ctx = this.ctx;
    const barH = Config.EXP_BAR_HEIGHT;
    const barY = Config.SCREEN_HEIGHT - Config.EXP_BAR_Y_OFFSET;
    const margin = 40;
    const barW = Config.SCREEN_WIDTH - margin * 2;
    const barX = margin;
    const ratio = Math.min(1, exp / expToNext);

    // 背景
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, barH / 2);
    ctx.fill();

    // 填充
    if (ratio > 0) {
      const grad = ctx.createLinearGradient(barX, barY, barX + barW * ratio, barY);
      grad.addColorStop(0, Config.NEON_CYAN);
      grad.addColorStop(1, Config.NEON_GREEN);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(barX, barY, barW * ratio, barH, barH / 2);
      ctx.fill();

      // 发光尖端
      ctx.shadowColor = Config.NEON_CYAN;
      ctx.shadowBlur = 8;
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(barX + barW * ratio, barY + barH / 2, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // 等级文字（左侧）
    ctx.fillStyle = Config.NEON_CYAN;
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText('Lv.' + playerLevel, barX - 4, barY + barH / 2);

    // 百分比（右侧）
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '9px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(Math.floor(ratio * 100) + '%', barX + barW + 4, barY + barH / 2);
  }

  // ===== 升级选择（居中并列3列卡片） =====
  drawLevelUpChoice(choices, playerLevel, upgrades) {
    const ctx = this.ctx;
    const sw = Config.SCREEN_WIDTH;
    const sh = Config.SCREEN_HEIGHT;
    const cx = sw / 2;

    // 半透明遮罩
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, sw, sh);

    // 标题
    ctx.fillStyle = Config.NEON_GREEN;
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⬆ LEVEL ' + playerLevel, cx, sh * 0.18);

    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '11px monospace';
    ctx.fillText('选择一项强化', cx, sh * 0.18 + 24);

    // === 3列卡片 ===
    const count = choices.length;
    const gap = 8;
    const totalW = sw - 20; // 两侧各留10
    const cardW = Math.floor((totalW - gap * (count - 1)) / count);
    const cardH = sh * 0.5; // 高卡片，放更多内容
    const startX = (sw - (cardW * count + gap * (count - 1))) / 2;
    const startY = sh * 0.26;

    for (let i = 0; i < count; i++) {
      const c = choices[i];
      const cardX = startX + i * (cardW + gap);
      const cardY = startY;

      // 卡片背景
      const isNew = c.isNew && c.type === 'weapon';
      ctx.fillStyle = isNew ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.05)';
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, cardW, cardH, 10);
      ctx.fill();

      // 边框（选中色发光）
      ctx.strokeStyle = c.color;
      ctx.lineWidth = isNew ? 2 : 1;
      ctx.shadowColor = c.color;
      ctx.shadowBlur = isNew ? 10 : 0;
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, cardW, cardH, 10);
      ctx.stroke();
      ctx.shadowBlur = 0;

      const ccx = cardX + cardW / 2; // 卡片中心x

      // 类型标签
      const typeLabel = c.type === 'weapon' ? '武器' : '强化';
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.font = '9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(typeLabel, ccx, cardY + 18);

      // NEW 标签
      if (isNew) {
        ctx.fillStyle = Config.NEON_YELLOW;
        ctx.font = 'bold 9px monospace';
        ctx.fillText('NEW!', ccx, cardY + 32);
      }

      // 大图标（居中，发光）
      ctx.shadowColor = c.color;
      ctx.shadowBlur = 12;
      ctx.fillStyle = c.color;
      ctx.font = '32px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(c.icon, ccx, cardY + cardH * 0.3);
      ctx.shadowBlur = 0;

      // 名称
      ctx.fillStyle = c.color;
      ctx.font = 'bold 12px monospace';
      ctx.textBaseline = 'middle';
      // 自动换行名称（卡片窄）
      this._drawTextWrap(ctx, c.name, ccx, cardY + cardH * 0.52, cardW - 12, 13);

      // 描述（多行）
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.font = '10px monospace';
      this._drawTextWrap(ctx, c.desc, ccx, cardY + cardH * 0.68, cardW - 12, 12);

      // 等级条（底部）
      if (c.type === 'weapon') {
        const def = Config.WEAPONS[c.key];
        const curLv = upgrades ? upgrades.getWeaponLevel(c.key) : 0;
        const maxLv = def ? def.maxLevel : 5;
        this._drawLevelDots(ctx, ccx, cardY + cardH * 0.85, curLv, maxLv, c.color, cardW);
      } else {
        const def = Config.BUFFS.find(b => b.key === c.key);
        const curLv = upgrades ? upgrades.getBuffLevel(c.key) : 0;
        const maxLv = def ? def.maxLevel : 3;
        this._drawLevelDots(ctx, ccx, cardY + cardH * 0.85, curLv, maxLv, c.color, cardW);
      }

      // 点击区域
      c._hitArea = { x: cardX, y: cardY, w: cardW, h: cardH };
    }
  }

  /** 简易居中文本换行 */
  _drawTextWrap(ctx, text, cx, y, maxW, lineH) {
    // 简单按字符估算，monospace 每字约宽度
    const charW = parseInt(ctx.font) * 0.6;
    const maxChars = Math.floor(maxW / charW);
    if (text.length <= maxChars) {
      ctx.textAlign = 'center';
      ctx.fillText(text, cx, y);
    } else {
      const line1 = text.substring(0, maxChars);
      const line2 = text.substring(maxChars);
      ctx.textAlign = 'center';
      ctx.fillText(line1, cx, y);
      ctx.fillText(line2, cx, y + lineH);
    }
  }

  /** 等级圆点（■■■□□ 样式） */
  _drawLevelDots(ctx, cx, y, curLv, maxLv, color, cardW) {
    const dotSize = 5;
    const dotGap = 3;
    const totalW = maxLv * dotSize + (maxLv - 1) * dotGap;
    const startX = cx - totalW / 2;

    for (let i = 0; i < maxLv; i++) {
      const dx = startX + i * (dotSize + dotGap);
      if (i < curLv) {
        ctx.fillStyle = color;
      } else if (i === curLv) {
        // 即将升级的那个点闪烁
        ctx.fillStyle = 'rgba(255,255,255,' + (0.4 + Math.sin(Date.now() * 0.008) * 0.4) + ')';
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
      }
      ctx.fillRect(dx, y - dotSize / 2, dotSize, dotSize);
    }
  }

  // ===== Game Over =====
  drawGameOver(score, level, playerLevel, ownedList) {
    const ctx = this.ctx;
    const cx = Config.SCREEN_WIDTH / 2;
    const cy = Config.SCREEN_HEIGHT / 2;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(0, 0, Config.SCREEN_WIDTH, Config.SCREEN_HEIGHT);

    ctx.fillStyle = Config.NEON_PINK;
    ctx.font = 'bold 28px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('GAME OVER', cx, cy - 100);

    ctx.fillStyle = Config.NEON_CYAN;
    ctx.font = '16px monospace';
    ctx.fillText('得分: ' + score, cx, cy - 60);
    ctx.fillStyle = Config.NEON_GREEN;
    ctx.fillText('关卡: ' + level + '  等级: Lv.' + playerLevel, cx, cy - 35);

    // 武器总结
    if (ownedList && ownedList.length > 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = '11px monospace';
      ctx.fillText('你的 Build:', cx, cy + 5);

      const perRow = 6, icoSz = 22, icoGap = 6;
      const totalW = Math.min(ownedList.length, perRow) * (icoSz + icoGap) - icoGap;
      const startX = cx - totalW / 2;
      for (let i = 0; i < ownedList.length; i++) {
        const p = ownedList[i];
        const row = Math.floor(i / perRow);
        const col = i % perRow;
        const px = startX + col * (icoSz + icoGap) + icoSz / 2;
        const py = cy + 30 + row * (icoSz + icoGap + 4);
        ctx.fillStyle = p.color;
        ctx.font = (icoSz - 4) + 'px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(p.icon, px, py);
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = '7px monospace';
        ctx.fillText(typeof p.level === 'number' ? 'Lv.' + p.level : p.level, px, py + 12);
      }
    }

    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('点击屏幕重新开始', cx, cy + 110);
  }

  // ===== 进化通知 =====
  drawEvolveNotification(notif) {
    if (!notif) return;
    const ctx = this.ctx;
    const cx = Config.SCREEN_WIDTH / 2;
    const cy = Config.SCREEN_HEIGHT * 0.3;
    const alpha = Math.min(1, notif.timer / 20);

    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.beginPath();
    ctx.roundRect(cx - 100, cy - 25, 200, 50, 12);
    ctx.fill();
    ctx.strokeStyle = notif.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(cx - 100, cy - 25, 200, 50, 12);
    ctx.stroke();

    ctx.fillStyle = notif.color;
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⬆ 进化!', cx, cy - 8);
    ctx.font = 'bold 14px monospace';
    ctx.fillText(notif.icon + ' ' + notif.name, cx, cy + 12);
    ctx.globalAlpha = 1;
  }

  drawLoading() {
    const ctx = this.ctx;
    const cx = Config.SCREEN_WIDTH / 2;
    const cy = Config.SCREEN_HEIGHT / 2;
    ctx.fillStyle = Config.NEON_CYAN;
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('LOADING...', cx, cy);
  }
}

module.exports = Renderer;
