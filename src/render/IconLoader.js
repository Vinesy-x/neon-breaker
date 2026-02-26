/**
 * IconLoader - 统一图标加载管理
 * 加载 assets/icons/ 下的所有 PNG 图标，提供 drawIcon 方法替代 emoji
 */
class IconLoader {
  constructor() {
    this._icons = {};
    this._loaded = {};
    this._allKeys = [
      // 武器
      'weapon_kunai', 'weapon_lightning', 'weapon_missile', 'weapon_meteor',
      'weapon_drone', 'weapon_spinBlade', 'weapon_blizzard', 'weapon_ionBeam', 'weapon_frostStorm',
      // 飞机升级
      'upgrade_attack', 'upgrade_fireRate', 'upgrade_crit', 'upgrade_startLevel', 'upgrade_coinBonus',
      // 飞机分支
      'ship_attack', 'ship_speed', 'ship_multi', 'ship_pierce', 'ship_spread',
      // UI通用
      'ui_coin', 'ui_lock', 'tab_chapter', 'tab_upgrade', 'tab_weapon',
      // 飞机+副翼精灵
      'ship_main', 'wing_default',
      'wing_kunai', 'wing_lightning', 'wing_missile', 'wing_meteor',
      'wing_drone', 'wing_spinBlade', 'wing_blizzard', 'wing_ionBeam',
    ];
    this._loadAll();
  }

  _loadAll() {
    for (const key of this._allKeys) {
      const img = wx.createImage();
      img.onload = () => { this._loaded[key] = true; };
      img.onerror = () => { console.warn('[IconLoader] Failed to load:', key); };
      img.src = 'assets/icons/' + key + '.png';
      this._icons[key] = img;
    }
    // ship_main 是 128x128，已在 allKeys 中自动加载
  }

  /**
   * 获取图标 Image 对象
   * @param {string} key - 图标key，如 'weapon_kunai'
   * @returns {Image|null}
   */
  get(key) {
    return this._loaded[key] ? this._icons[key] : null;
  }

  /**
   * 在 Canvas 上绘制图标（居中）
   * @param {CanvasRenderingContext2D} ctx
   * @param {string} key - 图标key
   * @param {number} cx - 中心x
   * @param {number} cy - 中心y
   * @param {number} size - 显示尺寸
   * @returns {boolean} 是否成功绘制
   */
  drawIcon(ctx, key, cx, cy, size) {
    const img = this.get(key);
    if (!img) return false;
    ctx.drawImage(img, cx - size / 2, cy - size / 2, size, size);
    return true;
  }
}

// 单例
let _instance = null;
function getIconLoader() {
  if (!_instance) _instance = new IconLoader();
  return _instance;
}

module.exports = { getIconLoader };
