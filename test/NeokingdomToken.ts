import { FakeContract, smock } from "@defi-wonderland/smock";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { solidity } from "ethereum-waffle";
import { ethers, network, upgrades } from "hardhat";

import {
  DAORoles,
  INeokingdomTokenExternal,
  IRedemptionController,
  IVoting,
  NeokingdomToken,
  NeokingdomToken__factory,
} from "../typechain";

import { ROLES } from "../lib/utils";

chai.use(smock.matchers);
chai.use(solidity);
chai.use(chaiAsPromised);
const { expect } = chai;

const { MaxUint256, AddressZero } = ethers.constants;

describe("NeokingdomToken", () => {
  let snapshotId: string;

  let daoRoles: FakeContract<DAORoles>;
  let neokingdomToken: NeokingdomToken;
  let neokingdomTokenExternal: FakeContract<INeokingdomTokenExternal>;
  let voting: FakeContract<IVoting>;
  let redemption: FakeContract<IRedemptionController>;
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
    neokingdomTokenExternal = await smock.fake("INeokingdomTokenExternal");

    const NeokingdomTokenFactory = (await ethers.getContractFactory(
      "NeokingdomToken",
      deployer
    )) as NeokingdomToken__factory;

    neokingdomToken = (await upgrades.deployProxy(
      NeokingdomTokenFactory,
      [daoRoles.address, "Test", "TEST"],
      { initializer: "initialize" }
    )) as NeokingdomToken;
    await neokingdomToken.deployed();

    voting = await smock.fake("IVoting");

    daoRoles.hasRole.returns(true);
    await neokingdomToken.setVoting(voting.address);
    await neokingdomToken.setRedemptionController(redemption.address);
    await neokingdomToken.setTokenExternal(neokingdomTokenExternal.address);
  });

  async function mintAndApprove(signer: SignerWithAddress, amount: number) {
    await neokingdomToken.mint(signer.address, amount);
    await neokingdomToken
      .connect(signer)
      .approve(internalMarket.address, MaxUint256);
  }

  beforeEach(async () => {
    snapshotId = await network.provider.send("evm_snapshot");
    daoRoles.hasRole.returns(true);
  });

  afterEach(async () => {
    await network.provider.send("evm_revert", [snapshotId]);
    redemption.afterMint.reset();
    daoRoles.hasRole.reset();
  });

  describe("transfer hooks", async () => {
    it("should call the Voting hook after a minting", async () => {
      await neokingdomToken.mint(account.address, 10);
      expect(voting.afterTokenTransfer).calledWith(
        AddressZero,
        account.address,
        10
      );
    });

    it("should call the Voting hook after a token transfer", async () => {
      await mintAndApprove(contributor, 10);
      await neokingdomToken
        .connect(internalMarket)
        .transferFrom(contributor.address, account.address, 10);
      expect(voting.afterTokenTransfer).calledWith(
        contributor.address,
        account.address,
        10
      );
    });

    it("should call the RedemptionController hook when mint", async () => {
      await neokingdomToken.mint(account.address, 10);
      expect(redemption.afterMint).calledWith(account.address, 10);
    });

    it("should not call the RedemptionController hook when transfer", async () => {
      await mintAndApprove(contributor, 10);
      redemption.afterMint.reset();
      await neokingdomToken
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
        neokingdomToken.connect(contributor).transfer(contributor2.address, 1)
      ).revertedWith(
        `AccessControl: account ${contributor.address.toLowerCase()} is missing role ${
          ROLES.MARKET_ROLE
        }`
      );
    });

    it("should revert when called by a non-contributor", async () => {
      daoRoles.hasRole.reset();
      await expect(
        neokingdomToken.connect(account).transfer(contributor2.address, 1)
      ).revertedWith(
        `AccessControl: account ${account.address.toLowerCase()} is missing role ${
          ROLES.MARKET_ROLE
        }`
      );
    });

    it("should transfer when called by the market contract", async () => {
      await expect(
        neokingdomToken
          .connect(internalMarket)
          .transferFrom(contributor.address, contributor2.address, 1)
      )
        .emit(neokingdomToken, "Transfer")
        .withArgs(contributor.address, contributor2.address, 1);
    });
  });

  describe("vesting", async () => {
    beforeEach(async () => {
      await mintAndApprove(account, 10);
      await neokingdomToken.mintVesting(account.address, 100);
    });

    it("should not allow balance in vesting to be transferred by the internal market", async () => {
      await expect(
        neokingdomToken
          .connect(internalMarket)
          // account has only 10 vested (free) tokens
          .transferFrom(account.address, account2.address, 50)
      ).revertedWith("NeokingdomToken: transfer amount exceeds vesting");
    });

    it("should update the vesting balance", async () => {
      await neokingdomToken.mintVesting(account.address, 100);
      expect(await neokingdomToken.vestingBalanceOf(account.address)).equal(
        200
      );
    });

    it("should emit events on update the vesting balance", async () => {
      expect(await neokingdomToken.mintVesting(account.address, 10))
        .emit(neokingdomToken, "VestingSet")
        .withArgs(account.address, 110);
      expect(await neokingdomToken.mintVesting(account.address, 20))
        .emit(neokingdomToken, "VestingSet")
        .withArgs(account.address, 130);
    });

    it("should allow to transfer balance that is not vesting", async () => {
      await expect(
        neokingdomToken
          .connect(internalMarket)
          .transferFrom(account.address, account2.address, 10)
      )
        .emit(neokingdomToken, "Transfer")
        .withArgs(account.address, account2.address, 10);

      // The previous transfer consumed all unvested balance so any other
      // transfer should fail
      await expect(
        neokingdomToken
          .connect(internalMarket)
          .transferFrom(account.address, account2.address, 1)
      ).revertedWith("NeokingdomToken: transfer amount exceeds vesting");
    });

    it("should allow to decrease the vesting balance", async () => {
      await neokingdomToken.setVesting(account.address, 5);
      expect(await neokingdomToken.vestingBalanceOf(account.address)).equal(5);
    });

    it("should not allow to increase the vesting balance", async () => {
      await expect(
        neokingdomToken.setVesting(account.address, 200)
      ).revertedWith("NeokingdomToken: vesting can only be decreased");
    });
  });

  describe("wrap", async () => {
    it("should fail when not called by MARKET_ROLE", async () => {
      daoRoles.hasRole.reset();
      await expect(
        neokingdomToken.connect(contributor).wrap(contributor.address, 1)
      ).revertedWith(
        `AccessControl: account ${contributor.address.toLowerCase()} is missing role ${
          ROLES.MARKET_ROLE
        }`
      );
    });

    it("should transfer external token to itself", async () => {
      await neokingdomToken.wrap(contributor.address, 41);
      expect(neokingdomTokenExternal.transferFrom).calledWith(
        contributor.address,
        neokingdomToken.address,
        41
      );
    });

    it("should mint internal tokens to 'from' address", async () => {
      await neokingdomToken.wrap(contributor.address, 41);
      expect(await neokingdomToken.balanceOf(contributor.address)).equal(41);
    });
  });

  describe("unwrap", async () => {
    it("should fail when not called by MARKET_ROLE", async () => {
      daoRoles.hasRole.reset();
      await expect(
        neokingdomToken
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
        neokingdomToken.unwrap(contributor.address, contributor.address, 1)
      ).revertedWith("ERC20: burn amount exceeds balance");
    });

    it("should transfer external token to 'to' address", async () => {
      await neokingdomToken.mint(contributor.address, 41);
      await neokingdomToken.unwrap(
        contributor.address,
        contributor2.address,
        10
      );
      expect(neokingdomTokenExternal.transfer).calledWith(
        contributor2.address,
        10
      );
    });

    it("should burn internal tokens owned by 'from' address", async () => {
      await neokingdomToken.mint(contributor.address, 41);
      await neokingdomToken.unwrap(
        contributor.address,
        contributor2.address,
        10
      );
      expect(await neokingdomToken.balanceOf(contributor.address)).equal(31);
    });
  });

  describe("mint", async () => {
    it("should fail when not called by RESOLUTION_ROLE", async () => {
      daoRoles.hasRole.reset();
      await expect(
        neokingdomToken.connect(contributor).mint(contributor.address, 1)
      ).revertedWith(
        `AccessControl: account ${contributor.address.toLowerCase()} is missing role ${
          ROLES.RESOLUTION_ROLE
        }`
      );
    });

    it("should mint external tokens to itself", async () => {
      await neokingdomToken.mint(contributor.address, 41);
      expect(neokingdomTokenExternal.mint).calledWith(
        neokingdomToken.address,
        41
      );
    });

    it("should mint internal tokens to 'to' address", async () => {
      await neokingdomToken.mint(contributor.address, 41);
      expect(await neokingdomToken.balanceOf(contributor.address)).equal(41);
    });
  });

  describe("burn", async () => {
    it("should fail when not called by MARKET_ROLE", async () => {
      daoRoles.hasRole.reset();
      await expect(
        neokingdomToken.connect(contributor).burn(contributor.address, 1)
      ).revertedWith(
        `AccessControl: account ${contributor.address.toLowerCase()} is missing role ${
          ROLES.MARKET_ROLE
        }`
      );
    });

    it("should burn external tokens from itself", async () => {
      await neokingdomToken.mint(contributor.address, 41);
      await neokingdomToken.burn(contributor.address, 20);
      expect(neokingdomTokenExternal.burn).calledWith(20);
    });

    it("should burn internal tokens from 'from' address", async () => {
      await neokingdomToken.mint(contributor.address, 41);
      await neokingdomToken.burn(contributor.address, 20);
      expect(await neokingdomToken.balanceOf(contributor.address)).equal(21);
    });
  });
});
