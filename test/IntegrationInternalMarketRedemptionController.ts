import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { solidity } from "ethereum-waffle";
import { parseEther } from "ethers/lib/utils";
import { ethers, network } from "hardhat";

import {
  GovernanceToken,
  InternalMarket,
  RedemptionController,
  ShareholderRegistry,
  Voting,
} from "../typechain";

import { DEPLOY_SEQUENCE, generateDeployContext } from "../lib";
import { NeokingdomDAOMemory } from "../lib/environment/memory";
import { timeTravel } from "./utils/evm";

chai.use(solidity);
chai.use(chaiAsPromised);
const { expect } = chai;

const e = (v: number) => parseEther(v.toString());

describe("Integration", async () => {
  let snapshotId: string;
  let voting: Voting;
  let internalMarket: InternalMarket;
  let redemptionController: RedemptionController;
  let governanceToken: GovernanceToken;
  let shareholderRegistry: ShareholderRegistry;
  let managingBoardStatus: string;
  let contributorStatus: string;
  let investorStatus: string;
  let deployer: SignerWithAddress;
  let board: SignerWithAddress;
  let reserve: SignerWithAddress;
  let contributor: SignerWithAddress;
  let investor: SignerWithAddress;
  let trader: SignerWithAddress;

  before(async () => {
    [deployer, reserve, board, contributor, investor, trader] =
      await ethers.getSigners();
    const neokingdom = await NeokingdomDAOMemory.initialize({
      deployer,
      reserve: reserve.address,
    });

    await neokingdom.run(generateDeployContext, DEPLOY_SEQUENCE);

    ({
      governanceToken,
      shareholderRegistry,
      internalMarket,
      redemptionController,
    } = await neokingdom.loadContracts());

    managingBoardStatus = await shareholderRegistry.MANAGING_BOARD_STATUS();
    contributorStatus = await shareholderRegistry.CONTRIBUTOR_STATUS();
    investorStatus = await shareholderRegistry.INVESTOR_STATUS();

    await shareholderRegistry.mint(board.address, e(1));
    await shareholderRegistry.mint(contributor.address, e(1));
    await shareholderRegistry.mint(investor.address, e(1));
    await shareholderRegistry.setStatus(managingBoardStatus, board.address);
    await shareholderRegistry.setStatus(contributorStatus, contributor.address);
    await shareholderRegistry.setStatus(investorStatus, investor.address);
  });

  beforeEach(async () => {
    snapshotId = await network.provider.send("evm_snapshot");
  });

  afterEach(async () => {
    await network.provider.send("evm_revert", [snapshotId]);
  });

  it("An investor should not be able to redeem tokens if promoted to contributor", async () => {
    // Investor gets 100 tokens for investing
    await governanceToken.mint(investor.address, e(100));

    // Investor gets promoted to contributor
    await shareholderRegistry.setStatus(contributorStatus, investor.address);
    await governanceToken
      .connect(investor)
      .approve(internalMarket.address, e(100));
    await internalMarket.connect(investor).makeOffer(e(100));
    await timeTravel(60, true);
    expect(
      await redemptionController.redeemableBalance(investor.address)
    ).equal(e(0));
  });
});
