const Web3 = require('web3');
const web3 = new Web3();

/**
 * Etherの金額をweiに変更
 * @param {number} ether Etherで指定された値
 * @returns {number} weiに変換された値
 */
module.exports = (ether) => {
  return +web3.toWei(ether, 'ether');
}
