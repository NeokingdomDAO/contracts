import { ethers, upgrades } from "hardhat";
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

const Bytes32Zero =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

const AddressZero = ethers.constants.AddressZero;

describe("Shareholder Registry", () => {
  let RESOLUTION_ROLE: string,
    OPERATOR_ROLE: string,
    SHAREHOLDER_STATUS: string,
    INVESTOR_STATUS: string,
    CONTRIBUTOR_STATUS: string,
    MANAGING_BOARD_STATUS: string;
  let shareCapital = parseEther("10");
  let registry: ShareholderRegistry;
  let voting: VotingMock;
  let operator: SignerWithAddress,
    managingBoard: SignerWithAddress,
    alice: SignerWithAddress,
    bob: SignerWithAddress;

  beforeEach(async () => {
    [operator, managingBoard, alice, bob] = await ethers.getSigners();
    const ShareholderRegistryFactory = (await ethers.getContractFactory(
      "ShareholderRegistry",
      operator
    )) as ShareholderRegistry__factory;
    const VotingMockFactory = (await ethers.getContractFactory(
      "VotingMock"
    )) as VotingMock__factory;

    registry = (await upgrades.deployProxy(
      ShareholderRegistryFactory,
      ["NKS", "Neokingdom Share"],
      {
        initializer: "initialize",
      }
    )) as ShareholderRegistry;
    await registry.deployed();

    voting = (await upgrades.deployProxy(VotingMockFactory)) as VotingMock;
    await voting.deployed();

    OPERATOR_ROLE = await roles.OPERATOR_ROLE();
    RESOLUTION_ROLE = await roles.RESOLUTION_ROLE();

    SHAREHOLDER_STATUS = await registry.SHAREHOLDER_STATUS();
    INVESTOR_STATUS = await registry.INVESTOR_STATUS();
    CONTRIBUTOR_STATUS = await registry.CONTRIBUTOR_STATUS();
    MANAGING_BOARD_STATUS = await registry.MANAGING_BOARD_STATUS();

    await registry.grantRole(RESOLUTION_ROLE, operator.address);
    await registry.grantRole(OPERATOR_ROLE, operator.address);
    await registry.setVoting(voting.address);
  });

  describe("Status management", () => {
    it("should fail if address is not a shareholder set the given type for an address", async () => {
      await expect(
        registry.setStatus(CONTRIBUTOR_STATUS, alice.address)
      ).revertedWith("ShareholderRegistry: address has no tokens");
    });

    it("should be callable only by a resolution", async () => {
      await expect(
        registry.connect(alice).setStatus(CONTRIBUTOR_STATUS, alice.address)
      ).revertedWith(
        `AccessControl: account ${alice.address.toLowerCase()} is missing role ${RESOLUTION_ROLE}`
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
      expect(
        await registry.isAtLeast(MANAGING_BOARD_STATUS, alice.address)
      ).equal(false);
    });

    it("should make Alice a shareholder and investor after a share transfer", async () => {
      expect(await registry.isAtLeast(SHAREHOLDER_STATUS, alice.address)).equal(
        false
      );
      expect(await registry.isAtLeast(INVESTOR_STATUS, alice.address)).equal(
        false
      );
      await registry.mint(alice.address, parseEther("1"));
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
      await registry.mint(alice.address, parseEther("1"));
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
      await registry.mint(alice.address, parseEther("1"));
      await registry.setStatus(CONTRIBUTOR_STATUS, alice.address);
      expect(await registry.getStatus(alice.address)).equal(CONTRIBUTOR_STATUS);
      await registry.connect(alice).approve(operator.address, parseEther("1"));
      await expect(
        registry.transferFrom(alice.address, registry.address, parseEther("1"))
      )
        .to.emit(voting, "BeforeRemoveContributor")
        .withArgs(alice.address);
    });

    it("should notify the Voting contract when status updated to investor", async () => {
      await registry.mint(alice.address, parseEther("1"));
      await registry.setStatus(CONTRIBUTOR_STATUS, alice.address);
      await expect(registry.setStatus(INVESTOR_STATUS, alice.address))
        .to.emit(voting, "BeforeRemoveContributor")
        .withArgs(alice.address);
    });

    it("should not notify the Voting contract when status updated to managingBoard", async () => {
      await registry.mint(alice.address, parseEther("1"));
      await registry.setStatus(CONTRIBUTOR_STATUS, alice.address);
      await expect(
        registry.setStatus(MANAGING_BOARD_STATUS, alice.address)
      ).to.not.emit(voting, "BeforeRemoveContributor");
    });

    it("should call afterAddContributor when status updated for the first time to contributor", async () => {
      await registry.mint(alice.address, parseEther("1"));
      await expect(
        registry.setStatus(CONTRIBUTOR_STATUS, alice.address)
      ).to.emit(voting, "AfterAddContributor");
    });

    it("should not call afterAddContributor when status is already at least contributor", async () => {
      await registry.mint(alice.address, parseEther("1"));
      await registry.setStatus(CONTRIBUTOR_STATUS, alice.address);
      await expect(
        registry.setStatus(MANAGING_BOARD_STATUS, alice.address)
      ).to.not.emit(voting, "AfterAddContributor");
    });

    it("should not notify the Voting contract when adding an investor", async () => {
      await registry.mint(alice.address, parseEther("1"));

      await expect(
        registry.setStatus(INVESTOR_STATUS, alice.address)
      ).to.not.emit(voting, "AfterAddContributor");
    });

    it("should cleanup the status when a shareholder transfers all their shares", async () => {
      await registry.mint(alice.address, parseEther("1"));
      await registry.setStatus(CONTRIBUTOR_STATUS, alice.address);
      expect(await registry.getStatus(alice.address)).equal(CONTRIBUTOR_STATUS);
      await registry.transferFrom(
        alice.address,
        registry.address,
        parseEther("1")
      );
      expect(await registry.getStatus(alice.address)).equal(Bytes32Zero);
    });
  });

  describe("Status management snapshot", () => {
    describe("snapshot", () => {
      it("allows RESOLUTION_ROLE to create a snapshot", async () => {
        await expect(registry.snapshot()).to.emit(registry, "Snapshot");
      });

      it("can only be called by RESOLUTION_ROLE", async () => {
        await expect(registry.connect(alice).snapshot()).revertedWith(
          `AccessControl: account ${alice.address.toLowerCase()} is missing role ${RESOLUTION_ROLE}`
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
        await registry.mint(alice.address, parseEther("1"));
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
        await registry.mint(registry.address, shareCapital);
        expect(await registry.totalSupply()).equal(shareCapital);
        await registry.snapshot();
        const snapshotIdBefore = await registry.getCurrentSnapshotId();
        expect(await registry.totalSupplyAt(snapshotIdBefore)).equal(
          shareCapital
        );
        await registry.mint(registry.address, parseEther("5"));
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

    describe("burn", () => {
      it("allows a resolution to burn shares of an account", async () => {
        await registry.mint(registry.address, parseEther("5"));
        await expect(() =>
          registry.burn(registry.address, parseEther("4"))
        ).changeTokenBalance(registry, registry, parseEther("-4"));
      });

      it("updates total supply", async () => {
        await registry.mint(registry.address, parseEther("5"));
        const totalSupplyBefore = await registry.totalSupply();
        await registry.burn(registry.address, parseEther("1"));

        const totalSupplyAfter = await registry.totalSupply();
        expect(totalSupplyAfter).equal(totalSupplyBefore.sub(parseEther("1")));
      });

      it("does not allow everyone without RESOLUTION_ROLE to burn shares", async () => {
        await expect(
          registry.connect(bob).burn(registry.address, 4)
        ).revertedWith(
          `AccessControl: account ${bob.address.toLowerCase()} ` +
            `is missing role ${RESOLUTION_ROLE}`
        );
      });

      it("should cleanup the account status when its share is burnt", async () => {
        await registry.mint(alice.address, parseEther("1"));
        await registry.burn(alice.address, parseEther("1"));

        expect(await registry.getStatus(alice.address)).equal(Bytes32Zero);
      });

      it("updates the snapshots", async () => {
        await registry.mint(registry.address, parseEther("5"));
        await registry.snapshot();
        const snapshotIdBefore = await registry.getCurrentSnapshotId();
        await registry.burn(registry.address, parseEther("1"));

        await registry.snapshot();
        const snapshotIdAfter = await registry.getCurrentSnapshotId();

        const totalSupplyBefore = await registry.totalSupplyAt(
          snapshotIdBefore
        );
        const totalSupplyAfter = await registry.totalSupplyAt(snapshotIdAfter);
        expect(totalSupplyAfter).equal(totalSupplyBefore.sub(parseEther("1")));
      });
    });

    describe("getStatusAt", () => {
      it("reverts with snapshot id of 0", async () => {
        await expect(registry.getStatusAt(alice.address, 0)).revertedWith(
          "Snapshottable: id is 0"
        );
      });

      it("reverts with nonexistent id ", async () => {
        const futureTs = Math.trunc(Date.now() / 1000) + 1000;
        await expect(
          registry.getStatusAt(alice.address, futureTs)
        ).revertedWith("Snapshottable: nonexistent id");
      });

      it("returns the correct status per snapshot", async () => {
        await registry.snapshot();
        const snapshotIdBefore = await registry.getCurrentSnapshotId();

        await registry.mint(alice.address, parseEther("1"));
        await registry.setStatus(CONTRIBUTOR_STATUS, alice.address);

        await registry.snapshot();
        const snapshotIdAfter = await registry.getCurrentSnapshotId();

        expect(
          await registry.getStatusAt(alice.address, snapshotIdBefore)
        ).equal(Bytes32Zero);

        expect(
          await registry.getStatusAt(alice.address, snapshotIdAfter)
        ).equal(CONTRIBUTOR_STATUS);
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

        await registry.mint(alice.address, parseEther("1"));
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

  describe("batchTransferFromDAO", async () => {
    it("allow transfering DAO shares to multiple addresses", async () => {
      await registry.mint(registry.address, parseEther("20"));

      await registry.batchTransferFromDAO([
        alice.address,
        bob.address,
        managingBoard.address,
      ]);

      expect(await registry.balanceOf(alice.address)).equal(parseEther("1"));
      expect(await registry.balanceOf(bob.address)).equal(parseEther("1"));
      expect(await registry.balanceOf(managingBoard.address)).equal(
        parseEther("1")
      );
    });

    it("should not allow anyone without RESOLUTION_ROLE to transferFromDAOBatch", async () => {
      await expect(
        registry.connect(alice).batchTransferFromDAO([])
      ).revertedWith(
        `AccessControl: account ${alice.address.toLowerCase()} is missing role ${RESOLUTION_ROLE.toLowerCase()}`
      );
    });
  });

  describe("transfer", async () => {
    it("should prevent non-DAO addresses from receiving more than 1 share", async () => {
      await expect(registry.mint(alice.address, parseEther("2"))).revertedWith(
        "ShareholderRegistry: Only the DAO can have more than 1 share"
      );
    });

    it("should prevent non-DAO addresses from receiving 1 share after they already got one", async () => {
      await registry.mint(alice.address, parseEther("1"));
      await expect(registry.mint(alice.address, parseEther("1"))).revertedWith(
        "ShareholderRegistry: Only the DAO can have more than 1 share"
      );
    });

    it("should allow the DAO to receive more than 1 share", async () => {
      await registry.mint(registry.address, parseEther("10"));

      expect(await registry.balanceOf(registry.address)).equal(
        parseEther("10")
      );
    });

    it("should allow the DAO to receive 1 share after they already got one", async () => {
      await registry.mint(registry.address, parseEther("1"));
      await registry.mint(registry.address, parseEther("1"));

      expect(await registry.balanceOf(registry.address)).equal(parseEther("2"));
    });

    it("should allow burning as many tokens as desired", async () => {
      await registry.mint(registry.address, parseEther("10"));
      await registry.burn(registry.address, parseEther("4"));

      expect(await registry.balanceOf(registry.address)).equal(parseEther("6"));
    });

    it("should allow a resolution to transfer tokens", async () => {
      await registry.mint(alice.address, parseEther("1"));
      await expect(
        // Deployer has `RESOLUTION_ROLE`
        registry.transferFrom(alice.address, bob.address, parseEther("1"))
      )
        .to.emit(registry, "Transfer")
        .withArgs(alice.address, bob.address, parseEther("1"));
    });

    it("should not allow to transfer factional tokens", async () => {
      await expect(
        registry.mint(registry.address, parseEther("0.1"))
      ).revertedWith("No fractional tokens");

      await expect(
        registry.mint(registry.address, parseEther("2.5"))
      ).revertedWith("No fractional tokens");
    });

    it("should not allow anyone without RESOLUTION_ROLE to transfer shares", async () => {
      await expect(
        registry.connect(alice).transfer(bob.address, parseEther("1"))
      ).revertedWith(
        `AccessControl: account ${alice.address.toLowerCase()} is missing role ${RESOLUTION_ROLE.toLowerCase()}`
      );
    });

    it("should not allow anyone without RESOLUTION_ROLE to transferFrom shares", async () => {
      await expect(
        registry
          .connect(alice)
          .transferFrom(alice.address, bob.address, parseEther("1"))
      ).revertedWith(
        `AccessControl: account ${alice.address.toLowerCase()} is missing role ${RESOLUTION_ROLE.toLowerCase()}`
      );
    });
  });
});
