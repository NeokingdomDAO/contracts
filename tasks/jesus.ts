import { Signer } from "ethers/lib/ethers";
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

import { getWallet } from "./utils";

type Config = {
  deployer: Signer;
  verifyContracts: false;
  saveNetworkConfig: false;
};
const defaultConfig: Partial<Config> = {
  verifyContracts: false,
  saveNetworkConfig: false,
};

type Contracts = {
  market?: InternalMarket;
  token?: NeokingdomToken;
  oracle?: PriceOracle;
  redemption?: RedemptionController;
  resolution?: ResolutionManager;
  shareholder?: ShareholderRegistry;
  usdc?: TokenMock;
  voting?: Voting;
};

class NeokingdomDAO {
  hre: HardhatRuntimeEnvironment;
  config: Config;

  private constructor(hre: HardhatRuntimeEnvironment, config: Config) {
    this.hre = hre;
    this.config = { ...defaultConfig, ...config };
  }

  static async initialize(
    hre: HardhatRuntimeEnvironment,
    config: Partial<Config>
  ) {
    const deployer = await getWallet(hre);
    const { chainId } = await hre.ethers.provider.getNetwork();
    const newConfig = { ...defaultConfig, ...config };
    newConfig.deployer = await getWallet(hre);
  }

  deploy() {}

  deployNew() {}

  _deploy() {}
}
