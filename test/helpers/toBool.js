const Web3 = require('web3');
const web3 = new Web3();

/**
 * hexをboolに変換
 * @param {string} hex hex文字列
 * @returns {number} 変換された数値
 */
module.exports = (hex) => {
  return web3.toDecimal(hex) === 1;
};

