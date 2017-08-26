const Web3 = require('web3');
const web3 = new Web3();
const toAscii = require('./helpers/toAscii');
const getGas = require('./helpers/getGas');
const toEther = require('./helpers/toEther');

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
    const tx = await cardMaster.addCard('test-name', 10, 'hash123');
    const createdCardAddress = `0x${tx.receipt.logs[0].data.slice(26)}`;
    const cardAddresses = await cardMaster.getCardAddresses.call();
    assert.lengthOf(cardAddresses, 1);
    const cardAddress = await cardMaster.getCard.call(cardAddresses[0])
    // eventで出力されたカードアドレスが実際のカードアドレスと同じか
    assert.equal(createdCardAddress, cardAddress);
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

  it('testing "setCard"', async () => {
    // カードマスターを生成
    const cardMaster = await CardMaster.deployed();
    // カードを追加
    const tx = await cardMaster.addCard('test-name', 10, 'hash123');
    const cardAddresses = await cardMaster.getCardAddresses.call();
    const cardAddress = await cardMaster.getCard.call(cardAddresses[0])
    const card = await Card.at(cardAddress);
    // 別のカードマスターを生成
    const cardMaster2 = await CardMaster.deployed();
    const cardAddresses2 = await cardMaster2.getCardAddresses.call();
    const cardAddress2 = await cardMaster2.setCard(cardAddress);

    const cardAddressNew = await cardMaster2.getCard.call(cardAddresses2[0])
    const _addr = await cardMaster2.getCard.call(cardAddressNew);
    const cardNew = await Card.at(_addr);
    assert.equal(cardAddressNew, cardAddress);
    assert.equal(toAscii(await cardNew.name()), 'test-name');
  });
});
