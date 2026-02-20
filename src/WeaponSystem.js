/** WeaponSystem.js - 兼容层，实际实现在 weapons/ 目录 */
const { createWeapon } = require('./weapons/WeaponFactory');
const Weapon = require('./weapons/Weapon');
module.exports = { Weapon, createWeapon };
