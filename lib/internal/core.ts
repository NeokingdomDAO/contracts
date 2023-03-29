import { TransactionResponse } from "@ethersproject/providers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Wallet } from "ethers";
import { readFile, writeFile } from "fs/promises";

import {
  Context,
  ContextGenerator,
  ContractNames,
  ExpandableStep,
  NeokingdomContracts,
  ProcessedSequence,
  Sequence,
  StepWithExpandable,
  isNeokingdomContracts,
} from "./types";

export type Config = {
  deployer: Wallet | SignerWithAddress;
  reserve: string;
  chainId: number;
  verifyContracts: boolean;
  saveNetworkConfig: boolean;
  verbose: boolean;
};

const defaultConfig: Partial<Config> = {
  verifyContracts: false,
  saveNetworkConfig: false,
  verbose: false,
};

export abstract class NeokingdomDAO {
  config: Config;

  constructor(config: Config) {
    this.config = config;
  }

  static _mergeWithDefaultConfig(config: Partial<Config> = {}) {
    return {
      ...defaultConfig,
      ...config,
    } as Config;
  }

  public getNextStepFilename() {
    return `./deployments/${this.config.chainId}.nextstep`;
  }

  public async setNextStep(n: number) {
    await writeFile(this.getNextStepFilename(), n.toString());
  }

  public async getNextStep() {
    try {
      return parseInt(await readFile(this.getNextStepFilename(), "utf8"));
    } catch (e) {
      if ((e as any).code !== "ENOENT") {
        throw e;
      }
    }
    return 0;
  }

  async run<T extends Context>(
    c: ContextGenerator<T>,
    s: Sequence<T>,
    config: { force?: boolean; restart?: boolean } = {}
  ) {
    const { force, restart } = config;
    const sequence = await this._preprocessSequence(c, s);
    const nextStep = restart ? 0 : await this.getNextStep();
    await this._executeSequence(c, sequence, nextStep, force);
  }

  // There are situations where you don't have all contracts available, and a
  // call to `loadContracts` would fail. One example is when deploying a new
  // DAO, if the DAO doesn't exist `loadContracts` will fail because there are
  // no contracts deployed. That's why this function exists, to support use
  // cases like deploying a new DAO.
  abstract loadContractsPartial(): Promise<Partial<NeokingdomContracts>>;

  async loadContracts(): Promise<NeokingdomContracts> {
    const contracts = await this.loadContractsPartial();
    if (isNeokingdomContracts(contracts)) {
      return contracts;
    }
    throw new Error("Missing contracts");
  }

  abstract deploy(
    contractName: ContractNames,
    args?: any[]
  ): Promise<TransactionResponse>;

  abstract deployProxy(
    contractName: ContractNames,
    args?: any[]
  ): Promise<TransactionResponse>;

  private async _preprocessSequence<T extends Context>(
    c: ContextGenerator<T>,
    s: Sequence<T>
  ) {
    let sequence: ProcessedSequence<T> = [];
    for (let i = 0; i < s.length; i++) {
      // FIXME: Don't know why Awaited<T> is not the same as T
      const context = (await c(this)) as T;
      const step = s[i];
      const expanded = preprocessStep(context, step);
      sequence = [...sequence, ...expanded];
    }
    return sequence;
  }

  private async _executeSequence<T extends Context>(
    c: ContextGenerator<T>,
    s: ProcessedSequence<T>,
    nextStep = 0,
    force = false
  ) {
    for (let i = nextStep; i < s.length; i++) {
      const context = await c(this);
      const step = s[i];
      if (this.config.verbose) {
        console.log(`${i + 1}/${s.length}: ${step.toString()}`);
      }
      let tx: TransactionResponse | null = null;
      try {
        tx = await step(context);
      } catch (e) {
        if (force) {
          console.error(e);
        } else {
          console.error(`${i + 1}/${s.length}: ${step.toString()}`);
          throw e;
        }
      }
      if (this.config.verbose) {
        console.log();
      }
      if (tx) {
        await tx.wait(1);
      }
      await this.setNextStep(i + 1);
    }
  }
}

export const preprocessStep = <T extends Context>(
  c: T,
  s: StepWithExpandable<T>
): ProcessedSequence<T> => {
  if (isExpandable(s)) {
    return s.expandableFunction(c);
  } else {
    return [s];
  }
};

export const expandable = <T extends Context>(
  s: (c: T) => ProcessedSequence<T>
): ExpandableStep<T> => {
  return {
    expandableFunction: s,
  };
};

export const isExpandable = <T extends Context>(
  s: StepWithExpandable<T>
): s is ExpandableStep<T> => {
  return "expandableFunction" in s;
};
