
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract CourseManager is Ownable {
    IERC20 public immutable yd;
    uint256 public exchangeRateEthPerYD; // mock rate, amount of wei per 1 YD (1e18)
    uint256 public nextId = 1;

    // courseId => user => purchased
    mapping(string => mapping(address => bool)) public purchased;

    event CourseCreated(string id, address indexed author);
    event CoursePurchased(string id, address indexed buyer, uint256 priceYD);
    event RateUpdated(uint256 weiPerYD);

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
        uint256 amount = msg.value * 1e18/exchangeRateEthPerYD;
        // 将用户转入的 ETH 转给 owner（部署者）
        (bool ethTransferSuccess, ) = payable(owner()).call{value: msg.value}("");
        require(ethTransferSuccess, "ETH transfer to the deployer failed");
        require(yd.balanceOf(address(this)) >= amount, "Not enough YD in pool");
        yd.transfer(msg.sender, amount);
    }

    // Buy with YD token (needs approval)
    function buyWithYD(string calldata id, address author, uint256 priceYD) external {
        require(!purchased[id][msg.sender], "already bought");
        require(yd.transferFrom(msg.sender, author, priceYD), "transfer fail");
        purchased[id][msg.sender] = true;
        emit CoursePurchased(id, msg.sender, priceYD);
    }

    // Helper views
    function isPurchased(address user, string calldata id) external view returns (bool) {
        return purchased[id][user];
    }
}
