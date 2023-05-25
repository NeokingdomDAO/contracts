import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { solidity } from "ethereum-waffle";
import { BytesLike } from "ethers";
import { parseEther } from "ethers/lib/utils";
import { ethers, network } from "hardhat";

import {
  DAORoles,
  GovernanceToken,
  InternalMarket,
  NeokingdomToken,
  RedemptionController,
  ResolutionManager,
  ShareholderRegistry,
  TokenMock,
  Voting,
} from "../typechain";

import { DEPLOY_SEQUENCE, generateDeployContext } from "../lib";
import { NeokingdomDAOMemory } from "../lib/environment/memory";
import { ROLES } from "../lib/utils";
import {
  getEVMTimestamp,
  mineEVMBlock,
  setEVMTimestamp,
  timeTravel,
} from "./utils/evm";
import { roles } from "./utils/roles";

chai.use(solidity);
chai.use(chaiAsPromised);
const { expect } = chai;
const { MaxUint256 } = ethers.constants;

const e = (v: number) => parseEther(v.toString());

const DAY = 60 * 60 * 24;
const INITIAL_USDC = 1000;
const AddressZero = ethers.constants.AddressZero;

describe("Integration", async () => {
  let snapshotId: string;
  let offerDurationDays: number;
  let redemptionStartDays: number;
  let redemptionWindowDays: number;
  let redemptionMaxDaysInThePast: number;
  let redemptionActivityWindow: number;

  let daoRoles: DAORoles;
  let voting: Voting;
  let governanceToken: GovernanceToken;
  let neokingdomToken: NeokingdomToken;
  let resolutionManager: ResolutionManager;
  let shareholderRegistry: ShareholderRegistry;
  let internalMarket: InternalMarket;
  let redemptionController: RedemptionController;
  let tokenMock: TokenMock;
  let contributorStatus: string;
  let investorStatus: string;
  let deployer: SignerWithAddress;
  let managingBoard: SignerWithAddress;
  let reserve: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let user3: SignerWithAddress;
  let free1: SignerWithAddress;
  let free2: SignerWithAddress;
  let free3: SignerWithAddress;

  before(async () => {
    [
      deployer,
      managingBoard,
      reserve,
      user1,
      user2,
      user3,
      free1,
      free2,
      free3,
    ] = await ethers.getSigners();
    const neokingdom = await NeokingdomDAOMemory.initialize({
      deployer,
      reserve: reserve.address,
    });

    await neokingdom.run(generateDeployContext, DEPLOY_SEQUENCE);

    ({
      daoRoles,
      voting,
      governanceToken,
      neokingdomToken,
      shareholderRegistry,

      resolutionManager,
      internalMarket,
      redemptionController,
      tokenMock,
    } = await neokingdom.loadContracts());

    const managingBoardStatus =
      await shareholderRegistry.MANAGING_BOARD_STATUS();

    await shareholderRegistry.mint(managingBoard.address, e(1));
    await shareholderRegistry.setStatus(
      managingBoardStatus,
      managingBoard.address
    );

    contributorStatus = await shareholderRegistry.CONTRIBUTOR_STATUS();
    investorStatus = await shareholderRegistry.INVESTOR_STATUS();

    offerDurationDays = (await internalMarket.offerDuration()).toNumber() / DAY;
    redemptionStartDays =
      (await redemptionController.redemptionStart()).toNumber() / DAY;
    redemptionWindowDays =
      (await redemptionController.redemptionWindow()).toNumber() / DAY;
    redemptionMaxDaysInThePast =
      (await redemptionController.maxDaysInThePast()).toNumber() / DAY;
    redemptionActivityWindow =
      (await redemptionController.activityWindow()).toNumber() / DAY;

    await tokenMock.mint(reserve.address, e(INITIAL_USDC));
    await tokenMock
      .connect(reserve)
      .approve(internalMarket.address, e(INITIAL_USDC));
    await tokenMock.mint(user1.address, e(INITIAL_USDC));
    await tokenMock.mint(user2.address, e(INITIAL_USDC));
    await tokenMock.mint(user3.address, e(INITIAL_USDC));

    for (let signer of [user1, user2, user3, free1, free2, free3]) {
      await tokenMock
        .connect(signer)
        .approve(internalMarket.address, MaxUint256);
      await governanceToken
        .connect(signer)
        .approve(internalMarket.address, MaxUint256);
      await neokingdomToken
        .connect(signer)
        .approve(governanceToken.address, MaxUint256);
    }
  });

  beforeEach(async () => {
    snapshotId = await network.provider.send("evm_snapshot");
  });

  afterEach(async () => {
    await network.provider.send("evm_revert", [snapshotId]);
  });

  describe("integration", async () => {
    var currentResolution: number;
    beforeEach(async () => {
      currentResolution = 24;
    });

    async function _mintTokens(user: SignerWithAddress, tokens: number) {
      await governanceToken.mint(user.address, e(tokens));
    }

    async function _makeContributor(user: SignerWithAddress, tokens: number) {
      // Make user shareholder
      await shareholderRegistry.mint(user.address, e(1));
      // Make user contributor
      await shareholderRegistry.setStatus(contributorStatus, user.address);
      // Mint some tokens
      await _mintTokens(user, tokens);
    }

    async function _makeVotable(resolutionId: number) {
      const resolutionObject = await resolutionManager.resolutions(
        resolutionId
      );
      const resolutionType = await resolutionManager.resolutionTypes(
        resolutionObject.resolutionTypeId
      );
      const votingTimestamp =
        resolutionObject.approveTimestamp.toNumber() +
        resolutionType.noticePeriod.toNumber();
      await setEVMTimestamp(votingTimestamp);
    }

    async function _endResolutionWithId(resolutionId: number) {
      const resolutionObject = await resolutionManager.resolutions(
        resolutionId
      );
      const resolutionType = await resolutionManager.resolutionTypes(
        resolutionObject.resolutionTypeId
      );
      const endTimestamp =
        resolutionObject.approveTimestamp.toNumber() +
        resolutionType.noticePeriod.toNumber() +
        resolutionType.votingPeriod.toNumber();

      const currentTimestamp = await getEVMTimestamp();

      if (currentTimestamp < endTimestamp) {
        await setEVMTimestamp(endTimestamp);
      }
    }

    async function _prepareResolution(
      type: number = 0,
      executionTo: string[] = [],
      executionData: BytesLike[] = []
    ) {
      currentResolution++;
      await resolutionManager
        .connect(user1)
        .createResolution("Qxtest", type, false, executionTo, executionData);
      await resolutionManager
        .connect(managingBoard)
        .approveResolution(currentResolution);

      return currentResolution;
    }

    async function _endResolution() {
      const votingEndTimestamp = (await getEVMTimestamp()) + DAY * 7;
      await setEVMTimestamp(votingEndTimestamp);
      await mineEVMBlock();
    }

    async function _vote(
      user: SignerWithAddress,
      isYes: boolean,
      resolutionId: number
    ) {
      await resolutionManager.connect(user).vote(resolutionId, isYes);
    }

    async function _delegate(
      user1: SignerWithAddress,
      user2: SignerWithAddress
    ) {
      await voting.connect(user1).delegate(user2.address);
    }
    // Mint token to a shareholder
    // Promote them to contributor
    // Self-delegate
    // Give some tokens
    // Create and approve resolution
    // Contributor votes resolution (yes)
    // Resolution passes
    it("allows simple DAO management (single contributor)", async () => {
      await _makeContributor(user1, 42);
      const resolutionId = await _prepareResolution();
      await _makeVotable(resolutionId);

      await _vote(user1, true, resolutionId);

      await _endResolution();

      const resolutionResult = await resolutionManager.getResolutionResult(
        resolutionId
      );

      expect(resolutionResult).equal(true);
    });

    // Mint token to a multiple shareholder
    // Promote them to contributor
    // Self-delegate
    // Give some tokens
    // Create and approve resolution
    // Enough contributors vote yes to resolution
    // Resolution passes
    it("successful resolution (multiple contributors)", async () => {
      // board member has 1 share
      // user1 has 1 share + 65 tokens
      // user2 has 1 share + 32 tokens
      // total voting power = 100
      // resolution type is 0, quorum 66%
      await _makeContributor(user1, 65);
      await _makeContributor(user2, 32);

      const resolutionId = await _prepareResolution();
      await _makeVotable(resolutionId);

      await _vote(user1, true, resolutionId);

      await _endResolution();

      const resolutionResult = await resolutionManager.getResolutionResult(
        resolutionId
      );

      expect(resolutionResult).equal(true);
    });

    // Mint token to a multiple shareholder
    // Promote them to contributor
    // Self-delegate
    // Give some tokens
    // Create and approve resolution
    // Not enough contributors vote yes to resolution
    // Resolution passes
    it("unsuccessful resolution (multiple contributors)", async () => {
      // board member has 1 share
      // user1 has 1 share + 32 tokens = 33 voting power
      // user2 has 1 share + 65 tokens = 66 voting power
      // total voting power = 100
      // resolution type is 0, quorum 66%
      await _makeContributor(user1, 32);
      await _makeContributor(user2, 65);
      const resolutionId = await _prepareResolution();
      await _makeVotable(resolutionId);

      await _vote(user1, true, resolutionId);

      await _endResolution();

      const resolutionResult = await resolutionManager.getResolutionResult(
        resolutionId
      );

      expect(resolutionResult).equal(false);
    });

    it("multiple resolutions, different voting power over time, multiple contributors", async () => {
      // board member has 1 share
      // user1 has 1 share + 65 tokens
      // user2 has 1 share + 32 tokens
      // total voting power = 100
      // resolution type is 0, quorum 66%
      await _makeContributor(user1, 65);
      await _makeContributor(user2, 32);
      const resolutionId1 = await _prepareResolution();

      // board member has 1 share
      // user1 has 1 share + 65 tokens
      // user2 has 1 share + 32 + 100 tokens
      // total voting power = 200
      // resolution type is 0, quorum 66% that is 132
      await _mintTokens(user2, 100); // make them the most powerful user
      const resolutionId2 = await _prepareResolution();

      await _makeVotable(resolutionId2); // this will automatically put resolutionId1 also up for voting
      await _vote(user1, true, resolutionId1);
      await _vote(user1, true, resolutionId2); // this will have a lower voting power

      const resolution1Result = await resolutionManager.getResolutionResult(
        resolutionId1
      );
      const resolution2Result = await resolutionManager.getResolutionResult(
        resolutionId2
      );

      expect(resolution1Result).equal(true);
      expect(resolution2Result).equal(false);
    });

    it("multiple resolutions, different voting power over time, delegation, multiple contributors", async () => {
      // board member has 1 share
      // user1 has 1 share + 65 tokens
      // user2 has 1 share + 32 tokens
      // total voting power = 100
      // resolution type is 0, quorum 66%
      await _makeContributor(user1, 65);
      await _makeContributor(user2, 32);
      // user1 voting power = 99
      await _delegate(user2, user1);
      const resolutionId1 = await _prepareResolution();

      // board member has 1 share
      // user1 has 1 share + 65 tokens
      // user2 has 1 share + 32 + 100 tokens
      // total voting power = 200
      // resolution type is 0, quorum 66% that is 132
      // user1 voting power = 199
      await _mintTokens(user2, 100); // user2 has more voting power, but it's transferred to user1 (the delegate)
      const resolutionId2 = await _prepareResolution();

      await _makeVotable(resolutionId2); // this will automatically put resolutionId1 also up for voting
      await _vote(user1, true, resolutionId1);
      await _vote(user1, true, resolutionId2);

      const resolution1Result = await resolutionManager.getResolutionResult(
        resolutionId1
      );
      const resolution2Result = await resolutionManager.getResolutionResult(
        resolutionId2
      );

      expect(resolution1Result).equal(true);
      expect(resolution2Result).equal(true);

      const resolution1User1 = await resolutionManager.getVoterVote(
        resolutionId1,
        user1.address
      );
      expect(resolution1User1.isYes).true;
      expect(resolution1User1.votingPower).equal(e(99));
      expect(resolution1User1.hasVoted).true;

      const resolution1User2 = await resolutionManager.getVoterVote(
        resolutionId1,
        user2.address
      );
      expect(resolution1User2.isYes).false;
      expect(resolution1User2.votingPower).equal(0);
      expect(resolution1User2.hasVoted).false;

      const resolution2User1 = await resolutionManager.getVoterVote(
        resolutionId2,
        user1.address
      );
      expect(resolution2User1.isYes).true;
      expect(resolution2User1.votingPower).equal(e(199));
      expect(resolution2User1.hasVoted).true;

      const resolution2User2 = await resolutionManager.getVoterVote(
        resolutionId2,
        user2.address
      );
      expect(resolution2User2.isYes).false;
      expect(resolution2User2.votingPower).equal(0);
      expect(resolution2User2.hasVoted).false;
    });

    it("only with shares, multiple resolutions, different voting power over time, delegation, multiple contributors", async () => {
      // board member has 1 share
      // user1 has 66 tokens
      // user2 has 33 tokens
      // total voting power = 100
      // resolution type is 0, quorum 66%

      await shareholderRegistry.mint(user1.address, e(66));
      await shareholderRegistry.mint(user2.address, e(33));

      await shareholderRegistry.setStatus(contributorStatus, user1.address);
      await shareholderRegistry.setStatus(contributorStatus, user2.address);

      // user1 voting power = 99
      await _delegate(user2, user1);
      const resolutionId1 = await _prepareResolution();

      // board member has 1 share
      // user1 has 66 tokens
      // user2 has 33 + 100 tokens
      // total voting power = 200
      // resolution type is 0, quorum 66% that is 132
      // user1 voting power = 199
      await shareholderRegistry.mint(user2.address, e(100)); // user2 has more voting power, but it's transferred to user1 (the delegate)
      const resolutionId2 = await _prepareResolution();

      await _makeVotable(resolutionId2); // this will automatically put resolutionId1 also up for voting
      await _vote(user1, true, resolutionId1);
      await _vote(user1, true, resolutionId2);

      const resolution1Result = await resolutionManager.getResolutionResult(
        resolutionId1
      );
      const resolution2Result = await resolutionManager.getResolutionResult(
        resolutionId2
      );

      expect(resolution1Result).equal(true);
      expect(resolution2Result).equal(true);

      const resolution1User1 = await resolutionManager.getVoterVote(
        resolutionId1,
        user1.address
      );
      expect(resolution1User1.isYes).true;
      expect(resolution1User1.votingPower).equal(e(99));
      expect(resolution1User1.hasVoted).true;

      const resolution1User2 = await resolutionManager.getVoterVote(
        resolutionId1,
        user2.address
      );
      expect(resolution1User2.isYes).false;
      expect(resolution1User2.votingPower).equal(0);
      expect(resolution1User2.hasVoted).false;

      const resolution2User1 = await resolutionManager.getVoterVote(
        resolutionId2,
        user1.address
      );
      expect(resolution2User1.isYes).true;
      expect(resolution2User1.votingPower).equal(e(199));
      expect(resolution2User1.hasVoted).true;

      const resolution2User2 = await resolutionManager.getVoterVote(
        resolutionId2,
        user2.address
      );
      expect(resolution2User2.isYes).false;
      expect(resolution2User2.votingPower).equal(0);
      expect(resolution2User2.hasVoted).false;

      // board member has 1 share
      // user1 has 66 - 50 tokens
      // user2 has 33 + 100 + 50 tokens
      // total voting power = 200
      // resolution type is 0, quorum 66% that is 132
      // user1 voting power = 199
      await shareholderRegistry.transferFrom(
        user1.address,
        user2.address,
        e(50)
      );

      // New resolution
      const resolutionId3 = await _prepareResolution();
      await _makeVotable(resolutionId3);

      // User1 votes using voting power of user1+user2
      await _vote(user1, true, resolutionId3);

      const resolution3ResultBefore =
        await resolutionManager.getResolutionResult(resolutionId3);
      expect(resolution3ResultBefore).equal(true);

      const resolution3User1 = await resolutionManager.getVoterVote(
        resolutionId3,
        user1.address
      );
      expect(resolution3User1.isYes).true;
      expect(resolution3User1.votingPower).equal(e(199));
      expect(resolution3User1.hasVoted).true;

      const resolution3User2 = await resolutionManager.getVoterVote(
        resolutionId3,
        user2.address
      );
      expect(resolution3User2.isYes).false;
      expect(resolution3User2.votingPower).equal(0);
      expect(resolution3User2.hasVoted).false;

      // User2 overrides user1's vote
      await _vote(user2, false, resolutionId3);

      const resolution3ResultAfter =
        await resolutionManager.getResolutionResult(resolutionId3);
      expect(resolution3ResultAfter).equal(false);

      const resolution3User1After = await resolutionManager.getVoterVote(
        resolutionId3,
        user1.address
      );
      expect(resolution3User1After.isYes).true;
      expect(resolution3User1After.votingPower).equal(e(16));
      expect(resolution3User1After.hasVoted).true;

      const resolution3User2After = await resolutionManager.getVoterVote(
        resolutionId3,
        user2.address
      );
      expect(resolution3User2After.isYes).false;
      expect(resolution3User2After.votingPower).equal(e(183));
      expect(resolution3User2After.hasVoted).true;
    });

    it("invalid voting should not be counted", async () => {
      const resolutionId = ++currentResolution;
      await _makeContributor(user1, 42);
      await resolutionManager
        .connect(user1)
        .createResolution("Qxtest", 0, false, [], []);
      // votes given before approval
      await expect(_vote(user1, true, resolutionId)).reverted;

      await resolutionManager
        .connect(managingBoard)
        .approveResolution(currentResolution);
      // votes given during notice
      await expect(_vote(user1, true, resolutionId)).reverted;

      await _makeVotable(resolutionId);

      // votes given from non DAO members
      await expect(_vote(user2, true, resolutionId)).reverted;
      // votes given from less than Contributors
      await shareholderRegistry.mint(user2.address, parseEther("1"));
      await shareholderRegistry.setStatus(investorStatus, user2.address);

      const resolutionId2 = await _prepareResolution();
      await _makeVotable(resolutionId2);
      await expect(_vote(user2, true, resolutionId)).reverted;

      // votes given after burning share
      _makeContributor(user3, 42);
      await daoRoles.grantRole(await roles.RESOLUTION_ROLE(), deployer.address);
      await shareholderRegistry.burn(user3.address, parseEther("1"));
      const resolutionId3 = await _prepareResolution();
      await _makeVotable(resolutionId3);
      await expect(_vote(user3, true, resolutionId3)).reverted;

      await _endResolution();
      // votes given after closure
      await expect(_vote(user1, true, resolutionId)).reverted;
      const resolution1Result = await resolutionManager.getResolutionResult(
        resolutionId
      );

      const resolution2Result = await resolutionManager.getResolutionResult(
        resolutionId2
      );

      const resolution3Result = await resolutionManager.getResolutionResult(
        resolutionId3
      );

      expect(resolution1Result).false;
      expect(resolution2Result).false;
      expect(resolution3Result).false;
    });

    it("distrust contributor", async () => {
      // There are 3 contributors
      await _makeContributor(user1, 42);
      await _makeContributor(user2, 2);
      await _makeContributor(user3, 84);
      await _delegate(user3, user1);

      // A resolution to save the world is created
      let resolutionId = await _prepareResolution(6);
      await _makeVotable(resolutionId);

      // user3 likes mahyem and votes against it, making it fail
      await _vote(user1, true, resolutionId);
      await _vote(user2, true, resolutionId);
      await _vote(user3, false, resolutionId);

      expect(await resolutionManager.getResolutionResult(resolutionId)).to.be
        .false;

      const abi = ["function setStatus(bytes32 status, address account)"];
      const iface = new ethers.utils.Interface(abi);
      const data = iface.encodeFunctionData("setStatus", [
        investorStatus,
        user3.address,
      ]);

      // Contributors propose a distrust vote against user3
      resolutionId = ++currentResolution;
      await resolutionManager
        .connect(user1)
        .createResolutionWithExclusion(
          "Qxdistrust",
          0,
          [shareholderRegistry.address],
          [data],
          user3.address
        );
      await resolutionManager
        .connect(managingBoard)
        .approveResolution(resolutionId);
      await _makeVotable(resolutionId);

      // user3 cannot vote and user1 and user2 votes are sufficient to kick user3 out
      await _vote(user1, true, resolutionId);
      await _vote(user2, true, resolutionId);
      await expect(_vote(user3, false, resolutionId)).revertedWith(
        "Resolution: account cannot vote"
      );
      await _endResolution();

      await resolutionManager.executeResolution(resolutionId);

      // user3 is not a contributor anymore
      expect(
        await shareholderRegistry.isAtLeast(contributorStatus, user3.address)
      ).to.be.false;

      // a new resolution to save the world is created
      resolutionId = await _prepareResolution(6);
      await _makeVotable(resolutionId);

      // user3 cannot vote it...
      await _vote(user1, true, resolutionId);
      await _vote(user2, true, resolutionId);
      await expect(_vote(user3, false, resolutionId)).revertedWith(
        "Resolution: account cannot vote"
      );

      // ... and finally the world is saved.
      expect(await resolutionManager.getResolutionResult(resolutionId)).to.be
        .true;
    });

    it("expect chaos", async () => {
      await _makeContributor(user1, 60);
      await _makeContributor(user2, 30);
      await _makeContributor(user3, 10);

      await _delegate(user1, user3);
      await _delegate(user2, user3);
      // -> user 1 voting power == 0 (60)
      // -> user 2 voting power == 0 (30)
      // -> user 3 voting power == 100

      const resolutionId1 = await _prepareResolution();

      await _delegate(user1, user1);
      await _mintTokens(user3, 50);
      // -> user 1 voting power == 60
      // -> user 2 voting power == 0 (30)
      // -> user 3 voting power == 90

      const resolutionId2 = await _prepareResolution();

      // User 3 is now investor, they can wrap and unwrap tokens without first
      // offering them to the other contributors
      await shareholderRegistry.setStatus(investorStatus, user3.address);
      await internalMarket.connect(user3).withdraw(user2.address, e(50));
      await internalMarket.connect(user2).deposit(e(50));
      await _mintTokens(user2, 50);
      // -> user 1 voting power == 60
      // -> user 2 voting power == 130
      // -> user 3 voting power == 0

      const resolutionId3 = await _prepareResolution();

      await shareholderRegistry.setStatus(contributorStatus, user3.address);
      // -> user 1 voting power == 60
      // -> user 2 voting power == 0 (130)
      // -> user 3 voting power == 190

      const resolutionId4 = await _prepareResolution();

      await _makeVotable(resolutionId4); // this will automatically put all resolutions also up for voting

      await _vote(user3, true, resolutionId1);
      await _vote(user2, false, resolutionId1);
      // won't pass

      await _vote(user3, true, resolutionId2);
      // won't pass

      await expect(_vote(user3, true, resolutionId3)).revertedWith(
        "Resolution: account cannot vote"
      );
      await _vote(user2, true, resolutionId3);
      // passes

      await _vote(user3, true, resolutionId4);
      // passes

      const resolution1Result = await resolutionManager.getResolutionResult(
        resolutionId1
      );
      const resolution2Result = await resolutionManager.getResolutionResult(
        resolutionId2
      );
      const resolution3Result = await resolutionManager.getResolutionResult(
        resolutionId3
      );
      const resolution4Result = await resolutionManager.getResolutionResult(
        resolutionId4
      );

      expect(resolution1Result).equal(true);
      expect(resolution2Result).equal(false);
      expect(resolution3Result).equal(true);
      expect(resolution4Result).equal(true);
    });

    it("token economics + voting", async () => {
      // board member has 1 share
      // user1 has 1 share + 47 tokens
      // user2 has 1 share + 50 tokens
      // total voting power = 100
      await _makeContributor(user1, 47);
      await _makeContributor(user2, 50);

      // Resolution type 6 is "routine", 51% quorum
      const resolutionId1 = await _prepareResolution(6);
      await _makeVotable(resolutionId1);
      await _vote(user1, true, resolutionId1);
      await _vote(user2, false, resolutionId1);

      const resolution1Result = await resolutionManager.getResolutionResult(
        resolutionId1
      );
      expect(resolution1Result).equal(false);

      await expect(
        governanceToken.connect(user2).transfer(user3.address, 2)
      ).revertedWith(
        `AccessControl: account ${user2.address.toLowerCase()} is missing role ${
          ROLES.MARKET_ROLE
        }`
      );

      await internalMarket.connect(user2).makeOffer(e(2));
      await internalMarket.connect(user1).matchOffer(user2.address, e(1));

      // board member has 1 share
      // user1 has 1 share + 48 tokens
      // user2 has 1 share + 49 tokens
      // total voting power = 100

      const resolutionId2 = await _prepareResolution(6);
      await _makeVotable(resolutionId2);
      await _vote(user1, true, resolutionId2);
      await _vote(user2, false, resolutionId2);

      const resolution2Result = await resolutionManager.getResolutionResult(
        resolutionId2
      );
      expect(resolution2Result).equal(false);

      // Let 7 days pass, so to unlock tokens from user2
      const expirationSeconds = await internalMarket.offerDuration();
      const offerExpires =
        (await getEVMTimestamp()) + expirationSeconds.toNumber();
      await setEVMTimestamp(offerExpires);
      await mineEVMBlock();

      // Tries first to transfer 2 tokens (because the user forgot that 1 was sold to user 1)
      await expect(
        internalMarket.connect(user2).withdraw(user3.address, e(2))
      ).revertedWith("InternalMarket: amount exceeds balance");
      // Tries now to transfer the right amount
      await internalMarket.connect(user2).withdraw(user3.address, e(1));
      // User3 transfers the funds to user1
      await neokingdomToken.connect(user3).transfer(user1.address, e(1));
      // user1 deposits them so they count for voting
      await internalMarket.connect(user1).deposit(e(1));

      // board member has 1 share
      // user1 has 1 share + 49 tokens
      // user2 has 1 share + 49 tokens
      // total voting power = 101
      const resolutionId3 = await _prepareResolution(6);
      await _makeVotable(resolutionId3);
      await _vote(user1, true, resolutionId3);
      await _vote(user2, false, resolutionId3);

      const resolution3Result = await resolutionManager.getResolutionResult(
        resolutionId3
      );
      expect(resolution3Result).equal(false);

      // +2 for user1
      await _mintTokens(user1, 2);
      // -1 for user2
      await internalMarket.connect(user2).makeOffer(e(1));
      // board member has 1 share
      // user1 has 1 share + 51 tokens
      // user2 has 1 share + 48 tokens
      // total voting power = 102
      const resolutionId4 = await _prepareResolution(6);
      await _makeVotable(resolutionId4);
      await _vote(user1, true, resolutionId4);
      await _vote(user2, false, resolutionId4);

      const resolution4Result = await resolutionManager.getResolutionResult(
        resolutionId4
      );
      expect(resolution4Result).equal(true);
    });

    it("internal market + voting power", async () => {
      await _makeContributor(user1, 48);
      await _makeContributor(user2, 50);

      const resolutionId1 = await _prepareResolution(6);
      await _makeVotable(resolutionId1);

      expect(await voting.getVotingPower(user1.address)).equal(e(49));
      expect(await voting.getVotingPower(user2.address)).equal(e(51));

      await internalMarket.connect(user2).makeOffer(e(2));
      await internalMarket.connect(user1).matchOffer(user2.address, e(1));

      const resolutionId2 = await _prepareResolution(6);
      await _makeVotable(resolutionId2);

      expect(await voting.getVotingPower(user1.address)).equal(e(50));
      expect(await voting.getVotingPower(user2.address)).equal(e(49));

      await setEVMTimestamp((await getEVMTimestamp()) + DAY * 8);

      // An internal token is swapped for an external one, so user2 loses 1 vote
      await internalMarket.connect(user2).withdraw(user2.address, e(1));

      const resolutionId3 = await _prepareResolution(6);
      await _makeVotable(resolutionId3);

      expect(await voting.getVotingPower(user1.address)).equal(e(50));
      expect(await voting.getVotingPower(user2.address)).equal(e(49));
    });

    // Mint 50 tokens to A
    // Mint 100 tokens to B
    // Mint 1 token to C
    // B offers 60 tokens
    // C buys 10 from B
    // A buys 40 tokens from B
    // C offers 5 tokens
    // A offers 10 tokens
    // B buys 10 tokens from A
    // B offers 10 tokens, 2 days later
    // C buys 15 tokens from B
    // C transfers 10 tokens to A, fails
    // B first offers expires
    // C offers expires
    // B transfers 5 tokens to C, fails
    // Check
    // B last offer expires
    // B transfers 5 tokens to C
    // Check
    it("complex tokenomics", async () => {
      await _makeContributor(user1, 50);
      await _makeContributor(user2, 100);
      await _makeContributor(user3, 1);

      await internalMarket.connect(user2).makeOffer(e(60));
      await internalMarket.connect(user3).matchOffer(user2.address, e(10));
      await internalMarket.connect(user1).matchOffer(user2.address, e(40));
      await internalMarket.connect(user3).makeOffer(e(5));
      await internalMarket.connect(user1).makeOffer(e(10));
      await internalMarket.connect(user2).matchOffer(user1.address, e(10));

      // Two days pass
      let offerExpires = (await getEVMTimestamp()) + 2 * DAY;
      await setEVMTimestamp(offerExpires);
      await mineEVMBlock();

      await internalMarket.connect(user2).makeOffer(e(10));
      await internalMarket.connect(user3).matchOffer(user2.address, e(15));

      await expect(
        internalMarket.connect(user3).withdraw(user1.address, e(10))
      ).revertedWith("InternalMarket: amount exceeds balance");

      // 5 days pass (first offer expires)
      offerExpires = (await getEVMTimestamp()) + 5 * DAY;
      await setEVMTimestamp(offerExpires);
      await mineEVMBlock();

      // Still fails, because first offers was already drained
      await expect(
        internalMarket.connect(user2).withdraw(user3.address, e(5))
      ).revertedWith("InternalMarket: amount exceeds balance");

      expect(await governanceToken.balanceOf(user1.address)).equal(e(80));
      expect(await internalMarket.offeredBalanceOf(user1.address)).equal(0);
      expect(await internalMarket.withdrawableBalanceOf(user1.address)).equal(
        0
      );

      expect(await governanceToken.balanceOf(user2.address)).equal(e(40));
      expect(await internalMarket.offeredBalanceOf(user2.address)).equal(e(5));
      expect(await internalMarket.withdrawableBalanceOf(user2.address)).equal(
        0
      );

      expect(await governanceToken.balanceOf(user3.address)).equal(e(21));
      expect(await internalMarket.offeredBalanceOf(user3.address)).equal(0);
      expect(await internalMarket.withdrawableBalanceOf(user3.address)).equal(
        e(5)
      );

      // 3 days pass (last user2 offer expires)
      offerExpires = (await getEVMTimestamp()) + 3 * DAY;
      await setEVMTimestamp(offerExpires);
      await mineEVMBlock();

      // first tries wrong amount
      await expect(
        internalMarket.connect(user2).withdraw(user3.address, e(10))
      ).revertedWith("InternalMarket: amount exceeds balance");
      await internalMarket.connect(user2).withdraw(user3.address, e(5));

      expect(await governanceToken.balanceOf(user2.address)).equal(e(40));
      expect(await internalMarket.offeredBalanceOf(user2.address)).equal(0);
      expect(await internalMarket.withdrawableBalanceOf(user2.address)).equal(
        0
      );

      expect(await governanceToken.balanceOf(user3.address)).equal(e(21));
      expect(await internalMarket.offeredBalanceOf(user3.address)).equal(0);
      expect(await internalMarket.withdrawableBalanceOf(user3.address)).equal(
        e(5)
      );

      await internalMarket.connect(user3).deposit(e(5));
      expect(await governanceToken.balanceOf(user3.address)).equal(e(26));
    });

    it("mints tokens to a contributor after a resolution passes", async () => {
      await _makeContributor(user1, 100);
      await _makeContributor(user2, 50);

      const abi = ["function mint(address to, uint256 amount)"];
      const iface = new ethers.utils.Interface(abi);
      const data = iface.encodeFunctionData("mint", [user2.address, e(42)]);
      const resolutionId = await _prepareResolution(
        6,
        [governanceToken.address],
        [data]
      );

      await _makeVotable(resolutionId); // this will automatically put resolutionId1 also up for voting
      await _vote(user1, true, resolutionId);
      await _vote(user2, true, resolutionId);

      await _endResolution();

      await resolutionManager.executeResolution(resolutionId);

      expect(await governanceToken.balanceOf(user2.address)).equal(e(92));
    });

    it("adds a resolution type after a resolution passes", async () => {
      await _makeContributor(user1, 100);
      await _makeContributor(user2, 50);

      const abi = [
        "function addResolutionType(string memory name, uint256 quorum, uint256 noticePeriod, uint256 votingPeriod, bool canBeNegative)",
      ];
      const iface = new ethers.utils.Interface(abi);
      const data = iface.encodeFunctionData("addResolutionType", [
        "test",
        50,
        3,
        6,
        false,
      ]);
      const resolutionId = await _prepareResolution(
        6,
        [resolutionManager.address],
        [data]
      );

      await _makeVotable(resolutionId); // this will automatically put resolutionId1 also up for voting
      await _vote(user1, true, resolutionId);
      await _vote(user2, true, resolutionId);

      await _endResolution();

      await expect(resolutionManager.executeResolution(resolutionId))
        .to.emit(resolutionManager, "ResolutionTypeCreated")
        .withArgs(resolutionManager.address, 8);

      const result = await resolutionManager.resolutionTypes(8);

      expect(result.name).equal("test");
      expect(result.quorum).equal(50);
      expect(result.noticePeriod).equal(3);
      expect(result.votingPeriod).equal(6);
      expect(result.canBeNegative).equal(false);
    });

    it("match offer, move to external wallet, redeem when ready", async () => {
      // Create three contributors

      await _makeContributor(user1, 50);
      await _makeContributor(user2, 100);
      await _makeContributor(user3, 1);
      expect(await neokingdomToken.balanceOf(governanceToken.address)).equal(
        e(151)
      );

      await internalMarket.connect(user1).makeOffer(e(10));

      await expect(() =>
        internalMarket.connect(user2).matchOffer(user1.address, e(4))
      ).to.changeTokenBalances(tokenMock, [user1, user2], [e(4), e(-4)]);
      expect(await governanceToken.balanceOf(user2.address)).equal(e(104));

      await expect(() =>
        internalMarket.connect(user3).matchOffer(user1.address, e(2))
      ).to.changeTokenBalances(tokenMock, [user1, user3], [e(2), e(-2)]);

      // Make the tokens redeemable
      await timeTravel(redemptionStartDays, true);

      expect(await redemptionController.redeemableBalance(user1.address)).equal(
        e(10)
      );
      expect(await internalMarket.withdrawableBalanceOf(user1.address)).equal(
        e(4)
      );

      await internalMarket.connect(user1).redeem(e(10));
      // Chaining two changeTokenBalances seems to execute the "redeem"
      // function twice. Anyway, this second redeem should fail.
      /*
        .to.changeTokenBalances(token, [market, reserve], [-4, 4])
        .to.changeTokenBalances(usdc, [reserve, user1], [-4, 4]);
      */

      expect(await governanceToken.balanceOf(user1.address)).equal(
        e(50 - 4 - 2 - 10)
      );
      expect(await tokenMock.balanceOf(user1.address)).equal(
        e(INITIAL_USDC + 4 + 2 + 10)
      );
      expect(await neokingdomToken.balanceOf(reserve.address)).equal(0);
      expect(await tokenMock.balanceOf(reserve.address)).equal(
        e(INITIAL_USDC - 10)
      );
      expect(await governanceToken.balanceOf(internalMarket.address)).equal(
        e(10 - 4 - 2 - 4)
      );
      expect(await tokenMock.balanceOf(internalMarket.address)).equal(0);

      await expect(internalMarket.connect(user1).redeem(e(4))).revertedWith(
        "Redemption controller: amount exceeds redeemable balance"
      );

      // User 2 exits their tokens to the secondary market
      await internalMarket.connect(user2).makeOffer(e(90));
      await timeTravel(offerDurationDays, true);
      await internalMarket.connect(user2).withdraw(free2.address, e(90));
      await timeTravel(redemptionStartDays - offerDurationDays, true);
      // then tries to redeem but fails because not enough balance.
      await expect(internalMarket.connect(user2).redeem(e(90))).revertedWith(
        "ERC20: burn amount exceeds balance"
      );

      // then tries to redeem 6 and succeeds.
      await internalMarket.connect(user2).redeem(e(6));

      // then 4 after the redeem window and fails
      await timeTravel(redemptionWindowDays, true);

      await expect(internalMarket.connect(user2).redeem(e(4))).revertedWith(
        "Redemption controller: amount exceeds redeemable balance"
      );
    });

    it("redemption edge cases", async () => {
      await _makeContributor(user1, 10);
      await _makeContributor(user2, 0);

      // pre-conditions
      expect(await governanceToken.balanceOf(user1.address)).equal(e(10));
      expect(await governanceToken.balanceOf(user2.address)).equal(0);
      expect(await governanceToken.balanceOf(reserve.address)).equal(0);

      expect(await tokenMock.balanceOf(user1.address)).equal(e(INITIAL_USDC));
      expect(await tokenMock.balanceOf(user2.address)).equal(e(INITIAL_USDC));
      expect(await tokenMock.balanceOf(reserve.address)).equal(e(INITIAL_USDC));

      let daysSinceMinting = 0;
      let tokensRedeemed = 0;

      // user1 offers 10 tokens
      await internalMarket.connect(user1).makeOffer(e(10));

      // user2 buys
      await internalMarket.connect(user2).matchOffer(user1.address, e(10));

      // user2 offers 10 tokens and offer expires
      await internalMarket.connect(user2).makeOffer(e(10));
      await timeTravel(offerDurationDays, true);
      daysSinceMinting += offerDurationDays;

      // user2 transfers 10 tokens to user1
      await internalMarket.connect(user2).withdraw(user1.address, e(10));
      await internalMarket.connect(user1).deposit(e(10));

      // 53 days later (60 since beginning) user1 redeems 3 tokens
      await timeTravel(redemptionStartDays - offerDurationDays, true);
      daysSinceMinting += redemptionStartDays - offerDurationDays;
      await internalMarket.connect(user1).redeem(e(3));
      tokensRedeemed += 3;

      // at the end of the redemption window, redemption of the 7 remaining
      // tokens fails
      await timeTravel(redemptionWindowDays, true);
      daysSinceMinting += redemptionWindowDays;

      await expect(internalMarket.connect(user1).redeem(e(7))).revertedWith(
        "Redemption controller: amount exceeds redeemable balance"
      );

      // user1 reoffers 7 the tokens
      await internalMarket.connect(user1).makeOffer(e(7));

      // after 60 days, user1 redeems 4 tokens
      await timeTravel(redemptionStartDays, true);
      daysSinceMinting += redemptionStartDays;
      await internalMarket.connect(user1).redeem(e(4));
      tokensRedeemed += 4;

      // redemption window expires
      await timeTravel(redemptionWindowDays, true);
      daysSinceMinting += redemptionWindowDays;

      // 30 * 15 days pass (15 more months) pass (only 13 months needed, as two
      // months already passed)
      await timeTravel(redemptionMaxDaysInThePast - daysSinceMinting);

      // user1 offers 3 remaining tokens (after withdrawing them, as they are
      // still in the vault)
      await internalMarket.connect(user1).withdraw(user1.address, e(3));
      await internalMarket.connect(user1).deposit(e(3));
      await internalMarket.connect(user1).makeOffer(e(3));

      // FIXME: not sure how this test worked before
      // 67 days later, redemption fails
      await timeTravel(redemptionStartDays + redemptionWindowDays, true);

      await expect(internalMarket.connect(user1).redeem(e(3))).revertedWith(
        "Redemption controller: amount exceeds redeemable balance"
      );

      // user1 re-withdraws the tokens, sobbing
      await internalMarket.connect(user1).withdraw(user1.address, e(3));
      await internalMarket.connect(user1).deposit(e(3));

      // 13 tokens are minted to user1
      await _mintTokens(user1, 13);
      // 3 months pass
      await timeTravel(redemptionActivityWindow, true);
      // 1 token is minted to user1
      await _mintTokens(user1, 1);
      // 14 tokens are offered
      await internalMarket.connect(user1).makeOffer(e(14));
      // 60 days later, 1 token is redeemable
      await timeTravel(redemptionStartDays, true);
      expect(await redemptionController.redeemableBalance(user1.address)).equal(
        e(1)
      );

      // user1 redeems their only token and withdraws the others, sobbing again
      await internalMarket.connect(user1).redeem(e(1));
      tokensRedeemed += 1;
      await internalMarket.connect(user1).withdraw(user1.address, e(13));
      await internalMarket.connect(user1).deposit(e(13));

      // post-conditions
      expect(await governanceToken.balanceOf(user1.address)).equal(
        e(24 - tokensRedeemed)
      );
      expect(await governanceToken.balanceOf(user2.address)).equal(0);
      expect(await neokingdomToken.balanceOf(reserve.address)).equal(0); // they have all been burnt

      expect(await tokenMock.balanceOf(user1.address)).equal(
        e(INITIAL_USDC + 10 + tokensRedeemed)
      );
      expect(await tokenMock.balanceOf(user2.address)).equal(
        e(INITIAL_USDC - 10)
      );
      expect(await tokenMock.balanceOf(reserve.address)).equal(
        e(INITIAL_USDC - tokensRedeemed)
      );
    });

    it("internal and external token amounts", async () => {
      async function check({
        internalSupply = 0,
        externalSupply = 0,
        governanceTokenWrappedBalance = 0,
        marketInternalBalance = 0,
        user1InternalBalance = 0,
        user1ExternalBalance = 0,
        user1UsdcBalance = INITIAL_USDC,
        user2InternalBalance = 0,
        user2ExternalBalance = 0,
        user2UsdcBalance = INITIAL_USDC,
        user3InternalBalance = 0,
        user3ExternalBalance = 0,
        user3UsdcBalance = INITIAL_USDC,
        reserveExternalBalance = 0,
        reserveUsdcBalance = INITIAL_USDC,
      }) {
        // Total supplies
        expect(await governanceToken.totalSupply()).equal(e(internalSupply));
        expect(await neokingdomToken.totalSupply()).equal(e(externalSupply));

        // InternalMarket
        expect(await governanceToken.balanceOf(internalMarket.address)).equal(
          e(marketInternalBalance)
        );

        // governanceToken wrapped balance
        expect(await neokingdomToken.balanceOf(governanceToken.address)).equal(
          e(governanceTokenWrappedBalance)
        );

        // User1 balances
        expect(await governanceToken.balanceOf(user1.address)).equal(
          e(user1InternalBalance)
        );
        expect(await neokingdomToken.balanceOf(user1.address)).equal(
          e(user1ExternalBalance)
        );
        expect(await tokenMock.balanceOf(user1.address)).equal(
          e(user1UsdcBalance)
        );

        // User2 balances
        expect(await governanceToken.balanceOf(user2.address)).equal(
          e(user2InternalBalance)
        );
        expect(await neokingdomToken.balanceOf(user2.address)).equal(
          e(user2ExternalBalance)
        );
        expect(await tokenMock.balanceOf(user2.address)).equal(
          e(user2UsdcBalance)
        );

        // User3 balances
        expect(await governanceToken.balanceOf(user3.address)).equal(
          e(user3InternalBalance)
        );
        expect(await neokingdomToken.balanceOf(user3.address)).equal(
          e(user3ExternalBalance)
        );
        expect(await tokenMock.balanceOf(user3.address)).equal(
          e(user3UsdcBalance)
        );

        // Reserve balances
        expect(await neokingdomToken.balanceOf(reserve.address)).equal(
          e(reserveExternalBalance)
        );
        expect(await tokenMock.balanceOf(reserve.address)).equal(
          e(reserveUsdcBalance)
        );
      }

      await check({});

      await _makeContributor(user1, 100);
      await _makeContributor(user2, 30);

      await check({
        internalSupply: 130,
        externalSupply: 130,
        governanceTokenWrappedBalance: 130,
        user1InternalBalance: 100,
        user2InternalBalance: 30,
      });

      // Offering 20 tokens locks them in the internal market contract
      await internalMarket.connect(user1).makeOffer(e(20));
      await check({
        internalSupply: 130,
        externalSupply: 130,
        governanceTokenWrappedBalance: 130,
        // +20
        marketInternalBalance: 20,
        // -20
        user1InternalBalance: 80,
        user2InternalBalance: 30,
      });

      // user2 matches 5 tokens
      await internalMarket.connect(user2).matchOffer(user1.address, e(5));
      await check({
        internalSupply: 130,
        externalSupply: 130,
        governanceTokenWrappedBalance: 130,
        // -5
        marketInternalBalance: 15,
        user1InternalBalance: 80,
        // +5
        user1UsdcBalance: INITIAL_USDC + 5,
        // +5
        user2InternalBalance: 35,
        // -5
        user2UsdcBalance: INITIAL_USDC - 5,
      });

      // after 1 week the remaining 15 tokens can be withdrawn
      await timeTravel(offerDurationDays, true);
      await internalMarket.connect(user1).withdraw(user3.address, e(15));
      await check({
        // -15
        internalSupply: 115,
        externalSupply: 130,
        // -15
        governanceTokenWrappedBalance: 115,
        // -15
        marketInternalBalance: 0,
        user1InternalBalance: 80,
        user1UsdcBalance: INITIAL_USDC + 5,
        user2InternalBalance: 35,
        user2UsdcBalance: INITIAL_USDC - 5,
        // +15
        user3ExternalBalance: 15,
      });

      await timeTravel(redemptionStartDays, true);
      await internalMarket.connect(user1).redeem(e(20));
      await check({
        // -20
        internalSupply: 95,
        externalSupply: 110,
        marketInternalBalance: 0,
        // -20
        governanceTokenWrappedBalance: 95,
        // -20
        user1InternalBalance: 60,
        // +20
        user1UsdcBalance: INITIAL_USDC + 5 + 20,
        user2InternalBalance: 35,
        user2UsdcBalance: INITIAL_USDC - 5,
        user3ExternalBalance: 15,
        reserveExternalBalance: 0, // tokens were burnt
        reserveUsdcBalance: INITIAL_USDC - 20,
      });
    });

    it("voting with exclusion stress test", async () => {
      await _makeContributor(user1, 20);
      await _makeContributor(user2, 70);
      await _makeContributor(user3, 10);

      // resolution 1 excludes user 2
      const abi = ["function setStatus(bytes32 status, address account)"];
      const iface = new ethers.utils.Interface(abi);
      const data = iface.encodeFunctionData("setStatus", [
        investorStatus,
        user2.address,
      ]);

      // Contributors propose a distrust vote against user3
      const distrust1 = ++currentResolution;
      await resolutionManager
        .connect(user1)
        .createResolutionWithExclusion(
          "Qxdistrust",
          0,
          [shareholderRegistry.address],
          [data],
          user2.address
        );
      await resolutionManager
        .connect(managingBoard)
        .approveResolution(distrust1);

      // user 2 delegates user 3
      await voting.connect(user2).delegate(user3.address);

      // while resolution 1 is running, a resolution 2 that exludes user 2 is created
      const distrust2 = ++currentResolution;
      await resolutionManager
        .connect(user1)
        .createResolutionWithExclusion(
          "Qxdistrust2",
          0,
          [shareholderRegistry.address],
          [data],
          user2.address
        );
      await resolutionManager
        .connect(managingBoard)
        .approveResolution(distrust2);

      // while both resolutions are running, a resolution 3 is created
      await timeTravel(1);
      const standardResolution = await _prepareResolution();

      await _makeVotable(distrust1);
      await _makeVotable(distrust2);
      await _makeVotable(standardResolution);

      // resolution 1 fails
      await _vote(user1, false, distrust1); // 20
      await _vote(user3, true, distrust1); // 10
      await expect(_vote(user2, false, distrust1)).revertedWith(
        "Resolution: account cannot vote"
      );
      await _endResolutionWithId(distrust1);
      await expect(resolutionManager.executeResolution(distrust1)).revertedWith(
        "Resolution: not passed"
      );

      // resolution 2 succeeds, user is demoted to investor
      // should the delegated voting power be transferred back to the excluded user in a resolution with exclusion?
      await _vote(user1, true, distrust2); // 20
      await _vote(user3, true, distrust2); // 10
      await expect(
        resolutionManager.connect(user2).vote(distrust1, false)
      ).revertedWith("Resolution: account cannot vote");
      await _endResolutionWithId(distrust2);
      await resolutionManager.executeResolution(distrust2);

      // user 3 should have delegated voting power from user 2 for resolution 3.
      await _vote(user1, true, standardResolution); // 20
      await _vote(user3, false, standardResolution); // 80
      //await _vote(user2, false, standardResolution);
      await _endResolutionWithId(standardResolution);
      const resultStandardResolution =
        await resolutionManager.getResolutionResult(standardResolution);
      expect(resultStandardResolution).equal(false);

      // Now that the user 2 is out, the user3 resolution power should be back to
      // 10, hence not enough to drive the final decision
      const standardResolution2 = await _prepareResolution(4);
      await _makeVotable(standardResolution2);

      await _vote(user1, true, standardResolution2); // 20
      await _vote(user3, false, standardResolution2); // 10
      await _endResolutionWithId(standardResolution2);
      const resultStandardResolutio2 =
        await resolutionManager.getResolutionResult(standardResolution2);
      expect(resultStandardResolutio2).equal(true);

      // back to square 1
      await shareholderRegistry.setStatus(contributorStatus, user2.address);
      const standardResolution3 = await _prepareResolution(4);
      await _makeVotable(standardResolution3);

      await _vote(user2, true, standardResolution3);
      await _endResolutionWithId(standardResolution3);
      const resultStandardResolutio3 =
        await resolutionManager.getResolutionResult(standardResolution3);
      expect(resultStandardResolutio3).equal(true);
    });
  });
});
