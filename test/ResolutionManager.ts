import { ethers, upgrades } from "hardhat";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { solidity } from "ethereum-waffle";
import {
  ShareholderRegistryMock,
  ShareholderRegistryMock__factory,
  VotingMock,
  VotingMock__factory,
  NeokingdomTokenMock,
  NeokingdomTokenMock__factory,
  ResolutionManager,
  ResolutionManager__factory,
  ResolutionExecutorMock,
  ResolutionExecutorMock__factory,
} from "../typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber, ContractReceipt } from "ethers";
import { setEVMTimestamp, getEVMTimestamp, mineEVMBlock } from "./utils/evm";
import { roles } from "./utils/roles";

chai.use(solidity);
chai.use(chaiAsPromised);
const { expect } = chai;

const DAY = 60 * 60 * 24;

describe("Resolution", () => {
  let managingBoardStatus: string;
  let contributorStatus: string;
  let shareholderStatus: string;
  let investorStatus: string;

  let voting: VotingMock;
  let token: NeokingdomTokenMock;
  let resolution: ResolutionManager;
  let shareholderRegistry: ShareholderRegistryMock;
  let resolutionExecutorMock: ResolutionExecutorMock;
  let deployer: SignerWithAddress,
    managingBoard: SignerWithAddress,
    user1: SignerWithAddress,
    user2: SignerWithAddress,
    delegate1: SignerWithAddress,
    nonContributor: SignerWithAddress;

  beforeEach(async () => {
    [deployer, managingBoard, user1, user2, delegate1, nonContributor] =
      await ethers.getSigners();
    const VotingMockFactory = (await ethers.getContractFactory(
      "VotingMock",
      deployer
    )) as VotingMock__factory;

    const NeokingdomTokenMockFactory = (await ethers.getContractFactory(
      "NeokingdomTokenMock",
      deployer
    )) as NeokingdomTokenMock__factory;

    const ShareholderRegistryMockFactory = (await ethers.getContractFactory(
      "ShareholderRegistryMock",
      deployer
    )) as ShareholderRegistryMock__factory;

    const ResolutionExecutorMockFactory = (await ethers.getContractFactory(
      "ResolutionExecutorMock",
      deployer
    )) as ResolutionExecutorMock__factory;

    const ResolutionFactory = (await ethers.getContractFactory(
      "ResolutionManager",
      deployer
    )) as ResolutionManager__factory;

    voting = (await upgrades.deployProxy(VotingMockFactory)) as VotingMock;
    await voting.deployed();

    token = (await upgrades.deployProxy(
      NeokingdomTokenMockFactory
    )) as NeokingdomTokenMock;
    await token.deployed();

    shareholderRegistry = (await upgrades.deployProxy(
      ShareholderRegistryMockFactory,
      {
        initializer: "initialize",
      }
    )) as ShareholderRegistryMock;
    await shareholderRegistry.deployed();

    resolutionExecutorMock = (await upgrades.deployProxy(
      ResolutionExecutorMockFactory
    )) as ResolutionExecutorMock;
    await resolutionExecutorMock.deployed();

    managingBoardStatus = await shareholderRegistry.MANAGING_BOARD_STATUS();
    contributorStatus = await shareholderRegistry.CONTRIBUTOR_STATUS();
    shareholderStatus = await shareholderRegistry.SHAREHOLDER_STATUS();
    investorStatus = await shareholderRegistry.INVESTOR_STATUS();

    resolution = (await upgrades.deployProxy(
      ResolutionFactory,
      [shareholderRegistry.address, token.address, voting.address],
      {
        initializer: "initialize",
      }
    )) as ResolutionManager;
    await resolution.deployed();

    await resolution.grantRole(await roles.OPERATOR_ROLE(), deployer.address);
    await resolution.grantRole(await roles.RESOLUTION_ROLE(), deployer.address);

    await voting.mock_getDelegateAt(user1.address, user1.address);

    // Set contributors' status to:
    // - contributor
    // - shareholder
    // - investor
    // The mock is dumb so we need to set everything manually
    await Promise.all(
      [managingBoard, user1, user2, delegate1].map(
        async (user) => await setContributor(user, true)
      )
    );
    await shareholderRegistry.mock_isAtLeast(
      managingBoardStatus,
      managingBoard.address,
      true
    );

    await Promise.all(
      [managingBoard, user1, user2, delegate1].map(async (voter) => {
        await voting.mock_canVoteAt(voter.address, true);
      })
    );
  });

  async function setContributor(user: SignerWithAddress, flag: boolean) {
    await shareholderRegistry.mock_isAtLeast(
      contributorStatus,
      user.address,
      flag
    );
    await shareholderRegistry.mock_isAtLeast(
      shareholderStatus,
      user.address,
      flag
    );
    await shareholderRegistry.mock_isAtLeast(
      investorStatus,
      user.address,
      flag
    );
  }

  async function setupUser(user: SignerWithAddress, votingPower: number) {
    await voting.mock_getDelegateAt(user.address, user.address);
    await voting.mock_getVotingPowerAt(user.address, votingPower);
  }

  async function setupResolution(
    totalVotingPower: number,
    negative: boolean = false,
    executeTo: string[] = [],
    executeData: string[] = []
  ) {
    await voting.mock_getTotalVotingPowerAt(totalVotingPower);

    await resolution
      .connect(user1)
      .createResolution("test", 6, negative, executeTo, executeData);
    await resolution.connect(managingBoard).approveResolution(1);
    const approveTimestamp = await getEVMTimestamp();
    await setEVMTimestamp(approveTimestamp + 3 * DAY);
  }

  let resolutionId: number;
  beforeEach(async () => {
    resolutionId = 1; // first resolution ID is always 1
  });

  describe("creation logic", async () => {
    it("allows to create a resolution", async () => {
      await expect(
        resolution.connect(user1).createResolution("test", 0, false, [], [])
      )
        .to.emit(resolution, "ResolutionCreated")
        .withArgs(user1.address, resolutionId);
    });
    it("doesn't allow non contributors to create a resolution", async () => {
      await expect(
        resolution
          .connect(nonContributor)
          .createResolution("test", 0, false, [], [])
      ).revertedWith("Resolution: only contributor can create");
    });
    it("allows to create a resolution and read the resolutionId with an event", async () => {
      const tx = await resolution
        .connect(user1)
        .createResolution("test", 0, false, [], []);

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

    it("doesn't allow to create a negative resolution if type is non-negative", async () => {
      await expect(
        resolution.connect(user1).createResolution("test", 0, true, [], [])
      ).revertedWith("Resolution: cannot be negative");
    });

    it("doesn't allow to create a resolution with mismatching length between executor and data", async () => {
      await expect(
        resolution
          .connect(user1)
          .createResolution(
            "test",
            0,
            false,
            [resolutionExecutorMock.address],
            []
          )
      ).revertedWith("Resolution: length mismatch");
    });
  });

  describe("update logic", async () => {
    let resolutionId: number;
    beforeEach(async () => {
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
      const tx = await resolution
        .connect(user1)
        .createResolution("test", 0, false, [], []);
      const receipt = await tx.wait();
      resolutionId = getResolutionId(receipt).toNumber();
    });

    it("allows managingBoard to update a resolution", async () => {
      await expect(
        resolution
          .connect(managingBoard)
          .updateResolution(resolutionId, "updated test", 6, true, [], [])
      )
        .to.emit(resolution, "ResolutionUpdated")
        .withArgs(managingBoard.address, resolutionId);
      const resolutionData = await resolution.resolutions(resolutionId);
      expect(resolutionData.dataURI).equal("updated test");
      expect(resolutionData.resolutionTypeId).equal(6);
      expect(resolutionData.isNegative).equal(true);
    });

    it("doesn't allow the managing board to update to a negative resolution if type is non-negative", async () => {
      await resolution
        .connect(user1)
        .createResolution("test", 0, false, [], []);
      await expect(
        resolution
          .connect(managingBoard)
          .updateResolution(1, "test", 0, true, [], [])
      ).revertedWith("Resolution: cannot be negative");
    });

    it("doesn't allow the managing board to update an approved resolution", async () => {
      await resolution.connect(managingBoard).approveResolution(resolutionId);
      await expect(
        resolution
          .connect(managingBoard)
          .updateResolution(resolutionId, "updated test", 6, true, [], [])
      ).revertedWith("Resolution: already approved");
    });

    it("doesn't allow the managing board to update a rejected resolution", async () => {
      await resolution.connect(managingBoard).rejectResolution(resolutionId);
      await expect(
        resolution
          .connect(managingBoard)
          .updateResolution(resolutionId, "updated test", 6, true, [], [])
      ).revertedWith("Resolution: already rejected");
    });

    it("doesn't allow anyone else to update a resolution", async () => {
      await expect(
        resolution
          .connect(user1)
          .updateResolution(resolutionId, "updated test", 6, true, [], [])
      ).revertedWith("Resolution: only managing board can update");
    });

    it("doesn't allow to update a resolution with mismatching length between executor and data", async () => {
      await expect(
        resolution
          .connect(user1)
          .updateResolution(
            resolutionId,
            "updated test",
            6,
            true,
            [resolutionExecutorMock.address],
            []
          )
      ).revertedWith("Resolution: length mismatch");
    });
  });

  describe("dependency injection", async () => {
    it("allows the OPERATOR_ROLE to setVoting", async () => {
      await resolution.grantRole(await roles.OPERATOR_ROLE(), user1.address);
      await resolution.connect(user1).setVoting(managingBoard.address);
    });

    it("allow the OPERATOR_ROLE to setShareholderRegistry", async () => {
      await resolution.grantRole(await roles.OPERATOR_ROLE(), user1.address);
      await resolution
        .connect(user1)
        .setShareholderRegistry(managingBoard.address);
    });

    it("allow the OPERATOR_ROLE to setNeokingdomToken", async () => {
      await resolution.grantRole(await roles.OPERATOR_ROLE(), user1.address);
      await resolution.connect(user1).setNeokingdomToken(managingBoard.address);
    });

    it("doesn't allow anyone not with OPERATOR_ROLE to setVoting", async () => {
      await expect(
        resolution.connect(managingBoard).setVoting(managingBoard.address)
      ).revertedWith(
        `AccessControl: account ${managingBoard.address.toLowerCase()} ` +
          `is missing role ${await roles.OPERATOR_ROLE()}`
      );
    });

    it("doesn't allow anyone not with OPERATOR_ROLE to setShareholderRegistry", async () => {
      await expect(
        resolution
          .connect(managingBoard)
          .setShareholderRegistry(managingBoard.address)
      ).revertedWith(
        `AccessControl: account ${managingBoard.address.toLowerCase()} ` +
          `is missing role ${await roles.OPERATOR_ROLE()}`
      );
    });
    it("doesn't allow anyone not with OPERATOR_ROLE to setNeokingdomToken", async () => {
      await expect(
        resolution
          .connect(managingBoard)
          .setNeokingdomToken(managingBoard.address)
      ).revertedWith(
        `AccessControl: account ${managingBoard.address.toLowerCase()} ` +
          `is missing role ${await roles.OPERATOR_ROLE()}`
      );
    });
  });

  describe("resolution type management", async () => {
    it("should allow a resolution to add a resolution type", async () => {
      await resolution.grantRole(await roles.RESOLUTION_ROLE(), user1.address);
      await resolution
        .connect(user1)
        .addResolutionType("test", 42, 43, 44, false);

      const result = await resolution.resolutionTypes(8);

      expect(result.name).equal("test");
      expect(result.quorum).equal(42);
      expect(result.noticePeriod).equal(43);
      expect(result.votingPeriod).equal(44);
      expect(result.canBeNegative).equal(false);
    });

    it("should emit an event with all resolution info including index", async () => {
      await expect(
        resolution
          .connect(deployer)
          .addResolutionType("test", 42, 43, 44, false)
      )
        .to.emit(resolution, "ResolutionTypeCreated")
        .withArgs(deployer.address, 8);
    });

    it("should not allow a non resolution to add a resolution type", async () => {
      await expect(
        resolution.connect(user1).addResolutionType("test", 42, 43, 44, false)
      ).revertedWith(
        `AccessControl: account ${user1.address.toLowerCase()} is missing role ${await roles.RESOLUTION_ROLE()}`
      );
    });
  });

  describe("approval logic", async () => {
    it("should not allow to approve a non existing resolution", async () => {
      await expect(
        resolution.connect(managingBoard).approveResolution(resolutionId)
      ).revertedWith("Resolution: does not exist");
    });

    it("should allow the managing board to approve an existing resolution", async () => {
      await resolution
        .connect(user1)
        .createResolution("test", 0, false, [], []);

      await expect(
        resolution.connect(managingBoard).approveResolution(resolutionId)
      )
        .to.emit(resolution, "ResolutionApproved")
        .withArgs(managingBoard.address, resolutionId);
      const [, , approveTimestamp] = await resolution.resolutions(resolutionId);

      let blockTimestamp = (await ethers.provider.getBlock("latest")).timestamp;
      expect(approveTimestamp.toNumber()).equal(blockTimestamp);
    });

    it("should not allow non managing board members to approve an existing resolution", async () => {
      await resolution
        .connect(user1)
        .createResolution("test", 0, false, [], []);

      await expect(
        resolution.connect(user1).approveResolution(resolutionId)
      ).revertedWith("Resolution: only managing board can approve");
    });

    it("should fail if already approved", async () => {
      await resolution
        .connect(user1)
        .createResolution("test", 0, false, [], []);

      await resolution.connect(managingBoard).approveResolution(resolutionId);

      await expect(
        resolution.connect(managingBoard).approveResolution(resolutionId)
      ).revertedWith("Resolution: already approved");
    });

    it("should fail if already rejected", async () => {
      await resolution
        .connect(user1)
        .createResolution("test", 0, false, [], []);

      await resolution.connect(managingBoard).rejectResolution(resolutionId);

      await expect(
        resolution.connect(managingBoard).approveResolution(resolutionId)
      ).revertedWith("Resolution: already rejected");
    });
  });

  describe("rejection logic", async () => {
    it("should not allow to reject a non existing resolution", async () => {
      await expect(
        resolution.connect(managingBoard).rejectResolution(resolutionId)
      ).revertedWith("Resolution: does not exist");
    });

    it("should allow the managing board to reject an existing resolution", async () => {
      await resolution
        .connect(user1)
        .createResolution("test", 0, false, [], []);

      await expect(
        resolution.connect(managingBoard).rejectResolution(resolutionId)
      )
        .to.emit(resolution, "ResolutionRejected")
        .withArgs(managingBoard.address, resolutionId);
      const rejectTimestamp = (await resolution.resolutions(resolutionId))[6];

      let blockTimestamp = (await ethers.provider.getBlock("latest")).timestamp;
      expect(rejectTimestamp.toNumber()).equal(blockTimestamp);
    });

    it("should not allow non managing board members to reject an existing resolution", async () => {
      await resolution
        .connect(user1)
        .createResolution("test", 0, false, [], []);

      await expect(
        resolution.connect(user1).rejectResolution(resolutionId)
      ).revertedWith("Resolution: only managing board can reject");
    });

    it("should fail if already approved", async () => {
      await resolution
        .connect(user1)
        .createResolution("test", 0, false, [], []);

      await resolution.connect(managingBoard).approveResolution(resolutionId);

      await expect(
        resolution.connect(managingBoard).rejectResolution(resolutionId)
      ).revertedWith("Resolution: already approved");
    });

    it("should fail if already rejected", async () => {
      await resolution
        .connect(user1)
        .createResolution("test", 0, false, [], []);

      await resolution.connect(managingBoard).rejectResolution(resolutionId);

      await expect(
        resolution.connect(managingBoard).rejectResolution(resolutionId)
      ).revertedWith("Resolution: already rejected");
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
      await resolution
        .connect(user1)
        .createResolution("test", 0, false, [], []);

      await expect(
        resolution.connect(user1).vote(resolutionId, false)
      ).revertedWith("Resolution: not approved");
    });

    it("should not allow to vote on rejected resolution", async () => {
      await resolution
        .connect(user1)
        .createResolution("test", 0, false, [], []);

      await resolution.connect(managingBoard).rejectResolution(resolutionId);

      await expect(
        resolution.connect(user1).vote(resolutionId, false)
      ).revertedWith("Resolution: not approved");
    });

    it("should not allow to vote on a resolution when voting didn't start", async () => {
      await resolution
        .connect(user1)
        .createResolution("test", 0, false, [], []);
      await resolution.connect(managingBoard).approveResolution(resolutionId);

      await expect(resolution.connect(user1).vote(1, false)).revertedWith(
        "Resolution: not votable"
      );
    });

    it("should not allow to vote on a resolution when voting ended", async () => {
      await resolution
        .connect(user1)
        .createResolution("test", 0, false, [], []);
      await resolution.connect(managingBoard).approveResolution(resolutionId);
      let approvalTimestamp = await getEVMTimestamp();

      let votingTimestamp = approvalTimestamp + DAY * 21;
      await setEVMTimestamp(votingTimestamp);

      await expect(
        resolution.connect(user1).vote(resolutionId, false)
      ).revertedWith("Resolution: not votable");
    });

    it("should allow to vote on an approved resolution when voting started", async () => {
      await resolution
        .connect(user1)
        .createResolution("test", 0, false, [], []);
      await resolution.connect(managingBoard).approveResolution(resolutionId);
      let approvalTimestamp = await getEVMTimestamp();

      let votingTimestamp = approvalTimestamp + DAY * 15;
      await setEVMTimestamp(votingTimestamp);

      await resolution.connect(user1).vote(resolutionId, false);
    });
  });

  describe("voting logic", async () => {
    beforeEach(async () => {
      await resolution
        .connect(user1)
        .createResolution("test", 0, false, [], []);
      await resolution.connect(managingBoard).approveResolution(resolutionId);
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

    describe("getVoterVote", async () => {
      describe("without delegation", async () => {
        beforeEach(async () => {
          await voting.mock_getVotingPowerAt(user1.address, 42);
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

      describe("with delegation, delegator votes", async () => {
        beforeEach(async () => {
          await voting.mock_getDelegateAt(user1.address, user2.address);
          await voting.mock_getDelegateAt(user2.address, user2.address);
          await token.mock_balanceOfAt(user1.address, 42);
          await token.mock_balanceOfAt(user2.address, 1);
          await voting.mock_getVotingPowerAt(user2.address, 43);
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

        it("should return the right stats for a delegator that didn't vote", async () => {
          await resolution.connect(user1).vote(resolutionId, true);
          const [isYes, hasVoted, votingPower] = await resolution.getVoterVote(
            resolutionId,
            user2.address
          );
          expect(isYes).equal(false);
          expect(hasVoted).equal(false);
          expect(votingPower).eq(1);
        });
      });

      describe("with delegation, delegated votes", async () => {
        beforeEach(async () => {
          await voting.mock_getDelegateAt(user1.address, user2.address);
          await voting.mock_getDelegateAt(user2.address, user2.address);
          await token.mock_balanceOfAt(user1.address, 42);
          await token.mock_balanceOfAt(user2.address, 1);
          await voting.mock_getVotingPowerAt(user2.address, 43);
        });

        it("should return the right delegator stats on a NO vote", async () => {
          await resolution.connect(user2).vote(resolutionId, false);
          const [isYes, hasVoted, votingPower] = await resolution.getVoterVote(
            resolutionId,
            user1.address
          );
          expect(isYes).equal(false); // default value
          expect(hasVoted).equal(false);
          expect(votingPower.eq(0)).true;
        });

        it("should return the right delegator stats on a YES vote", async () => {
          await resolution.connect(user2).vote(resolutionId, true);
          const [isYes, hasVoted, votingPower] = await resolution.getVoterVote(
            resolutionId,
            user1.address
          );
          expect(isYes).equal(false); // default value
          expect(hasVoted).equal(false);
          expect(votingPower.eq(0)).true;
        });

        it("should return right delegator stats when updating from yes to no", async () => {
          await resolution.connect(user2).vote(resolutionId, true);
          await resolution.connect(user2).vote(resolutionId, false);
          const [isYes, hasVoted, votingPower] = await resolution.getVoterVote(
            resolutionId,
            user1.address
          );

          expect(isYes).equal(false); // default value
          expect(hasVoted).equal(false);
          expect(votingPower.eq(0)).true;
        });

        it("should return right delegator stats when updating from no to yes", async () => {
          await resolution.connect(user2).vote(resolutionId, false);
          await resolution.connect(user2).vote(resolutionId, true);
          const [isYes, hasVoted, votingPower] = await resolution.getVoterVote(
            resolutionId,
            user1.address
          );

          expect(isYes).equal(false); // default value
          expect(hasVoted).equal(false);
          expect(votingPower.eq(0)).true;
        });

        it("should return the right delegated stats", async () => {
          await resolution.connect(user2).vote(resolutionId, true);
          const [isYes, hasVoted, votingPower] = await resolution.getVoterVote(
            resolutionId,
            user2.address
          );

          expect(isYes).equal(true); // default value
          expect(hasVoted).equal(true);
          expect(votingPower.eq(43)).true;
        });

        it("should return the right delegated stats when delegated votes as well", async () => {
          await resolution.connect(user1).vote(resolutionId, false);
          await resolution.connect(user2).vote(resolutionId, true);
          const [isYes, hasVoted, votingPower] = await resolution.getVoterVote(
            resolutionId,
            user2.address
          );
          expect(isYes).equal(true);
          expect(hasVoted).equal(true);
          expect(votingPower).eq(1);
        });
      });
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

      it("should not change yesVotesTotal on a NO vote", async () => {
        const prevYesVotesTotal = (
          await resolution.resolutions(resolutionId)
        )[4];
        await resolution.connect(user1).vote(resolutionId, false);

        const yesVotesTotal = (await resolution.resolutions(resolutionId))[4];

        expect(yesVotesTotal.eq(prevYesVotesTotal)).true;
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

      it("should increment total yes when updating from no to yes", async () => {
        await resolution.connect(user1).vote(resolutionId, false);
        let previousYes = (await resolution.resolutions(resolutionId))[4];

        await resolution.connect(user1).vote(resolutionId, true);
        let newYes = (await resolution.resolutions(resolutionId))[4];

        expect(newYes.sub(previousYes).eq(42)).true;
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

  describe("resolution execution", async () => {
    function dataSimpleFunction(param: number) {
      const abi = ["function mockExecuteSimple(uint256 a)"];
      const iface = new ethers.utils.Interface(abi);
      const data = iface.encodeFunctionData("mockExecuteSimple", [param]);

      return data;
    }

    function dataArrayFunction(param: number[]) {
      const abi = ["function mockExecuteArray(uint256[] memory a)"];
      const iface = new ethers.utils.Interface(abi);
      const data = iface.encodeFunctionData("mockExecuteArray", [param]);

      return data;
    }

    it("should create a resolution with multiple executors", async () => {
      await resolution
        .connect(user1)
        .createResolution(
          "test",
          0,
          false,
          [resolutionExecutorMock.address, user2.address],
          [dataSimpleFunction(0), dataSimpleFunction(1)]
        );

      const result = await resolution.getExecutionDetails(1);

      expect(result[0][0]).equal(resolutionExecutorMock.address);
      expect(result[0][1]).equal(user2.address);
      expect(result[1][0]).equal(dataSimpleFunction(0));
      expect(result[1][1]).equal(dataSimpleFunction(1));
    });

    it("should execute a passed resolution with 1 executor", async () => {
      const data = dataSimpleFunction(42);
      await setupUser(user1, 50);
      await setupResolution(1, true, [resolutionExecutorMock.address], [data]);
      let approvalTimestamp = await getEVMTimestamp();

      let votingTimestamp = approvalTimestamp + DAY * 5;
      await setEVMTimestamp(votingTimestamp);
      await mineEVMBlock();

      await resolution.executeResolution(1);
    });

    it("should pass the given single parameter to the executor", async () => {
      const data = dataSimpleFunction(42);
      await setupUser(user1, 1);
      await setupResolution(1, true, [resolutionExecutorMock.address], [data]);
      let approvalTimestamp = await getEVMTimestamp();

      let votingTimestamp = approvalTimestamp + DAY * 5;
      await setEVMTimestamp(votingTimestamp + DAY * 2);
      await mineEVMBlock();

      await expect(resolution.executeResolution(1))
        .to.emit(resolutionExecutorMock, "MockExecutionSimple")
        .withArgs(42);
    });

    it("should pass the given list parameter to the executor", async () => {
      const data = dataArrayFunction([42, 43]);
      await setupUser(user1, 1);
      await setupResolution(1, true, [resolutionExecutorMock.address], [data]);
      let approvalTimestamp = await getEVMTimestamp();

      let votingTimestamp = approvalTimestamp + DAY * 5;
      await setEVMTimestamp(votingTimestamp);
      await mineEVMBlock();

      await expect(resolution.executeResolution(1))
        .to.emit(resolutionExecutorMock, "MockExecutionArray")
        .withArgs([42, 43]);
    });

    it("should not execute a resolution with no executors", async () => {
      await setupUser(user2, 1);
      await setupResolution(1);
      let approvalTimestamp = await getEVMTimestamp();

      let votingTimestamp = approvalTimestamp + DAY * 3;
      await setEVMTimestamp(votingTimestamp);
      await mineEVMBlock();

      await resolution.connect(user1).vote(1, true);

      await setEVMTimestamp(votingTimestamp + DAY * 2);
      await mineEVMBlock();

      await expect(resolution.executeResolution(1)).revertedWith(
        "Resolution: nothing to execute"
      );
    });

    it("should execute a passed resolution with multiple executors", async () => {
      const data1 = dataSimpleFunction(42);
      const data2 = dataSimpleFunction(43);
      await setupUser(user1, 50);
      await setupResolution(
        1,
        false,
        [resolutionExecutorMock.address, resolutionExecutorMock.address],
        [data1, data2]
      );
      let approvalTimestamp = await getEVMTimestamp();

      let votingTimestamp = approvalTimestamp + DAY * 3;
      await setEVMTimestamp(votingTimestamp);
      await mineEVMBlock();

      await resolution.connect(user1).vote(1, true);

      await setEVMTimestamp(votingTimestamp + DAY * 2);
      await mineEVMBlock();

      await expect(resolution.executeResolution(1))
        .to.emit(resolutionExecutorMock, "MockExecutionSimple")
        .withArgs(42)
        .to.emit(resolutionExecutorMock, "MockExecutionSimple")
        .withArgs(43);
    });

    it("should not execute a resolution that is not ended", async () => {
      await setupResolution(
        1,
        false,
        [resolutionExecutorMock.address],
        [dataSimpleFunction(0)]
      );
      let approvalTimestamp = await getEVMTimestamp();

      let votingTimestamp = approvalTimestamp + DAY * 3;
      await setEVMTimestamp(votingTimestamp);
      await mineEVMBlock();

      await expect(resolution.executeResolution(1)).revertedWith(
        "Resolution: not ended"
      );
    });

    it("should not execute a resolution that is not approved", async () => {
      await resolution
        .connect(user1)
        .createResolution(
          "test",
          0,
          false,
          [resolutionExecutorMock.address],
          [dataSimpleFunction(0)]
        );

      await expect(resolution.executeResolution(1)).revertedWith(
        "Resolution: not approved"
      );
    });

    it("should not execute a resolution that didn't pass", async () => {
      await setupUser(user1, 10);
      await setupResolution(
        1,
        false,
        [resolutionExecutorMock.address],
        [dataSimpleFunction(0)]
      );
      let approvalTimestamp = await getEVMTimestamp();

      let votingTimestamp = approvalTimestamp + DAY * 5;
      await setEVMTimestamp(votingTimestamp);
      await mineEVMBlock();

      await expect(resolution.executeResolution(1)).revertedWith(
        "Resolution: not passed"
      );
    });

    it("should not execute a resolution more than once", async () => {
      const data = dataSimpleFunction(42);
      await setupUser(user1, 1);
      await setupResolution(1, true, [resolutionExecutorMock.address], [data]);
      let approvalTimestamp = await getEVMTimestamp();

      let votingTimestamp = approvalTimestamp + DAY * 5;
      await setEVMTimestamp(votingTimestamp);
      await mineEVMBlock();

      await resolution.executeResolution(1);

      await expect(resolution.executeResolution(1)).revertedWith(
        "Resolution: already executed"
      );
    });

    it("should fail if executor fails", async () => {
      const abi = ["function doesNotExist()"];
      const iface = new ethers.utils.Interface(abi);
      const data = iface.encodeFunctionData("doesNotExist");
      await setupUser(user1, 1);
      await setupResolution(1, true, [resolutionExecutorMock.address], [data]);
      let approvalTimestamp = await getEVMTimestamp();

      let votingTimestamp = approvalTimestamp + DAY * 5;
      await setEVMTimestamp(votingTimestamp);
      await mineEVMBlock();

      await expect(resolution.executeResolution(1)).revertedWith(
        "Resolution: execution failed"
      );
    });
  });
});
