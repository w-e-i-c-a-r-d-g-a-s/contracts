pragma solidity ^0.4.13;
import "./AskInfo.sol";

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
    struct BidInfo {
        address from;
        uint quantity;
        uint price; // weiで指定
        bool active;
    }
    BidInfo[] public bidInfos;

    /**
     * 買い注文リスト
     */
    AskInfo[] public askInfos;

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
    function bid(uint quantity, uint price) {
        bidInfos.push(BidInfo(msg.sender, quantity, price, true));
    }

    /**
     * @dev 売り注文の数を返す
     * @return （無効なもの含む）売り注文の数
     */
    function getBidInfosCount() constant returns (uint){
        return bidInfos.length;
    }

    /**
     * @dev 売り注文に対して買う
     * @param idx 売り注文のインデックス
     */
    function acceptBid(uint idx) payable {
        BidInfo storage bidInfo = bidInfos[idx];

        address from = bidInfo.from;
        address to = msg.sender;
        uint quantity = bidInfo.quantity;
        uint price = bidInfo.price;

        //有効チェック
        require(bidInfo.active);
        //入力金額の正当性チェック
        require(msg.value == quantity * price);

        if (!isAlreadyOwner(to)) {
            // 初オーナー
            ownerList.push(to);
        }
        balanceOf[from] -= quantity;
        balanceOf[to] += quantity;
        bidInfo.active = false;
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
    function closeBid(uint idx) {
        delete bidInfos[idx];
    }

    /**
     *  買い注文リストの要素数を返す
     */
    function getAskInfosCount() constant returns (uint){
        return askInfos.length;
    }

    /**
     * 買い注文作成
     */
    function ask(uint16 _quantity, uint256 _etherPrice) payable {
        //TODO:本番ではetherではなくweiを引数に渡す
        uint256 weiPrice = _etherPrice * 1 ether;
        require(msg.value == _quantity * weiPrice);
        AskInfo askInfo = new AskInfo(msg.sender, _quantity, weiPrice);
        askInfo.transfer(msg.value);
        askInfos.push(askInfo);
    }

    /**
     * 買い注文に対して売る.
     */
    function acceptAsk(uint idx, uint16 quantity) payable {
        address seller = msg.sender;
        address buyer = askInfos[idx].buyer();
        require(balanceOf[seller] >= quantity);
        askInfos[idx].accept(seller, quantity);
        balanceOf[seller] = balanceOf[seller] - quantity;
        balanceOf[buyer] = balanceOf[buyer] + quantity;
        if (!isAlreadyOwner(buyer)) {
            // 初オーナー
            ownerList.push(buyer);
        }
    }

}
