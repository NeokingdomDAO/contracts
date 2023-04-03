import { keccak256, toUtf8Bytes } from "ethers/lib/utils";
import { readFile } from "fs/promises";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import {
  NeokingdomToken__factory,
  PriceOracle__factory,
  ResolutionManager__factory,
  ShareholderRegistry__factory,
  Voting__factory,
} from "../typechain";

import { ContractNames } from "./internal/types";

export const DEFAULT_CONFIG_PATH = "./deployments/networks.json";
export const DEFAULT_LOCALHOST_CONFIG_PATH =
  "./deployments/networks.localhost.json";

export type NetworkConfig = {
  [key: number]: {
    [key in ContractNames]?: string;
  };
};

export const ROLES = {
  DEFAULT_ADMIN_ROLE:
    "0x0000000000000000000000000000000000000000000000000000000000000000",
  OPERATOR_ROLE: keccak256(toUtf8Bytes("OPERATOR_ROLE")),
  RESOLUTION_ROLE: keccak256(toUtf8Bytes("RESOLUTION_ROLE")),
  ESCROW_ROLE: keccak256(toUtf8Bytes("ESCROW_ROLE")),
  SHAREHOLDER_REGISTRY_ROLE: keccak256(
    toUtf8Bytes("SHAREHOLDER_REGISTRY_ROLE")
  ),
} as const;

function getDefaultConfigPath(
  hre: HardhatRuntimeEnvironment,
  configPath?: string
) {
  if (!configPath) {
    configPath =
      hre.network.name === "localhost"
        ? DEFAULT_LOCALHOST_CONFIG_PATH
        : DEFAULT_CONFIG_PATH;
  }
  return configPath;
}

type ContractFactory =
  | typeof ShareholderRegistry__factory
  | typeof ResolutionManager__factory
  | typeof NeokingdomToken__factory
  | typeof Voting__factory
  | typeof PriceOracle__factory;

export async function loadContract<T extends ContractFactory>(
  hre: HardhatRuntimeEnvironment,
  contractFactory: T,
  name: ContractNames,
  configPath?: string
) {
  configPath = getDefaultConfigPath(hre, configPath);
  const networks: NetworkConfig = JSON.parse(
    await readFile(configPath, "utf8")
  );
  const [deployer] = await hre.ethers.getSigners();
  const { chainId, name: networkName } = await hre.ethers.provider.getNetwork();
  const addresses = networks[chainId];

  if (!addresses || !addresses[name]) {
    console.error(`Cannot find address for ${name} in network ${networkName}.`);
    process.exit(1);
  }

  // FIXME: I thought `address[name]` type would be `string` because of the previous `if`.
  const address = addresses[name]!;

  return contractFactory.connect(address, deployer) as ReturnType<T["connect"]>;
}
