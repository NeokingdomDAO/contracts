import { Contract, Wallet } from "ethers";

import type { ContextGenerator, ContractContext, Sequence } from "../types";
import { ContractNames, NeokingdomContracts, ROLES } from "../utils";

export type DeployContext = ContractContext & {
  deployer: Wallet;
  reserve: string;
  deploy: (contractName: ContractNames, args?: any[]) => Promise<Contract>;
  deployProxy: (contractName: ContractNames, args?: any[]) => Promise<Contract>;
};

export const generateDeployContext: ContextGenerator<DeployContext> =
  async function (n) {
    const contracts = (await n.loadContracts()) as NeokingdomContracts;
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
  (c) => c.deployProxy("InternalMarket", [c.token.address]),
  (c) => c.deployProxy("ShareholderRegistry", ["NeokingdomShare", "NEOS"]),
  (c) =>
    c.deployProxy("ResolutionManager", [
      c.registry.address,
      c.token.address,
      c.voting.address,
    ]),

  // Configure PriceOracle
  (c) => c.oracle.relay(["eur", "usd"], [1, 1], [1, 1]),
  (c) => c.oracle.relay(["usdc", "usd"], [1, 1], [1, 1]),

  // Set ACLs
  /////////////

  // FIXME: not sure deployer should be here

  // ResolutionManager
  (c) => c.resolution.grantRole(ROLES.OPERATOR_ROLE, c.deployer.address),
  (c) => c.resolution.grantRole(ROLES.RESOLUTION_ROLE, c.deployer.address),
  (c) => c.resolution.grantRole(ROLES.RESOLUTION_ROLE, c.resolution.address),

  // ShareholdersRegistry
  (c) => c.registry.grantRole(ROLES.OPERATOR_ROLE, c.deployer.address),
  (c) => c.registry.grantRole(ROLES.RESOLUTION_ROLE, c.deployer.address),
  (c) => c.registry.grantRole(ROLES.RESOLUTION_ROLE, c.resolution.address),

  // Voting
  (c) =>
    c.voting.grantRole(ROLES.SHAREHOLDER_REGISTRY_ROLE, c.registry.address),
  (c) => c.voting.grantRole(ROLES.OPERATOR_ROLE, c.deployer.address),
  (c) => c.voting.grantRole(ROLES.RESOLUTION_ROLE, c.deployer.address),
  (c) => c.voting.grantRole(ROLES.RESOLUTION_ROLE, c.resolution.address),

  // Token
  (c) => c.token.grantRole(ROLES.OPERATOR_ROLE, c.deployer.address),
  (c) => c.token.grantRole(ROLES.RESOLUTION_ROLE, c.deployer.address),
  (c) => c.token.grantRole(ROLES.RESOLUTION_ROLE, c.resolution.address),

  // Market
  (c) => c.market.grantRole(ROLES.RESOLUTION_ROLE, c.deployer.address),
  (c) => c.market.grantRole(ROLES.RESOLUTION_ROLE, c.resolution.address),

  // RedemptionController
  (c) => c.redemption.grantRole(ROLES.TOKEN_MANAGER_ROLE, c.token.address),
  (c) => c.redemption.grantRole(ROLES.TOKEN_MANAGER_ROLE, c.market.address),

  // Set interdependencies
  //////////////////////////

  // Market
  (c) => c.registry.setVoting(c.voting.address),

  // Voting
  (c) => c.voting.setShareholderRegistry(c.registry.address),
  (c) => c.voting.setToken(c.token.address),

  // Token
  (c) => c.token.setVoting(c.voting.address),
  (c) => c.token.setInternalMarket(c.market.address),
  (c) => c.token.setRedemptionController(c.redemption.address),
  (c) => c.token.setShareholderRegistry(c.registry.address),

  // Registry
  (c) => c.token.setVoting(c.voting.address),

  (c) => c.market.setRedemptionController(c.redemption.address),
  (c) => c.market.setExchangePair(c.usdc.address, c.oracle.address),
  (c) => c.market.setReserve(c.reserve),
];
