import { ethers, upgrades } from "hardhat";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { solidity } from "ethereum-waffle";
import {
  TelediskoToken,
  TelediskoToken__factory,
  ShareholderRegistryMock,
  ShareholderRegistryMock__factory,
  VotingMock,
  VotingMock__factory,
} from "../typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { roles } from "./utils/roles";

chai.use(solidity);
chai.use(chaiAsPromised);
const { expect } = chai;

const AddressZero = ethers.constants.AddressZero;

const DAY = 60 * 60 * 24;
const WEEK = DAY * 7;

describe("TelediskoToken", () => {
  let RESOLUTION_ROLE: string, OPERATOR_ROLE: string, ESCROW_ROLE: string;
  let telediskoToken: TelediskoToken;
  let voting: VotingMock;
  let shareholderRegistry: ShareholderRegistryMock;
  let deployer: SignerWithAddress,
    account: SignerWithAddress,
    contributor: SignerWithAddress,
    contributor2: SignerWithAddress,
    nonContributor: SignerWithAddress;

  beforeEach(async () => {
    [deployer, account, contributor, contributor2, nonContributor] =
      await ethers.getSigners();

    const TelediskoTokenFactory = (await ethers.getContractFactory(
      "TelediskoToken",
      deployer
    )) as TelediskoToken__factory;

    const VotingMockFactory = (await ethers.getContractFactory(
      "VotingMock",
      deployer
    )) as VotingMock__factory;

    const ShareholderRegistryMockFactory = (await ethers.getContractFactory(
      "ShareholderRegistryMock",
      deployer
    )) as ShareholderRegistryMock__factory;

    telediskoToken = (await upgrades.deployProxy(
      TelediskoTokenFactory,
      ["Test", "TEST"],
      { initializer: "initialize" }
    )) as TelediskoToken;
    await telediskoToken.deployed();

    voting = (await upgrades.deployProxy(VotingMockFactory)) as VotingMock;
    await voting.deployed();

    RESOLUTION_ROLE = await roles.RESOLUTION_ROLE();
    await telediskoToken.grantRole(RESOLUTION_ROLE, deployer.address);

    OPERATOR_ROLE = await roles.OPERATOR_ROLE();
    await telediskoToken.grantRole(OPERATOR_ROLE, deployer.address);

    ESCROW_ROLE = await roles.ESCROW_ROLE();
    await telediskoToken.grantRole(ESCROW_ROLE, deployer.address);

    shareholderRegistry = (await upgrades.deployProxy(
      ShareholderRegistryMockFactory,
      {
        initializer: "initialize",
      }
    )) as ShareholderRegistryMock;
    await shareholderRegistry.deployed();

    await telediskoToken.setVoting(voting.address);
    await telediskoToken.setShareholderRegistry(shareholderRegistry.address);

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

  describe("token transfer logic", async () => {
    it("should call the Voting hook after a minting", async () => {
      await expect(telediskoToken.mint(account.address, 10))
        .emit(voting, "AfterTokenTransferCalled")
        .withArgs(AddressZero, account.address, 10);
    });

    it("should call the Voting hook after a token transfer", async () => {
      telediskoToken.mint(account.address, 10);
      await expect(
        telediskoToken.connect(account).transfer(nonContributor.address, 10)
      )
        .emit(voting, "AfterTokenTransferCalled")
        .withArgs(account.address, nonContributor.address, 10);
    });
  });

  describe("transfer", async () => {
    it("should revert when called by a contributor", async () => {
      telediskoToken.mint(contributor.address, 10);
      await expect(
        telediskoToken.connect(contributor).transfer(contributor2.address, 1)
      ).revertedWith("TelediskoToken: contributor cannot transfer");
    });

    it("should transfer when called by the market contract", async () => {
      const market = account;

      telediskoToken.setInternalMarket(market.address);
      telediskoToken.mint(contributor.address, 10);

      await telediskoToken
        .connect(contributor)
        .approve(market.address, ethers.constants.MaxUint256);
      await expect(
        telediskoToken
          .connect(market)
          .transferFrom(contributor.address, contributor2.address, 1)
      )
        .emit(telediskoToken, "Transfer")
        .withArgs(contributor.address, contributor2.address, 1);
    });

    it("should transfer when called by anyone else", async () => {
      telediskoToken.mint(account.address, 10);
      await expect(
        telediskoToken.connect(account).transfer(contributor2.address, 1)
      )
        .emit(telediskoToken, "Transfer")
        .withArgs(account.address, contributor2.address, 1);
    });
  });

  describe("burning", async () => {
    it("should revert when called by a contributor", async () => {
      telediskoToken.mint(contributor.address, 10);
      await expect(telediskoToken.burn(contributor.address, 1)).revertedWith(
        "TelediskoToken: contributor cannot transfer"
      );
    });

    it("should burn when called by anyone else", async () => {
      telediskoToken.mint(account.address, 10);
      await expect(telediskoToken.burn(account.address, 1))
        .emit(telediskoToken, "Transfer")
        .withArgs(account.address, AddressZero, 1);
    });
  });

  describe("vesting", async () => {
    it("should not allow balance in vesting to be transferred", async () => {
      await telediskoToken.mintVesting(account.address, 100);
      await expect(
        telediskoToken.connect(account).transfer(nonContributor.address, 50)
      ).revertedWith("TelediskoToken: transfer amount exceeds vesting");
    });

    it("should update the vesting balance", async () => {
      await telediskoToken.mintVesting(account.address, 100);
      expect(await telediskoToken.vestingBalanceOf(account.address)).equal(100);
      await telediskoToken.mintVesting(account.address, 10);
      expect(await telediskoToken.vestingBalanceOf(account.address)).equal(110);
    });

    it("should emit events on update the vesting balance", async () => {
      expect(await telediskoToken.mintVesting(account.address, 100))
        .emit(telediskoToken, "VestingSet")
        .withArgs(account.address, 100);
      expect(await telediskoToken.mintVesting(account.address, 10))
        .emit(telediskoToken, "VestingSet")
        .withArgs(account.address, 110);
    });

    it("should allow to transfer balance that is not vesting", async () => {
      await telediskoToken.mint(account.address, 10);
      await telediskoToken.mintVesting(account.address, 100);
      await expect(
        telediskoToken.connect(account).transfer(nonContributor.address, 10)
      )
        .emit(telediskoToken, "Transfer")
        .withArgs(account.address, nonContributor.address, 10);
      await expect(
        telediskoToken.connect(account).transfer(nonContributor.address, 1)
      ).revertedWith("TelediskoToken: transfer amount exceeds vesting");
    });

    it("should allow to decrease the vesting balance", async () => {
      await telediskoToken.mintVesting(account.address, 100);
      await telediskoToken.setVesting(account.address, 90);
      expect(await telediskoToken.vestingBalanceOf(account.address)).equal(90);
    });

    it("should not allow to increase the vesting balance", async () => {
      await telediskoToken.mintVesting(account.address, 100);
      await expect(
        telediskoToken.setVesting(account.address, 110)
      ).revertedWith("TelediskoToken: vesting can only be decreased");
    });
  });
});
