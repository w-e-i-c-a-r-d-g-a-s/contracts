pragma solidity ^0.4.13;
import "./BidInfo.sol";

contract Card {
    // カード属性など
    bytes32 public name;
    uint32 public totalSupply;
    bytes32 public imageHash;
    address public author;
    // 総取引額
    uint private totalPrice;
    // 取引回数
    uint private transactionCount;
    // 時価
    uint public currentMarketPrice;

    mapping(address => uint) public balanceOf; // 誰が何枚持っているか
    address[] private ownerList;             // カード所有者のアドレスリスト
    // [Tips]動的配列はpublicで参照できない

    /**
     * // key is wei
     * 10000000000000000: [
     *   {
     *     from: '0x.....',
     *     quentity: 2
     *   },
     *   {
     *     from: '0x.....',
     *     quentity: 4
     *   }
     * ]
     */
    // 売り注文
    struct AskInfo {
        address from;
        uint32 quantity;
    }
    mapping(uint128 => AskInfo[]) public askInfos;
    uint128[] private askInfoPrices;

    /**
     * 買い注文リスト
     */
    address[] public bidInfos;

    event ChangeMarkPrice(uint transactionCount, uint marketPrice, int diff, bool isNegative);

    /**
     * 指定数のカードを所有しているユーザーのみ
     */
    modifier onlyOwn(uint32 _quantity) { require(balanceOf[msg.sender] >= _quantity); _; }

    /**
     * コンストラクタ
     */
    function Card(bytes32 _name, uint32 _totalSupply, bytes32 _imageHash, address _author){
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
    function deal(address to, uint32 quantity) onlyOwn (quantity) {
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
     * @param _quantity 売りたい枚数
     * @param _price １枚あたりの価格(wei)
     */
    function ask(uint32 _quantity, uint128 _price) {
        askInfos[_price].push(AskInfo(msg.sender, _quantity));
        askInfoPrices.push(_price);
    }

    /**
     * @dev 売り注文の金額のリストを返す
     * @return （無効なもの含む）金額別売り注文の金額のリスト
     */
    function getAskInfoPrices() constant returns (uint128[]){
        return askInfoPrices;
    }

    /**
     * @dev 指定の金額の売り注文数を返す
     * @param _price 金額
     * @return 指定の金額の売り注文数
     */
    function readAskInfoCount(uint128 _price) constant returns (uint) {
        return askInfos[_price].length;
    }

    /**
     * @dev 指定の金額の売り注文データを返す
     * @param _price 金額
     * @param idx 要素番号
     * @return 指定の金額の売り注文データ
     */
    function readAskInfo(uint128 _price, uint idx) constant returns(address from, uint32 quantity) {
        return(askInfos[_price]);
    }

    /**
     * @dev 金額別売り注文の数を返す
     * @return （無効なもの含む）金額別売り注文の数
     */
    function getAskInfoPricesCount() constant returns (uint){
        return askInfoPrices.length;
    }

    /**
     * @dev 売り注文に対して買う
     * @param _price 売り注文の金額
     * @param _quantity 枚数
     */
    function acceptAsk(uint128 _price, uint32 _quantity) payable {
        AskInfo[] storage _askInfos = askInfos[_price];
        if(_askInfos.length == 0){
            revert();
        }
        address to = msg.sender;
        for(uint i = 0; i < _askInfos.length; i++){
            AskInfo storage _askInfo = _askInfos[i];

            // TODO deleteしても古いデータがのこる
            if(_askInfo.quantity == 0){
                continue;
            }

            address from = _askInfo.from;
            uint32 boughtNum = 0;
            if(_askInfo.quantity > _quantity){
                // 一部買う
                boughtNum = _quantity;
            }else{
                // 全部買う
                boughtNum = _askInfo.quantity;
            }
            _quantity -= _askInfo.quantity;
            from.transfer(_price * boughtNum);
            balanceOf[from] -= boughtNum;
            balanceOf[to] += boughtNum;
            _askInfo.quantity -= boughtNum;

            // deleteしてもstructは残る
            if(_askInfo.quantity == 0){
                delete _askInfos[i];
            }
            // すべて支払った場合終了
            if(this.balance == 0){
                break;
            }
        }

        // balanceが残っている場合は失敗
        if(this.balance != 0){
            revert();
        }

        if (!isAlreadyOwner(to)) {
            // 初オーナー
            ownerList.push(to);
        }
        // 時価の算出
        calcPrice(_price);
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
     *  買い注文リストの要素数を返す
     */
    function getBidInfosCount() constant returns (uint){
        return bidInfos.length;
    }

    /**
     * 買い注文作成
     * @param _quantity 枚数
     * @param _etherPrice 購入額
     */
    function bid(uint16 _quantity, uint256 _etherPrice) payable {
        //TODO:本番ではetherではなくweiを引数に渡す
        uint256 weiPrice = _etherPrice * 1 ether;
        require(msg.value == _quantity * weiPrice);
        BidInfo bidInfo = new BidInfo(msg.sender, _quantity, weiPrice);
        bidInfo.transfer(msg.value);
        bidInfos.push(address(bidInfo));
    }

    /**
     * 買い注文に対して売る.
     * @param idx BidInfoのインデックス
     * @param quantity 枚数
     */
    function acceptBid(uint idx, uint16 quantity) payable {
        address seller = msg.sender;
        BidInfo bidInfo = BidInfo(bidInfos[idx]);
        address buyer = bidInfo.buyer();
        require(balanceOf[seller] >= quantity);
        bidInfo.accept(seller, quantity);
        balanceOf[seller] = balanceOf[seller] - quantity;
        balanceOf[buyer] = balanceOf[buyer] + quantity;
        if (!isAlreadyOwner(buyer)) {
            // 初オーナー
            ownerList.push(buyer);
        }
        // 時価の算出
        calcPrice(bidInfo.price());
    }

    /**
     * カードの価値を計算し出力
     * @param price 1枚あたりの取引額(wei)
     */
    function calcPrice(uint price) private {
        // 取引額の算出
        totalPrice += price;
        transactionCount++;
        uint marketPrice = totalPrice / transactionCount;
        int diff = int(marketPrice - currentMarketPrice);
        bool isNegative = diff < 0;
        if(isNegative){
            diff *= -1;
        }
        currentMarketPrice = marketPrice;
        ChangeMarkPrice(transactionCount, currentMarketPrice, diff, isNegative);
    }

}
