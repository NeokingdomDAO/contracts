import { FakeContract, smock } from "@defi-wonderland/smock";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { solidity } from "ethereum-waffle";
import { ethers, network, upgrades } from "hardhat";

import {
  DAORoles,
  DAORoles__factory,
  IRedemptionController,
  NeokingdomToken,
  NeokingdomToken__factory,
  ShareholderRegistryMock,
  ShareholderRegistryMock__factory,
  VotingMock,
  VotingMock__factory,
} from "../typechain";

import { roles } from "./utils/roles";

chai.use(solidity);
chai.use(chaiAsPromised);
const { expect } = chai;

describe("NeokingdomTokenSnapshot", () => {
  let snapshotId: string;

  let RESOLUTION_ROLE: string, OPERATOR_ROLE: string;
  let daoRoles: DAORoles;
  let neokingdomToken: NeokingdomToken;
  let redemption: FakeContract<IRedemptionController>;
  let voting: VotingMock;
  let shareholderRegistry: ShareholderRegistryMock;
  let deployer: SignerWithAddress,
    account: SignerWithAddress,
    contributor: SignerWithAddress,
    contributor2: SignerWithAddress,
    nonContributor: SignerWithAddress;

  before(async () => {
    [deployer, account, contributor, contributor2, nonContributor] =
      await ethers.getSigners();

    redemption = await smock.fake("IRedemptionController");

    const DAORolesFactory = (await ethers.getContractFactory(
      "DAORoles",
      deployer
    )) as DAORoles__factory;

    daoRoles = await DAORolesFactory.deploy();
    await daoRoles.deployed();

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
      [daoRoles.address, "Test", "TEST"],
      { initializer: "initialize" }
    )) as NeokingdomToken;
    await neokingdomToken.deployed();

    voting = (await upgrades.deployProxy(VotingMockFactory)) as VotingMock;
    await voting.deployed();

    RESOLUTION_ROLE = await roles.RESOLUTION_ROLE();
    await daoRoles.grantRole(RESOLUTION_ROLE, deployer.address);

    OPERATOR_ROLE = await roles.OPERATOR_ROLE();
    await daoRoles.grantRole(OPERATOR_ROLE, deployer.address);

    const ESCROW_ROLE = await roles.ESCROW_ROLE();
    await daoRoles.grantRole(ESCROW_ROLE, deployer.address);

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
  });

  afterEach(async () => {
    await network.provider.send("evm_revert", [snapshotId]);
  });

  describe("snapshot logic", async () => {
    it("should increase snapshot id", async () => {
      await neokingdomToken.snapshot();
      let snapshotIdBefore = await neokingdomToken.getCurrentSnapshotId();
      await neokingdomToken.snapshot();
      let snapshotIdAfter = await neokingdomToken.getCurrentSnapshotId();

      expect(snapshotIdBefore.toNumber()).lessThan(snapshotIdAfter.toNumber());
    });

    describe("balanceOfAt", async () => {
      it("should return the balance at the time of the snapshot - mint", async () => {
        await neokingdomToken.mint(contributor.address, 10);
        await neokingdomToken.snapshot();
        const snapshotIdBefore = await neokingdomToken.getCurrentSnapshotId();

        await neokingdomToken.mint(contributor.address, 3);
        await neokingdomToken.snapshot();
        const snapshotIdAfter = await neokingdomToken.getCurrentSnapshotId();

        const balanceBefore = await neokingdomToken.balanceOfAt(
          contributor.address,
          snapshotIdBefore
        );
        const balanceAfter = await neokingdomToken.balanceOfAt(
          contributor.address,
          snapshotIdAfter
        );

        expect(balanceBefore).equal(10);
        expect(balanceAfter).equal(13);
      });

      it("should return the balance at the time of the snapshot - transfer send", async () => {
        await neokingdomToken.mint(nonContributor.address, 10);
        await neokingdomToken.snapshot();
        const snapshotIdBefore = await neokingdomToken.getCurrentSnapshotId();

        await neokingdomToken
          .connect(nonContributor)
          .transfer(contributor.address, 3);

        await neokingdomToken.snapshot();
        const snapshotIdAfter = await neokingdomToken.getCurrentSnapshotId();

        const balanceBefore = await neokingdomToken.balanceOfAt(
          nonContributor.address,
          snapshotIdBefore
        );
        const balanceAfter = await neokingdomToken.balanceOfAt(
          nonContributor.address,
          snapshotIdAfter
        );

        expect(balanceBefore).equal(10);
        expect(balanceAfter).equal(7);
      });

      it("should return the balance at the time of the snapshot - transfer receive", async () => {
        await neokingdomToken.mint(nonContributor.address, 10);
        await neokingdomToken.mint(contributor.address, 3);
        await neokingdomToken.snapshot();
        const snapshotIdBefore = await neokingdomToken.getCurrentSnapshotId();

        await neokingdomToken
          .connect(nonContributor)
          .transfer(contributor.address, 4);

        await neokingdomToken.snapshot();
        const snapshotIdAfter = await neokingdomToken.getCurrentSnapshotId();

        const balanceBefore = await neokingdomToken.balanceOfAt(
          contributor.address,
          snapshotIdBefore
        );
        const balanceAfter = await neokingdomToken.balanceOfAt(
          contributor.address,
          snapshotIdAfter
        );

        expect(balanceBefore).equal(3);
        expect(balanceAfter).equal(7);
      });

      it("should return the balance at the time of the snapshot - burn", async () => {
        await neokingdomToken.mint(nonContributor.address, 10);
        await neokingdomToken.snapshot();
        const snapshotIdBefore = await neokingdomToken.getCurrentSnapshotId();

        await neokingdomToken.burn(nonContributor.address, 4);

        await neokingdomToken.snapshot();
        const snapshotIdAfter = await neokingdomToken.getCurrentSnapshotId();

        const balanceBefore = await neokingdomToken.balanceOfAt(
          nonContributor.address,
          snapshotIdBefore
        );
        const balanceAfter = await neokingdomToken.balanceOfAt(
          nonContributor.address,
          snapshotIdAfter
        );

        expect(balanceBefore).equal(10);
        expect(balanceAfter).equal(6);
      });
    });

    describe("totalSupplyAt", async () => {
      it("should return the totalSupply at the time of the snapshot - mint", async () => {
        await neokingdomToken.mint(contributor.address, 10);
        await neokingdomToken.snapshot();
        const snapshotIdBefore = await neokingdomToken.getCurrentSnapshotId();

        await neokingdomToken.mint(nonContributor.address, 3);
        await neokingdomToken.snapshot();
        const snapshotIdAfter = await neokingdomToken.getCurrentSnapshotId();

        const balanceBefore = await neokingdomToken.totalSupplyAt(
          snapshotIdBefore
        );
        const balanceAfter = await neokingdomToken.totalSupplyAt(
          snapshotIdAfter
        );

        expect(balanceBefore).equal(10);
        expect(balanceAfter).equal(13);
      });

      it("should return the totalSupply at the time of the snapshot - transfer", async () => {
        await neokingdomToken.mint(nonContributor.address, 10);
        await neokingdomToken.snapshot();
        const snapshotIdBefore = await neokingdomToken.getCurrentSnapshotId();

        await neokingdomToken
          .connect(nonContributor)
          .transfer(contributor.address, 3);
        await neokingdomToken.snapshot();
        const snapshotIdAfter = await neokingdomToken.getCurrentSnapshotId();

        const balanceBefore = await neokingdomToken.totalSupplyAt(
          snapshotIdBefore
        );
        const balanceAfter = await neokingdomToken.totalSupplyAt(
          snapshotIdAfter
        );

        expect(balanceBefore).equal(10);
        expect(balanceAfter).equal(10);
      });

      it("should return the totalSupply at the time of the snapshot - burn", async () => {
        await neokingdomToken.mint(nonContributor.address, 10);
        await neokingdomToken.snapshot();
        const snapshotIdBefore = await neokingdomToken.getCurrentSnapshotId();

        await neokingdomToken.burn(nonContributor.address, 7);
        await neokingdomToken.snapshot();
        const snapshotIdAfter = await neokingdomToken.getCurrentSnapshotId();

        const balanceBefore = await neokingdomToken.totalSupplyAt(
          snapshotIdBefore
        );
        const balanceAfter = await neokingdomToken.totalSupplyAt(
          snapshotIdAfter
        );

        expect(balanceBefore).equal(10);
        expect(balanceAfter).equal(3);
      });
    });
  });
});
