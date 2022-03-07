import { Contract } from "ethers";
import { keccak256, toUtf8Bytes } from "ethers/lib/utils";
import { readFile, writeFile } from "fs/promises";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import {
  ResolutionManager,
  ResolutionManager__factory,
  ShareholderRegistry,
  ShareholderRegistry__factory,
  TelediskoToken,
  TelediskoToken__factory,
  Voting,
  Voting__factory,
} from "../typechain";

export const DEFAULT_CONFIG_PATH = "./deployments/networks.json";
export const DEFAULT_LOCALHOST_CONFIG_PATH =
  "./deployments/networks.localhost.json";

export type ContractName =
  | "TelediskoToken"
  | "ResolutionManager"
  | "ShareholderRegistry"
  | "Voting";

export type DAOContract =
  | TelediskoToken
  | ResolutionManager
  | ShareholderRegistry
  | Voting;

export type NetworkConfig = {
  [key: number]: {
    [key in ContractName]?: string;
  };
};

export const ROLES = {
  MANAGER_ROLE: keccak256(toUtf8Bytes("MANAGER_ROLE")),
  RESOLUTION_ROLE: keccak256(toUtf8Bytes("RESOLUTION_ROLE")),
  SHAREHOLDER_REGISTRY_ROLE: keccak256(
    toUtf8Bytes("SHAREHOLDER_REGISTRY_ROLE")
  ),
};

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

export async function exportAddress(
  hre: HardhatRuntimeEnvironment,
  contract: Contract,
  name: ContractName,
  configPath?: string
) {
  configPath = getDefaultConfigPath(hre, configPath);
  const { chainId } = await hre.ethers.provider.getNetwork();
  let previousConfig: NetworkConfig = {};
  try {
    previousConfig = JSON.parse(await readFile(configPath, "utf-8"));
  } catch (e: any) {
    if (e.code !== "ENOENT") {
      throw e;
    }
  }

  const config = {
    ...previousConfig,
    [chainId]: {
      ...previousConfig[chainId],
      [name]: contract.address,
    },
  };

  await writeFile(configPath, JSON.stringify(config, null, 2));
}

type ContractFactory =
  | typeof ShareholderRegistry__factory
  | typeof ResolutionManager__factory
  | typeof TelediskoToken__factory
  | typeof Voting__factory;

export async function loadContract<T extends ContractFactory>(
  hre: HardhatRuntimeEnvironment,
  contractFactory: T,
  name: ContractName,
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

export async function loadContractByName(
  hre: HardhatRuntimeEnvironment,
  name: ContractName,
  configPath?: string
): Promise<DAOContract> {
  configPath = getDefaultConfigPath(hre, configPath);
  const networks: NetworkConfig = JSON.parse(
    await readFile(configPath, "utf8")
  );
  const [deployer] = await hre.ethers.getSigners();
  const { chainId } = await hre.ethers.provider.getNetwork();
  const addresses = networks[chainId];

  if (!addresses || !addresses[name]) {
    console.error(`Cannot find address for ${name}.`);
    process.exit(1);
  }

  // FIXME: I thought `address[name]` type would be `string` because of the previous `if`.
  const address = addresses[name]!;

  switch (name) {
    case "ResolutionManager":
      return ResolutionManager__factory.connect(address, deployer);
    case "ShareholderRegistry":
      return ShareholderRegistry__factory.connect(address, deployer);
    case "TelediskoToken":
      return TelediskoToken__factory.connect(address, deployer);
    case "Voting":
      return Voting__factory.connect(address, deployer);
    default:
      console.error(`Cannot find contract with name ${name}.`);
      process.exit(1);
  }
}
