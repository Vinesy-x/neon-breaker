/**
 * Renderer.js - Canvas 2D 渲染器（v2.0 被动技能版）
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
      ctx.fillStyle = `rgba(0, 255, 255, ${alpha})`;
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
    ctx.fillStyle = color;
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
      const alpha = p.getAlpha();
      ctx.globalAlpha = alpha;
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

    if (boss.phaseChangeFlash > 0) {
      ctx.globalAlpha = 0.3 + Math.sin(boss.phaseChangeFlash * 0.05) * 0.7;
    }
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
    const barWidth = width;
    const barHeight = 6;
    const barX = x;
    const barY = y - 12;
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(barX, barY, barWidth, barHeight);
    ctx.fillStyle = color;
    ctx.fillRect(barX, barY, barWidth * boss.getHpRatio(), barHeight);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barWidth, barHeight);

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

    ctx.strokeStyle = `rgba(255, 50, 50, ${alpha})`;
    ctx.lineWidth = 1;
    ctx.setLineDash([8, 4]);
    ctx.beginPath();
    ctx.moveTo(0, dangerY);
    ctx.lineTo(Config.SCREEN_WIDTH, dangerY);
    ctx.stroke();
    ctx.setLineDash([]);

    // 警告文字
    if (warning) {
      ctx.fillStyle = `rgba(255, 50, 50, ${alpha})`;
      ctx.font = '10px monospace';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillText('DANGER', Config.SCREEN_WIDTH - 8, dangerY - 3);
    }
  }

  // ===== 前移进度条（顶部细条） =====
  drawAdvanceBar(timer, interval) {
    const ctx = this.ctx;
    const ratio = timer / interval;
    const barWidth = Config.SCREEN_WIDTH;
    const barHeight = 3;

    // 背景
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(0, 0, barWidth, barHeight);

    // 进度（越满越红）
    const r = Math.floor(255 * ratio);
    const g = Math.floor(100 * (1 - ratio));
    ctx.fillStyle = `rgb(${r}, ${g}, 50)`;
    ctx.fillRect(0, 0, barWidth * ratio, barHeight);
  }

  // ===== 被动技能图标栏（右侧纵列） =====
  drawPassiveBar(ownedPassives) {
    if (!ownedPassives || ownedPassives.length === 0) return;
    const ctx = this.ctx;
    const iconSize = 16;
    const gap = 4;
    const startX = Config.SCREEN_WIDTH - iconSize - 6;
    const startY = 50;

    for (let i = 0; i < ownedPassives.length; i++) {
      const p = ownedPassives[i];
      const y = startY + i * (iconSize + gap);

      // 背景圆
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.beginPath();
      ctx.arc(startX + iconSize / 2, y + iconSize / 2, iconSize / 2 + 2, 0, Math.PI * 2);
      ctx.fill();

      // 图标
      ctx.fillStyle = p.color;
      ctx.font = `${iconSize - 2}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(p.icon, startX + iconSize / 2, y + iconSize / 2);

      // 等级
      if (p.level > 1) {
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '8px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(p.level.toString(), startX + iconSize / 2, y + iconSize + 4);
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
    for (let i = 0; i < lives; i++) livesText += '♥';
    ctx.fillText(livesText, Config.SCREEN_WIDTH - 8, 8);

    if (combo > 1) {
      ctx.fillStyle = Config.NEON_YELLOW;
      ctx.font = 'bold 13px monospace';
      ctx.textAlign = 'left';
      ctx.fillText('COMBO x' + combo, 10, 26);
    }
  }

  // ===== 浮动文字 =====
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

  // ===== 标题页 =====
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
    ctx.font = '12px monospace';
    ctx.fillText('全被动 · 肉鸽打砖块', cx, cy + 45);

    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '16px monospace';
    ctx.fillText('点击屏幕开始', cx, cy + 90);

    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '10px monospace';
    ctx.fillText('v2.0.0', cx, Config.SCREEN_HEIGHT - 30);
  }

  // ===== 升级选择 =====
  drawLevelClear(upgrades, level, passives) {
    const ctx = this.ctx;
    const cx = Config.SCREEN_WIDTH / 2;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.fillRect(0, 0, Config.SCREEN_WIDTH, Config.SCREEN_HEIGHT);

    ctx.fillStyle = Config.NEON_GREEN;
    ctx.font = 'bold 22px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('LEVEL ' + level + ' CLEAR!', cx, 100);

    ctx.fillStyle = Config.NEON_YELLOW;
    ctx.font = '13px monospace';
    ctx.fillText('选择一项被动强化', cx, 130);

    const cardWidth = Config.SCREEN_WIDTH * 0.78;
    const cardHeight = 80;
    const startY = 170;
    const gap = 16;

    for (let i = 0; i < upgrades.length; i++) {
      const ug = upgrades[i];
      const cardX = cx - cardWidth / 2;
      const cardY = startY + i * (cardHeight + gap);
      const curLevel = passives ? passives.getLevel(ug.key) : 0;

      // 卡片背景
      ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, cardWidth, cardHeight, 8);
      ctx.fill();

      // 卡片边框
      ctx.strokeStyle = ug.color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, cardWidth, cardHeight, 8);
      ctx.stroke();

      // 图标
      ctx.fillStyle = ug.color;
      ctx.font = '22px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(ug.icon, cardX + 14, cardY + 32);

      // 名称
      ctx.fillStyle = ug.color;
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(ug.name, cardX + 46, cardY + 28);

      // 等级
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = '10px monospace';
      ctx.fillText('Lv.' + curLevel + ' → ' + (curLevel + 1), cardX + 46, cardY + 46);

      // 描述
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = '11px monospace';
      ctx.fillText(ug.desc, cardX + 46, cardY + 64);

      ug._hitArea = { x: cardX, y: cardY, w: cardWidth, h: cardHeight };
    }
  }

  // ===== Game Over =====
  drawGameOver(score, level, ownedPassives) {
    const ctx = this.ctx;
    const cx = Config.SCREEN_WIDTH / 2;
    const cy = Config.SCREEN_HEIGHT / 2;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(0, 0, Config.SCREEN_WIDTH, Config.SCREEN_HEIGHT);

    ctx.fillStyle = Config.NEON_PINK;
    ctx.font = 'bold 28px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('GAME OVER', cx, cy - 80);

    ctx.fillStyle = Config.NEON_CYAN;
    ctx.font = '16px monospace';
    ctx.fillText('得分: ' + score, cx, cy - 40);

    ctx.fillStyle = Config.NEON_GREEN;
    ctx.fillText('关卡: ' + level, cx, cy - 15);

    // 显示获得的被动
    if (ownedPassives && ownedPassives.length > 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = '11px monospace';
      ctx.fillText('获得词条:', cx, cy + 15);

      const iconsPerRow = 6;
      const iconSize = 20;
      const iconGap = 6;
      const totalWidth = Math.min(ownedPassives.length, iconsPerRow) * (iconSize + iconGap) - iconGap;
      const startX = cx - totalWidth / 2;

      for (let i = 0; i < ownedPassives.length; i++) {
        const p = ownedPassives[i];
        const row = Math.floor(i / iconsPerRow);
        const col = i % iconsPerRow;
        const px = startX + col * (iconSize + iconGap) + iconSize / 2;
        const py = cy + 38 + row * (iconSize + iconGap);

        ctx.fillStyle = p.color;
        ctx.font = (iconSize - 4) + 'px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(p.icon, px, py);
      }
    }

    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('点击屏幕重新开始', cx, cy + 100);
  }

  // ===== Loading =====
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
