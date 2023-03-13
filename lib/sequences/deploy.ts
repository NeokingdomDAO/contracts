import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Contract, Wallet } from "ethers";

import type {
  ContextGenerator,
  ContractContext,
  ContractNames,
  NeokingdomContracts,
  Sequence,
} from "../types";
import { ROLES } from "../utils";

export type DeployContext = ContractContext & {
  deployer: Wallet | SignerWithAddress;
  reserve: string;
  deploy: (contractName: ContractNames, args?: any[]) => Promise<Contract>;
  deployProxy: (contractName: ContractNames, args?: any[]) => Promise<Contract>;
};

export const generateDeployContext: ContextGenerator<DeployContext> =
  async function (n) {
    const contracts = (await n.loadContractsPartial()) as NeokingdomContracts;
    const context: DeployContext = {
      ...contracts,
      deployer: n.config.deployer,
      reserve: n.config.reserve,
      deploy: n.deploy.bind(n),
      deployProxy: n.deployProxy.bind(n),
    };
    return context;
  };

export const DEPLOY_SEQUENCE: Sequence<DeployContext> = [
  // Deploy Contracts
  /////////////////////
  (c) => c.deploy("DAORoles"),
  (c) => c.deploy("TokenMock"),
  (c) => c.deploy("PriceOracle"),
  (c) => c.deployProxy("Voting", [c.DAORoles.address]),
  (c) =>
    c.deployProxy("NeokingdomToken", [
      c.DAORoles.address,
      "NeokingdomToken",
      "NEOK",
    ]),
  (c) => c.deployProxy("RedemptionController", [c.DAORoles.address]),
  (c) =>
    c.deployProxy("InternalMarket", [
      c.DAORoles.address,
      c.NeokingdomToken.address,
    ]),
  (c) =>
    c.deployProxy("ShareholderRegistry", [
      c.DAORoles.address,
      "NeokingdomShare",
      "NEOS",
    ]),
  (c) =>
    c.deployProxy("ResolutionManager", [
      c.DAORoles.address,
      c.ShareholderRegistry.address,
      c.NeokingdomToken.address,
      c.Voting.address,
    ]),

  (c) => c.PriceOracle.relay(["eur", "usd"], [1, 1], [1, 1]),
  (c) => c.PriceOracle.relay(["usdc", "usd"], [1, 1], [1, 1]),

  // Set ACLs
  /////////////

  (c) => c.DAORoles.grantRole(ROLES.OPERATOR_ROLE, c.deployer.address),
  (c) => c.DAORoles.grantRole(ROLES.RESOLUTION_ROLE, c.deployer.address),

  (c) =>
    c.DAORoles.grantRole(ROLES.RESOLUTION_ROLE, c.ResolutionManager.address),
  (c) =>
    c.DAORoles.grantRole(
      ROLES.SHAREHOLDER_REGISTRY_ROLE,
      c.ShareholderRegistry.address
    ),
  (c) =>
    c.DAORoles.grantRole(ROLES.TOKEN_MANAGER_ROLE, c.NeokingdomToken.address),
  (c) =>
    c.DAORoles.grantRole(ROLES.TOKEN_MANAGER_ROLE, c.InternalMarket.address),

  // Set interdependencies
  //////////////////////////

  // Market
  (c) => c.ShareholderRegistry.setVoting(c.Voting.address),

  // Voting
  (c) => c.Voting.setShareholderRegistry(c.ShareholderRegistry.address),
  (c) => c.Voting.setToken(c.NeokingdomToken.address),

  // Token
  (c) => c.NeokingdomToken.setVoting(c.Voting.address),
  (c) => c.NeokingdomToken.setInternalMarket(c.InternalMarket.address),
  (c) =>
    c.NeokingdomToken.setRedemptionController(c.RedemptionController.address),
  (c) =>
    c.NeokingdomToken.setShareholderRegistry(c.ShareholderRegistry.address),

  // Registry
  (c) => c.NeokingdomToken.setVoting(c.Voting.address),

  (c) =>
    c.InternalMarket.setRedemptionController(c.RedemptionController.address),
  (c) =>
    c.InternalMarket.setExchangePair(
      c.TokenMock.address,
      c.PriceOracle.address
    ),
  (c) => c.InternalMarket.setReserve(c.reserve),
];
