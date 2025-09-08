import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("PiggyFactory", () => {
  async function deployFactory() {
    const [admin, user1, user2, user3] = await ethers.getSigners();

    const PiggyFactory = await ethers.getContractFactory("PiggyFactory");
    const deployedFactory = await PiggyFactory.deploy();

    return { deployedFactory, admin, user1, user2, user3 };
  }

  describe("Factory Deployment", () => {
    it("Should set admin correctly", async () => {
      const { deployedFactory, admin } = await loadFixture(deployFactory);
      
      expect(await deployedFactory.admin()).to.equal(admin.address);
    });

    it("Should have zero users initially", async () => {
      const { deployedFactory } = await loadFixture(deployFactory);
      
      expect(await deployedFactory.getTotalUsers()).to.equal(0);
    });
  });

  describe("User Join", () => {
    it("Should allow user to join and create piggy bank", async () => {
      const { deployedFactory, user1 } = await loadFixture(deployFactory);

      const tx = await deployedFactory.connect(user1).join();
      const receipt = await tx.wait();

      const userJoinedEvent = receipt.logs.find(
        (log) => log.fragment && log.fragment.name === "UserJoined"
      );

      expect(userJoinedEvent.args.user).to.equal(user1.address);
      expect(await deployedFactory.isUserJoined(user1.address)).to.be.true;
      expect(await deployedFactory.getTotalUsers()).to.equal(1);
    });

    it("Should not allow user to join twice", async () => {
      const { deployedFactory, user1 } = await loadFixture(deployFactory);

      await deployedFactory.connect(user1).join();
      
      await expect(deployedFactory.connect(user1).join()).to.be.revertedWithCustomError(
        deployedFactory,
        "UserAlreadyJoined"
      );
    });

    it("Should create piggy bank contract for user", async () => {
      const { deployedFactory, user1 } = await loadFixture(deployFactory);

      await deployedFactory.connect(user1).join();
      const userPiggyBank = await deployedFactory.getUserPiggyBank(user1.address);
      
      expect(userPiggyBank).to.properAddress;
      
      const allBanks = await deployedFactory.getAllPiggyBanks();
      expect(allBanks).to.include(userPiggyBank);
    });
  });

  describe("Admin Create Bank", () => {
    it("Should allow admin to create bank for user", async () => {
      const { deployedFactory, admin, user1 } = await loadFixture(deployFactory);

      const tx = await deployedFactory.connect(admin).createPiggyBank(user1.address);
      const receipt = await tx.wait();

      const piggyBankCreatedEvent = receipt.logs.find(
        (log) => log.fragment && log.fragment.name === "PiggyBankCreated"
      );

      expect(piggyBankCreatedEvent.args.user).to.equal(user1.address);
      expect(await deployedFactory.isUserJoined(user1.address)).to.be.true;
    });

    it("Should not allow non-admin to create bank", async () => {
      const { deployedFactory, user1, user2 } = await loadFixture(deployFactory);

      await expect(deployedFactory.connect(user1).createPiggyBank(user2.address)).to.be.revertedWith(
        "Only Admin can call this function"
      );
    });
  });

  describe("PiggyBank Functionality", () => {
    it("Should allow user to create ether bank", async () => {
      const { deployedFactory, user1 } = await loadFixture(deployFactory);

      await deployedFactory.connect(user1).join();
      const userPiggyBankAddress = await deployedFactory.getUserPiggyBank(user1.address);
      
      const PiggyBank = await ethers.getContractFactory("PiggyBank");
      const userPiggyBank = PiggyBank.attach(userPiggyBankAddress);

      await userPiggyBank.connect(user1).createBank(
        0, // EtherWallet
        "My Ether Savings",
        ethers.ZeroAddress,
        86400 // 1 day lock period
      );

      const bankCounts = await userPiggyBank.getUserBankCount();
      expect(bankCounts[0]).to.equal(1); // etherBanks
      expect(bankCounts[1]).to.equal(0); // erc20Banks
    });

    it("Should allow user to deposit ether", async () => {
      const { deployedFactory, user1 } = await loadFixture(deployFactory);

      await deployedFactory.connect(user1).join();
      const userPiggyBankAddress = await deployedFactory.getUserPiggyBank(user1.address);
      
      const PiggyBank = await ethers.getContractFactory("PiggyBank");
      const userPiggyBank = PiggyBank.attach(userPiggyBankAddress);

      await userPiggyBank.connect(user1).createBank(0, "My Savings", ethers.ZeroAddress, 86400);
      
      await userPiggyBank.connect(user1).depositEther(0, { value: ethers.parseEther("1") });
      
      const balance = await userPiggyBank.connect(user1).getEtherBankBalance(0);
      expect(balance).to.equal(ethers.parseEther("1"));
    });

    it("Should not allow duplicate lock periods", async () => {
      const { deployedFactory, user1 } = await loadFixture(deployFactory);

      await deployedFactory.connect(user1).join();
      const userPiggyBankAddress = await deployedFactory.getUserPiggyBank(user1.address);
      
      const PiggyBank = await ethers.getContractFactory("PiggyBank");
      const userPiggyBank = PiggyBank.attach(userPiggyBankAddress);

      await userPiggyBank.connect(user1).createBank(0, "Bank 1", ethers.ZeroAddress, 86400);
      
      await expect(
        userPiggyBank.connect(user1).createBank(0, "Bank 2", ethers.ZeroAddress, 86400)
      ).to.be.revertedWithCustomError(userPiggyBank, "DuplicateLockPeriod");
    });

    it("Should charge breaking fee for early withdrawal", async () => {
      const { deployedFactory, admin, user1 } = await loadFixture(deployFactory);

      await deployedFactory.connect(user1).join();
      const userPiggyBankAddress = await deployedFactory.getUserPiggyBank(user1.address);
      
      const PiggyBank = await ethers.getContractFactory("PiggyBank");
      const userPiggyBank = PiggyBank.attach(userPiggyBankAddress);

      await userPiggyBank.connect(user1).createBank(0, "My Savings", ethers.ZeroAddress, 86400);
      await userPiggyBank.connect(user1).depositEther(0, { value: ethers.parseEther("1") });

      const adminBalanceBefore = await ethers.provider.getBalance(admin.address);
      
      await userPiggyBank.connect(user1).withdrawEther(0, user1.address, ethers.parseEther("1"));
      
      const adminBalanceAfter = await ethers.provider.getBalance(admin.address);
      const expectedFee = ethers.parseEther("1") * 3n / 100n; // 3% fee
      
      expect(adminBalanceAfter - adminBalanceBefore).to.equal(expectedFee);
    });

    it("Should track total balances correctly", async () => {
      const { deployedFactory, user1 } = await loadFixture(deployFactory);

      await deployedFactory.connect(user1).join();
      const userPiggyBankAddress = await deployedFactory.getUserPiggyBank(user1.address);
      
      const PiggyBank = await ethers.getContractFactory("PiggyBank");
      const userPiggyBank = PiggyBank.attach(userPiggyBankAddress);

      await userPiggyBank.connect(user1).createBank(0, "Bank 1", ethers.ZeroAddress, 86400);
      await userPiggyBank.connect(user1).createBank(0, "Bank 2", ethers.ZeroAddress, 172800);
      
      await userPiggyBank.connect(user1).depositEther(0, { value: ethers.parseEther("1") });
      await userPiggyBank.connect(user1).depositEther(1, { value: ethers.parseEther("2") });
      
      const totalBalance = await userPiggyBank.getTotalEtherBalance();
      expect(totalBalance).to.equal(ethers.parseEther("3"));
    });

    it("Should show remaining lock time", async () => {
      const { deployedFactory, user1 } = await loadFixture(deployFactory);

      await deployedFactory.connect(user1).join();
      const userPiggyBankAddress = await deployedFactory.getUserPiggyBank(user1.address);
      
      const PiggyBank = await ethers.getContractFactory("PiggyBank");
      const userPiggyBank = PiggyBank.attach(userPiggyBankAddress);

      await userPiggyBank.connect(user1).createBank(0, "My Savings", ethers.ZeroAddress, 86400);
      
      const remainingTime = await userPiggyBank.connect(user1).getRemainingLockTime(0, 0);
      expect(remainingTime).to.be.greaterThan(0);
    });
  });

  describe("Factory View Functions", () => {
    it("Should get user bank counts", async () => {
      const { deployedFactory, user1 } = await loadFixture(deployFactory);

      await deployedFactory.connect(user1).join();
      const userPiggyBankAddress = await deployedFactory.getUserPiggyBank(user1.address);
      
      const PiggyBank = await ethers.getContractFactory("PiggyBank");
      const userPiggyBank = PiggyBank.attach(userPiggyBankAddress);

      await userPiggyBank.connect(user1).createBank(0, "Ether Bank", ethers.ZeroAddress, 86400);
      
      const bankCounts = await deployedFactory.getUserBankCounts(user1.address);
      expect(bankCounts[0]).to.equal(1); // ether banks
      expect(bankCounts[1]).to.equal(0); // erc20 banks
    });

    it("Should get user total balances", async () => {
      const { deployedFactory, user1 } = await loadFixture(deployFactory);

      await deployedFactory.connect(user1).join();
      const userPiggyBankAddress = await deployedFactory.getUserPiggyBank(user1.address);
      
      const PiggyBank = await ethers.getContractFactory("PiggyBank");
      const userPiggyBank = PiggyBank.attach(userPiggyBankAddress);

      await userPiggyBank.connect(user1).createBank(0, "My Savings", ethers.ZeroAddress, 86400);
      await userPiggyBank.connect(user1).depositEther(0, { value: ethers.parseEther("5") });
      
      const balances = await deployedFactory.getUserTotalBalance(user1.address, ethers.ZeroAddress);
      expect(balances[0]).to.equal(ethers.parseEther("5")); // ether balance
    });

    it("Should revert for non-joined user queries", async () => {
      const { deployedFactory, user1 } = await loadFixture(deployFactory);

      await expect(deployedFactory.getUserPiggyBank(user1.address)).to.be.revertedWithCustomError(
        deployedFactory,
        "UserNotJoined"
      );

      await expect(deployedFactory.getUserBankCounts(user1.address)).to.be.revertedWithCustomError(
        deployedFactory,
        "UserNotJoined"
      );

      await expect(deployedFactory.getUserTotalBalance(user1.address, ethers.ZeroAddress)).to.be.revertedWithCustomError(
        deployedFactory,
        "UserNotJoined"
      );
    });
  });

  describe("Access Control", () => {
    it("Should only allow owner to access their bank functions", async () => {
      const { deployedFactory, user1, user2 } = await loadFixture(deployFactory);

      await deployedFactory.connect(user1).join();
      const userPiggyBankAddress = await deployedFactory.getUserPiggyBank(user1.address);
      
      const PiggyBank = await ethers.getContractFactory("PiggyBank");
      const userPiggyBank = PiggyBank.attach(userPiggyBankAddress);

      await expect(
        userPiggyBank.connect(user2).createBank(0, "Hacker Bank", ethers.ZeroAddress, 86400)
      ).to.be.revertedWith("Not bank owner");
    });
  });
});