const Web3 = require('web3');
const web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));
const toWei = require('./helpers/toWei');
const toEther = require('./helpers/toEther');
const toAscii = require('./helpers/toAscii');
const toDecimal = require('./helpers/toDecimal');
const toBool = require('./helpers/toBool');
const expectThrow = require('./helpers/expectThrow');
const getGas = require('./helpers/getGas');
const txLog = require('./helpers/txLog');

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

  contract('Card#Bid', (accounts) => {
    // 買い注文を発行
    it("testing 'bid' OK", async () => {
      const card = await Card.new('cardName', 100, 'imageHash123', accounts[0]);
      const buyerBalance =  web3.eth.getBalance(accounts[1]);
      // 1枚 1枚あたり1Eth の買い注文を作成
      const tx = await card.bid(1, 1, { from: accounts[1], value: toWei(1) });
      const gas = getGas(tx);
      txLog(tx, 'bid');

      // 買い注文を発行したアカウントのetherが変化しているか
      const buyerBalance1 = web3.eth.getBalance(accounts[1]);
      assert.equal(buyerBalance.minus(buyerBalance1).toNumber(), toWei(1) + gas);

      // リストに追加されている
      const bidInfosSize = await card.getBidInfosCount.call();
      assert.equal(bidInfosSize, 1);

      const bidInfoAddr = await card.bidInfos.call(0);
      // contractがethを保持している
      assert.equal(web3.eth.getBalance(bidInfoAddr), toWei(1));
      // bidInfoを確認
      const bidInfo = await BidInfo.at(bidInfoAddr);
      // valueが正しいか
      const value = await bidInfo.value();
      assert.equal(value.toNumber(), toWei(1));
      // buyerが正しいか
      const buyer = await bidInfo.buyer();
      assert.equal(buyer, accounts[1]);
      // quantityが正しいか
      const quantity = await bidInfo.quantity();
      assert.equal(quantity.toNumber(), 1);
      // priceが正しいか
      const price = await bidInfo.price();
      assert.equal(price.toNumber(), toWei(1));
      // endedが正しいか
      const ended = await bidInfo.ended();
      assert.isFalse(ended);
    });

    // 買い注文を発行 金額が正しくない場合
    it("testing 'bid' NG", async () => {
      const card = await Card.new('cardName', 100, 'imageHash123', accounts[0]);
      // 1枚 1枚あたり1Eth の買い注文を作成
      await expectThrow(card.bid(1, 1, { from: accounts[1], value: toWei(1.1) }));
    });

    // 買い注文に対して売る
    it("testing 'acceptBid' OK", async () => {
      const card = await Card.new('cardName', 100, 'imageHash123', accounts[0]);

      const buyerBalance =  web3.eth.getBalance(accounts[1]);

      // 2枚 1枚あたり1Eth の買い注文を作成
      let tx = await card.bid(2, 1, { from: accounts[1], value: toWei(2) });
      let gas = getGas(tx);

      // buyerのetherが減る
      const buyerBalance1 =  web3.eth.getBalance(accounts[1]);
      assert.equal(buyerBalance.minus(buyerBalance1).toNumber(), toWei(2) + gas);
      const sellerBalance =  web3.eth.getBalance(accounts[0]);

      // 2枚売る
      tx = await card.acceptBid(0, 2);
      gas = getGas(tx);
      txLog(tx, 'acceptBid');
      // console.log('acceptBid', gas);

      const sellerBalance1 =  web3.eth.getBalance(accounts[0]);
      // sellerのetherが増える
      // TODO gas分が引かれた分しか手元に入らないが・・・🤔
      assert.equal(sellerBalance1.minus(sellerBalance).toNumber(), toWei(2) - gas);

      // 所有数が変化している
      const ownerList = await card.getOwnerList();
      assert.lengthOf(ownerList, 2);
      const balance0 = await card.balanceOf.call(ownerList[0]);
      assert.equal(balance0.toNumber(), 98);
      const balance1 = await card.balanceOf.call(ownerList[1]);
      assert.equal(balance1.toNumber(), 2);

      // bidInfoの内容が変化している
      const bidInfoAddr = await card.bidInfos.call(0);
      // contractがethを保持していない
      assert.equal(web3.eth.getBalance(bidInfoAddr), 0);
      const bidInfo = await BidInfo.at(bidInfoAddr);
      // valueが正しいか
      const value = await bidInfo.value();
      assert.equal(value.toNumber(), toWei(0));
      // quantityが正しいか
      const quantity = await bidInfo.quantity();
      assert.equal(quantity.toNumber(), 0);
      // endedが正しいか
      const ended = await bidInfo.ended();
      assert.isTrue(ended);

    });

    // 買い注文に対して売る
    it("testing 'acceptBid' OK2", async () => {
      const card = await Card.new('cardName', 100, 'imageHash123', accounts[0]);
      // 2枚 1枚あたり1Eth の買い注文を作成
      await card.bid(2, 1, { from: accounts[1], value: toWei(2) });

      // bidInfoの内容が変化している
      let bidInfoAddr = await card.bidInfos.call(0);
      let bidInfo = await BidInfo.at(bidInfoAddr);
      // valueが正しいか
      let value = await bidInfo.value();
      assert.equal(value.toNumber(), toWei(2));

      // 1枚売る
      await card.acceptBid(0, 1);

      // 所有数が変化している
      const ownerList = await card.getOwnerList();
      assert.lengthOf(ownerList, 2);
      const balance0 = await card.balanceOf.call(ownerList[0]);
      assert.equal(balance0.toNumber(), 99);
      const balance1 = await card.balanceOf.call(ownerList[1]);
      assert.equal(balance1.toNumber(), 1);

      // bidInfoの内容が変化している
      bidInfoAddr = await card.bidInfos.call(0);
      bidInfo = await BidInfo.at(bidInfoAddr);
      // valueが正しいか
      value = await bidInfo.value();
      assert.equal(value.toNumber(), toWei(1));
      // quantityが正しいか
      const quantity = await bidInfo.quantity();
      assert.equal(quantity.toNumber(), 1);
      // endedが正しいか
      const ended = await bidInfo.ended();
      assert.isFalse(ended);
    });

    // 買い注文に対して売る 所有数を超えて売ろうとする
    it("testing 'acceptBid' NG. exceeds card number limit", async () => {
      const card = await Card.new('cardName', 1, 'imageHash123', accounts[0]);
      // 1枚 1枚あたり1Eth の買い注文を作成
      await card.bid(1, 1, { from: accounts[1], value: toWei(1) });
      // 2枚売ろうとする
      await expectThrow(card.acceptBid(0, 2));
    });

    // 買い注文に対して売る endしている買い注文
    it("testing 'acceptBid' NG. bid is ended", async () => {
      const card = await Card.new('cardName', 10, 'imageHash123', accounts[0]);
      // 1枚 1枚あたり1Eth の買い注文を作成
      await card.bid(1, 1, { from: accounts[1], value: toWei(1) });
      // 1枚売る
      await card.acceptBid(0, 1);

      // endedがtrueとなっているか
      const bidInfoAddr = await card.bidInfos.call(0);
      const bidInfo = await BidInfo.at(bidInfoAddr);
      const ended = await bidInfo.ended();
      assert.isTrue(ended);
      // 更に売る
      await expectThrow(card.acceptBid(0, 1));
    });

    // 買い注文に対して売る 提示しているカード以上売ろうとする
    it("testing 'acceptBid' NG. exceeds biding card number limit", async () => {
      const card = await Card.new('cardName', 10, 'imageHash123', accounts[0]);
      // 1枚 1枚あたり1Eth の買い注文を作成
      await card.bid(1, 1, { from: accounts[1], value: toWei(1) });
      // 2枚売ろうとする
      await expectThrow(card.acceptBid(0, 2));
    });

    // 買い注文を閉じる
    it("testing 'closeBid' OK", async () => {
      const card = await Card.new('cardName', 10, 'imageHash123', accounts[0]);
      // 1枚 1枚あたり1Eth の買い注文を作成
      await card.bid(1, 1, { from: accounts[1], value: toWei(1) });

      const bidInfoAddr = await card.bidInfos.call(0);
      const bidInfo = await BidInfo.at(bidInfoAddr);
      // closeする
      await bidInfo.close({ from: accounts[1] });

      // bidInfoが変化する
      const value = await bidInfo.value();
      assert.equal(value.toNumber(), 0);
      const ended = await bidInfo.ended();
      assert.isTrue(ended);
    });

    // 買い注文を閉じる
    it("testing 'closeBid' NG. execute not a buyer", async () => {
      const card = await Card.new('cardName', 10, 'imageHash123', accounts[0]);
      // 1枚 1枚あたり1Eth の買い注文を作成
      await card.bid(1, 1, { from: accounts[1], value: toWei(1) });

      const bidInfoAddr = await card.bidInfos.call(0);
      const bidInfo = await BidInfo.at(bidInfoAddr);
      // buyer以外がcloseしようとする
      await expectThrow(bidInfo.close({ from: accounts[0] }));
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
