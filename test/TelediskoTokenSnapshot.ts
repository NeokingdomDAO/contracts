import { ethers, upgrades, network } from "hardhat";
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

describe("TelediskoTokenSnapshot", () => {
  let snapshotId: string;

  let RESOLUTION_ROLE: string, OPERATOR_ROLE: string;
  let telediskoToken: TelediskoToken;
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

    const ESCROW_ROLE = await roles.ESCROW_ROLE();
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

  beforeEach(async () => {
    snapshotId = await network.provider.send("evm_snapshot");
  });

  afterEach(async () => {
    await network.provider.send("evm_revert", [snapshotId]);
  });

  describe("snapshot logic", async () => {
    it("should increase snapshot id", async () => {
      await telediskoToken.snapshot();
      let snapshotIdBefore = await telediskoToken.getCurrentSnapshotId();
      await telediskoToken.snapshot();
      let snapshotIdAfter = await telediskoToken.getCurrentSnapshotId();

      expect(snapshotIdBefore.toNumber()).lessThan(snapshotIdAfter.toNumber());
    });

    describe("balanceOfAt", async () => {
      it("should return the balance at the time of the snapshot - mint", async () => {
        await telediskoToken.mint(contributor.address, 10);
        await telediskoToken.snapshot();
        const snapshotIdBefore = await telediskoToken.getCurrentSnapshotId();

        await telediskoToken.mint(contributor.address, 3);
        await telediskoToken.snapshot();
        const snapshotIdAfter = await telediskoToken.getCurrentSnapshotId();

        const balanceBefore = await telediskoToken.balanceOfAt(
          contributor.address,
          snapshotIdBefore
        );
        const balanceAfter = await telediskoToken.balanceOfAt(
          contributor.address,
          snapshotIdAfter
        );

        expect(balanceBefore).equal(10);
        expect(balanceAfter).equal(13);
      });

      it("should return the balance at the time of the snapshot - transfer send", async () => {
        await telediskoToken.mint(nonContributor.address, 10);
        await telediskoToken.snapshot();
        const snapshotIdBefore = await telediskoToken.getCurrentSnapshotId();

        await telediskoToken
          .connect(nonContributor)
          .transfer(contributor.address, 3);

        await telediskoToken.snapshot();
        const snapshotIdAfter = await telediskoToken.getCurrentSnapshotId();

        const balanceBefore = await telediskoToken.balanceOfAt(
          nonContributor.address,
          snapshotIdBefore
        );
        const balanceAfter = await telediskoToken.balanceOfAt(
          nonContributor.address,
          snapshotIdAfter
        );

        expect(balanceBefore).equal(10);
        expect(balanceAfter).equal(7);
      });

      it("should return the balance at the time of the snapshot - transfer receive", async () => {
        await telediskoToken.mint(nonContributor.address, 10);
        await telediskoToken.mint(contributor.address, 3);
        await telediskoToken.snapshot();
        const snapshotIdBefore = await telediskoToken.getCurrentSnapshotId();

        await telediskoToken
          .connect(nonContributor)
          .transfer(contributor.address, 4);

        await telediskoToken.snapshot();
        const snapshotIdAfter = await telediskoToken.getCurrentSnapshotId();

        const balanceBefore = await telediskoToken.balanceOfAt(
          contributor.address,
          snapshotIdBefore
        );
        const balanceAfter = await telediskoToken.balanceOfAt(
          contributor.address,
          snapshotIdAfter
        );

        expect(balanceBefore).equal(3);
        expect(balanceAfter).equal(7);
      });

      it("should return the balance at the time of the snapshot - burn", async () => {
        await telediskoToken.mint(nonContributor.address, 10);
        await telediskoToken.snapshot();
        const snapshotIdBefore = await telediskoToken.getCurrentSnapshotId();

        await telediskoToken.burn(nonContributor.address, 4);

        await telediskoToken.snapshot();
        const snapshotIdAfter = await telediskoToken.getCurrentSnapshotId();

        const balanceBefore = await telediskoToken.balanceOfAt(
          nonContributor.address,
          snapshotIdBefore
        );
        const balanceAfter = await telediskoToken.balanceOfAt(
          nonContributor.address,
          snapshotIdAfter
        );

        expect(balanceBefore).equal(10);
        expect(balanceAfter).equal(6);
      });
    });

    describe("totalSupplyAt", async () => {
      it("should return the totalSupply at the time of the snapshot - mint", async () => {
        await telediskoToken.mint(contributor.address, 10);
        await telediskoToken.snapshot();
        const snapshotIdBefore = await telediskoToken.getCurrentSnapshotId();

        await telediskoToken.mint(nonContributor.address, 3);
        await telediskoToken.snapshot();
        const snapshotIdAfter = await telediskoToken.getCurrentSnapshotId();

        const balanceBefore = await telediskoToken.totalSupplyAt(
          snapshotIdBefore
        );
        const balanceAfter = await telediskoToken.totalSupplyAt(
          snapshotIdAfter
        );

        expect(balanceBefore).equal(10);
        expect(balanceAfter).equal(13);
      });

      it("should return the totalSupply at the time of the snapshot - transfer", async () => {
        await telediskoToken.mint(nonContributor.address, 10);
        await telediskoToken.snapshot();
        const snapshotIdBefore = await telediskoToken.getCurrentSnapshotId();

        await telediskoToken
          .connect(nonContributor)
          .transfer(contributor.address, 3);
        await telediskoToken.snapshot();
        const snapshotIdAfter = await telediskoToken.getCurrentSnapshotId();

        const balanceBefore = await telediskoToken.totalSupplyAt(
          snapshotIdBefore
        );
        const balanceAfter = await telediskoToken.totalSupplyAt(
          snapshotIdAfter
        );

        expect(balanceBefore).equal(10);
        expect(balanceAfter).equal(10);
      });

      it("should return the totalSupply at the time of the snapshot - burn", async () => {
        await telediskoToken.mint(nonContributor.address, 10);
        await telediskoToken.snapshot();
        const snapshotIdBefore = await telediskoToken.getCurrentSnapshotId();

        await telediskoToken.burn(nonContributor.address, 7);
        await telediskoToken.snapshot();
        const snapshotIdAfter = await telediskoToken.getCurrentSnapshotId();

        const balanceBefore = await telediskoToken.totalSupplyAt(
          snapshotIdBefore
        );
        const balanceAfter = await telediskoToken.totalSupplyAt(
          snapshotIdAfter
        );

        expect(balanceBefore).equal(10);
        expect(balanceAfter).equal(3);
      });
    });
  });
});
