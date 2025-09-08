// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import "./PiggyBank.sol";

contract PiggyFactory {
    address public admin;
    PiggyBank[] public allPiggyBanks;
    mapping(address => PiggyBank) public userPiggyBank;
    mapping(address => bool) public hasJoined;
    uint public totalUsers;

    error InvalidAddress();
    error UserAlreadyJoined();
    error UserNotJoined();

    event PiggyBankCreated(address indexed user, address indexed piggyBank);
    event UserJoined(address indexed user, address indexed piggyBank);

    constructor() {
        admin = msg.sender;
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only Admin can call this function");
        _;
    }

    function join() external returns (PiggyBank) {
        if (hasJoined[msg.sender]) revert UserAlreadyJoined();
        
        PiggyBank newBank = new PiggyBank(msg.sender, admin);
        allPiggyBanks.push(newBank);
        userPiggyBank[msg.sender] = newBank;
        hasJoined[msg.sender] = true;
        totalUsers++;
        
        emit UserJoined(msg.sender, address(newBank));
        emit PiggyBankCreated(msg.sender, address(newBank));
        
        return newBank;
    }

    function createPiggyBank(address _user) external onlyAdmin returns (PiggyBank) {
        if (_user == address(0)) revert InvalidAddress();
        if (hasJoined[_user]) revert UserAlreadyJoined();
        
        PiggyBank newBank = new PiggyBank(_user, admin);
        allPiggyBanks.push(newBank);
        userPiggyBank[_user] = newBank;
        hasJoined[_user] = true;
        totalUsers++;
        
        emit PiggyBankCreated(_user, address(newBank));
        
        return newBank;
    }

    function getAllPiggyBanks() external view returns (PiggyBank[] memory) {
        return allPiggyBanks;
    }

    function getUserPiggyBank(address user) external view returns (PiggyBank) {
        if (!hasJoined[user]) revert UserNotJoined();
        return userPiggyBank[user];
    }

    function getUserTotalBalance(address user, address tokenAddress) external view returns (uint etherBalance, uint erc20Balance) {
        if (!hasJoined[user]) revert UserNotJoined();
        
        PiggyBank bank = userPiggyBank[user];
        etherBalance = bank.getTotalEtherBalance();
        erc20Balance = bank.getTotalERC20Balance(tokenAddress);
    }

    function getUserBankCounts(address user) external view returns (uint etherBanks, uint erc20Banks) {
        if (!hasJoined[user]) revert UserNotJoined();
        
        PiggyBank bank = userPiggyBank[user];
        return bank.getUserBankCount();
    }

    function getTotalUsers() external view returns (uint) {
        return totalUsers;
    }

    function isUserJoined(address user) external view returns (bool) {
        return hasJoined[user];
    }
}