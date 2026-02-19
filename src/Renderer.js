/**
 * Renderer.js - v4.0 打飞机模式渲染
 * 发射器 + 子弹 + 武器特效
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

    // 背景星空（预生成）
    this.stars = [];
    for (let i = 0; i < 60; i++) {
      this.stars.push({
        x: Math.random() * Config.SCREEN_WIDTH,
        y: Math.random() * Config.SCREEN_HEIGHT,
        size: 0.5 + Math.random() * 1.5,
        speed: 0.1 + Math.random() * 0.3,
        alpha: 0.2 + Math.random() * 0.5,
        twinkle: Math.random() * Math.PI * 2,
      });
    }
    this._frameCount = 0;
  }

  clear() {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = Config.BG_COLOR;
    ctx.fillRect(0, 0, Config.SCREEN_WIDTH, Config.SCREEN_HEIGHT);

    // 星空背景
    this._frameCount++;
    for (let i = 0; i < this.stars.length; i++) {
      const s = this.stars[i];
      s.y += s.speed;
      if (s.y > Config.SCREEN_HEIGHT) {
        s.y = -2;
        s.x = Math.random() * Config.SCREEN_WIDTH;
      }
      const twinkle = Math.sin(this._frameCount * 0.03 + s.twinkle) * 0.3;
      ctx.globalAlpha = Math.max(0.05, s.alpha + twinkle);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(s.x, s.y, s.size, s.size);
    }
    ctx.globalAlpha = 1;
  }

  // ===== 子弹 =====
  drawBullet(bullet) {
    const ctx = this.ctx;
    // 拖尾
    for (let i = 0; i < bullet.trail.length; i++) {
      const t = bullet.trail[i];
      const alpha = (i + 1) / bullet.trail.length * 0.4;
      const radius = bullet.radius * (i + 1) / bullet.trail.length * 0.8;
      ctx.beginPath();
      ctx.arc(t.x, t.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 255, 255, ' + alpha + ')';
      ctx.fill();
    }
    // 弹体
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
    ctx.fillStyle = bullet.color;
    ctx.fill();
    // 白色高光核心
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bullet.radius * 0.5, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
  }

  // ===== 发射器 =====
  drawLauncher(launcher) {
    const ctx = this.ctx;
    const { x, y, width, height, color, muzzleFlash } = launcher;
    const cx = x + width / 2;

    // 主体 - 梯形飞船
    ctx.fillStyle = color;

    ctx.beginPath();
    ctx.moveTo(cx - width / 2, y + height);
    ctx.lineTo(cx - width / 3, y + 4);
    ctx.lineTo(cx + width / 3, y + 4);
    ctx.lineTo(cx + width / 2, y + height);
    ctx.closePath();
    ctx.fill();

    // 炮管
    const gunW = Config.LAUNCHER_GUN_WIDTH;
    const gunH = Config.LAUNCHER_GUN_HEIGHT;
    ctx.fillStyle = '#FFFFFF';
    ctx.globalAlpha = 0.9;
    ctx.fillRect(cx - gunW / 2, y - gunH + 4, gunW, gunH);
    ctx.globalAlpha = 1;

    // 炮管顶端
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cx, y - gunH + 6, gunW / 2 + 1, 0, Math.PI * 2);
    ctx.fill();

    // 发射口闪光
    if (muzzleFlash > 0) {
      const flashAlpha = muzzleFlash / 3;
      ctx.globalAlpha = flashAlpha * 0.8;
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(cx, y - gunH + 2, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = flashAlpha * 0.4;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(cx, y - gunH + 2, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

        // 尾焰
    const flameH = 6 + Math.random() * 5;
    const flameW = width / 3;
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cx - flameW, y + height);
    ctx.lineTo(cx, y + height + flameH);
    ctx.lineTo(cx + flameW, y + height);
    ctx.closePath();
    ctx.fill();
    // 内焰
    const innerH = 3 + Math.random() * 3;
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.moveTo(cx - flameW * 0.4, y + height);
    ctx.lineTo(cx, y + height + innerH);
    ctx.lineTo(cx + flameW * 0.4, y + height);
    ctx.closePath();
    ctx.fill();

  }

  // ===== 砖块 =====
  drawBrick(brick) {
    if (!brick.alive) return;
    const ctx = this.ctx;
    const { x, y, width, height, color, hp, maxHp } = brick;
    const type = brick.type || 'normal';

    // 隐身砖块不可见时只画鬼影
    if (type === 'stealth' && !brick.visible) {
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = Config.BRICK_TYPE_COLORS.stealth;
      ctx.beginPath();
      ctx.roundRect(x, y, width, height, 3);
      ctx.fill();
      ctx.globalAlpha = 1;
      return;
    }

    // 接近危险线时变红
    const dangerY = Config.SCREEN_HEIGHT * Config.BRICK_DANGER_Y;
    const dangerDist = dangerY - (y + height);
    const dangerRatio = dangerDist < 80 ? 1 - dangerDist / 80 : 0;

    // 受击闪白
    if (brick.flashTimer > 0) {
      brick.flashTimer--;
      ctx.fillStyle = '#FFFFFF';
    } else if (dangerRatio > 0.5) {
      const pulse = 0.5 + Math.sin(Date.now() * 0.01) * 0.3;
      ctx.fillStyle = 'rgba(255, ' + Math.floor(50 * (1 - dangerRatio)) + ', ' + Math.floor(50 * (1 - dangerRatio)) + ', ' + (0.7 + pulse * 0.3) + ')';
    } else {
      ctx.fillStyle = color;
    }

    // 隐身砖块渐隐
    if (type === 'stealth') {
      ctx.globalAlpha = 0.6 + Math.sin(Date.now() * 0.003) * 0.2;
    }

    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 3);
    ctx.fill();

    // === 砖块类型特殊视觉 ===

    // 快速砖块：向下速度线
    if (type === 'fast') {
      ctx.strokeStyle = 'rgba(255,136,0,0.5)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 2; i++) {
        const lx = x + width * 0.3 + i * width * 0.4;
        ctx.beginPath();
        ctx.moveTo(lx, y - 3);
        ctx.lineTo(lx, y + 6);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(lx - 2, y + 3);
        ctx.lineTo(lx, y + 6);
        ctx.lineTo(lx + 2, y + 3);
        ctx.stroke();
      }
    }

    // 护盾砖块：外层白色半透明框
    if (type === 'shield' && brick.shieldHp > 0) {
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(x - 2, y - 2, width + 4, height + 4, 5);
      ctx.stroke();
    }

    // 分裂砖块：X裂纹
    if (type === 'split') {
      ctx.strokeStyle = 'rgba(0,255,200,0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + 3, y + 3);
      ctx.lineTo(x + width - 3, y + height - 3);
      ctx.moveTo(x + width - 3, y + 3);
      ctx.lineTo(x + 3, y + height - 3);
      ctx.stroke();
    }

    // 治愈砖块：脉冲绿色光环
    if (type === 'healer') {
      const healPulse = (brick.healTimer || 0) / 3000;
      if (healPulse > 0.7) {
        const ring = (healPulse - 0.7) / 0.3;
        ctx.globalAlpha = (1 - ring) * 0.4;
        ctx.strokeStyle = Config.NEON_GREEN;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(x + width / 2, y + height / 2, width / 2 + ring * 12, 0, Math.PI * 2);
        ctx.stroke();
      }
      // 红十字标记
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      const cx = x + width / 2;
      const cy = y + height / 2;
      ctx.fillRect(cx - 1, cy - 4, 2, 8);
      ctx.fillRect(cx - 4, cy - 1, 8, 2);
    }

    ctx.globalAlpha = 1;

    // 高HP砖块发光边框
    if (maxHp >= 4) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(x, y, width, height, 3);
      ctx.stroke();
    } else if (maxHp > 1 && type !== 'shield') {
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(x, y, width, height, 3);
      ctx.stroke();
    }

    // HP数字
    if (hp > 1) {
      ctx.fillStyle = brick.flashTimer > 0 ? '#000000' : '#FFFFFF';
      ctx.font = 'bold 10px monospace';
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
    // 外发光
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, drawSize / 2, 0, Math.PI * 2);
    ctx.fill();
    // 白色高光
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.arc(x - 2, y - 2, drawSize / 4, 0, Math.PI * 2);
    ctx.fill();
    // 外圈
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, drawSize / 2 + 3, 0, Math.PI * 2);
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
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 6);
    ctx.fill();
    ctx.globalAlpha = 1;
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

  // ===== 危险线（动态呼吸） =====
  drawDangerLine(dangerY) {
    const ctx = this.ctx;
    const pulse = 0.15 + Math.sin(Date.now() * 0.003) * 0.08;
    ctx.strokeStyle = 'rgba(255, 50, 50, ' + pulse + ')';
    ctx.lineWidth = 1;
    ctx.setLineDash([8, 4]);
    ctx.beginPath();
    ctx.moveTo(0, dangerY);
    ctx.lineTo(Config.SCREEN_WIDTH, dangerY);
    ctx.stroke();
    ctx.setLineDash([]);
    // 简化警告区
    ctx.fillStyle = 'rgba(255, 0, 0, ' + (pulse * 0.15) + ')';
    ctx.fillRect(0, dangerY - 20, Config.SCREEN_WIDTH, 20);
  }

  // ===== 武器视觉渲染 =====
  drawWeapons(weapons, launcher) {
    const ctx = this.ctx;
    const lcx = launcher.getCenterX();
    const lcy = launcher.y;

    for (const key in weapons) {
      const weapon = weapons[key];
      const data = weapon.getRenderData(lcx, lcy);

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

    if (blades.length > 0) {
      const first = blades[0];
      const lcx = first.x - Math.cos(first.angle) * 70;
      const lcy = first.y - Math.sin(first.angle) * 70;
      ctx.strokeStyle = 'rgba(' + this._hexToRgb(color) + ', 0.12)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.arc(lcx, lcy, 70, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    for (const b of blades) {
      ctx.globalAlpha = 0.2;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(b.x, b.y, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.angle);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, -12);
      ctx.lineTo(6, 0);
      ctx.lineTo(0, 12);
      ctx.lineTo(-6, 0);
      ctx.closePath();
      ctx.fill();
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
      ctx.restore();
    }
  }

  _drawFireSurge(data, ctx) {
    const { waves, color } = data;
    for (const w of waves) {
      ctx.globalAlpha = w.alpha * 0.7;

      ctx.fillStyle = color;
      ctx.fillRect(w.x - w.width / 2, w.y - 8, w.width, 16);

      ctx.fillStyle = 'rgba(255, 255, 150, 0.5)';
      ctx.fillRect(w.x - w.width / 4, w.y - 3, w.width / 2, 6);

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

      ctx.strokeStyle = 'rgba(' + this._hexToRgb(color) + ', 0.3)';
      ctx.lineWidth = 6;
      ctx.beginPath();
      for (let i = 0; i < bolt.points.length; i++) {
        const p = bolt.points[i];
        const jx = (i > 0 && i < bolt.points.length - 1) ? (Math.random() - 0.5) * 15 : 0;
        const jy = (i > 0 && i < bolt.points.length - 1) ? (Math.random() - 0.5) * 10 : 0;
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x + jx, p.y + jy);
      }
      ctx.stroke();

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

      for (let i = 1; i < bolt.points.length; i++) {
        const p = bolt.points[i];
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
        ctx.fill();
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
      for (let i = 0; i < m.trail.length; i++) {
        const t = m.trail[i];
        const alpha = (i + 1) / m.trail.length * 0.6;
        const size = 2 + (i / m.trail.length) * 3;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = Config.NEON_ORANGE;
        ctx.beginPath();
        ctx.arc(t.x, t.y, size, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,200,0.5)';
        ctx.beginPath();
        ctx.arc(t.x, t.y, size * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(m.x, m.y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(m.x, m.y - 1, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const e of explosions) {
      ctx.globalAlpha = e.alpha * 0.4;
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius * (1.2 - e.alpha * 0.5), 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = e.alpha * 0.2;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius * (1 - e.alpha * 0.3), 0, Math.PI * 2);
      ctx.fill();
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

      ctx.fillStyle = 'rgba(255, 50, 50, 0.1)';
      ctx.fillRect(b.x - b.width * 3, b.topY, b.width * 6, bh);

      ctx.fillStyle = 'rgba(255, 80, 80, 0.3)';
      ctx.fillRect(b.x - b.width * 1.5, b.topY, b.width * 3, bh);

      ctx.fillStyle = color;
      ctx.fillRect(b.x - b.width / 2, b.topY, b.width, bh);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.fillRect(b.x - 1, b.topY, 2, bh);


      const scanY = (Date.now() * 0.3) % bh;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.fillRect(b.x - b.width * 2, scanY, b.width * 4, 2);
    }
    ctx.globalAlpha = 1;
  }

  _drawIceField(data, ctx) {
    const { icicles, color } = data;
    for (const ic of icicles) {
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

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(ic.x, ic.y + 10);
      ctx.lineTo(ic.x - 5, ic.y - 6);
      ctx.lineTo(ic.x + 5, ic.y - 6);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.beginPath();
      ctx.moveTo(ic.x, ic.y + 5);
      ctx.lineTo(ic.x - 2, ic.y - 3);
      ctx.lineTo(ic.x + 2, ic.y - 3);
      ctx.closePath();
      ctx.fill();
    }
  }

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
    const startY = Config.SAFE_TOP + 36;

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
  drawHUD(score, combo, playerLevel, difficulty, soundEnabled) {
    const ctx = this.ctx;
    const top = Config.SAFE_TOP;

    ctx.fillStyle = Config.NEON_CYAN;
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('SCORE:' + score, 10, top);
    ctx.fillStyle = Config.NEON_GREEN;
    ctx.textAlign = 'center';
    ctx.fillText('Lv.' + playerLevel, Config.SCREEN_WIDTH / 2, top);
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '10px monospace';
    ctx.textAlign = 'right';
    ctx.fillText('WAVE ' + (difficulty + 1), Config.SCREEN_WIDTH - 8, top);
    if (combo > 1) {
      ctx.fillStyle = Config.NEON_YELLOW;
      ctx.font = 'bold 13px monospace';
      ctx.textAlign = 'left';
      ctx.fillText('COMBO x' + combo, 10, top + 18);
    }
    ctx.fillStyle = soundEnabled ? 'rgba(255,255,255,0.5)' : 'rgba(255,50,50,0.5)';
    ctx.font = '14px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(soundEnabled ? '♪' : '♪̶', 10, Config.SCREEN_HEIGHT - Config.SAFE_BOTTOM - 48);
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
    ctx.fillText('无限射击 · 弹幕清砖 · 满屏特效', cx, cy + 45);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '16px monospace';
    ctx.fillText('点击屏幕开始', cx, cy + 90);
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '10px monospace';
    ctx.fillText('v5.0.0', cx, Config.SCREEN_HEIGHT - 30);
  }

  // ===== 经验球 =====
  drawExpOrbs(orbs) {
    if (!orbs || orbs.length === 0) return;
    const ctx = this.ctx;
    const size = Config.EXP_ORB_SIZE;
    for (let i = 0; i < orbs.length; i++) {
      const o = orbs[i];
      ctx.fillStyle = Config.EXP_ORB_COLOR;
      ctx.beginPath();
      ctx.arc(o.x, o.y, size, 0, Math.PI * 2);
      ctx.fill();
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

    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, barH / 2);
    ctx.fill();

    if (ratio > 0) {
      ctx.fillStyle = Config.NEON_CYAN;
      ctx.beginPath();
      ctx.roundRect(barX, barY, barW * ratio, barH, barH / 2);
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(barX + barW * ratio, barY + barH / 2, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = Config.NEON_CYAN;
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText('Lv.' + playerLevel, barX - 4, barY + barH / 2);

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

    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, sw, sh);

    ctx.fillStyle = Config.NEON_GREEN;
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⬆ LEVEL ' + playerLevel, cx, sh * 0.18);

    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '11px monospace';
    ctx.fillText('选择一项强化', cx, sh * 0.18 + 24);

    const count = choices.length;
    const gap = 8;
    const totalW = sw - 20;
    const cardW = Math.floor((totalW - gap * (count - 1)) / count);
    const cardH = sh * 0.5;
    const startX = (sw - (cardW * count + gap * (count - 1))) / 2;
    const startY = sh * 0.26;

    for (let i = 0; i < count; i++) {
      const c = choices[i];
      const cardX = startX + i * (cardW + gap);
      const cardY = startY;

      const isNew = c.isNew && c.type === 'weapon';
      ctx.fillStyle = 'rgba(8, 2, 32, 0.92)';
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, cardW, cardH, 10);
      ctx.fill();

      ctx.strokeStyle = c.color;
      ctx.lineWidth = isNew ? 1.5 : 1;
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, cardW, cardH, 10);
      ctx.stroke();

      const rgb = this._hexToRgb(c.color);
      ctx.fillStyle = 'rgba(' + rgb + ', 0.3)';
      ctx.beginPath();
      ctx.roundRect(cardX + 1, cardY + 1, cardW - 2, 3, [2, 2, 0, 0]);
      ctx.fill();

      const ccx = cardX + cardW / 2;

      const typeLabel = c.type === 'weapon' ? '武器' : '强化';
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.font = '11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(typeLabel, ccx, cardY + 20);

      if (isNew) {
        ctx.fillStyle = Config.NEON_YELLOW;
        ctx.font = 'bold 11px monospace';
        ctx.fillText('NEW!', ccx, cardY + 36);
      }

      ctx.fillStyle = c.color;
      ctx.font = '38px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(c.icon, ccx, cardY + cardH * 0.3);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 14px monospace';
      ctx.textBaseline = 'middle';
      this._drawTextWrap(ctx, c.name, ccx, cardY + cardH * 0.52, cardW - 10, 16);

      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.font = '11px monospace';
      this._drawTextWrap(ctx, c.desc, ccx, cardY + cardH * 0.66, cardW - 10, 14);

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

      c._hitArea = { x: cardX, y: cardY, w: cardW, h: cardH };
    }
  }

  _drawTextWrap(ctx, text, cx, y, maxW, lineH) {
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

  _drawLevelDots(ctx, cx, y, curLv, maxLv, color, cardW) {
    const dotSize = 7;
    const dotGap = 4;
    const totalW = maxLv * dotSize + (maxLv - 1) * dotGap;
    const startX = cx - totalW / 2;

    for (let i = 0; i < maxLv; i++) {
      const dx = startX + i * (dotSize + dotGap);
      if (i < curLv) {
        ctx.fillStyle = color;
      } else if (i === curLv) {
        ctx.fillStyle = 'rgba(255,255,255,' + (0.4 + Math.sin(Date.now() * 0.008) * 0.4) + ')';
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
      }
      ctx.fillRect(dx, y - dotSize / 2, dotSize, dotSize);
    }
  }

  // ===== Game Over =====
  drawGameOver(score, playerLevel, ownedList) {
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
    ctx.fillText('等级: Lv.' + playerLevel, cx, cy - 35);

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

  // ===== v5.0 章节选择界面 =====
  drawChapterSelect(maxChapter, records, coins) {
    const ctx = this.ctx;
    const sw = Config.SCREEN_WIDTH;
    const sh = Config.SCREEN_HEIGHT;
    const top = Config.SAFE_TOP;

    // 背景
    ctx.fillStyle = 'rgba(0,0,0,0.9)';
    ctx.fillRect(0, 0, sw, sh);

    // 顶部栏
    ctx.fillStyle = Config.NEON_YELLOW;
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('💰 ' + coins, 12, top);

    ctx.fillStyle = Config.NEON_GREEN;
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'right';
    ctx.fillText('[升级]', sw - 12, top);
    this._upgradeButtonArea = { x: sw - 60, y: top - 4, w: 56, h: 22 };

    // 标题
    ctx.fillStyle = Config.NEON_CYAN;
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('选择章节', sw / 2, top + 28);

    // 章节网格 3列
    const cols = 3;
    const gap = 10;
    const margin = 16;
    const cardW = Math.floor((sw - margin * 2 - gap * (cols - 1)) / cols);
    const cardH = 64;
    const gridTop = top + 58;
    const bossIcons = { charger: '🔴', guardian: '🔵', summoner: '🟣', laser: '🟡', phantom: '⚪' };
    const bossTypes = ['charger', 'guardian', 'summoner', 'laser', 'phantom'];

    this._chapterHitAreas = [];

    const totalRows = Math.ceil(100 / cols);
    const scrollY = this._chapterScrollY || 0;

    for (let i = 0; i < 100; i++) {
      const row = Math.floor(i / cols);
      const col = i % cols;
      const chapter = i + 1;
      const x = margin + col * (cardW + gap);
      const y = gridTop + row * (cardH + gap) - scrollY;

      // 裁剪不可见的
      if (y + cardH < gridTop - 10 || y > sh + 10) continue;

      const unlocked = chapter <= maxChapter;
      const cleared = records[chapter] && records[chapter].cleared;
      const bossType = bossTypes[(chapter - 1) % 5];

      // 卡片背景
      if (!unlocked) {
        ctx.fillStyle = 'rgba(40,40,60,0.5)';
      } else if (cleared) {
        ctx.fillStyle = 'rgba(0,60,40,0.6)';
      } else {
        ctx.fillStyle = 'rgba(20,10,60,0.8)';
      }
      ctx.beginPath();
      ctx.roundRect(x, y, cardW, cardH, 8);
      ctx.fill();

      // 边框
      ctx.strokeStyle = unlocked ? (cleared ? Config.NEON_GREEN : Config.NEON_CYAN) : 'rgba(100,100,100,0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(x, y, cardW, cardH, 8);
      ctx.stroke();

      const ccx = x + cardW / 2;

      if (!unlocked) {
        ctx.fillStyle = 'rgba(150,150,150,0.5)';
        ctx.font = '20px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🔒', ccx, y + cardH / 2);
      } else {
        // 章节号
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 14px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText('' + chapter, ccx, y + 6);

        // Boss图标
        ctx.font = '18px monospace';
        ctx.textBaseline = 'middle';
        ctx.fillText(bossIcons[bossType] || '⚪', ccx, y + 34);

        // 通关标记
        if (cleared) {
          ctx.fillStyle = Config.NEON_GREEN;
          ctx.font = '10px monospace';
          ctx.textBaseline = 'bottom';
          ctx.fillText('✅', ccx, y + cardH - 4);
        }
      }

      if (unlocked) {
        this._chapterHitAreas.push({ chapter: chapter, x: x, y: y, w: cardW, h: cardH });
      }
    }

    // 底部提示
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('上下滑动浏览', sw / 2, sh - Config.SAFE_BOTTOM - 4);
  }

  // ===== 升级商店 =====
  drawUpgradeShop(saveManager) {
    const ctx = this.ctx;
    const sw = Config.SCREEN_WIDTH;
    const sh = Config.SCREEN_HEIGHT;
    const top = Config.SAFE_TOP;

    ctx.fillStyle = 'rgba(0,0,0,0.95)';
    ctx.fillRect(0, 0, sw, sh);

    // 顶部
    ctx.fillStyle = Config.NEON_YELLOW;
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('💰 ' + saveManager.getCoins(), 12, top);

    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '12px monospace';
    ctx.textAlign = 'right';
    ctx.fillText('[返回]', sw - 12, top);
    this._shopBackArea = { x: sw - 50, y: top - 4, w: 46, h: 22 };

    ctx.fillStyle = Config.NEON_PINK;
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('永久升级', sw / 2, top + 28);

    const upgrades = [
      { key: 'attack', name: '基础攻击', desc: '子弹伤害+1', icon: '⚔' },
      { key: 'fireRate', name: '基础射速', desc: '射击间隔-2%', icon: '»' },
      { key: 'crit', name: '暴击率', desc: '暴击+1%', icon: '✕' },
      { key: 'startLevel', name: '起始等级', desc: '开局自带等级', icon: '⬆' },
      { key: 'coinBonus', name: '金币加成', desc: '金币+5%', icon: '💰' },
      { key: 'expBonus', name: '经验加成', desc: '经验+3%', icon: '✧' },
    ];

    const itemH = 56;
    const itemGap = 6;
    const startY = top + 56;
    const itemMargin = 12;

    this._shopUpgradeAreas = [];

    for (let i = 0; i < upgrades.length; i++) {
      const u = upgrades[i];
      const y = startY + i * (itemH + itemGap);
      const lv = saveManager.getUpgrade(u.key);
      const maxed = saveManager.isUpgradeMaxed(u.key);
      const cost = saveManager.getUpgradeCost(u.key);
      const canAfford = saveManager.getCoins() >= cost;

      // 行背景
      ctx.fillStyle = 'rgba(20,10,50,0.8)';
      ctx.beginPath();
      ctx.roundRect(itemMargin, y, sw - itemMargin * 2, itemH, 8);
      ctx.fill();

      // 图标
      ctx.fillStyle = maxed ? Config.NEON_GREEN : Config.NEON_CYAN;
      ctx.font = '20px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(u.icon, itemMargin + 24, y + itemH / 2);

      // 名称 + 等级
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(u.name, itemMargin + 46, y + 8);

      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = '10px monospace';
      ctx.fillText(u.desc, itemMargin + 46, y + 24);

      // 等级条
      const SaveManagerClass = require('./SaveManager');
      const maxLvl = SaveManagerClass.UPGRADE_CONFIG[u.key] ? SaveManagerClass.UPGRADE_CONFIG[u.key].maxLevel : 1;
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.font = '9px monospace';
      ctx.fillText('Lv.' + lv + '/' + maxLvl, itemMargin + 46, y + 38);

      // 升级按钮
      const btnW = 64;
      const btnH = 28;
      const btnX = sw - itemMargin - btnW - 8;
      const btnY = y + (itemH - btnH) / 2;

      if (maxed) {
        ctx.fillStyle = 'rgba(80,255,80,0.15)';
        ctx.beginPath();
        ctx.roundRect(btnX, btnY, btnW, btnH, 6);
        ctx.fill();
        ctx.fillStyle = Config.NEON_GREEN;
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('MAX', btnX + btnW / 2, btnY + btnH / 2);
      } else {
        ctx.fillStyle = canAfford ? 'rgba(0,200,255,0.2)' : 'rgba(100,100,100,0.15)';
        ctx.beginPath();
        ctx.roundRect(btnX, btnY, btnW, btnH, 6);
        ctx.fill();
        ctx.strokeStyle = canAfford ? Config.NEON_CYAN : 'rgba(100,100,100,0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(btnX, btnY, btnW, btnH, 6);
        ctx.stroke();
        ctx.fillStyle = canAfford ? '#FFFFFF' : 'rgba(150,150,150,0.5)';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('💰' + cost, btnX + btnW / 2, btnY + btnH / 2);
      }

      if (!maxed) {
        this._shopUpgradeAreas.push({ key: u.key, x: btnX, y: btnY, w: btnW, h: btnH });
      }
    }
  }

  // ===== 章节通关结算 =====
  drawChapterClear(chapter, score, playerLevel, maxCombo, ownedList, coinsEarned, isFirstClear) {
    const ctx = this.ctx;
    const sw = Config.SCREEN_WIDTH;
    const sh = Config.SCREEN_HEIGHT;
    const cx = sw / 2;

    ctx.fillStyle = 'rgba(0,0,0,0.9)';
    ctx.fillRect(0, 0, sw, sh);

    // 标题
    const pulse = 0.8 + Math.sin(Date.now() * 0.005) * 0.2;
    ctx.globalAlpha = pulse;
    ctx.fillStyle = Config.NEON_YELLOW;
    ctx.font = 'bold 22px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('✨ CHAPTER ' + chapter + ' CLEAR ✨', cx, sh * 0.15);
    ctx.globalAlpha = 1;

    // 数据
    ctx.fillStyle = Config.NEON_CYAN;
    ctx.font = '14px monospace';
    ctx.fillText('得分: ' + score, cx, sh * 0.26);
    ctx.fillStyle = Config.NEON_GREEN;
    ctx.fillText('等级: Lv.' + playerLevel, cx, sh * 0.32);
    ctx.fillStyle = Config.NEON_PINK;
    ctx.fillText('最高Combo: ' + maxCombo, cx, sh * 0.38);

    // Build
    if (ownedList && ownedList.length > 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = '11px monospace';
      ctx.fillText('你的 Build:', cx, sh * 0.46);

      const perRow = 6;
      const icoSz = 22;
      const icoGap = 6;
      const totalW = Math.min(ownedList.length, perRow) * (icoSz + icoGap) - icoGap;
      const startX = cx - totalW / 2;
      for (let i = 0; i < ownedList.length; i++) {
        const p = ownedList[i];
        const row = Math.floor(i / perRow);
        const col = i % perRow;
        const px = startX + col * (icoSz + icoGap) + icoSz / 2;
        const py = sh * 0.52 + row * (icoSz + icoGap + 4);
        ctx.fillStyle = p.color;
        ctx.font = (icoSz - 4) + 'px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(p.icon, px, py);
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = '7px monospace';
        ctx.fillText(typeof p.level === 'number' ? 'Lv.' + p.level : p.level, px, py + 12);
      }
    }

    // 金币
    ctx.fillStyle = Config.NEON_YELLOW;
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('💰 +' + coinsEarned + ' 金币', cx, sh * 0.68);
    if (isFirstClear) {
      ctx.fillStyle = Config.NEON_ORANGE;
      ctx.font = '12px monospace';
      ctx.fillText('(首通 ×2!)', cx, sh * 0.73);
    }

    // 按钮
    const btnW = 100;
    const btnH = 36;
    const btnGap = 16;

    // 下一章
    const nextX = cx - btnW - btnGap / 2;
    const nextY = sh * 0.80;
    ctx.fillStyle = 'rgba(0,200,100,0.2)';
    ctx.beginPath();
    ctx.roundRect(nextX, nextY, btnW, btnH, 8);
    ctx.fill();
    ctx.strokeStyle = Config.NEON_GREEN;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(nextX, nextY, btnW, btnH, 8);
    ctx.stroke();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('下一章', nextX + btnW / 2, nextY + btnH / 2);

    // 返回
    const backX = cx + btnGap / 2;
    const backY = sh * 0.80;
    ctx.fillStyle = 'rgba(100,100,100,0.2)';
    ctx.beginPath();
    ctx.roundRect(backX, backY, btnW, btnH, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(backX, backY, btnW, btnH, 8);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = 'bold 13px monospace';
    ctx.fillText('返回', backX + btnW / 2, backY + btnH / 2);

    this._clearNextArea = { x: nextX, y: nextY, w: btnW, h: btnH };
    this._clearBackArea = { x: backX, y: backY, w: btnW, h: btnH };
  }

  // ===== Boss警告 =====
  drawBossWarning(bossType) {
    const ctx = this.ctx;
    const sw = Config.SCREEN_WIDTH;
    const sh = Config.SCREEN_HEIGHT;
    const cx = sw / 2;

    const flash = Math.sin(Date.now() * 0.01) > 0 ? 0.6 : 0.3;
    ctx.fillStyle = 'rgba(255,0,0,' + (flash * 0.15) + ')';
    ctx.fillRect(0, 0, sw, sh);

    ctx.fillStyle = 'rgba(255,50,50,' + flash + ')';
    ctx.font = 'bold 28px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⚠ WARNING ⚠', cx, sh * 0.4);

    const bossNames = {
      charger: '冲锋者',
      guardian: '护盾卫士',
      summoner: '召唤师',
      laser: '激光炮台',
      phantom: '幽影刺客',
    };
    const bossIcons = {
      charger: '🔴',
      guardian: '🔵',
      summoner: '🟣',
      laser: '🟡',
      phantom: '⚪',
    };

    ctx.fillStyle = '#FFFFFF';
    ctx.globalAlpha = flash;
    ctx.font = 'bold 16px monospace';
    ctx.fillText(bossIcons[bossType] + ' ' + (bossNames[bossType] || 'BOSS') + ' 来袭!', cx, sh * 0.5);
    ctx.globalAlpha = 1;
  }

  // ===== 章节内HUD =====
  drawChapterHUD(chapter, score, combo, playerLevel, elapsedMs, soundEnabled) {
    const ctx = this.ctx;
    const top = Config.SAFE_TOP;

    // 章节号
    ctx.fillStyle = Config.NEON_PINK;
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('CH.' + chapter, 10, top);

    // 分数
    ctx.fillStyle = Config.NEON_CYAN;
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('' + score, Config.SCREEN_WIDTH / 2, top);

    // 等级
    ctx.fillStyle = Config.NEON_GREEN;
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'right';
    ctx.fillText('Lv.' + playerLevel, Config.SCREEN_WIDTH - 8, top);

    // 时间
    const sec = Math.floor(elapsedMs / 1000);
    const min = Math.floor(sec / 60);
    const s = sec % 60;
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '12px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(min + ':' + (s < 10 ? '0' : '') + s, Config.SCREEN_WIDTH - 8, top + 16);

    // Combo
    if (combo > 1) {
      ctx.fillStyle = Config.NEON_YELLOW;
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'left';
      ctx.fillText('COMBO x' + combo, 10, top + 18);
    }

    // 音效
    ctx.fillStyle = soundEnabled ? 'rgba(255,255,255,0.5)' : 'rgba(255,50,50,0.5)';
    ctx.font = '14px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(soundEnabled ? '♪' : '♪̶', 10, Config.SCREEN_HEIGHT - Config.SAFE_BOTTOM - 48);
  }

  // ===== 新Boss渲染 =====
  drawBoss(boss) {
    if (!boss || !boss.alive) return;
    const ctx = this.ctx;
    const { x, y, width, height, type } = boss;

    switch (type) {
      case 'charger': this._drawChargerBoss(boss, ctx); break;
      case 'guardian': this._drawGuardianBoss(boss, ctx); break;
      case 'summoner': this._drawSummonerBoss(boss, ctx); break;
      case 'laser': this._drawLaserBoss(boss, ctx); break;
      case 'phantom': this._drawPhantomBoss(boss, ctx); break;
      default: this._drawDefaultBoss(boss, ctx); break;
    }

    // HP条（所有Boss通用）
    const barW = boss.width;
    const barH = 6;
    const barX = boss.x;
    const barY = boss.y - 14;
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(barX, barY, barW, barH);
    const hpRatio = boss.hp / boss.maxHp;
    const hpColor = hpRatio > 0.5 ? Config.NEON_CYAN : hpRatio > 0.25 ? Config.NEON_YELLOW : Config.NEON_RED;
    ctx.fillStyle = hpColor;
    ctx.fillRect(barX, barY, barW * hpRatio, barH);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barW, barH);
  }

  _drawChargerBoss(boss, ctx) {
    const { x, y, width, height } = boss;
    const isCharging = boss.state === 'charging' || boss.state === 'dashing';

    // 闪烁警告
    if (boss.state === 'charging') {
      const flash = Math.sin(Date.now() * 0.02) > 0;
      ctx.globalAlpha = flash ? 1 : 0.4;
    }

    // 主体（红色宽体）
    ctx.fillStyle = isCharging ? '#FF4444' : '#CC2222';
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 6);
    ctx.fill();

    // 受击闪白
    if (boss.flashTimer > 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.beginPath();
      ctx.roundRect(x, y, width, height, 6);
      ctx.fill();
    }

    // 冲锋时火焰拖影
    if (boss.state === 'dashing') {
      for (let i = 0; i < 3; i++) {
        ctx.globalAlpha = 0.2 - i * 0.06;
        ctx.fillStyle = Config.NEON_ORANGE;
        ctx.fillRect(x + 10 + i * 8, y - 10 - i * 6, width - 20 - i * 16, 4);
      }
    }

    ctx.globalAlpha = 1;

    // Boss名
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('冲锋者', x + width / 2, y + height / 2);
  }

  _drawGuardianBoss(boss, ctx) {
    const { x, y, width, height } = boss;

    // 主体（蓝色方块）
    ctx.fillStyle = boss.flashTimer > 0 ? '#FFFFFF' : '#2244CC';
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 8);
    ctx.fill();

    // 旋转护盾
    if (boss.shields) {
      const cx = x + width / 2;
      const cy = y + height / 2;
      const shieldR = Math.max(width, height) / 2 + 12;
      for (let i = 0; i < boss.shields.length; i++) {
        const s = boss.shields[i];
        if (s.hp <= 0) continue;
        const angle = (boss.shieldAngle || 0) + (Math.PI * 2 / boss.shields.length) * i;
        const sx = cx + Math.cos(angle) * shieldR;
        const sy = cy + Math.sin(angle) * shieldR;

        ctx.globalAlpha = 0.6;
        ctx.fillStyle = '#6688FF';
        ctx.beginPath();
        ctx.arc(sx, sy, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.3;
        ctx.strokeStyle = '#AACCFF';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(sx, sy, 13, angle - 0.5, angle + 0.5);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('卫士', x + width / 2, y + height / 2);
  }

  _drawSummonerBoss(boss, ctx) {
    const { x, y, width, height } = boss;

    // 紫色核心
    ctx.fillStyle = boss.flashTimer > 0 ? '#FFFFFF' : '#8822CC';
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 10);
    ctx.fill();

    // 召唤状态光环
    if (boss.state === 'summoning') {
      ctx.globalAlpha = 0.4;
      ctx.strokeStyle = Config.NEON_PINK;
      ctx.lineWidth = 2;
      const pulse = 15 + Math.sin(Date.now() * 0.01) * 5;
      ctx.beginPath();
      ctx.arc(x + width / 2, y + height / 2, pulse + width / 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // 无敌标记
    if (boss.state === 'summoning') {
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.beginPath();
      ctx.roundRect(x, y, width, height, 10);
      ctx.fill();
    }

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('召唤师', x + width / 2, y + height / 2);
  }

  _drawLaserBoss(boss, ctx) {
    const { x, y, width, height } = boss;

    // 黄色三角体
    const cx = x + width / 2;
    ctx.fillStyle = boss.flashTimer > 0 ? '#FFFFFF' : '#CCAA00';
    ctx.beginPath();
    ctx.moveTo(cx, y);
    ctx.lineTo(x + width, y + height);
    ctx.lineTo(x, y + height);
    ctx.closePath();
    ctx.fill();

    // 充能核心
    if (boss.state === 'charging') {
      const chargeProgress = boss.stateTimer / 2000;
      const coreR = 4 + chargeProgress * 8;
      ctx.fillStyle = Config.NEON_YELLOW;
      ctx.globalAlpha = 0.5 + chargeProgress * 0.5;
      ctx.beginPath();
      ctx.arc(cx, y + height * 0.4, coreR, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // 激光发射
    if (boss.state === 'firing' && boss.laserX !== undefined) {
      const lx = boss.laserX;
      const lw = boss.laserWidth || 8;
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = 'rgba(255,50,50,0.1)';
      ctx.fillRect(lx - lw * 3, y + height, lw * 6, Config.SCREEN_HEIGHT);
      ctx.fillStyle = 'rgba(255,80,80,0.3)';
      ctx.fillRect(lx - lw * 1.5, y + height, lw * 3, Config.SCREEN_HEIGHT);
      ctx.fillStyle = Config.NEON_YELLOW;
      ctx.fillRect(lx - lw / 2, y + height, lw, Config.SCREEN_HEIGHT);
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillRect(lx - 1, y + height, 2, Config.SCREEN_HEIGHT);
      ctx.globalAlpha = 1;
    }

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('炮台', cx, y + height * 0.65);
  }

  _drawPhantomBoss(boss, ctx) {
    const { x, y, width, height } = boss;

    // 瞬移消失时半透明
    if (boss.state === 'blinking') {
      ctx.globalAlpha = 0.15;
    } else if (boss.state === 'appearing') {
      ctx.globalAlpha = 0.5 + Math.sin(Date.now() * 0.02) * 0.3;
    }

    // 白色半透明体
    ctx.fillStyle = boss.flashTimer > 0 ? '#FFFFFF' : 'rgba(200,200,220,0.8)';
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 12);
    ctx.fill();

    // 残影
    if (boss.afterImages) {
      for (let i = 0; i < boss.afterImages.length; i++) {
        const img = boss.afterImages[i];
        ctx.globalAlpha = img.alpha * 0.3;
        ctx.fillStyle = 'rgba(200,200,220,0.5)';
        ctx.beginPath();
        ctx.roundRect(img.x, img.y, width, height, 12);
        ctx.fill();
      }
    }

    ctx.globalAlpha = 1;
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('幽影', x + width / 2, y + height / 2);
  }

  _drawDefaultBoss(boss, ctx) {
    const { x, y, width, height } = boss;
    const color = Config.NEON_CYAN;
    ctx.fillStyle = boss.flashTimer > 0 ? '#FFFFFF' : color;
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 6);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('BOSS', x + width / 2, y + height / 2);
  }

  // ===== 点击判定方法 =====

  getChapterSelectHit(tap) {
    // 升级按钮
    if (this._upgradeButtonArea) {
      const a = this._upgradeButtonArea;
      if (tap.x >= a.x && tap.x <= a.x + a.w && tap.y >= a.y && tap.y <= a.y + a.h) {
        return 'upgrade';
      }
    }
    // 章节卡片
    if (this._chapterHitAreas) {
      for (let i = 0; i < this._chapterHitAreas.length; i++) {
        const a = this._chapterHitAreas[i];
        if (tap.x >= a.x && tap.x <= a.x + a.w && tap.y >= a.y && tap.y <= a.y + a.h) {
          return a.chapter;
        }
      }
    }
    return null;
  }

  getUpgradeShopHit(tap) {
    // 返回按钮
    if (this._shopBackArea) {
      const a = this._shopBackArea;
      if (tap.x >= a.x && tap.x <= a.x + a.w && tap.y >= a.y && tap.y <= a.y + a.h) {
        return 'back';
      }
    }
    // 升级按钮
    if (this._shopUpgradeAreas) {
      for (let i = 0; i < this._shopUpgradeAreas.length; i++) {
        const a = this._shopUpgradeAreas[i];
        if (tap.x >= a.x && tap.x <= a.x + a.w && tap.y >= a.y && tap.y <= a.y + a.h) {
          return a.key;
        }
      }
    }
    return null;
  }

  getChapterClearHit(tap) {
    if (this._clearNextArea) {
      const a = this._clearNextArea;
      if (tap.x >= a.x && tap.x <= a.x + a.w && tap.y >= a.y && tap.y <= a.y + a.h) {
        return 'next';
      }
    }
    if (this._clearBackArea) {
      const a = this._clearBackArea;
      if (tap.x >= a.x && tap.x <= a.x + a.w && tap.y >= a.y && tap.y <= a.y + a.h) {
        return 'back';
      }
    }
    return null;
  }
}

module.exports = Renderer;