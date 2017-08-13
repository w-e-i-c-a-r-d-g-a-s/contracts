pragma solidity ^0.4.13;
import "./Card.sol";

// カードマスター
contract CardMaster {
    // CardのContractのリスト
    mapping(address => Card) private cards;
    // アドレスを管理する配列
    address[] private cardAddresses;

    /**
     * CardのContractを配列とマップに追加
     */
    function addCard(bytes32 _name, uint _issued, bytes32 _imageHash) returns (address) {
        Card card = new Card(_name, _issued, _imageHash, msg.sender);
        cardAddresses.push(address(card));
        cards[address(card)] = card;
        // 履歴用にアドレスを返す
        return address(card);
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
        Card c = cards[cardAddress];
        return c;
    }
}
