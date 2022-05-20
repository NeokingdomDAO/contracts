import { ethers, upgrades } from "hardhat";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { solidity } from "ethereum-waffle";
import {
  ShareholderRegistry,
  Voting,
  TelediskoToken,
  ResolutionManager,
  ResolutionManagerV2Mock__factory,
} from "../typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { setEVMTimestamp, getEVMTimestamp, mineEVMBlock } from "./utils/evm";
import { deployDAO } from "./utils/deploy";

chai.use(solidity);
chai.use(chaiAsPromised);
const { expect } = chai;

const DAY = 60 * 60 * 24;

describe("Upgrade", () => {
  let voting: Voting;
  let token: TelediskoToken;
  let shareholderRegistry: ShareholderRegistry;
  let resolution: ResolutionManager;
  let managingBoardStatus: string;
  let contributorStatus: string;
  let investorStatus: string;
  let deployer: SignerWithAddress,
    managingBoard: SignerWithAddress,
    user1: SignerWithAddress,
    user2: SignerWithAddress,
    user3: SignerWithAddress;

  beforeEach(async () => {
    [deployer, managingBoard, user1, user2, user3] = await ethers.getSigners();
    [voting, token, shareholderRegistry, resolution] = await deployDAO(
      deployer,
      managingBoard
    );

    managingBoardStatus = await shareholderRegistry.MANAGING_BOARD_STATUS();
    contributorStatus = await shareholderRegistry.CONTRIBUTOR_STATUS();
    investorStatus = await shareholderRegistry.INVESTOR_STATUS();
  });

  describe("minor upgrades", async () => {
    var currentResolution: number;
    beforeEach(async () => {
      currentResolution = 0;
    });

    async function _mintTokens(user: SignerWithAddress, tokens: number) {
      await token.mint(user.address, tokens);
    }

    async function _prepareForVoting(user: SignerWithAddress, tokens: number) {
      await shareholderRegistry.mint(user.address, 1);
      await shareholderRegistry.setStatus(contributorStatus, user.address);
      await _mintTokens(user, tokens);
    }

    async function _prepareResolution(type: number) {
      currentResolution++;
      await resolution.connect(user1).createResolution("Qxtest", type, false);
      await resolution
        .connect(managingBoard)
        .approveResolution(currentResolution);

      return currentResolution;
    }

    it("can change notice and voting period of a resolution type", async () => {
      await _prepareForVoting(user1, 42);
      const resolutionId = await _prepareResolution(6);
      const resolutionObject = await resolution.resolutions(resolutionId);

      await expect(
        resolution.connect(user1).vote(resolutionId, true)
      ).revertedWith("Resolution: not votable");

      // Originally is 3 days notice, 2 days voting
      const votingTimestamp =
        resolutionObject.approveTimestamp.toNumber() + DAY * 3;
      await setEVMTimestamp(votingTimestamp);

      await resolution.connect(user1).vote(resolutionId, true);

      const votingEndTimestamp = (await getEVMTimestamp()) + DAY * 2;
      await setEVMTimestamp(votingEndTimestamp);

      await expect(
        resolution.connect(user1).vote(resolutionId, false)
      ).revertedWith("Resolution: not votable");

      const ResolutionV2MockFactory = (await ethers.getContractFactory(
        "ResolutionManagerV2Mock"
      )) as ResolutionManagerV2Mock__factory;

      const resolutionV2Contract = await upgrades.upgradeProxy(
        resolution.address,
        ResolutionV2MockFactory
      );
      await resolutionV2Contract.deployed();
      await resolutionV2Contract.reinitialize();

      const newResolutionId = await _prepareResolution(6);
      const newResolutionObject = await resolutionV2Contract.resolutions(
        newResolutionId
      );

      await expect(
        resolutionV2Contract.connect(user1).vote(newResolutionId, true)
      ).revertedWith("Resolution: not votable");

      // Now it's expected to have 1 day notice, 1 days voting
      const newVotingTimestamp =
        newResolutionObject.approveTimestamp.toNumber() + DAY * 1;
      await setEVMTimestamp(newVotingTimestamp);

      await resolutionV2Contract.connect(user1).vote(newResolutionId, true);

      const newVotingEndTimestamp = (await getEVMTimestamp()) + DAY * 1;
      await setEVMTimestamp(newVotingEndTimestamp);
      await mineEVMBlock();

      await expect(
        resolutionV2Contract.connect(user1).vote(newResolutionId, false)
      ).revertedWith("Resolution: not votable");
    });
  });
});
