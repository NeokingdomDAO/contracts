import { Contract, ContractTransaction, Wallet } from "ethers";
import { parseEther } from "ethers/lib/utils";
import { readFile, writeFile } from "fs/promises";
import { HardhatRuntimeEnvironment } from "hardhat/types";

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

import wallets from "../dev-wallets.json";
import {
  ContractNames,
  NeokingdomContracts,
  ROLES,
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

type ContextGenerator<T extends Context> = (n: NeokingdomDAO) => Promise<T>;

type Context = {};

type ContractContext = Context & {
  market: InternalMarket;
  token: NeokingdomToken;
  oracle: PriceOracle;
  redemption: RedemptionController;
  resolution: ResolutionManager;
  registry: ShareholderRegistry;
  usdc: TokenMock;
  voting: Voting;
};

type SetupContext = ContractContext & {
  contributors: typeof wallets.contributors;
};

type DeployContext = ContractContext & {
  deployer: Wallet;
  reserve: string;
  deploy: (contractName: ContractNames, args?: any[]) => Promise<Contract>;
  deployProxy: (contractName: ContractNames, args?: any[]) => Promise<Contract>;
};

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

type Step<T extends Context> = (
  c: T
) => Promise<Contract | ContractTransaction>;

type StepWithExpandable<T extends Context> =
  | ExpandableStep<T>
  | ((c: T) => Promise<Contract | ContractTransaction>);

type ExpandableStep<T extends Context> = {
  expandable: true;
  f: (c: T) => ProcessedSequence<T>;
};

type Sequence<T extends Context> = StepWithExpandable<T>[];

type ProcessedSequence<T extends Context> = Step<T>[];

const expand = <T extends Context>(
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

const STAGING_SETUP_SEQUENCE: Sequence<SetupContext> = [
  expandable((c: SetupContext) =>
    c.contributors.map(
      (x) => (e: typeof c) => e.registry.mint(x.address, parseEther("1"))
    )
  ),
  //(c) => c.registry.mint()),
];

export const generateDeployContext: ContextGenerator<DeployContext> =
  async function (n) {
    const contracts = (await loadContracts(n.hre)) as NeokingdomContracts;
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

  // ShareholdersRegistry
  // FIXME: not sure deployer should be here
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
