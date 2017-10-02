const Web3 = require('web3');
const web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));
const toWei = require('../helpers/toWei');
const getGas = require('../helpers/getGas');
const expectThrow = require('../helpers/expectThrow');
const txLog = require('../helpers/txLog');

// const toEther = require('./helpers/toEther');
const Card = artifacts.require("./Card.sol");
const BidInfo = artifacts.require("./BidInfo.sol");

// デバッグログ用
global.debug = false;

contract('Card#Bid', (accounts) => {
  // 買い注文を発行
  it("testing 'bid' OK", async () => {
    const card = await Card.new('cardName', 100, 'imageHash123', accounts[0]);
    const buyerBalance =  web3.eth.getBalance(accounts[1]);
    // 1枚あたり1wei の買い注文を作成
    const tx = await card.bid(1, 1, { from: accounts[1], value: 1 });
    const gas = getGas(tx);
    txLog(tx, 'bid');

    // 買い注文を発行したアカウントのetherが変化しているか
    const buyerBalance1 = web3.eth.getBalance(accounts[1]);
    assert.equal(buyerBalance.minus(buyerBalance1).toNumber(), 1 + gas);

    // リストに追加されている
    const bidInfosSize = await card.getBidInfosCount.call();
    assert.equal(bidInfosSize, 1);

    // 生成された買い注文をチェック
    const bidInfoPrices = await card.getBidInfoPrices.call();
    assert.equal(bidInfoPrices[0], '0x00000000000000000000000000000001');

    const bidInfoAddr = await card.bidInfos.call(bidInfoPrices[0]);
    // contractがethを保持している
    assert.equal(web3.eth.getBalance(bidInfoAddr), 1);
    // bidInfoを確認
    const bidInfo = await BidInfo.at(bidInfoAddr);
    // valueが正しいか
    // const value = await bidInfo.value();
    // assert.equal(value.toNumber(), 1);
    // buyer, quantityが正しいか
    const [ buyer, quantity ] = await bidInfo.bidInfoProps(0);
    assert.equal(buyer, accounts[1]);
    assert.equal(quantity.toNumber(), 1);
    // priceが正しいか
    const price = await bidInfo.price();
    assert.equal(price.toNumber(), 1);
    // endedが正しいか
    const ended = await bidInfo.ended();
    assert.isFalse(ended);
  });

  // 買い注文を複数（別々の金額で）発行
  it("testing 'bid' multiple OK", async () => {
    const card = await Card.new('cardName', 100, 'imageHash123', accounts[0]);
    const buyerBalance =  web3.eth.getBalance(accounts[1]);
    // 1枚あたり0.1ether の買い注文を作成
    const tx = await card.bid(1, toWei(0.01), { from: accounts[1], value: toWei(0.01) });
    const gas = getGas(tx);
    // txLog(tx, 'bid');
    const tx2 = await card.bid(5, toWei(0.02), { from: accounts[1], value: toWei(0.1) });
    const gas2 = getGas(tx2);

    // 買い注文を発行したアカウントのetherが変化しているか
    const buyerBalance1 = web3.eth.getBalance(accounts[1]);
    assert.equal(
      buyerBalance.minus(buyerBalance1).toNumber(),
      toWei(0.11) + gas + gas2
    );

    // リストに追加されている
    const bidInfosSize = await card.getBidInfosCount.call();
    assert.equal(bidInfosSize, 2);

    // 生成された買い注文をチェック
    const bidInfoPrices = await card.getBidInfoPrices.call();
    assert.equal(bidInfoPrices[0], '0x0000000000000000002386f26fc10000');
    assert.equal(bidInfoPrices[1], '0x000000000000000000470de4df820000');

    let bidInfoAddr = await card.bidInfos.call(bidInfoPrices[0]);
    // contractがethを保持している
    assert.equal(web3.eth.getBalance(bidInfoAddr), toWei(0.01));
    // bidInfoを確認
    let bidInfo = await BidInfo.at(bidInfoAddr);
    // valueが正しいか
    // const value = await bidInfo.value();
    // assert.equal(value.toNumber(), toWei(0.01));
    // priceが正しいか
    let price = await bidInfo.price();
    assert.equal(price.toNumber(), toWei(0.01));
    // endedが正しいか
    let ended = await bidInfo.ended();
    assert.isFalse(ended);

    bidInfoAddr = await card.bidInfos.call(bidInfoPrices[1]);
    // contractがethを保持している
    assert.equal(web3.eth.getBalance(bidInfoAddr), toWei(0.1));
    // bidInfoを確認
    bidInfo = await BidInfo.at(bidInfoAddr);
    // valueが正しいか
    // const value = await bidInfo.value();
    // assert.equal(value.toNumber(), toWei(0.1));
    // priceが正しいか
    price = await bidInfo.price();
    assert.equal(price.toNumber(), toWei(0.02));
    // endedが正しいか
    ended = await bidInfo.ended();
    assert.isFalse(ended);
  });

  // 買い注文を複数（同一金額で）発行
  it("testing 'bid' multiple same price", async () => {
    const card = await Card.new('cardName', 100, 'imageHash123', accounts[0]);
    const buyerBalance =  web3.eth.getBalance(accounts[1]);
    // 1枚あたり0.1ether の買い注文を作成
    const tx = await card.bid(1, toWei(0.01), { from: accounts[1], value: toWei(0.01) });
    const gas = getGas(tx);
    // txLog(tx, 'bid');
    const tx2 = await card.bid(5, toWei(0.01), { from: accounts[1], value: toWei(0.05) });
    const gas2 = getGas(tx2);

    // 買い注文を発行したアカウントのetherが変化しているか
    const buyerBalance1 = web3.eth.getBalance(accounts[1]);
    assert.equal(
      buyerBalance.minus(buyerBalance1).toNumber(),
      // 桁が多すぎて正常に計算されないためbigNumberを使う
      web3.toBigNumber(toWei(0.06))
        .plus(web3.toBigNumber(gas))
        .plus(web3.toBigNumber(gas2))
        .toNumber()
    );

    // リストに追加されている
    const bidInfosSize = await card.getBidInfosCount.call();
    assert.equal(bidInfosSize.toNumber(), 1);

    // 生成された買い注文をチェック
    const bidInfoPrices = await card.getBidInfoPrices.call();
    assert.equal(bidInfoPrices[0], '0x0000000000000000002386f26fc10000');

    let bidInfoAddr = await card.bidInfos.call(bidInfoPrices[0]);
    // contractがethを保持している（加算されている）
    assert.equal(web3.eth.getBalance(bidInfoAddr).toNumber(), toWei(0.06));
    // bidInfoを確認
    let bidInfo = await BidInfo.at(bidInfoAddr);
    // valueが正しいか
    // const value = await bidInfo.value();
    // assert.equal(value.toNumber(), toWei(0.01));
    const [ buyer, quantity ] = await bidInfo.bidInfoProps(0);
    assert.equal(buyer, accounts[1]);
    assert.equal(quantity.toNumber(), 1);
    const [ buyer1, quantity1 ] = await bidInfo.bidInfoProps(1);
    assert.equal(buyer1, accounts[1]);
    assert.equal(quantity1.toNumber(), 5);
    // priceが正しいか
    let price = await bidInfo.price();
    assert.equal(price.toNumber(), toWei(0.01));
  });

  // 買い注文を発行 金額が正しくない場合
  it("testing 'bid' NG", async () => {
    const card = await Card.new('cardName', 100, 'imageHash123', accounts[0]);
    // 1枚 1枚あたり1Eth の買い注文を作成
    await expectThrow(card.bid(1, 1, { from: accounts[1], value: 2 }));
  });

  // 買い注文に対して売る
  it("testing 'acceptBid' OK", async () => {
    const card = await Card.new('cardName', 100, 'imageHash123', accounts[0]);

    const buyerBalance =  web3.eth.getBalance(accounts[1]);

    // 2枚 1枚あたり1Eth の買い注文を作成
    let tx = await card.bid(2, toWei(0.005), { from: accounts[1], value: toWei(0.01) });
    let gas = getGas(tx);

    // buyerのetherが減る
    const buyerBalance1 =  web3.eth.getBalance(accounts[1]);
    assert.equal(buyerBalance.minus(buyerBalance1).toNumber(), toWei(0.01) + gas);
    const sellerBalance =  web3.eth.getBalance(accounts[0]);

    // 2枚売る
    tx = await card.acceptBid(toWei(0.005), 2);
    gas = getGas(tx);
    txLog(tx, 'acceptBid');
    // console.log('acceptBid', gas);

    const sellerBalance1 =  web3.eth.getBalance(accounts[0]);
    // sellerのetherが増える
    // TODO gas分が引かれた分しか手元に入らないが・・・🤔
    assert.equal(sellerBalance1.minus(sellerBalance).toNumber(), toWei(0.01) - gas);

    // 所有数が変化している
    const ownerList = await card.getOwnerList();
    assert.lengthOf(ownerList, 2);
    const balance0 = await card.balanceOf.call(ownerList[0]);
    assert.equal(balance0.toNumber(), 98);
    const balance1 = await card.balanceOf.call(ownerList[1]);
    assert.equal(balance1.toNumber(), 2);

    // bidInfoの内容が変化している
    const bidInfoPrices = await card.getBidInfoPrices.call();
    const bidInfoAddr = await card.bidInfos.call(bidInfoPrices[0]);
    // contractがethを保持していない
    assert.equal(web3.eth.getBalance(bidInfoAddr).toNumber(), 0);

    const bidInfo = await BidInfo.at(bidInfoAddr);
    const [ buyer, quantity ] = await bidInfo.bidInfoProps(0);

    // buyerは削除されている
    assert.equal(buyer, 0);
    // quantityが正しいか
    assert.equal(quantity.toNumber(), 0);

    // endedが正しいか
    // const ended = await bidInfo.ended();
    // assert.isTrue(ended);
  });

  // 買い注文に対して売る
  // 買い注文の数量がのこる場合
  it("testing 'acceptBid' OK2", async () => {
    const card = await Card.new('cardName', 100, 'imageHash123', accounts[0]);
    // 2枚 1枚あたり1Eth の買い注文を作成
    await card.bid(2, toWei(0.1), { from: accounts[1], value: toWei(0.2) });

    // bidInfoを取得
    const bidInfoPrices = await card.getBidInfoPrices.call();
    let bidInfoAddr = await card.bidInfos.call(bidInfoPrices[0]);
    // balance, price が正しいか
    let bidInfo = await BidInfo.at(bidInfoAddr);
    assert.equal(web3.eth.getBalance(bidInfoAddr).toNumber(), toWei(0.2));
    assert.equal(await bidInfo.price(), toWei(0.1));

    // 1枚売る
    await card.acceptBid(toWei(0.1), 1);

    // 所有数が変化している
    const ownerList = await card.getOwnerList();
    assert.lengthOf(ownerList, 2);
    const balance0 = await card.balanceOf.call(ownerList[0]);
    assert.equal(balance0.toNumber(), 99);
    const balance1 = await card.balanceOf.call(ownerList[1]);
    assert.equal(balance1.toNumber(), 1);

    // bidInfoの内容が変化している
    bidInfoAddr = await card.bidInfos.call(bidInfoPrices[0]);
    bidInfo = await BidInfo.at(bidInfoAddr);
    const [ buyer, quantity ] = await bidInfo.bidInfoProps(0);
    // buyer が 正しいか
    assert.equal(buyer, accounts[1]);
    // quantityが正しいか
    assert.equal(quantity.toNumber(), 1);
  });

  // 買い注文に対して売る
  // 複数の買い注文
  it("testing 'acceptBid' OK3", async () => {
    const card = await Card.new('cardName', 100, 'imageHash123', accounts[0]);

    const sellerBalance0 =  web3.eth.getBalance(accounts[0]);
    const buyer1Balance0 =  web3.eth.getBalance(accounts[1]);
    const buyer2Balance0 =  web3.eth.getBalance(accounts[2]);

    // 2枚 1枚あたり1Eth の買い注文を作成
    const tx1 = await card.bid(4, toWei(0.1), { from: accounts[1], value: toWei(0.4) });
    const gas1 = getGas(tx1);
    const tx2 = await card.bid(5, toWei(0.1), { from: accounts[2], value: toWei(0.5) });
    const gas2 = getGas(tx2);
    const tx3 = await card.bid(6, toWei(0.1), { from: accounts[1], value: toWei(0.6) });
    const gas3 = getGas(tx3);

    // ▽金額チェック------------------------------------------------------------
    const buyer1Balance1 = web3.eth.getBalance(accounts[1]);
    assert.equal(buyer1Balance1.toNumber(),
      buyer1Balance0
        .minus(web3.toBigNumber(gas1))
        .minus(web3.toBigNumber(gas3))
        .minus(web3.toBigNumber(toWei(0.4) + toWei(0.6))).toNumber()
    );
    const buyer2Balance1 = web3.eth.getBalance(accounts[2]);
    assert.equal(buyer2Balance1.toNumber(),
      buyer2Balance0
        .minus(web3.toBigNumber(gas2))
        .minus(web3.toBigNumber(toWei(0.5))).toNumber()
    );
    // △金額チェック------------------------------------------------------------

    // bidInfoを取得
    const bidInfoPrices = await card.getBidInfoPrices.call();
    let bidInfoAddr = await card.bidInfos.call(bidInfoPrices[0]);
    // balance, price が正しいか
    let bidInfo = await BidInfo.at(bidInfoAddr);
    assert.equal(web3.eth.getBalance(bidInfoAddr).toNumber(), toWei(1.5));
    assert.equal(await bidInfo.price(), toWei(0.1));

    // 1枚売る
    const tx4 = await card.acceptBid(toWei(0.1), 1);
    const gas4 = getGas(tx4);

    // ▽金額チェック------------------------------------------------------------
    const sellerBalance1 =  web3.eth.getBalance(accounts[0]);
    assert.equal(sellerBalance1.toNumber(),
      sellerBalance0
        .minus(web3.toBigNumber(gas4))
        .plus(web3.toBigNumber(toWei(0.1))).toNumber()
    );
    // △金額チェック------------------------------------------------------------

    // 所有数が変化している
    let ownerList = await card.getOwnerList();
    assert.lengthOf(ownerList, 2);
    let balance0 = await card.balanceOf.call(ownerList[0]);
    assert.equal(balance0.toNumber(), 99);
    let balance1 = await card.balanceOf.call(ownerList[1]);
    assert.equal(balance1.toNumber(), 1);

    // bidInfoの内容が変化している
    bidInfoAddr = await card.bidInfos.call(bidInfoPrices[0]);
    bidInfo = await BidInfo.at(bidInfoAddr);
    let [ buyer, quantity ] = await bidInfo.bidInfoProps(0);
    assert.equal(buyer, accounts[1]);
    assert.equal(quantity.toNumber(), 3);
    [ buyer, quantity ] = await bidInfo.bidInfoProps(1);
    assert.equal(buyer, accounts[2]);
    assert.equal(quantity.toNumber(), 5);
    [ buyer, quantity ] = await bidInfo.bidInfoProps(2);
    assert.equal(buyer, accounts[1]);
    assert.equal(quantity.toNumber(), 6);
    // balaceは残る
    assert.equal(web3.eth.getBalance(bidInfoAddr), toWei(1.4));


    // 購入者を跨ぐ場合
    // 10枚売る
    const tx5 = await card.acceptBid(toWei(0.1), 10);
    const gas5 = getGas(tx5);

    // ▽金額チェック------------------------------------------------------------
    const sellerBalance2 =  web3.eth.getBalance(accounts[0]);
    assert.equal(sellerBalance2.toNumber(),
      sellerBalance1
        .minus(web3.toBigNumber(gas5))
        .plus(web3.toBigNumber(toWei(1.0))).toNumber()
    );
    // △金額チェック------------------------------------------------------------

    // 所有数が変化している
    ownerList = await card.getOwnerList();
    assert.lengthOf(ownerList, 3);
    balance0 = await card.balanceOf.call(ownerList[0]);
    assert.equal(balance0.toNumber(), 89);
    balance1 = await card.balanceOf.call(ownerList[1]);
    assert.equal(balance1.toNumber(), 6);
    let balance2 = await card.balanceOf.call(ownerList[2]);
    assert.equal(balance2.toNumber(), 5);

    // bidInfoの内容が変化している
    bidInfoAddr = await card.bidInfos.call(bidInfoPrices[0]);
    bidInfo = await BidInfo.at(bidInfoAddr);
    [ buyer, quantity ] = await bidInfo.bidInfoProps(0);
    assert.equal(buyer, 0);
    assert.equal(quantity.toNumber(), 0);
    [ buyer, quantity ] = await bidInfo.bidInfoProps(1);
    assert.equal(buyer, 0);
    assert.equal(quantity.toNumber(), 0);
    [ buyer, quantity ] = await bidInfo.bidInfoProps(2);
    assert.equal(buyer, accounts[1]);
    assert.equal(quantity.toNumber(), 4);
    // balaceは残る
    assert.equal(web3.eth.getBalance(bidInfoAddr), toWei(0.4));

    // 残りを取り消す
    const tx6 = await bidInfo.close({ from: accounts[1] });
    const gas6 = getGas(tx6);

    // ▽金額チェック------------------------------------------------------------
    const buyer1Balance2 = web3.eth.getBalance(accounts[1]);
    assert.equal(buyer1Balance2.toNumber(),
      buyer1Balance1
        .minus(web3.toBigNumber(gas6))
        .plus(web3.toBigNumber(toWei(0.4))).toNumber()
    );
    const buyer2Balance2 = web3.eth.getBalance(accounts[2]);
    assert.equal(buyer2Balance2.toNumber(), buyer2Balance1.toNumber());
    // △金額チェック------------------------------------------------------------

    // bidInfoの内容が変化している
    [ buyer, quantity ] = await bidInfo.bidInfoProps(2);
    // bidInfoPropがdeleteされている
    assert.equal(buyer, 0);
    assert.equal(quantity.toNumber(), 0);
    // balaceも残らない
    assert.equal(web3.eth.getBalance(bidInfoAddr), 0);

  });

  // 買い注文に対して売る 所有数を超えて売ろうとする
  it("testing 'acceptBid' NG. exceeds card number limit", async () => {
    const card = await Card.new('cardName', 1, 'imageHash123', accounts[0]);
    // 1枚 1枚あたり1Eth の買い注文を作成
    await card.bid(1, toWei(0.1), { from: accounts[1], value: toWei(0.1) });
    // 2枚売ろうとする
    await expectThrow(card.acceptBid(toWei(0.1), 2));
  });

  // 買い注文に対して売る 提示しているカード以上売ろうとする
  it("testing 'acceptBid' NG. exceeds biding card number limit", async () => {
    const card = await Card.new('cardName', 10, 'imageHash123', accounts[0]);
    // 1枚 1枚あたり1Eth の買い注文を作成
    await card.bid(1, toWei(0.1), { from: accounts[1], value: toWei(0.1) });
    // 2枚売ろうとする
    await expectThrow(card.acceptBid(toWei(0.1), 2));
  });

  // 買い注文を閉じる、残高がのこらない
  it("testing 'BidInfo#close' OK", async () => {
    const card = await Card.new('cardName', 10, 'imageHash123', accounts[0]);
    // 1枚 1枚あたり1Eth の買い注文を作成
    const buyerBalance =  web3.eth.getBalance(accounts[1]);
    const tx = await card.bid(1, toWei(0.1), { from: accounts[1], value: toWei(0.1) });
    const gas = getGas(tx);

    // etherが減っている
    const buyerBalance1 = web3.eth.getBalance(accounts[1]);
    assert.equal(buyerBalance.minus(buyerBalance1).toNumber(), toWei(0.1) + gas);

    // 金額を指定し、削除
    const bidInfoPrices = await card.getBidInfoPrices.call();
    const bidInfoAddr = await card.bidInfos.call(bidInfoPrices[0]);
    const bidInfo = await BidInfo.at(bidInfoAddr);
    const tx2 = await bidInfo.close({ from: accounts[1] });
    const gas2 = getGas(tx2);

    // ethが戻る。ただしgas分は減る
    const newEther = buyerBalance1
      .plus(web3.toBigNumber(toWei(0.1)))
      .minus(web3.toBigNumber(gas2)).toNumber();
    const buyerBalance2 = web3.eth.getBalance(accounts[1]);
    assert.equal(buyerBalance2.toNumber(), newEther);

    // bidInfoの内容が変化している
    const [ buyer, quantity ] = await bidInfo.bidInfoProps(0);
    // bidInfoPropがdeleteされている
    assert.equal(buyer, 0);
    assert.equal(quantity.toNumber(), 0);

    // balaceも残らない
    assert.equal(web3.eth.getBalance(bidInfoAddr), 0);
  });

  // 買い注文を閉じたとき、残高がのこる
  it("testing 'BidInfo#close', when left balance. OK", async () => {
    const card = await Card.new('cardName', 10, 'imageHash123', accounts[0]);

    await card.bid(3, toWei(0.1), { from: accounts[1], value: toWei(0.3) });
    // 別のユーザが買い注文を作成
    await card.bid(4, toWei(0.1), { from: accounts[2], value: toWei(0.4) });

    // 金額を指定し、削除
    const bidInfoPrices = await card.getBidInfoPrices.call();
    const bidInfoAddr = await card.bidInfos.call(bidInfoPrices[0]);
    const bidInfo = await BidInfo.at(bidInfoAddr);

    await bidInfo.close({ from: accounts[1] });

    // bidInfoの内容が変化している
    const [ buyer, quantity ] = await bidInfo.bidInfoProps(0);
    // bidInfoPropがdeleteされている
    assert.equal(buyer, 0);
    assert.equal(quantity.toNumber(), 0);

    // balaceは残る
    assert.equal(web3.eth.getBalance(bidInfoAddr), toWei(0.4));
  });

  // 買い注文を閉じたとき、残高がのこる
  // 複数の買い注文が取り消されるされるとき
  it("testing 'BidInfo#close', when left balance. OK 2", async () => {
    const card = await Card.new('cardName', 10, 'imageHash123', accounts[0]);

    // 買い注文を２つ作る
    await card.bid(3, toWei(0.1), { from: accounts[1], value: toWei(0.3) });
    await card.bid(3, toWei(0.1), { from: accounts[1], value: toWei(0.3) });
    // 別のユーザが買い注文を作成
    await card.bid(4, toWei(0.1), { from: accounts[2], value: toWei(0.4) });

    // 金額を指定し、削除
    const bidInfoPrices = await card.getBidInfoPrices.call();
    const bidInfoAddr = await card.bidInfos.call(bidInfoPrices[0]);
    const bidInfo = await BidInfo.at(bidInfoAddr);

    await bidInfo.close({ from: accounts[1] });

    // bidInfoの内容が変化している
    let [ buyer, quantity ] = await bidInfo.bidInfoProps(0);
    // bidInfoPropがdeleteされている
    assert.equal(buyer, 0);
    assert.equal(quantity.toNumber(), 0);
    [ buyer, quantity ] = await bidInfo.bidInfoProps(1);
    assert.equal(buyer, 0);
    assert.equal(quantity.toNumber(), 0);
    [ buyer, quantity ] = await bidInfo.bidInfoProps(2);
    assert.equal(buyer, accounts[2]);
    assert.equal(quantity.toNumber(), 4);

    // balaceは残る
    assert.equal(web3.eth.getBalance(bidInfoAddr), toWei(0.4));
  });

  // 買い注文が存在しないとき、買い注文を閉じようとする
  it("testing 'BidInfo#close' twice OK", async () => {
    const card = await Card.new('cardName', 10, 'imageHash123', accounts[0]);

    await card.bid(1, toWei(0.1), { from: accounts[1], value: toWei(0.1) });

    // 金額を指定し、削除
    const bidInfoPrices = await card.getBidInfoPrices.call();
    const bidInfoAddr = await card.bidInfos.call(bidInfoPrices[0]);
    const bidInfo = await BidInfo.at(bidInfoAddr);

    await bidInfo.close({ from: accounts[1] });

    // bidInfoの内容が変化している
    const [ buyer, quantity ] = await bidInfo.bidInfoProps(0);
    // bidInfoPropがdeleteされている
    assert.equal(buyer, 0);
    assert.equal(quantity.toNumber(), 0);

    // 再度削除してもなにも起きない
    await bidInfo.close({ from: accounts[1] });
  });
});

