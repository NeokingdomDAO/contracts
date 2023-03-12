import { Contract, ContractTransaction } from "ethers";

import {
  InternalMarket,
  InternalMarket__factory,
  NeokingdomToken,
  NeokingdomToken__factory,
  PriceOracle,
  PriceOracle__factory,
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
} from "../typechain";

import { NeokingdomDAO } from "./core";

export const FACTORIES = {
  InternalMarket: InternalMarket__factory,
  NeokingdomToken: NeokingdomToken__factory,
  PriceOracle: PriceOracle__factory,
  RedemptionController: RedemptionController__factory,
  ResolutionManager: ResolutionManager__factory,
  ShareholderRegistry: ShareholderRegistry__factory,
  TokenMock: TokenMock__factory,
  Voting: Voting__factory,
} as const;

export const CONTRACT_NAMES = Object.keys(FACTORIES);
export type ContractNames = keyof typeof FACTORIES;
export type ContextGenerator<T extends Context> = (
  n: NeokingdomDAO
) => Promise<T>;

export type NeokingdomContracts = {
  InternalMarket: InternalMarket;
  NeokingdomToken: NeokingdomToken;
  PriceOracle: PriceOracle;
  RedemptionController: RedemptionController;
  ResolutionManager: ResolutionManager;
  ShareholderRegistry: ShareholderRegistry;
  TokenMock: TokenMock;
  Voting: Voting;
};

export type Context = {};

export type ContractContext = Context & NeokingdomContracts;

export type Step<T extends Context> = (
  c: T
) => Promise<Contract | ContractTransaction>;

export type StepWithExpandable<T extends Context> =
  | ExpandableStep<T>
  | ((c: T) => Promise<Contract | ContractTransaction>);

export type ExpandableStep<T extends Context> = {
  expandable: true;
  f: (c: T) => ProcessedSequence<T>;
};

export type Sequence<T extends Context> = StepWithExpandable<T>[];

export type ProcessedSequence<T extends Context> = Step<T>[];

export function castContract(contractName: ContractNames, contract: Contract) {
  switch (contractName) {
    case "InternalMarket":
      return contract as InternalMarket;
    case "NeokingdomToken":
      return contract as NeokingdomToken;
    case "PriceOracle":
      return contract as PriceOracle;
    case "RedemptionController":
      return contract as RedemptionController;
    case "ResolutionManager":
      return contract as ResolutionManager;
    case "ShareholderRegistry":
      return contract as ShareholderRegistry;
    case "TokenMock":
      return contract as TokenMock;
    case "Voting":
      return contract as Voting;
  }
}

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
