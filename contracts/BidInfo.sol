pragma solidity ^0.4.13;

/**
 * 買い注文のContract
 */
contract BidInfo {
    uint public price; // weiで指定

    bool public ended; // 現状未使用

    // 購入者と数量の構造体
    struct BidInfoProp {
        address buyer;
        uint32 quantity;
    }
    BidInfoProp[] public bidInfoProps;

    function BidInfo(address _buyer, uint32 _quantity, uint128 _price) payable {
        price = _price;
        add(_buyer, _quantity);
    }

    /**
     * Fallback Function
     */
    function() payable {}

    /**
     * （同一金額の）新たな売り注文を追加
     * @param _buyer 購入者
     * @param _quantity 数量
     */
    function add(address _buyer, uint32 _quantity) {
        bidInfoProps.push(BidInfoProp(_buyer, _quantity));
    }

    /**
     * bidInfoPropsの要素数を返す
     * @return bidInfoPropsの要素数
     */
    function getBidInfoPropsCount() constant returns (uint){
        return bidInfoProps.length;
    }

    /**
     * bidInfoPropの要素を返す
     */
    function getBidInfoProps(uint idx) constant returns (address, uint32){
        BidInfoProp storage b = bidInfoProps[idx];
        return (b.buyer, b.quantity);
    }

    /**
     * bidInfoPropのquantityを更新
     * @param idx bidInfoPropsの要素番号
     * @param _quantity 更新する数量
     */
    function updateBidInfoProps(uint idx, uint32 _quantity) {
        bidInfoProps[idx].quantity = _quantity;
    }

    /**
     * bidInfoPropの要素を削除
     */
    function deleteBidInfoProps(uint idx) {
        delete bidInfoProps[idx];
    }

    /**
     * このcontract内のお金を送金する
     * @param _seller 売却者
     * @param _quantity 数量
     */
    function transfer(address _seller, uint32 _quantity) payable {
        _seller.transfer(price * _quantity);
    }

    /**
     * オークション終了.
     * 作成者のみ終了可能.
     */
    function close() {
        for(uint i = 0; i < bidInfoProps.length; i++){
            BidInfoProp storage b = bidInfoProps[i];
            if(msg.sender == b.buyer){
                b.buyer.transfer(price * b.quantity);
                deleteBidInfoProps(i);
            }
        }
    }

}
