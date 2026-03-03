/**
 * BossFactory.js - 薄工厂层
 * Boss逻辑拆分到 bosses/ 目录
 */
const BossBase = require('./bosses/BossBase');
const ChargerBoss = require('./bosses/ChargerBoss');
const GuardianBoss = require('./bosses/GuardianBoss');
const SummonerBoss = require('./bosses/SummonerBoss');
const LaserTurretBoss = require('./bosses/LaserTurretBoss');
const PhantomBoss = require('./bosses/PhantomBoss');

function createBoss(type, chapter, gameAreaWidth) {
  var cycle = Math.floor((chapter - 1) / 5);
  // Boss HP倍率 = 章节基准 × 章节缩放
  // Boss baseHp(4800等) 设计为：满级玩家(25pts) 打 ~45秒
  // 跨章节缩放只走 chapterScale
  var ChapterConfig = require('./ChapterConfig');
  var cfg = ChapterConfig.get(chapter);
  var hpMult = cfg.baseHP * cfg.chapterScale;
  switch (type) {
    case 'charger':  return new ChargerBoss(hpMult, cycle, gameAreaWidth);
    case 'guardian':  return new GuardianBoss(hpMult, cycle, gameAreaWidth);
    case 'summoner':  return new SummonerBoss(hpMult, cycle, gameAreaWidth);
    case 'laser':     return new LaserTurretBoss(hpMult, cycle, gameAreaWidth);
    case 'phantom':   return new PhantomBoss(hpMult, cycle, gameAreaWidth);
    default:          return new ChargerBoss(hpMult, cycle, gameAreaWidth);
  }
}

module.exports = {
  createBoss,
  BossBase,
  ChargerBoss,
  GuardianBoss,
  SummonerBoss,
  LaserTurretBoss,
  PhantomBoss,
};
