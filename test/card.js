const Web3 = require('web3');
const web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));
const toWei = require('./helpers/toWei');
const toAscii = require('./helpers/toAscii');
const toDecimal = require('./helpers/toDecimal');
const toBool = require('./helpers/toBool');
const expectThrow = require('./helpers/expectThrow');
const getGas = require('./helpers/getGas');

const Card = artifacts.require("./Card.sol");
const BidInfo = artifacts.require("./BidInfo.sol");

// デバッグログ用
global.debug = false;

contract('Card', (accounts) => {
  it("constructor", async () => {
    const card = await Card.new('cardName', 100, 'imageHash123', accounts[0]);
    const name = await card.name();
    assert.equal(web3.toAscii(name).replace(/\u0000/g, ''), 'cardName');
    const totalSupply = await card.totalSupply();
    assert.equal(web3.toDecimal(totalSupply), 100);
    const imageHash = await card.imageHash();
    assert.equal(web3.toAscii(imageHash).replace(/\u0000/g, ''), 'imageHash123');
    const author = await card.author();
    assert.equal(author, accounts[0]);
    const ownerList = await card.getOwnerList();
    assert.lengthOf(ownerList, 1);
    assert.equal(ownerList[0], accounts[0]);
    const balance = await card.balanceOf.call(ownerList[0]);
    assert.equal(balance.toNumber(), 100);
  });

  contract('Card#deal', (accounts) => {
    // カードを配る
    it("testing 'deal'", async () => {
      const card = await Card.new('cardName', 100, 'imageHash123', accounts[0]);
      await card.deal(accounts[1], 10);
      const ownerList = await card.getOwnerList();
      const balance0 = await card.balanceOf.call(ownerList[0]);
      assert.equal(balance0.toNumber(), 90);
      const balance1 = await card.balanceOf.call(ownerList[1]);
      assert.equal(balance1.toNumber(), 10);
    });

    // 更に配る
    it("testing 'deal' twice", async () => {
      const card = await Card.new('cardName', 100, 'imageHash123', accounts[0]);
      await card.deal(accounts[1], 10);
      await card.deal(accounts[1], 10);
      const ownerList = await card.getOwnerList();
      const balance0 = await card.balanceOf.call(ownerList[0]);
      assert.equal(balance0.toNumber(), 80);
      const balance1 = await card.balanceOf.call(ownerList[1]);
      assert.equal(balance1.toNumber(), 20);
    });

    // 全部配る
    it("testing 'deal' Distribute all", async () => {
      const card = await Card.new('cardName', 100, 'imageHash123', accounts[0]);
      await card.deal(accounts[1], 100);
      const ownerList = await card.getOwnerList();
      const balance0 = await card.balanceOf.call(ownerList[0]);
      assert.equal(balance0.toNumber(), 0);
      const balance1 = await card.balanceOf.call(ownerList[1]);
      assert.equal(balance1.toNumber(), 100);
    });

    // 所有枚数以上配る
    it("testing 'deal' over number", async () => {
      const card = await Card.new('cardName', 100, 'imageHash123', accounts[0]);
      await expectThrow(card.deal(accounts[1], 101));
    });

    // オーナー以外が配る
    it("testing 'deal' NG", async () => {
      const card = await Card.new('cardName', 100, 'imageHash123', accounts[0]);
      await expectThrow(card.deal(accounts[1], 10, { from: accounts[2]}));
    });
  });

  contract('Card#MarketPrice', (accounts) => {
    it("testing 'marketPrice' OK", async () => {
      const card = await Card.new('cardName', 100, 'imageHash123', accounts[0]);
      let currentMP = await card.currentMarketPrice.call();
      assert.equal(currentMP.toNumber(), 0);

      // 売り注文を発行し買う 10枚 1枚あたり0.1ETH
      await card.ask(10, toWei(0.1));
      const tx = await card.acceptAsk(toWei(0.1), 10, {from: accounts[1], value: toWei(1)});
      // const gas = getGas(tx);

      // 時価が更新される
      currentMP = await card.currentMarketPrice.call();
      assert.equal(currentMP.toNumber(), toWei(0.1));
    });

    it("testing 'marketPrice' OK2", async () => {
      const card = await Card.new('cardName', 100, 'imageHash123', accounts[0]);
      let currentMP = await card.currentMarketPrice.call();
      assert.equal(currentMP.toNumber(), 0);

      // 売り注文を発行 1枚 1枚あたり0.1ETH
      await card.ask(1, toWei(0.1));
      // 売り注文を発行 5枚 1枚あたり0.123ETH
      await card.ask(5, toWei(0.123));
      // 売り注文を発行 5枚 1枚あたり0.581ETH
      await card.ask(3, toWei(0.581));
      await card.ask(1, toWei(0.11));
      let tx = await card.acceptAsk(toWei(0.1), 1, {from: accounts[1], value: toWei(0.1)});
      // イベントの値が正しいか
      let eventValues = tx.receipt.logs[0].data.slice(2).match(/.{1,64}/g);
      assert.equal(toDecimal(`0x${eventValues[0]}`), 1);
      assert.equal(toDecimal(`0x${eventValues[1]}`), toWei(0.1));
      assert.equal(toDecimal(`0x${eventValues[2]}`), toWei(0.1));
      // console.log(getGas(tx));

      // 時価が更新される
      currentMP = await card.currentMarketPrice.call();
      assert.equal(currentMP.toNumber(), toWei(0.1));

      tx = await card.acceptAsk(toWei(0.123), 5, {from: accounts[1], value: toWei(0.615)});
      // イベントの値が正しいか
      eventValues = tx.receipt.logs[0].data.slice(2).match(/.{1,64}/g);
      assert.equal(toDecimal(`0x${eventValues[0]}`), 2);
      assert.equal(toDecimal(`0x${eventValues[1]}`), toWei(0.1115));
      assert.equal(toDecimal(`0x${eventValues[2]}`), toWei(0.0115));

      // 時価が更新される
      currentMP = await card.currentMarketPrice.call();
      assert.equal(currentMP.toNumber(), toWei(0.1115));

      tx = await card.acceptAsk(toWei(0.581), 3, {from: accounts[2], value: toWei(1.743)});
      // イベントの値が正しいか
      eventValues = tx.receipt.logs[0].data.slice(2).match(/.{1,64}/g);
      assert.equal(toDecimal(`0x${eventValues[0]}`), 3);
      assert.equal(toDecimal(`0x${eventValues[1]}`), toWei(0.268));
      assert.equal(toDecimal(`0x${eventValues[2]}`), toWei(0.1565));
      assert.isFalse(toBool(`0x${eventValues[3]}`));
      currentMP = await card.currentMarketPrice.call();
      assert.equal(currentMP.toNumber(), toWei(0.268));

      // 時価が下がる
      tx = await card.acceptAsk(toWei(0.11), 1, {from: accounts[2], value: toWei(0.11)});
      // イベントの値が正しいか
      eventValues = tx.receipt.logs[0].data.slice(2).match(/.{1,64}/g);
      assert.equal(toDecimal(`0x${eventValues[0]}`), 4);
      assert.equal(toDecimal(`0x${eventValues[1]}`), toWei(0.2285));
      assert.equal(toDecimal(`0x${eventValues[2]}`), toWei(0.0395));
      assert.isTrue(toBool(`0x${eventValues[3]}`));
      currentMP = await card.currentMarketPrice.call();
      assert.equal(currentMP.toNumber(), toWei(0.2285));
    });
  });
});
