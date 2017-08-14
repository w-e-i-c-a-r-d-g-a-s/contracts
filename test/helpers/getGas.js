const Web3 = require('web3');
const web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));

/**
 * トランザクションから利用したgas量を返す
 * @param {object} tx トランザクションデータ
 * @returns {number} gasの金額(wei)
 */
module.exports = (tx) => {
  const gasUsed = tx.receipt.gasUsed;
  const gasPrice = web3.eth.getTransaction(tx.tx).gasPrice.toNumber();
  return gasUsed * gasPrice;
};
