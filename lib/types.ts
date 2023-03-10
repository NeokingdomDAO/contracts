import { Contract, ContractTransaction } from "ethers";

import {
  InternalMarket,
  NeokingdomToken,
  PriceOracle,
  RedemptionController,
  ResolutionManager,
  ShareholderRegistry,
  TokenMock,
  Voting,
} from "../typechain";

import { NeokingdomDAO } from "./core";

export type ContextGenerator<T extends Context> = (
  n: NeokingdomDAO
) => Promise<T>;

export type Context = {};

export type ContractContext = Context & {
  market: InternalMarket;
  token: NeokingdomToken;
  oracle: PriceOracle;
  redemption: RedemptionController;
  resolution: ResolutionManager;
  registry: ShareholderRegistry;
  usdc: TokenMock;
  voting: Voting;
};

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
