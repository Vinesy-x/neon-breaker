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
  var hpMult = 1.0 + (chapter - 1) * 0.12;
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
