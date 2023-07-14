import { Contract, ContractFactory } from "ethers";
import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { ProxyAdmin } from "../typechain";

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

task("upgrade:resolution", "Upgrade ResolutionManager", async (_, hre) => {
  await upgrade(hre, "resolutionManager");
});

task("upgrade:market", "Upgrade Internal Market", async (_, hre) => {
  await upgrade(hre, "internalMarket");
});

task("upgrade:governance", "Upgrade Governance Token", async (_, hre) => {
  await upgrade(hre, "governanceToken");
});

task("impl", "Get Proxy Impl")
  .addParam("admin", "Proxy Admin")
  .addParam("address", "Proxy address")
  .setAction(
    async ({ admin, address }: { admin: string; address: string }, hre) => {
      const [deployer] = await hre.ethers.getSigners();
      const ProxyAdmin = await hre.ethers.getContractFactory("ProxyAdmin");
      const proxyAdmin = ProxyAdmin.attach(admin).connect(
        deployer
      ) as ProxyAdmin;

      console.log("   Proxy Owner:", await proxyAdmin.owner());

      console.log(
        "    Address:",
        await proxyAdmin.getProxyImplementation(address)
      );
    }
  );
