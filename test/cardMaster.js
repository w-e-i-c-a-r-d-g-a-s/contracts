const Web3 = require('web3');
var CardMaster = artifacts.require("./CardMaster.sol");
var Card = artifacts.require("./Card.sol");
const web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));

contract('CardMaster', (accounts) => {
  it('initialize', () => {
    return CardMaster.deployed().then((instance) => {
      return instance.getCardAddresses.call();
    }).then((cardAddresses) => {
      assert.lengthOf(cardAddresses, 0);
    });
  });

  it('testing "addCard"', () => {
    let cardMaster = null;
    let card = null;
    return CardMaster.deployed().then((instance) => {
      cardMaster = instance;
      return instance.addCard('test-name', 10, 'hash123');
    }).then((addr) => {
      return cardMaster.getCardAddresses.call();
    }).then((cardAddresses) => {
      assert.lengthOf(cardAddresses, 1);
      return cardMaster.getCard.call(cardAddresses[0])
    }).then((card) => {
      // Get new Card contract
      return Card.at(card);
    }).then((data) => {
      card = data;
      return card.name();
    }).then((name) => {
      // nameが正しいか
      assert.equal(web3.toAscii(name).replace(/\u0000/g, ''), 'test-name');
      return card.issued();
    }).then((issued) => {
      // issuedが正しいか
      assert.equal(web3.toDecimal(issued), 10);
      return card.imageHash();
    }).then((imageHash) => {
      // imageHashが正しいか
      assert.equal(web3.toAscii(imageHash).replace(/\u0000/g, ''), 'hash123');
      return card.author();
    }).then((author) => {
      // authorが正しいか
      assert.equal(author, accounts[0]);
    });
  });
});

