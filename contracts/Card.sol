pragma solidity ^0.4.15;
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
    mapping(bytes16 => AskInfo[]) public askInfos;
    mapping(bytes16 => bool) private existAskInfos;
    bytes16[] private askInfoPrices;

    // event puts_s(string s);
    // event puts_u(uint u);
    // event puts_a(address a);
    // event puts_b16(bytes16 b);

    event ChangeMarkPrice(uint _transactionCount, uint marketPrice, int diff, bool isNegative);

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
        bytes16 _key = bytes16(_price);
        if(!hasPriceKey(_key)){
          askInfoPrices.push(_key);
          existAskInfos[_key] = true;
        }
        askInfos[_key].push(AskInfo(msg.sender, _quantity));
    }

    /**
     * 価格キーが存在するかどうか
     * @param _key 金額をハッシュ化したキー
     */
    function hasPriceKey(bytes16 _key) private returns (bool) {
        return existAskInfos[_key];
    }

    /**
     * @dev 売り注文の金額のリストを返す
     * @return （無効なもの含む）金額別売り注文の金額のリスト
     */
    function getAskInfoPrices() constant returns (bytes16[]){
        return askInfoPrices;
    }

    /**
     * @dev 指定の金額の売り注文数を返す
     * @param _price 金額
     * @return 指定の金額の売り注文数
     */
    function readAskInfoCount(uint128 _price) constant returns (uint) {
        return askInfos[bytes16(_price)].length;
    }

    /**
     * @dev 指定の金額の売り注文データを返す
     * @param _price 金額
     * @param idx 要素番号
     * @return 指定の金額の売り注文データ
     */
    function readAskInfo(uint128 _price, uint idx) constant returns (address from, uint32 quantity) {
        return (askInfos[bytes16(_price)][idx].from, askInfos[bytes16(_price)][idx].quantity);
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
        AskInfo[] storage _askInfos = askInfos[bytes16(_price)];
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
     * 買い注文リスト
     */
    // address[] public bidInfos;
    mapping(bytes16 => address) public bidInfos;
    mapping(bytes16 => bool) private existBidInfos;
    bytes16[] private bidInfoPrices;

    event D(uint x);

    /**
     * 買い注文作成
     * @param _quantity 枚数
     * @param _price 購入額(wei)
     */
    function bid(uint16 _quantity, uint128 _price) payable {
        require(msg.value == _quantity * _price);

        bytes16 _key = bytes16(_price);
        if(hasBidPriceKey(_key)){
            BidInfo _bidInfo = BidInfo(bidInfos[_key]);
            _bidInfo.transfer(msg.value);
            _bidInfo.add(msg.sender, _quantity);
        }else{
            BidInfo bidInfo = new BidInfo(msg.sender, _quantity, _price);
            bidInfo.transfer(msg.value);
            bidInfos[_key] = address(bidInfo);
            bidInfoPrices.push(_key);
            existBidInfos[_key] = true;
        }
    }

    function hasBidPriceKey(bytes16 _key) private returns (bool) {
        return existBidInfos[_key];
    }

    /**
     *  買い注文リストの要素数を返す
     */
    function getBidInfosCount() constant returns (uint){
        return bidInfoPrices.length;
    }

    /**
     * @dev 買い注文の金額のリストを返す
     * @return （無効なもの含む）金額別売り注文の金額のリスト
     */
    function getBidInfoPrices() constant returns (bytes16[]){
        return bidInfoPrices;
    }

    /**
     * @dev BidInfoのアドレスを返す
     * @return （無効なもの含む）金額別売り注文の金額のリスト
     */
    function getBidInfo(uint128 _price) constant returns (address){
        bytes16 _key = bytes16(_price);
        return bidInfos[_key];
    }

    /**
     * 買い注文に対して売る.
     * @param _price BidInfoの価格
     * @param _quantity 枚数
     */
    function acceptBid(uint128 _price, uint32 _quantity) payable {
        bytes16 _key = bytes16(_price);

        BidInfo bidInfo = BidInfo(bidInfos[_key]);
        // TODO bidInfoがない場合

        address seller = msg.sender;
        // 売る人がカードをもっていない場合はエラー
        require(balanceOf[seller] >= _quantity);

        uint bidInfoCount = bidInfo.getBidInfoPropsCount();
        for(uint i = 0; i < bidInfoCount; i++){
            var (buyer, quantity) = bidInfo.getBidInfoProps(i);
            // TODO deleteしても古いデータがのこる
            if(quantity == 0){
                continue;
            }

            uint32 boughtNum = 0;
            if(quantity > _quantity){
                // 一部買う
                boughtNum = _quantity;
            }else{
                // 全部買う
                boughtNum = quantity;
            }
            _quantity -= boughtNum;

            // sellerへ購入金額を送付
            bidInfo.transfer(seller, boughtNum);

            balanceOf[seller] -= boughtNum;
            balanceOf[buyer] += boughtNum;
            quantity -= boughtNum;

            // 初オーナーとなるaddressを登録
            if (!isAlreadyOwner(buyer)) {
                ownerList.push(buyer);
            }

            // deleteしてもstructは残る
            if(quantity == 0){
                bidInfo.deleteBidInfoProps(i);
            }else{
                // 在庫有り
                bidInfo.updateBidInfoProps(i, quantity);
            }
            // すべて支払った場合終了
            if(_quantity == 0){
                break;
            }
        }

        // 売却枚数がのこる場合は失敗
        if(_quantity != 0){
            revert();
        }

        // 時価の算出
        calcPrice(_price);
    }

    /**
     * カードの価値を計算し出力
     * @param _price 1枚あたりの取引額(wei)
     */
    function calcPrice(uint _price) private {
        // 取引額の算出
        totalPrice += _price;
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
