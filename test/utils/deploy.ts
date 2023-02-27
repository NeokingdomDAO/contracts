import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { parseEther } from "ethers/lib/utils";
import { ethers, upgrades } from "hardhat";

import {
  InternalMarket,
  InternalMarket__factory,
  NeokingdomToken,
  PriceOracle,
  PriceOracle__factory,
  RedemptionController,
  RedemptionController__factory,
  ShareholderRegistry,
  TokenMock,
  TokenMock__factory,
  Voting,
} from "../../typechain";
import { ResolutionManager } from "../../typechain";
import {
  NeokingdomToken__factory,
  ResolutionManager__factory,
  ShareholderRegistry__factory,
  Voting__factory,
} from "../../typechain";
import { roles } from "./roles";

export async function deployDAO(
  deployer: SignerWithAddress,
  managingBoard: SignerWithAddress,
  reserve: SignerWithAddress
) {
  let voting: Voting;
  let token: NeokingdomToken;
  let usdc: TokenMock;
  let registry: ShareholderRegistry;
  let resolution: ResolutionManager;
  let market: InternalMarket;
  let redemption: RedemptionController;
  let oracle: PriceOracle;

  // Load factories
  ///////////////////

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

  const InternalMarketFactory = (await ethers.getContractFactory(
    "InternalMarket",
    deployer
  )) as InternalMarket__factory;

  const RedemptionControllerFactory = (await ethers.getContractFactory(
    "RedemptionController",
    deployer
  )) as RedemptionController__factory;

  const PriceOracleFactory = (await ethers.getContractFactory(
    "PriceOracle",
    deployer
  )) as PriceOracle__factory;

  const TokenMockFactory = (await ethers.getContractFactory(
    "TokenMock",
    deployer
  )) as TokenMock__factory;

  // Deploy and initialize contacts
  ///////////////////////////////////

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

  usdc = await TokenMockFactory.deploy();
  await usdc.deployed();

  oracle = await PriceOracleFactory.deploy();
  await oracle.deployed();

  await oracle.relay(["eur", "usd"], [1, 1], [1, 1]);
  await oracle.relay(["usdc", "usd"], [1, 1], [1, 1]);

  redemption = (await upgrades.deployProxy(RedemptionControllerFactory, {
    initializer: "initialize",
  })) as RedemptionController;
  await redemption.deployed();

  market = (await upgrades.deployProxy(InternalMarketFactory, [
    token.address,
  ])) as InternalMarket;
  await market.deployed();

  registry = (await upgrades.deployProxy(
    ShareholderRegistryFactory,
    ["TestShare", "TS"],
    {
      initializer: "initialize",
    }
  )) as ShareholderRegistry;
  await registry.deployed();

  resolution = (await upgrades.deployProxy(
    ResolutionFactory,
    [registry.address, token.address, voting.address],
    {
      initializer: "initialize",
    }
  )) as ResolutionManager;
  await resolution.deployed();

  // Set ACLs and other interdependencies
  /////////////////////////////////////////

  const operatorRole = await roles.OPERATOR_ROLE();
  const resolutionRole = await roles.RESOLUTION_ROLE();
  const shareholderRegistryRole = await roles.SHAREHOLDER_REGISTRY_ROLE();
  const tokenManagerRole = await roles.TOKEN_MANAGER_ROLE();

  await registry.grantRole(operatorRole, deployer.address);
  await registry.grantRole(resolutionRole, deployer.address);

  await voting.grantRole(shareholderRegistryRole, registry.address);
  await voting.grantRole(operatorRole, deployer.address);
  await voting.grantRole(resolutionRole, deployer.address);

  await token.grantRole(operatorRole, deployer.address);
  await token.grantRole(resolutionRole, deployer.address);

  await market.grantRole(resolutionRole, deployer.address);

  await voting.setShareholderRegistry(registry.address);
  await voting.setToken(token.address);

  await token.setShareholderRegistry(registry.address);
  await token.setVoting(voting.address);

  await registry.setVoting(voting.address);

  await redemption.grantRole(tokenManagerRole, token.address);
  await redemption.grantRole(tokenManagerRole, market.address);
  await redemption.grantRole(tokenManagerRole, market.address);

  await token.setInternalMarket(market.address);
  await token.setRedemptionController(redemption.address);

  await registry.grantRole(resolutionRole, resolution.address);
  await voting.grantRole(resolutionRole, resolution.address);
  await token.grantRole(resolutionRole, resolution.address);
  await resolution.grantRole(resolutionRole, resolution.address);

  const managingBoardStatus = await registry.MANAGING_BOARD_STATUS();

  await registry.mint(managingBoard.address, parseEther("1"));
  await registry.setStatus(managingBoardStatus, managingBoard.address);

  await market.setRedemptionController(redemption.address);
  await market.setExchangePair(usdc.address, oracle.address);
  // FIXME
  await market.setReserve(reserve.address);

  return {
    voting,
    token,
    registry,
    resolution,
    market,
    redemption,
    usdc,
  };
}
