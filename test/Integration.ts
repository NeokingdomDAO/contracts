import { ethers } from "hardhat";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { solidity } from "ethereum-waffle";
import {
  ShareholderRegistry,
  Voting,
  NeokingdomToken,
  ResolutionManager,
} from "../typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { setEVMTimestamp, getEVMTimestamp, mineEVMBlock } from "./utils/evm";
import { roles } from "./utils/roles";
import { deployDAO } from "./utils/deploy";
import { parseEther } from "ethers/lib/utils";

import { BigNumber, BytesLike } from "ethers";

chai.use(solidity);
chai.use(chaiAsPromised);
const { expect } = chai;

const DAY = 60 * 60 * 24;

describe("Integration", () => {
  let voting: Voting;
  let token: NeokingdomToken;
  let resolution: ResolutionManager;
  let contributorStatus: string;
  let investorStatus: string;
  let shareholderRegistry: ShareholderRegistry;
  let deployer: SignerWithAddress,
    managingBoard: SignerWithAddress,
    user1: SignerWithAddress,
    user2: SignerWithAddress,
    user3: SignerWithAddress;

  beforeEach(async () => {
    [deployer, managingBoard, user1, user2, user3] = await ethers.getSigners();
    [deployer, managingBoard, user1, user2, user3] = await ethers.getSigners();
    [voting, token, shareholderRegistry, resolution] = await deployDAO(
      deployer,
      managingBoard
    );

    contributorStatus = await shareholderRegistry.CONTRIBUTOR_STATUS();
    investorStatus = await shareholderRegistry.INVESTOR_STATUS();
  });

  describe("integration", async () => {
    var currentResolution: number;
    beforeEach(async () => {
      currentResolution = 0;
    });

    async function _mintTokens(user: SignerWithAddress, tokens: number) {
      await token.mint(user.address, tokens);
    }

    async function _prepareForVoting(user: SignerWithAddress, tokens: number) {
      await shareholderRegistry.mint(user.address, parseEther("1"));
      await shareholderRegistry.setStatus(contributorStatus, user.address);
      await _mintTokens(user, tokens);
    }

    async function _makeVotable(resolutionId: number) {
      const resolutionObject = await resolution.resolutions(resolutionId);
      const resolutionType = await resolution.resolutionTypes(
        resolutionObject.resolutionTypeId
      );
      const votingTimestamp =
        resolutionObject.approveTimestamp.toNumber() +
        resolutionType.noticePeriod.toNumber();
      await setEVMTimestamp(votingTimestamp);
    }

    async function _prepareResolution(
      type: number = 0,
      executionTo: string[] = [],
      executionData: BytesLike[] = []
    ) {
      currentResolution++;
      await resolution
        .connect(user1)
        .createResolution("Qxtest", type, false, executionTo, executionData);
      await resolution
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
      await resolution.connect(user).vote(resolutionId, isYes);
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
      await _prepareForVoting(user1, 42);
      const resolutionId = await _prepareResolution();
      await _makeVotable(resolutionId);

      await _vote(user1, true, resolutionId);

      await _endResolution();

      const resolutionResult = await resolution.getResolutionResult(
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
      await _prepareForVoting(user1, 66);
      await _prepareForVoting(user2, 34);
      const resolutionId = await _prepareResolution();
      await _makeVotable(resolutionId);

      await _vote(user1, true, resolutionId);

      await _endResolution();

      const resolutionResult = await resolution.getResolutionResult(
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
      await _prepareForVoting(user1, 34);
      await _prepareForVoting(user2, 66);
      const resolutionId = await _prepareResolution();
      await _makeVotable(resolutionId);

      await _vote(user1, true, resolutionId);

      await _endResolution();

      const resolutionResult = await resolution.getResolutionResult(
        resolutionId
      );

      expect(resolutionResult).equal(false);
    });

    // Mint token to a multiple shareholder
    // Promote them to contributor
    // Self-delegate
    // Give some tokens
    // Create and approve resolution
    // Enough contributors vote yes to resolution
    // Mint more token to some of the contributors
    // Create and approve new resolution
    // Contributor with not sufficient voting power vote yes to resolution
    // Resolution fails
    it("multiple resolutions, different voting power over time, multiple contributors", async () => {
      await _prepareForVoting(user1, 66);
      await _prepareForVoting(user2, 34);
      const resolutionId1 = await _prepareResolution();

      await _mintTokens(user2, 96); // make them the most powerful user
      const resolutionId2 = await _prepareResolution();

      await _makeVotable(resolutionId2); // this will automatically put resolutionId1 also up for voting
      await _vote(user1, true, resolutionId1);
      await _vote(user1, true, resolutionId2); // this will have a lower voting power

      const resolution1Result = await resolution.getResolutionResult(
        resolutionId1
      );
      const resolution2Result = await resolution.getResolutionResult(
        resolutionId2
      );

      expect(resolution1Result).equal(true);
      expect(resolution2Result).equal(false);
    });

    it("multiple resolutions, different voting power over time, delegation, multiple contributors", async () => {
      await _prepareForVoting(user1, 66);
      await _prepareForVoting(user2, 34);
      await _delegate(user2, user1);
      const resolutionId1 = await _prepareResolution();

      await _mintTokens(user2, 96); // user2 has more voting power, but it's transferred to user1 (the delegate)
      const resolutionId2 = await _prepareResolution();

      await _makeVotable(resolutionId2); // this will automatically put resolutionId1 also up for voting
      await _vote(user1, true, resolutionId1);
      await _vote(user1, true, resolutionId2);

      const resolution1Result = await resolution.getResolutionResult(
        resolutionId1
      );
      const resolution2Result = await resolution.getResolutionResult(
        resolutionId2
      );

      expect(resolution1Result).equal(true);
      expect(resolution2Result).equal(true);

      const resolution1User1 = await resolution.getVoterVote(
        resolutionId1,
        user1.address
      );
      expect(resolution1User1.isYes).true;
      expect(resolution1User1.votingPower).equal(100);
      expect(resolution1User1.hasVoted).true;

      const resolution1User2 = await resolution.getVoterVote(
        resolutionId1,
        user2.address
      );
      expect(resolution1User2.isYes).false;
      expect(resolution1User2.votingPower).equal(0);
      expect(resolution1User2.hasVoted).false;

      const resolution2User1 = await resolution.getVoterVote(
        resolutionId2,
        user1.address
      );
      expect(resolution2User1.isYes).true;
      expect(resolution2User1.votingPower).equal(196);
      expect(resolution2User1.hasVoted).true;

      const resolution2User2 = await resolution.getVoterVote(
        resolutionId2,
        user2.address
      );
      expect(resolution2User2.isYes).false;
      expect(resolution2User2.votingPower).equal(0);
      expect(resolution2User2.hasVoted).false;
    });

    it("invalid voting should not be counted", async () => {
      const resolutionId = ++currentResolution;
      await _prepareForVoting(user1, 42);
      await resolution
        .connect(user1)
        .createResolution("Qxtest", 0, false, [], []);
      // votes given before approval
      await expect(_vote(user1, true, resolutionId)).reverted;

      await resolution
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
      _prepareForVoting(user3, 42);
      await shareholderRegistry.grantRole(
        await roles.RESOLUTION_ROLE(),
        deployer.address
      );
      await shareholderRegistry.burn(user3.address, parseEther("1"));
      const resolutionId3 = await _prepareResolution();
      await _makeVotable(resolutionId3);
      await expect(_vote(user3, true, resolutionId3)).reverted;

      await _endResolution();
      // votes given after closure
      await expect(_vote(user1, true, resolutionId)).reverted;
      const resolution1Result = await resolution.getResolutionResult(
        resolutionId
      );

      const resolution2Result = await resolution.getResolutionResult(
        resolutionId2
      );

      const resolution3Result = await resolution.getResolutionResult(
        resolutionId3
      );

      expect(resolution1Result).false;
      expect(resolution2Result).false;
      expect(resolution3Result).false;
    });

    it("expect chaos", async () => {
      await _prepareForVoting(user1, 60);
      await _prepareForVoting(user2, 30);
      await _prepareForVoting(user3, 10);

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

      await shareholderRegistry.setStatus(investorStatus, user3.address);
      await token.connect(user3).transfer(user2.address, 50);
      await token.mint(user2.address, 50);
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

      const resolution1Result = await resolution.getResolutionResult(
        resolutionId1
      );
      const resolution2Result = await resolution.getResolutionResult(
        resolutionId2
      );
      const resolution3Result = await resolution.getResolutionResult(
        resolutionId3
      );
      const resolution4Result = await resolution.getResolutionResult(
        resolutionId4
      );

      expect(resolution1Result).equal(true);
      expect(resolution2Result).equal(false);
      expect(resolution3Result).equal(true);
      expect(resolution4Result).equal(true);
    });

    // Mint 49 tokens to contributor A
    // Mint 51 tokens to contributor B
    // Resolution is created
    // A votes yes, B votes no. Resolution doesn't pass
    // Contributor B tries to transfer 2 tokens, fails
    // Contributor B offers 2 tokens
    // 1 token is bought by contributor A
    // Another resolution is created and approved
    // A votes yes, B votes no. Resolutions doesn't pass
    // After 7 days, B transfers 1 token to an external address
    // The external address transfers 1 token back to A
    // Resolution is created
    // A votes yes, B votes no. Resolution passes
    it("token economics + voting", async () => {
      await _prepareForVoting(user1, 49);
      await _prepareForVoting(user2, 51);

      const resolutionId1 = await _prepareResolution(6);
      await _makeVotable(resolutionId1);
      await _vote(user1, true, resolutionId1);
      await _vote(user2, false, resolutionId1);

      const resolution1Result = await resolution.getResolutionResult(
        resolutionId1
      );
      expect(resolution1Result).equal(false);

      await expect(
        token.connect(user2).transfer(user3.address, 2)
      ).revertedWith("NeokingdomToken: transfer amount exceeds unlocked tokens");

      await token.connect(user2).createOffer(2);
      await token.matchOffer(user2.address, user1.address, 1);

      const resolutionId2 = await _prepareResolution(6);
      await _makeVotable(resolutionId2);
      await _vote(user1, true, resolutionId2);
      await _vote(user2, false, resolutionId2);

      const resolution2Result = await resolution.getResolutionResult(
        resolutionId2
      );
      expect(resolution2Result).equal(false);

      // Let 7 days pass, so to unlock tokens from user2
      const expirationSeconds = await token.OFFER_EXPIRATION();
      const offerExpires =
        (await getEVMTimestamp()) + expirationSeconds.toNumber();
      await setEVMTimestamp(offerExpires);
      await mineEVMBlock();

      // Tries first to transfer 2 tokens (becuase the user forgot that 1 was sold to user 1)
      await expect(
        token.connect(user2).transfer(user3.address, 2)
      ).revertedWith("NeokingdomToken: transfer amount exceeds unlocked tokens");
      // Tries now to transfer the right amount
      await token.connect(user2).transfer(user3.address, 1);
      // The external user transfers the token back to user 1, because they can
      await token.connect(user3).transfer(user1.address, 1);

      const resolutionId3 = await _prepareResolution(6);
      await _makeVotable(resolutionId3);
      await _vote(user1, true, resolutionId3);
      await _vote(user2, false, resolutionId3);

      const resolution3Result = await resolution.getResolutionResult(
        resolutionId3
      );
      expect(resolution3Result).equal(true);
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
      await _prepareForVoting(user1, 50);
      await _prepareForVoting(user2, 100);
      await _prepareForVoting(user3, 1);

      await token.connect(user2).createOffer(60);
      await token.matchOffer(user2.address, user3.address, 10);
      await token.matchOffer(user2.address, user1.address, 40);
      await token.connect(user3).createOffer(5);
      await token.connect(user1).createOffer(10);
      await token.matchOffer(user1.address, user2.address, 10);

      // Two days pass
      let offerExpires = (await getEVMTimestamp()) + 2 * DAY;
      await setEVMTimestamp(offerExpires);
      await mineEVMBlock();

      await token.connect(user2).createOffer(10);
      await token.matchOffer(user2.address, user3.address, 15);

      await expect(
        token.connect(user3).transfer(user1.address, 10)
      ).revertedWith("NeokingdomToken: transfer amount exceeds unlocked tokens");

      // 5 days pass (first offer expires)
      offerExpires = (await getEVMTimestamp()) + 5 * DAY;
      await setEVMTimestamp(offerExpires);
      await mineEVMBlock();

      // Still fails, because first offers was already drained
      await expect(
        token.connect(user2).transfer(user3.address, 5)
      ).revertedWith("NeokingdomToken: transfer amount exceeds unlocked tokens");

      expect((await token.lockedBalanceOf(user1.address)).toNumber()).equal(80);
      expect((await token.balanceOf(user1.address)).toNumber()).equal(80);
      expect((await token.offeredBalanceOf(user1.address)).toNumber()).equal(0);
      expect((await token.unlockedBalanceOf(user1.address)).toNumber()).equal(
        0
      );

      expect((await token.lockedBalanceOf(user2.address)).toNumber()).equal(45);
      expect((await token.balanceOf(user2.address)).toNumber()).equal(45);
      expect((await token.offeredBalanceOf(user2.address)).toNumber()).equal(5);
      expect((await token.unlockedBalanceOf(user2.address)).toNumber()).equal(
        0
      );

      expect((await token.lockedBalanceOf(user3.address)).toNumber()).equal(21);
      expect((await token.balanceOf(user3.address)).toNumber()).equal(26);
      expect((await token.offeredBalanceOf(user3.address)).toNumber()).equal(0);
      expect((await token.unlockedBalanceOf(user3.address)).toNumber()).equal(
        5
      );

      // 3 days pass (last user2 offer expires)
      offerExpires = (await getEVMTimestamp()) + 3 * DAY;
      await setEVMTimestamp(offerExpires);
      await mineEVMBlock();

      // first tries wrong amount
      await expect(
        token.connect(user2).transfer(user3.address, 10)
      ).revertedWith("NeokingdomToken: transfer amount exceeds unlocked tokens");
      token.connect(user2).transfer(user3.address, 5);

      expect((await token.lockedBalanceOf(user2.address)).toNumber()).equal(40);
      expect((await token.balanceOf(user2.address)).toNumber()).equal(40);
      expect((await token.offeredBalanceOf(user2.address)).toNumber()).equal(0);
      expect((await token.unlockedBalanceOf(user2.address)).toNumber()).equal(
        0
      );

      expect((await token.lockedBalanceOf(user3.address)).toNumber()).equal(26);
      expect((await token.balanceOf(user3.address)).toNumber()).equal(31);
      expect((await token.offeredBalanceOf(user3.address)).toNumber()).equal(0);
      expect((await token.unlockedBalanceOf(user3.address)).toNumber()).equal(
        5
      );
    });

    it("Mints tokens to a contributor after a resolution passes", async () => {
      await _prepareForVoting(user1, 100);
      await _prepareForVoting(user2, 50);

      const abi = ["function mint(address to, uint256 amount)"];
      const iface = new ethers.utils.Interface(abi);
      const data = iface.encodeFunctionData("mint", [user2.address, 42]);
      const resolutionId = await _prepareResolution(6, [token.address], [data]);

      await _makeVotable(resolutionId); // this will automatically put resolutionId1 also up for voting
      await _vote(user1, true, resolutionId);
      await _vote(user2, true, resolutionId);

      await _endResolution();

      await resolution.executeResolution(resolutionId);

      expect(await token.balanceOf(user2.address)).equal(BigNumber.from(92));
    });

    it("Adds a resolution type after a resolution passes", async () => {
      await _prepareForVoting(user1, 100);
      await _prepareForVoting(user2, 50);

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
        [resolution.address],
        [data]
      );

      await _makeVotable(resolutionId); // this will automatically put resolutionId1 also up for voting
      await _vote(user1, true, resolutionId);
      await _vote(user2, true, resolutionId);

      await _endResolution();

      await expect(resolution.executeResolution(resolutionId))
        .to.emit(resolution, "ResolutionTypeCreated")
        .withArgs(resolution.address, 8);

      const result = await resolution.resolutionTypes(8);

      expect(result.name).equal("test");
      expect(result.quorum).equal(50);
      expect(result.noticePeriod).equal(3);
      expect(result.votingPeriod).equal(6);
      expect(result.canBeNegative).equal(false);
    });
  });
});
