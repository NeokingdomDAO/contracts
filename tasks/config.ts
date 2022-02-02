import { readFile, writeFile } from "fs/promises";

const DEFAULT_CONFIG_PATH = "./deployments/networks.json";

interface INetworkConfig {
  [key: number]: {
    [name: string]: string;
  };
}

export async function exportAddress(
  chainId: number,
  name: string,
  address: string,
  configPath = DEFAULT_CONFIG_PATH
) {
  let previousConfig: INetworkConfig = {};
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
      [name]: address,
    },
  };

  await writeFile(configPath, JSON.stringify(config, null, 2));
}

export async function getAddress(
  chainId: number,
  name: string,
  configPath = DEFAULT_CONFIG_PATH
) {
  let config: INetworkConfig = {};
  try {
    config = JSON.parse(await readFile(configPath, "utf-8"));
  } catch (e: any) {
    if (e.code !== "ENOENT") {
      throw e;
    }
  }
  return config[chainId] ? config[chainId][name] : null;
}
