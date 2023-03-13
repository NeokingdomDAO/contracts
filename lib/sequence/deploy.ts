import { TransactionResponse } from "@ethersproject/providers";
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
  deploy: (
    contractName: ContractNames,
    args?: any[]
  ) => Promise<TransactionResponse>;
  deployProxy: (
    contractName: ContractNames,
    args?: any[]
  ) => Promise<TransactionResponse>;
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
  (c) => c.deployProxy("InternalMarket", [c.neokingdomToken.address]),
  (c) => c.deployProxy("ShareholderRegistry", ["NeokingdomShare", "NEOS"]),
  (c) =>
    c.deployProxy("ResolutionManager", [
      c.shareholderRegistry.address,
      c.neokingdomToken.address,
      c.voting.address,
    ]),

  (c) => c.priceOracle.relay(["EUR", "USD"], [1, 1], [1, 1]),
  (c) => c.priceOracle.relay(["USDC", "USD"], [1, 1], [1, 1]),

  // Set ACLs
  /////////////

  // FIXME: not sure deployer should be here

  // ResolutionManager
  (c) => c.resolutionManager.grantRole(ROLES.OPERATOR_ROLE, c.deployer.address),
  (c) =>
    c.resolutionManager.grantRole(ROLES.RESOLUTION_ROLE, c.deployer.address),
  (c) =>
    c.resolutionManager.grantRole(
      ROLES.RESOLUTION_ROLE,
      c.resolutionManager.address
    ),

  // ShareholderRegistry
  (c) =>
    c.shareholderRegistry.grantRole(ROLES.OPERATOR_ROLE, c.deployer.address),
  (c) =>
    c.shareholderRegistry.grantRole(ROLES.RESOLUTION_ROLE, c.deployer.address),
  (c) =>
    c.shareholderRegistry.grantRole(
      ROLES.RESOLUTION_ROLE,
      c.resolutionManager.address
    ),

  // Voting
  (c) =>
    c.voting.grantRole(
      ROLES.SHAREHOLDER_REGISTRY_ROLE,
      c.shareholderRegistry.address
    ),
  (c) => c.voting.grantRole(ROLES.OPERATOR_ROLE, c.deployer.address),
  (c) => c.voting.grantRole(ROLES.RESOLUTION_ROLE, c.deployer.address),
  (c) => c.voting.grantRole(ROLES.RESOLUTION_ROLE, c.resolutionManager.address),

  // Token
  (c) => c.neokingdomToken.grantRole(ROLES.OPERATOR_ROLE, c.deployer.address),
  (c) => c.neokingdomToken.grantRole(ROLES.RESOLUTION_ROLE, c.deployer.address),
  (c) =>
    c.neokingdomToken.grantRole(
      ROLES.RESOLUTION_ROLE,
      c.resolutionManager.address
    ),

  // Market
  (c) => c.internalMarket.grantRole(ROLES.RESOLUTION_ROLE, c.deployer.address),
  (c) =>
    c.internalMarket.grantRole(
      ROLES.RESOLUTION_ROLE,
      c.resolutionManager.address
    ),

  // RedemptionController
  (c) =>
    c.redemptionController.grantRole(
      ROLES.TOKEN_MANAGER_ROLE,
      c.neokingdomToken.address
    ),
  (c) =>
    c.redemptionController.grantRole(
      ROLES.TOKEN_MANAGER_ROLE,
      c.internalMarket.address
    ),

  // Set interdependencies
  //////////////////////////

  // Market
  (c) => c.shareholderRegistry.setVoting(c.voting.address),

  // Voting
  (c) => c.voting.setShareholderRegistry(c.shareholderRegistry.address),
  (c) => c.voting.setToken(c.neokingdomToken.address),

  // Token
  (c) => c.neokingdomToken.setVoting(c.voting.address),
  (c) => c.neokingdomToken.setInternalMarket(c.internalMarket.address),
  (c) =>
    c.neokingdomToken.setRedemptionController(c.redemptionController.address),
  (c) =>
    c.neokingdomToken.setShareholderRegistry(c.shareholderRegistry.address),

  // Registry
  (c) => c.neokingdomToken.setVoting(c.voting.address),

  (c) =>
    c.internalMarket.setRedemptionController(c.redemptionController.address),
  (c) =>
    c.internalMarket.setExchangePair(
      c.tokenMock.address,
      c.priceOracle.address
    ),
  (c) => c.internalMarket.setReserve(c.reserve),
];
