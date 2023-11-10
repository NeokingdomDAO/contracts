import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { exit } from "process";

import { NeokingdomDAOHardhat } from "../lib";
import { NeokingdomContracts } from "../lib/internal/types";
import { question } from "../lib/utils";

function toPascalCase(str: string): string {
  let words = str.split(/(?=[A-Z])/);

  // Capitalize the first letter of each word, leave the rest as it is
  let pascalCase = words
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join("");

  return pascalCase;
}

const validContracts = [
  "governanceToken",
  "internalMarket",
  "redemptionController",
  "resolutionManager",
  "shareholderRegistry",
  "voting",
];

async function upgrade(
  hre: HardhatRuntimeEnvironment,
  contractType: keyof NeokingdomContracts
) {
  await hre.run("compile", { force: true });
  const neokingdom = await NeokingdomDAOHardhat.initialize(hre);
  const contracts = await neokingdom.loadContracts();

  const contractTypeStr = toPascalCase(contractType);
  const contractFactory = await hre.ethers.getContractFactory(contractTypeStr);
  const proxyAddress = contracts[contractType].address;
  console.log(`Upgrade ${contractTypeStr} ${proxyAddress}`);
  console.log("  Network:", hre.network.name);

  const answer = await question(
    "This action is irreversible. Please type 'GO' to continue.\n"
  );

  if (answer == "GO") {
    const contractInstance = await hre.upgrades.upgradeProxy(
      proxyAddress,
      contractFactory
    );
    await contractInstance.deployed();

    console.log("    Address:", contractInstance.address);
    console.log(`${contractTypeStr} upgraded`);
  }
}

task("upgrade")
  .addPositionalParam("contract", "The smart contract to upgrade")
  .setAction(async ({ contract }: { contract: string }, hre) => {
    console.log(contract);
    if (!validContracts.includes(contract)) {
      console.error(`Invalid contract. Valid options are: ${validContracts}`);
      exit(1);
    }

    await upgrade(hre, contract as keyof NeokingdomContracts);
  });
