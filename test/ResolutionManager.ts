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
import { BigNumber, ContractReceipt } from "ethers";
import { setEVMTimestamp, getEVMTimestamp, mineEVMBlock } from "./utils/evm";
import { getEventListeners } from "events";

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

    voting.mock_getDelegateAt(user1.address, user1.address);

    [user1, user2, delegate1].forEach((voter) => {
      voting.mock_canVoteAt(voter.address, true);
    });
  });

  let resolutionId: number;
  beforeEach(async () => {
    resolutionId = 1; // first resolution ID is always 1
  });

  describe("reading logic", async () => {
    it("returns all resolution types", async () => {
      const resolutionTypes = await resolution.getResolutionTypes();

      expect(resolutionTypes.length).equal(7);

      const names = [
        "amendment",
        "capitalChange",
        "preclusion",
        "fundamentalOther",
        "significant",
        "dissolution",
        "routine",
      ];
      resolutionTypes.forEach((value, i) => {
        expect(value.name).equal(names[i]);
      });
    });
  });

  describe("creation logic", async () => {
    it("allows to create a resolution", async () => {
      await expect(resolution.connect(user1).createResolution("test", 0, false))
        .to.emit(resolution, "ResolutionCreated")
        .withArgs(user1.address, resolutionId);
    });
    it("allows to create a resolution and read the resolutionId with an event", async () => {
      const tx = await resolution
        .connect(user1)
        .createResolution("test", 0, false);

      function getResolutionId(receipt: ContractReceipt) {
        const filter = resolution.filters.ResolutionCreated(resolution.address);
        for (const e of receipt.events || []) {
          if (
            e.address === filter.address &&
            // `filter.topics` is set
            e.topics[0] === filter.topics![0]
          ) {
            return e.args!["resolutionId"] as BigNumber;
          }
        }
        throw new Error("resolutionId not found");
      }
      const receipt = await tx.wait();
      expect(getResolutionId(receipt).toNumber()).equal(resolutionId);
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

      await expect(resolution.connect(user1).approveResolution(resolutionId))
        .to.emit(resolution, "ResolutionApproved")
        .withArgs(user1.address, resolutionId);
      const [, , approveTimestamp] = await resolution.resolutions(resolutionId);

      let blockTimestamp = (await ethers.provider.getBlock("latest")).timestamp;
      expect(approveTimestamp.toNumber()).equal(blockTimestamp);
    });
  });

  describe("voting prevention logic", async () => {
    it("should not allow to vote to a non voter", async () => {
      await voting.mock_canVoteAt(user1.address, false);

      await expect(
        resolution.connect(user1).vote(resolutionId, true)
      ).revertedWith("Resolution: account cannot vote");
    });

    it("should not allow to vote on a non approved resolution", async () => {
      await resolution.connect(user1).createResolution("test", 0, false);

      await expect(
        resolution.connect(user1).vote(resolutionId, false)
      ).revertedWith("Resolution: not approved");
    });

    it("should not allow to vote on a resolution when voting didn't start", async () => {
      await resolution.connect(user1).createResolution("test", 0, false);
      await resolution.approveResolution(resolutionId);

      await expect(resolution.connect(user1).vote(1, false)).revertedWith(
        "Resolution: not votable"
      );
    });

    it("should not allow to vote on a resolution when voting ended", async () => {
      await resolution.connect(user1).createResolution("test", 0, false);
      await resolution.approveResolution(resolutionId);
      let approvalTimestamp = await getEVMTimestamp();

      let votingTimestamp = approvalTimestamp + DAY * 21;
      await setEVMTimestamp(votingTimestamp);

      await expect(
        resolution.connect(user1).vote(resolutionId, false)
      ).revertedWith("Resolution: not votable");
    });

    it("should allow to vote on an approved resolution when voting started", async () => {
      await resolution.connect(user1).createResolution("test", 0, false);
      await resolution.approveResolution(resolutionId);
      let approvalTimestamp = await getEVMTimestamp();

      let votingTimestamp = approvalTimestamp + DAY * 15;
      await setEVMTimestamp(votingTimestamp);

      await resolution.connect(user1).vote(resolutionId, false);
    });
  });

  describe("voting logic", async () => {
    beforeEach(async () => {
      await resolution.connect(user1).createResolution("test", 0, false);
      await resolution.approveResolution(resolutionId);
      let approvalTimestamp = await getEVMTimestamp();

      await setEVMTimestamp(approvalTimestamp + DAY * 15);
    });

    it("should emit a specific event when there is a new YES vote", async () => {
      expect(await resolution.connect(user1).vote(resolutionId, true)).emit(
        resolution,
        "ResolutionVoted"
      );
    });

    it("should emit a specific event when there is a new NO vote", async () => {
      expect(await resolution.connect(user1).vote(resolutionId, false)).emit(
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
      await resolution.connect(user1).vote(resolutionId, true);
      await expect(
        resolution.connect(user1).vote(resolutionId, true)
      ).revertedWith("Resolution: can't repeat same vote");
    });

    it("should not allow to vote NO a second time", async () => {
      await resolution.connect(user1).vote(resolutionId, false);
      await expect(
        resolution.connect(user1).vote(resolutionId, false)
      ).revertedWith("Resolution: can't repeat same vote");
    });

    describe("single voting without delegation", async () => {
      beforeEach(async () => {
        await voting.mock_getVotingPowerAt(user1.address, 42);
      });

      it("should increase yesVotesTotal on a YES vote", async () => {
        const prevYesVotesTotal = (
          await resolution.resolutions(resolutionId)
        )[4];
        await resolution.connect(user1).vote(resolutionId, true);

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
        await resolution.connect(user1).vote(resolutionId, false);

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
        await resolution.connect(user1).vote(resolutionId, false);

        const previousYesVotes = (
          await resolution.resolutions(resolutionId)
        )[4];
        await resolution.connect(user1).vote(resolutionId, true);
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

      it("should fail when asking stats for a user who could not vote", async () => {
        await voting.mock_canVoteAt(user1.address, false);

        await expect(
          resolution.getVoterVote(resolutionId, user1.address)
        ).revertedWith("Resolution: account could not vote resolution");
      });

      it("should increment total yes when updating from no to yes", async () => {
        await resolution.connect(user1).vote(resolutionId, false);
        let previousYes = (await resolution.resolutions(resolutionId))[4];

        await resolution.connect(user1).vote(resolutionId, true);
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
          // setup delegation and voting power
          await voting.mock_getDelegateAt(delegate1.address, delegate1.address);
          await voting.mock_getVotingPowerAt(
            delegate1.address,
            delegateVotingPower
          );
          await voting.mock_getDelegateAt(user1.address, delegate1.address);
          await voting.mock_getVotingPowerAt(user1.address, 0); // because the power is transferred to the delegate
          await token.mock_balanceOfAt(user1.address, userBalance);

          await resolution.connect(delegate1).vote(resolutionId, delegateVote);
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
          // setup delegation and voting power
          await voting.mock_getDelegateAt(delegate1.address, delegate1.address);
          await voting.mock_getVotingPowerAt(user1.address, 0); // because the power is transferred to the delegate
          await token.mock_balanceOfAt(user1.address, userBalance);
          await voting.mock_getDelegateAt(user1.address, delegate1.address);
          await voting.mock_getVotingPowerAt(
            delegate1.address,
            delegateVotingPower
          );

          await resolution.connect(user1).vote(resolutionId, userVote);
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
        await voting.mock_getVotingPowerAt(
          user.address,
          votingPowers[user.address]
        );
        await voting.mock_getDelegateAt(user.address, user.address);
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

    /*
    - with delegate D that has 2 delegators (U1, U2)
      - D yes, U1 and U2 no:
        - total = D - U1 - U2
      - D no, U1 and U2 yes:
        - total = U1 + U2
      - U1 and U2 no, D yes:
        - total = D - U1 - U2
      - U1 yes, D yes, U2 no:
        - total = D - U2
      - D yes, U1 doesn't vote, U2 no:
        - total = D - U2
      - D yes, U1 yes, U2 no:
        - total = D - U2
      - D no, U1 yes, D yes:
        - total = D
      - D no, U1 and U2 yes, D yes:
        - total = D
      - D yes, U1 and U2 yes, D no:
        - total = U1 + U2
      - D yes, U1 no, U2 doesn't vote, D no
        - total = 0
    */
    describe("delegate with 2 delegators", async () => {
      const balanceUser1 = 13;
      const balanceUser2 = 3;
      const votingPowerDelegate = 17 + balanceUser1 + balanceUser2;

      beforeEach(async () => {
        await voting.mock_getDelegateAt(delegate1.address, delegate1.address);
        await voting.mock_getDelegateAt(user1.address, delegate1.address);
        await voting.mock_getDelegateAt(user2.address, delegate1.address);
        await voting.mock_getVotingPowerAt(user1.address, 0);
        await voting.mock_getVotingPowerAt(user2.address, 0);
        await token.mock_balanceOfAt(user1.address, balanceUser1);
        await token.mock_balanceOfAt(user2.address, balanceUser2);
        await voting.mock_getVotingPowerAt(
          delegate1.address,
          votingPowerDelegate
        );
      });

      async function _vote(user: SignerWithAddress, isYes: boolean) {
        await resolution.connect(user).vote(resolutionId, isYes);
      }

      async function _totalYesVotes() {
        return (await resolution.resolutions(resolutionId))[4].toNumber();
      }

      it("D yes, U1 and U2 no: D - U1 - U2", async () => {
        await _vote(delegate1, true);
        await _vote(user1, false);
        await _vote(user2, false);
        const total = await _totalYesVotes();
        expect(total).equal(votingPowerDelegate - balanceUser1 - balanceUser2);
      });

      it("D no, U1 and U2 yes: U1 + U2", async () => {
        await _vote(delegate1, false);
        await _vote(user1, true);
        await _vote(user2, true);
        const total = await _totalYesVotes();
        expect(total).equal(balanceUser1 + balanceUser2);
      });

      it("U1 and U2 no, D yes: D - U1 - U2", async () => {
        await _vote(user1, false);
        await _vote(user2, false);
        await _vote(delegate1, true);
        const total = await _totalYesVotes();
        expect(total).equal(votingPowerDelegate - balanceUser1 - balanceUser2);
      });

      it("U1 yes, D yes, U2 no: D - U2", async () => {
        await _vote(user1, true);
        await _vote(delegate1, true);
        await _vote(user2, false);
        const total = await _totalYesVotes();
        expect(total).equal(votingPowerDelegate - balanceUser2);
      });

      it("D yes, U2 no: D - U2", async () => {
        await _vote(delegate1, true);
        await _vote(user2, false);
        const total = await _totalYesVotes();
        expect(total).equal(votingPowerDelegate - balanceUser2);
      });

      it("D yes, U1 yes, U2 no: D - U2", async () => {
        await _vote(user1, true);
        await _vote(delegate1, true);
        await _vote(user2, false);
        const total = await _totalYesVotes();
        expect(total).equal(votingPowerDelegate - balanceUser2);
      });

      it("D no, U1 yes, D yes: D", async () => {
        await _vote(delegate1, false);
        await _vote(user1, true);
        await _vote(delegate1, true);
        const total = await _totalYesVotes();
        expect(total).equal(votingPowerDelegate);
      });

      it("D no, U1 U2 yes, D yes: D", async () => {
        await _vote(delegate1, false);
        await _vote(user1, true);
        await _vote(user2, true);
        await _vote(delegate1, true);
        const total = await _totalYesVotes();
        expect(total).equal(votingPowerDelegate);
      });

      it("D yes, U1 U2 yes, D no: U1 + U2", async () => {
        await _vote(delegate1, true);
        await _vote(user1, true);
        await _vote(user2, true);
        await _vote(delegate1, false);
        const total = await _totalYesVotes();
        expect(total).equal(balanceUser1 + balanceUser2);
      });

      it("D yes, U1 no, D no: 0", async () => {
        await _vote(delegate1, true);
        await _vote(user1, false);
        await _vote(delegate1, false);
        const total = await _totalYesVotes();
        expect(total).equal(0);
      });
    });
  });

  describe("resolution outcome", async () => {
    async function setupUser(user: SignerWithAddress, votingPower: number) {
      await voting.mock_getDelegateAt(user.address, user.address);
      await voting.mock_getVotingPowerAt(user.address, votingPower);
    }

    async function setupResolution(
      totalVotingPower: number,
      negative: boolean = false
    ) {
      await voting.mock_getTotalVotingPowerAt(totalVotingPower);

      await resolution.createResolution("test", 6, negative);
      await resolution.approveResolution(1);
      const approveTimestamp = await getEVMTimestamp();
      await setEVMTimestamp(approveTimestamp + 3 * DAY);
    }

    it("should return true when minimum quorum is achieved - 1 user", async () => {
      await setupUser(user1, 51);
      await setupResolution(100);

      await resolution.connect(user1).vote(1, true);
      await mineEVMBlock();

      const result = await resolution.getResolutionResult(1);
      expect(result).true;
    });

    it("should return true when minimum quorum is achieved - 2 users", async () => {
      await setupUser(user1, 25);
      await setupUser(user2, 26);

      await setupResolution(100);

      await resolution.connect(user1).vote(1, true);
      await resolution.connect(user2).vote(1, true);
      await mineEVMBlock();

      const result = await resolution.getResolutionResult(1);
      expect(result).true;
    });

    it("should return false when minimum quorum is not achieved - 1 user", async () => {
      await setupUser(user1, 50);
      await setupResolution(100);

      await resolution.connect(user1).vote(1, true);
      await mineEVMBlock();

      const result = await resolution.getResolutionResult(1);
      expect(result).false;
    });

    it("should return true when minimum quorum is not achieved - 2 users", async () => {
      await setupUser(user1, 50);
      await setupUser(user2, 1);

      await setupResolution(100);

      await resolution.connect(user1).vote(1, true);
      await resolution.connect(user2).vote(1, false);
      await mineEVMBlock();

      const result = await resolution.getResolutionResult(1);

      expect(result).false;
    });

    it("should return false when minimum quorum is achieved - 1 user, negative resolution", async () => {
      await setupUser(user1, 51);
      await setupResolution(100, true);

      const result = await resolution.getResolutionResult(1);
      expect(result).true;
    });

    it("should return false when minimum quorum is not achieved - 1 user, negative resolution", async () => {
      await setupUser(user1, 51);
      await setupResolution(100, true);

      await resolution.connect(user1).vote(1, true);

      const result = await resolution.getResolutionResult(1);
      expect(result).false;
    });

    it("should return false when minimum quorum is achieved - 2 users, negative resolution", async () => {
      await setupUser(user1, 50);
      await setupUser(user2, 1);
      await setupResolution(100, true);

      await resolution.connect(user1).vote(1, true);

      const result = await resolution.getResolutionResult(1);
      expect(result).true;
    });

    it("should return false when minimum quorum is not achieved - 2 users, negative resolution", async () => {
      await setupUser(user1, 50);
      await setupUser(user2, 1);
      await setupResolution(100, true);

      await resolution.connect(user1).vote(1, true);
      await resolution.connect(user2).vote(1, true);

      const result = await resolution.getResolutionResult(1);
      expect(result).false;
    });
  });
});
