import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Contract, ContractTransaction, Wallet } from "ethers";
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
  verifyContracts: false;
  saveNetworkConfig: false;
};

const defaultConfig: Partial<Config> = {
  verifyContracts: false,
  saveNetworkConfig: false,
};

export class NeokingdomDAO {
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
    force = false
  ) {
    const sequence = await this._preprocessSequence(c, s);
    const nextStep = await this.getNextStep();
    await this._executeSequence(c, sequence, nextStep, force);
  }

  async loadContractsPartial(): Promise<Partial<NeokingdomContracts>> {
    throw new Error("Method 'loadContracts()' must be implemented.");
  }

  async loadContracts(): Promise<NeokingdomContracts> {
    const contracts = await this.loadContractsPartial();
    if (isNeokingdomContracts(contracts)) {
      return contracts;
    }
    throw new Error("Missing contracts");
  }

  async deploy(
    contractName: ContractNames,
    args: any[] = []
  ): Promise<Contract> {
    throw new Error("Method 'deploy()' must be implemented.");
  }

  async deployProxy(
    contractName: ContractNames,
    args: any[] = []
  ): Promise<Contract> {
    throw new Error("Method 'deployProxy()' must be implemented.");
  }

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
    nextIndex = 0,
    force = false
  ) {
    for (let i = nextIndex; i < s.length; i++) {
      const context = await c(this);
      const step = s[i];
      console.log(`${i + 1}/${s.length}: ${step.toString()}`);
      let tx: Contract | ContractTransaction | null = null;
      try {
        tx = await step(context);
      } catch (e) {
        if (force) {
          console.error(e);
        } else {
          throw e;
        }
      }
      console.log();
      // FIXME: wait should always be a valid attribute, but it's not
      if (tx?.wait) {
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
    return s.f(c);
  } else {
    return [s];
  }
};

export const expandable = <T extends Context>(
  s: (c: T) => ProcessedSequence<T>
): ExpandableStep<T> => {
  return {
    expandable: true,
    f: s,
  };
};

export const isExpandable = <T extends Context>(
  s: StepWithExpandable<T>
): s is ExpandableStep<T> => {
  return "expandable" in s && "f" in s;
};
