/**
 * WeaponRenderer.js - 8种武器特效渲染
 */
const Config = require('../Config');

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return r + ',' + g + ',' + b;
}

// ===== 分形闪电路径生成 =====
function fractalLightning(x1, y1, x2, y2, depth) {
  const maxDepth = 3;
  const dx = x2 - x1, dy = y2 - y1;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 20 || depth >= maxDepth) {
    return [{ x: x1, y: y1 }, { x: x2, y: y2 }];
  }
  const midX = (x1 + x2) / 2, midY = (y1 + y2) / 2;
  const perpX = -dy / dist, perpY = dx / dist;
  const maxOffset = dist * 0.25 * Math.pow(0.6, depth);
  const offset = (Math.random() - 0.5) * 2 * maxOffset;
  const newX = midX + perpX * offset, newY = midY + perpY * offset;
  const left = fractalLightning(x1, y1, newX, newY, depth + 1);
  const right = fractalLightning(newX, newY, x2, y2, depth + 1);
  return [...left.slice(0, -1), ...right];
}

function generateZigzag(points) {
  if (points.length < 2) return points;
  const result = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i], p2 = points[i + 1];
    const segment = fractalLightning(p1.x, p1.y, p2.x, p2.y, 0);
    if (i === 0) result.push(...segment);
    else result.push(...segment.slice(1));
  }
  return result;
}

