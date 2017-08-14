const Web3 = require('web3');
const web3 = new Web3();

/**
 * hexをascii文字列に変換
 * @param {string} hex hex文字列
 * @returns {string} 変換された文字列
 */
module.exports = (hex) => {
  return web3.toAscii(hex).replace(/\u0000/g, '');
};
