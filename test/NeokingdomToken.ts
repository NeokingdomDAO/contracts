import { FakeContract, smock } from "@defi-wonderland/smock";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { solidity } from "ethereum-waffle";
import { ethers, network, upgrades } from "hardhat";

import {
  IRedemptionController,
  NeokingdomToken,
  NeokingdomToken__factory,
  ShareholderRegistryMock,
  ShareholderRegistryMock__factory,
  VotingMock,
  VotingMock__factory,
} from "../typechain";

import { roles } from "./utils/roles";

chai.use(smock.matchers);
chai.use(solidity);
chai.use(chaiAsPromised);
const { expect } = chai;

const AddressZero = ethers.constants.AddressZero;

describe("NeokingdomToken", () => {
  let snapshotId: string;

  let RESOLUTION_ROLE: string, OPERATOR_ROLE: string, ESCROW_ROLE: string;
  let neokingdomToken: NeokingdomToken;
  let voting: VotingMock;
  let shareholderRegistry: ShareholderRegistryMock;
  let redemption: FakeContract<IRedemptionController>;
  let deployer: SignerWithAddress;
  let contributor: SignerWithAddress;
  let contributor2: SignerWithAddress;
  let account: SignerWithAddress;
  let account2: SignerWithAddress;

  before(async () => {
    [deployer, contributor, contributor2, account, account2] =
      await ethers.getSigners();

    redemption = await smock.fake("IRedemptionController");

    const NeokingdomTokenFactory = (await ethers.getContractFactory(
      "NeokingdomToken",
      deployer
    )) as NeokingdomToken__factory;

    const VotingMockFactory = (await ethers.getContractFactory(
      "VotingMock",
      deployer
    )) as VotingMock__factory;

    const ShareholderRegistryMockFactory = (await ethers.getContractFactory(
      "ShareholderRegistryMock",
      deployer
    )) as ShareholderRegistryMock__factory;

    neokingdomToken = (await upgrades.deployProxy(
      NeokingdomTokenFactory,
      ["Test", "TEST"],
      { initializer: "initialize" }
    )) as NeokingdomToken;
    await neokingdomToken.deployed();

    voting = (await upgrades.deployProxy(VotingMockFactory)) as VotingMock;
    await voting.deployed();

    RESOLUTION_ROLE = await roles.RESOLUTION_ROLE();
    await neokingdomToken.grantRole(RESOLUTION_ROLE, deployer.address);

    OPERATOR_ROLE = await roles.OPERATOR_ROLE();
    await neokingdomToken.grantRole(OPERATOR_ROLE, deployer.address);

    ESCROW_ROLE = await roles.ESCROW_ROLE();
    await neokingdomToken.grantRole(ESCROW_ROLE, deployer.address);

    shareholderRegistry = (await upgrades.deployProxy(
      ShareholderRegistryMockFactory,
      {
        initializer: "initialize",
      }
    )) as ShareholderRegistryMock;
    await shareholderRegistry.deployed();

    await neokingdomToken.setVoting(voting.address);
    await neokingdomToken.setShareholderRegistry(shareholderRegistry.address);
    await neokingdomToken.setRedemptionController(redemption.address);

    const contributorStatus = await shareholderRegistry.CONTRIBUTOR_STATUS();
    const shareholderStatus = await shareholderRegistry.SHAREHOLDER_STATUS();
    const investorStatus = await shareholderRegistry.INVESTOR_STATUS();

    await setContributor(contributor, true);
    await setContributor(contributor2, true);

    async function setContributor(user: SignerWithAddress, flag: boolean) {
      await shareholderRegistry.mock_isAtLeast(
        contributorStatus,
        user.address,
        flag
      );
      await shareholderRegistry.mock_isAtLeast(
        shareholderStatus,
        user.address,
        flag
      );
      await shareholderRegistry.mock_isAtLeast(
        investorStatus,
        user.address,
        flag
      );
    }
  });

  beforeEach(async () => {
    snapshotId = await network.provider.send("evm_snapshot");
    redemption.afterMint.reset();
  });

  afterEach(async () => {
    await network.provider.send("evm_revert", [snapshotId]);
  });

  describe("token transfer logic", async () => {
    it("should call the Voting hook after a minting", async () => {
      await expect(neokingdomToken.mint(account.address, 10))
        .emit(voting, "AfterTokenTransferCalled")
        .withArgs(AddressZero, account.address, 10);
    });

    it("should call the Voting hook after a token transfer", async () => {
      neokingdomToken.mint(account.address, 10);
      await expect(
        neokingdomToken.connect(account).transfer(account2.address, 10)
      )
        .emit(voting, "AfterTokenTransferCalled")
        .withArgs(account.address, account2.address, 10);
    });

    it("should call the RedemptionController hook when mint", async () => {
      await neokingdomToken.mint(account.address, 10);
      expect(redemption.afterMint).calledWith(account.address, 10);
    });

    it("should not call the RedemptionController hook when transfer", async () => {
      await neokingdomToken.mint(account.address, 10);
      redemption.afterMint.reset();

      await neokingdomToken.connect(account).transfer(account2.address, 10);

      expect(redemption.afterMint).callCount(0);
    });
  });

  describe("transfer", async () => {
    it("should revert when called by a contributor", async () => {
      neokingdomToken.mint(contributor.address, 10);
      await expect(
        neokingdomToken.connect(contributor).transfer(contributor2.address, 1)
      ).revertedWith("NeokingdomToken: contributor cannot transfer");
    });

    it("should transfer when called by the market contract", async () => {
      const market = account;

      neokingdomToken.setInternalMarket(market.address);
      neokingdomToken.mint(contributor.address, 10);

      await neokingdomToken
        .connect(contributor)
        .approve(market.address, ethers.constants.MaxUint256);
      await expect(
        neokingdomToken
          .connect(market)
          .transferFrom(contributor.address, contributor2.address, 1)
      )
        .emit(neokingdomToken, "Transfer")
        .withArgs(contributor.address, contributor2.address, 1);
    });

    it("should transfer when called by anyone else", async () => {
      neokingdomToken.mint(account.address, 10);
      await expect(
        neokingdomToken.connect(account).transfer(contributor2.address, 1)
      )
        .emit(neokingdomToken, "Transfer")
        .withArgs(account.address, contributor2.address, 1);
    });
  });

  describe("burning", async () => {
    it("should revert when called by a contributor", async () => {
      neokingdomToken.mint(contributor.address, 10);
      await expect(neokingdomToken.burn(contributor.address, 1)).revertedWith(
        "NeokingdomToken: contributor cannot transfer"
      );
    });

    it("should burn when called by anyone else", async () => {
      neokingdomToken.mint(account.address, 10);
      await expect(neokingdomToken.burn(account.address, 1))
        .emit(neokingdomToken, "Transfer")
        .withArgs(account.address, AddressZero, 1);
    });
  });

  describe("vesting", async () => {
    it("should not allow balance in vesting to be transferred", async () => {
      await neokingdomToken.mintVesting(account.address, 100);
      await expect(
        neokingdomToken.connect(account).transfer(account2.address, 50)
      ).revertedWith("NeokingdomToken: transfer amount exceeds vesting");
    });

    it("should update the vesting balance", async () => {
      await neokingdomToken.mintVesting(account.address, 100);
      expect(await neokingdomToken.vestingBalanceOf(account.address)).equal(
        100
      );
      await neokingdomToken.mintVesting(account.address, 10);
      expect(await neokingdomToken.vestingBalanceOf(account.address)).equal(
        110
      );
    });

    it("should emit events on update the vesting balance", async () => {
      expect(await neokingdomToken.mintVesting(account.address, 100))
        .emit(neokingdomToken, "VestingSet")
        .withArgs(account.address, 100);
      expect(await neokingdomToken.mintVesting(account.address, 10))
        .emit(neokingdomToken, "VestingSet")
        .withArgs(account.address, 110);
    });

    it("should allow to transfer balance that is not vesting", async () => {
      await neokingdomToken.mint(account.address, 10);
      await neokingdomToken.mintVesting(account.address, 100);
      await expect(
        neokingdomToken.connect(account).transfer(account2.address, 10)
      )
        .emit(neokingdomToken, "Transfer")
        .withArgs(account.address, account2.address, 10);
      await expect(
        neokingdomToken.connect(account).transfer(account2.address, 1)
      ).revertedWith("NeokingdomToken: transfer amount exceeds vesting");
    });

    it("should allow to decrease the vesting balance", async () => {
      await neokingdomToken.mintVesting(account.address, 100);
      await neokingdomToken.setVesting(account.address, 90);
      expect(await neokingdomToken.vestingBalanceOf(account.address)).equal(90);
    });

    it("should not allow to increase the vesting balance", async () => {
      await neokingdomToken.mintVesting(account.address, 100);
      await expect(
        neokingdomToken.setVesting(account.address, 110)
      ).revertedWith("NeokingdomToken: vesting can only be decreased");
    });
  });
});
