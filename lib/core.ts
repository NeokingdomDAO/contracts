import { Wallet } from "ethers";
import { readFile, writeFile } from "fs/promises";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import {
  Context,
  ContextGenerator,
  ExpandableStep,
  ProcessedSequence,
  Sequence,
  StepWithExpandable,
} from "./types";
import {
  ContractNames,
  deployContract,
  deployContractProxy,
  getWallet,
  loadContracts,
} from "./utils";

export type Config = {
  deployer: Wallet;
  reserve: string;
  chainId: number;
  verifyContracts: false;
  saveNetworkConfig: false;
};

const defaultConfig: Partial<Config> = {
  verifyContracts: false,
  saveNetworkConfig: false,
};

const LASTSTEP_FILENAME = "./deployments/.laststep";

export class NeokingdomDAO {
  hre: HardhatRuntimeEnvironment;
  config: Config;

  private constructor(hre: HardhatRuntimeEnvironment, config: Config) {
    this.hre = hre;
    this.config = config;
  }

  static async initialize(
    hre: HardhatRuntimeEnvironment,
    config: Partial<Config> = {}
  ) {
    const deployer = config.deployer ? config.deployer : await getWallet(hre);
    const reserve = config.reserve ? config.reserve : deployer.address;
    const { chainId } = await hre.ethers.provider.getNetwork();

    const newConfig = {
      ...defaultConfig,
      ...config,
      chainId,
      deployer,
      reserve,
    } as Config;

    return new NeokingdomDAO(hre, newConfig);
  }

  async run<T extends Context>(c: ContextGenerator<T>, s: Sequence<T>) {
    let lastStep = 0;
    try {
      lastStep = parseInt(await readFile(LASTSTEP_FILENAME, "utf8"));
    } catch (e) {
      if ((e as any).code !== "ENOENT") {
        throw e;
      }
    }
    const sequence = await this._preprocessSequence(c, s);
    await this._executeSequence(c, sequence, lastStep + 1);
  }

  async loadContracts() {
    return loadContracts(this.hre);
  }

  async deploy(contractName: ContractNames, args: any[] = []) {
    return await deployContract(
      this.hre,
      contractName,
      this.config.verifyContracts,
      args
    );
  }

  async deployProxy(contractName: ContractNames, args: any[] = []) {
    return await deployContractProxy(
      this.hre,
      contractName,
      this.config.verifyContracts,
      args
    );
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
      sequence = [...sequence, ...expand(context, step)];
      console.log(`${i + 1}/${s.length}: ${step.toString()}`);
    }
    return sequence;
  }

  private async _executeSequence<T extends Context>(
    c: ContextGenerator<T>,
    s: ProcessedSequence<T>,
    lastIndex = 0
  ) {
    for (let i = lastIndex; i < s.length; i++) {
      const context = await c(this);
      const step = s[i];
      console.log(`${i + 1}/${s.length}: ${step.toString()}`);
      const tx = await step(context);
      // FIXME: wait should always be a valid attribute, but it's not
      if (tx.wait) {
        await tx.wait(1);
      }
      await writeFile(LASTSTEP_FILENAME, i.toString());
    }
  }
}

export const expand = <T extends Context>(
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
