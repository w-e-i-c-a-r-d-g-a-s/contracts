pragma solidity ^0.4.13;
import "./BuyOrder.sol";

contract Card {
    // カード属性など
    bytes32 public name;
    uint public totalSupply;
    bytes32 public imageHash;
    address public author;

    // 誰が何枚持っているか
    mapping(address => uint) public owns;
    // [Tips]動的配列はpublicで参照できない
    address[] private addressList;

    event Debug(string);
    event Debug_i(uint);
    event Debug(address c);

    /**
    * 指定数のカードを所有しているユーザーのみ
    */
    modifier onlyOwn(uint16 _quantity) { require(owns[msg.sender] > _quantity); _; }

    function Card(bytes32 _name, uint _issued, bytes32 _imageHash, address _author){
        name = _name;
        // author = msg.sender; // カードのコントラクトになってしまう
        author = _author;
        totalSupply = _issued;
        imageHash = _imageHash;
        addressList.push(author);
        owns[author] = totalSupply;
    }

    /**
    * カードを送る 
    */
    function send(address to, uint16 quantity) onlyOwn (quantity) {

        address from = msg.sender;

        if(!isAlreadyOwner(to)){
            // 初オーナー
            addressList.push(to);
        }
        owns[from] -= quantity;
        owns[to] += quantity;
    }

    /**
    * ownerのアドレスの配列取得
    */
    function getOwnerList() constant returns (address[] ownerAddressList) {
        ownerAddressList = addressList;
    }

    // 売る
    struct SellInfo {
        address from;
        uint quantity;
        uint price; // weiで指定
        bool active;
    }
    SellInfo[] public sellInfos;

    // Sellデータを作成
    function sellOrder(uint quantity, uint price){
        sellInfos.push(SellInfo(msg.sender, quantity, price, true));
    }

    // SellInfosの数を変える
    function sellInfosLength() constant returns (uint){
        return sellInfos.length;
    }

    // 買う
    function buy(uint idx) payable {

        SellInfo s = sellInfos[idx];
        Debug_i(s.quantity);
        Debug_i(s.price);
        Debug_i(msg.value); // wei

        //入力金額の正当性チェック
        require(msg.value == s.quantity * s.price);

        //有効チェック
        require(s.active);

        address from = s.from;
        address to = msg.sender;
        uint quantity = s.quantity;
        // uint price = s.price;

        bool alreadyOwner = isAlreadyOwner(to);

        if(!alreadyOwner){
            // 初オーナー
            addressList.push(to);
        }
        owns[from] -= quantity;
        owns[to] += quantity;
        s.active = false;
        s.from.transfer(this.balance);
    }

    function isAlreadyOwner(address addr) returns (bool){
        bool isAlready = false;
        // 既にオーナーかどうか（もっといい方法ないかな？）
        for(uint i; i < addressList.length; i++){
            if(addressList[i] == addr){
                isAlready = true;
            }
        }
        return isAlready;
    }

    /**
    * 売り注文を終了する
    */
    function closeSellOrder(uint idx){
        delete sellInfos[idx];
    }

    /**
    * 買い注文リスト
    */
    BuyOrder[] public buyOrders;

    /**
     *  買い注文リストの要素数を返す
     */
    function getBuyOrdersCount() constant returns (uint){
        return buyOrders.length;
    }

    /**
     * 買い注文作成
     */
    function createBuyOrder(uint16 _quantity, uint _etherPrice) payable {
        //TODO:本番ではetherではなくweiを引数に渡す
        uint weiPrice = _etherPrice * 1 ether;
        require(msg.value == _quantity * weiPrice);
        BuyOrder buyOrder = new BuyOrder(msg.sender, _quantity, weiPrice);
        buyOrder.transfer(msg.value);
        buyOrders.push(buyOrder);
    }

    /**
     * 買い注文に対して売る.
     */
    function sell(uint idx, uint16 quantity) payable {
        address seller = msg.sender;
        address buyer = buyOrders[idx].buyer();
        require(owns[seller] >= quantity);
        buyOrders[idx].sell(seller, quantity);
        owns[seller] = owns[seller] - quantity;
        owns[buyer] = owns[buyer] + quantity;
        bool alreadyOwner = isAlreadyOwner(buyer);
        if(!alreadyOwner){
            // 初オーナー
            addressList.push(buyer);
        }
    }
}
