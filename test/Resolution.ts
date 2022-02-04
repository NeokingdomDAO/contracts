import { ethers, network } from "hardhat";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { solidity } from "ethereum-waffle";
import {
  ShareholderRegistryMock,
  ShareholderRegistryMock__factory,
  VotingMock,
  VotingMock__factory,
  TelediskoTokenMock,
  TelediskoTokenMock__factory,
  ResolutionManager,
  ResolutionManager__factory,
} from "../typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

chai.use(solidity);
chai.use(chaiAsPromised);
const { expect } = chai;

const DAY = 60 * 60 * 24;

const AddressZero = ethers.constants.AddressZero;

describe("Resolution", () => {
  let voting: VotingMock;
  let token: TelediskoTokenMock;
  let resolution: ResolutionManager;
  let shareholderRegistry: ShareholderRegistryMock;
  let deployer: SignerWithAddress,
    contributor1: SignerWithAddress,
    contributor2: SignerWithAddress,
    nonContributor: SignerWithAddress;

  beforeEach(async () => {
    [deployer, contributor1, contributor2, nonContributor] =
      await ethers.getSigners();
    const VotingMockFactory = (await ethers.getContractFactory(
      "VotingMock",
      deployer
    )) as VotingMock__factory;

    const TelediskoTokenMockFactory = (await ethers.getContractFactory(
      "TelediskoTokenMock",
      deployer
    )) as TelediskoTokenMock__factory;

    const ShareholderRegistryFactory = (await ethers.getContractFactory(
      "ShareholderRegistryMock",
      deployer
    )) as ShareholderRegistryMock__factory;

    const ResolutionFactory = (await ethers.getContractFactory(
      "ResolutionManager",
      deployer
    )) as ResolutionManager__factory;

    voting = await VotingMockFactory.deploy();

    token = await TelediskoTokenMockFactory.deploy();
    shareholderRegistry = await ShareholderRegistryFactory.deploy();

    await voting.deployed();
    await token.deployed();
    await shareholderRegistry.deployed();

    resolution = await ResolutionFactory.deploy(
      shareholderRegistry.address,
      token.address,
      voting.address
    );
  });

  let resolutionId: number;
  let checkpointId: number;
  beforeEach(async () => {
    let blockTimestamp = (await ethers.provider.getBlock("latest")).timestamp;
    resolutionId = blockTimestamp + 1;
    checkpointId = await network.provider.send("evm_snapshot");
    await network.provider.send("evm_setNextBlockTimestamp", [resolutionId]);
  });

  afterEach(async () => {
    await network.provider.send("evm_revert", [checkpointId]);
  });

  describe("creation logic", async () => {
    it("allows to create a resolution", async () => {
      await expect(
        resolution.connect(contributor1).createResolution("test", 0, false)
      )
        .to.emit(resolution, "ResolutionCreated")
        .withArgs(contributor1.address, resolutionId);
    });
  });

  describe("approval logic", async () => {
    it("should not allow to approve a non existing resolution", async () => {
      await expect(
        resolution.connect(contributor1).approveResolution(resolutionId)
      ).revertedWith("Resolution: does not exist");
    });

    it("should allow to approve an existing resolution", async () => {
      await resolution.connect(contributor1).createResolution("test", 0, false);

      await network.provider.send("evm_setNextBlockTimestamp", [
        resolutionId + DAY,
      ]);
      await expect(
        resolution.connect(contributor1).approveResolution(resolutionId)
      )
        .to.emit(resolution, "ResolutionApproved")
        .withArgs(contributor1.address, resolutionId);
      const [, , approveTimestamp] = await resolution.resolutions(resolutionId);
      expect(approveTimestamp.toNumber()).equal(resolutionId + DAY);
    });
  });

  describe("voting prevention logic", async () => {
    it("should not allow to vote on a non approved resolution", async () => {
      await resolution.connect(contributor1).createResolution("test", 0, false);

      await expect(
        resolution.connect(contributor1).vote(resolutionId, false)
      ).revertedWith("Resolution: not approved");
    });

    it("should not allow to vote on a resolution when voting didn't start", async () => {
      await resolution.connect(contributor1).createResolution("test", 0, false);
      await resolution.approveResolution(resolutionId);

      await expect(
        resolution.connect(contributor1).vote(resolutionId, false)
      ).revertedWith("Resolution: not votable");
    });

    it("should not allow to vote on a resolution when voting ended", async () => {
      await resolution.connect(contributor1).createResolution("test", 0, false);
      await resolution.approveResolution(resolutionId);
      let resolutionTimestamp = resolutionId;

      resolutionId += DAY * 21;
      await network.provider.send("evm_setNextBlockTimestamp", [resolutionId]);

      await expect(
        resolution.connect(contributor1).vote(resolutionTimestamp, false)
      ).revertedWith("Resolution: not votable");
    });

    it("should allow to vote on an approved resolution when voting started", async () => {
      await resolution.connect(contributor1).createResolution("test", 0, false);
      await resolution.approveResolution(resolutionId);
      let resolutionTimestamp = resolutionId;

      resolutionId += DAY * 15;
      await network.provider.send("evm_setNextBlockTimestamp", [resolutionId]);

      resolution.connect(contributor1).vote(resolutionTimestamp, false);
    });
  });

  describe("voting logic", async () => {
    beforeEach(async () => {
      await resolution.connect(contributor1).createResolution("test", 0, false);
      await resolution.approveResolution(resolutionId);

      await network.provider.send("evm_setNextBlockTimestamp", [
        resolutionId + DAY * 15,
      ]);
    });

    it("should emit a specific event when there is a new YES vote", async () => {
      expect(await resolution.vote(resolutionId, true)).emit(
        resolution,
        "ResolutionVoted"
      );
    });

    it("should emit a specific event when there is a new NO vote", async () => {
      expect(await resolution.vote(resolutionId, false)).emit(
        resolution,
        "ResolutionVoted"
      );
    });

    /*
    Cases:
    - without delegation
      - vote yes:
        - yesVotesTotal incremented by voting power
        - getVoterVote returns hasVoted true and hasVotedYes true
      - vote no: 
        - yesVotesTotal not incremented
        - getVoterVote returns hasVoted true and hasVotedYes false
      - change vote from yes to no:
        - yesVotesTotal decremented by voting power
        - getVoterVote returns hasVoted true and hasVotedYes false
      - change vote from no to yes:
        - yesVotesTotal incremented by voting power
        - getVoterVote returns hasVoted true and hasVotedYes true
      - change vote from yes to yes:
        - returns an error
      - change vote from no to no:
        - returns an error
    - with delegation
    */

    it("should not allow to vote YES a second time", async () => {
      await resolution.vote(resolutionId, true);
      await expect(resolution.vote(resolutionId, true)).revertedWith(
        "Resolution: can't repeat same vote"
      );
    });

    it("should not allow to vote NO a second time", async () => {
      await resolution.vote(resolutionId, false);
      await expect(resolution.vote(resolutionId, false)).revertedWith(
        "Resolution: can't repeat same vote"
      );
    });

    describe("voting without delegation", async () => {
      beforeEach(async () => {
        await voting.mock_getVotingPowerAt(42);
      });

      it("should increase yesVotesTotal on a YES vote", async () => {
        const prevYesVotesTotal = (
          await resolution.resolutions(resolutionId)
        )[4];
        await resolution.vote(resolutionId, true);

        const yesVotesTotal = (await resolution.resolutions(resolutionId))[4];

        expect(yesVotesTotal.sub(prevYesVotesTotal).eq(42));
      });

      it("should return the right stats on a YES vote", async () => {
        await resolution.connect(contributor1).vote(resolutionId, true);
        const [isYes, hasVoted, votingPower] = await resolution.getVoterVote(
          resolutionId,
          contributor1.address
        );
        expect(isYes).equal(true);
        expect(hasVoted).equal(true);
        expect(votingPower.eq(42));
      });

      it("should not change yesVotesTotal on a NO vote", async () => {
        const prevYesVotesTotal = (
          await resolution.resolutions(resolutionId)
        )[4];
        await resolution.vote(resolutionId, false);

        const yesVotesTotal = (await resolution.resolutions(resolutionId))[4];

        expect(yesVotesTotal.eq(prevYesVotesTotal));
      });

      it("should return the right stats on a NO vote", async () => {
        await resolution.connect(contributor1).vote(resolutionId, false);
        const [isYes, hasVoted, votingPower] = await resolution.getVoterVote(
          resolutionId,
          contributor1.address
        );
        expect(isYes).equal(false);
        expect(hasVoted).equal(true);
        expect(votingPower.eq(42));
      });

      it("should decrement total yes when updating from yes to no", async () => {
        await resolution.vote(resolutionId, false);

        const previousYesVotes = (
          await resolution.resolutions(resolutionId)
        )[4];
        await resolution.vote(resolutionId, true);
        const newYesVotes = (await resolution.resolutions(resolutionId))[4];

        expect(newYesVotes.sub(previousYesVotes).eq(42));
      });

      it("should return right stats when updating from yes to no", async () => {
        await resolution.connect(contributor1).vote(resolutionId, true);
        await resolution.connect(contributor1).vote(resolutionId, false);
        const [isYes, hasVoted, votingPower] = await resolution.getVoterVote(
          resolutionId,
          contributor1.address
        );

        expect(isYes).equal(false);
        expect(hasVoted).equal(true);
        expect(votingPower.eq(42));
      });

      it("should increment total yes when updating from no to yes", async () => {
        await resolution.vote(resolutionId, true);
        let previousYes = (await resolution.resolutions(resolutionId))[4];

        await resolution.vote(resolutionId, false);
        let newYes = (await resolution.resolutions(resolutionId))[4];

        expect(newYes.sub(previousYes).eq(42));
      });

      it("should return right stats when updating from no to yes", async () => {
        await resolution.connect(contributor1).vote(resolutionId, false);
        await resolution.connect(contributor1).vote(resolutionId, true);
        const [isYes, hasVoted, votingPower] = await resolution.getVoterVote(
          resolutionId,
          contributor1.address
        );

        expect(isYes).equal(true);
        expect(hasVoted).equal(true);
        expect(votingPower).equal(42);
      });
    });
  });
});
