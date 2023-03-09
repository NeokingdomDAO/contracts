import { Contract, ContractTransaction, Wallet } from "ethers";
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

export type Context = {
  market: InternalMarket;
  token: NeokingdomToken;
  oracle: PriceOracle;
  redemption: RedemptionController;
  resolution: ResolutionManager;
  registry: ShareholderRegistry;
  usdc: TokenMock;
  voting: Voting;
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

  async deploy() {
    let lastStep = 0;
    try {
      lastStep = parseInt(await readFile(LASTSTEP_FILENAME, "utf8"));
    } catch (e) {
      if ((e as any).code !== "ENOENT") {
        throw e;
      }
    }
    await this._executeSequence(DEPLOY_SEQUENCE, lastStep);
  }

  private async _deploy(contractName: ContractNames, args: any[] = []) {
    return await deployContract(
      this.hre,
      contractName,
      this.config.verifyContracts,
      args
    );
  }

  private async _deployProxy(contractName: ContractNames, args: any[] = []) {
    return await deployContractProxy(
      this.hre,
      contractName,
      this.config.verifyContracts,
      args
    );
  }

  private async _executeSequence(s: Sequence, lastIndex = 0) {
    for (let i = lastIndex; i < s.length; i++) {
      const contracts = (await loadContracts(this.hre)) as NeokingdomContracts;
      const context: Context = {
        ...contracts,
        deployer: this.config.deployer,
        reserve: this.config.reserve,
        deploy: this._deploy.bind(this),
        deployProxy: this._deployProxy.bind(this),
      };
      const step = s[i];
      console.log(`${i + 1}/${s.length}: ${step.toString()}`);
      const tx = await step(context);
      if (tx.wait) {
        await tx.wait(1);
      }
      await writeFile(LASTSTEP_FILENAME, i.toString());
    }
  }
}

type Step = (c: Context) => Promise<Contract | ContractTransaction>;
type Sequence = Step[];

const DEPLOY_SEQUENCE: Sequence = [
  // Deploy Contracts
  /////////////////////
  (c) => c.deployProxy("Voting"),
  (c) => c.deployProxy("NeokingdomToken", ["NeokingdomToken", "NEOK"]),
  (c) => c.deploy("TokenMock"),
  (c) => c.deploy("PriceOracle"),
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
