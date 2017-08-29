const Web3 = require('web3');
const web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));

const getGas = require('./getGas');
const toEther = require('./toEther');

module.exports = (tx, method='unknown') => {
  const gas = getGas(tx);
  const gasPrice = web3.eth.getTransaction(tx.tx).gasPrice.toNumber();
  if(global.debug){
    console.log(`🏁 ${method} => gasUsed: ${tx.receipt.gasUsed} :: gasPrice: ${gasPrice} wei => ${gas} wei = ${toEther(gas)} ether`);
  }
};
