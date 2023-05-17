import { TransactionResponse } from "@ethersproject/providers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Wallet } from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import {
  DAORoles,
  DAORoles__factory,
  GovernanceToken,
  GovernanceToken__factory,
  InternalMarket,
  InternalMarket__factory,
  NeokingdomToken,
  NeokingdomToken__factory,
  PriceOracle,
  PriceOracle__factory,
  ProxyAdmin,
  ProxyAdmin__factory,
  RedemptionController,
  RedemptionController__factory,
  ResolutionManager,
  ResolutionManager__factory,
  ShareholderRegistry,
  ShareholderRegistry__factory,
  TokenMock,
  TokenMock__factory,
  Voting,
  Voting__factory,
} from "../../typechain";
import { NeokingdomDAO } from "./core";

export const FACTORIES = {
  DAORoles: DAORoles__factory,
  InternalMarket: InternalMarket__factory,
  GovernanceToken: GovernanceToken__factory,
  NeokingdomToken: NeokingdomToken__factory,
  PriceOracle: PriceOracle__factory,
  RedemptionController: RedemptionController__factory,
  ResolutionManager: ResolutionManager__factory,
  ShareholderRegistry: ShareholderRegistry__factory,
  TokenMock: TokenMock__factory,
  Voting: Voting__factory,
  ProxyAdmin: ProxyAdmin__factory,
} as const;

export type ContractNames = keyof typeof FACTORIES;

export type Contributor = {
  name?: string;
  address: string;
  status: "contributor" | "board" | "investor";
  tokens: string;
};

export type ContextGenerator<T extends Context> = (
  n: NeokingdomDAO
) => Promise<T>;

export type NeokingdomContracts = {
  daoRoles: DAORoles;
  internalMarket: InternalMarket;
  governanceToken: GovernanceToken;
  neokingdomToken: NeokingdomToken;
  priceOracle: PriceOracle;
  redemptionController: RedemptionController;
  resolutionManager: ResolutionManager;
  shareholderRegistry: ShareholderRegistry;
  tokenMock: TokenMock;
  voting: Voting;
  proxyAdmin: ProxyAdmin;
};

export type Context = {};

export type ContractContext = Context & NeokingdomContracts;

export type Step<T extends Context> = (c: T) => Promise<TransactionResponse>;

export type StepWithExpandable<T extends Context> =
  | ExpandableStep<T>
  | ((c: T) => Promise<TransactionResponse>);

export type ExpandableStep<T extends Context> = {
  expandableFunction: (c: T) => ProcessedSequence<T>;
};

export type Sequence<T extends Context> = StepWithExpandable<T>[];

export type ProcessedSequence<T extends Context> = Step<T>[];

// FIXME: There Must Be A Better Way™ to do this in TypeScript
export const CONTRACT_NAMES = [
  "daoRoles",
  "internalMarket",
  "governanceToken",
  "neokingdomToken",
  "priceOracle",
  "redemptionController",
  "resolutionManager",
  "shareholderRegistry",
  "tokenMock",
  "voting",
  "proxyAdmin",
];

export function isNeokingdomContracts(
  n: Partial<NeokingdomContracts>
): n is NeokingdomContracts {
  for (let name of CONTRACT_NAMES) {
    if (!(name in n)) {
      return false;
    }
  }
  return true;
}

export type SetupContext = ContractContext & {
  deployer: Wallet | SignerWithAddress;
  contributors: Contributor[];
  hre: HardhatRuntimeEnvironment;
};

export function generateSetupContext(
  contributors: Contributor[],
  hre: HardhatRuntimeEnvironment
) {
  async function _generateSetupContext(n: NeokingdomDAO) {
    const contracts = (await n.loadContractsPartial()) as NeokingdomContracts;
    const context: SetupContext = {
      ...contracts,
      contributors: contributors,
      deployer: n.config.deployer,
      hre: hre,
    };
    return context;
  }
  return _generateSetupContext;
}
