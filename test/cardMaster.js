const Web3 = require('web3');
const web3 = new Web3();
const toAscii = require('./helpers/toAscii');

var CardMaster = artifacts.require("./CardMaster.sol");
var Card = artifacts.require("./Card.sol");

contract('CardMaster', (accounts) => {
  it('initialize', async () => {
    const instance = await CardMaster.deployed();
    const cardAddresses = await instance.getCardAddresses.call();
    assert.lengthOf(cardAddresses, 0);
  });

  it('testing "addCard"', async () => {
    const cardMaster = await CardMaster.deployed();
    const addr = await cardMaster.addCard('test-name', 10, 'hash123');
    const cardAddresses = await cardMaster.getCardAddresses.call();
    assert.lengthOf(cardAddresses, 1);
    const cardAddress = await cardMaster.getCard.call(cardAddresses[0])
    // Get new Card contract
    const card = await Card.at(cardAddress);
    // nameが正しいか
    const name = await card.name();
    assert.equal(toAscii(name), 'test-name');
    // totalSupplyが正しいか
    const totalSupply = await card.totalSupply();
    assert.equal(web3.toDecimal(totalSupply), 10);
    // imageHashが正しいか
    const imageHash = await card.imageHash();
    assert.equal(toAscii(imageHash), 'hash123');
    // authorが正しいか
    const author = await card.author();
    assert.equal(author, accounts[0]);
  });
});
