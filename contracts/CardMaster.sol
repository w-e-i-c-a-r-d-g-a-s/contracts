pragma solidity ^0.4.15;
import "./Card.sol";

// カードマスター
contract CardMaster {
    // アドレスを管理する配列
    address[] private cardAddresses;

    event CreateCard(address cardAddress);
    /**
     * CardのContractを配列とマップに追加
     */
    function addCard(bytes32 _name, uint32 _totalSupply, bytes32 _imageHash) {
        Card card = new Card(_name, _totalSupply, _imageHash, msg.sender);
        cardAddresses.push(address(card));
        CreateCard(address(card));
    }

    /**
     * カードのアドレスの配列取得
     */
    function getCardAddresses() constant returns (address[]) {
        return cardAddresses;
    }

    /**
     * カードを取得
     */
    function getCard(address cardAddress) constant returns (Card) {
        return Card(cardAddress);
    }

    /**
     * カードを設定
     * マイグレーション用
     */
    function setCard(address cardAddress) {
        cardAddresses.push(cardAddress);
    }
}
