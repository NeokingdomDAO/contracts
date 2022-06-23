import { parseEther, parseUnits } from "ethers/lib/utils";
import { HardhatRuntimeEnvironment } from "hardhat/types";

export async function deployProxy(
  hre: HardhatRuntimeEnvironment,
  name: string,
  args: unknown[] = []
) {
  const ethers = hre.ethers;

  // https://github.com/OpenZeppelin/openzeppelin-upgrades/issues/85#issuecomment-1028435049
  // Here is a possible workaround for ethers.js:

  const FEE_DATA = {
    gasPrice: parseEther("0"),
    maxFeePerGas: parseUnits("10", "gwei"),
    maxPriorityFeePerGas: parseUnits("1", "gwei"),
  };

  // Wrap the provider so we can override fee data.
  const provider = new ethers.providers.FallbackProvider([ethers.provider], 1);
  provider.getFeeData = async () => FEE_DATA;

  // Create the signer for the mnemonic, connected to the provider with hardcoded fee data
  const signer = new ethers.Wallet(process.env.TEVMOS_PRIVATE_KEY!).connect(
    provider
  );

  console.log(`  Deploy ${name}.sol`);
  // Get the contract factory connected to signer so it uses hardcoded fee data
  const Contract = await ethers.getContractFactory(name, signer);
  // Should now use hardcoded fee data for deployments
  const contract = await hre.upgrades.deployProxy(Contract, args);
  await contract.deployed();
  console.log("  deployed at", contract.address);
  return contract;
}
