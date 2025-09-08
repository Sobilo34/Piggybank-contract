// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;
import "../interfaces/IPiggyBank.sol";

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract PiggyBank is IPiggyBank {
    address public owner;
    address public admin;

    error NotYourBank();
    error BankNotFound();
    error LockPeriodActive(uint remainingTime);
    error InsufficientFunds();
    error TransferFailed();
    error InvalidAddress();
    error DuplicateLockPeriod();

    constructor(address _owner, address _admin) {
        if (_owner == address(0) || _admin == address(0)) revert InvalidAddress();
        owner = _owner;
        admin = _admin;
    }

    ERC20Bank[] public erc20Banks;
    EthersBank[] public ethersBanks;

    mapping(address => ERC20Bank[]) public userERC20Banks;
    mapping(address => EthersBank[]) public userEtherBanks;
    mapping(address => mapping(uint => bool)) private usedLockPeriods;

    modifier onlyOwner() {
        require(msg.sender == owner, "Not bank owner");
        _;
    }

    function createBank(
        WalletType _walletType,
        string memory _bankName,
        address _optionalTokenAddress,
        uint _lockPeriod
    ) external onlyOwner {
        if (usedLockPeriods[msg.sender][_lockPeriod]) revert DuplicateLockPeriod();
        
        usedLockPeriods[msg.sender][_lockPeriod] = true;

        if (_walletType == WalletType.ERC20Wallet) {
            ERC20Bank memory newBank = ERC20Bank(
                _bankName,
                _optionalTokenAddress,
                _lockPeriod,
                0,
                msg.sender,
                block.timestamp
            );
            erc20Banks.push(newBank);
            userERC20Banks[msg.sender].push(newBank);
        } else {
            EthersBank memory newBank = EthersBank(
                _bankName,
                _lockPeriod,
                0,
                msg.sender,
                block.timestamp
            );
            ethersBanks.push(newBank);
            userEtherBanks[msg.sender].push(newBank);
        }
    }

    function depositERC20(uint bankIndex, uint amount) external onlyOwner {
        ERC20Bank storage bank = userERC20Banks[msg.sender][bankIndex];
        if (bank.bankOwner != msg.sender) revert NotYourBank();

        IERC20 token = IERC20(bank.tokenAddress);
        if (!token.transferFrom(msg.sender, address(this), amount)) revert TransferFailed();

        bank.balance += amount;
    }

    function depositEther(uint bankIndex) external payable onlyOwner {
        EthersBank storage bank = userEtherBanks[msg.sender][bankIndex];
        if (bank.bankOwner != msg.sender) revert NotYourBank();
        bank.balance += msg.value;
    }

    function withdrawEther(uint bankIndex, address payable _to, uint amount) external onlyOwner {
        EthersBank storage bank = userEtherBanks[msg.sender][bankIndex];
        if (bank.bankOwner != msg.sender) revert NotYourBank();
        if (bank.balance < amount) revert InsufficientFunds();

        uint fee = 0;
        if (block.timestamp < bank.createdAt + bank.lockPeriod) {
            fee = (amount * 3) / 100;
            (bool sentFee, ) = admin.call{value: fee}("");
            if (!sentFee) revert TransferFailed();
        }

        uint payout = amount - fee;
        bank.balance -= amount;

        (bool sent, ) = _to.call{value: payout}("");
        if (!sent) revert TransferFailed();
    }

    function withdrawERC20(uint bankIndex, address _to, uint amount) external onlyOwner {
        ERC20Bank storage bank = userERC20Banks[msg.sender][bankIndex];
        if (bank.bankOwner != msg.sender) revert NotYourBank();
        if (bank.balance < amount) revert InsufficientFunds();

        uint fee = 0;
        IERC20 token = IERC20(bank.tokenAddress);

        if (block.timestamp < bank.createdAt + bank.lockPeriod) {
            fee = (amount * 3) / 100;
            if (!token.transfer(admin, fee)) revert TransferFailed();
        }

        uint payout = amount - fee;
        bank.balance -= amount;

        if (!token.transfer(_to, payout)) revert TransferFailed();
    }

    function getRemainingLockTime(WalletType _walletType, uint bankIndex) external view returns (uint) {
        if (_walletType == WalletType.ERC20Wallet) {
            ERC20Bank storage bank = userERC20Banks[msg.sender][bankIndex];
            if (block.timestamp >= bank.createdAt + bank.lockPeriod) return 0;
            return (bank.createdAt + bank.lockPeriod) - block.timestamp;
        } else {
            EthersBank storage bank = userEtherBanks[msg.sender][bankIndex];
            if (block.timestamp >= bank.createdAt + bank.lockPeriod) return 0;
            return (bank.createdAt + bank.lockPeriod) - block.timestamp;
        }
    }

    function getEtherBankBalance(uint bankIndex) external view onlyOwner returns (uint) {
        return userEtherBanks[msg.sender][bankIndex].balance;
    }

    function getERC20BankBalance(uint bankIndex) external view onlyOwner returns (uint) {
        return userERC20Banks[msg.sender][bankIndex].balance;
    }

    function getTotalEtherBalance() external view returns (uint) {
        uint total = 0;
        EthersBank[] memory banks = userEtherBanks[owner];
        for (uint i = 0; i < banks.length; i++) {
            total += banks[i].balance;
        }
        return total;
    }

    function getTotalERC20Balance(address tokenAddress) external view returns (uint) {
        uint total = 0;
        ERC20Bank[] memory banks = userERC20Banks[owner];
        for (uint i = 0; i < banks.length; i++) {
            if (banks[i].tokenAddress == tokenAddress) {
                total += banks[i].balance;
            }
        }
        return total;
    }

    function getUserBankCount() external view returns (uint etherBankCount, uint erc20BanksCount) {
        return (userEtherBanks[owner].length, userERC20Banks[owner].length);
    }

    receive() external payable {}
    fallback() external payable {}
}