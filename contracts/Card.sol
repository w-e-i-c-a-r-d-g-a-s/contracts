pragma solidity ^0.4.13;
import "./BidInfo.sol";

contract Card {
    // カード属性など
    bytes32 public name;
    uint public totalSupply;
    bytes32 public imageHash;
    address public author;

    mapping(address => uint) public balanceOf; // 誰が何枚持っているか
    address[] private ownerList;             // カード所有者のアドレスリスト
    // [Tips]動的配列はpublicで参照できない

    // 売り注文
    struct AskInfo {
        address from;
        uint quantity;
        uint price; // weiで指定
        bool active;
    }
    AskInfo[] public askInfos;

    /**
     * 買い注文リスト
     */
    BidInfo[] public bidInfos;

    event Debug(string _val);
    event Debugi(uint _val);
    event Debug(address c);

    /**
     * 指定数のカードを所有しているユーザーのみ
     */
    modifier onlyOwn(uint16 _quantity) { require(balanceOf[msg.sender] >= _quantity); _; }

    /**
     * コンストラクタ
     */
    function Card(bytes32 _name, uint _totalSupply, bytes32 _imageHash, address _author){
        name = _name;
        author = _author;
        totalSupply = _totalSupply;
        imageHash = _imageHash;
        ownerList.push(author);
        balanceOf[author] = totalSupply;
    }

    /**
     * ownerのアドレスの配列取得
     */
    function getOwnerList() constant returns (address[]) {
        return ownerList;
    }

    /**
     * カードを送る
     */
    function deal(address to, uint16 quantity) onlyOwn (quantity) {
        address from = msg.sender;

        if (!isAlreadyOwner(to)) {
            // 初オーナー
            ownerList.push(to);
        }
        balanceOf[from] -= quantity;
        balanceOf[to] += quantity;
    }

    /**
     * @dev カードの売り注文を作成
     * @param quantity 売りたい枚数
     * @param price １枚あたりの価格(wei)
     */
    function ask(uint quantity, uint price) {
        askInfos.push(AskInfo(msg.sender, quantity, price, true));
    }

    /**
     * @dev 売り注文の数を返す
     * @return （無効なもの含む）売り注文の数
     */
    function getAskInfosCount() constant returns (uint){
        return askInfos.length;
    }

    /**
     * @dev 売り注文に対して買う
     * @param idx 売り注文のインデックス
     */
    function acceptAsk(uint idx) payable {
        AskInfo storage askInfo = askInfos[idx];

        address from = askInfo.from;
        address to = msg.sender;
        uint quantity = askInfo.quantity;
        uint price = askInfo.price;

        //有効チェック
        require(askInfo.active);
        //入力金額の正当性チェック
        require(msg.value == quantity * price);

        if (!isAlreadyOwner(to)) {
            // 初オーナー
            ownerList.push(to);
        }
        balanceOf[from] -= quantity;
        balanceOf[to] += quantity;
        askInfo.active = false;
        from.transfer(this.balance);
    }

    function isAlreadyOwner(address addr) returns (bool){
        bool isAlready = false;
        // 既にオーナーかどうか（もっといい方法ないかな？）
        for (uint i; i < ownerList.length; i++) {
            if (ownerList[i] == addr) {
                isAlready = true;
            }
        }
        return isAlready;
    }

    /**
     * 売り注文を終了する
     */
    function closeAsk(uint idx) {
        delete askInfos[idx];
    }

    /**
     *  買い注文リストの要素数を返す
     */
    function getBidInfosCount() constant returns (uint){
        return bidInfos.length;
    }

    /**
     * 買い注文作成
     */
    function bid(uint16 _quantity, uint256 _etherPrice) payable {
        //TODO:本番ではetherではなくweiを引数に渡す
        uint256 weiPrice = _etherPrice * 1 ether;
        require(msg.value == _quantity * weiPrice);
        BidInfo bidInfo = new BidInfo(msg.sender, _quantity, weiPrice);
        bidInfo.transfer(msg.value);
        bidInfos.push(bidInfo);
    }

    /**
     * 買い注文に対して売る.
     */
    function acceptBid(uint idx, uint16 quantity) payable {
        address seller = msg.sender;
        address buyer = bidInfos[idx].buyer();
        require(balanceOf[seller] >= quantity);
        bidInfos[idx].accept(seller, quantity);
        balanceOf[seller] = balanceOf[seller] - quantity;
        balanceOf[buyer] = balanceOf[buyer] + quantity;
        if (!isAlreadyOwner(buyer)) {
            // 初オーナー
            ownerList.push(buyer);
        }
    }

}
