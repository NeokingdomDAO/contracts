import { FakeContract, MockContract, smock } from "@defi-wonderland/smock";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { solidity } from "ethereum-waffle";
import { ethers, network, upgrades } from "hardhat";

import {
  DAORoles,
  GovernanceToken,
  GovernanceToken__factory,
  INeokingdomToken,
  IRedemptionController,
  IShareholderRegistry,
  IVoting,
  ShareholderRegistry__factory,
} from "../typechain";

import { ROLES } from "../lib/utils";
import { getEVMTimestamp, timeTravel } from "./utils/evm";

chai.use(smock.matchers);
chai.use(solidity);
chai.use(chaiAsPromised);
const { expect } = chai;

const { MaxUint256, AddressZero } = ethers.constants;

describe("GovernanceToken", () => {
  let snapshotId: string;

  let daoRoles: FakeContract<DAORoles>;
  let governanceToken: GovernanceToken;
  let neokingdomToken: FakeContract<INeokingdomToken>;
  let voting: FakeContract<IVoting>;
  let shareholderRegistry: MockContract<IShareholderRegistry>;
  let redemption: FakeContract<IRedemptionController>;
  let contributorStatus: string;
  let deployer: SignerWithAddress;
  let internalMarket: SignerWithAddress;
  let contributor: SignerWithAddress;
  let contributor2: SignerWithAddress;
  let account: SignerWithAddress;
  let account2: SignerWithAddress;

  before(async () => {
    [deployer, internalMarket, contributor, contributor2, account, account2] =
      await ethers.getSigners();

    daoRoles = await smock.fake("DAORoles");
    redemption = await smock.fake("IRedemptionController");
    neokingdomToken = await smock.fake("INeokingdomToken");

    const GovernanceTokenFactory = (await ethers.getContractFactory(
      "GovernanceToken",
      deployer
    )) as GovernanceToken__factory;

    governanceToken = (await upgrades.deployProxy(
      GovernanceTokenFactory,
      [daoRoles.address, "Test", "TEST"],
      { initializer: "initialize" }
    )) as GovernanceToken;
    await governanceToken.deployed();

    voting = await smock.fake("IVoting");
    const shareholderRegistryFactory =
      await smock.mock<ShareholderRegistry__factory>("ShareholderRegistry");
    shareholderRegistry = await shareholderRegistryFactory.deploy();

    contributorStatus = await shareholderRegistry.CONTRIBUTOR_STATUS();

    daoRoles.hasRole.returns(true);
    await governanceToken.setVoting(voting.address);
    await governanceToken.setShareholderRegistry(shareholderRegistry.address);
    await governanceToken.setSettlementPeriod(3600 * 24 * 7);
    await governanceToken.setRedemptionController(redemption.address);
    await governanceToken.setTokenExternal(neokingdomToken.address);
  });

  async function mintAndApprove(signer: SignerWithAddress, amount: number) {
    await governanceToken.mint(signer.address, amount);
    await governanceToken
      .connect(signer)
      .approve(internalMarket.address, MaxUint256);
  }

  beforeEach(async () => {
    snapshotId = await network.provider.send("evm_snapshot");
    daoRoles.hasRole.returns(true);
    shareholderRegistry.isAtLeast
      .whenCalledWith(contributorStatus, contributor.address)
      .returns(true);
    shareholderRegistry.isAtLeast
      .whenCalledWith(contributorStatus, contributor2.address)
      .returns(true);
  });

  afterEach(async () => {
    await network.provider.send("evm_revert", [snapshotId]);
    redemption.afterMint.reset();
    daoRoles.hasRole.reset();
    shareholderRegistry.isAtLeast.reset();
  });

  describe("transfer hooks", async () => {
    it("should call the Voting hook after a minting", async () => {
      await governanceToken.mint(account.address, 10);
      expect(voting.afterTokenTransfer).calledWith(
        AddressZero,
        account.address,
        10
      );
    });

    it("should call the Voting hook after a token transfer", async () => {
      await mintAndApprove(contributor, 10);
      await governanceToken
        .connect(internalMarket)
        .transferFrom(contributor.address, account.address, 10);
      expect(voting.afterTokenTransfer).calledWith(
        contributor.address,
        account.address,
        10
      );
    });

    it("should call the RedemptionController hook when mint", async () => {
      await governanceToken.mint(contributor.address, 10);
      expect(redemption.afterMint).calledWith(contributor.address, 10);
    });

    it("should not call the RedemptionController hook when transfer", async () => {
      await mintAndApprove(contributor, 10);
      redemption.afterMint.reset();
      await governanceToken
        .connect(internalMarket)
        .transferFrom(contributor.address, account2.address, 10);
      expect(redemption.afterMint).callCount(0);
    });
  });

  describe("transfer", async () => {
    beforeEach(async () => {
      await mintAndApprove(contributor, 10);
      await mintAndApprove(account, 10);
    });

    it("should revert when called by a contributor", async () => {
      daoRoles.hasRole.reset();
      await expect(
        governanceToken.connect(contributor).transfer(contributor2.address, 1)
      ).revertedWith(
        `AccessControl: account ${contributor.address.toLowerCase()} is missing role ${
          ROLES.MARKET_ROLE
        }`
      );
    });

    it("should revert when called by a non-contributor", async () => {
      daoRoles.hasRole.reset();
      await expect(
        governanceToken.connect(account).transfer(contributor2.address, 1)
      ).revertedWith(
        `AccessControl: account ${account.address.toLowerCase()} is missing role ${
          ROLES.MARKET_ROLE
        }`
      );
    });

    it("should transfer when called by the market contract", async () => {
      await expect(
        governanceToken
          .connect(internalMarket)
          .transferFrom(contributor.address, contributor2.address, 1)
      )
        .emit(governanceToken, "Transfer")
        .withArgs(contributor.address, contributor2.address, 1);
    });
  });

  describe("vesting", async () => {
    beforeEach(async () => {
      await mintAndApprove(account, 10);
      await governanceToken.mintVesting(account.address, 100);
    });

    it("should not allow balance in vesting to be transferred by the internal market", async () => {
      await expect(
        governanceToken
          .connect(internalMarket)
          // account has only 10 vested (free) tokens
          .transferFrom(account.address, account2.address, 50)
      ).revertedWith("GovernanceToken: transfer amount exceeds vesting");
    });

    it("should update the vesting balance", async () => {
      await governanceToken.mintVesting(account.address, 100);
      expect(await governanceToken.vestingBalanceOf(account.address)).equal(
        200
      );
    });

    it("should emit events on update the vesting balance", async () => {
      expect(await governanceToken.mintVesting(account.address, 10))
        .emit(governanceToken, "VestingSet")
        .withArgs(account.address, 110);
      expect(await governanceToken.mintVesting(account.address, 20))
        .emit(governanceToken, "VestingSet")
        .withArgs(account.address, 130);
    });

    it("should allow to transfer balance that is not vesting", async () => {
      await expect(
        governanceToken
          .connect(internalMarket)
          .transferFrom(account.address, account2.address, 10)
      )
        .emit(governanceToken, "Transfer")
        .withArgs(account.address, account2.address, 10);

      // The previous transfer consumed all unvested balance so any other
      // transfer should fail
      await expect(
        governanceToken
          .connect(internalMarket)
          .transferFrom(account.address, account2.address, 1)
      ).revertedWith("GovernanceToken: transfer amount exceeds vesting");
    });

    it("should allow to decrease the vesting balance", async () => {
      await governanceToken.setVesting(account.address, 5);
      expect(await governanceToken.vestingBalanceOf(account.address)).equal(5);
    });

    it("should not allow to increase the vesting balance", async () => {
      await expect(
        governanceToken.setVesting(account.address, 200)
      ).revertedWith("GovernanceToken: vesting can only be decreased");
    });
  });

  describe("wrap", async () => {
    it("should fail when not called by MARKET_ROLE", async () => {
      daoRoles.hasRole.reset();
      await expect(
        governanceToken.connect(contributor).wrap(contributor.address, 1)
      ).revertedWith(
        `AccessControl: account ${contributor.address.toLowerCase()} is missing role ${
          ROLES.MARKET_ROLE
        }`
      );
    });

    it("should fail wrapping 0 tokens", async () => {
      await expect(
        governanceToken.connect(contributor).wrap(contributor.address, 0)
      ).revertedWith("GovernanceToken: attempt to wrap 0 tokens");
    });

    it("should transfer external token to itself", async () => {
      await governanceToken.wrap(contributor.address, 41);
      expect(neokingdomToken.transferFrom).calledWith(
        contributor.address,
        governanceToken.address,
        41
      );
    });

    it("should emit a DepositStarted event", async () => {
      await expect(governanceToken.wrap(contributor.address, 41))
        .to.emit(governanceToken, "DepositStarted")
        .withArgs(
          contributor.address,
          41,
          (await getEVMTimestamp()) + 3600 * 24 * 7
        );
    });
  });

  describe("settlingBalanceOf", async () => {
    const wrappedTokens = 41;

    describe("when no tokens have been wrapped", async () => {
      it("should return 0", async () => {
        const result = await governanceToken.settlingBalanceOf(
          contributor.address
        );

        expect(result).equal(0);
      });
    });

    describe("when tokens have been wrapped less than 7 days ago", async () => {
      beforeEach(async () => {
        await governanceToken.wrap(contributor.address, wrappedTokens);
      });

      it("should return the amount of wrapped tokens", async () => {
        const result = await governanceToken.settlingBalanceOf(
          contributor.address
        );

        expect(result).equal(wrappedTokens);
      });

      it("should return the sum of all cooling tokens from a subsequent wrap", async () => {
        await governanceToken.wrap(contributor.address, 42);

        const result = await governanceToken.settlingBalanceOf(
          contributor.address
        );

        expect(result).equal(wrappedTokens + 42);
      });
    });

    describe("when tokens have been wrapped more than 7 days ago", async () => {
      beforeEach(async () => {
        await governanceToken.wrap(contributor.address, wrappedTokens);
        await timeTravel(7, true);
      });

      it("should return 0", async () => {
        const result = await governanceToken.settlingBalanceOf(
          contributor.address
        );

        expect(result).equal(0);
      });

      it("should returns a new amount of wrapped tokens", async () => {
        await governanceToken.wrap(contributor.address, 42);

        const result = await governanceToken.settlingBalanceOf(
          contributor.address
        );

        expect(result).equal(42);
      });
    });
  });

  describe("processDepositedTokens", async () => {
    describe("when no tokens have been wrapped", async () => {
      it("should mint nothing", async () => {
        await governanceToken.settleTokens(contributor.address);

        const result = await governanceToken.balanceOf(contributor.address);

        expect(result).equal(0);
      });
    });

    describe("when tokens have been wrapped less than 7 days ago", async () => {
      beforeEach(async () => {
        await governanceToken.wrap(contributor.address, 41);
      });

      it("should mint nothing", async () => {
        await governanceToken.settleTokens(contributor.address);

        const result = await governanceToken.balanceOf(contributor.address);

        expect(result).equal(0);
      });
    });

    describe("when tokens have been wrapped more than 7 days ago", async () => {
      beforeEach(async () => {
        await governanceToken.wrap(contributor.address, 41);
        await timeTravel(7);
      });

      it("should mint internal tokens to 'from' address", async () => {
        await governanceToken.settleTokens(contributor.address);

        const result = await governanceToken.balanceOf(contributor.address);

        expect(result).equal(41);
      });

      it("should not mint internal tokens twice", async () => {
        await governanceToken.settleTokens(contributor.address);
        await governanceToken.settleTokens(contributor.address);

        const result = await governanceToken.balanceOf(contributor.address);

        expect(result).equal(41);
      });

      it("should only not mint non cooled tokens", async () => {
        await governanceToken.wrap(contributor.address, 42);
        await governanceToken.settleTokens(contributor.address);

        const result = await governanceToken.balanceOf(contributor.address);

        expect(result).equal(41);
      });

      it("should mint cooled tokens from different wraps together", async () => {
        await governanceToken.wrap(contributor.address, 42);
        await timeTravel(7);
        await governanceToken.settleTokens(contributor.address);

        const result = await governanceToken.balanceOf(contributor.address);

        expect(result).equal(83);
      });

      it("should mint cooled tokens from a subsequent wrap", async () => {
        await governanceToken.wrap(contributor.address, 42);
        await governanceToken.settleTokens(contributor.address);

        const balanceBefore = await governanceToken.balanceOf(
          contributor.address
        );
        await timeTravel(7);
        await governanceToken.settleTokens(contributor.address);

        const balanceAfter = await governanceToken.balanceOf(
          contributor.address
        );

        expect(balanceAfter).equal(balanceBefore.add(42));
      });
    });
  });

  describe("unwrap", async () => {
    it("should fail when not called by MARKET_ROLE", async () => {
      daoRoles.hasRole.reset();
      await expect(
        governanceToken
          .connect(contributor)
          .unwrap(contributor.address, contributor.address, 1)
      ).revertedWith(
        `AccessControl: account ${contributor.address.toLowerCase()} is missing role ${
          ROLES.MARKET_ROLE
        }`
      );
    });

    it("should fail when user doesn't have enough tokens to unwrap", async () => {
      await expect(
        governanceToken.unwrap(contributor.address, contributor.address, 1)
      ).revertedWith("ERC20: burn amount exceeds balance");
    });

    it("should transfer external token to 'to' address", async () => {
      await governanceToken.mint(contributor.address, 41);
      await governanceToken.unwrap(
        contributor.address,
        contributor2.address,
        10
      );
      expect(neokingdomToken.transfer).calledWith(contributor2.address, 10);
    });

    it("should burn internal tokens owned by 'from' address", async () => {
      await governanceToken.mint(contributor.address, 41);
      await governanceToken.unwrap(
        contributor.address,
        contributor2.address,
        10
      );
      expect(await governanceToken.balanceOf(contributor.address)).equal(31);
    });
  });

  describe("mint", async () => {
    it("should fail when not called by RESOLUTION_ROLE", async () => {
      daoRoles.hasRole.reset();
      await expect(
        governanceToken.connect(contributor).mint(contributor.address, 1)
      ).revertedWith(
        `AccessControl: account ${contributor.address.toLowerCase()} is missing role ${
          ROLES.RESOLUTION_ROLE
        }`
      );
    });

    it("should mint external tokens to itself", async () => {
      await governanceToken.mint(contributor.address, 41);
      expect(neokingdomToken.mint).calledWith(governanceToken.address, 41);
    });

    it("should mint internal tokens to 'to' address", async () => {
      await governanceToken.mint(contributor.address, 41);
      expect(await governanceToken.balanceOf(contributor.address)).equal(41);
    });
  });

  describe("burn", async () => {
    it("should fail when not called by MARKET_ROLE", async () => {
      daoRoles.hasRole.reset();
      await expect(
        governanceToken.connect(contributor).burn(contributor.address, 1)
      ).revertedWith(
        `AccessControl: account ${contributor.address.toLowerCase()} is missing role ${
          ROLES.MARKET_ROLE
        }`
      );
    });

    it("should burn external tokens from itself", async () => {
      await governanceToken.mint(contributor.address, 41);
      await governanceToken.burn(contributor.address, 20);
      expect(neokingdomToken.burn).calledWith(20);
    });

    it("should burn internal tokens from 'from' address", async () => {
      await governanceToken.mint(contributor.address, 41);
      await governanceToken.burn(contributor.address, 20);
      expect(await governanceToken.balanceOf(contributor.address)).equal(21);
    });
  });
});
