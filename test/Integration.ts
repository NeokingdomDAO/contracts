import { ethers } from "hardhat";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { solidity } from "ethereum-waffle";
import {
  ShareholderRegistry,
  ShareholderRegistry__factory,
  Voting,
  Voting__factory,
  TelediskoToken,
  TelediskoToken__factory,
  ResolutionManager,
  ResolutionManager__factory,
} from "../typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { setEVMTimestamp, getEVMTimestamp, mineEVMBlock } from "./utils/evm";
import { roles } from "./utils/roles";

chai.use(solidity);
chai.use(chaiAsPromised);
const { expect } = chai;

const DAY = 60 * 60 * 24;
const AddressZero = ethers.constants.AddressZero;

describe("Resolution", () => {
  let voting: Voting;
  let token: TelediskoToken;
  let resolution: ResolutionManager;
  let founderStatus: string;
  let contributorStatus: string;
  let investorStatus: string;
  let shareholderRegistry: ShareholderRegistry;
  let deployer: SignerWithAddress,
    founder: SignerWithAddress,
    user1: SignerWithAddress,
    user2: SignerWithAddress,
    user3: SignerWithAddress;

  beforeEach(async () => {
    [deployer, founder, user1, user2, user3] = await ethers.getSigners();
    const VotingFactory = (await ethers.getContractFactory(
      "Voting",
      deployer
    )) as Voting__factory;

    const TelediskoTokenFactory = (await ethers.getContractFactory(
      "TelediskoToken",
      deployer
    )) as TelediskoToken__factory;

    const ShareholderRegistryFactory = (await ethers.getContractFactory(
      "ShareholderRegistry",
      deployer
    )) as ShareholderRegistry__factory;

    const ResolutionFactory = (await ethers.getContractFactory(
      "ResolutionManager",
      deployer
    )) as ResolutionManager__factory;

    voting = await VotingFactory.deploy();
    token = await TelediskoTokenFactory.deploy("TestToken", "TT");
    shareholderRegistry = await ShareholderRegistryFactory.deploy(
      "TestShare",
      "TS"
    );

    await voting.deployed();
    await token.deployed();
    await shareholderRegistry.deployed();

    var managerRole = await roles.MANAGER_ROLE();
    var resolutionRole = await roles.RESOLUTION_ROLE();
    var shareholderRegistryRole = await roles.SHAREHOLDER_REGISTRY_ROLE();

    await shareholderRegistry.grantRole(managerRole, deployer.address);
    await voting.grantRole(
      shareholderRegistryRole,
      shareholderRegistry.address
    );
    await voting.grantRole(managerRole, deployer.address);
    await token.grantRole(managerRole, deployer.address);
    await token.grantRole(resolutionRole, deployer.address);

    await voting.setShareholderRegistry(shareholderRegistry.address);
    await voting.setToken(token.address);
    await token.setShareholderRegistry(shareholderRegistry.address);
    await token.setVoting(voting.address);
    await shareholderRegistry.setVoting(voting.address);

    resolution = await ResolutionFactory.deploy(
      shareholderRegistry.address,
      token.address,
      voting.address
    );

    await resolution.deployed();

    await shareholderRegistry.grantRole(resolutionRole, resolution.address);
    await voting.grantRole(resolutionRole, resolution.address);

    founderStatus = await shareholderRegistry.FOUNDER_STATUS();
    contributorStatus = await shareholderRegistry.CONTRIBUTOR_STATUS();
    investorStatus = await shareholderRegistry.INVESTOR_STATUS();

    await shareholderRegistry.mint(founder.address, 1);
    await shareholderRegistry.setStatus(founderStatus, founder.address);
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
      await shareholderRegistry.mint(user.address, 1);
      await shareholderRegistry.setStatus(contributorStatus, user.address);
      await voting.connect(user).delegate(user.address);
      await _mintTokens(user, tokens);
    }

    async function _makeVotable(resolutionId: number) {
      const resolutionObject = await resolution.resolutions(resolutionId);
      const votingTimestamp =
        resolutionObject.approveTimestamp.toNumber() + DAY * 14;
      await setEVMTimestamp(votingTimestamp);
    }

    async function _prepareResolution() {
      currentResolution++;
      await resolution.connect(user1).createResolution("Qxtest", 0, false);
      await resolution.connect(founder).approveResolution(currentResolution);

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
    it("multiple resolutions, different voting power over time, multiple contributor", async () => {
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
      await voting.connect(user3).delegate(user3.address);
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
  });
});
