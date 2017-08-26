const Web3 = require('web3');
const web3 = new Web3();

/**
 * Etherの金額をweiに変更
 * @param {number} wei wei指定された値
 * @returns {number} etherに変換された値
 */
module.exports = (wei) => {
  return +web3.fromWei(wei, 'ether');
}
