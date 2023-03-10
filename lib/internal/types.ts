import { TransactionResponse } from "@ethersproject/providers";
import { Contract, ContractTransaction, Transaction } from "ethers";

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
} from "../../typechain";
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

export type ContractNames = keyof typeof FACTORIES;
export type ContextGenerator<T extends Context> = (
  n: NeokingdomDAO
) => Promise<T>;

export type NeokingdomContracts = {
  internalMarket: InternalMarket;
  neokingdomToken: NeokingdomToken;
  priceOracle: PriceOracle;
  redemptionController: RedemptionController;
  resolutionManager: ResolutionManager;
  shareholderRegistry: ShareholderRegistry;
  tokenMock: TokenMock;
  voting: Voting;
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
  "internalMarket",
  "neokingdomToken",
  "priceOracle",
  "redemptionController",
  "resolutionManager",
  "shareholderRegistry",
  "tokenMock",
  "voting",
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
