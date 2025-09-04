
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

contract CourseManager is Ownable {
    IERC20 public immutable yd;
    uint256 public exchangeRateEthPerYD; // mock rate, amount of wei per 1 YD (1e18)
    uint256 public nextId = 1;

    // courseId => user => purchased
    mapping(string => mapping(address => bool)) public purchased;

    event CourseCreated(string id, address indexed author);
    event CoursePurchased(string id, address indexed buyer, uint256 priceYD);
    event RateUpdated(uint256 weiPerYD);
    event YDBought(address indexed buyer, uint256 ethAmount, uint256 ydAmount);

    constructor(address ydToken) Ownable(msg.sender) {
        yd = IERC20(ydToken);
        exchangeRateEthPerYD = 1e15; // default 0.001 ETH per 1 YD (for mock ETH purchases)
    }

    function setEthPerYDRate(uint256 weiPerYD) external onlyOwner {
        exchangeRateEthPerYD = weiPerYD;
        emit RateUpdated(weiPerYD);
    }

    function createCourse(string calldata id) external {
        purchased[id][msg.sender] = true;
        emit CourseCreated(id, msg.sender);
    }

    // ================== YD兑换功能 ==================
    function buyYD() external payable {
        require(msg.value > 0, "Send ETH");

        // 取出代币小数位，兼容 future ERC20
        uint8 d = IERC20Metadata(address(yd)).decimals();

        // 按实际 decimals 计算兑换数量
        uint256 amount = msg.value * (10 ** d) / exchangeRateEthPerYD;

        require(amount > 0, "Too little ETH sent");
        require(yd.balanceOf(address(this)) >= amount, "Not enough YD in pool");

        // 转 YD 给用户
        bool ydTransferSuccess = yd.transfer(msg.sender, amount);
        require(ydTransferSuccess, "YD transfer to user failed");

        // 把 ETH 转给合约 owner
        (bool ethTransferSuccess, ) = payable(owner()).call{value: msg.value}("");
        require(ethTransferSuccess, "ETH transfer to owner failed");

        emit YDBought(msg.sender, msg.value, amount);
    }


    // Buy with YD token (needs approval)
    function buyWithYD(string calldata id, address author, uint256 priceYD) external {
        require(!purchased[id][msg.sender], "already bought");
        // 校验用户授权足够的YD
        uint256 allowance = yd.allowance(msg.sender, address(this));
        require(allowance >= priceYD, "Insufficient YD allowance"); 

        require(yd.transferFrom(msg.sender, author, priceYD), "transfer fail");
        purchased[id][msg.sender] = true;
        emit CoursePurchased(id, msg.sender, priceYD);
    }

    // Helper views
    function isPurchased(address user, string calldata id) external view returns (bool) {
        return purchased[id][user];
    }
}
