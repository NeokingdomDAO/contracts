import { TransactionResponse } from "@ethersproject/providers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Wallet } from "ethers";

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
  (c) => c.deploy("DAORoles"),
  (c) => c.deploy("TokenMock"),
  (c) => c.deploy("DIAOracleV2Mock"),
  (c) => c.deployProxy("Voting", [c.daoRoles.address]),
  (c) =>
    c.deployProxy("GovernanceToken", [
      c.daoRoles.address,
      "NEOKingdom DAO Governance",
      "NEOKGOV",
    ]),
  (c) => c.deploy("NeokingdomToken", ["NEOKingdom DAO", "NEOK"]),
  (c) => c.deployProxy("RedemptionController", [c.daoRoles.address]),
  (c) =>
    c.deployProxy("InternalMarket", [
      c.daoRoles.address,
      c.governanceToken.address,
    ]),
  (c) =>
    c.deployProxy("ShareholderRegistry", [
      c.daoRoles.address,
      "NeokingdomDAO Share",
      "NEOKSHARE",
    ]),
  (c) =>
    c.deployProxy("ResolutionManager", [
      c.daoRoles.address,
      c.shareholderRegistry.address,
      c.governanceToken.address,
      c.voting.address,
    ]),
  (c) => c.deploy("ProxyAdmin"),

  // Set ACLs
  /////////////

  (c) => c.daoRoles.grantRole(ROLES.OPERATOR_ROLE, c.deployer.address),
  (c) => c.daoRoles.grantRole(ROLES.RESOLUTION_ROLE, c.deployer.address),

  (c) =>
    c.daoRoles.grantRole(ROLES.RESOLUTION_ROLE, c.resolutionManager.address),
  (c) =>
    c.daoRoles.grantRole(
      ROLES.SHAREHOLDER_REGISTRY_ROLE,
      c.shareholderRegistry.address
    ),
  (c) =>
    c.daoRoles.grantRole(ROLES.TOKEN_MANAGER_ROLE, c.governanceToken.address),
  (c) =>
    c.daoRoles.grantRole(ROLES.TOKEN_MANAGER_ROLE, c.internalMarket.address),
  (c) => c.daoRoles.grantRole(ROLES.MARKET_ROLE, c.internalMarket.address),
  (c) =>
    c.neokingdomToken.grantRole(ROLES.MINTER_ROLE, c.governanceToken.address),

  // Set interdependencies
  //////////////////////////

  // Market
  (c) => c.shareholderRegistry.setVoting(c.voting.address),

  // Voting
  (c) => c.voting.setShareholderRegistry(c.shareholderRegistry.address),
  (c) => c.voting.setToken(c.governanceToken.address),

  // Token
  (c) => c.governanceToken.setVoting(c.voting.address),
  (c) =>
    c.governanceToken.setShareholderRegistry(c.shareholderRegistry.address),
  (c) => c.governanceToken.setTokenExternal(c.neokingdomToken.address),
  (c) =>
    c.governanceToken.setRedemptionController(c.redemptionController.address),

  // Token
  (c) => c.governanceToken.setVoting(c.voting.address),
  (c) =>
    c.governanceToken.setRedemptionController(c.redemptionController.address),

  // Registry
  (c) => c.governanceToken.setVoting(c.voting.address),

  (c) =>
    c.internalMarket.setRedemptionController(c.redemptionController.address),
  (c) => c.internalMarket.setReserve(c.reserve),
  (c) => c.internalMarket.setShareholderRegistry(c.shareholderRegistry.address),
  (c) => c.diaOracleV2Mock.setValue("EUR/USD", 100000000, 1688997107),
  (c) => c.diaOracleV2Mock.setValue("USDC/USD", 100000000, 1688997107),
  (c) =>
    c.internalMarket.setExchangePair(
      c.tokenMock.address,
      c.diaOracleV2Mock.address
    ),
];
