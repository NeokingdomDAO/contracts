import { Contract, Signer } from "ethers";
import { parseEther } from "ethers/lib/utils";
import { readFile, writeFile } from "fs/promises";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import {
  InternalMarket,
  InternalMarket__factory,
  NeokingdomToken,
  NeokingdomToken__factory,
  PriceOracle,
  PriceOracle__factory,
  RedemptionController,
  RedemptionController__factory,
  ResolutionManager,
  ResolutionManager__factory,
  ShareholderRegistry,
  ShareholderRegistry__factory,
  TokenMock,
  TokenMock__factory,
  Voting,
  Voting__factory,
} from "../typechain";

const FACTORIES = {
  InternalMarket: InternalMarket__factory,
  NeokingdomToken: NeokingdomToken__factory,
  PriceOracle: PriceOracle__factory,
  RedemptionController: RedemptionController__factory,
  ResolutionManager: ResolutionManager__factory,
  ShareholderRegistry: ShareholderRegistry__factory,
  TokenMock: TokenMock__factory,
  Voting: Voting__factory,
} as const;

type ContractNames = keyof typeof FACTORIES;

type NeokingdomNetworkFile = {
  [key in ContractNames]?: {
    address: string;
    blockNumber: number;
    blockHash: string;
  };
};

type NeokingdomContracts = {
  market?: InternalMarket;
  token?: NeokingdomToken;
  oracle?: PriceOracle;
  redemption?: RedemptionController;
  resolution?: ResolutionManager;
  registry?: ShareholderRegistry;
  usdc?: TokenMock;
  voting?: Voting;
};

function isContractName(name: string): name is ContractNames {
  return Object.keys(FACTORIES).includes(name);
}

function getConfigPath(chainId: number) {
  return `./deployment/${chainId}.network.json`;
}

export async function deployContractProxy(
  hre: HardhatRuntimeEnvironment,
  contractName: ContractNames,
  verify = false,
  args: any[] = [],
  libraries = ({} = {})
) {
  return _deployContract(hre, contractName, verify, args, libraries, true);
}

export async function deployContract(
  hre: HardhatRuntimeEnvironment,
  contractName: ContractNames,
  verify = false,
  args: any[] = [],
  libraries = ({} = {})
) {
  return _deployContract(hre, contractName, verify, args, libraries, false);
}

export async function _deployContract(
  hre: HardhatRuntimeEnvironment,
  contractName: ContractNames,
  verify = false,
  args: any[] = [],
  libraries = ({} = {}),
  proxy = false
) {
  const factory = await hre.ethers.getContractFactory(contractName, {
    libraries,
  });
  console.log("Deploy:", contractName);
  const { chainId } = await hre.ethers.provider.getNetwork();
  let contract: Contract;
  if (proxy) {
    contract = await hre.upgrades.deployProxy(factory, args);
  } else {
    contract = await factory.deploy(...args);
  }
  const receipt = await contract.deployTransaction.wait(1);
  console.log("Contract address:", contract.address);

  // Save the address in the config json file
  const configPath = getConfigPath(chainId);
  let contracts: NeokingdomNetworkFile = {};
  try {
    contracts = JSON.parse(await readFile(configPath, "utf8"));
  } catch (e) {
    if ((e as any).code !== "ENOENT") {
      throw e;
    }
  }
  contracts[contractName] = {
    address: contract.address,
    blockNumber: receipt.blockNumber,
    blockHash: receipt.blockHash,
  };
  await writeFile(configPath, JSON.stringify(contracts, null, 2));
  console.log(
    `Address ${contract.address} stored for ${contractName} at ${configPath}`
  );

  // Save constructor arguments for verification
  await writeFile(
    `./deployment/${chainId}.${contractName}.arguments.json`,
    JSON.stringify(args)
  );

  if (verify) {
    console.log("Wait 2 blocks");
    await contract.deployTransaction.wait(2);
    console.log("Verify contract");
    try {
      await hre.run("verify", {
        address: contract.address,
        constructorArgs: `deployment/${chainId}.${contractName}.arguments.json`,
        contract: `contracts/${contractName}.sol:${contractName}`,
      });
    } catch (e) {
      console.error(e);
    }
  }

  return contract;
}

export async function loadContract<T>(
  hre: HardhatRuntimeEnvironment,
  contractName: ContractNames
) {
  if (isContractName(contractName)) {
    const [deployer] = await hre.ethers.getSigners();
    const { chainId } = await hre.ethers.provider.getNetwork();
    const configPath = getConfigPath(chainId);
    const contracts: NeokingdomNetworkFile = JSON.parse(
      await readFile(configPath, "utf8")
    );
    const address = contracts[contractName]?.address;
    if (address) {
      return FACTORIES[contractName].connect(address, deployer) as T;
    } else {
      throw "Contract doesn't have an address";
    }
  } else {
    throw "Contract doesn't exist";
  }
}

export async function loadContracts(
  hre: HardhatRuntimeEnvironment
): Promise<NeokingdomContracts> {
  function _loadContract<T>(
    hre: HardhatRuntimeEnvironment,
    contractName: ContractNames
  ) {
    try {
      return loadContract<T>(hre, contractName);
    } catch (e) {
      if ((e as any).toString() === "Contact doesn't have an address") {
        return;
      }
    }
  }

  return {
    market: await _loadContract<InternalMarket>(hre, "InternalMarket"),
    token: await _loadContract<NeokingdomToken>(hre, "NeokingdomToken"),
    oracle: await _loadContract<PriceOracle>(hre, "PriceOracle"),
    redemption: await _loadContract<RedemptionController>(
      hre,
      "RedemptionController"
    ),
    resolution: await _loadContract<ResolutionManager>(
      hre,
      "ResolutionManager"
    ),
    registry: await _loadContract<ShareholderRegistry>(
      hre,
      "ShareholderRegistry"
    ),
    usdc: await _loadContract<TokenMock>(hre, "TokenMock"),
    voting: await _loadContract<Voting>(hre, "Voting"),
  };
}

export async function getWallet(
  hre: HardhatRuntimeEnvironment
): Promise<Signer> {
  const ethers = hre.ethers;
  const { chainId } = await hre.ethers.provider.getNetwork();

  if (chainId !== 9000 && chainId !== 9001) {
    const [signer] = await hre.ethers.getSigners();
    return signer;
  }

  const privateKey =
    chainId === 9000
      ? process.env.TEVMOS_PRIVATE_KEY
      : process.env.EVMOS_PRIVATE_KEY;

  if (!privateKey) {
    console.error("Cannot load private key for chainId", chainId);
    process.exit(1);
  }

  // Wrap the provider so we can override fee data.
  const provider = new ethers.providers.FallbackProvider([ethers.provider], 1);
  provider.getFeeData = async () => {
    const fee = await ethers.provider.getFeeData();

    // https://github.com/OpenZeppelin/openzeppelin-upgrades/issues/85#issuecomment-1028435049
    // Here is a possible workaround for ethers.js:
    return {
      gasPrice: parseEther("0"),
      lastBaseFeePerGas: parseEther("0"),
      maxFeePerGas: fee.maxFeePerGas, //parseUnits("10", "gwei"),
      maxPriorityFeePerGas: fee.maxPriorityFeePerGas, //parseUnits("1", "gwei"),
    };
  };

  // Create the signer for the mnemonic, connected to the provider with hardcoded fee data
  return new ethers.Wallet(privateKey).connect(provider);
}
