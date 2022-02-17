import { ethers } from "hardhat";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { solidity } from "ethereum-waffle";
import {
  ShareholderRegistry,
  ShareholderRegistry__factory,
  VotingMock,
  VotingMock__factory,
} from "../typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { parseEther } from "ethers/lib/utils";
import { roles } from "./utils/roles";

chai.use(solidity);
chai.use(chaiAsPromised);
const { expect } = chai;

const AddressZero = ethers.constants.AddressZero;
const Bytes32Zero =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

describe("Shareholder Registry", () => {
  let MANAGER_ROLE: string,
    SHAREHOLDER_STATUS: string,
    INVESTOR_STATUS: string,
    CONTRIBUTOR_STATUS: string,
    FOUNDER_STATUS: string;
  let shareCapital = parseEther("10");
  let registry: ShareholderRegistry;
  let voting: VotingMock;
  let manager: SignerWithAddress,
    founder: SignerWithAddress,
    alice: SignerWithAddress,
    bob: SignerWithAddress,
    carol: SignerWithAddress;

  beforeEach(async () => {
    [manager, founder, alice, bob, carol] = await ethers.getSigners();
    const ShareholderRegistryFactory = (await ethers.getContractFactory(
      "ShareholderRegistry",
      manager
    )) as ShareholderRegistry__factory;
    const VotingMockFactory = (await ethers.getContractFactory(
      "VotingMock"
    )) as VotingMock__factory;

    registry = await ShareholderRegistryFactory.deploy("TS", "Teledisko Share");
    await registry.deployed();

    voting = await VotingMockFactory.deploy();
    await voting.deployed();

    MANAGER_ROLE = await roles.MANAGER_ROLE();

    SHAREHOLDER_STATUS = await registry.SHAREHOLDER_STATUS();
    INVESTOR_STATUS = await registry.INVESTOR_STATUS();
    CONTRIBUTOR_STATUS = await registry.CONTRIBUTOR_STATUS();
    FOUNDER_STATUS = await registry.FOUNDER_STATUS();

    await registry.grantRole(MANAGER_ROLE, manager.address);
    await registry.setVoting(voting.address);
    await registry.mint(founder.address, shareCapital);
    await registry.connect(founder).approve(manager.address, shareCapital);
  });

  describe("Status management", () => {
    it("should fail if address is not a shareholder set the given type for an address", async () => {
      await expect(
        registry.setStatus(CONTRIBUTOR_STATUS, alice.address)
      ).revertedWith("Shareholder: address has no tokens");
    });

    it("should be callable only by a manager", async () => {
      await expect(
        registry.connect(alice).setStatus(CONTRIBUTOR_STATUS, alice.address)
      ).revertedWith(
        `AccessControl: account ${alice.address.toLowerCase()} is missing role ${MANAGER_ROLE}`
      );
    });

    it("should say 'false' for all statuses if Alice does not have shares", async () => {
      expect(await registry.isAtLeast(SHAREHOLDER_STATUS, alice.address)).equal(
        false
      );
      expect(await registry.isAtLeast(INVESTOR_STATUS, alice.address)).equal(
        false
      );
      expect(await registry.isAtLeast(CONTRIBUTOR_STATUS, alice.address)).equal(
        false
      );
      expect(await registry.isAtLeast(FOUNDER_STATUS, alice.address)).equal(
        false
      );
    });

    it("should make Alice a shareholder and investor after a share transfer", async () => {
      expect(await registry.isAtLeast(SHAREHOLDER_STATUS, alice.address)).equal(
        false
      );
      expect(await registry.isAtLeast(INVESTOR_STATUS, alice.address)).equal(
        false
      );
      await registry.transferFrom(
        founder.address,
        alice.address,
        parseEther("1")
      );
      expect(await registry.isAtLeast(SHAREHOLDER_STATUS, alice.address)).equal(
        true
      );
      expect(await registry.isAtLeast(INVESTOR_STATUS, alice.address)).equal(
        true
      );
    });

    it("should make Alice a contributor after a share transfer and status change", async () => {
      expect(await registry.isAtLeast(SHAREHOLDER_STATUS, alice.address)).equal(
        false
      );
      expect(await registry.isAtLeast(INVESTOR_STATUS, alice.address)).equal(
        false
      );
      expect(await registry.isAtLeast(CONTRIBUTOR_STATUS, alice.address)).equal(
        false
      );
      await registry.transferFrom(
        founder.address,
        alice.address,
        parseEther("1")
      );
      await registry.setStatus(CONTRIBUTOR_STATUS, alice.address);
      expect(await registry.isAtLeast(SHAREHOLDER_STATUS, alice.address)).equal(
        true
      );
      expect(await registry.isAtLeast(INVESTOR_STATUS, alice.address)).equal(
        true
      );
      expect(await registry.isAtLeast(CONTRIBUTOR_STATUS, alice.address)).equal(
        true
      );
    });
    it("should notify the Voting contract when a shareholder transfers all their shares", async () => {
      await registry.transferFrom(
        founder.address,
        alice.address,
        parseEther("1")
      );
      await registry.setStatus(CONTRIBUTOR_STATUS, alice.address);
      expect(await registry.getStatus(alice.address)).equal(CONTRIBUTOR_STATUS);
      await expect(
        registry.connect(alice).transfer(founder.address, parseEther("1"))
      )
        .to.emit(voting, "BeforeRemoveContributor")
        .withArgs(alice.address);
    });
    it("should notify the Voting contract when status updated to investor", async () => {
      await registry.transferFrom(
        founder.address,
        alice.address,
        parseEther("1")
      );
      await registry.setStatus(CONTRIBUTOR_STATUS, alice.address);
      await expect(registry.setStatus(INVESTOR_STATUS, alice.address))
        .to.emit(voting, "BeforeRemoveContributor")
        .withArgs(alice.address);
    });
    it("should cleanup the status when a shareholder transfers all their shares", async () => {
      await registry.transferFrom(
        founder.address,
        alice.address,
        parseEther("1")
      );
      await registry.setStatus(CONTRIBUTOR_STATUS, alice.address);
      expect(await registry.getStatus(alice.address)).equal(CONTRIBUTOR_STATUS);
      await registry.connect(alice).transfer(founder.address, parseEther("1"));
      expect(await registry.getStatus(alice.address)).equal(Bytes32Zero);
    });
  });

  describe("Status management snapshot", () => {
    describe("snapshot", () => {
      it("allows MANAGER_ROLE to create a snapshot", async () => {
        await expect(registry.snapshot()).to.emit(registry, "Snapshot");
      });
      it("can only be called by MANAGER_ROLE", async () => {
        await expect(registry.connect(alice).snapshot()).revertedWith(
          `AccessControl: account ${alice.address.toLowerCase()} is missing role ${MANAGER_ROLE}`
        );
      });
    });

    describe("balanceOfAt", () => {
      it("reverts with snapshot id of 0", async () => {
        await expect(registry.balanceOfAt(alice.address, 0)).revertedWith(
          "Snapshottable: id is 0"
        );
      });
      it("reverts with nonexistent id ", async () => {
        const futureTs = Math.trunc(Date.now() / 1000) + 1000;
        await expect(
          registry.balanceOfAt(alice.address, futureTs)
        ).revertedWith("Snapshottable: nonexistent id");
      });
      it("returns the correct value per snapshot", async () => {
        expect(await registry.balanceOf(alice.address)).equal(0);
        await registry.snapshot();
        const snapshotIdBefore = await registry.getCurrentSnapshotId();
        await registry.transferFrom(
          founder.address,
          alice.address,
          parseEther("1")
        );
        expect(await registry.balanceOf(alice.address)).equal(parseEther("1"));
        expect(
          await registry.balanceOfAt(alice.address, snapshotIdBefore)
        ).equal(0);
        await registry.snapshot();
        const snapshotIdAfter = await registry.getCurrentSnapshotId();
        expect(
          await registry.balanceOfAt(alice.address, snapshotIdBefore)
        ).equal(0);
        expect(
          await registry.balanceOfAt(alice.address, snapshotIdAfter)
        ).equal(parseEther("1"));
      });
    });

    describe("totalSupplyAt", () => {
      it("reverts with snapshot id of 0", async () => {
        await expect(registry.totalSupplyAt(0)).revertedWith(
          "Snapshottable: id is 0"
        );
      });
      it("reverts with nonexistent id ", async () => {
        await registry.snapshot();
        const snapshotId = await registry.getCurrentSnapshotId();
        await expect(registry.totalSupplyAt(snapshotId.add(1000))).revertedWith(
          "Snapshottable: nonexistent id"
        );
      });
      it("returns the correct value per snapshot", async () => {
        expect(await registry.totalSupply()).equal(shareCapital);
        await registry.snapshot();
        const snapshotIdBefore = await registry.getCurrentSnapshotId();
        expect(await registry.totalSupplyAt(snapshotIdBefore)).equal(
          shareCapital
        );
        await registry.mint(founder.address, parseEther("5"));
        expect(await registry.totalSupply()).equal(
          shareCapital.add(parseEther("5"))
        );
        await registry.snapshot();
        const snapshotIdAfter = await registry.getCurrentSnapshotId();
        expect(await registry.totalSupplyAt(snapshotIdBefore)).equal(
          shareCapital
        );
        expect(await registry.totalSupplyAt(snapshotIdAfter)).equal(
          shareCapital.add(parseEther("5"))
        );
      });
    });

    describe("isAtLeastAt", () => {
      it("reverts with snapshot id of 0", async () => {
        await expect(
          registry.isAtLeastAt(CONTRIBUTOR_STATUS, alice.address, 0)
        ).revertedWith("Snapshottable: id is 0");
      });
      it("reverts with nonexistent id ", async () => {
        const futureTs = Math.trunc(Date.now() / 1000) + 1000;
        await expect(
          registry.isAtLeastAt(CONTRIBUTOR_STATUS, alice.address, futureTs)
        ).revertedWith("Snapshottable: nonexistent id");
      });
      it("returns the correct status per snapshot", async () => {
        expect(
          await registry.isAtLeast(SHAREHOLDER_STATUS, alice.address)
        ).equal(false);

        await registry.snapshot();
        const snapshotId0 = await registry.getCurrentSnapshotId();

        await registry.transferFrom(
          founder.address,
          alice.address,
          parseEther("1")
        );
        expect(
          await registry.isAtLeastAt(
            SHAREHOLDER_STATUS,
            alice.address,
            snapshotId0
          )
        ).equal(false);

        await registry.snapshot();
        const snapshotId1 = await registry.getCurrentSnapshotId();

        expect(
          await registry.isAtLeastAt(
            SHAREHOLDER_STATUS,
            alice.address,
            snapshotId0
          )
        ).equal(false);
        expect(
          await registry.isAtLeastAt(
            SHAREHOLDER_STATUS,
            alice.address,
            snapshotId1
          )
        ).equal(true);
        await registry.setStatus(CONTRIBUTOR_STATUS, alice.address);

        await registry.snapshot();
        const snapshotId2 = await registry.getCurrentSnapshotId();

        await registry.setStatus(INVESTOR_STATUS, alice.address);

        expect(
          await registry.isAtLeastAt(
            SHAREHOLDER_STATUS,
            alice.address,
            snapshotId0
          )
        ).equal(false);
        expect(
          await registry.isAtLeastAt(
            SHAREHOLDER_STATUS,
            alice.address,
            snapshotId1
          )
        ).equal(true);
        expect(
          await registry.isAtLeastAt(
            INVESTOR_STATUS,
            alice.address,
            snapshotId2
          )
        ).equal(true);
      });
    });
  });
});
