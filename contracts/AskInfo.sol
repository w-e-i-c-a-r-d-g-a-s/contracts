pragma solidity ^0.4.13;

/**
 * 買い注文のContract
 */
contract AskInfo {
    address public buyer;
    uint public value;
    uint16 public quantity;
    uint public price; // weiで指定

    bool public ended;

    event Debug_i(uint);

    function AskInfo(address _buyer, uint16 _quantity, uint256 _price) payable {
        buyer = _buyer;
        quantity = _quantity;
        price = _price;
        value = quantity * price;
    }

    /**
     * Fallback Function
     */
    function() payable {}

    /**
     * 販売.
     */
    function accept(address seller, uint16 _quantity) payable {
        require(!ended);
        //提示カード枚数以下
        require(quantity >= _quantity);
        //送付
        seller.transfer(price * _quantity);
        value = value - price * _quantity;

        quantity -= _quantity;
        //TODO:綺麗に割り切れない場合の救済
        if (value == 0) {
            ended = true;
        }
    }

    /**
     * オークション終了.
     * 作成者のみ終了可能.
     */
    function close() {
        require(msg.sender == buyer);
        buyer.transfer(value);
        value = 0;
        ended = true;
    }

}
