import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { parseEther } from "ethers/lib/utils";
import { ethers, upgrades } from "hardhat";
import {
  InternalMarket,
  InternalMarket__factory,
  ShareholderRegistry,
  TelediskoToken,
  Voting,
} from "../../typechain";
import { ResolutionManager } from "../../typechain";
import {
  Voting__factory,
  TelediskoToken__factory,
  ShareholderRegistry__factory,
  ResolutionManager__factory,
} from "../../typechain";
import { roles } from "./roles";

export async function deployDAO(
  deployer: SignerWithAddress,
  managingBoard: SignerWithAddress
) {
  let voting: Voting;
  let token: TelediskoToken;
  let registry: ShareholderRegistry;
  let resolution: ResolutionManager;
  let market: InternalMarket;

  const VotingFactory = (await ethers.getContractFactory(
    "Voting",
    deployer
  )) as Voting__factory;

  const TelediskoTokenFactory = (await ethers.getContractFactory(
    "TelediskoToken",
    deployer
  )) as TelediskoToken__factory;

  const InternalMarketFactory = (await ethers.getContractFactory(
    "InternalMarket",
    deployer
  )) as InternalMarket__factory;

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
    TelediskoTokenFactory,
    ["TestToken", "TT"],
    { initializer: "initialize" }
  )) as TelediskoToken;
  await token.deployed();

  market = await InternalMarketFactory.deploy(token.address);
  await market.deployed();

  registry = (await upgrades.deployProxy(
    ShareholderRegistryFactory,
    ["TestShare", "TS"],
    {
      initializer: "initialize",
    }
  )) as ShareholderRegistry;
  await registry.deployed();

  const operatorRole = await roles.OPERATOR_ROLE();
  const resolutionRole = await roles.RESOLUTION_ROLE();
  const shareholderRegistryRole = await roles.SHAREHOLDER_REGISTRY_ROLE();
  const escrowRole = await roles.ESCROW_ROLE();

  await registry.grantRole(operatorRole, deployer.address);
  await registry.grantRole(resolutionRole, deployer.address);

  await voting.grantRole(shareholderRegistryRole, registry.address);
  await voting.grantRole(operatorRole, deployer.address);
  await voting.grantRole(resolutionRole, deployer.address);

  await token.grantRole(operatorRole, deployer.address);
  await token.grantRole(resolutionRole, deployer.address);

  await market.grantRole(escrowRole, deployer.address);

  await voting.setShareholderRegistry(registry.address);
  await voting.setToken(token.address);

  await token.setShareholderRegistry(registry.address);
  await token.setVoting(voting.address);

  await registry.setVoting(voting.address);

  await token.setInternalMarket(market.address);

  resolution = (await upgrades.deployProxy(
    ResolutionFactory,
    [registry.address, token.address, voting.address],
    {
      initializer: "initialize",
    }
  )) as ResolutionManager;
  await resolution.deployed();

  await registry.grantRole(resolutionRole, resolution.address);
  await voting.grantRole(resolutionRole, resolution.address);
  await token.grantRole(resolutionRole, resolution.address);
  await resolution.grantRole(resolutionRole, resolution.address);

  var managingBoardStatus = await registry.MANAGING_BOARD_STATUS();

  await registry.mint(managingBoard.address, parseEther("1"));
  await registry.setStatus(managingBoardStatus, managingBoard.address);

  return { voting, token, registry, resolution, market };
}
