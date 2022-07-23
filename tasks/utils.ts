import { Signer } from "ethers";
import { parseEther } from "ethers/lib/utils";
import { HardhatRuntimeEnvironment } from "hardhat/types";

export async function getWallet(hre: HardhatRuntimeEnvironment) {
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
      maxFeePerGas: fee.maxFeePerGas, //parseUnits("10", "gwei"),
      maxPriorityFeePerGas: fee.maxPriorityFeePerGas, //parseUnits("1", "gwei"),
    };
  };

  // Create the signer for the mnemonic, connected to the provider with hardcoded fee data
  return new ethers.Wallet(privateKey).connect(provider);
}

export async function deployProxy(
  hre: HardhatRuntimeEnvironment,
  signer: Signer,
  name: string,
  args: unknown[] = []
) {
  const ethers = hre.ethers;
  // Get the contract factory connected to signer so it uses hardcoded fee data
  const Contract = await ethers.getContractFactory(name, signer);
  // Should now use hardcoded fee data for deployments
  const contract = await hre.upgrades.deployProxy(Contract, args);
  await contract.deployed();
  console.log(`  ${name}.sol deployed at ${contract.address}`);
  return contract;
}
