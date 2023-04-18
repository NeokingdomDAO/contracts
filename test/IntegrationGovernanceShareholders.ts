import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { solidity } from "ethereum-waffle";
import { parseEther } from "ethers/lib/utils";
import { ethers, network } from "hardhat";

import { NeokingdomToken, ShareholderRegistry, Voting } from "../typechain";

import { DEPLOY_SEQUENCE, generateDeployContext } from "../lib";
import { NeokingdomDAOMemory } from "../lib/environment/memory";

chai.use(solidity);
chai.use(chaiAsPromised);
const { expect } = chai;

const e = (v: number) => parseEther(v.toString());

describe("Integration", async () => {
  let snapshotId: string;
  let voting: Voting;
  let neokingdomToken: NeokingdomToken;
  let shareholderRegistry: ShareholderRegistry;
  let managingBoardStatus: string;
  let contributorStatus: string;
  let investorStatus: string;
  let deployer: SignerWithAddress;
  let board: SignerWithAddress;
  let reserve: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let user3: SignerWithAddress;
  let free1: SignerWithAddress;
  let free2: SignerWithAddress;
  let free3: SignerWithAddress;

  before(async () => {
    [deployer, board, reserve, user1, user2, user3, free1, free2, free3] =
      await ethers.getSigners();
    const neokingdom = await NeokingdomDAOMemory.initialize({
      deployer,
      reserve: reserve.address,
    });

    await neokingdom.run(generateDeployContext, DEPLOY_SEQUENCE);

    ({ voting, neokingdomToken, shareholderRegistry } =
      await neokingdom.loadContracts());

    managingBoardStatus = await shareholderRegistry.MANAGING_BOARD_STATUS();
    contributorStatus = await shareholderRegistry.CONTRIBUTOR_STATUS();
    investorStatus = await shareholderRegistry.INVESTOR_STATUS();
  });

  beforeEach(async () => {
    snapshotId = await network.provider.send("evm_snapshot");
  });

  afterEach(async () => {
    await network.provider.send("evm_revert", [snapshotId]);
  });

  it("shares + tokens = voting power", async () => {
    async function check({
      totalVotingPower = 0,
      boardVotingPower = 0,
      user1VotingPower = 0,
      user2VotingPower = 0,
    }) {
      expect(await voting.getTotalVotingPower()).equal(e(totalVotingPower));
      expect(await voting.getVotingPower(board.address)).equal(
        e(boardVotingPower)
      );
      expect(await voting.getVotingPower(user1.address)).equal(
        e(user1VotingPower)
      );
      expect(await voting.getVotingPower(user2.address)).equal(
        e(user2VotingPower)
      );
    }

    // In a real world scenario some shares are held by the DAO, others by the founder
    await shareholderRegistry.mint(shareholderRegistry.address, e(3000));
    await shareholderRegistry.mint(board.address, e(7000));
    await shareholderRegistry.setStatus(managingBoardStatus, board.address);

    await check({
      totalVotingPower: 7000,
      boardVotingPower: 7000,
    });

    // A share is transferred from the managing board to user1
    await shareholderRegistry.transferFrom(board.address, user1.address, e(1));

    // User1 is not a contributor yet, so the total voting power is
    // decremented
    await check({
      totalVotingPower: 7000 - 1,
      boardVotingPower: 7000 - 1,
    });

    // user1 is promoted to contributor
    await shareholderRegistry.setStatus(contributorStatus, user1.address);

    // Total voting power goes back to 7000
    await check({
      totalVotingPower: 7000,
      boardVotingPower: 7000 - 1,
      user1VotingPower: 1,
    });

    // user1 is rewarded with 6000 tokens
    await neokingdomToken.mint(user1.address, e(6000));
    await check({
      totalVotingPower: 7000 + 6000,
      boardVotingPower: 7000 - 1,
      user1VotingPower: 1 + 6000,
    });

    // A share is transferred from the managing board to user2
    await shareholderRegistry.transferFrom(board.address, user2.address, e(1));
    // user2 is promoted to contributor
    await shareholderRegistry.setStatus(contributorStatus, user2.address);
    // user2 is rewarded with 3000 tokens
    await neokingdomToken.mint(user2.address, e(3000));

    await check({
      totalVotingPower: 7000 + 6000 + 3000,
      boardVotingPower: 7000 - 1 - 1,
      user1VotingPower: 1 + 6000,
      user2VotingPower: 1 + 3000,
    });

    // user2 misbehaves and is demoted to investor
    await shareholderRegistry.setStatus(investorStatus, user2.address);
    await check({
      totalVotingPower: 7000 + 6000 - 1,
      boardVotingPower: 7000 - 1 - 1,
      user1VotingPower: 1 + 6000,
    });
  });
});
