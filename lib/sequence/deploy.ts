import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Contract, Wallet } from "ethers";

import type {
  ContextGenerator,
  ContractContext,
  ContractNames,
  NeokingdomContracts,
  Sequence,
} from "../internal/types";
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
  (c) => c.deploy("TokenMock"),
  (c) => c.deploy("PriceOracle"),
  (c) => c.deployProxy("Voting"),
  (c) => c.deployProxy("NeokingdomToken", ["NeokingdomToken", "NEOK"]),
  (c) => c.deployProxy("RedemptionController"),
  (c) => c.deployProxy("InternalMarket", [c.NeokingdomToken.address]),
  (c) => c.deployProxy("ShareholderRegistry", ["NeokingdomShare", "NEOS"]),
  (c) =>
    c.deployProxy("ResolutionManager", [
      c.ShareholderRegistry.address,
      c.NeokingdomToken.address,
      c.Voting.address,
    ]),

  (c) => c.PriceOracle.relay(["eur", "usd"], [1, 1], [1, 1]),
  (c) => c.PriceOracle.relay(["usdc", "usd"], [1, 1], [1, 1]),

  // Set ACLs
  /////////////

  // FIXME: not sure deployer should be here

  // ResolutionManager
  (c) => c.ResolutionManager.grantRole(ROLES.OPERATOR_ROLE, c.deployer.address),
  (c) =>
    c.ResolutionManager.grantRole(ROLES.RESOLUTION_ROLE, c.deployer.address),
  (c) =>
    c.ResolutionManager.grantRole(
      ROLES.RESOLUTION_ROLE,
      c.ResolutionManager.address
    ),

  // ShareholderRegistry
  (c) =>
    c.ShareholderRegistry.grantRole(ROLES.OPERATOR_ROLE, c.deployer.address),
  (c) =>
    c.ShareholderRegistry.grantRole(ROLES.RESOLUTION_ROLE, c.deployer.address),
  (c) =>
    c.ShareholderRegistry.grantRole(
      ROLES.RESOLUTION_ROLE,
      c.ResolutionManager.address
    ),

  // Voting
  (c) =>
    c.Voting.grantRole(
      ROLES.SHAREHOLDER_REGISTRY_ROLE,
      c.ShareholderRegistry.address
    ),
  (c) => c.Voting.grantRole(ROLES.OPERATOR_ROLE, c.deployer.address),
  (c) => c.Voting.grantRole(ROLES.RESOLUTION_ROLE, c.deployer.address),
  (c) => c.Voting.grantRole(ROLES.RESOLUTION_ROLE, c.ResolutionManager.address),

  // Token
  (c) => c.NeokingdomToken.grantRole(ROLES.OPERATOR_ROLE, c.deployer.address),
  (c) => c.NeokingdomToken.grantRole(ROLES.RESOLUTION_ROLE, c.deployer.address),
  (c) =>
    c.NeokingdomToken.grantRole(
      ROLES.RESOLUTION_ROLE,
      c.ResolutionManager.address
    ),

  // Market
  (c) => c.InternalMarket.grantRole(ROLES.RESOLUTION_ROLE, c.deployer.address),
  (c) =>
    c.InternalMarket.grantRole(
      ROLES.RESOLUTION_ROLE,
      c.ResolutionManager.address
    ),

  // RedemptionController
  (c) =>
    c.RedemptionController.grantRole(
      ROLES.TOKEN_MANAGER_ROLE,
      c.NeokingdomToken.address
    ),
  (c) =>
    c.RedemptionController.grantRole(
      ROLES.TOKEN_MANAGER_ROLE,
      c.InternalMarket.address
    ),

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