// ===== 冰爆弹(Kunai) =====
function drawKunai(ctx, sprites, data) {
  const { knives, explosions, splitBombs, color } = data;

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

  for (const k of knives) {
    const s = k.scale || 1;
    const angle = Math.atan2(k.vy, k.vx);
    sprites.draw(ctx, 'mortar_shell', k.x, k.y, angle, s);
  }

  if (explosions) {
    for (const e of explosions) {
      const progress = 1 - e.life / e.maxLife;
      const er = Math.min(e.radius, e.maxRadius);
      if (progress > 0.98) continue;
      const eColor = e.isChain ? '#FF6600' : color;

      // 快速展开曲线：前20%就扩到满半径
      var expand = Math.min(1, progress * 5); // 0→1 在 progress 0~0.2
      var curR = er * expand;

      // ① 伤害范围区域（使用武器颜色）
      var zoneAlpha = Math.max(0, 0.35 * (1 - progress * 1.2));
      if (zoneAlpha > 0.01) {
        ctx.globalAlpha = zoneAlpha;
        ctx.fillStyle = eColor;
        ctx.beginPath(); ctx.arc(e.x, e.y, curR, 0, Math.PI * 2); ctx.fill();
      }

      // ② 亮色内圈（收缩消失）
      if (progress < 0.6) {
        var innerR = curR * 0.6 * (1 - progress * 0.8);
        ctx.globalAlpha = (0.6 - progress) * 0.6;
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath(); ctx.arc(e.x, e.y, Math.max(2, innerR), 0, Math.PI * 2); ctx.fill();
      }

      // ③ 白色中心闪光（瞬间爆发）
      if (progress < 0.15) {
        var flashR = curR * 0.35 * (1 - progress * 6);
        ctx.globalAlpha = (0.15 - progress) * 6;
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath(); ctx.arc(e.x, e.y, Math.max(3, flashR), 0, Math.PI * 2); ctx.fill();
      }

      // ④ 冰晶锯齿环（不规则冰晶边缘）
      var ringR = curR * (1 + progress * 0.3);
      var ringAlpha = (1 - progress) * (1 - progress) * 0.8;
      var ringWidth = Math.max(1.5, 4 * (1 - progress));
      if (ringAlpha > 0.02) {
        ctx.globalAlpha = ringAlpha;
        ctx.strokeStyle = eColor;
        ctx.lineWidth = ringWidth;
        ctx.beginPath();
        var spikes = 16;
        for (var si = 0; si <= spikes; si++) {
          var a = (si / spikes) * Math.PI * 2;
          // 每隔一个点凸出，形成锯齿冰晶感
          var spikeR = (si % 2 === 0) ? ringR * 1.12 : ringR * 0.88;
          // 用爆炸id(x+y)做种子让每次不同
          var jitter = Math.sin(a * 3.7 + e.x * 0.1) * ringR * 0.06;
          var px = e.x + Math.cos(a) * (spikeR + jitter);
          var py = e.y + Math.sin(a) * (spikeR + jitter);
          if (si === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
        // 锯齿环内部微填充
        ctx.globalAlpha = ringAlpha * 0.15;
        ctx.fillStyle = eColor;
        ctx.fill();
      }

      // ⑤ 冰晶碎片粒子（从中心飞散）
      if (e.shards) {
        for (var si2 = 0; si2 < e.shards.length; si2++) {
          var sh = e.shards[si2];
          var shX = e.x + sh.x + sh.vx * progress * 60;
          var shY = e.y + sh.y + sh.vy * progress * 60;
          var shAlpha = Math.max(0, 1 - progress * 1.5);
          if (shAlpha < 0.02) continue;
          ctx.globalAlpha = shAlpha * 0.9;
          ctx.fillStyle = '#AAEEFF';
          ctx.save();
          ctx.translate(shX, shY);
          ctx.rotate(sh.rot + sh.rotSpd * progress * 60);
          // 三角形冰晶
          var ss = sh.size * (1 - progress * 0.5);
          ctx.beginPath();
          ctx.moveTo(0, -ss);
          ctx.lineTo(-ss * 0.6, ss * 0.5);
          ctx.lineTo(ss * 0.6, ss * 0.5);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  // 分裂弹小冰爆弹
  if (splitBombs) {
    for (const sb of splitBombs) {
      const progress = 1 - sb.life / sb.maxLife;
      const alpha = Math.max(0.3, 1 - progress);
      ctx.globalAlpha = alpha;
      const angle = Math.atan2(sb.vy, sb.vx);
      // 小弹丸（橙色小圆）
      ctx.fillStyle = '#FF8800';
      ctx.beginPath();
      ctx.arc(sb.x, sb.y, 3, 0, Math.PI * 2);
      ctx.fill();
      // 拖尾
      ctx.globalAlpha = alpha * 0.4;
      ctx.strokeStyle = '#FF6600';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(sb.x, sb.y);
      ctx.lineTo(sb.x - sb.vx * 3, sb.y - sb.vy * 3);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}

// ===== 轰炸机(Bomber, 原Meteor) =====
function drawMeteor(ctx, data) {
  const { bombers, bombs, explosions, fireZones, color } = data;

  // 燃烧区域
  const now = Date.now();
  for (const z of fireZones) {
    if (z.life <= 0) continue;
    const lifeRatio = Math.max(0, z.life / z.maxLife);

    if (z.isStrip) {
      // ===== 火焰带：横跨一行的火焰 =====
      const leftX = z.leftX || (z.x - z.stripWidth / 2);
      const stripW = z.stripWidth;
      const h = z.radius;

      // 地面焦痕（更宽更明显）
      ctx.globalAlpha = 0.25 * Math.min(lifeRatio * 3, 1);
      ctx.fillStyle = '#442200';
      ctx.fillRect(leftX, z.y - h * 0.6, stripW, h * 1.2);

      // 底部热浪光带
      ctx.globalAlpha = 0.2 * lifeRatio;
      ctx.fillStyle = '#FF6600';
      ctx.fillRect(leftX, z.y - h * 0.2, stripW, h * 0.6);

      // 火焰柱 — 沿着整条带均匀分布
      const cols = Math.max(1, Math.ceil(stripW / 14));
      const colW = stripW / cols;
      for (let c = 0; c < cols; c++) {
        const n1 = Math.sin(now * 0.011 + c * 5.3) * 0.5 + 0.5;
        const n2 = Math.sin(now * 0.017 + c * 9.7) * 0.5 + 0.5;
        const flameH = (10 + n1 * 14) * lifeRatio;
        const cx = leftX + c * colW + colW * 0.5 + (n2 - 0.5) * 4;
        const bottomY = z.y + h * 0.3;

        // 内焰（亮黄）
        ctx.globalAlpha = 0.65 * lifeRatio; ctx.fillStyle = '#FFEE66';
        ctx.fillRect(cx - 4, bottomY - flameH * 0.25, 8, flameH * 0.25);
        // 中焰（橙）
        ctx.globalAlpha = 0.5 * lifeRatio; ctx.fillStyle = '#FF8833';
        ctx.fillRect(cx - 3.5, bottomY - flameH * 0.6, 7, flameH * 0.35);
        // 外焰（红）
        ctx.globalAlpha = 0.3 * lifeRatio; ctx.fillStyle = '#CC3300';
        ctx.fillRect(cx - 2.5, bottomY - flameH, 5, flameH * 0.25);
      }

      // 顶部烟雾
      ctx.globalAlpha = 0.08 * lifeRatio;
      ctx.fillStyle = '#FFAA44';
      ctx.fillRect(leftX + 10, z.y - h * 0.6 - 8 * lifeRatio, Math.max(0, stripW - 20), 6);
    } else {
      // ===== 原有圆形燃烧区域 =====
      const r = z.radius;

    // 地面焦痕
    ctx.globalAlpha = 0.2 * Math.min(lifeRatio * 3, 1);
    ctx.fillStyle = z.merged ? '#441100' : '#331100';
    ctx.beginPath(); ctx.arc(z.x, z.y, r * 0.85, 0, Math.PI * 2); ctx.fill();

    // 火焰柱
    const cols = z.merged ? 5 : 3;
    const colW = (r * 1.2) / cols, baseX = z.x - r * 0.6;
    for (let c = 0; c < cols; c++) {
      const n1 = Math.sin(now * 0.013 + c * 7.7) * 0.5 + 0.5;
      const n2 = Math.sin(now * 0.019 + c * 13.3) * 0.5 + 0.5;
      const flameH = r * (0.5 + n1 * 0.7) * lifeRatio;
      const cx = baseX + c * colW + colW * 0.5 + (n2 - 0.5) * 5;
      const bottomY = z.y + r * 0.15;

      ctx.globalAlpha = 0.55 * lifeRatio; ctx.fillStyle = '#FFEE88';
      ctx.fillRect(cx - colW * 0.35, bottomY - flameH * 0.3, colW * 0.7, flameH * 0.3);
      ctx.globalAlpha = 0.4 * lifeRatio; ctx.fillStyle = '#FF8833';
      ctx.fillRect(cx - colW * 0.3, bottomY - flameH * 0.65, colW * 0.6, flameH * 0.35);
      ctx.globalAlpha = 0.2 * lifeRatio; ctx.fillStyle = '#CC3300';
      const tipW = colW * 0.15 + n2 * colW * 0.15;
      ctx.fillRect(cx - tipW, bottomY - flameH, tipW * 2, flameH * 0.2);
    }

    // 合并火海额外光效
    if (z.merged) {
      ctx.globalAlpha = 0.15 * lifeRatio; ctx.fillStyle = '#FF6600';
      ctx.beginPath(); ctx.arc(z.x, z.y, r * 1.2, 0, Math.PI * 2); ctx.fill();
    }
    } // close else (圆形燃烧区域)
  }

  // 爆炸特效
  for (const e of explosions) {
    if (e.alpha < 0.05) continue;
    const progress = 1 - e.alpha;
    const r = e.radius * (0.5 + progress * 0.5); // 从50%扩到100%，不超过radius

    ctx.globalAlpha = e.alpha * 0.35; ctx.fillStyle = '#FF6600';
    ctx.beginPath(); ctx.arc(e.x, e.y, r, 0, Math.PI * 2); ctx.fill();

    ctx.globalAlpha = e.alpha * 0.5; ctx.strokeStyle = color; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(e.x, e.y, r, 0, Math.PI * 2); ctx.stroke();

    if (e.alpha > 0.6) {
      ctx.globalAlpha = e.alpha; ctx.fillStyle = '#FFFFFF';
      ctx.beginPath(); ctx.arc(e.x, e.y, 4 * e.alpha, 0, Math.PI * 2); ctx.fill();
    }
  }

  // 炸弹
  for (const b of bombs) {
    ctx.globalAlpha = 1;
    // 弹体（椭圆形炸弹）
    ctx.fillStyle = '#DDDDDD';
    ctx.beginPath();
    ctx.ellipse(b.x, b.y, 4, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    // 弹头（深色）
    ctx.fillStyle = '#666666';
    ctx.beginPath();
    ctx.ellipse(b.x, b.y + 5, 3, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    // 尾翼
    ctx.fillStyle = '#AAAAAA';
    ctx.fillRect(b.x - 4, b.y - 7, 8, 2);
    // 下落尾烟
    ctx.globalAlpha = 0.25; ctx.fillStyle = '#888888';
    ctx.beginPath(); ctx.arc(b.x, b.y - 10, 3, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 0.12;
    ctx.beginPath(); ctx.arc(b.x + (Math.random() - 0.5) * 3, b.y - 15, 2, 0, Math.PI * 2); ctx.fill();
  }

  // 轰炸机机体
  for (const bomber of bombers) {
    const bx = bomber.x, by = bomber.y;
    const dir = bomber.vx > 0 ? 1 : -1;
    const isB52 = bomber.isB52;
    const scale = isB52 ? 1.6 : (bomber.isEscort ? 0.7 : 1.0);

    ctx.save();
    ctx.translate(bx, by);
    ctx.scale(dir, 1);

    // 机身
    ctx.globalAlpha = 1;
    ctx.fillStyle = isB52 ? '#DDDDDD' : (bomber.isEscort ? '#888888' : '#AAAAAA');
    ctx.fillRect(-18 * scale, -4 * scale, 36 * scale, 8 * scale);

    // 机头
    ctx.beginPath();
    ctx.moveTo(18 * scale, -3 * scale);
    ctx.lineTo(24 * scale, 0);
    ctx.lineTo(18 * scale, 3 * scale);
    ctx.closePath(); ctx.fill();

    // 机翼
    ctx.fillStyle = isB52 ? '#CCCCCC' : '#999999';
    ctx.fillRect(-10 * scale, -14 * scale, 20 * scale, 4 * scale);
    ctx.fillRect(-10 * scale, 10 * scale, 20 * scale, 4 * scale);

    // 尾翼
    ctx.fillRect(-18 * scale, -8 * scale, 6 * scale, 3 * scale);
    ctx.fillRect(-18 * scale, 5 * scale, 6 * scale, 3 * scale);

    // 引擎光
    ctx.fillStyle = '#FFAA44'; ctx.globalAlpha = 0.7;
    ctx.fillRect(-20 * scale, -2 * scale, 4 * scale, 4 * scale);

    // B52 特效
    if (isB52) {
      ctx.fillStyle = '#FFD700'; ctx.globalAlpha = 0.3;
      ctx.beginPath(); ctx.arc(0, 0, 30, 0, Math.PI * 2); ctx.fill();
    }

    ctx.restore();
  }

  ctx.globalAlpha = 1;
}

// ===== 无人机(Drone) =====
function drawDrone(ctx, data) {
  const { drones, lines, hits, color, overchargeLv, widthLv, pulseWave } = data;
  if (!drones || drones.length === 0) return;

  if (lines && lines.length > 0) {
    const glowW = 6 + (widthLv || 0) * 4;
    ctx.lineCap = 'round';

    ctx.strokeStyle = 'rgba(' + hexToRgb(color) + ', 0.08)';
    ctx.lineWidth = glowW * 3;
    ctx.beginPath();
    for (const l of lines) { ctx.moveTo(l.x1, l.y1); ctx.lineTo(l.x2, l.y2); }
    ctx.stroke();

    ctx.strokeStyle = 'rgba(' + hexToRgb(color) + ', 0.15)';
    ctx.lineWidth = glowW;
    ctx.beginPath();
    for (const l of lines) { ctx.moveTo(l.x1, l.y1); ctx.lineTo(l.x2, l.y2); }
    ctx.stroke();

    ctx.strokeStyle = color; ctx.lineWidth = 2;
    ctx.beginPath();
    for (const l of lines) { ctx.moveTo(l.x1, l.y1); ctx.lineTo(l.x2, l.y2); }
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1;
    ctx.beginPath();
    for (const l of lines) { ctx.moveTo(l.x1, l.y1); ctx.lineTo(l.x2, l.y2); }
    ctx.stroke();
    ctx.lineCap = 'butt';

    ctx.fillStyle = '#FFFFFF'; ctx.globalAlpha = 0.6;
    const t = (Date.now() % 1000) / 1000;
    for (const l of lines) {
      const px = l.x1 + (l.x2 - l.x1) * t;
      const py = l.y1 + (l.y2 - l.y1) * t;
      ctx.beginPath(); ctx.arc(px, py, 2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  if (overchargeLv > 0 && drones.length >= 3) {
    const cx = drones.reduce((s, d) => s + d.x, 0) / drones.length;
    const cy = drones.reduce((s, d) => s + d.y, 0) / drones.length;
    const pulse = 0.2 + Math.sin(Date.now() * 0.006) * 0.1;
    ctx.fillStyle = color; ctx.globalAlpha = pulse;
    ctx.beginPath(); ctx.arc(cx, cy, 25, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#FFFFFF'; ctx.globalAlpha = pulse * 0.8;
    ctx.beginPath(); ctx.arc(cx, cy, 8, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }

  if (pulseWave) {
    const p = pulseWave.progress, r = pulseWave.maxR * p;
    ctx.strokeStyle = color; ctx.lineWidth = 4 * (1 - p); ctx.globalAlpha = (1 - p) * 0.7;
    ctx.beginPath(); ctx.arc(pulseWave.x, pulseWave.y, r, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 2 * (1 - p); ctx.globalAlpha = (1 - p) * 0.5;
    ctx.beginPath(); ctx.arc(pulseWave.x, pulseWave.y, r * 0.7, 0, Math.PI * 2); ctx.stroke();
    if (p < 0.3) {
      ctx.fillStyle = '#FFFFFF'; ctx.globalAlpha = (0.3 - p) * 3;
      ctx.beginPath(); ctx.arc(pulseWave.x, pulseWave.y, 15 * (1 - p), 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  if (hits.length > 0) {
    for (const h of hits) {
      const a = Math.min(1, h.alpha);
      if (h.arcFrom) {
        ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.globalAlpha = a * 0.7;
        const sx = h.arcFrom.x, sy = h.arcFrom.y;
        const mx = (sx + h.x) / 2 + (Math.random() - 0.5) * 15;
        const my = (sy + h.y) / 2 + (Math.random() - 0.5) * 15;
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(mx, my); ctx.lineTo(h.x, h.y); ctx.stroke();
        ctx.fillStyle = '#FFFFFF'; ctx.globalAlpha = a * 0.6;
        ctx.beginPath(); ctx.arc(h.x, h.y, 3, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.fillStyle = '#FFFFFF'; ctx.globalAlpha = a * 0.8;
        ctx.beginPath(); ctx.arc(h.x, h.y, 4, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  for (const d of drones) {
    ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.globalAlpha = 0.25;
    ctx.beginPath(); ctx.arc(d.x, d.y, 12, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = color;
    ctx.fillRect(d.x - 7, d.y - 4, 14, 8);
    ctx.fillRect(d.x - 11, d.y - 2, 5, 4);
    ctx.fillRect(d.x + 6, d.y - 2, 5, 4);
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(d.x - 2, d.y - 2, 4, 4);
    ctx.fillStyle = '#AAFFDD';
    ctx.beginPath(); ctx.arc(d.x, d.y + 5, 2, 0, Math.PI * 2); ctx.fill();
  }
}

// ===== 回旋刃(SpinBlade) =====
function drawSpinBlade(ctx, data) {
  const { blades, color, giantLv, rampLv, superLv } = data;
  const isSuper = superLv > 0;

  for (const b of blades) {
    const size = b.size || 14;
    let bladeColor = color;
    if (rampLv > 0 && b.aliveMs > 1000) {
      const rampT = Math.min((b.aliveMs - 1000) / 5000, 1);
      const r = Math.floor(0xAA + (0xFF - 0xAA) * rampT);
      const g = Math.floor(0x44 + (0xFF - 0x44) * rampT);
      bladeColor = `rgb(${r},${g},255)`;
    }

    if (isSuper) {
      ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.3;
      const outerR = size + 10;
      for (let a = 0; a < 6; a++) {
        const startA = b.angle * -2 + a * Math.PI / 3;
        ctx.beginPath(); ctx.arc(b.x, b.y, outerR, startA, startA + Math.PI / 6); ctx.stroke();
      }
      ctx.fillStyle = bladeColor; ctx.globalAlpha = 0.5;
      for (let p = 0; p < 4; p++) {
        const pa = b.angle * 3 + p * Math.PI / 2;
        const pr = size + 6 + Math.sin(b.aliveMs * 0.003 + p) * 3;
        ctx.beginPath(); ctx.arc(b.x + Math.cos(pa) * pr, b.y + Math.sin(pa) * pr, 1.5, 0, Math.PI * 2); ctx.fill();
      }
    }

    ctx.globalAlpha = b.lingering ? 0.15 + Math.sin((b.lingerTimer || 0) * 0.008) * 0.1 : 0.25;
    ctx.fillStyle = bladeColor;
    ctx.beginPath(); ctx.arc(b.x, b.y, size + 6, 0, Math.PI * 2); ctx.fill();

    ctx.globalAlpha = 1;
    ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.angle);
    const leaves = isSuper ? 6 : 4;
    ctx.fillStyle = bladeColor;
    for (let i = 0; i < leaves; i++) {
      ctx.save(); ctx.rotate(i * Math.PI * 2 / leaves);
      ctx.beginPath();
      ctx.moveTo(0, -size);
      ctx.quadraticCurveTo(size * 0.4, -size * 0.5, size * 0.3, 0);
      ctx.quadraticCurveTo(size * 0.4, size * 0.5, 0, size * 0.3);
      ctx.lineTo(0, 0); ctx.closePath(); ctx.fill();
      ctx.restore();
    }

    ctx.fillStyle = isSuper ? bladeColor : '#FFFFFF';
    ctx.beginPath(); ctx.arc(0, 0, isSuper ? size * 0.25 : size * 0.2, 0, Math.PI * 2); ctx.fill();
    if (isSuper) {
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath(); ctx.arc(0, 0, size * 0.1, 0, Math.PI * 2); ctx.fill();
    }
    if (giantLv > 0) {
      ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 1; ctx.globalAlpha = 0.4;
      ctx.beginPath(); ctx.arc(0, 0, size * 0.6, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }

  if (data.shockwaves) {
    for (const sw of data.shockwaves) {
      const progress = sw.radius / sw.maxRadius;
      const alpha = 0.6 * (1 - progress);
      ctx.strokeStyle = color; ctx.lineWidth = 2.5 * (1 - progress) + 0.5; ctx.globalAlpha = alpha;
      ctx.beginPath(); ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2); ctx.stroke();
      if (progress < 0.5) {
        ctx.globalAlpha = alpha * 0.4; ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2); ctx.fill();
      }
    }
  }
  ctx.globalAlpha = 1;
}

// ===== 离子射线(IonBeam) =====
function drawIonBeam(ctx, data) {
  const { beam, isFiring, chargeProgress, burstFlash, markStacks, hitSparks, superOrb, superCharging, superChargeProgress, color } = data;
  const now = Date.now();
  ctx.globalCompositeOperation = 'lighter'; // 加法混合，射线穿透砖块发光

  if (beam && isFiring) {
    const { sx, sy, tx, ty } = beam;
    const stacks = markStacks || 0;
    const intensityMult = 1 + Math.min(stacks, 30) * 0.06;
    const pulse = 1 + Math.sin(now * 0.02) * 0.15;
    let chargeShrink = 1;
    if (superCharging && superChargeProgress > 0) chargeShrink = 1 - superChargeProgress * 0.6;

    ctx.globalAlpha = 0.15 * intensityMult; ctx.strokeStyle = color;
    ctx.lineWidth = (14 + stacks * 0.8) * pulse * chargeShrink; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(tx, ty); ctx.stroke();

    ctx.globalAlpha = 0.7 * Math.min(intensityMult, 2.2); ctx.strokeStyle = color;
    ctx.lineWidth = (4 + stacks * 0.25) * pulse * chargeShrink;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(tx, ty); ctx.stroke();

    ctx.globalAlpha = 0.9; ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = (2 + stacks * 0.08) * pulse * chargeShrink;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(tx, ty); ctx.stroke();

    if (superCharging && superChargeProgress > 0.1) {
      const chargeR = 5 + superChargeProgress * 15;
      ctx.globalAlpha = 0.3 + superChargeProgress * 0.5; ctx.fillStyle = '#FFFFFF';
      ctx.beginPath(); ctx.arc(sx, sy, chargeR, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.8; ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(sx, sy, chargeR * 0.6, 0, Math.PI * 2); ctx.fill();
    }

    const hitR = (8 + stacks * 0.5) * pulse;
    ctx.globalAlpha = 0.5 * intensityMult; ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(tx, ty, hitR, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 0.9; ctx.fillStyle = '#FFFFFF';
    ctx.beginPath(); ctx.arc(tx, ty, 3.5, 0, Math.PI * 2); ctx.fill();

    if (burstFlash > 0) {
      const flashAlpha = burstFlash / 400;
      ctx.globalAlpha = flashAlpha * 0.6; ctx.fillStyle = '#FFFFFF';
      ctx.beginPath(); ctx.arc(tx, ty, 25 * flashAlpha, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 2; ctx.globalAlpha = flashAlpha * 0.8;
      const crossLen = 20 * flashAlpha;
      ctx.beginPath();
      ctx.moveTo(tx - crossLen, ty); ctx.lineTo(tx + crossLen, ty);
      ctx.moveTo(tx, ty - crossLen); ctx.lineTo(tx, ty + crossLen);
      ctx.stroke();
    }
  }

  if (superOrb) {
    const p = superOrb.progress;
    const x = superOrb.sx + (superOrb.tx - superOrb.sx) * p;
    const y = superOrb.sy + (superOrb.ty - superOrb.sy) * p;
    const sz = superOrb.size;

    for (let i = 1; i <= 4; i++) {
      const trailP = Math.max(0, p - i * 0.08);
      const trailX = superOrb.sx + (superOrb.tx - superOrb.sx) * trailP;
      const trailY = superOrb.sy + (superOrb.ty - superOrb.sy) * trailP;
      ctx.globalAlpha = 0.15 * (5 - i) / 4; ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(trailX, trailY, sz * (0.8 - i * 0.1), 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 0.35; ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x, y, sz * 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 0.7; ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x, y, sz * 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 0.95; ctx.fillStyle = '#FFFFFF';
    ctx.beginPath(); ctx.arc(x, y, sz, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1; ctx.fillStyle = '#FFFFFF';
    ctx.beginPath(); ctx.arc(x, y, sz * 0.5, 0, Math.PI * 2); ctx.fill();
  }

  if (hitSparks) {
    for (const s of hitSparks) {
      ctx.globalAlpha = s.alpha; ctx.fillStyle = color;
      ctx.fillRect(s.x - s.size * 0.5, s.y - s.size * 0.5, s.size, s.size);
    }
  }

  if (!isFiring && chargeProgress > 0.3) {
    const chargePulse = 0.5 + Math.sin(now * 0.015) * 0.5;
    ctx.globalAlpha = (chargeProgress - 0.3) * 1.4 * chargePulse;
    ctx.fillStyle = color;
  }

  ctx.globalAlpha = 1; ctx.lineCap = 'butt';
  ctx.globalCompositeOperation = 'source-over'; // 恢复默认混合
}

// ===== 白磷弹(Blizzard) =====
function drawBlizzard(ctx, data) {
  const { bombs, fireZones, sparks } = data;
  const now = Date.now();

  for (const z of fireZones) {
    const lifeRatio = Math.max(0, z.life / z.maxLife);
    const r = z.radius;

    ctx.globalAlpha = 0.2 * Math.min(lifeRatio * 3, 1); ctx.fillStyle = '#331100';
    ctx.beginPath(); ctx.arc(z.x, z.y, r * 0.85, 0, Math.PI * 2); ctx.fill();

    const cols = 3, colW = (r * 1.2) / cols, baseX = z.x - r * 0.6;
    for (let c = 0; c < cols; c++) {
      const n1 = Math.sin(now * 0.013 + c * 7.7) * 0.5 + 0.5;
      const n2 = Math.sin(now * 0.019 + c * 13.3) * 0.5 + 0.5;
      const flameH = r * (0.5 + n1 * 0.7) * lifeRatio;
      const cx = baseX + c * colW + colW * 0.5 + (n2 - 0.5) * 5;
      const bottomY = z.y + r * 0.15;

      ctx.globalAlpha = 0.55 * lifeRatio; ctx.fillStyle = '#FFEE88';
      ctx.fillRect(cx - colW * 0.35, bottomY - flameH * 0.3, colW * 0.7, flameH * 0.3);
      ctx.globalAlpha = 0.4 * lifeRatio; ctx.fillStyle = '#FF8833';
      ctx.fillRect(cx - colW * 0.3, bottomY - flameH * 0.65, colW * 0.6, flameH * 0.35);
      ctx.globalAlpha = 0.2 * lifeRatio; ctx.fillStyle = '#CC3300';
      const tipW = colW * 0.15 + n2 * colW * 0.15;
      ctx.fillRect(cx - tipW, bottomY - flameH, tipW * 2, flameH * 0.2);
    }

    ctx.globalAlpha = 0.5 * lifeRatio; ctx.fillStyle = '#FFFFFF';
    const px = z.x + Math.sin(now * 0.015) * r * 0.2;
    const py = z.y + Math.cos(now * 0.011) * r * 0.1;
    ctx.fillRect(px - 2, py - 2, 4, 4);
  }

  for (const b of bombs) {
    ctx.globalAlpha = 1; ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(b.x - 3, b.y - 5, 6, 10);
    ctx.beginPath(); ctx.moveTo(b.x - 3, b.y - 5); ctx.lineTo(b.x, b.y - 10); ctx.lineTo(b.x + 3, b.y - 5);
    ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 0.3; ctx.fillStyle = '#FFAA44';
    ctx.beginPath(); ctx.arc(b.x, b.y, 9, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#FFAA44'; ctx.lineWidth = 2;
    for (let t = 1; t <= 3; t++) {
      ctx.globalAlpha = 0.4 - t * 0.12;
      const ty = b.y + t * 7;
      ctx.beginPath(); ctx.moveTo(b.x, ty); ctx.lineTo(b.x, ty + 5); ctx.stroke();
    }
  }

  for (const s of sparks) {
    ctx.globalAlpha = s.alpha; ctx.fillStyle = s.color;
    const sz = s.size;
    ctx.fillRect(s.x - sz * 0.5, s.y - sz * 0.5, sz, sz);
  }
  ctx.globalAlpha = 1;
}

// ===== 闪电链(Lightning) =====
function drawLightning(ctx, data) {
  const { bolts, color } = data;

  for (const bolt of bolts) {
    const pts = bolt.points;
    if (pts.length < 2) continue;
    ctx.globalAlpha = bolt.alpha;

    const zigzagPoints = generateZigzag(pts);

    // 外层大光晕
    ctx.strokeStyle = 'rgba(' + hexToRgb(color) + ', 0.12)';
    ctx.lineWidth = 14; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(zigzagPoints[0].x, zigzagPoints[0].y);
    for (let i = 1; i < zigzagPoints.length; i++) ctx.lineTo(zigzagPoints[i].x, zigzagPoints[i].y);
    ctx.stroke();

    // 主闪电体
    ctx.strokeStyle = color; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(zigzagPoints[0].x, zigzagPoints[0].y);
    for (let i = 1; i < zigzagPoints.length; i++) ctx.lineTo(zigzagPoints[i].x, zigzagPoints[i].y);
    ctx.stroke();

    // 白色内芯
    ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(zigzagPoints[0].x, zigzagPoints[0].y);
    for (let i = 1; i < zigzagPoints.length; i++) ctx.lineTo(zigzagPoints[i].x, zigzagPoints[i].y);
    ctx.stroke();

    // 分支闪电
    ctx.strokeStyle = 'rgba(' + hexToRgb(color) + ', 0.5)'; ctx.lineWidth = 1.5;
    for (let i = 1; i < pts.length - 1; i++) {
      if (Math.random() > 0.6) continue;
      const p = pts[i];
      const angle = Math.random() * Math.PI * 2;
      const len = 15 + Math.random() * 20;
      ctx.beginPath(); ctx.moveTo(p.x, p.y);
      const midX = p.x + Math.cos(angle) * len * 0.5 + (Math.random() - 0.5) * 8;
      const midY = p.y + Math.sin(angle) * len * 0.5 + (Math.random() - 0.5) * 8;
      const endX = p.x + Math.cos(angle) * len;
      const endY = p.y + Math.sin(angle) * len;
      ctx.lineTo(midX, midY); ctx.lineTo(endX, endY); ctx.stroke();
    }

    // 命中点光效
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i];
      ctx.globalAlpha = bolt.alpha * 0.3; ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(p.x, p.y, 12, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = bolt.alpha * 0.6; ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(p.x, p.y, 6, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = bolt.alpha; ctx.fillStyle = '#FFFFFF';
      ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI * 2); ctx.fill();
    }

    // 链间电弧
    if (pts.length > 2) {
      ctx.strokeStyle = 'rgba(' + hexToRgb(color) + ', 0.3)'; ctx.lineWidth = 1;
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
  ctx.globalAlpha = 1; ctx.lineCap = 'butt'; ctx.lineJoin = 'miter';

  // 超载爆炸
  const explosions = data.explosions || [];
  for (const e of explosions) {
    ctx.globalAlpha = e.alpha * 0.6; ctx.strokeStyle = color; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(e.x, e.y, e.radius * e.alpha, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = e.alpha * 0.2; ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(e.x, e.y, e.radius * e.alpha * 0.6, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// ===== 穿甲弹(ArmorPiercing, 原Missile) =====
function drawMissile(ctx, sprites, data) {
  const { shells, shockwaves, color } = data;

  // 弹体颜色/大小表
  const TIER_STYLE = [
    { bodyW: 4, bodyH: 10, trailLen: 4, color: '#FFFFFF', trailColor: 'rgba(255,255,255,0.3)', glow: false },        // 基础
    { bodyW: 5, bodyH: 14, trailLen: 5, color: '#FF8800', trailColor: 'rgba(255,136,0,0.35)', glow: false },          // 强化
    { bodyW: 7, bodyH: 18, trailLen: 6, color: '#FF3333', trailColor: 'rgba(255,51,51,0.4)', glow: true },            // 重型
    { bodyW: 4, bodyH: 24, trailLen: 10, color: '#44CCFF', trailColor: 'rgba(68,204,255,0.5)', glow: true },          // 超速
  ];

  for (const sh of shells) {
    const style = TIER_STYLE[sh.tier] || TIER_STYLE[0];

    // 拖尾
    sh.trail.push({ x: sh.x, y: sh.y });
    if (sh.trail.length > style.trailLen) sh.trail.shift();

    for (let t = 0; t < sh.trail.length; t++) {
      const tr = sh.trail[t];
      const ratio = t / sh.trail.length;
      ctx.globalAlpha = ratio * 0.4;
      ctx.fillStyle = style.trailColor;
      const sz = style.bodyW * ratio;
      ctx.fillRect(tr.x - sz / 2, tr.y, sz, style.bodyH * ratio);
    }

    // 弹体辉光（重型/超速）
    if (style.glow) {
      ctx.globalAlpha = 0.2;
      ctx.fillStyle = style.color;
      ctx.beginPath();
      ctx.arc(sh.x, sh.y, style.bodyW * 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // 弹体
    ctx.globalAlpha = 1;
    ctx.fillStyle = style.color;
    // 锥形弹头
    ctx.beginPath();
    ctx.moveTo(sh.x, sh.y - style.bodyH / 2);        // 顶部尖端
    ctx.lineTo(sh.x - style.bodyW / 2, sh.y + style.bodyH / 3);
    ctx.lineTo(sh.x + style.bodyW / 2, sh.y + style.bodyH / 3);
    ctx.closePath();
    ctx.fill();
    // 弹体
    ctx.fillRect(sh.x - style.bodyW / 2, sh.y + style.bodyH / 3 - 1, style.bodyW, style.bodyH / 2);

    // 尾焰（强化/重型）
    if (sh.tier >= 1 && sh.tier < 3) {
      const flameH = 6 + sh.tier * 3;
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = '#FFD700';
      ctx.beginPath();
      ctx.moveTo(sh.x - style.bodyW / 3, sh.y + style.bodyH * 0.8);
      ctx.lineTo(sh.x, sh.y + style.bodyH * 0.8 + flameH);
      ctx.lineTo(sh.x + style.bodyW / 3, sh.y + style.bodyH * 0.8);
      ctx.closePath();
      ctx.fill();
    }

    // 超速弹电磁效果
    if (sh.tier === 3) {
      // 双侧电弧
      ctx.strokeStyle = '#44CCFF';
      ctx.lineWidth = 1;
      for (let s = 0; s < 3; s++) {
        ctx.globalAlpha = 0.3 + Math.random() * 0.3;
        const sparkY = sh.y + Math.random() * style.bodyH - style.bodyH / 2;
        const sparkW = 6 + Math.random() * 8;
        ctx.beginPath();
        ctx.moveTo(sh.x - sparkW, sparkY);
        ctx.lineTo(sh.x - sparkW * 0.4 + (Math.random() - 0.5) * 4, sparkY + (Math.random() - 0.5) * 6);
        ctx.lineTo(sh.x, sparkY + (Math.random() - 0.5) * 3);
        ctx.lineTo(sh.x + sparkW * 0.4 + (Math.random() - 0.5) * 4, sparkY + (Math.random() - 0.5) * 6);
        ctx.lineTo(sh.x + sparkW, sparkY);
        ctx.stroke();
      }

      // 穿透能量涟漪 — 已穿透越多涟漪越多
      if (sh.hitCount > 0) {
        const ringCount = Math.min(sh.hitCount, 5);
        for (let r = 0; r < ringCount; r++) {
          const ringY = sh.y + style.bodyH / 2 + r * 12 + (Date.now() % 300) * 0.03;
          const ringR = 3 + r * 1.5;
          ctx.globalAlpha = 0.25 - r * 0.04;
          ctx.strokeStyle = '#88EEFF';
          ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.arc(sh.x, ringY, ringR, 0, Math.PI * 2); ctx.stroke();
        }
      }

      // 弹头前方聚能光点
      ctx.globalAlpha = 0.6 + Math.sin(Date.now() * 0.02) * 0.3;
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath(); ctx.arc(sh.x, sh.y - style.bodyH / 2 - 3, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = '#44CCFF';
      ctx.beginPath(); ctx.arc(sh.x, sh.y - style.bodyH / 2 - 3, 5, 0, Math.PI * 2); ctx.fill();
    }
  }

  // 冲击波
  for (const sw of shockwaves) {
    ctx.globalAlpha = sw.alpha * 0.5;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sw.x - sw.width, sw.y);
    ctx.lineTo(sw.x + sw.width, sw.y);
    ctx.stroke();
    // 波纹
    ctx.globalAlpha = sw.alpha * 0.2;
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sw.x - sw.width * 0.8, sw.y - 3);
    ctx.lineTo(sw.x + sw.width * 0.8, sw.y - 3);
    ctx.moveTo(sw.x - sw.width * 0.8, sw.y + 3);
    ctx.lineTo(sw.x + sw.width * 0.8, sw.y + 3);
    ctx.stroke();
  }

  ctx.globalAlpha = 1;
}

// ===== 冰墙(FrostStorm) =====
// 伪随机种子（同一面墙每帧保持一致的形状）
function _iceHash(seed) { return ((seed * 9301 + 49297) % 233280) / 233280; }

function drawFrostStorm(ctx, data) {
  var walls = data.walls;
  var particles = data.particles;
  var auraLv = data.auraLv || 0;
  var now = Date.now();

  // 1. 寒气场光环
  if (auraLv > 0) {
    for (var i = 0; i < walls.length; i++) {
      var w = walls[i];
      var auraR = 80 * (1 + auraLv * 0.3);
      var pulse = Math.sin(now * 0.002 + i * 2) * 0.03;
      ctx.globalAlpha = 0.06 + pulse;
      ctx.fillStyle = '#224466';
      ctx.beginPath(); ctx.arc(w.x, w.y, auraR, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.12 + pulse;
      ctx.strokeStyle = '#44AACC';
      ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.arc(w.x, w.y, auraR, 0, Math.PI * 2); ctx.stroke();
    }
  }

  // 2. 冰墙本体
  for (var i = 0; i < walls.length; i++) {
    var w = walls[i];
    var hpRatio = Math.max(0.01, w.hp / w.maxHp);
    var halfW = w.width * 0.5;
    var wallH = 22;
    var baseY = w.y + wallH * 0.3;
    var topY = w.y - wallH * 0.7;

    // === A. 底部冰霜蔓延 ===
    ctx.globalAlpha = 0.12 * hpRatio;
    ctx.fillStyle = '#88CCEE';
    var frostW = halfW + 8 + hpRatio * 6;
    ctx.fillRect(w.x - frostW, baseY, frostW * 2, 3);
    ctx.globalAlpha = 0.08 * hpRatio;
    for (var f = 0; f < 5; f++) {
      var fx = w.x - frostW + _iceHash(i * 50 + f) * frostW * 2;
      ctx.fillRect(fx, baseY + 2 + _iceHash(i * 50 + f + 7) * 3, 2, 1);
    }

    // === A2. 融合墙强化效果 ===
    var baseColW = 49; // 基准列宽
    var isMerged = w.width > baseColW * 1.3;
    if (isMerged) {
      var mergeLevel = Math.floor(w.width / baseColW); // 融合了几列
      var mPulse = Math.sin(now * 0.003 + i * 1.5) * 0.1 + 0.9;
      // 外部强光晕
      ctx.globalAlpha = 0.15 * hpRatio * mPulse;
      ctx.fillStyle = '#00FFFF';
      ctx.fillRect(w.x - halfW - 8, topY - 6, w.width + 16, wallH + 12);
      // 底部能量线
      ctx.globalAlpha = 0.4 * hpRatio * mPulse;
      ctx.strokeStyle = '#66FFFF';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(w.x - halfW, baseY + 3);
      ctx.lineTo(w.x + halfW, baseY + 3);
      ctx.stroke();
      // 融合层数指示（上方小菱形）
      ctx.fillStyle = '#AAFFFF';
      ctx.globalAlpha = 0.8 * mPulse;
      for (var m = 0; m < mergeLevel && m < 5; m++) {
        var mx = w.x - (mergeLevel - 1) * 6 + m * 12;
        var my = topY - 20;
        ctx.beginPath();
        ctx.moveTo(mx, my - 3);
        ctx.lineTo(mx + 2, my);
        ctx.lineTo(mx, my + 3);
        ctx.lineTo(mx - 2, my);
        ctx.closePath();
        ctx.fill();
      }
    }

    // === B. 外发光 ===
    ctx.globalAlpha = 0.1 * hpRatio;
    ctx.fillStyle = '#225588';
    ctx.fillRect(w.x - halfW - 5, topY - 3, w.width + 10, wallH + 6);

    // === C. 墙体主体（多层半透明=冰的深度感） ===
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = '#0D2844';
    ctx.fillRect(w.x - halfW, topY, w.width, wallH);

    ctx.globalAlpha = 0.45 * hpRatio;
    ctx.fillStyle = '#2288AA';
    ctx.fillRect(w.x - halfW + 1, topY + 2, w.width - 2, wallH - 4);

    ctx.globalAlpha = 0.3 * hpRatio;
    ctx.fillStyle = '#44CCEE';
    ctx.fillRect(w.x - halfW + 2, topY + 3, w.width - 4, wallH - 8);

    // === D. 冰柱/冰刺（顶部不规则锯齿） ===
    var spikeCount = 5;
    var spikeW = w.width / spikeCount;
    ctx.globalAlpha = 0.6 * hpRatio;
    for (var s = 0; s < spikeCount; s++) {
      var sx = w.x - halfW + s * spikeW;
      var spikeH = 4 + _iceHash(i * 100 + s * 17) * 10;
      var tipX = sx + spikeW * (0.3 + _iceHash(i * 100 + s * 31) * 0.4);

      ctx.fillStyle = '#1A5577';
      ctx.beginPath();
      ctx.moveTo(sx, topY);
      ctx.lineTo(tipX, topY - spikeH);
      ctx.lineTo(sx + spikeW, topY);
      ctx.closePath();
      ctx.fill();

      ctx.globalAlpha = 0.35 * hpRatio;
      ctx.fillStyle = '#88DDFF';
      ctx.beginPath();
      ctx.moveTo(sx + spikeW * 0.2, topY);
      ctx.lineTo(tipX, topY - spikeH + 2);
      ctx.lineTo(sx + spikeW * 0.5, topY);
      ctx.closePath();
      ctx.fill();
    }

    // === E. 冰晶折射高光（闪烁菱形） ===
    ctx.fillStyle = '#FFFFFF';
    for (var g = 0; g < 3; g++) {
      var gx = w.x - halfW + 5 + _iceHash(i * 200 + g * 23) * (w.width - 10);
      var gy = topY + 4 + _iceHash(i * 200 + g * 37) * (wallH - 10);
      var shimmer = Math.sin(now * 0.004 + g * 2.3 + i) * 0.5 + 0.5;
      ctx.globalAlpha = shimmer * 0.5 * hpRatio;
      var gs = 1.5 + shimmer;
      ctx.beginPath();
      ctx.moveTo(gx, gy - gs);
      ctx.lineTo(gx + gs * 0.6, gy);
      ctx.lineTo(gx, gy + gs);
      ctx.lineTo(gx - gs * 0.6, gy);
      ctx.closePath();
      ctx.fill();
    }

    // === F. 顶部高光带 ===
    ctx.globalAlpha = 0.3 * hpRatio;
    ctx.fillStyle = '#AAEEFF';
    ctx.fillRect(w.x - halfW + 3, topY + 1, w.width - 6, 2);
    ctx.globalAlpha = 0.2 * hpRatio;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(w.x - halfW + 6, topY + 1, w.width - 12, 1);

    // === G. 裂纹（HP越低越多） ===
    if (hpRatio < 0.7) {
      ctx.strokeStyle = '#AADDEE';
      ctx.lineWidth = 0.8;
      var crackCount = hpRatio < 0.3 ? 5 : 2;
      for (var c = 0; c < crackCount; c++) {
        ctx.globalAlpha = (1 - hpRatio) * 0.4;
        var seed = i * 7 + c * 13;
        var cx = w.x - halfW + _iceHash(seed) * w.width;
        var cy = topY + 4;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        for (var seg = 0; seg < 3; seg++) {
          cx += (_iceHash(seed + seg * 5) - 0.5) * 8;
          cy += 3 + _iceHash(seed + seg * 9) * 5;
          ctx.lineTo(cx, cy);
        }
        ctx.stroke();
      }
    }

    // === H. 霓虹边框 ===
    if (isMerged) {
      // 融合墙：双层边框 + 更亮颜色
      ctx.globalAlpha = 0.6 * hpRatio + 0.2;
      ctx.strokeStyle = '#88FFFF';
      ctx.lineWidth = 2;
      ctx.strokeRect(w.x - halfW, topY, w.width, wallH);
      ctx.globalAlpha = 0.3;
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1;
      ctx.strokeRect(w.x - halfW + 1, topY + 1, w.width - 2, wallH - 2);
    } else {
      ctx.globalAlpha = 0.4 * hpRatio + 0.1;
      ctx.strokeStyle = '#44DDFF';
      ctx.lineWidth = 1;
      ctx.strokeRect(w.x - halfW, topY, w.width, wallH);
    }

    // === I. HP条 ===
    var barW = w.width * 0.8;
    var barH = 2;
    var barX = w.x - barW * 0.5;
    var barY = baseY + 5;
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#112233';
    ctx.fillRect(barX, barY, barW, barH);
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = hpRatio > 0.5 ? '#44DDFF' : hpRatio > 0.25 ? '#FFAA44' : '#FF4444';
    ctx.fillRect(barX, barY, barW * hpRatio, barH);

    // === J. 叠加层数菱形 ===
    if (w.hp > w.maxHp * 0.5) {
      var stackDots = Math.min(Math.floor(w.hp / (w.maxHp * 0.5)), 5);
      for (var d = 0; d < stackDots; d++) {
        var dotX = w.x - (stackDots - 1) * 4 + d * 8;
        var dotY = topY - 16 - (4 + _iceHash(i * 100 + d * 17) * 10);
        ctx.globalAlpha = 0.6;
        ctx.fillStyle = '#AAFFFF';
        ctx.beginPath();
        ctx.moveTo(dotX, dotY - 2);
        ctx.lineTo(dotX + 1.5, dotY);
        ctx.lineTo(dotX, dotY + 2);
        ctx.lineTo(dotX - 1.5, dotY);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  // 3. 冰屑粒子
  for (var i = 0; i < particles.length; i++) {
    var p = particles[i];
    ctx.globalAlpha = p.alpha;
    ctx.fillStyle = p.color;
    if (p.size > 2.5) {
      var hs = p.size * 0.5;
      ctx.fillRect(p.x - hs, p.y - 0.5, p.size, 1);
      ctx.fillRect(p.x - 0.5, p.y - hs, 1, p.size);
      ctx.fillRect(p.x - hs * 0.5, p.y - hs * 0.5, 1, 1);
      ctx.fillRect(p.x + hs * 0.5, p.y + hs * 0.5, 1, 1);
      ctx.fillRect(p.x + hs * 0.5, p.y - hs * 0.5, 1, 1);
      ctx.fillRect(p.x - hs * 0.5, p.y + hs * 0.5, 1, 1);
    } else {
      ctx.fillRect(p.x - p.size * 0.5, p.y - p.size * 0.5, p.size, p.size);
    }
  }

  ctx.globalAlpha = 1;
}

// ===== 武器渲染分发 =====
function drawWeapons(ctx, sprites, weapons, launcher) {
  const lcx = launcher.getCenterX();
  const lcy = launcher.y;

  for (const key in weapons) {
    const weapon = weapons[key];
    const data = weapon.getRenderData(lcx, lcy);
    if (!data) continue;

    switch (key) {
      case 'kunai': drawKunai(ctx, sprites, data); break;
      case 'lightning': drawLightning(ctx, data); break;
      case 'missile': drawMissile(ctx, sprites, data); break;
      case 'meteor': drawMeteor(ctx, data); break;
      case 'drone': drawDrone(ctx, data); break;
      case 'spinBlade': drawSpinBlade(ctx, data); break;
      case 'blizzard': drawBlizzard(ctx, data); break;
      case 'ionBeam': drawIonBeam(ctx, data); break;
      case 'frostStorm': drawFrostStorm(ctx, data); break;
      case 'gravityWell': drawGravityWell(ctx, data); break;
    }
  }
}

// ===== 奇点引擎(GravityWell) =====
function drawGravityWell(ctx, data) {
  var wells = data.wells || [];
  var negaBricks = data.negaBricks || [];
  var particles = data.particles || [];
  var now = Date.now();

  // 1. 黑洞本体
  for (var i = 0; i < wells.length; i++) {
    var w = wells[i];
    var lifeRatio = Math.max(0.01, w.timer / w.duration);
    var pulse = Math.sin(now * 0.004 + i * 2) * 0.1 + 0.9;

    // 外围引力场（大范围暗紫色区域，让人感受到范围）
    ctx.globalAlpha = 0.18 * lifeRatio;
    ctx.fillStyle = '#220044';
    ctx.beginPath(); ctx.arc(w.x, w.y, w.radius, 0, Math.PI * 2); ctx.fill();

    // 引力场边缘 - 双层虚线环
    ctx.globalAlpha = 0.4 * lifeRatio * pulse;
    ctx.strokeStyle = '#8833CC';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.beginPath(); ctx.arc(w.x, w.y, w.radius, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);

    // 内圈范围环（半径60%处）
    ctx.globalAlpha = 0.25 * lifeRatio * pulse;
    ctx.strokeStyle = '#AA55DD';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 6]);
    ctx.beginPath(); ctx.arc(w.x, w.y, w.radius * 0.6, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);

    // 扭曲吸积盘（多层旋转弧线，模拟物质被吸入）
    for (var ring = 0; ring < 5; ring++) {
      var r = 12 + ring * 10;
      var rotSpeed = (ring % 2 === 0 ? 1 : -1) * 0.004;
      var rot = now * rotSpeed + ring * 1.0;
      var arcLen = Math.PI * (0.6 + ring * 0.15);
      ctx.globalAlpha = (0.5 - ring * 0.07) * lifeRatio * pulse;
      ctx.strokeStyle = ring < 2 ? '#DD88FF' : '#9944CC';
      ctx.lineWidth = 2.5 - ring * 0.3;
      ctx.beginPath();
      ctx.arc(w.x, w.y, r, rot, rot + arcLen);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(w.x, w.y, r, rot + Math.PI, rot + Math.PI + arcLen);
      ctx.stroke();
    }

    // 中心黑洞核心（更大更醒目）
    ctx.globalAlpha = 0.95;
    ctx.fillStyle = '#0A0015';
    ctx.beginPath(); ctx.arc(w.x, w.y, 12, 0, Math.PI * 2); ctx.fill();

    // 核心紫色辉光
    ctx.globalAlpha = 0.7 * pulse;
    ctx.fillStyle = '#BB22FF';
    ctx.beginPath(); ctx.arc(w.x, w.y, 8, 0, Math.PI * 2); ctx.fill();

    // 核心白点
    ctx.globalAlpha = 0.9 * pulse;
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath(); ctx.arc(w.x, w.y, 3, 0, Math.PI * 2); ctx.fill();

    // 能量累积数字（更醒目）
    if (w.energyAccum > 10) {
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = '#DD99FF';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('+' + Math.floor(w.energyAccum), w.x, w.y + 22);
    }
  }

  // 2. 负能量砖块（非常醒目！）
  for (var i = 0; i < negaBricks.length; i++) {
    var nb = negaBricks[i];
    var absHp = Math.abs(nb.hp);
    var pulse = Math.sin(now * 0.005 + i * 3) * 0.15 + 0.85;
    var halfW = nb.width * 0.5;
    var halfH = nb.height * 0.5;
    var isFlash = nb.flashTimer > 0;

    // 外发光（大范围紫色光晕）
    ctx.globalAlpha = 0.2 * pulse;
    ctx.fillStyle = '#440088';
    ctx.fillRect(nb.x - halfW - 8, nb.y - halfH - 8, nb.width + 16, nb.height + 16);

    // 本体（暗紫色）
    ctx.globalAlpha = isFlash ? 0.95 : 0.75;
    ctx.fillStyle = isFlash ? '#FFFFFF' : '#1A0033';
    ctx.fillRect(nb.x - halfW, nb.y - halfH, nb.width, nb.height);

    // 内部漩涡纹理
    ctx.globalAlpha = 0.3 * pulse;
    ctx.strokeStyle = '#8844CC';
    ctx.lineWidth = 1;
    var vAngle = nb.vortexAngle || 0;
    for (var v = 0; v < 3; v++) {
      var vr = 4 + v * 4;
      var va = vAngle + v * 1.2;
      ctx.beginPath();
      ctx.arc(nb.x, nb.y, vr, va, va + Math.PI * 0.8);
      ctx.stroke();
    }

    // 紫色霓虹边框
    ctx.globalAlpha = 0.7 * pulse;
    ctx.strokeStyle = '#CC44FF';
    ctx.lineWidth = 2;
    ctx.strokeRect(nb.x - halfW, nb.y - halfH, nb.width, nb.height);

    // 第二层亮边框
    ctx.globalAlpha = 0.3;
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1;
    ctx.strokeRect(nb.x - halfW + 1, nb.y - halfH + 1, nb.width - 2, nb.height - 2);

    // 大号负数显示
    ctx.globalAlpha = 1.0;
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // 紫色外发光文字（画两遍模拟）
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#AA00FF';
    ctx.fillText('-' + Math.floor(absHp), nb.x + 1, nb.y + 1);
    ctx.globalAlpha = 1.0;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText('-' + Math.floor(absHp), nb.x, nb.y);

    // 反向粒子（从外向内吸入效果，用小点模拟）
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = '#AA66FF';
    for (var d = 0; d < 4; d++) {
      var angle = now * 0.002 + d * Math.PI * 0.5 + i;
      var dist = halfW + 5 + Math.sin(now * 0.003 + d) * 4;
      var dx = nb.x + Math.cos(angle) * dist;
      var dy = nb.y + Math.sin(angle) * dist * 0.6;
      ctx.beginPath(); ctx.arc(dx, dy, 1.2, 0, Math.PI * 2); ctx.fill();
    }
  }

  // 3. 粒子
  for (var i = 0; i < particles.length; i++) {
    var p = particles[i];
    ctx.globalAlpha = p.alpha;
    ctx.fillStyle = p.color;
    if (p.size > 2) {
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size * 0.5, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillRect(p.x - 0.5, p.y - 0.5, p.size, p.size);
    }
  }

  ctx.globalAlpha = 1;
}

module.exports = { drawWeapons, drawKunai, drawLightning, drawMissile, drawMeteor, drawDrone, drawSpinBlade, drawBlizzard, drawIonBeam, drawFrostStorm, drawGravityWell };