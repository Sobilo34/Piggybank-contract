// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

interface IPiggyBank {
    enum WalletType {
        EtherWallet,
        ERC20Wallet
    }

    struct ERC20Bank {
        string bankName;
        address tokenAddress;
        uint lockPeriod;
        uint balance;
        address bankOwner;
        uint createdAt;
    }

    struct EthersBank {
        string bankName;
        uint lockPeriod;
        uint balance;
        address bankOwner;
        uint createdAt;
    }

    function createBank(
        WalletType _walletType,
        string memory _bankName,
        address _optionalTokenAddress,
        uint _lockPeriod
    ) external;

    function depositERC20(uint bankIndex, uint amount) external;

    function depositEther(uint bankIndex) external payable;

    function withdrawEther(uint bankIndex, address payable _to, uint amount) external;

    function withdrawERC20(uint bankIndex, address _to, uint amount) external;

    function getRemainingLockTime(WalletType _walletType, uint bankIndex) external view returns (uint);

    function getEtherBankBalance(uint bankIndex) external view returns (uint);

    function getERC20BankBalance(uint bankIndex) external view returns (uint);

    function getTotalEtherBalance() external view returns (uint);

    function getTotalERC20Balance(address tokenAddress) external view returns (uint);

    function getUserBankCount() external view returns (uint etherBankCount, uint erc20BanksCount);
}
