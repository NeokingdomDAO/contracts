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
    user1: SignerWithAddress,
    user2: SignerWithAddress,
    delegate1: SignerWithAddress,
    nonContributor: SignerWithAddress;

  beforeEach(async () => {
    [deployer, user1, user2, delegate1, nonContributor] =
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
      await expect(resolution.connect(user1).createResolution("test", 0, false))
        .to.emit(resolution, "ResolutionCreated")
        .withArgs(user1.address, resolutionId);
    });
  });

  describe("approval logic", async () => {
    it("should not allow to approve a non existing resolution", async () => {
      await expect(
        resolution.connect(user1).approveResolution(resolutionId)
      ).revertedWith("Resolution: does not exist");
    });

    it("should allow to approve an existing resolution", async () => {
      await resolution.connect(user1).createResolution("test", 0, false);

      await network.provider.send("evm_setNextBlockTimestamp", [
        resolutionId + DAY,
      ]);
      await expect(resolution.connect(user1).approveResolution(resolutionId))
        .to.emit(resolution, "ResolutionApproved")
        .withArgs(user1.address, resolutionId);
      const [, , approveTimestamp] = await resolution.resolutions(resolutionId);
      expect(approveTimestamp.toNumber()).equal(resolutionId + DAY);
    });
  });

  describe("voting prevention logic", async () => {
    it("should not allow to vote on a non approved resolution", async () => {
      await resolution.connect(user1).createResolution("test", 0, false);

      await expect(
        resolution.connect(user1).vote(resolutionId, false)
      ).revertedWith("Resolution: not approved");
    });

    it("should not allow to vote on a resolution when voting didn't start", async () => {
      await resolution.connect(user1).createResolution("test", 0, false);
      await resolution.approveResolution(resolutionId);

      await expect(
        resolution.connect(user1).vote(resolutionId, false)
      ).revertedWith("Resolution: not votable");
    });

    it("should not allow to vote on a resolution when voting ended", async () => {
      await resolution.connect(user1).createResolution("test", 0, false);
      await resolution.approveResolution(resolutionId);
      let resolutionTimestamp = resolutionId;

      resolutionId += DAY * 21;
      await network.provider.send("evm_setNextBlockTimestamp", [resolutionId]);

      await expect(
        resolution.connect(user1).vote(resolutionTimestamp, false)
      ).revertedWith("Resolution: not votable");
    });

    it("should allow to vote on an approved resolution when voting started", async () => {
      await resolution.connect(user1).createResolution("test", 0, false);
      await resolution.approveResolution(resolutionId);
      let resolutionTimestamp = resolutionId;

      resolutionId += DAY * 15;
      await network.provider.send("evm_setNextBlockTimestamp", [resolutionId]);

      resolution.connect(user1).vote(resolutionTimestamp, false);
    });
  });

  describe("voting logic", async () => {
    beforeEach(async () => {
      await resolution.connect(user1).createResolution("test", 0, false);
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

    describe("single voting without delegation", async () => {
      beforeEach(async () => {
        await voting.mock_getVotingPowerAt(42);
      });

      it("should increase yesVotesTotal on a YES vote", async () => {
        const prevYesVotesTotal = (
          await resolution.resolutions(resolutionId)
        )[4];
        await resolution.vote(resolutionId, true);

        const yesVotesTotal = (await resolution.resolutions(resolutionId))[4];

        expect(yesVotesTotal.sub(prevYesVotesTotal).eq(42)).true;
      });

      it("should return the right stats on a YES vote", async () => {
        await resolution.connect(user1).vote(resolutionId, true);
        const [isYes, hasVoted, votingPower] = await resolution.getVoterVote(
          resolutionId,
          user1.address
        );
        expect(isYes).equal(true);
        expect(hasVoted).equal(true);
        expect(votingPower.eq(42)).true;
      });

      it("should not change yesVotesTotal on a NO vote", async () => {
        const prevYesVotesTotal = (
          await resolution.resolutions(resolutionId)
        )[4];
        await resolution.vote(resolutionId, false);

        const yesVotesTotal = (await resolution.resolutions(resolutionId))[4];

        expect(yesVotesTotal.eq(prevYesVotesTotal)).true;
      });

      it("should return the right stats on a NO vote", async () => {
        await resolution.connect(user1).vote(resolutionId, false);
        const [isYes, hasVoted, votingPower] = await resolution.getVoterVote(
          resolutionId,
          user1.address
        );
        expect(isYes).equal(false);
        expect(hasVoted).equal(true);
        expect(votingPower.eq(42)).true;
      });

      it("should decrement total yes when updating from yes to no", async () => {
        await resolution.vote(resolutionId, false);

        const previousYesVotes = (
          await resolution.resolutions(resolutionId)
        )[4];
        await resolution.vote(resolutionId, true);
        const newYesVotes = (await resolution.resolutions(resolutionId))[4];

        expect(newYesVotes.sub(previousYesVotes).eq(42)).true;
      });

      it("should return right stats when updating from yes to no", async () => {
        await resolution.connect(user1).vote(resolutionId, true);
        await resolution.connect(user1).vote(resolutionId, false);
        const [isYes, hasVoted, votingPower] = await resolution.getVoterVote(
          resolutionId,
          user1.address
        );

        expect(isYes).equal(false);
        expect(hasVoted).equal(true);
        expect(votingPower.eq(42)).true;
      });

      it("should increment total yes when updating from no to yes", async () => {
        await resolution.vote(resolutionId, false);
        let previousYes = (await resolution.resolutions(resolutionId))[4];

        await resolution.vote(resolutionId, true);
        let newYes = (await resolution.resolutions(resolutionId))[4];

        expect(newYes.sub(previousYes).eq(42)).true;
      });

      it("should return right stats when updating from no to yes", async () => {
        await resolution.connect(user1).vote(resolutionId, false);
        await resolution.connect(user1).vote(resolutionId, true);
        const [isYes, hasVoted, votingPower] = await resolution.getVoterVote(
          resolutionId,
          user1.address
        );

        expect(isYes).equal(true);
        expect(hasVoted).equal(true);
        expect(votingPower).equal(42);
      });
    });
    /*
    - with delegate and delegate only has 1 delegator
      - delegate voted yes, user votes no:
        - yesVotesTotal = delegate votingPower - user balance
      - delegate voted yes, user votes yes:
        - yesVotesTotal = delegate votingPower
      - delegate voted no, user votes no:
        - yesVotesTotal = 0
      - delegate voted no, user votes yes:
        - yesVotesTotal = user balance
      - user voted yes, delegate votes yes:
        - yesVotesTotal = delegate votingPower
      - user voted yes, delegate votes no:
        - yesVotesTotal = user balance
      - user voted no, delegate votes yes:
        - yesVotesTotal = delegate votingPower - user balance
      - user voted no, delegate votes no:
        - yesVotesTotal = 0
    */
    describe("single voting with delegation", async () => {
      const delegateVotingPower = 42; // includes the one of the user
      const userBalance = 13;

      describe("delegate votes first", async () => {
        async function _prepare(delegateVote: boolean, userVote: boolean) {
          await voting.mock_getVotingPowerAt(delegateVotingPower);
          await resolution.connect(delegate1).vote(resolutionId, delegateVote);

          // setup user
          await voting.mock_getVotingPowerAt(0); // because the power is transferred to the delegate
          await token.mock_balanceOfAt(userBalance);
          await voting.mock_getDelegateAt(delegate1.address);
          await resolution.connect(user1).vote(resolutionId, userVote);
        }

        it("should return delegate voting power when delegate voted yes and then user votes yes", async () => {
          await _prepare(true, true);
          const totalYesVotes = (await resolution.resolutions(resolutionId))[4];
          expect(totalYesVotes.toNumber()).equal(delegateVotingPower);
        });

        it("should return delegate voting power minus user balance when delegate voted yes and then user votes no", async () => {
          await _prepare(true, false);
          const totalYesVotes = (await resolution.resolutions(resolutionId))[4];
          expect(totalYesVotes.toNumber()).equal(
            delegateVotingPower - userBalance
          );
        });

        it("should return user balance as total yes when delegate voted no and then user votes yes", async () => {
          await _prepare(false, true);
          const totalYesVotes = (await resolution.resolutions(resolutionId))[4];
          expect(totalYesVotes.toNumber()).equal(userBalance);
        });

        it("should return 0 total yes when delegate voted no and then user votes no", async () => {
          await _prepare(false, false);
          const totalYesVotes = (await resolution.resolutions(resolutionId))[4];
          expect(totalYesVotes.toNumber()).equal(0);
        });
      });

      describe("user votes first", async () => {
        async function _prepare(userVote: boolean, delegateVote: boolean) {
          // setup user
          await voting.mock_getVotingPowerAt(0); // because the power is transferred to the delegate
          await token.mock_balanceOfAt(userBalance);
          await voting.mock_getDelegateAt(delegate1.address);
          await resolution.connect(user1).vote(resolutionId, userVote);

          // setup delegate
          await voting.mock_getVotingPowerAt(delegateVotingPower);
          await voting.mock_getDelegateAt(AddressZero);
          await resolution.connect(delegate1).vote(resolutionId, delegateVote);
        }

        it("should return delegate voting power when user voted yes and then delegate votes yes", async () => {
          await _prepare(true, true);
          const totalYesVotes = (await resolution.resolutions(resolutionId))[4];
          expect(totalYesVotes.toNumber()).equal(delegateVotingPower);
        });

        it("should return user balance when user voted yes and then delegate votes no", async () => {
          await _prepare(true, false);
          const totalYesVotes = (await resolution.resolutions(resolutionId))[4];
          expect(totalYesVotes.toNumber()).equal(userBalance);
        });

        it("should return delegate's voting power minus user balance when user voted no and then delegate votes yes", async () => {
          await _prepare(false, true);
          const totalYesVotes = (await resolution.resolutions(resolutionId))[4];
          expect(totalYesVotes.toNumber()).equal(
            delegateVotingPower - userBalance
          );
        });

        it("should return 0 total yes when user voted no and then delegate votes no", async () => {
          await _prepare(false, false);
          const totalYesVotes = (await resolution.resolutions(resolutionId))[4];
          expect(totalYesVotes.toNumber()).equal(0);
        });
      });
    });
    /*
    - with delegate multiple users vote
      - user 1 votes yes, user 2 votes yes:
        - yesVotesTotal = user 1 voting power + user 2 voting power
      - user 1 votes no, user 2 votes yes:
        - yesVotesTotal = user 2 voting power
      - user 1 votes yes, user 2 votes no:
        - yesVotesTotal = user 1 voting power
      - user 1 votes no, user 2 votes no:
        - yesVotesTotal = 0

      - user 1 and 2 votes yes, user 2 updates to no:
        - yesVotesTotal = user 1 voting power
      - user 1 and 2 votes no, user 2 updates to yes:
        - yesVotesTotal = user 2 voting power
      - user 1 votes no and 2 votes yes, user 2 updates to no:
        - yesVotesTotal = 0
      - user 1 votes yes and 2 votes no, user 2 updates to yes:
        - yesVotesTotal = user 1 + user 2 voting power
    */

    describe("multiple voting without delegation", async () => {
      const votingPowerUser1 = 11;
      const votingPowerUser2 = 17;
      let votingPowers: { [key: string]: number };

      beforeEach(async () => {
        votingPowers = {
          [user1.address]: votingPowerUser1,
          [user2.address]: votingPowerUser2,
        };
      });

      async function _vote(user: SignerWithAddress, isYes: boolean) {
        await voting.mock_getVotingPowerAt(votingPowers[user.address]);
        await resolution.connect(user).vote(resolutionId, isYes);
      }

      async function _totalYesVotes(resolutionId: number) {
        return (await resolution.resolutions(resolutionId))[4].toNumber();
      }

      it("should return user 1 + user 2 voting power when both user 1 and user 2 vote yes", async () => {
        await _vote(user1, true);
        await _vote(user2, true);
        const result = await _totalYesVotes(resolutionId);
        expect(result).equal(votingPowerUser1 + votingPowerUser2);
      });

      it("should return user 1 voting power when user 1 votes yes and user 2 votes no", async () => {
        await _vote(user1, true);
        await _vote(user2, false);
        const result = await _totalYesVotes(resolutionId);
        expect(result).equal(votingPowerUser1);
      });

      it("should return user 2 voting power when user 1 votes no and user 2 votes yes", async () => {
        await _vote(user1, false);
        await _vote(user2, true);
        const result = await _totalYesVotes(resolutionId);
        expect(result).equal(votingPowerUser2);
      });

      it("should return 0 when both user 1 and user 2 vote no", async () => {
        await _vote(user1, false);
        await _vote(user2, false);
        const result = await _totalYesVotes(resolutionId);
        expect(result).equal(0);
      });

      it("should return user 1 voting power when user 1 and 2 vote YES, then user 2 votes NO", async () => {
        await _vote(user1, true);
        await _vote(user2, true);
        await _vote(user2, false);
        const result = await _totalYesVotes(resolutionId);
        expect(result).equal(votingPowerUser1);
      });

      it("should return user 2 voting power when both user 1 and 2 vote NO, then user 2 votes YES", async () => {
        await _vote(user1, false);
        await _vote(user2, false);
        await _vote(user2, true);
        const result = await _totalYesVotes(resolutionId);
        expect(result).equal(votingPowerUser2);
      });

      it("should return 0 when user 1 votes NO, user 2 votes YES, user 2 votes NO", async () => {
        await _vote(user1, false);
        await _vote(user2, true);
        await _vote(user2, false);
        const result = await _totalYesVotes(resolutionId);
        expect(result).equal(0);
      });

      it("should return user 1 + user 2 voting power when user 1 votes YES, user 2 votes NO, user 2 votes YES", async () => {
        await _vote(user1, true);
        await _vote(user2, false);
        await _vote(user2, true);
        const result = await _totalYesVotes(resolutionId);
        expect(result).equal(votingPowerUser1 + votingPowerUser2);
      });
    });
  });
});
