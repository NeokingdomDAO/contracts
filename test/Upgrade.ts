import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { solidity } from "ethereum-waffle";
import { parseEther } from "ethers/lib/utils";
import { ethers, network, upgrades } from "hardhat";

import {
  NeokingdomToken,
  NeokingdomTokenV2Mock__factory,
  NewNeokingdomTokenMock__factory,
  ResolutionManager,
  ResolutionManagerV2Mock__factory,
  ShareholderRegistry,
} from "../typechain";

import { NeokingdomDAOMemory } from "../lib/memory";
import {
  DEPLOY_SEQUENCE,
  generateDeployContext,
} from "../lib/sequences/deploy";
import { NeokingdomContracts } from "../lib/types";
import { getEVMTimestamp, mineEVMBlock, setEVMTimestamp } from "./utils/evm";

chai.use(solidity);
chai.use(chaiAsPromised);
const { expect } = chai;

const DAY = 60 * 60 * 24;

describe("Upgrade", () => {
  let snapshotId: string;

  let NeokingdomToken: NeokingdomToken;
  let ShareholderRegistry: ShareholderRegistry;
  let ResolutionManager: ResolutionManager;
  let managingBoardStatus: string;
  let contributorStatus: string;
  let shareholderStatus: string;
  let investorStatus: string;
  let deployer: SignerWithAddress;
  let reserve: SignerWithAddress;
  let managingBoard: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let user3: SignerWithAddress;

  before(async () => {
    [deployer, reserve, managingBoard, user1, user2, user3] =
      await ethers.getSigners();
    const n = await NeokingdomDAOMemory.initialize({
      deployer,
      reserve: reserve.address,
    });
    ({ NeokingdomToken, ShareholderRegistry, ResolutionManager } = await n.run(
      generateDeployContext,
      DEPLOY_SEQUENCE
    ));

    managingBoardStatus = await ShareholderRegistry.MANAGING_BOARD_STATUS();
    contributorStatus = await ShareholderRegistry.CONTRIBUTOR_STATUS();
    shareholderStatus = await ShareholderRegistry.SHAREHOLDER_STATUS();
    investorStatus = await ShareholderRegistry.INVESTOR_STATUS();
  });

  beforeEach(async () => {
    snapshotId = await network.provider.send("evm_snapshot");
  });

  afterEach(async () => {
    await network.provider.send("evm_revert", [snapshotId]);
  });

  describe("upgrades", async () => {
    var currentResolution: number;
    beforeEach(async () => {
      currentResolution = 0;
    });

    async function _mintTokens(user: SignerWithAddress, tokens: number) {
      await NeokingdomToken.mint(user.address, tokens);
    }

    async function _prepareForVoting(user: SignerWithAddress, tokens: number) {
      await ShareholderRegistry.mint(user.address, parseEther("1"));
      await ShareholderRegistry.setStatus(contributorStatus, user.address);
      await _mintTokens(user, tokens);
    }

    async function _prepareResolution(type: number) {
      currentResolution++;
      await ResolutionManager.connect(user1).createResolution(
        "Qxtest",
        type,
        false,
        [],
        []
      );
      await ResolutionManager.connect(managingBoard).approveResolution(
        currentResolution
      );

      return currentResolution;
    }

    it("should change previous version storage variables", async () => {
      // Change notice period of the a resolution type in the Resolution contract
      await _prepareForVoting(user1, 42);
      const resolutionId = await _prepareResolution(6);
      const resolutionObject = await ResolutionManager.resolutions(
        resolutionId
      );

      await expect(
        ResolutionManager.connect(user1).vote(resolutionId, true)
      ).revertedWith("Resolution: not votable");

      // Originally is 3 days notice, 2 days voting
      const votingTimestamp =
        resolutionObject.approveTimestamp.toNumber() + DAY * 3;
      await setEVMTimestamp(votingTimestamp);

      await ResolutionManager.connect(user1).vote(resolutionId, true);

      const votingEndTimestamp = (await getEVMTimestamp()) + DAY * 2;
      await setEVMTimestamp(votingEndTimestamp);

      await expect(
        ResolutionManager.connect(user1).vote(resolutionId, false)
      ).revertedWith("Resolution: not votable");

      const ResolutionV2MockFactory = (await ethers.getContractFactory(
        "ResolutionManagerV2Mock"
      )) as ResolutionManagerV2Mock__factory;

      const resolutionV2Contract = await upgrades.upgradeProxy(
        ResolutionManager.address,
        ResolutionV2MockFactory
      );
      await resolutionV2Contract.deployed();
      await resolutionV2Contract.reinitialize();

      const newResolutionId = await _prepareResolution(6);
      const newResolutionObject = await ResolutionManager.resolutions(
        newResolutionId
      );

      await expect(
        ResolutionManager.connect(user1).vote(newResolutionId, true)
      ).revertedWith("Resolution: not votable");

      // Now it's expected to have 1 day notice, 1 days voting
      const newVotingTimestamp =
        newResolutionObject.approveTimestamp.toNumber() + DAY * 1;
      await setEVMTimestamp(newVotingTimestamp);

      await ResolutionManager.connect(user1).vote(newResolutionId, true);

      const newVotingEndTimestamp = (await getEVMTimestamp()) + DAY * 1;
      await setEVMTimestamp(newVotingEndTimestamp);
      await mineEVMBlock();

      await expect(
        ResolutionManager.connect(user1).vote(newResolutionId, false)
      ).revertedWith("Resolution: not votable");
    });

    it("should change contract logic", async () => {
      // Prevents also shareholder from transfering their tokens on NeokingdomToken
      await ShareholderRegistry.mint(user1.address, parseEther("1"));
      await ShareholderRegistry.setStatus(contributorStatus, user1.address);
      await _mintTokens(user1, 42);

      await ShareholderRegistry.mint(user2.address, parseEther("1"));
      await ShareholderRegistry.setStatus(shareholderStatus, user2.address);
      await _mintTokens(user2, 42);

      await expect(
        NeokingdomToken.connect(user1).transfer(user2.address, 1)
      ).revertedWith("NeokingdomToken: contributor cannot transfer");

      await NeokingdomToken.connect(user2).transfer(user1.address, 1);

      const NeokingdomTokenV2MockFactory = (await ethers.getContractFactory(
        "NeokingdomTokenV2Mock"
      )) as NeokingdomTokenV2Mock__factory;

      const tokenV2Contract = await upgrades.upgradeProxy(
        NeokingdomToken.address,
        NeokingdomTokenV2MockFactory
      );
      await tokenV2Contract.deployed();

      await expect(
        NeokingdomToken.connect(user1).transfer(user2.address, 1)
      ).revertedWith("NeokingdomTokenV2: nopety nope");

      await expect(
        NeokingdomToken.connect(user2).transfer(user1.address, 1)
      ).revertedWith("NeokingdomTokenV2: nopety nope");
    });

    it("should change events", async () => {
      await expect(NeokingdomToken.mintVesting(user1.address, 31))
        .emit(NeokingdomToken, "VestingSet")
        .withArgs(user1.address, 31);

      const NewNeokingdomTokenMockFactory = (await ethers.getContractFactory(
        "NewNeokingdomTokenMock"
      )) as NewNeokingdomTokenMock__factory;

      const tokenV2Contract = await upgrades.upgradeProxy(
        NeokingdomToken.address,
        NewNeokingdomTokenMockFactory
      );
      await tokenV2Contract.deployed();

      await expect(NeokingdomToken.mintVesting(user1.address, 31))
        .emit(tokenV2Contract, "VestingSet2")
        .withArgs(deployer.address, user1.address, 31);
    });
  });
});
