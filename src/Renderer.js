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
    for (const b of blades) {
      // 发光刀片
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.angle);
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
      ctx.fillStyle = color;
      // 菱形刀片
      ctx.beginPath();
      ctx.moveTo(0, -10);
      ctx.lineTo(5, 0);
      ctx.lineTo(0, 10);
      ctx.lineTo(-5, 0);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.restore();

      // 轨迹圆弧
      ctx.beginPath();
      ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.3;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  _drawFireSurge(data, ctx) {
    const { waves, color } = data;
    for (const w of waves) {
      ctx.globalAlpha = w.alpha * 0.6;
      // 渐变火焰波
      const grad = ctx.createLinearGradient(w.x - w.width / 2, w.y, w.x + w.width / 2, w.y);
      grad.addColorStop(0, 'rgba(255, 136, 0, 0)');
      grad.addColorStop(0.3, color);
      grad.addColorStop(0.7, color);
      grad.addColorStop(1, 'rgba(255, 136, 0, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(w.x - w.width / 2, w.y - 6, w.width, 12);

      // 火焰高光
      ctx.fillStyle = 'rgba(255, 255, 200, 0.4)';
      ctx.fillRect(w.x - w.width / 4, w.y - 2, w.width / 2, 4);
    }
    ctx.globalAlpha = 1;
  }

  _drawLightning(data, ctx) {
    const { bolts, color } = data;
    for (const bolt of bolts) {
      ctx.globalAlpha = bolt.alpha;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      for (let i = 0; i < bolt.points.length; i++) {
        const p = bolt.points[i];
        // 锯齿效果
        const jx = (i > 0 && i < bolt.points.length - 1) ? (Math.random() - 0.5) * 12 : 0;
        const jy = (i > 0 && i < bolt.points.length - 1) ? (Math.random() - 0.5) * 8 : 0;
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x + jx, p.y + jy);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      // 节点光点
      for (let i = 1; i < bolt.points.length; i++) {
        const p = bolt.points[i];
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  _drawMissile(data, ctx) {
    const { missiles, explosions, color } = data;
    // 导弹
    for (const m of missiles) {
      // 尾焰
      for (let i = 0; i < m.trail.length; i++) {
        const t = m.trail[i];
        const alpha = (i + 1) / m.trail.length * 0.5;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = Config.NEON_ORANGE;
        ctx.fillRect(t.x - 2, t.y - 2, 4, 4);
      }
      ctx.globalAlpha = 1;
      // 弹体
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(m.x, m.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      // 高光
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(m.x, m.y - 1, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // 爆炸
    for (const e of explosions) {
      ctx.globalAlpha = e.alpha * 0.5;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius * (1 - e.alpha + 0.5), 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255, 20, 255, 0.15)';
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius * (1 - e.alpha + 0.3), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  _drawLaserBeam(data, ctx) {
    const { beams, color } = data;
    for (const b of beams) {
      ctx.globalAlpha = b.alpha;
      // 主射线
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 15;
      ctx.fillRect(b.x - b.width / 2, b.topY, b.width, Config.SCREEN_HEIGHT);
      // 外发光
      ctx.fillStyle = 'rgba(255, 50, 50, 0.2)';
      ctx.fillRect(b.x - b.width * 2, b.topY, b.width * 4, Config.SCREEN_HEIGHT);
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;
  }

  _drawIceField(data, ctx) {
    const { icicles, color } = data;
    for (const ic of icicles) {
      // 尾迹
      for (let i = 0; i < ic.trail.length; i++) {
        const t = ic.trail[i];
        const alpha = (i + 1) / ic.trail.length * 0.4;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = color;
        ctx.fillRect(t.x - 1, t.y - 1, 2, 2);
      }
      ctx.globalAlpha = 1;
      // 冰锥本体（三角形）
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.moveTo(ic.x, ic.y + 8);
      ctx.lineTo(ic.x - 4, ic.y - 4);
      ctx.lineTo(ic.x + 4, ic.y - 4);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
    }
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
    ctx.fillText('v3.0.0', cx, Config.SCREEN_HEIGHT - 30);
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

  // ===== 升级选择（经验满触发） =====
  drawLevelUpChoice(choices, playerLevel, upgrades) {
    const ctx = this.ctx;
    const cx = Config.SCREEN_WIDTH / 2;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, Config.SCREEN_WIDTH, Config.SCREEN_HEIGHT);

    ctx.fillStyle = Config.NEON_GREEN;
    ctx.font = 'bold 22px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⬆ LEVEL ' + playerLevel + '!', cx, 90);

    ctx.fillStyle = Config.NEON_YELLOW;
    ctx.font = '13px monospace';
    ctx.fillText('选择强化', cx, 118);

    const cardW = Config.SCREEN_WIDTH * 0.82;
    const cardH = 85;
    const startY = 150;
    const gap = 14;

    for (let i = 0; i < choices.length; i++) {
      const c = choices[i];
      const cardX = cx - cardW / 2;
      const cardY = startY + i * (cardH + gap);

      // 背景（新武器更亮）
      ctx.fillStyle = c.isNew ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.05)';
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, cardW, cardH, 8);
      ctx.fill();

      // 新武器标签
      if (c.isNew && c.type === 'weapon') {
        ctx.fillStyle = Config.NEON_YELLOW;
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'right';
        ctx.fillText('NEW!', cardX + cardW - 10, cardY + 16);
      }

      // 边框
      ctx.strokeStyle = c.color;
      ctx.lineWidth = c.isNew ? 2 : 1;
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, cardW, cardH, 8);
      ctx.stroke();

      // 类型标识
      const typeLabel = c.type === 'weapon' ? '武器' : '强化';
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.font = '9px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(typeLabel, cardX + 12, cardY + 16);

      // 图标
      ctx.fillStyle = c.color;
      ctx.font = '24px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(c.icon, cardX + 12, cardY + 44);

      // 名称
      ctx.fillStyle = c.color;
      ctx.font = 'bold 15px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(c.name, cardX + 48, cardY + 40);

      // 描述
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = '11px monospace';
      ctx.fillText(c.desc, cardX + 48, cardY + 62);

      c._hitArea = { x: cardX, y: cardY, w: cardW, h: cardH };
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
