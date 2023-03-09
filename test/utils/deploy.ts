import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { parseEther } from "ethers/lib/utils";
import { ethers, upgrades } from "hardhat";
import { ShareholderRegistry, NeokingdomToken, Voting } from "../../typechain";
import { ResolutionManager } from "../../typechain";
import {
  Voting__factory,
  NeokingdomToken__factory,
  ShareholderRegistry__factory,
  ResolutionManager__factory,
} from "../../typechain";
import { roles } from "./roles";

export async function deployDAO(
  deployer: SignerWithAddress,
  managingBoard: SignerWithAddress
): Promise<[Voting, NeokingdomToken, ShareholderRegistry, ResolutionManager]> {
  let voting: Voting,
    token: NeokingdomToken,
    shareholderRegistry: ShareholderRegistry,
    resolution: ResolutionManager;

  const VotingFactory = (await ethers.getContractFactory(
    "Voting",
    deployer
  )) as Voting__factory;

  const NeokingdomTokenFactory = (await ethers.getContractFactory(
    "NeokingdomToken",
    deployer
  )) as NeokingdomToken__factory;

  const ShareholderRegistryFactory = (await ethers.getContractFactory(
    "ShareholderRegistry",
    deployer
  )) as ShareholderRegistry__factory;

  const ResolutionFactory = (await ethers.getContractFactory(
    "ResolutionManager",
    deployer
  )) as ResolutionManager__factory;

  voting = (await upgrades.deployProxy(VotingFactory, {
    initializer: "initialize",
  })) as Voting;
  await voting.deployed();

  token = (await upgrades.deployProxy(
    NeokingdomTokenFactory,
    ["TestToken", "TT"],
    { initializer: "initialize" }
  )) as NeokingdomToken;
  await token.deployed();

  shareholderRegistry = (await upgrades.deployProxy(
    ShareholderRegistryFactory,
    ["TestShare", "TS"],
    {
      initializer: "initialize",
    }
  )) as ShareholderRegistry;
  await shareholderRegistry.deployed();

  const operatorRole = await roles.OPERATOR_ROLE();
  const resolutionRole = await roles.RESOLUTION_ROLE();
  const shareholderRegistryRole = await roles.SHAREHOLDER_REGISTRY_ROLE();
  const escrowRole = await roles.ESCROW_ROLE();

  await shareholderRegistry.grantRole(operatorRole, deployer.address);
  await shareholderRegistry.grantRole(resolutionRole, deployer.address);

  await voting.grantRole(shareholderRegistryRole, shareholderRegistry.address);
  await voting.grantRole(operatorRole, deployer.address);
  await voting.grantRole(resolutionRole, deployer.address);

  await token.grantRole(operatorRole, deployer.address);
  await token.grantRole(resolutionRole, deployer.address);
  await token.grantRole(escrowRole, deployer.address);

  await voting.setShareholderRegistry(shareholderRegistry.address);
  await voting.setToken(token.address);

  await token.setShareholderRegistry(shareholderRegistry.address);
  await token.setVoting(voting.address);
  await shareholderRegistry.setVoting(voting.address);

  resolution = (await upgrades.deployProxy(
    ResolutionFactory,
    [shareholderRegistry.address, token.address, voting.address],
    {
      initializer: "initialize",
    }
  )) as ResolutionManager;
  await resolution.deployed();

  await shareholderRegistry.grantRole(resolutionRole, resolution.address);
  await voting.grantRole(resolutionRole, resolution.address);
  await token.grantRole(resolutionRole, resolution.address);
  await resolution.grantRole(resolutionRole, resolution.address);

  var managingBoardStatus = await shareholderRegistry.MANAGING_BOARD_STATUS();

  await shareholderRegistry.mint(managingBoard.address, parseEther("1"));
  await shareholderRegistry.setStatus(
    managingBoardStatus,
    managingBoard.address
  );

  return [voting, token, shareholderRegistry, resolution];
}
