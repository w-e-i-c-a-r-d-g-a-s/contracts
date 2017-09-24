const Web3 = require('web3');
const web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));
const toWei = require('../helpers/toWei');
const getGas = require('../helpers/getGas');
const expectThrow = require('../helpers/expectThrow');

const Card = artifacts.require("./Card.sol");

contract('Card#Ask', (accounts) => {
  // 売り注文発行したときの売り注文のリストが正しいか
  it("testing 'getAskInfosCount'", async () => {
    const card = await Card.new('cardName', 100, 'imageHash123', accounts[0]);
    const num = await card.getAskInfoPricesCount.call();
    // 売り注文は0
    assert.equal(num.toNumber(), 0);
    // 売り注文を発行
    await card.ask(1, 1);
    // 売り注文が増える
    const num1 = await card.getAskInfoPricesCount.call();
    assert.equal(num1.toNumber(), 1);
    const askInfoPrices = await card.getAskInfoPrices.call();
    // bytes16が保存されている
    assert.equal(
      askInfoPrices[0],
      '0x00000000000000000000000000000001'
    );
    // 同一金額で売り注文を再発行してもキーの数は変わらないこと
    await card.ask(1, 1);
    const aiPC = await card.getAskInfoPricesCount.call();
    assert.equal(aiPC.toNumber(), 1);
  });

  // 売り注文発行したときの売り注文のデータが正しいか
  it("testing 'ask'", async () => {
    const card = await Card.new('cardName', 100, 'imageHash123', accounts[0]);
    // 売り注文を発行
    await card.ask(10, toWei(0.1));
    // 生成された売り注文をチェック
    const askInfoPrices = await card.getAskInfoPrices.call();
    assert.equal(
      askInfoPrices[0],
      '0x0000000000000000016345785d8a0000'
    );
    const askInfo = await card.askInfos.call(askInfoPrices[0], 0);
    const [ from, quantity ] = askInfo;
    assert.equal(from, accounts[0]);
    assert.equal(quantity.toNumber(), 10);
    assert.equal(web3.toHex(askInfoPrices[0]), toWei(0.1));
  });

  // 同じ金額の売り注文を複数発行したときの売り注文のデータが正しいか
  it("testing multiple 'ask'", async () => {
    const card = await Card.new('cardName', 100, 'imageHash123', accounts[0]);
    // 売り注文を発行
    await card.ask(10, toWei(0.1));
    await card.ask(5, toWei(0.1));
    // 生成された売り注文をチェック
    const askInfoPrices = await card.getAskInfoPrices.call();
    const askInfo1 = await card.askInfos.call(askInfoPrices[0], 0);
    const askInfo2 = await card.askInfos.call(askInfoPrices[0], 1);

    assert.equal(web3.toDecimal(askInfoPrices[0]), toWei(0.1));

    const [ from, quantity ] = askInfo1;
    assert.equal(from, accounts[0]);
    assert.equal(quantity.toNumber(), 10);

    // 2つめの売り注文
    assert.equal(askInfo2[0], accounts[0]);
    assert.equal(askInfo2[1].toNumber(), 5);
  });

  // 別の金額として売り注文を複数発行したときの売り注文のデータが正しいか
  it("testing multiple 'ask'2", async () => {
    const card = await Card.new('cardName', 4294967295, 'imageHash123', accounts[0]);
    const ts = await card.totalSupply.call();
    // uint32の最大数まで保持できる（これ以上だとオーバフローし、1とか0になる）
    assert.equal(ts, 4294967295);
    // 売り注文を発行
    await card.ask(4294967295, toWei(0.1));
    await card.ask(5, toWei(20000));
    // 生成された売り注文をチェック
    const askInfoPrices = await card.getAskInfoPrices.call();
    const askInfo1 = await card.askInfos.call(askInfoPrices[0], 0);
    const askInfo2 = await card.askInfos.call(askInfoPrices[1], 0);

    assert.equal(web3.toDecimal(askInfoPrices[0]), toWei(0.1));
    assert.equal(web3.toDecimal(askInfoPrices[1]), toWei(20000));

    const [ from, quantity ] = askInfo1;
    assert.equal(from, accounts[0]);
    assert.equal(quantity.toNumber(), 4294967295);

    // 2つめの売り注文
    assert.equal(askInfo2[0], accounts[0]);
    assert.equal(askInfo2[1].toNumber(), 5);
  });

  // 売り注文を買う OKケース
  it("testing 'acceptAsk' OK", async () => {
    const card = await Card.new('cardName', 100, 'imageHash123', accounts[0]);
    // 売り注文を発行 10枚 1枚あたり0.1ETH
    await card.ask(10, toWei(0.1));
    // Ether額
    const ownerBalance = web3.eth.getBalance(accounts[0]);
    const visitorBalance = web3.eth.getBalance(accounts[1]);

    // 売り注文を買う
    const tx = await card.acceptAsk(toWei(0.1), 10, {from: accounts[1], value: toWei(1)});
    const gas = getGas(tx);

    // Ether額が変化しているか
    const ownerBalance1 = web3.eth.getBalance(accounts[0]);
    const visitorBalance1 = web3.eth.getBalance(accounts[1]);
    // 1Eth分増えている
    assert.equal(ownerBalance1.minus(ownerBalance).toNumber(), toWei(1));
    // 1Eth + fee 分減っている
    assert.equal(visitorBalance.minus(visitorBalance1).toNumber(), toWei(1) + gas);

    // オーナーリストに追加されている
    const ownerList = await card.getOwnerList.call();
    assert.lengthOf(ownerList, 2);
    assert.equal(ownerList[1], accounts[1]);
    // 所有数が変化している
    const balance0 = await card.balanceOf.call(ownerList[0]);
    const balance1 = await card.balanceOf.call(ownerList[1]);
    assert.equal(balance0.toNumber(), 90);
    assert.equal(balance1.toNumber(), 10);
    // 0になっている
    const askInfoPrices = await card.getAskInfoPrices.call();
    const askInfo = await card.askInfos.call(askInfoPrices[0], 0);
  });

  // 売り注文を買う OKケース（数量を指定して買う）
  it("testing 'acceptAsk' OK2 number specified", async () => {
    const card = await Card.new('cardName', 100, 'imageHash123', accounts[0]);
    // 売り注文を発行 10枚 1枚あたり0.1ETH
    await card.ask(10, toWei(0.1));
    // Ether額
    const ownerBalance = web3.eth.getBalance(accounts[0]);
    const visitorBalance = web3.eth.getBalance(accounts[1]);

    // 売り注文を買う
    const tx = await card.acceptAsk(toWei(0.1), 5, {from: accounts[1], value: toWei(0.5)});
    const gas = getGas(tx);

    // Ether額が変化しているか
    const ownerBalance1 = web3.eth.getBalance(accounts[0]);
    const visitorBalance1 = web3.eth.getBalance(accounts[1]);
    // 取引Eth分増えている
    assert.equal(ownerBalance1.minus(ownerBalance).toNumber(), toWei(0.5));
    // 取引Eth + fee 分減っている
    assert.equal(visitorBalance.minus(visitorBalance1).toNumber(), toWei(0.5) + gas);

    // オーナーリストに追加されている
    const ownerList = await card.getOwnerList.call();
    assert.lengthOf(ownerList, 2);
    assert.equal(ownerList[1], accounts[1]);
    // 所有数が変化している
    const balance0 = await card.balanceOf.call(ownerList[0]);
    const balance1 = await card.balanceOf.call(ownerList[1]);
    assert.equal(balance0.toNumber(), 95);
    assert.equal(balance1.toNumber(), 5);

    const askInfoPrices = await card.getAskInfoPrices.call();
    const askInfo = await card.askInfos.call(askInfoPrices[0], 0);
    // 枚数が変わっている
    assert.equal(askInfo[1].toNumber(), 5);
  });

  // 売り注文を買う OKケース オーナーになっている場合
  it("testing 'acceptAsk' OK already owner", async () => {
    const card = await Card.new('cardName', 100, 'imageHash123', accounts[0]);
    // 売り注文を発行 10枚 1枚あたり0.1ETH
    await card.ask(10, toWei(0.1));
    await card.ask(5, toWei(0.1));
    // 売り注文を買う
    await card.acceptAsk(toWei(0.1), 10, {from: accounts[1], value: toWei(1)});
    let ownerList = await card.getOwnerList.call();
    assert.lengthOf(ownerList, 2);
    assert.equal(ownerList[1], accounts[1]);

    // もう一度同じユーザが買う
    await card.acceptAsk(toWei(0.1), 5, {from: accounts[1], value: toWei(0.5)});
    ownerList = await card.getOwnerList.call();
    assert.lengthOf(ownerList, 2);
    assert.equal(ownerList[1], accounts[1]);

    // 所有数が変化している
    const balance0 = await card.balanceOf.call(ownerList[0]);
    const balance1 = await card.balanceOf.call(ownerList[1]);
    assert.equal(balance0.toNumber(), 85);
    assert.equal(balance1.toNumber(), 15);
  });

  it("testing 'acceptAsk' OK split buy 1", async () => {
    // 売り注文を買う 複数オーナーから分けて買う（端数が余らない場合）
    const card = await Card.new('cardName', 100, 'imageHash123', accounts[0]);
    // 売り注文を発行 10枚 1枚あたり0.1ETH
    await card.ask(10, toWei(0.1));
    // 売り注文を買う
    await card.acceptAsk(toWei(0.1), 10, {from: accounts[1], value: toWei(1)});

    // 売り注文を再度発行
    await card.ask(1, toWei(0.1));
    await card.ask(2, toWei(0.1), {from: accounts[1]});

    const askInfoPrices = await card.getAskInfoPrices.call();
    const askInfo1 = await card.askInfos.call(askInfoPrices[0], 2);
    const [ from, quantity ] = askInfo1;
    assert.equal(from, accounts[1]);
    assert.equal(quantity.toNumber(), 2);

    await card.acceptAsk(toWei(0.1), 3, {from: accounts[2], value: toWei(0.3)});

    const ownerList = await card.getOwnerList.call();
    // 所有数が変化している
    const balance0 = await card.balanceOf.call(ownerList[0]);
    const balance1 = await card.balanceOf.call(ownerList[1]);
    const balance2 = await card.balanceOf.call(ownerList[2]);
    assert.equal(balance0.toNumber(), 89);
    assert.equal(balance1.toNumber(), 8);
    assert.equal(balance2.toNumber(), 3);
  });

  // 売り注文を買う 複数オーナーから分けて買う（端数が余る場合）
  it("testing 'acceptAsk' OK split buy 2", async () => {
    // 売り注文を買う 複数オーナーから分けて買う（端数が余らない場合）
    const card = await Card.new('cardName', 100, 'imageHash123', accounts[0]);
    // 売り注文を発行 10枚 1枚あたり0.1ETH
    await card.ask(10, toWei(0.1));
    // 売り注文を買う
    await card.acceptAsk(toWei(0.1), 10, {from: accounts[1], value: toWei(1)});

    // 売り注文を再度発行
    // account0 => 1枚、
    // account0 => 1枚(追加分）
    // account1 => 2枚 発行し、
    // account2 が 2枚買う
    await card.ask(1, toWei(0.1));
    await card.ask(1, toWei(0.1));
    await card.ask(2, toWei(0.1), {from: accounts[1]});

    const askInfoPrices = await card.getAskInfoPrices.call();
    const askInfo1 = await card.askInfos.call(askInfoPrices[0], 3);
    const [ from, quantity ] = askInfo1;
    assert.equal(from, accounts[1]);
    assert.equal(quantity.toNumber(), 2);

    await card.acceptAsk(toWei(0.1), 3, {from: accounts[2], value: toWei(0.3)});

    const ownerList = await card.getOwnerList.call();
    // 所有数が変化している
    const balance0 = await card.balanceOf.call(ownerList[0]);
    const balance1 = await card.balanceOf.call(ownerList[1]);
    const balance2 = await card.balanceOf.call(ownerList[2]);
    assert.equal(balance0.toNumber(), 88);
    assert.equal(balance1.toNumber(), 9);
    assert.equal(balance2.toNumber(), 3);

    // 最後の売り注文が残っている状態である
    const askInfo0_ = await card.askInfos.call(askInfoPrices[0], 0);
    const askInfo1_ = await card.askInfos.call(askInfoPrices[0], 1);
    const askInfo2_ = await card.askInfos.call(askInfoPrices[0], 2);
    const askInfo3_ = await card.askInfos.call(askInfoPrices[0], 3);
    assert.equal(askInfo0_[0], 0x0);
    assert.equal(askInfo0_[1].toNumber(), 0);
    assert.equal(askInfo1_[0], 0x0);
    assert.equal(askInfo1_[1].toNumber(), 0);
    assert.equal(askInfo2_[0], 0);
    assert.equal(askInfo2_[1].toNumber(), 0);
    assert.equal(askInfo3_[0], accounts[1]);
    assert.equal(askInfo3_[1].toNumber(), 1);
  });

  // 売り注文を買う NGケース 有効でないask（購入済み）
  it("testing 'acceptAsk' NG1-1", async () => {
    const card = await Card.new('cardName', 100, 'imageHash123', accounts[0]);
    // 売り注文を発行 10枚 1枚あたり0.1ETH
    await card.ask(10, toWei(0.1));
    // 存在しない売り注文を買う
    await expectThrow(card.acceptAsk(toWei(0.2), 10, {from: accounts[1], value: toWei(2)}));
  });

  // 売り注文を買う NGケース 有効でないask（存在しない）
  it("testing 'acceptAsk' NG1-1", async () => {
    const card = await Card.new('cardName', 100, 'imageHash123', accounts[0]);
    // 売り注文を発行 10枚 1枚あたり0.1ETH
    await card.ask(10, toWei(0.1));
    // 存在しない売り注文を買う
    await expectThrow(card.acceptAsk(toWei(0.2), 10, {from: accounts[1], value: toWei(2)}));
  });

  // 売り注文を買う NGケース 有効でないask（売り切れ）
  it("testing 'acceptAsk' NG1-2", async () => {
    const card = await Card.new('cardName', 100, 'imageHash123', accounts[0]);
    // 売り注文を発行 10枚 1枚あたり0.1ETH
    await card.ask(10, toWei(0.1));
    // 存在しない売り注文を買う
    await card.acceptAsk(toWei(0.1), 10, {from: accounts[1], value: toWei(1)});

    const askInfoPrices = await card.getAskInfoPrices.call();
    const askInfo1 = await card.askInfos.call(askInfoPrices[0], 0);
    const [ from, quantity ] = askInfo1;
    // 販売枚数は0
    assert.equal(quantity, 0);
    // 存在しない売り注文を買う
    await expectThrow(card.acceptAsk(toWei(0.1), 1, {from: accounts[1], value: toWei(0.1)}));
  });

  // 売り注文を買う NGケース 入力金額が正しくない
  it("testing 'acceptAsk' NG2", async () => {
    const card = await Card.new('cardName', 100, 'imageHash123', accounts[0]);
    // 売り注文を発行 10枚 1枚あたり0.1ETH
    await card.ask(10, toWei(0.1));
    // 間違ったEtherで売り注文を買う
    await expectThrow(card.acceptAsk(toWei(0.1), 10, {from: accounts[1], value: toWei(1.1)}));
  });

  // 売り注文を買う NGケース 枚数が正しくない
  it("testing 'acceptAsk' NG3 not enough quantity", async () => {
    const card = await Card.new('cardName', 100, 'imageHash123', accounts[0]);
    // 売り注文を発行 10枚 1枚あたり0.1ETH
    await card.ask(10, toWei(0.1));
    // 間違ったEtherで売り注文を買う
    await expectThrow(card.acceptAsk(toWei(0.1), 9, {from: accounts[1], value: toWei(1)}));
  });

  // 売り注文を買う NGケース 複数買いの枚数オーバー
  it("testing 'acceptAsk' NG3 too many quantity", async () => {
    const card = await Card.new('cardName', 100, 'imageHash123', accounts[0]);
    // 売り注文を発行 10枚 1枚あたり0.1ETH
    await card.ask(10, toWei(0.1));
    await card.ask(5, toWei(0.1));
    // 枚数オーバーの場合balanceが0にならずrevertされる
    await expectThrow(card.acceptAsk(toWei(0.1), 16, {from: accounts[1], value: toWei(1.6)}));
  });
});

