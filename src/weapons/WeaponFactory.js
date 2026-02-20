/**
 * WeaponFactory.js - 武器创建工厂
 */
const Kunai = require('./Kunai');
const LightningWeapon = require('./Lightning');
const MissileWeapon = require('./Missile');
const MeteorWeapon = require('./Meteor');
const DroneWeapon = require('./Drone');
const SpinBlade = require('./SpinBlade');

function createWeapon(key) {
  switch (key) {
    case 'kunai': return new Kunai();
    case 'lightning': return new LightningWeapon();
    case 'missile': return new MissileWeapon();
    case 'meteor': return new MeteorWeapon();
    case 'drone': return new DroneWeapon();
    case 'spinBlade': return new SpinBlade();
  }
  return null;
}

module.exports = { createWeapon };
