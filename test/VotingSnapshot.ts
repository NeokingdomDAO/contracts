import { ethers } from "hardhat";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { solidity } from "ethereum-waffle";
import {
  VotingSnapshot,
  VotingSnapshot__factory,
  ERC20Mock,
  ERC20Mock__factory,
  ShareholderRegistryMock,
  ShareholderRegistryMock__factory,
} from "../typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

chai.use(solidity);
chai.use(chaiAsPromised);
const { expect } = chai;

const AddressZero = ethers.constants.AddressZero;

describe("VotingSnapshot", () => {
  let votingSnapshot: VotingSnapshot;
  let token: ERC20Mock;
  let shareholderRegistry: ShareholderRegistryMock;
  let deployer: SignerWithAddress,
    delegator1: SignerWithAddress,
    delegator2: SignerWithAddress,
    delegated1: SignerWithAddress,
    delegated2: SignerWithAddress,
    anon: SignerWithAddress,
    nonContributor: SignerWithAddress;

  beforeEach(async () => {
    [delegator1, delegator2, delegated1, delegated2, nonContributor] =
      await ethers.getSigners();
    const VotingSnapshotFactory = (await ethers.getContractFactory(
      "VotingSnapshot",
      deployer
    )) as VotingSnapshot__factory;

    const ERC20MockFactory = (await ethers.getContractFactory(
      "ERC20Mock",
      deployer
    )) as ERC20Mock__factory;

    const ShareholderRegistryFactory = (await ethers.getContractFactory(
      "ShareholderRegistryMock",
      deployer
    )) as ShareholderRegistryMock__factory;

    votingSnapshot = await VotingSnapshotFactory.deploy();
    token = await ERC20MockFactory.deploy(votingSnapshot.address);
    shareholderRegistry = await ShareholderRegistryFactory.deploy();

    await votingSnapshot.deployed();
    await token.deployed();
    await shareholderRegistry.deployed();

    await votingSnapshot.setToken(token.address);
    await votingSnapshot.setShareholderRegistry(shareholderRegistry.address);

    await shareholderRegistry.setNonContributor(nonContributor.address);

    [delegator1, delegator2, delegated1, delegated2].forEach((voter) => {
      votingSnapshot.connect(voter).delegate(voter.address);
    });
  });

  describe("snapshot logic", async () => {
    it("should increase snapshot id", async () => {
      await votingSnapshot.snapshot();
      let snapshotIdBefore = await votingSnapshot.getCurrentSnapshotId();
      await votingSnapshot.snapshot();
      let snapshotIdAfter = await votingSnapshot.getCurrentSnapshotId();

      expect(snapshotIdBefore.toNumber()).lessThan(snapshotIdAfter.toNumber());
    });

    describe("getDelegateAt", async () => {
      it("reverts with snapshot id of 0", async () => {
        await expect(
          votingSnapshot.getDelegateAt(anon.address, 0)
        ).revertedWith("Snapshottable: id is 0");
      });

      it("should return the delegate at the time of the snapshot", async () => {
        await votingSnapshot.connect(delegator1).delegate(delegated1.address);
        await votingSnapshot.snapshot();
        let snapshotIdBefore = await votingSnapshot.getCurrentSnapshotId();
        await votingSnapshot.connect(delegator1).delegate(delegated2.address);
        await votingSnapshot.snapshot();
        let snapshotIdAfter = await votingSnapshot.getCurrentSnapshotId();

        expect(
          await votingSnapshot.getDelegateAt(
            delegator1.address,
            snapshotIdBefore
          )
        ).equal(delegated1.address);
        expect(
          await votingSnapshot.getDelegateAt(
            delegator1.address,
            snapshotIdAfter
          )
        ).equal(delegated2.address);
      });

      it("should return the latest delegate at the time of the snapshot", async () => {
        await votingSnapshot.connect(delegator1).delegate(delegated1.address);
        await votingSnapshot.connect(delegator1).delegate(delegated2.address);
        await votingSnapshot.snapshot();
        let snapshotId = await votingSnapshot.getCurrentSnapshotId();

        expect(
          await votingSnapshot.getDelegateAt(delegator1.address, snapshotId)
        ).equal(delegated2.address);
      });

      it("should return same delegate from different snapshots if delegation failed in between", async () => {
        await votingSnapshot.snapshot();
        let snapshotIdBefore = await votingSnapshot.getCurrentSnapshotId();
        try {
          await votingSnapshot
            .connect(delegator1)
            .delegate(nonContributor.address);
        } catch {}
        await votingSnapshot.snapshot();
        let snapshotIdAfter = await votingSnapshot.getCurrentSnapshotId();

        expect(
          await votingSnapshot.getDelegateAt(delegator1.address, snapshotIdBefore)
        ).equal(delegator1.address);

        expect(
          await votingSnapshot.getDelegateAt(delegator1.address, snapshotIdAfter)
        ).equal(delegator1.address);
      });
    });

    describe("getVotesAt", async () => {
      it("reverts with snapshot id of 0", async () => {
        await expect(votingSnapshot.getVotesAt(anon.address, 0)).revertedWith(
          "Snapshottable: id is 0"
        );
      });

      it("should return the votes at the time of the snapshot - minting case", async () => {
        await token.mint(delegator1.address, 10);
        await votingSnapshot.snapshot();
        let snapshotIdBefore = await votingSnapshot.getCurrentSnapshotId();
        await token.mint(delegator1.address, 11);
        await votingSnapshot.snapshot();
        let snapshotIdAfter = await votingSnapshot.getCurrentSnapshotId();

        expect(
          await votingSnapshot.getVotesAt(delegator1.address, snapshotIdBefore)
        ).equal(10);
        expect(
          await votingSnapshot.getVotesAt(delegator1.address, snapshotIdAfter)
        ).equal(21);
      });

      it("should return the votes at the time of the snapshot - transfer case", async () => {
        await token.mint(delegator1.address, 10);
        await token.connect(delegator1).transfer(delegator2.address, 10);
        await votingSnapshot.snapshot();
        let snapshotIdBefore = await votingSnapshot.getCurrentSnapshotId();
        await token.connect(delegator2).transfer(delegator1.address, 10);
        await votingSnapshot.snapshot();
        let snapshotIdAfter = await votingSnapshot.getCurrentSnapshotId();

        expect(
          await votingSnapshot.getVotesAt(delegator1.address, snapshotIdBefore)
        ).equal(0);
        expect(
          await votingSnapshot.getVotesAt(delegator2.address, snapshotIdBefore)
        ).equal(10);

        expect(
          await votingSnapshot.getVotesAt(delegator1.address, snapshotIdAfter)
        ).equal(10);
        expect(
          await votingSnapshot.getVotesAt(delegator2.address, snapshotIdAfter)
        ).equal(0);
      });

      it("should return the votes at the time of the snapshot - delegation case", async () => {
        await token.mint(delegator1.address, 10);
        await votingSnapshot.snapshot();
        let snapshotIdBefore = await votingSnapshot.getCurrentSnapshotId();
        await votingSnapshot.connect(delegator1).delegate(delegated1.address);
        await votingSnapshot.snapshot();
        let snapshotIdAfter = await votingSnapshot.getCurrentSnapshotId();

        expect(
          await votingSnapshot.getVotesAt(delegator1.address, snapshotIdBefore)
        ).equal(10);
        expect(
          await votingSnapshot.getVotesAt(delegated1.address, snapshotIdBefore)
        ).equal(0);

        expect(
          await votingSnapshot.getVotesAt(delegator1.address, snapshotIdAfter)
        ).equal(0);
        expect(
          await votingSnapshot.getVotesAt(delegated1.address, snapshotIdAfter)
        ).equal(10);
      });

      it("should return same votes from different snapshots if delegation failed in between", async () => {
        await token.mint(delegator1.address, 10);
        await votingSnapshot.snapshot();
        let snapshotIdBefore = await votingSnapshot.getCurrentSnapshotId();
        try {
          await votingSnapshot
            .connect(delegator1)
            .delegate(nonContributor.address);
        } catch {}
        await votingSnapshot.snapshot();
        let snapshotIdAfter = await votingSnapshot.getCurrentSnapshotId();

        expect(
          await votingSnapshot.getVotesAt(delegator1.address, snapshotIdBefore)
        ).equal(10);
        expect(
          await votingSnapshot.getVotesAt(nonContributor.address, snapshotIdBefore)
        ).equal(0);

        expect(
          await votingSnapshot.getVotesAt(delegator1.address, snapshotIdAfter)
        ).equal(10);
        expect(
          await votingSnapshot.getVotesAt(nonContributor.address, snapshotIdAfter)
        ).equal(0);
      });

      it.only("should return votes at the time of the snapshots when token transferred to non contributor", async () => {
        await token.mint(delegator1.address, 10);
        await votingSnapshot.snapshot();
        let snapshotIdBefore = await votingSnapshot.getCurrentSnapshotId();
        await token.connect(delegator1).transfer(nonContributor.address, 10);
        await votingSnapshot.snapshot();
        let snapshotIdAfter = await votingSnapshot.getCurrentSnapshotId();

        expect(
          await votingSnapshot.getVotesAt(delegator1.address, snapshotIdBefore)
        ).equal(10);
        expect(
          await votingSnapshot.getVotesAt(nonContributor.address, snapshotIdBefore)
        ).equal(0);

        expect(
          await votingSnapshot.getVotesAt(delegator1.address, snapshotIdAfter)
        ).equal(0);
        expect(
          await votingSnapshot.getVotesAt(nonContributor.address, snapshotIdAfter)
        ).equal(0);
      });

      it("should return the latest votes at the time of the snapshot", async () => {
        await token.mint(delegator1.address, 10);
        await token.mint(delegator1.address, 32);
        await votingSnapshot.snapshot();
        let snapshotId = await votingSnapshot.getCurrentSnapshotId();

        expect(
          await votingSnapshot.getVotesAt(delegator1.address, snapshotId)
        ).equal(42);
      });
    });
  });
});
