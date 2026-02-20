/**
 * Renderer.js - v4.0 打飞机模式渲染
 * 发射器 + 子弹 + 武器特效
 */
const Config = require('./Config');
const SpriteCache = require('./SpriteCache');

class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = Config.DPR;
    canvas.width = Config.CANVAS_WIDTH;
    canvas.height = Config.CANVAS_HEIGHT;
    this.ctx.scale(this.dpr, this.dpr);

    // 精灵缓存
    this.sprites = new SpriteCache();
    this.sprites.warmup();

    // 背景星空（预生成）
    this.stars = [];
    for (let i = 0; i < 35; i++) {
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

    // 预渲染星空背景到离屏canvas（60 DC → 0 DC per frame）
    this._starCanvas = wx.createCanvas();
    this._starCanvas.width = Config.CANVAS_WIDTH;
    this._starCanvas.height = Config.CANVAS_HEIGHT;
    const starCtx = this._starCanvas.getContext('2d');
    starCtx.scale(this.dpr, this.dpr);
    for (let i = 0; i < this.stars.length; i++) {
      const s = this.stars[i];
      starCtx.globalAlpha = s.alpha;
      starCtx.fillStyle = '#FFFFFF';
      starCtx.fillRect(s.x, s.y, s.size, s.size);
    }
    this._starScrollY = 0;
  }

  clear() {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = Config.BG_COLOR;
    ctx.fillRect(0, 0, Config.SCREEN_WIDTH, Config.SCREEN_HEIGHT);

    // 星空背景（离屏canvas滚动，0 draw call）
    this._starScrollY = (this._starScrollY + 0.15) % Config.SCREEN_HEIGHT;
    const sy = this._starScrollY;
    ctx.globalAlpha = 0.6;
    // 画两次实现无缝滚动
    ctx.drawImage(this._starCanvas,
      0, 0, Config.CANVAS_WIDTH, Config.CANVAS_HEIGHT,
      0, sy, Config.SCREEN_WIDTH, Config.SCREEN_HEIGHT);
    ctx.drawImage(this._starCanvas,
      0, 0, Config.CANVAS_WIDTH, Config.CANVAS_HEIGHT,
      0, sy - Config.SCREEN_HEIGHT, Config.SCREEN_WIDTH, Config.SCREEN_HEIGHT);
    ctx.globalAlpha = 1;
  }

  // ===== 子弹 =====
  // ===== 子弹（精灵缓存优化） =====
  drawBullets(bullets) {
    if (!bullets || bullets.length === 0) return;
    const ctx = this.ctx;
    const sprites = this.sprites;
    const elementColors = { fire: '#FF4400', ice: '#44DDFF', thunder: '#FFF050' };

    // 拖尾（fillRect 最快，不用 beginPath）
    for (let k = 0; k < bullets.length; k++) {
      const b = bullets[k];
      const c = b.element ? (elementColors[b.element] || '#00FFFF') : '#00FFFF';
      ctx.fillStyle = c;
      for (let i = 0; i < b.trail.length; i++) {
        const t = b.trail[i];
        ctx.globalAlpha = (i + 1) / b.trail.length * 0.2;
        const s = 1 + (i / b.trail.length) * 1.5;
        ctx.fillRect(t.x - s, t.y - s, s * 2, s * 2);
      }
    }

    // 弹体（drawImage）
    ctx.globalAlpha = 1;
    for (let k = 0; k < bullets.length; k++) {
      const b = bullets[k];
      const bulletKey = b.element ? 'bullet_' + b.element : 'bullet';
      sprites.draw(ctx, bulletKey, b.x, b.y, 0, 1);
    }
  }

  drawBullet(bullet) {
    const bulletKey = bullet.element ? 'bullet_' + bullet.element : 'bullet';
    this.sprites.draw(this.ctx, bulletKey, bullet.x, bullet.y, 0, 1);
  }

  // ===== 发射器 =====
  drawLauncher(launcher, upgrades) {
    const ctx = this.ctx;
    const { x, y, width, height, color, muzzleFlash } = launcher;
    const cx = x + width / 2;
    const spreadCount = upgrades ? upgrades.getSpreadBonus() : 0;
    const totalGuns = 1 + spreadCount;
    const elementType = upgrades ? upgrades.getElementType() : null;
    const elementColors = { fire: '#FF4400', ice: '#44DDFF', thunder: '#FFF050' };
    const elemColor = elementType ? elementColors[elementType] : null;

    // 主体 - 梯形飞船
    ctx.fillStyle = elemColor || color;

    ctx.beginPath();
    ctx.moveTo(cx - width / 2, y + height);
    ctx.lineTo(cx - width / 3, y + 4);
    ctx.lineTo(cx + width / 3, y + 4);
    ctx.lineTo(cx + width / 2, y + height);
    ctx.closePath();
    ctx.fill();

    // 炮管（根据散射数量动态增加）
    const gunW = Config.LAUNCHER_GUN_WIDTH;
    const gunH = Config.LAUNCHER_GUN_HEIGHT;
    const gunGap = 10;
    const gunsStartX = cx - ((totalGuns - 1) * gunGap) / 2;

    for (let g = 0; g < totalGuns; g++) {
      const gx = gunsStartX + g * gunGap;
      ctx.fillStyle = '#FFFFFF';
      ctx.globalAlpha = 0.9;
      ctx.fillRect(gx - gunW / 2, y - gunH + 4, gunW, gunH);
      ctx.globalAlpha = 1;

      // 炮管顶端（元素弹时用元素色）
      ctx.fillStyle = elemColor || color;
      ctx.beginPath();
      ctx.arc(gx, y - gunH + 6, gunW / 2 + 1, 0, Math.PI * 2);
      ctx.fill();

      // 发射口闪光
      if (muzzleFlash > 0) {
        const flashAlpha = muzzleFlash / 3;
        ctx.globalAlpha = flashAlpha * 0.8;
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(gx, y - gunH + 2, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = flashAlpha * 0.4;
        ctx.fillStyle = elemColor || color;
        ctx.beginPath();
        ctx.arc(gx, y - gunH + 2, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    // 尾焰
    const flameH = 6 + Math.random() * 5;
    const flameW = width / 3;
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = elemColor || color;
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
    ctx.globalAlpha = 1;

    // 元素光环
    if (elemColor) {
      ctx.globalAlpha = 0.15;
      ctx.fillStyle = elemColor;
      ctx.beginPath();
      ctx.arc(cx, y + height / 2, width * 0.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
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

  /** 批量渲染砖块 - 大幅减少 Draw Call */
  drawBricksBatch(bricks) {
    if (!bricks || bricks.length === 0) return;
    const ctx = this.ctx;
    const dangerY = Config.SCREEN_HEIGHT * Config.BRICK_DANGER_Y;
    const now = Date.now();

    // 按颜色分组
    const groups = {};
    const flashBricks = [];
    const shieldBricks = [];
    const hpTextBricks = [];

    for (let i = 0; i < bricks.length; i++) {
      const b = bricks[i];
      if (!b.alive) continue;

      // 处理 flashTimer
      if (b.flashTimer > 0) {
        b.flashTimer--;
        flashBricks.push(b);
        continue;
      }

      // 危险区变红
      const dangerDist = dangerY - (b.y + b.height);
      if (dangerDist < 40) {
        flashBricks.push(b); // 用flashBricks数组处理危险区砖块
        continue;
      }

      // 按颜色分组
      const c = b.color;
      if (!groups[c]) groups[c] = [];
      groups[c].push(b);

      // 收集需要边框的
      if (b.type === 'shield' && b.shieldHp > 0) shieldBricks.push(b);
      if (b.hp > 1) hpTextBricks.push(b);
    }

    // Pass 1: 批量画同色砖块主体
    for (const color in groups) {
      const arr = groups[color];
      ctx.fillStyle = color;
      ctx.beginPath();
      for (let i = 0; i < arr.length; i++) {
        const b = arr[i];
        ctx.rect(b.x, b.y, b.width, b.height);
      }
      ctx.fill();
    }

    // Pass 2: 画闪白/危险砖块
    if (flashBricks.length > 0) {
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      for (let i = 0; i < flashBricks.length; i++) {
        const b = flashBricks[i];
        ctx.rect(b.x, b.y, b.width, b.height);
      }
      ctx.fill();
    }

    // Pass 3: 画护盾边框
    if (shieldBricks.length > 0) {
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < shieldBricks.length; i++) {
        const b = shieldBricks[i];
        ctx.rect(b.x - 2, b.y - 2, b.width + 4, b.height + 4);
      }
      ctx.stroke();
    }

    // Pass 4: HP数字
    if (hpTextBricks.length > 0) {
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (let i = 0; i < hpTextBricks.length; i++) {
        const b = hpTextBricks[i];
        ctx.fillText(b.hp.toString(), b.x + b.width / 2, b.y + b.height / 2);
      }
    }
  }

  // ===== 粒子 =====
  drawParticles(particles) {
    if (!particles || particles.length === 0) return;
    const ctx = this.ctx;
    // 按颜色分组批量画，减少状态切换
    // 简化：大部分粒子用fillRect，统一alpha
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      const a = p.getAlpha();
      if (a < 0.05) continue;
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size * 0.5, p.y - p.size * 0.5, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  // ===== 道具 =====
  drawPowerUp(powerUp) {
    const ctx = this.ctx;
    const { x, y, size, color, time, type } = powerUp;
    const pulse = 0.8 + Math.sin(time * 0.15) * 0.2;
    const drawSize = size * pulse;
    if (type === 'coin') {
      ctx.fillStyle = '#FFD700';
      ctx.beginPath(); ctx.arc(x, y, drawSize / 2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath(); ctx.arc(x - 1, y - 1, drawSize / 4, 0, Math.PI * 2); ctx.fill();
    } else if (type === 'skillCrate') {
      // 发光宝箱
      ctx.fillStyle = 'rgba(255, 20, 255, 0.15)';
      ctx.beginPath(); ctx.arc(x, y, drawSize, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = color;
      ctx.fillRect(x - drawSize / 2, y - drawSize / 2, drawSize, drawSize);
      ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 1;
      ctx.strokeRect(x - drawSize / 2, y - drawSize / 2, drawSize, drawSize);
      ctx.fillStyle = '#FFFFFF'; ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('?', x, y);
    } else {
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(x, y, drawSize / 2, 0, Math.PI * 2); ctx.fill();
    }
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
      if (!data) continue;

      switch (key) {
        case 'kunai': this._drawKunai(data, ctx); break;
        case 'lightning': this._drawLightning(data, ctx); break;
        case 'missile': this._drawMissile(data, ctx); break;
        case 'meteor': this._drawMeteor(data, ctx); break;
        case 'drone': this._drawDrone(data, ctx); break;
        case 'spinBlade': this._drawSpinBlade(data, ctx); break;
      }
    }
  }

  drawWeaponWings(weapons, launcher) {
    const ctx = this.ctx;
    const lcx = launcher.getCenterX();
    const lcy = launcher.y;
    const keys = Object.keys(weapons);
    for (let i = 0; i < keys.length; i++) {
      const weapon = weapons[keys[i]];
      const wing = weapon.getWingData(lcx, lcy);
      if (!wing) continue;
      const side = (i % 2 === 0) ? -1 : 1;
      const row = Math.floor(i / 2);
      const wx = lcx + side * (28 + row * 12);
      const wy = lcy - 5 + row * 8;
      ctx.globalAlpha = 0.7;
      switch (wing.type) {
        case 'kunai': // 迫击炮弹仓
          ctx.fillStyle = wing.color;
          // 小炮弹形状
          ctx.beginPath();
          ctx.arc(wx, wy - 3, 3, Math.PI, 0); // 圆头
          ctx.lineTo(wx + 3, wy + 3);
          ctx.lineTo(wx - 3, wy + 3);
          ctx.closePath(); ctx.fill();
          // 尾翼
          ctx.fillStyle = '#006688';
          ctx.fillRect(wx - 4, wy + 3, 8, 2);
          break;
        case 'lightning': // 电弧球
          ctx.fillStyle = wing.color;
          ctx.beginPath(); ctx.arc(wx, wy, 4, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(wx, wy, 6, 0, Math.PI * 2); ctx.stroke(); break;
        case 'missile': // 弹仓
          ctx.fillStyle = wing.color;
          ctx.fillRect(wx - 3, wy - 5, 6, 10);
          ctx.fillStyle = '#FFFFFF'; ctx.fillRect(wx - 1, wy - 3, 2, 6); break;
        case 'meteor': // 能量核心
          ctx.fillStyle = wing.color;
          ctx.beginPath(); ctx.arc(wx, wy - 10, 5, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.5)';
          ctx.beginPath(); ctx.arc(wx, wy - 10, 2, 0, Math.PI * 2); ctx.fill(); break;
        case 'drone': // 小型无人机
          ctx.fillStyle = wing.color;
          ctx.fillRect(wx - 4, wy - 2, 8, 4);
          ctx.fillStyle = '#FFFFFF'; ctx.fillRect(wx - 1, wy - 1, 2, 2); break;
        case 'spinBlade': // 微型旋刃
          ctx.save(); ctx.translate(wx, wy);
          ctx.rotate(Date.now() * 0.005);
          ctx.fillStyle = wing.color;
          ctx.beginPath();
          ctx.moveTo(0, -5); ctx.lineTo(3, 0); ctx.lineTo(0, 5); ctx.lineTo(-3, 0);
          ctx.closePath(); ctx.fill();
          ctx.restore(); break;
      }
      ctx.globalAlpha = 1;
    }
  }

  drawWeaponHUD(weaponList) {
    if (!weaponList || weaponList.length === 0) return;
    const ctx = this.ctx;
    const iconSize = 20;
    const gap = 6;
    const startX = Config.SCREEN_WIDTH - iconSize - 6;
    const startY = Config.SAFE_TOP + 36;
    for (let i = 0; i < weaponList.length; i++) {
      const w = weaponList[i];
      const y = startY + i * (iconSize + gap + 8);
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.beginPath(); ctx.roundRect(startX - 2, y - 2, iconSize + 4, iconSize + 4, 4); ctx.fill();
      ctx.strokeStyle = w.color; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect(startX - 2, y - 2, iconSize + 4, iconSize + 4, 4); ctx.stroke();
      ctx.fillStyle = w.color; ctx.font = (iconSize - 2) + 'px monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(w.icon, startX + iconSize / 2, y + iconSize / 2);
      ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '7px monospace';
      ctx.fillText('Lv.' + w.totalLevel, startX + iconSize / 2, y + iconSize + 6);
    }
  }

  _drawKunai(data, ctx) {
    const { knives, explosions, color } = data;

    // ===== 拖尾（fillRect替代arc，更快） =====
    for (const k of knives) {
      if (k.trail && k.trail.length > 1) {
        const s = k.scale || 1;
        ctx.fillStyle = color;
        for (let t = 0; t < k.trail.length; t++) {
          const tr = k.trail[t];
          ctx.globalAlpha = tr.alpha * 0.35;
          const sz = (1 + (t / k.trail.length) * 2) * s;
          ctx.fillRect(tr.x - sz, tr.y - sz, sz * 2, sz * 2);
        }
        ctx.globalAlpha = 1;
      }
    }

    // ===== 炮弹本体（精灵缓存，1次drawImage替代15+次draw） =====
    for (const k of knives) {
      const s = k.scale || 1;
      const angle = Math.atan2(k.vy, k.vx);
      this.sprites.draw(ctx, 'mortar_shell', k.x, k.y, angle, s);
    }

    // ===== 爆炸特效（性能优化版） =====
    if (explosions) {
      for (const e of explosions) {
        const progress = 1 - e.life / e.maxLife;
        const r = Math.min(e.radius, e.maxRadius);
        const alpha = (1 - progress * progress) * 0.85;
        if (alpha < 0.05) continue;

        // 1) 冲击波环
        ctx.globalAlpha = alpha * 0.5;
        ctx.strokeStyle = e.isChain ? '#FF6600' : color;
        ctx.lineWidth = Math.max(1, 3 - progress * 2.5);
        ctx.beginPath();
        ctx.arc(e.x, e.y, r, 0, Math.PI * 2);
        ctx.stroke();

        // 2) 内部填充（半透明圆替代渐变）
        ctx.globalAlpha = alpha * 0.2;
        ctx.fillStyle = e.isChain ? '#FF6600' : color;
        ctx.beginPath();
        ctx.arc(e.x, e.y, r * 0.7, 0, Math.PI * 2);
        ctx.fill();

        // 3) 十字光芒（前60%）
        if (progress < 0.6) {
          const crossAlpha = (0.6 - progress) * 1.2;
          const crossLen = r * (1 + progress * 0.4);
          ctx.globalAlpha = crossAlpha * 0.6;
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = Math.max(0.5, 1.5 - progress * 2);
          ctx.beginPath();
          ctx.moveTo(e.x - crossLen, e.y);
          ctx.lineTo(e.x + crossLen, e.y);
          ctx.moveTo(e.x, e.y - crossLen);
          ctx.lineTo(e.x, e.y + crossLen);
          ctx.stroke();
        }

        // 4) 核心闪光（前25%）
        if (progress < 0.25) {
          ctx.globalAlpha = (0.25 - progress) * 4;
          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath();
          ctx.arc(e.x, e.y, Math.max(2, r * 0.25), 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    }
  }

  _drawOrbitBlade(data, ctx) {
    // legacy stub - no longer used
  }

  _drawMeteor(data, ctx) {
    const { meteors, burnZones, color } = data;
    // 燃烧区域
    for (const z of burnZones) {
      const alpha = Math.min(0.3, z.life / 3000);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#FF4400';
      ctx.beginPath(); ctx.arc(z.x, z.y, z.radius, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = alpha * 0.5;
      ctx.fillStyle = '#FFD700';
      ctx.beginPath(); ctx.arc(z.x, z.y, z.radius * 0.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    // 陨石
    for (const m of meteors) {
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(m.x, m.y, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#FFD700'; ctx.globalAlpha = 0.6;
      ctx.beginPath(); ctx.arc(m.x, m.y, 4, 0, Math.PI * 2); ctx.fill();
      // 尾焰
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = '#FF4400';
      ctx.beginPath(); ctx.arc(m.x, m.y - 10, 6, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      // 落点预警
      ctx.strokeStyle = 'rgba(255, 100, 0, 0.3)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(m.targetX - 15, m.targetY);
      ctx.lineTo(m.targetX + 15, m.targetY);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  _drawDrone(data, ctx) {
    const { drones, lines, hits, color, overchargeLv, widthLv, pulseWave } = data;
    if (!drones || drones.length === 0) return;

    const beamWidth = 2; // 主激光保持细线

    // === 激光连线 ===
    if (lines && lines.length > 0) {
      const glowW = 6 + (widthLv || 0) * 4; // 光晕宽度跟等级联动

      // 第1层：宽光晕（低透明度）
      ctx.strokeStyle = 'rgba(' + this._hexToRgb(color) + ', 0.08)';
      ctx.lineWidth = glowW * 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (const l of lines) { ctx.moveTo(l.x1, l.y1); ctx.lineTo(l.x2, l.y2); }
      ctx.stroke();

      // 第2层：中层光晕
      ctx.strokeStyle = 'rgba(' + this._hexToRgb(color) + ', 0.15)';
      ctx.lineWidth = glowW;
      ctx.beginPath();
      for (const l of lines) { ctx.moveTo(l.x1, l.y1); ctx.lineTo(l.x2, l.y2); }
      ctx.stroke();

      // 第3层：主激光（细线）
      ctx.strokeStyle = color;
      ctx.lineWidth = beamWidth;
      ctx.beginPath();
      for (const l of lines) { ctx.moveTo(l.x1, l.y1); ctx.lineTo(l.x2, l.y2); }
      ctx.stroke();

      // 第4层：白色内芯
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (const l of lines) { ctx.moveTo(l.x1, l.y1); ctx.lineTo(l.x2, l.y2); }
      ctx.stroke();
      ctx.lineCap = 'butt';

      // 激光上的流动光点
      ctx.fillStyle = '#FFFFFF';
      ctx.globalAlpha = 0.6;
      const t = (Date.now() % 1000) / 1000;
      for (const l of lines) {
        const px = l.x1 + (l.x2 - l.x1) * t;
        const py = l.y1 + (l.y2 - l.y1) * t;
        ctx.beginPath();
        ctx.arc(px, py, 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // === 过载：阵型质心光效 ===
    if (overchargeLv > 0 && drones.length >= 3) {
      const cx = drones.reduce((s, d) => s + d.x, 0) / drones.length;
      const cy = drones.reduce((s, d) => s + d.y, 0) / drones.length;
      const pulse = 0.2 + Math.sin(Date.now() * 0.006) * 0.1;
      ctx.fillStyle = color;
      ctx.globalAlpha = pulse;
      ctx.beginPath();
      ctx.arc(cx, cy, 25, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.globalAlpha = pulse * 0.8;
      ctx.beginPath();
      ctx.arc(cx, cy, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // === 脉冲波 ===
    if (pulseWave) {
      const p = pulseWave.progress;
      const r = pulseWave.maxR * p;
      // 多层扩散波
      ctx.strokeStyle = color;
      ctx.lineWidth = 4 * (1 - p);
      ctx.globalAlpha = (1 - p) * 0.7;
      ctx.beginPath();
      ctx.arc(pulseWave.x, pulseWave.y, r, 0, Math.PI * 2);
      ctx.stroke();
      // 内层白芯波
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2 * (1 - p);
      ctx.globalAlpha = (1 - p) * 0.5;
      ctx.beginPath();
      ctx.arc(pulseWave.x, pulseWave.y, r * 0.7, 0, Math.PI * 2);
      ctx.stroke();
      // 中心闪光
      if (p < 0.3) {
        ctx.fillStyle = '#FFFFFF';
        ctx.globalAlpha = (0.3 - p) * 3;
        ctx.beginPath();
        ctx.arc(pulseWave.x, pulseWave.y, 15 * (1 - p), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // === 命中闪光 ===
    if (hits.length > 0) {
      ctx.fillStyle = '#FFFFFF';
      for (const h of hits) {
        ctx.globalAlpha = Math.min(1, h.alpha) * 0.8;
        ctx.beginPath();
        ctx.arc(h.x, h.y, 4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // === 无人机本体（矩形机身造型） ===
    for (const d of drones) {
      // 悬浮光环
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.25;
      ctx.beginPath();
      ctx.arc(d.x, d.y, 12, 0, Math.PI * 2);
      ctx.stroke();

      ctx.globalAlpha = 1;
      // 机身
      ctx.fillStyle = color;
      ctx.fillRect(d.x - 7, d.y - 4, 14, 8);
      // 机翼
      ctx.fillRect(d.x - 11, d.y - 2, 5, 4);
      ctx.fillRect(d.x + 6, d.y - 2, 5, 4);
      // 驾驶舱
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(d.x - 2, d.y - 2, 4, 4);
      // 引擎光点
      ctx.fillStyle = '#AAFFDD';
      ctx.beginPath();
      ctx.arc(d.x, d.y + 5, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _drawSpinBlade(data, ctx) {
    const { blades, color, vortexLv, giantLv } = data;

    for (const b of blades) {
      const size = b.size || 12;

      // === 漩涡效果 ===
      if (vortexLv > 0) {
        const vortexR = 60 + vortexLv * 30;
        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.15;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(b.x, b.y, vortexR, 0, Math.PI * 2);
        ctx.stroke();
        // 螺旋线
        ctx.globalAlpha = 0.1;
        ctx.beginPath();
        for (let a = 0; a < Math.PI * 4; a += 0.2) {
          const r = vortexR * (1 - a / (Math.PI * 4));
          const px = b.x + Math.cos(a + b.angle * 2) * r;
          const py = b.y + Math.sin(a + b.angle * 2) * r;
          if (a === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }

      // === 外层光晕 ===
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(b.x, b.y, size + 6, 0, Math.PI * 2);
      ctx.fill();

      // === 旋刃本体 ===
      ctx.globalAlpha = 1;
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.angle);

      // 4叶旋刃
      ctx.fillStyle = color;
      for (let i = 0; i < 4; i++) {
        ctx.save();
        ctx.rotate(i * Math.PI / 2);
        ctx.beginPath();
        ctx.moveTo(0, -size);
        ctx.quadraticCurveTo(size * 0.4, -size * 0.5, size * 0.3, 0);
        ctx.quadraticCurveTo(size * 0.4, size * 0.5, 0, size * 0.3);
        ctx.lineTo(0, 0);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      // 中心白点
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.2, 0, Math.PI * 2);
      ctx.fill();

      // 巨型化：额外光效
      if (giantLv > 0) {
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.4;
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.6, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  _drawLightning(data, ctx) {
    const { bolts, color } = data;

    for (const bolt of bolts) {
      const pts = bolt.points;
      if (pts.length < 2) continue;
      ctx.globalAlpha = bolt.alpha;

      // === 第1层：外层大光晕（紫色/黄色渐变） ===
      ctx.strokeStyle = 'rgba(' + this._hexToRgb(color) + ', 0.15)';
      ctx.lineWidth = 16;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x, pts[i].y);
      }
      ctx.stroke();

      // === 第2层：主闪电体（抖动效果） ===
      ctx.strokeStyle = color;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        // 中间点加抖动
        const jx = (Math.random() - 0.5) * 12;
        const jy = (Math.random() - 0.5) * 8;
        ctx.lineTo(pts[i].x + jx, pts[i].y + jy);
      }
      ctx.stroke();

      // === 第3层：白色内芯 ===
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        const jx = (Math.random() - 0.5) * 6;
        const jy = (Math.random() - 0.5) * 4;
        ctx.lineTo(pts[i].x + jx, pts[i].y + jy);
      }
      ctx.stroke();

      // === 分支闪电（从每个节点随机分出小分支） ===
      ctx.strokeStyle = 'rgba(' + this._hexToRgb(color) + ', 0.5)';
      ctx.lineWidth = 1.5;
      for (let i = 1; i < pts.length - 1; i++) {
        if (Math.random() > 0.6) continue; // 60%概率出分支
        const p = pts[i];
        const angle = Math.random() * Math.PI * 2;
        const len = 15 + Math.random() * 20;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        const midX = p.x + Math.cos(angle) * len * 0.5 + (Math.random() - 0.5) * 8;
        const midY = p.y + Math.sin(angle) * len * 0.5 + (Math.random() - 0.5) * 8;
        const endX = p.x + Math.cos(angle) * len;
        const endY = p.y + Math.sin(angle) * len;
        ctx.lineTo(midX, midY);
        ctx.lineTo(endX, endY);
        ctx.stroke();
      }

      // === 命中点光效 ===
      for (let i = 1; i < pts.length; i++) {
        const p = pts[i];
        // 外层光晕
        ctx.globalAlpha = bolt.alpha * 0.3;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 12, 0, Math.PI * 2);
        ctx.fill();
        // 中层
        ctx.globalAlpha = bolt.alpha * 0.6;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
        ctx.fill();
        // 白色核心
        ctx.globalAlpha = bolt.alpha;
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      // === 链间电弧（在相邻命中点之间画额外小闪电） ===
      if (pts.length > 2) {
        ctx.strokeStyle = 'rgba(' + this._hexToRgb(color) + ', 0.3)';
        ctx.lineWidth = 1;
        for (let i = 1; i < pts.length - 1; i++) {
          const p1 = pts[i], p2 = pts[i + 1];
          const midX = (p1.x + p2.x) / 2 + (Math.random() - 0.5) * 20;
          const midY = (p1.y + p2.y) / 2 + (Math.random() - 0.5) * 15;
          ctx.beginPath();
          ctx.moveTo(p1.x + (Math.random() - 0.5) * 10, p1.y + (Math.random() - 0.5) * 10);
          ctx.lineTo(midX, midY);
          ctx.lineTo(p2.x + (Math.random() - 0.5) * 10, p2.y + (Math.random() - 0.5) * 10);
          ctx.stroke();
        }
      }
    }
    ctx.globalAlpha = 1;
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'miter';

    // 超载爆炸
    const explosions = data.explosions || [];
    for (const e of explosions) {
      ctx.globalAlpha = e.alpha * 0.6;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius * e.alpha, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = e.alpha * 0.2;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius * e.alpha * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  _drawMissile(data, ctx) {
    const { missiles, explosions, color } = data;
    const sprites = this.sprites;

    // 拖尾（fillRect替代arc）
    ctx.fillStyle = Config.NEON_ORANGE;
    for (const m of missiles) {
      for (let i = 0; i < m.trail.length; i++) {
        const t = m.trail[i];
        const size = 1 + (i / m.trail.length) * 2;
        ctx.globalAlpha = (i + 1) / m.trail.length * 0.4;
        ctx.fillRect(t.x - size, t.y - size, size * 2, size * 2);
      }
    }

    // 弹体（精灵缓存，1次drawImage替代4次draw）
    ctx.globalAlpha = 1;
    for (const m of missiles) {
      sprites.draw(ctx, 'missile', m.x, m.y, 0, 1);
    }

    // 爆炸（精简：冲击环+核心闪光）
    for (const e of explosions) {
      if (e.alpha < 0.05) continue;
      const r = e.radius * (1.2 - e.alpha * 0.5);
      ctx.globalAlpha = e.alpha * 0.35;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(e.x, e.y, r, 0, Math.PI * 2); ctx.stroke();
      if (e.alpha > 0.5) {
        ctx.globalAlpha = e.alpha * 0.6;
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath(); ctx.arc(e.x, e.y, 4 * e.alpha, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  // legacy laser/ice removed - replaced by meteor/drone/spinBlade

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
    for (let i = 0; i < orbs.length; i++) {
      const o = orbs[i];
      this.sprites.draw(ctx, 'exp_orb', o.x, o.y, 0, 1);
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

  /** 伤害统计面板 - 返回点击区域 */
  drawDamageStats(stats, expanded) {
    const ctx = this.ctx;
    // 中文名称映射
    const nameMap = {
      'bullet': '飞机子弹',
      'kunai': '迫击炮',
      'kunai_aoe': '迫击炮AOE',
      'missile': '追踪导弹',
      'lightning': '闪电链',
      'lightning_aoe': '闪电爆炸',
      'meteor': '陨石',
      'drone_laser': '无人机阵',
      'drone_cross': '无人机过载',
      'drone_pulse': '无人机脉冲',
      'fire_dot': '燃烧',
      'thunder_chain': '雷击',
      'shock': '感电',
      'spinBlade': '等离子旋刃',
    };
    const entries = Object.entries(stats || {}).sort((a, b) => b[1] - a[1]);
    const totalDmg = entries.reduce((sum, e) => sum + e[1], 0);

    // 位置：左上角，武器图标下方
    const px = 8, py = Config.SAFE_TOP + 75;
    const btnW = 28, btnH = 28;

    // 收缩按钮
    ctx.fillStyle = totalDmg > 0 ? 'rgba(255,100,100,0.3)' : 'rgba(255,255,255,0.1)';
    ctx.beginPath();
    ctx.arc(px + btnW / 2, py + btnH / 2, btnW / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = totalDmg > 0 ? '#FF6666' : 'rgba(255,255,255,0.3)';
    ctx.font = '14px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('📊', px + btnW / 2, py + btnH / 2);

    const hitArea = { x: px, y: py, w: btnW, h: btnH };

    if (!expanded || totalDmg === 0) return hitArea;

    // 展开面板
    const panelW = 140;
    const lineH = 14;
    const maxLines = Math.min(entries.length, 8);
    const panelH = 24 + maxLines * lineH;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.beginPath();
    ctx.roundRect(px, py + btnH + 4, panelW, panelH, 6);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,100,100,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(px, py + btnH + 4, panelW, panelH, 6);
    ctx.stroke();

    // 标题
    ctx.fillStyle = '#FF6666';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('伤害: ' + this._formatNum(totalDmg), px + 6, py + btnH + 8);

    // 列表
    let ly = py + btnH + 22;
    ctx.font = '9px monospace';
    for (let i = 0; i < maxLines; i++) {
      const [src, dmg] = entries[i];
      const pct = ((dmg / totalDmg) * 100).toFixed(0);
      const barW = (dmg / totalDmg) * 60;

      // 进度条
      ctx.fillStyle = 'rgba(255,100,100,0.4)';
      ctx.fillRect(px + 6, ly + 2, barW, 8);

      // 来源名（中文）
      const displayName = nameMap[src] || src;
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'left';
      ctx.fillText(displayName.substring(0, 6), px + 6, ly);

      // 百分比
      ctx.textAlign = 'right';
      ctx.fillText(pct + '%', px + panelW - 6, ly);

      ly += lineH;
    }

    // 扩大点击区域包含整个面板
    hitArea.h = btnH + 4 + panelH;
    return hitArea;
  }

  _formatNum(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return n.toString();
  }

  // ===== 升级选择（居中并列3列卡片） =====
  drawSkillChoice(choices, upgrades, title) {
    const ctx = this.ctx;
    const sw = Config.SCREEN_WIDTH;
    const sh = Config.SCREEN_HEIGHT;
    const cx = sw / 2;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, sw, sh);

    const isLevelUp = (title || '').indexOf('LEVEL') >= 0;
    ctx.fillStyle = isLevelUp ? Config.NEON_GREEN : Config.NEON_PINK;
    ctx.font = 'bold 22px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(title || '选择强化', cx, sh * 0.16);

    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '13px monospace';
    ctx.fillText('选择一项强化', cx, sh * 0.16 + 26);

    const count = choices.length;
    if (count === 0) return;
    const gap = 8;
    const totalW = sw - 20;
    const cardW = Math.floor((totalW - gap * (count - 1)) / count);
    const cardH = sh * 0.52;
    const startX = (sw - (cardW * count + gap * (count - 1))) / 2;
    const startY = sh * 0.24;

    for (let i = 0; i < count; i++) {
      const c = choices[i];
      const cardX = startX + i * (cardW + gap);
      const cardY = startY;
      const isNew = c.type === 'newWeapon';

      ctx.fillStyle = 'rgba(8, 2, 32, 0.92)';
      ctx.beginPath(); ctx.roundRect(cardX, cardY, cardW, cardH, 10); ctx.fill();
      ctx.strokeStyle = c.color;
      ctx.lineWidth = isNew ? 1.5 : 1;
      ctx.beginPath(); ctx.roundRect(cardX, cardY, cardW, cardH, 10); ctx.stroke();

      const rgb = this._hexToRgb(c.color);
      ctx.fillStyle = 'rgba(' + rgb + ', 0.3)';
      ctx.beginPath(); ctx.roundRect(cardX + 1, cardY + 1, cardW - 2, 3, [2, 2, 0, 0]); ctx.fill();

      const ccx = cardX + cardW / 2;

      // 类型标签
      var typeLabel = '强化';
      if (c.type === 'newWeapon') typeLabel = '新武器';
      else if (c.type === 'weaponBranch') typeLabel = '武器';
      else if (c.type === 'shipBranch') typeLabel = '飞机';
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(typeLabel, ccx, cardY + 20);

      if (isNew) {
        ctx.fillStyle = Config.NEON_YELLOW;
        ctx.font = 'bold 12px monospace';
        ctx.fillText('NEW!', ccx, cardY + 36);
      }

      // 图标
      ctx.fillStyle = c.color;
      ctx.font = '40px monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(c.icon, ccx, cardY + cardH * 0.28);

      // 名称
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 14px monospace';
      ctx.textBaseline = 'middle';
      this._drawTextWrap(ctx, c.name, ccx, cardY + cardH * 0.48, cardW - 8, 16);

      // 描述
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.font = '12px monospace';
      this._drawTextWrap(ctx, c.desc, ccx, cardY + cardH * 0.62, cardW - 8, 14);

      // 等级指示器
      if (c.level && c.maxLevel) {
        this._drawLevelDots(ctx, ccx, cardY + cardH * 0.82, c.level - 1, c.maxLevel, c.color, cardW);
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
    const dotSize = 9;
    const dotGap = 5;
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

    if (ownedList && ownedList.length > 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = '11px monospace';
      ctx.fillText('你的武器:', cx, cy - 25);

      const perRow = 4, icoSz = 24, icoGap = 8;
      const totalW = Math.min(ownedList.length, perRow) * (icoSz + icoGap) - icoGap;
      const startX = cx - totalW / 2;
      for (let i = 0; i < ownedList.length; i++) {
        const p = ownedList[i];
        const col = i % perRow;
        const row = Math.floor(i / perRow);
        const px = startX + col * (icoSz + icoGap) + icoSz / 2;
        const py = cy + row * (icoSz + 12);
        ctx.fillStyle = p.color;
        ctx.font = (icoSz - 4) + 'px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(p.icon, px, py);
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = '7px monospace';
        ctx.fillText('Lv.' + p.totalLevel, px, py + 14);
      }
    }

    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('点击屏幕重新开始', cx, cy + 110);
  }

  // evolve notification removed in v6.0

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
      const SaveManagerClass = require('./systems/SaveManager');
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