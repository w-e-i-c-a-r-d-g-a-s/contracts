pragma solidity ^0.4.13;
import "./Card.sol";

// カードマスター
contract CardMaster {
    // CardのContractのリスト
    mapping(address => Card) private cards;
    // アドレスを管理する配列
    address[] private cardAddresses;

    event CreateCard(address cardAddress);
    /**
     * CardのContractを配列とマップに追加
     */
    function addCard(bytes32 _name, uint _totalSupply, bytes32 _imageHash) {
        Card card = new Card(_name, _totalSupply, _imageHash, msg.sender);
        address cardAddress = address(card);
        cardAddresses.push(cardAddress);
        cards[cardAddress] = card;
        CreateCard(cardAddress);
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
