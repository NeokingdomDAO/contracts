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
  ShareholderRegistryMock,
  ShareholderRegistryMock__factory,
  ShareholderRegistry__factory,
  VotingMock,
  VotingMock__factory,
} from "../typechain";

import { roles } from "./utils/roles";

chai.use(solidity);
chai.use(chaiAsPromised);
const { expect } = chai;
const { MaxUint256 } = ethers.constants;

describe("GovernanceTokenSnapshot", () => {
  let snapshotId: string;

  let RESOLUTION_ROLE: string, OPERATOR_ROLE: string;
  let daoRoles: FakeContract<DAORoles>;
  let governanceToken: GovernanceToken;
  let neokingdomToken: FakeContract<INeokingdomToken>;
  let redemption: FakeContract<IRedemptionController>;
  let voting: VotingMock;
  let shareholderRegistry: MockContract<IShareholderRegistry>;
  let deployer: SignerWithAddress,
    account: SignerWithAddress,
    contributor: SignerWithAddress,
    contributor2: SignerWithAddress,
    nonContributor: SignerWithAddress;

  before(async () => {
    [deployer, account, contributor, contributor2, nonContributor] =
      await ethers.getSigners();

    daoRoles = await smock.fake("DAORoles");
    redemption = await smock.fake("IRedemptionController");
    neokingdomToken = await smock.fake("INeokingdomToken");

    const GovernanceTokenFactory = (await ethers.getContractFactory(
      "GovernanceToken",
      deployer
    )) as GovernanceToken__factory;

    const VotingMockFactory = (await ethers.getContractFactory(
      "VotingMock",
      deployer
    )) as VotingMock__factory;

    const ShareholderRegistryMockFactory = (await ethers.getContractFactory(
      "ShareholderRegistryMock",
      deployer
    )) as ShareholderRegistryMock__factory;

    governanceToken = (await upgrades.deployProxy(
      GovernanceTokenFactory,
      [daoRoles.address, "Test", "TEST"],
      { initializer: "initialize" }
    )) as GovernanceToken;
    await governanceToken.deployed();

    voting = (await upgrades.deployProxy(VotingMockFactory)) as VotingMock;
    await voting.deployed();

    RESOLUTION_ROLE = await roles.RESOLUTION_ROLE();
    OPERATOR_ROLE = await roles.OPERATOR_ROLE();
    const shareholderRegistryFactory =
      await smock.mock<ShareholderRegistry__factory>("ShareholderRegistry");
    shareholderRegistry = await shareholderRegistryFactory.deploy();

    daoRoles.hasRole.returns(true);
    // To test transfers easily, we assign the role of InternalMarket to the deployer.
    // In this way the deployer can trigger transfers in behalf of the user (if
    // there is enough allowance).
    await governanceToken.setTokenExternal(neokingdomToken.address);
    await governanceToken.setVoting(voting.address);
    await governanceToken.setShareholderRegistry(shareholderRegistry.address);
    await governanceToken.setRedemptionController(redemption.address);

    const contributorStatus = await shareholderRegistry.CONTRIBUTOR_STATUS();
    const shareholderStatus = await shareholderRegistry.SHAREHOLDER_STATUS();
    const investorStatus = await shareholderRegistry.INVESTOR_STATUS();

    await setContributor(contributor, true);
    await setContributor(contributor2, true);

    async function setContributor(user: SignerWithAddress, flag: boolean) {
      shareholderRegistry.isAtLeast
        .whenCalledWith(contributorStatus, user.address)
        .returns(flag);

      shareholderRegistry.isAtLeast
        .whenCalledWith(shareholderStatus, user.address)
        .returns(flag);

      shareholderRegistry.isAtLeast
        .whenCalledWith(investorStatus, user.address)
        .returns(flag);
    }
  });

  beforeEach(async () => {
    snapshotId = await network.provider.send("evm_snapshot");
    daoRoles.hasRole.returns(true);
    neokingdomToken.transfer.returns(true);
    neokingdomToken.transferFrom.returns(true);
  });

  afterEach(async () => {
    await network.provider.send("evm_revert", [snapshotId]);
    daoRoles.hasRole.reset();
    neokingdomToken.transfer.reset();
    neokingdomToken.transferFrom.reset();
  });

  describe("snapshot logic", async () => {
    it("should increase snapshot id", async () => {
      await governanceToken.snapshot();
      let snapshotIdBefore = await governanceToken.getCurrentSnapshotId();
      await governanceToken.snapshot();
      let snapshotIdAfter = await governanceToken.getCurrentSnapshotId();

      expect(snapshotIdBefore.toNumber()).lessThan(snapshotIdAfter.toNumber());
    });

    describe("balanceOfAt", async () => {
      it("should return the balance at the time of the snapshot - mint", async () => {
        await governanceToken.mint(contributor.address, 10);
        await governanceToken.snapshot();
        const snapshotIdBefore = await governanceToken.getCurrentSnapshotId();

        await governanceToken.mint(contributor.address, 3);
        await governanceToken.snapshot();
        const snapshotIdAfter = await governanceToken.getCurrentSnapshotId();

        const balanceBefore = await governanceToken.balanceOfAt(
          contributor.address,
          snapshotIdBefore
        );
        const balanceAfter = await governanceToken.balanceOfAt(
          contributor.address,
          snapshotIdAfter
        );

        expect(balanceBefore).equal(10);
        expect(balanceAfter).equal(13);
      });

      it("should return the balance at the time of the snapshot - transfer send", async () => {
        await governanceToken.mint(nonContributor.address, 10);
        await governanceToken.snapshot();
        const snapshotIdBefore = await governanceToken.getCurrentSnapshotId();

        await governanceToken
          .connect(nonContributor)
          .approve(deployer.address, MaxUint256);

        await governanceToken
          .connect(deployer)
          .transferFrom(nonContributor.address, contributor.address, 3);

        await governanceToken.snapshot();
        const snapshotIdAfter = await governanceToken.getCurrentSnapshotId();

        const balanceBefore = await governanceToken.balanceOfAt(
          nonContributor.address,
          snapshotIdBefore
        );
        const balanceAfter = await governanceToken.balanceOfAt(
          nonContributor.address,
          snapshotIdAfter
        );

        expect(balanceBefore).equal(10);
        expect(balanceAfter).equal(7);
      });

      it("should return the balance at the time of the snapshot - transfer receive", async () => {
        await governanceToken.mint(nonContributor.address, 10);
        await governanceToken.mint(contributor.address, 3);
        await governanceToken.snapshot();
        const snapshotIdBefore = await governanceToken.getCurrentSnapshotId();

        await governanceToken
          .connect(nonContributor)
          .approve(deployer.address, MaxUint256);

        await governanceToken
          .connect(deployer)
          .transferFrom(nonContributor.address, contributor.address, 4);

        await governanceToken.snapshot();
        const snapshotIdAfter = await governanceToken.getCurrentSnapshotId();

        const balanceBefore = await governanceToken.balanceOfAt(
          contributor.address,
          snapshotIdBefore
        );
        const balanceAfter = await governanceToken.balanceOfAt(
          contributor.address,
          snapshotIdAfter
        );

        expect(balanceBefore).equal(3);
        expect(balanceAfter).equal(7);
      });

      it("should return the balance at the time of the snapshot - unwrap", async () => {
        await governanceToken.mint(nonContributor.address, 10);
        await governanceToken.snapshot();
        const snapshotIdBefore = await governanceToken.getCurrentSnapshotId();

        await governanceToken.unwrap(
          nonContributor.address,
          nonContributor.address,
          4
        );

        await governanceToken.snapshot();
        const snapshotIdAfter = await governanceToken.getCurrentSnapshotId();

        const balanceBefore = await governanceToken.balanceOfAt(
          nonContributor.address,
          snapshotIdBefore
        );
        const balanceAfter = await governanceToken.balanceOfAt(
          nonContributor.address,
          snapshotIdAfter
        );

        expect(balanceBefore).equal(10);
        expect(balanceAfter).equal(6);
      });
    });

    describe("totalSupplyAt", async () => {
      it("should return the totalSupply at the time of the snapshot - mint", async () => {
        await governanceToken.mint(contributor.address, 10);
        await governanceToken.snapshot();
        const snapshotIdBefore = await governanceToken.getCurrentSnapshotId();

        await governanceToken.mint(nonContributor.address, 3);
        await governanceToken.snapshot();
        const snapshotIdAfter = await governanceToken.getCurrentSnapshotId();

        const balanceBefore = await governanceToken.totalSupplyAt(
          snapshotIdBefore
        );
        const balanceAfter = await governanceToken.totalSupplyAt(
          snapshotIdAfter
        );

        expect(balanceBefore).equal(10);
        expect(balanceAfter).equal(13);
      });

      it("should return the totalSupply at the time of the snapshot - transfer", async () => {
        await governanceToken.mint(nonContributor.address, 10);
        await governanceToken.snapshot();
        const snapshotIdBefore = await governanceToken.getCurrentSnapshotId();

        await governanceToken
          .connect(nonContributor)
          .approve(deployer.address, MaxUint256);

        await governanceToken
          .connect(deployer)
          .transferFrom(nonContributor.address, contributor.address, 3);

        await governanceToken.snapshot();
        const snapshotIdAfter = await governanceToken.getCurrentSnapshotId();

        const balanceBefore = await governanceToken.totalSupplyAt(
          snapshotIdBefore
        );
        const balanceAfter = await governanceToken.totalSupplyAt(
          snapshotIdAfter
        );

        expect(balanceBefore).equal(10);
        expect(balanceAfter).equal(10);
      });

      it("should return the totalSupply at the time of the snapshot - unwrap", async () => {
        await governanceToken.mint(nonContributor.address, 10);
        await governanceToken.snapshot();
        const snapshotIdBefore = await governanceToken.getCurrentSnapshotId();

        await governanceToken.unwrap(
          nonContributor.address,
          nonContributor.address,
          7
        );
        await governanceToken.snapshot();
        const snapshotIdAfter = await governanceToken.getCurrentSnapshotId();

        const balanceBefore = await governanceToken.totalSupplyAt(
          snapshotIdBefore
        );
        const balanceAfter = await governanceToken.totalSupplyAt(
          snapshotIdAfter
        );

        expect(balanceBefore).equal(10);
        expect(balanceAfter).equal(3);
      });
    });
  });
});
